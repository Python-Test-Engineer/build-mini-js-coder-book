/**
 * agent.test.js - offline tests for the ReAct loop with a fake model: tools, step limits, truncation and hooks.
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
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runTask } from '../src/agent.js';
import { Workspace } from '../src/workspace.js';
import { Sandbox } from '../src/sandbox.js';
import { Hooks } from '../src/hooks.js';
import { buildSystemPrompt } from '../src/prompt.js';
import { systemRules } from '../src/prompt.js';
import { TOOL_NAMES } from '../src/tools.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const AGENT = path.join(HERE, '..', 'src', 'agent.js');


/**
 * Build an isolated temporary workspace so tests never touch the repository or a real home folder.
 */
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mini-agent-'));
  const workspace = new Workspace(root);
  const sandbox = new Sandbox({ workspace, root, log: () => {} });
  fs.writeFileSync(path.join(root, 'a.txt'), 'hello\n');
  return { root, workspace, sandbox, lines: [] };
}

const reply = (message, finish_reason = 'stop') => ({
  choices: [{ finish_reason, message }],
});

const toolCall = (id, name, args) => ({
  id,
  type: 'function',
  function: { name, arguments: JSON.stringify(args) },
});

function scripted(script, inspect) {
  let i = 0;
  const calls = [];
  const chatFn = async (payload) => {
    calls.push(payload);
    if (inspect) inspect(payload, i);
    const step = script[Math.min(i, script.length - 1)];
    i += 1;
    return typeof step === 'function' ? step(payload) : step;
  };
  chatFn.calls = calls;
  return chatFn;
}

function run(overrides = {}) {
  const env = fixture();
  return {
    ...env,
    promise: runTask({
      task: 'do a thing',
      workspace: env.workspace,
      sandbox: env.sandbox,
      commandPolicy: 'deny',
      maxSteps: 6,
      chatFn: scripted([reply({ role: 'assistant', content: 'done' })]),
      log: (line) => env.lines.push(line),
      heartbeatMs: 100_000,
      ...overrides,
    }),
  };
}

test('a plain answer stops at step 1', async () => {
  const { promise } = run();
  const result = await promise;
  assert.equal(result.ok, true);
  assert.equal(result.answer, 'done');
  assert.equal(result.steps, 1);
});

test('the loop runs a tool and then stops on a plain answer', async () => {
  const { promise, workspace } = run({
    chatFn: scripted([
      reply(
        {
          role: 'assistant',
          content: null,
          tool_calls: [toolCall('c1', 'read_file', { path: 'a.txt' })],
        },
        'tool_calls',
      ),
      reply({ role: 'assistant', content: 'read it' }),
    ]),
  });
  const result = await promise;
  assert.equal(result.ok, true);
  assert.equal(result.answer, 'read it');
  const toolMessage = result.messages.find((m) => m.role === 'tool');
  assert.equal(toolMessage.tool_call_id, 'c1');
  assert.match(toolMessage.content, /hello/);
  assert.ok(workspace.root);
});

test('a failing tool result is fed back so the model can correct', async () => {
  let sawObservation = false;
  const { promise } = run({
    chatFn: scripted(
      [
        reply(
          {
            role: 'assistant',
            content: null,
            tool_calls: [toolCall('c1', 'read_file', { path: 'missing.txt' })],
          },
          'tool_calls',
        ),
        reply({ role: 'assistant', content: 'corrected' }),
      ],
      (payload, i) => {
        if (i === 1) {
          const tool = payload.messages.find((m) => m.role === 'tool');
          sawObservation = /^ERROR: no such file/.test(tool.content);
        }
      },
    ),
  });
  const result = await promise;
  assert.equal(result.ok, true);
  assert.equal(sawObservation, true);
});

test('the loop is capped at maxSteps', async () => {
  let i = 0;
  const { promise } = run({
    maxSteps: 2,
    chatFn: async () => {
      i += 1;
      return reply(
        {
          role: 'assistant',
          content: `step ${i}`,
          tool_calls: [toolCall(`c${i}`, 'list_files', { path: '.' })],
        },
        'tool_calls',
      );
    },
  });
  const result = await promise;
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'max_steps');
});

test('a truncated reply is not dispatched; the model is asked to continue smaller', async () => {
  let sawContinuation = false;
  const { promise } = run({
    chatFn: scripted(
      [
        reply({ role: 'assistant', content: 'half a thought' }, 'length'),
        reply({ role: 'assistant', content: 'finished' }),
      ],
      (payload, i) => {
        if (i === 1) {
          sawContinuation = payload.messages.some(
            (m) => m.role === 'user' && /length limit/.test(m.content),
          );
        }
      },
    ),
  });
  const result = await promise;
  assert.equal(result.ok, true);
  assert.equal(result.answer, 'finished');
  assert.equal(sawContinuation, true);
});

