/**
 * shell-sandbox.test.js - offline tests for command tokenising, write-target scanning and deny-list behaviour.
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
import { Sandbox, tokenizeCommand, shellWriteTargets } from '../src/sandbox.js';


/**
 * Build an isolated temporary workspace so tests never touch the repository or a real home folder.
 */
function fixture() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'mini-shell-'));
  const root = path.join(parent, 'workspace');
  fs.mkdirSync(root);
  const lines = [];
  const workspace = new Workspace(root);
  const sandbox = new Sandbox({ workspace, root, log: (line) => lines.push(line) });
  return { parent, root, workspace, sandbox, lines };
}

test('tokenizeCommand keeps quoted arguments together', () => {
  assert.deepEqual(tokenizeCommand('copy "a b.txt" "c d.txt"'), [
    'copy',
    'a b.txt',
    'c d.txt',
  ]);
});

test('tokenizeCommand emits operators as tokens', () => {
  assert.deepEqual(tokenizeCommand('echo hi > out.txt 2>> err.txt && cat out.txt'), [
    'echo',
    'hi',
    '>',
    'out.txt',
    '2',
    '>>',
    'err.txt',
    '&&',
    'cat',
    'out.txt',
  ]);
});

test('shellWriteTargets finds redirections', () => {
  assert.deepEqual(shellWriteTargets('echo hi > out.txt'), ['out.txt']);
  assert.deepEqual(shellWriteTargets('node x.js >> log.txt'), ['log.txt']);
  assert.deepEqual(shellWriteTargets('node x.js 2> err.txt'), ['err.txt']);
});

test('shellWriteTargets knows destination-last and all-positional commands', () => {
  assert.deepEqual(shellWriteTargets('copy a.txt b.txt'), ['b.txt']);
  assert.deepEqual(shellWriteTargets('mv a.txt ../outside.txt'), ['../outside.txt']);
  assert.deepEqual(shellWriteTargets('del a.txt b.txt'), ['a.txt', 'b.txt']);
  assert.deepEqual(shellWriteTargets('mkdir newdir'), ['newdir']);
});

test('shellWriteTargets handles robocopy, curl and PowerShell', () => {
  assert.deepEqual(shellWriteTargets('robocopy src dst /E'), ['dst']);
  assert.deepEqual(shellWriteTargets('curl -o out.json https://example.com'), ['out.json']);
  assert.deepEqual(shellWriteTargets('wget -O file.txt https://example.com'), ['file.txt']);
  assert.deepEqual(shellWriteTargets('Set-Content -Path out.txt -Value hi'), ['out.txt']);
  assert.deepEqual(shellWriteTargets('Out-File -FilePath out.txt'), ['out.txt']);
});

test('checkCommand refuses a shell copy outside before running', () => {
  const { sandbox, lines } = fixture();
  assert.throws(
    () => sandbox.checkCommand('copy a.txt ../escape.txt'),
    (err) => err.code === 'FORBIDDEN' && /COMMAND COPY/.test(err.message),
  );
  assert.equal(lines.length, 1);
  assert.match(lines[0], /FORBIDDEN COMMAND COPY/);
});

test('checkCommand allows writes inside the workspace', () => {
  const { sandbox } = fixture();
  const checked = sandbox.checkCommand('copy a.txt out.txt');
  assert.equal(checked.verb, 'COPY');
  assert.deepEqual(checked.targets, ['out.txt']);
});

test('checkCommand strips executable extensions from the verb', () => {
  const { sandbox } = fixture();
  assert.equal(sandbox.checkCommand('cmd.exe /c echo hi').verb, 'CMD');
  assert.equal(sandbox.checkCommand('copy.bat a b').verb, 'COPY');
});
