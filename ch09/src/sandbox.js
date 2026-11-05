/**
 * sandbox.js - the last gate before a file write or a shell command.
 *
 * File writes are checked against Workspace.resolve(). Shell commands get an
 * extra, best-effort scan: tokenise the command, work out which arguments look
 * like write targets, and refuse any target outside the workspace. This is a
 * teaching heuristic, NOT a container or an OS jail. It catches common
 * accidents; it cannot stop a determined attacker who can run arbitrary code.
 *
 * A refusal always throws ForbiddenError with code FORBIDDEN and the requested
 * action, so tools can turn it into a visible, greppable "FORBIDDEN: ..." line.
 */

import fs from 'node:fs';
import path from 'node:path';
import { PathError } from './workspace.js';
import { ui } from './ui.js';


/**
 * The default writable folder: workspace/ beside src/. The CLI normally passes the resolved workspace root explicitly.
 */
export const SANDBOX_DIR = path.resolve(import.meta.dirname, '..', 'workspace');


/**
 * The three file-write actions the sandbox understands. Keeping them in one object prevents string drift between callers.
 */
export const ACTIONS = Object.freeze({
  SAVE: 'save',
  EDIT: 'edit',
  DELETE: 'delete',
});

const ALLOWED = new Set(Object.values(ACTIONS));

/**
 * Error type for sandbox refusals. It carries the action, requested path and reason, plus the stable code FORBIDDEN, so tools can return a safe observation.
 */
export class ForbiddenError extends Error {

  /**
   * A refusal with a stable FORBIDDEN code plus the action, requested path and reason. Tools turn this into a visible observation.
   */
  constructor(action, requested, reason) {
    super(`${String(action).toUpperCase()} ${requested} - ${reason}`);
    this.name = 'ForbiddenError';
    this.code = 'FORBIDDEN';
    this.action = action;
    this.requested = requested;
    this.reason = reason;
  }
}


/**
 * Split a command line into tokens while keeping quotes, redirections and shell operators as separate tokens. This is a teaching tokeniser, not a shell parser; it exists only to find likely write targets.
 */
export function tokenizeCommand(text) {
  const tokens = [];
  let current = '';
  let quote = null;
  let has = false;

  const push = () => {
    if (has) {
      tokens.push(current);
      current = '';
      has = false;
    }
  };

  const source = String(text ?? '');
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (ch === quote) quote = null;
      else current += ch;
      has = true;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      has = true;
      continue;
    }
    if (/\s/.test(ch)) {
      push();
      continue;
    }
    if (ch === '>' || ch === '<' || ch === '|' || ch === '&' || ch === ';') {
      push();
      const pair = ch + (source[i + 1] ?? '');
      if (pair === '>>' || pair === '||' || pair === '&&') {
        tokens.push(pair);
        i += 1;
      } else {
        tokens.push(ch);
      }
      continue;
    }
    current += ch;
    has = true;
  }
  push();
  return tokens;
}


/**
 * Commands whose LAST positional argument is the write destination.
 */
const DEST_LAST = new Set([
  'copy',
  'cp',
  'move',
  'mv',
  'xcopy',
  'ren',
  'rename',
  'ln',
  'install',
  'scp',
  'rsync',
]);

/**
 * Commands where every positional argument is a write target.
 */
const ALL_POSITIONAL = new Set([
  'del',
  'erase',
  'rd',
  'rmdir',
  'rm',
  'md',
  'mkdir',
  'touch',
  'tee',
  'unlink',
  'truncate',
  'shred',
]);

/**
 * PowerShell flags whose following value is a write target.
 */
const POWERSHELL_TARGET_FLAGS = new Set([
  '-destination',
  '-dest',
  '-path',
  '-filepath',
  '-literalpath',
]);

/**
 * PowerShell cmdlets that write, delete or move files.
 */
const POWERSHELL_WRITERS = new Set([
  'out-file',
  'set-content',
  'add-content',
  'new-item',
  'ni',
  'remove-item',
  'copy-item',
  'move-item',
  'rename-item',
]);

const baseCommand = (token) => {
  const name = String(token ?? '').split(/[\\/]/).pop().toLowerCase();
  return name.replace(/\.(exe|cmd|bat|com|ps1)$/, '');
};

const isOperator = (token) => ['>', '>>', '<', '|', '||', '&', '&&', ';'].includes(token);

const isSwitch = (token) => {
  if (/^--?[A-Za-z]/.test(token)) return true;
  if (!/^\/[A-Za-z][A-Za-z0-9-]*$/.test(token)) return false;
  // POSIX-looking paths such as /home are not switches. Windows switches are
  // short (/S) or conventionally upper-case.
  return token.length <= 4 || token === token.toUpperCase();
};


/**
 * Best-effort scan for paths a command is likely to write. It understands redirection, common copy/move/delete commands, curl/wget output flags and a few PowerShell writers. False positives are preferable to missing an obvious escape.
 */
