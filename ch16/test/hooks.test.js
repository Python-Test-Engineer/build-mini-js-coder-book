/**
 * hooks.test.js - offline tests for hook registration, ordering, blocking, rewriting and error isolation.
 *
 * These tests use node:test and node:assert. They never call the network and
 * never need an OpenRouter key: the model, filesystem roots and environment are
 * injected or stubbed. A failing test here means the chapter's contract has
 * drifted, not that the reader's setup is wrong.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Hooks,
  HOOK_NAMES,
  HOOK_META,
  HOOK_SUMMARY,
  traceHooks,
  printHookCatalogue,
} from '../src/hooks.js';

test('there are nine hooks, each with icon, colour, when, gets, may and why', () => {
  assert.deepEqual(HOOK_NAMES, [
    'SessionStart',
    'UserPromptSubmit',
    'PreModel',
    'PostModel',
    'PreToolUse',
    'PostToolUse',
    'Stop',
    'StepLimit',
    'SessionEnd',
  ]);
  for (const name of HOOK_NAMES) {
    const meta = HOOK_META[name];
    for (const key of ['icon', 'colour', 'when', 'gets', 'may', 'why']) {
      assert.ok(meta[key], `${name} needs ${key}`);
    }
  }
  assert.equal(HOOK_SUMMARY.total, 9);
  assert.equal(HOOK_SUMMARY.deciding, 4);
});

test('unknown hook names throw', () => {
  const hooks = new Hooks();
  assert.throws(() => hooks.on('Nope', () => {}), /unknown hook/);
  assert.throws(() => hooks.count('Nope'), /unknown hook/);
  assert.throws(() => hooks.off('Nope', 'x'), /unknown hook/);
});

test('handlers run in order and the first block wins', async () => {
  const hooks = new Hooks();
  const order = [];
  hooks.on('PreToolUse', () => {
    order.push('a');
    return { note: 'first' };
  });
  hooks.on('PreToolUse', () => {
    order.push('b');
    return { block: true, reason: 'no' };
  });
  hooks.on('PreToolUse', () => {
    order.push('c');
    return { block: true, reason: 'too late' };
  });
  const out = await hooks.run('PreToolUse', {});
  assert.deepEqual(order, ['a', 'b']);
  assert.equal(out.blocked, true);
  assert.equal(out.reason, 'no');
  assert.deepEqual(out.notes, ['first']);
  assert.equal(out.ran, 2);
});

test('a throwing hook is reported and ignored', async () => {
  const warnings = [];
  const hooks = new Hooks({ log: (line) => warnings.push(line) });
  hooks.on('PreModel', () => {
    throw new Error('boom');
  });
  hooks.on('PreModel', () => ({ note: 'still ran' }));
  const out = await hooks.run('PreModel', {});
  assert.equal(out.errors.length, 1);
  assert.deepEqual(out.notes, ['still ran']);
  assert.equal(warnings.length, 1);
});

test('a once handler detaches after one run', async () => {
  const hooks = new Hooks();
  hooks.on('SessionStart', () => ({ note: 'hi' }), { once: true });
  assert.equal(hooks.count('SessionStart'), 1);
  await hooks.run('SessionStart', {});
  assert.equal(hooks.count('SessionStart'), 0);
});

test('off removes a handler by id', () => {
  const hooks = new Hooks();
  const id = hooks.on('Stop', () => {});
  assert.equal(hooks.has('Stop'), true);
  assert.deepEqual(hooks.attached(), ['Stop']);
  hooks.off('Stop', id);
  assert.equal(hooks.has('Stop'), false);
});

test('traceHooks prints one [HOOK:Name] line per event', async () => {
  const lines = [];
  const hooks = traceHooks({ log: (line) => lines.push(line) });
  for (const name of HOOK_NAMES) await hooks.run(name, {});
  assert.equal(lines.length, HOOK_NAMES.length);
  assert.match(lines[0], /\[HOOK:SessionStart\]/);
});

test('catalogue prints all nine and marks attached hooks', () => {
  const lines = [];
  const hooks = new Hooks();
  hooks.on('Stop', () => {});
  printHookCatalogue({ log: (line) => lines.push(line), hooks });
  const text = lines.join('\n');
  for (const name of HOOK_NAMES) assert.match(text, new RegExp(name));
  assert.match(text, /live/);
});
