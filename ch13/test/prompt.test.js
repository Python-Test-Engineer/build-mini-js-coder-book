/**
 * prompt.test.js - offline tests for the system-prompt rules and the conditional tool advice.
 *
 * These tests use node:test and node:assert. They never call the network and
 * never need an OpenRouter key: the model, filesystem roots and environment are
 * injected or stubbed. A failing test here means the chapter's contract has
 * drifted, not that the reader's setup is wrong.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { systemRules, buildSystemPrompt } from '../src/prompt.js';

const toolNames = ['list_files', 'read_file', 'create_file', 'run_command'];

test('systemRules returns the behavioural rules', () => {
  const rules = systemRules();
  assert.match(rules, /Look before you write/);
  assert.match(rules, /Do not invent tool results/);
  assert.match(rules, /one tool call per step/i);
});

test('systemRules only lists tools when handed tool names', () => {
  assert.doesNotMatch(systemRules(), /Tools available/);
  const withTools = systemRules(toolNames);
  assert.match(withTools, /Tools available: list_files, read_file/);
  assert.match(withTools, /create_file for a new file/);
  assert.match(withTools, /Run what you wrote/);
});

test('buildSystemPrompt returns rules only when there is no memory', () => {
  const prompt = buildSystemPrompt({ tools: [] });
  assert.equal(prompt, systemRules([]));
});

test('buildSystemPrompt injects the memory digest and logs it', () => {
  const seen = [];
  const memory = {
    label: 'src/memory.md',
    digest: () => 'memory - src/memory.md\n- [pref] likes tea',
    entries: () => [{ text: 'likes tea' }],
  };
  const prompt = buildSystemPrompt({
    memory,
    tools: [],
    log: (line) => seen.push(line),
  });
  assert.match(prompt, /likes tea/);
  assert.equal(seen.length, 1);
  assert.match(seen[0], /memory ← src\/memory\.md/);
});

test('buildSystemPrompt keeps a fresh system prompt per call', () => {
  const rules = systemRules([]);
  const first = buildSystemPrompt({ tools: [] });
  const second = buildSystemPrompt({ tools: [] });
  assert.equal(first, rules);
  assert.equal(second, rules);
});
