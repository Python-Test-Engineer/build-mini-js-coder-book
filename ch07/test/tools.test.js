/**
 * tools.test.js - offline tests for tool schemas, validation, read/write handlers and observation strings.
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
import { runTool, validate, TOOL_NAMES } from '../src/tools.js';


/**
 * Build an isolated temporary workspace so tests never touch the repository or a real home folder.
 */
function fixture() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'mini-tools-'));
  const root = path.join(parent, 'workspace');
  fs.mkdirSync(root);
  fs.mkdirSync(path.join(root, 'docs'));
  fs.writeFileSync(path.join(root, 'hello.txt'), 'one\ntwo\nthree\nfour\nfive\n');
  fs.writeFileSync(path.join(root, 'docs', 'note.md'), '# note\n');
  fs.writeFileSync(path.join(parent, 'outside.txt'), 'outside\n');
  return { parent, root, ctx: { workspace: new Workspace(root) } };
}

test('TOOL_NAMES lists the read-only tools', () => {
  assert.deepEqual(TOOL_NAMES, ['list_files', 'read_file']);
});

test('list_files lists directories and files with sizes', async () => {
  const { ctx } = fixture();
  const out = await runTool('list_files', '{"path":"."}', ctx);
  assert.match(out, /docs\//);
  assert.match(out, /hello\.txt {2}\(\d+b\)/);
  assert.match(out, /1 folder\(s\), 2 file\(s\) under \./);
});

test('list_files reports a missing folder as a text error', async () => {
  const { ctx } = fixture();
  assert.match(await runTool('list_files', '{"path":"nope"}', ctx), /^ERROR: no such folder: nope/);
});

test('read_file numbers lines and reports truncation', async () => {
  const { ctx } = fixture();
  const out = await runTool('read_file', '{"path":"hello.txt","offset":2,"limit":2}', ctx);
  assert.match(out, /^hello\.txt \(6 lines\)/);
  assert.match(out, / {3}2\| two/);
  assert.match(out, / {3}3\| three/);
  assert.match(out, /\.\.\. \[3 more lines\]/);
});

test('read_file rejects folders and missing files', async () => {
  const { ctx } = fixture();
  assert.match(await runTool('read_file', '{"path":"docs"}', ctx), /is a folder - use list_files/);
  assert.match(await runTool('read_file', '{"path":"missing.txt"}', ctx), /^ERROR: no such file/);
});

test('reads outside the workspace succeed', async () => {
  const { ctx } = fixture();
  const out = await runTool('read_file', '{"path":"../outside.txt"}', ctx);
  assert.match(out, /^\.\.\/outside\.txt \(2 lines\)/);
  assert.match(out, /outside/);
});

test('bad arguments become text errors, not crashes', async () => {
  const { ctx } = fixture();
  assert.match(await runTool('read_file', '{"path":', ctx), /not valid JSON/);
  assert.match(await runTool('read_file', '{}', ctx), /missing required argument: path/);
  assert.match(await runTool('read_file', '{"path":1}', ctx), /must be a string/);
  assert.match(await runTool('nope', '{}', ctx), /unknown tool: nope/);
});

test('validate accepts an object and rejects unknown fields', () => {
  assert.deepEqual(validate('read_file', { path: 'a.txt' }).args, { path: 'a.txt' });
  assert.match(validate('read_file', { path: 'a.txt', z: 1 }).error, /does not accept/);
});
