/**
 * sandbox.test.js - offline tests for the write fence and FORBIDDEN contract.
 *
 * These tests use node:test and node:assert. They never call the network and
 * never need an OpenRouter key: the model, filesystem roots and environment are
 * injected or stubbed. A failing test here means the chapter's contract has
 * drifted, not that the reader's setup is wrong.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Workspace } from '../src/workspace.js';
import { Sandbox, ForbiddenError, ACTIONS } from '../src/sandbox.js';


/**
 * Build an isolated temporary workspace so tests never touch the repository or a real home folder.
 */
function fixture() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'mini-sandbox-'));
  const root = path.join(parent, 'workspace');
  fs.mkdirSync(root);
  const lines = [];
  const workspace = new Workspace(root);
  const sandbox = new Sandbox({ workspace, root, log: (line) => lines.push(line) });
  return { parent, root, workspace, sandbox, lines };
}

test('save writes inside the workspace and reports existence', () => {
  const { root, sandbox } = fixture();
  const first = sandbox.save('a/b.txt', 'hello');
  assert.equal(first.existed, false);
  assert.equal(first.bytes, 5);
  assert.equal(fs.readFileSync(path.join(root, 'a', 'b.txt'), 'utf8'), 'hello');

  const second = sandbox.save('a/b.txt', 'bye');
  assert.equal(second.existed, true);
});

test('remove deletes files and empty folders, and reports missing', () => {
  const { root, sandbox } = fixture();
  sandbox.save('x.txt', 'x');
  fs.mkdirSync(path.join(root, 'empty'));
  assert.equal(sandbox.remove('x.txt').missing, false);
  assert.equal(fs.existsSync(path.join(root, 'x.txt')), false);
  assert.equal(sandbox.remove('empty').missing, false);
  assert.equal(sandbox.remove('nope.txt').missing, true);
});

test('every escape shape is refused for save, edit and delete', () => {
  const { sandbox, lines } = fixture();
  for (const action of [ACTIONS.SAVE, ACTIONS.EDIT, ACTIONS.DELETE]) {
    lines.length = 0;
    assert.throws(() => sandbox.check(action, '../escape.txt'), ForbiddenError);
    assert.equal(lines.length, 1, 'exactly one FORBIDDEN line per refusal');
    assert.match(lines[0], /FORBIDDEN SAVE|FORBIDDEN EDIT|FORBIDDEN DELETE/);
  }
});

test('deleting the sandbox root is refused', () => {
  const { sandbox } = fixture();
  assert.throws(() => sandbox.check(ACTIONS.DELETE, '.'), /sandbox root itself/);
});

test('an unknown action throws a TypeError, not a refusal', () => {
  const { sandbox } = fixture();
  assert.throws(() => sandbox.check('nonsense', 'x'), TypeError);
});

test('summary names the actions and the root', () => {
  const { root, sandbox } = fixture();
  const summary = sandbox.summary();
  assert.match(summary, /save, edit, delete/);
  assert.ok(summary.includes(root));
});
