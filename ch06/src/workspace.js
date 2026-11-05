/**
 * workspace.js - the path policy.
 *
 * Two different questions are answered here:
 *   1. Where may the agent WRITE? Only inside the real workspace root, after
 *      normalising `..`, symlinks and platform-specific path forms.
 *   2. Where may the agent READ? Anywhere the user can already read. Reads are
 *      intentionally open; the fence is about accidental damage, not secrecy.
 *
 * The class never touches file contents. It only resolves and validates paths,
 * which keeps the sandbox and the tools focused on their own jobs.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Error type for path-policy refusals. The stable code "PATH" lets callers distinguish a policy refusal from an I/O failure.
 */
export class PathError extends Error {

  /**
   * A path-policy error with a stable code, so callers can distinguish policy refusals from filesystem failures.
   */
  constructor(message) {
    super(message);
    this.name = 'PathError';
    this.code = 'PATH';
  }
}

const DRIVE_RELATIVE = /^[A-Za-z]:(?![\\/])/;
const UNC = /^(\\\\|\/\/)/;

const FORBIDDEN_SEGMENTS = new Set([
  'users',
  'windows',
  'program files',
  'program files (x86)',
  'desktop',
  'documents',
  'downloads',
  'appdata',
  'onedrive',
  'library',
  'system32',
  'programdata',
  'system volume information',
  '$recycle.bin',
  'boot',
  'recovery',
]);


/**
 * Expand ~, Windows %VAR% and POSIX $VAR forms before path policy runs. Expansion is textual; validation still happens afterwards.
 */
export function expandPath(requested, env = process.env) {
  let text = String(requested).trim();
  if (text === '~') text = os.homedir();
  else if (/^~[\\/]/.test(text)) text = path.join(os.homedir(), text.slice(2));

  text = text
    .replace(/%([A-Za-z_][A-Za-z0-9_]*)%/g, (match, name) =>
      env[name] !== undefined ? env[name] : match,
    )
    .replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (match, name) =>
      env[name] !== undefined ? env[name] : match,
    )
    .replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (match, name) =>
      env[name] !== undefined ? env[name] : match,
    );

  return text;
}


/**
 * Resolve the real path of the deepest existing ancestor, then append the not-yet-existing remainder. This catches symlinked parents that would otherwise let a lexical path slip outside the workspace.
 */
function realpathBest(abs) {
  let current = abs;
  const rest = [];
  for (;;) {
    if (fs.existsSync(current)) break;
    const parent = path.dirname(current);
    if (parent === current) break;
    const base = path.basename(current);
    if (base) rest.unshift(base);
    current = parent;
  }
  let real = current;
  try {
    real = fs.realpathSync(current);
  } catch {
    // keep the lexical path
  }
  return rest.length ? path.resolve(real, ...rest) : real;
}


/**
 * Convert an absolute path into the forward-slash relative form shown to the user and the model.
 */
function toRel(root, abs) {
  const rel = path.relative(root, abs);
  if (!rel) return '.';
  return rel.split(path.sep).join('/');
}

/**
 * Resolves paths for two policies: a strict resolve() for writes and a permissive resolveRead() for reads. It contains no file-content logic.
 */
export class Workspace {

  /**
   * Resolve the workspace root and store its real path. Creating the folder if needed keeps every chapter runnable after a fresh clone.
   */
  constructor(root) {
    if (!root) throw new PathError('workspace root is required');
    this.root = path.resolve(root);
    fs.mkdirSync(this.root, { recursive: true });
    this.realRoot = fs.realpathSync(this.root);
  }


  /**
   * True when realAbs is the workspace root or a descendant of it. This is the containment check used after symlink resolution.
   */
  contains(realAbs) {
    const rel = path.relative(this.realRoot, realAbs);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  }


  /**
   * Reject empty, drive-relative and UNC paths, and expand environment variables. This is shared by reads and writes.
   */
  checkCommon(requested) {
    if (typeof requested !== 'string' || requested.trim() === '') {
      throw new PathError('path is required');
    }
    const expanded = expandPath(requested);
    if (DRIVE_RELATIVE.test(expanded)) {
      throw new PathError(`drive-relative paths are not allowed: ${requested}`);
    }
    if (UNC.test(expanded)) {
      throw new PathError(`UNC paths are not allowed: ${requested}`);
    }
    return expanded;
  }


  /**
   * Resolve a WRITE target: reject absolute paths and system folders, require lexical containment, then re-check containment after symlink resolution. Returns { abs, rel, requested }.
   */
  resolve(requested) {
    const expanded = this.checkCommon(requested);

    if (path.isAbsolute(expanded)) {
      throw new PathError(`absolute paths are not allowed: ${requested}`);
    }

    const firstSegment = expanded.replace(/\\/g, '/').split('/')[0].toLowerCase();
    if (FORBIDDEN_SEGMENTS.has(firstSegment)) {
      throw new PathError(`refusing to touch a system folder: ${requested}`);
    }

    const abs = path.resolve(this.root, expanded);
    if (!this.contains(abs)) {
      throw new PathError(`path escapes the workspace: ${requested}`);
    }

    // Symlink hardening: resolve the deepest existing ancestor, append the
    // remainder, then re-check containment against the real workspace root.
    if (!this.contains(realpathBest(abs))) {
      throw new PathError(`path escapes the workspace: ${requested}`);
    }

    return { abs, rel: toRel(this.root, abs), requested };
  }


  /**
   * Resolve a READ target. Reads are allowed anywhere the user can already read, so only common path validation and expansion apply.
   */
  resolveRead(requested) {
    const expanded = this.checkCommon(requested);
    const abs = path.isAbsolute(expanded)
      ? path.resolve(expanded)
      : path.resolve(this.root, expanded);
    return { abs, rel: toRel(this.root, abs), requested };
  }
}

export default Workspace;
