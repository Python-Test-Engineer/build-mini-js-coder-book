/**
 * sandbox.js - the last gate before a file write.
 *
 * Every create, write, edit and delete goes through Sandbox.check(), which
 * delegates the actual path decision to Workspace.resolve(). A refusal throws
 * ForbiddenError with code FORBIDDEN and a human-readable reason, so the tool
 * layer can return a visible "FORBIDDEN: ..." observation without crashing the
 * agent loop.
 *
 * This is a policy fence, not an operating-system security boundary.
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
