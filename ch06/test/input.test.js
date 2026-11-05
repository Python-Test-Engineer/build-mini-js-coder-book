/**
 * input.test.js - offline tests for argument parsing and line input without starting a real model call.
 *
 * These tests use node:test and node:assert. They never call the network and
 * never need an OpenRouter key: the model, filesystem roots and environment are
 * injected or stubbed. A failing test here means the chapter's contract has
 * drifted, not that the reader's setup is wrong.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { askTask, parseArgs } from '../src/cli.js';

test('askTask returns the first non-blank line', async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  input.end('\n   \nhello world\nsecond\n');
  const task = await askTask({ input, output });
  assert.equal(task, 'hello world');
});

test('askTask trims surrounding whitespace', async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  input.end('   spaced task   \n');
  assert.equal(await askTask({ input, output }), 'spaced task');
});

test('askTask returns null at end of input', async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  input.end();
  assert.equal(await askTask({ input, output }), null);
});

test('parseArgs separates flags from the task', () => {
  const { opts, task } = parseArgs([
    '--model',
    'openai/gpt-5',
    '--max-steps',
    '3',
    'say',
    'hello',
  ]);
  assert.equal(opts.model, 'openai/gpt-5');
  assert.equal(opts.maxSteps, 3);
  assert.equal(task, 'say hello');
});

test('--help is recognised without a task', () => {
  assert.equal(parseArgs(['--help']).opts.help, true);
});
