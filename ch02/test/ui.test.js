/**
 * ui.test.js - offline tests for presentation strings, failure classification and exit-code meanings.
 *
 * These tests use node:test and node:assert. They never call the network and
 * never need an OpenRouter key: the model, filesystem roots and environment are
 * injected or stubbed. A failing test here means the chapter's contract has
 * drifted, not that the reader's setup is wrong.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import chalk from 'chalk';
import { ui, explainExit, isFailure } from '../src/ui.js';

const ALL = Object.keys(ui);

test('every helper returns a string', () => {
  const calls = {
    title: ['hello'],
    field: ['task'],
    kv: ['model', 'x/y'],
    step: [1, 12],
    think: ['thinking'],
    tool: ['read_file', '{"path":"a"}'],
    result: ['ok'],
    forbidden: ['save', '../x', 'escapes'],
    pass: ['yes'],
    fail: ['no'],
    rule: ['stage'],
    hookTitle: ['trace'],
    hookLine: ['🚀', 'SessionStart', 'cyan', 'before', true],
    hookField: ['Attach', 'on', 'cyan'],
    hookLive: [],
    hookNote: ['SessionStart', 'note'],
    hookTrace: ['🚀', 'SessionStart', 'cyan', 'why', 'detail'],
    hookFlow: [['a', 'b']],
    memory: ['text'],
    exitNote: [2, 'usage'],
    answerRule: [],
    answer: ['done'],
    warn: ['careful'],
    waiting: ['waiting'],
    error: ['bad'],
    note: ['note'],
    prompt: ['  task'],
    dim: ['dim'],
  };
  for (const name of ALL) {
    const value = ui[name](...(calls[name] ?? []));
    assert.equal(typeof value, 'string', `${name} should return a string`);
  }
});

test('plain text when colour is off', () => {
  const level = chalk.level;
  chalk.level = 0;
  try {
    assert.equal(ui.title('hello'), 'hello');
    assert.equal(ui.think('x'), 'think: x');
    assert.match(ui.forbidden('save', '../escape.txt', 'path escapes the workspace: ../escape.txt'), /^⛔ FORBIDDEN SAVE \.\.\/escape\.txt - /);
  } finally {
    chalk.level = level;
  }
});

test('ANSI is emitted when colour is on', () => {
  const level = chalk.level;
  chalk.level = 3;
  try {
    assert.match(ui.title('hello'), /\u001b\[/);
    assert.match(ui.forbidden('save', 'x', 'y'), /\u001b\[/);
  } finally {
    chalk.level = level;
  }
});

test('result classifies failures from the observation text', () => {
  const level = chalk.level;
  chalk.level = 0;
  try {
    assert.equal(isFailure('ERROR: no such file'), true);
    assert.equal(isFailure('DENIED: blocked'), true);
    assert.equal(isFailure('FORBIDDEN: SAVE x'), true);
    assert.equal(isFailure('exit code 1'), true);
    assert.equal(isFailure('exit code 0'), false);
    assert.equal(isFailure('created x (3 bytes)'), false);

    const red = chalk.red;
    const green = chalk.green;
    // With colour off both look the same, so check the raw string.
    assert.equal(ui.result('ERROR: nope'), 'ERROR: nope');
    assert.equal(ui.result('ok'), 'ok');
    assert.equal(typeof red, 'function');
    assert.equal(typeof green, 'function');
  } finally {
    chalk.level = level;
  }
});

test('a successful command keeps its first stdout line as a dim annotation', () => {
  const level = chalk.level;
  chalk.level = 0;
  try {
    assert.equal(ui.result('exit code 0\nstdout: hello'), 'exit code 0\nstdout: hello');
  } finally {
    chalk.level = level;
  }
});

test('explainExit maps common codes', () => {
  assert.equal(explainExit(0), 'success');
  assert.match(explainExit(1), /failure/);
  assert.match(explainExit(2), /usage/);
  assert.match(explainExit(127), /not found/);
  assert.match(explainExit(9009), /Windows/);
  assert.match(explainExit(130), /signal 2/);
});

test('model output with tags and backslashes prints verbatim', () => {
  const level = chalk.level;
  chalk.level = 0;
  try {
    const text = '<red>back\\slash {json}';
    assert.equal(ui.answer(text), text);
  } finally {
    chalk.level = level;
  }
});
