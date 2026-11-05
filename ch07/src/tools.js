/**
 * tools.js - tool schemas, argument validation, handlers and dispatch.
 *
 * The schemas are the prompt the model reads: names, descriptions and JSON
 * parameter shapes. validate() is the trust boundary; handlers assume their
 * arguments are already well formed. Every handler returns a STRING, including
 * failures, so one bad tool call becomes an observation the model can recover
 * from instead of an exception that kills the run.
 *
 * Tools in this chapter: list_files, read_file.
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
 * The read-only tool group. These are the only tools present in the read-only stage.
 */
export const READ_ONLY_SCHEMAS = [LIST_FILES, READ_FILE];

/**
 * Every schema this chapter exposes to the model.
 */
export const TOOL_SCHEMAS = READ_ONLY_SCHEMAS;

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
 * Dispatch table from tool name to implementation. runTool() validates before reaching this map.
 */
const HANDLERS = new Map([
  ['list_files', listFiles],
  ['read_file', readFile],
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
