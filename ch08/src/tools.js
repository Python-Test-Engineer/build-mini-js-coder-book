/**
 * tools.js - tool schemas, argument validation, handlers and dispatch.
 *
 * The schemas are the prompt the model reads: names, descriptions and JSON
 * parameter shapes. validate() is the trust boundary; handlers assume their
 * arguments are already well formed. Every handler returns a STRING, including
 * failures, so one bad tool call becomes an observation the model can recover
 * from instead of an exception that kills the run.
 *
 * Tools in this chapter: list_files, read_file, create_file, write_file, edit_file, delete_file.
 */

import fs from 'node:fs';
import path from 'node:path';


/**
 * Folders that listing and searching should not descend into: dependencies, VCS internals and caches.
 */
const SKIP = new Set(['.git', 'node_modules', '.venv', '__pycache__']);

const schema = (name, description, properties = {}, required = []) => ({
  type: 'function',
  function: {
    name,
    description,
    parameters: {
      type: 'object',
      properties,
      ...(required.length ? { required } : {}),
      additionalProperties: false,
    },
  },
});


/**
 * Schema for list_files: bounded, read-only directory listing.
 */
const LIST_FILES = schema(
  'list_files',
  'List files and folders under a path. Reads are allowed anywhere.',
  {
    path: { type: 'string', description: 'Folder path, relative to the workspace root (default ".")' },
    depth: { type: 'integer', description: 'How deep to walk (default 3, max 6)' },
  },
);

/**
 * Schema for read_file: numbered lines with offset and limit.
 */
const READ_FILE = schema(
  'read_file',
  'Read a text file with numbered lines. Reads are allowed anywhere.',
  {
    path: { type: 'string', description: 'File path, relative to the workspace root or absolute' },
    offset: { type: 'integer', description: 'First line to read (default 1)' },
    limit: { type: 'integer', description: 'Maximum lines to read (default 200, max 2000)' },
  },
  ['path'],
);


/**
 * Schema for create_file: creates a new file and refuses to overwrite.
 */
const CREATE_FILE = schema(
  'create_file',
  'Create a NEW file with the given content. Fails if the file already exists - use edit_file or write_file for existing files.',
  {
    path: { type: 'string', description: 'File path relative to the workspace root' },
    content: { type: 'string', description: 'Full file content' },
  },
  ['path', 'content'],
);

/**
 * Schema for write_file: create or overwrite a whole file.
 */
const WRITE_FILE = schema(
  'write_file',
  'Write a whole file, creating or overwriting it. Creates parent folders.',
  {
    path: { type: 'string', description: 'File path relative to the workspace root' },
    content: { type: 'string', description: 'Full file content' },
  },
  ['path', 'content'],
);

/**
 * Schema for edit_file: exact-snippet replacement with an optional replace_all.
 */
const EDIT_FILE = schema(
  'edit_file',
  'Replace an exact snippet in an existing file. old_string must match exactly, including whitespace.',
  {
    path: { type: 'string', description: 'File path relative to the workspace root' },
    old_string: { type: 'string', description: 'Exact text to find' },
    new_string: { type: 'string', description: 'Replacement text' },
    replace_all: { type: 'boolean', description: 'Replace every occurrence (default false)' },
  },
  ['path', 'old_string', 'new_string'],
);

/**
 * Schema for delete_file: file or empty folder inside the workspace.
 */
const DELETE_FILE = schema(
  'delete_file',
  'Delete a file or an empty folder inside the workspace.',
  {
    path: { type: 'string', description: 'File or folder path relative to the workspace root' },
  },
  ['path'],
);


/**
 * The read-only tool group. These are the only tools present in the read-only stage.
 */
export const READ_ONLY_SCHEMAS = [LIST_FILES, READ_FILE];

/**
 * The write tool group: create, write, edit and delete.
 */
export const WRITE_SCHEMAS = [CREATE_FILE, WRITE_FILE, EDIT_FILE, DELETE_FILE];

/**
 * Every schema this chapter exposes to the model.
 */
export const TOOL_SCHEMAS = [...READ_ONLY_SCHEMAS, ...WRITE_SCHEMAS];

/**
 * Tool names derived from the schemas so the prompt, banner and tests cannot drift.
 */
export const TOOL_NAMES = TOOL_SCHEMAS.map((tool) => tool.function.name);

/**
 * Fast lookup from tool name to schema for validation.
 */
const SCHEMAS_BY_NAME = new Map(TOOL_SCHEMAS.map((tool) => [tool.function.name, tool]));


/**
 * Check one argument against the schema type. Returns an error string or null. This is intentionally small: the model gets a precise message, not a stack trace.
 */
