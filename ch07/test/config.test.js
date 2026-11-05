/**
 * config.test.js - offline tests for environment precedence, .env discovery, model normalisation and provenance.
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
import {
  findEnvFile,
  loadDotEnv,
  fingerprint,
  normalizeModel,
  loadConfig,
} from '../src/config.js';


/**
 * Create a unique temporary directory for one test case.
 */
function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mini-config-'));
}


/**
 * Set environment variables for one test and restore the previous values afterwards.
 */
function withEnv(vars, fn) {
  const saved = {};
  for (const key of Object.keys(vars)) {
    saved[key] = process.env[key];
    if (vars[key] === undefined) delete process.env[key];
    else process.env[key] = vars[key];
  }
  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('loadDotEnv parses keys, export, quotes and comments', () => {
  const dir = tempDir();
  const file = path.join(dir, '.env');
  fs.writeFileSync(
    file,
    [
      '# comment',
      'A=one',
      'export B = two',
      'C="three # not a comment"',
      "D='four'",
      'E=# whole-line comment',
      'EMPTY=',
      'F=five # trailing',
    ].join('\n'),
  );
  const vars = loadDotEnv(file);
  assert.equal(vars.A, 'one');
  assert.equal(vars.B, 'two');
  assert.equal(vars.C, 'three # not a comment');
  assert.equal(vars.D, 'four');
  assert.equal(vars.EMPTY, undefined);
  assert.equal(vars.F, 'five');
});

test('findEnvFile walks up to the nearest .env', () => {
  const dir = tempDir();
  const nested = path.join(dir, 'a', 'b');
  fs.mkdirSync(nested, { recursive: true });
  fs.writeFileSync(path.join(dir, '.env'), 'A=1\n');
  assert.equal(findEnvFile(nested), path.join(dir, '.env'));
});

test('fingerprint never exposes the whole key', () => {
  assert.equal(fingerprint(''), 'not set');
  assert.equal(fingerprint('short'), '*****');
  const key = 'sk-or-v1-abcdefghijklmnopqrstuvwxyz1234';
  const print = fingerprint(key);
  assert.match(print, /^sk-or\.\.\.1234 \(\d+ chars\)$/);
  assert.ok(!print.includes(key));
});

test('normalizeModel maps bare names to vendor/model', () => {
  assert.equal(normalizeModel('deepseek-v4.1-flash-1017'), 'deepseek/deepseek-v4.1-flash-1017');
  assert.equal(normalizeModel('gpt-5'), 'openai/gpt-5');
  assert.equal(normalizeModel('claude-sonnet'), 'anthropic/claude-sonnet');
  assert.equal(normalizeModel('gemini-pro'), 'google/gemini-pro');
  assert.equal(normalizeModel('x/y'), 'x/y');
});

test('.env beats a stale shell key; shell still supplies other names', () => {
  const dir = tempDir();
  const file = path.join(dir, '.env');
  fs.writeFileSync(
    file,
    'OPENROUTER_API_KEY=env-key-value\nOPENROUTER_MODEL=env-model\n',
  );
  withEnv(
    {
      OPENROUTER_API_KEY: 'stale-shell-key',
      OPENROUTER_MODEL: 'openai/gpt-5',
      MAX_STEPS: '7',
    },
    () => {
      const config = loadConfig({}, { envFile: file, startDir: dir });
      assert.equal(config.apiKey, 'env-key-value');
      assert.equal(config.apiKeySource, 'env');
      assert.equal(config.apiKeyOverrodeShell, true);
      assert.equal(config.modelSource, 'env');
      assert.equal(config.maxSteps, 7);
    },
  );
});

test('a missing .env is not an error', () => {
  withEnv({ OPENROUTER_API_KEY: undefined, OPENROUTER_MODEL: undefined }, () => {
    const config = loadConfig({}, { envFile: null, startDir: os.tmpdir() });
    assert.equal(config.apiKeySource, 'unset');
    assert.equal(config.apiKey, null);
    assert.equal(config.envFile, null);
    assert.equal(config.modelSource, 'default');
  });
});

test('an override is reported only when the value genuinely differed', () => {
  const dir = tempDir();
  const file = path.join(dir, '.env');
  fs.writeFileSync(file, 'OPENROUTER_MODEL=deepseek-v4.1-flash-1017\n');
  const same = loadConfig(
    { model: 'deepseek-v4.1-flash-1017' },
    { envFile: file, startDir: dir },
  );
  assert.equal(same.modelSource, 'env');
  assert.equal(same.modelNormalised, true);

  const changed = loadConfig(
    { model: 'gpt-5' },
    { envFile: file, startDir: dir },
  );
  assert.equal(changed.modelSource, 'flag');
  assert.equal(changed.model, 'openai/gpt-5');
});

test('defaults and bounds are applied', () => {
  const config = loadConfig({}, { envFile: null, startDir: os.tmpdir() });
  assert.equal(config.commandPolicy, 'ask');
  assert.equal(config.maxSteps, 12);
  assert.equal(config.requestTimeoutMs, 90_000);
  assert.equal(config.memoryMaxEntries, 60);
  assert.equal(config.memoryPromptChars, 1200);
  assert.equal(config.workspaceRoot, path.resolve(config.projectRoot, 'workspace'));
});