export function shellWriteTargets(command) {
  const tokens = tokenizeCommand(command);
  const targets = [];
  const skip = new Set();

  // Redirections are the clearest write signal: the token after > or >> is a destination.
  for (let i = 0; i < tokens.length; i += 1) {
    if (tokens[i] === '>' || tokens[i] === '>>') {
      if (tokens[i + 1] !== undefined) {
        targets.push(tokens[i + 1]);
        skip.add(i + 1);
      }
      if (/^\d+$/.test(tokens[i - 1] ?? '')) skip.add(i - 1);
    }
  }

  let start = 0;
  while (start < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[start])) {
    start += 1;
  }
  if (start >= tokens.length) return targets;

  const commandName = baseCommand(tokens[start]);
  const rest = tokens.slice(start + 1);
  const offset = start + 1;
  const positionals = rest.filter((token, index) => {
    if (isOperator(token) || isSwitch(token)) return false;
    if (skip.has(offset + index)) return false;
    return true;
  });

  // Classify the command shape, then collect only the arguments that could be write targets.
  if (DEST_LAST.has(commandName) && positionals.length >= 2) {
    targets.push(positionals[positionals.length - 1]);
  } else if (commandName === 'robocopy' && positionals.length >= 2) {
    targets.push(positionals[1]);
  } else if (ALL_POSITIONAL.has(commandName)) {
    targets.push(...positionals);
  } else if (commandName === 'curl' || commandName === 'wget') {
    const flags = commandName === 'curl'
      ? new Set(['-o', '--output', '-O', '--remote-name'])
      : new Set(['-O', '--output-document']);
    for (let i = 0; i < rest.length; i += 1) {
      if (!flags.has(rest[i])) continue;
      if (commandName === 'curl' && (rest[i] === '-O' || rest[i] === '--remote-name')) continue;
      if (rest[i + 1] !== undefined) targets.push(rest[i + 1]);
    }
  } else if (POWERSHELL_WRITERS.has(commandName)) {
    for (let i = 0; i < rest.length; i += 1) {
      const token = rest[i].toLowerCase();
      if (POWERSHELL_TARGET_FLAGS.has(token) && rest[i + 1] !== undefined) {
        targets.push(rest[i + 1]);
      } else {
        const match = rest[i].match(/^-(?:destination|dest|path|filepath|literalpath):(.+)$/i);
        if (match) targets.push(match[1]);
      }
    }
  }

  return targets;
}

/**
 * The write and command gate. It delegates path decisions to Workspace, logs one loud refusal, and throws ForbiddenError.
 */
export class Sandbox {

  /**
   * Store the workspace policy, the displayed sandbox root, the logger and a refusal counter. The workspace is required; a sandbox without a fence is a bug.
   */
  constructor({ workspace, root = SANDBOX_DIR, log = console.log } = {}) {
    if (!workspace) throw new TypeError('Sandbox requires a workspace');
    this.workspace = workspace;
    this.root = path.resolve(root);
    this.log = log;
    this.refusals = 0;
  }


  /**
   * Record, log and throw a refusal. The counter and the loud FORBIDDEN line make refusals visible in a demo and easy to assert in a test.
   */
  forbid(action, requested, reason) {
    this.refusals += 1;
    this.log(ui.forbidden(action, requested, reason));
    throw new ForbiddenError(action, requested, reason);
  }


  /**
   * The single gate for file writes: validate the action, resolve the path through the workspace policy, and refuse deleting the workspace root itself.
   */
  check(action, requested) {
    if (!ALLOWED.has(action)) {
      throw new TypeError(`unknown sandbox action "${action}"`);
    }

    let target;
    try {
      target = this.workspace.resolve(requested);
    } catch (err) {
      if (err instanceof PathError) this.forbid(action, requested, err.message);
      throw err;
    }

    if (action === ACTIONS.DELETE && target.rel === '.') {
      this.forbid(action, requested, 'the sandbox root itself cannot be deleted');
    }
    return target;
  }


  /**
   * Scan a shell command for write targets and resolve each one through the workspace policy. Returns the command verb and the targets it inspected.
   */
  checkCommand(command) {
    const tokens = tokenizeCommand(command);
    const verb = baseCommand(tokens[0] ?? '').toUpperCase() || 'COMMAND';
    const targets = shellWriteTargets(command);
    // Every path the scanner believes this command may write must resolve inside the workspace.
    for (const target of targets) {
      try {
        this.workspace.resolve(target);
      } catch (err) {
        if (err instanceof PathError) {
          this.forbid(
            `command ${verb}`,
            command,
            `the command may write outside the workspace: ${target} (${err.message})`,
          );
        }
        throw err;
      }
    }
    return { verb, targets };
  }


  /**
   * Write entries back while preserving the file header. Creates the directory if needed.
   */
  save(requested, content) {
    const target = this.check(ACTIONS.SAVE, requested);
    const existed = fs.existsSync(target.abs);
    fs.mkdirSync(path.dirname(target.abs), { recursive: true });
    fs.writeFileSync(target.abs, content, 'utf8');
    return { existed, bytes: Buffer.byteLength(content), target };
  }


  /**
   * Delete a file or an empty directory inside the sandbox. A missing target is reported as missing rather than treated as an error.
   */
  remove(requested) {
    const target = this.check(ACTIONS.DELETE, requested);
    let stat;
    try {
      stat = fs.statSync(target.abs);
    } catch {
      return { missing: true, target };
    }
    if (stat.isDirectory()) fs.rmdirSync(target.abs);
    else fs.unlinkSync(target.abs);
    return { missing: false, directory: stat.isDirectory(), target };
  }


  /**
   * One-line description of the memory file: entry count and newest date, used by the banner.
   */
  summary() {
    return `${ACTIONS.SAVE}, ${ACTIONS.EDIT}, ${ACTIONS.DELETE} - only inside ${this.root}`;
  }
}

export default Sandbox;
