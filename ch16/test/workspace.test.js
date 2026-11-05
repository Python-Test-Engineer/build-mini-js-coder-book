/**
 * workspace.test.js - offline tests for path containment, traversal, symlink and system-folder defences.
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
import { Workspace, PathError } from '../src/workspace.js';

function fresh() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'mini-ws-'));
  const root = path.join(parent, 'workspace');
  fs.mkdirSync(root);
  return { parent, root, ws: new Workspace(root) };
}

test('resolves legitimate relative paths and reports rel', () => {
  const { root, ws } = fresh();
  const target = ws.resolve('a/b.txt');
  assert.equal(target.abs, path.join(root, 'a', 'b.txt'));
  assert.equal(target.rel, 'a/b.txt');
  assert.equal(ws.resolve('.').rel, '.');
});

test('refuses every escape shape', () => {
  const { root, ws } = fresh();
  const cases = [
    '',
    '../escape.txt',
    'a/../../escape.txt',
    path.join(root, 'absolute.txt'),
    'C:foo',
    '\\\\server\\share\\x',
    '//server/share/x',
    '~/Desktop/pwned.txt',
    'users/x',
    'windows/system32/x',
  ];
  for (const requested of cases) {
    assert.throws(() => ws.resolve(requested), PathError, `expected refusal for ${requested}`);
  }
});

test('reads outside the workspace are allowed', () => {
  const { parent, ws } = fresh();
  const outside = ws.resolveRead('../outside.txt');
  assert.equal(outside.abs, path.join(parent, 'outside.txt'));
  assert.equal(outside.rel, '../outside.txt');

  const abs = ws.resolveRead(path.join(parent, 'outside.txt'));
  assert.equal(abs.abs, path.join(parent, 'outside.txt'));
});

test('writes cannot escape through a symlinked folder', () => {
  const { parent, root, ws } = fresh();
  const outside = path.join(parent, 'outside');
  fs.mkdirSync(outside);
  const link = path.join(root, 'link');
  try {
    fs.symlinkSync(outside, link, 'junction');
  } catch (err) {
    if (err.code === 'EPERM' || err.code === 'EACCES') return; // Windows without symlink rights
    throw err;
  }
  assert.throws(() => ws.resolve('link/evil.txt'), /escapes the workspace/);
});

test('expands environment variables before containment checks', () => {
  const { root, ws } = fresh();
  process.env.MINI_WS_TEST = 'inside';
  try {
    assert.equal(ws.resolve('%MINI_WS_TEST%/x.txt').rel, 'inside/x.txt');
    assert.equal(ws.resolve('${MINI_WS_TEST}/y.txt').rel, 'inside/y.txt');
  } finally {
    delete process.env.MINI_WS_TEST;
  }
  assert.equal(ws.root, path.resolve(root));
});