function checkType(name, key, value, expected) {
  if (expected === 'integer') {
    if (!Number.isInteger(value)) return `ERROR: ${name}.${key} must be an integer`;
    return null;
  }
  if (expected === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return `ERROR: ${name}.${key} must be a number`;
    }
    return null;
  }
  if (typeof value !== expected) return `ERROR: ${name}.${key} must be a ${expected}`;
  return null;
}


/**
 * Parse raw tool arguments and validate required fields, unknown fields and basic types against the schema. Returns { args } or { error }. Every handler can then assume well-formed input.
 */
export function validate(name, rawArgs) {
  const tool = SCHEMAS_BY_NAME.get(name);
  if (!tool) return { error: `ERROR: unknown tool: ${name}` };

  let args;
  if (typeof rawArgs === 'string') {
    if (rawArgs.trim() === '') args = {};
    else {
      try {
        args = JSON.parse(rawArgs);
      } catch {
        return { error: `ERROR: ${name} arguments are not valid JSON` };
      }
    }
  } else if (rawArgs && typeof rawArgs === 'object') {
    args = rawArgs;
  } else {
    return { error: `ERROR: ${name} arguments must be an object` };
  }

  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    return { error: `ERROR: ${name} arguments must be an object` };
  }

  const params = tool.function.parameters;
  for (const key of params.required ?? []) {
    if (args[key] === undefined || args[key] === null) {
      return { error: `ERROR: ${name} is missing required argument: ${key}` };
    }
  }
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined || value === null) continue;
    const spec = params.properties[key];
    if (!spec) return { error: `ERROR: ${name} does not accept argument: ${key}` };
    const problem = checkType(name, key, value, spec.type);
    if (problem) return { error: problem };
  }
  return { args };
}


/**
 * Turn an absolute path into the forward-slash relative form used in tool output.
 */
function relPath(root, abs) {
  const rel = path.relative(root, abs);
  if (!rel) return '.';
  return rel.split(path.sep).join('/');
}


/**
 * Walk a folder to a bounded depth (max 6) and return sorted entries plus counts. Skips dependency/cache folders, follows symlinks defensively and caps the listing at 200 lines.
 */
