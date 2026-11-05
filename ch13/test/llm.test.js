/**
 * llm.test.js - offline tests for the model client's request body, error mapping and reply sanitising, with fetch stubbed.
 *
 * These tests use node:test and node:assert. They never call the network and
 * never need an OpenRouter key: the model, filesystem roots and environment are
 * injected or stubbed. A failing test here means the chapter's contract has
 * drifted, not that the reader's setup is wrong.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { chat, sanitizeAssistant } from '../src/llm.js';

function mockFetch(handler) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  return () => {
    globalThis.fetch = original;
  };
}

test('chat posts to OpenRouter and returns the parsed body', async () => {
  let seen;
  const restore = mockFetch(async (url, init) => {
    seen = { url, init };
    return new Response(
      JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'hi' } }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  });
  try {
    const reply = await chat({
      apiKey: 'test',
      model: 'deepseek/deepseek-v4.1-flash-1017',
      messages: [{ role: 'user', content: 'hello' }],
      tools: [{ type: 'function', function: { name: 'x' } }],
    });
    assert.equal(reply.choices[0].message.content, 'hi');
    assert.equal(seen.url, 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(seen.init.headers.Authorization, 'Bearer test');
    assert.equal(seen.init.headers['X-Title'], 'min-coding-js');
    const body = JSON.parse(seen.init.body);
    assert.equal(body.model, 'deepseek/deepseek-v4.1-flash-1017');
    assert.equal(body.max_tokens, 2048);
    assert.equal(body.tools.length, 1);
  } finally {
    restore();
  }
});

test('a missing key throws a helpful error', async () => {
  await assert.rejects(
    () => chat({ apiKey: '', model: 'x/y', messages: [] }),
    /OPENROUTER_API_KEY is not set/,
  );
});

test('401 and 402 produce hints', async () => {
  let restore = mockFetch(async () => new Response('nope', { status: 401 }));
  try {
    await assert.rejects(
      () => chat({ apiKey: 'k', model: 'x/y', messages: [] }),
      /401.*bad or revoked key/,
    );
  } finally {
    restore();
  }

  restore = mockFetch(async () => new Response('broke', { status: 402 }));
  try {
    await assert.rejects(
      () => chat({ apiKey: 'k', model: 'x/y', messages: [] }),
      /402.*out of credits/,
    );
  } finally {
    restore();
  }
});

test('non-JSON and .error bodies are reported', async () => {
  let restore = mockFetch(async () => new Response('<html>oops</html>', { status: 200 }));
  try {
    await assert.rejects(
      () => chat({ apiKey: 'k', model: 'x/y', messages: [] }),
      /non-JSON/,
    );
  } finally {
    restore();
  }

  restore = mockFetch(
    async () =>
      new Response(JSON.stringify({ error: { message: 'quota' } }), { status: 200 }),
  );
  try {
    await assert.rejects(
      () => chat({ apiKey: 'k', model: 'x/y', messages: [] }),
      /OpenRouter error: quota/,
    );
  } finally {
    restore();
  }
});

test('a timeout surfaces as a plain-English error', async () => {
  const restore = mockFetch(async () => {
    const err = new Error('timed out');
    err.name = 'TimeoutError';
    throw err;
  });
  try {
    await assert.rejects(
      () => chat({ apiKey: 'k', model: 'x/y', messages: [], timeoutMs: 5000 }),
      /request timed out after 5s/,
    );
  } finally {
    restore();
  }
});

test('sanitizeAssistant drops reasoning and keeps only three fields', () => {
  const clean = sanitizeAssistant({
    role: 'assistant',
    content: null,
    reasoning: 'secret thoughts',
    reasoning_content: 'more thoughts',
    tool_calls: [{ id: '1', type: 'function', function: { name: 'x', arguments: '{}' } }],
  });
  assert.deepEqual(Object.keys(clean).sort(), ['role', 'tool_calls']);
  assert.equal(clean.reasoning, undefined);

  const plain = sanitizeAssistant({ role: 'assistant', content: 'hi', extra: 1 });
  assert.deepEqual(plain, { role: 'assistant', content: 'hi' });
});
