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
import { Sandbox } from '../src/sandbox.js';
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
  const workspace = new Workspace(root);
  const sandbox = new Sandbox({ workspace, root, log: () => {} });
  return { parent, root, ctx: { workspace, sandbox } };
}

test('TOOL_NAMES lists the read and write tools', () => {
  assert.deepEqual(TOOL_NAMES, [
    'list_files',
    'read_file',
    'create_file',
    'write_file',
    'edit_file',
    'delete_file',
  ]);
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


test('create_file writes a new file and refuses to clobber', async () => {
  const { root, ctx } = fixture();
  const first = await runTool('create_file', '{"path":"new/a.js","content":"hello"}', ctx);
  assert.match(first, /^created new\/a\.js \(5 bytes\)/);
  assert.equal(fs.readFileSync(path.join(root, 'new', 'a.js'), 'utf8'), 'hello');
  const second = await runTool('create_file', '{"path":"new/a.js","content":"again"}', ctx);
  assert.match(second, /^ERROR: already exists/);
});

test('write_file overwrites and creates parents', async () => {
  const { root, ctx } = fixture();
  assert.match(await runTool('write_file', '{"path":"deep/x.txt","content":"one"}', ctx), /^created/);
  assert.match(await runTool('write_file', '{"path":"deep/x.txt","content":"two"}', ctx), /^overwrote/);
  assert.equal(fs.readFileSync(path.join(root, 'deep', 'x.txt'), 'utf8'), 'two');
});

test('edit_file replaces an exact snippet and treats $1 literally', async () => {
  const { root, ctx } = fixture();
  const out = await runTool(
    'edit_file',
    JSON.stringify({ path: 'hello.txt', old_string: 'two', new_string: '$1 and $&' }),
    ctx,
  );
  assert.match(out, /^edited hello\.txt: 1 replacement\(s\), first at line 2/);
  assert.match(fs.readFileSync(path.join(root, 'hello.txt'), 'utf8'), /\$1 and \$&/);
});

test('edit_file fails on missing file, empty old_string and ambiguity', async () => {
  const { ctx } = fixture();
  assert.match(await runTool('edit_file', '{"path":"nope.txt","old_string":"a","new_string":"b"}', ctx), /no such file/);
  assert.match(await runTool('edit_file', '{"path":"hello.txt","old_string":"","new_string":"b"}', ctx), /must not be empty/);
  await runTool('write_file', '{"path":"dup.txt","content":"same same"}', ctx);
  assert.match(await runTool('edit_file', '{"path":"dup.txt","old_string":"same","new_string":"x"}', ctx), /appears 2 times/);
});

test('delete_file removes a file and reports a missing target', async () => {
  const { root, ctx } = fixture();
  assert.match(await runTool('delete_file', '{"path":"hello.txt"}', ctx), /^deleted hello\.txt/);
  assert.equal(fs.existsSync(path.join(root, 'hello.txt')), false);
  assert.match(await runTool('delete_file', '{"path":"hello.txt"}', ctx), /^nothing to delete/);
});

test('a refused write returns FORBIDDEN and prints exactly one line', async () => {
  const { root } = fixture();
  const workspace = new Workspace(root);
  const lines = [];
  const sandbox = new Sandbox({ workspace, root, log: (line) => lines.push(line) });
  const out = await runTool('write_file', '{"path":"../escape.txt","content":"x"}', { workspace, sandbox });
  assert.match(out, /^FORBIDDEN: SAVE \.\.\/escape\.txt/);
  assert.equal(lines.length, 1);
});
