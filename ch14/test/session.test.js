/**
 * session.test.js - offline tests for history trimming, exit codes, argument parsing and the CLI entry guard.
 *
 * These tests use node:test and node:assert. They never call the network and
 * never need an OpenRouter key: the model, filesystem roots and environment are
 * injected or stubbed. A failing test here means the chapter's contract has
 * drifted, not that the reader's setup is wrong.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import {
  MAX_HISTORY,
  parseArgs,
  trimHistory,
  taskExitCode,
  askTask,
} from '../src/cli.js';

const msg = (role, content = role) => ({ role, content });

test('MAX_HISTORY is 24', () => {
  assert.equal(MAX_HISTORY, 24);
});

test('trimHistory drops system messages and keeps the tail', () => {
  const history = [
    msg('system'),
    msg('user', 'u1'),
    msg('assistant', 'a1'),
    msg('user', 'u2'),
    msg('assistant', 'a2'),
  ];
  const trimmed = trimHistory(history, 4);
  assert.equal(trimmed.some((m) => m.role === 'system'), false);
  assert.deepEqual(trimmed.map((m) => m.content), ['u1', 'a1', 'u2', 'a2']);
});

test('trimHistory starts on a user message', () => {
  const history = [
    msg('assistant', 'a0'),
    msg('tool', 't0'),
    msg('user', 'u1'),
    msg('assistant', 'a1'),
    msg('tool', 't1'),
  ];
  const trimmed = trimHistory(history, 3);
  assert.equal(trimmed[0].role, 'user');
  assert.deepEqual(trimmed.map((m) => m.content), ['u1', 'a1', 't1']);
});

test('trimHistory returns [] when there is no safe boundary', () => {
  assert.deepEqual(trimHistory([msg('assistant'), msg('tool')], 5), []);
  assert.deepEqual(trimHistory([], 5), []);
});

test('taskExitCode maps the reason to the process exit code', () => {
  assert.equal(taskExitCode({ ok: true }), 0);
  assert.equal(taskExitCode({ ok: false, reason: 'request_failed' }), 1);
  assert.equal(taskExitCode({ ok: false, reason: 'max_steps' }), 3);
  assert.equal(taskExitCode({ ok: false, reason: 'blocked_by_hook' }), 0);
});

test('parseArgs recognises the new flags', () => {
  const { opts, task } = parseArgs([
    '--demo',
    '--no-memory',
    '--no-hooks',
    '--yes',
    'do',
    'it',
  ]);
  assert.equal(opts.demo, true);
  assert.equal(opts.noMemory, true);
  assert.equal(opts.noHooks, true);
  assert.equal(opts.yes, true);
  assert.equal(task, 'do it');
});

test('session commands arrive through askTask unchanged', async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  input.end('/new\n');
  assert.equal(await askTask({ input, output }), '/new');
});