test('the heartbeat prints waiting lines during a slow call', async () => {
  const { promise, lines } = run({
    heartbeatMs: 15,
    chatFn: async () => {
      await new Promise((resolve) => setTimeout(resolve, 70));
      return reply({ role: 'assistant', content: 'slow' });
    },
  });
  await promise;
  assert.ok(lines.some((line) => /still waiting for the model/.test(line)));
});

test('a blocked SessionStart exits immediately and fires SessionEnd', async () => {
  const hooks = new Hooks();
  const events = [];
  hooks.on('SessionStart', () => {
    events.push('SessionStart');
    return { block: true, reason: 'no runs today' };
  });
  hooks.on('SessionEnd', () => {
    events.push('SessionEnd');
  });
  const { promise, lines } = run({ hooks });
  const result = await promise;
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'blocked_by_hook');
  assert.deepEqual(events, ['SessionStart', 'SessionEnd']);
  assert.ok(lines.some((line) => /SessionStart blocked/.test(line)));
});

test('PreToolUse can block a tool call', async () => {
  let blockedObservation = null;
  const hooks = new Hooks();
  hooks.on('PreToolUse', ({ name }) => (name === 'read_file' ? { block: true, reason: 'no reads' } : undefined));
  const { promise } = run({
    hooks,
    chatFn: scripted(
      [
        reply(
          {
            role: 'assistant',
            content: null,
            tool_calls: [toolCall('c1', 'read_file', { path: 'a.txt' })],
          },
          'tool_calls',
        ),
        (payload) => {
          const tool = payload.messages.find((m) => m.role === 'tool');
          blockedObservation = tool.content;
          return reply({ role: 'assistant', content: 'ok' });
        },
      ],
    ),
  });
  const result = await promise;
  assert.equal(result.ok, true);
  assert.match(blockedObservation, /^DENIED: a PreToolUse hook blocked/);
});

test('PostToolUse can replace the observation', async () => {
  let replaced = null;
  const hooks = new Hooks();
  hooks.on('PostToolUse', () => ({ replace: 'secret redacted' }));
  const { promise } = run({
    hooks,
    chatFn: scripted([
      reply(
        {
          role: 'assistant',
          content: null,
          tool_calls: [toolCall('c1', 'read_file', { path: 'a.txt' })],
        },
        'tool_calls',
      ),
      (payload) => {
        replaced = payload.messages.find((m) => m.role === 'tool').content;
        return reply({ role: 'assistant', content: 'ok' });
      },
    ]),
  });
  await promise;
  assert.equal(replaced, 'secret redacted');
});

test('StepLimit fires before SessionEnd when the budget runs out', async () => {
  const hooks = new Hooks();
  const events = [];
  for (const name of ['StepLimit', 'SessionEnd']) {
    hooks.on(name, () => {
      events.push(name);
    });
  }
  let i = 0;
  const { promise } = run({
    hooks,
    maxSteps: 1,
    chatFn: async () => {
      i += 1;
      return reply(
        {
          role: 'assistant',
          content: null,
          tool_calls: [toolCall(`c${i}`, 'list_files', { path: '.' })],
        },
        'tool_calls',
      );
    },
  });
  await promise;
  assert.deepEqual(events, ['StepLimit', 'SessionEnd']);
});

test('a follow-up task sees history but a freshly built system prompt', async () => {
  const memory = { label: 'm.md', digest: () => '- [fact] new memory', entries: () => [] };
  let system = null;
  let historySeen = null;
  const { promise } = run({
    memory,
    history: [
      { role: 'system', content: 'stale system prompt' },
      { role: 'user', content: 'earlier question' },
      { role: 'assistant', content: 'earlier answer' },
    ],
    chatFn: async (payload) => {
      system = payload.messages[0];
      historySeen = payload.messages.map((m) => m.content);
      return reply({ role: 'assistant', content: 'done' });
    },
  });
  await promise;
  assert.equal(system.content, buildSystemPrompt({ memory, log: () => {} }));
  assert.ok(system.content.includes('new memory'));
  assert.ok(!system.content.includes('stale system prompt'));
  assert.ok(historySeen.includes('earlier question'));
  assert.ok(historySeen.includes('earlier answer'));
  assert.equal(systemRules(TOOL_NAMES).length > 0, true);
});

test('executing agent.js directly prints a hint instead of running the CLI', () => {
  const out = execFileSync(process.execPath, [AGENT], { encoding: 'utf8' });
  assert.match(out, /agent\.js is the loop, not the program/);
  assert.match(out, /node src\/cli\.js --help/);
});