function listFiles(args, ctx) {
  const target = ctx.workspace.resolveRead(args.path ?? '.');
  const maxDepth = Math.min(6, Math.max(1, Number.isInteger(args.depth) ? args.depth : 3));

  let stat;
  try {
    stat = fs.statSync(target.abs);
  } catch {
    return `ERROR: no such folder: ${target.rel}`;
  }
  if (!stat.isDirectory()) return `ERROR: ${target.rel} is not a folder - use read_file`;

  const lines = [];
  let dirs = 0;
  let files = 0;

  // Depth-first walk with a hard line cap. Symlinks are followed only for their target type and are never used to escape the listing root.
  const walk = (dirAbs, depth) => {
    if (lines.length >= 200) return;
    let entries;
    try {
      entries = fs.readdirSync(dirAbs, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (lines.length >= 200) return;
      if (SKIP.has(entry.name)) continue;
      const abs = path.join(dirAbs, entry.name);
      const rel = relPath(target.abs, abs);
      let dirent = entry;
      if (entry.isSymbolicLink()) {
        try {
          dirent = fs.statSync(abs);
          dirent = { isDirectory: () => dirent.isDirectory(), isFile: () => dirent.isFile() };
        } catch {
          continue;
        }
      }
      if (dirent.isDirectory()) {
        dirs += 1;
        lines.push(`${rel}/`);
        if (depth < maxDepth) walk(abs, depth + 1);
      } else if (dirent.isFile()) {
        files += 1;
        let size = 0;
        try {
          size = fs.statSync(abs).size;
        } catch {
          size = 0;
        }
        lines.push(`${rel}  (${size}b)`);
      }
    }
  };

  walk(target.abs, 1);

  const body = lines.join('\n');
  return `${body}\n\n${dirs} folder(s), ${files} file(s) under ${target.rel}`;
}


/**
 * Read a text file and return numbered lines with a total-line header and a truncation footer. Offset and limit are clamped so a request cannot force an unbounded read.
 */
function readFile(args, ctx) {
  const target = ctx.workspace.resolveRead(args.path);
  let stat;
  try {
    stat = fs.statSync(target.abs);
  } catch {
    return `ERROR: no such file: ${target.rel}`;
  }
  if (stat.isDirectory()) return `ERROR: ${target.rel} is a folder - use list_files`;

  const source = fs.readFileSync(target.abs, 'utf8');
  const all = source.split(/\r?\n/);
  const total = all.length;
  const offset = Math.max(1, Number.isInteger(args.offset) ? args.offset : 1);
  const limit = Math.min(2000, Math.max(1, Number.isInteger(args.limit) ? args.limit : 200));
  const start = offset - 1;
  const slice = all.slice(start, start + limit);

  // Numbering gives the model stable line references for later edits.
  const numbered = slice
    .map((line, index) => `${String(start + index + 1).padStart(4, ' ')}| ${line}`)
    .join('\n');
  const header = `${target.rel} (${total} lines)`;
  const remaining = total - (start + slice.length);
  const tail = remaining > 0 ? `\n... [${remaining} more lines]` : '';
  return `${header}\n${numbered}${tail}`;
}


/**
 * Create a NEW file inside the sandbox. Refuses to overwrite; the model is told to use edit_file or write_file for existing files.
 */
function createFile(args, ctx) {
  const target = ctx.sandbox.check('save', args.path);
  if (fs.existsSync(target.abs)) {
    return 'ERROR: already exists - use edit_file or write_file';
  }
  fs.mkdirSync(path.dirname(target.abs), { recursive: true });
  fs.writeFileSync(target.abs, args.content, 'utf8');
  return `created ${target.rel} (${Buffer.byteLength(args.content)} bytes)`;
}


/**
 * Create or overwrite a whole file inside the sandbox, creating parent folders as needed.
 */
function writeFile(args, ctx) {
  const target = ctx.sandbox.check('save', args.path);
  const existed = fs.existsSync(target.abs);
  fs.mkdirSync(path.dirname(target.abs), { recursive: true });
  fs.writeFileSync(target.abs, args.content, 'utf8');
  return `${existed ? 'overwrote' : 'created'} ${target.rel} (${Buffer.byteLength(args.content)} bytes)`;
}


/**
 * Replace an exact snippet inside an existing file. Refuses empty, missing or ambiguous matches and reports the first replacement line. The replacement function avoids "$&" expansion surprises.
 */
function editFile(args, ctx) {
  const target = ctx.sandbox.check('edit', args.path);
  if (!fs.existsSync(target.abs)) return `ERROR: no such file: ${target.rel}`;
  if (fs.statSync(target.abs).isDirectory()) return `ERROR: ${target.rel} is a folder`;

  const oldStr = String(args.old_string);
  const newStr = String(args.new_string);
  if (oldStr === '') return 'ERROR: old_string must not be empty';

  const source = fs.readFileSync(target.abs, 'utf8');
  // Count exact occurrences first. Ambiguous replacements are refused so the model must add context.
  const count = source.split(oldStr).length - 1;
  if (count === 0) {
    return `ERROR: old_string not found in ${target.rel}. Read the file and copy the snippet exactly, including whitespace.`;
  }
  if (count > 1 && !args.replace_all) {
    return `ERROR: old_string appears ${count} times in ${target.rel}. Add surrounding context to make it unique, or pass replace_all: true.`;
  }

  const first = source.indexOf(oldStr);
  const line = source.slice(0, first).split('\n').length;
  // Use a function replacement so "$&" and similar sequences in new_string are inserted literally.
  const updated = args.replace_all
    ? source.split(oldStr).join(newStr)
    : source.replace(oldStr, () => newStr);
  fs.writeFileSync(target.abs, updated, 'utf8');
  return `edited ${target.rel}: ${args.replace_all ? count : 1} replacement(s), first at line ${line}`;
}


/**
 * Delete a file or empty folder inside the sandbox and report the relative path.
 */
function deleteFile(args, ctx) {
  const result = ctx.sandbox.remove(args.path);
  const rel = result.target.rel;
  return result.missing ? `nothing to delete: ${rel}` : `deleted ${rel}`;
}


/**
 * Dispatch table from tool name to implementation. runTool() validates before reaching this map.
 */
const HANDLERS = new Map([
  ['list_files', listFiles],
  ['read_file', readFile],
  ['create_file', createFile],
  ['write_file', writeFile],
  ['edit_file', editFile],
  ['delete_file', deleteFile],
]);


/**
 * Validate then dispatch one tool call. Handlers return strings; FORBIDDEN payloads and unexpected exceptions are converted into safe ERROR/FORBIDDEN observations instead of crashing the loop.
 */
export async function runTool(name, rawArgs, ctx = {}) {
  const checked = validate(name, rawArgs);
  if (checked.error) return checked.error;
  const handler = HANDLERS.get(name);
  if (!handler) return `ERROR: unknown tool: ${name}`;
  try {
    return await handler(checked.args, ctx);
  } catch (err) {
    if (err?.code === 'FORBIDDEN') return `FORBIDDEN: ${err.message}`;
    return `ERROR: ${err?.message ?? String(err)}`;
  }
}

export default runTool;
