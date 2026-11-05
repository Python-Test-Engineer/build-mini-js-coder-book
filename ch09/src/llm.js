/**
 * llm.js - the only place the harness talks to a model provider.
 *
 * One POST to OpenRouter, one timeout, one error vocabulary. Everything above
 * this file sees either a normal response body or a thrown Error; it never sees
 * fetch, HTTP status codes or provider JSON quirks. Keeping the network in one
 * small module is what lets the rest of the tests run completely offline.
 */

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';


/**
 * Make one OpenRouter chat-completions POST. The caller supplies the API key, model, messages, optional tools and an abort signal. Network, timeout, HTTP and provider errors are all converted into plain Error messages with actionable hints.
 */
export async function chat({
  apiKey,
  model,
  messages,
  tools,
  signal,
  timeoutMs = 90_000,
}) {
  if (!apiKey) {
    throw new Error(
      'OPENROUTER_API_KEY is not set - add it to the project-root .env, or use --demo.',
    );
  }

  // Two cancellations can stop the request: the caller's signal and an absolute timeout. AbortSignal.any combines them.
  const timeout = AbortSignal.timeout(timeoutMs);
  const abort = signal ? AbortSignal.any([signal, timeout]) : timeout;

  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      signal: abort,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'min-coding-js',
      },
      body: JSON.stringify({
        model,
        messages,
        ...(tools ? { tools } : {}),
        max_tokens: 2048,
      }),
    });
  } catch (err) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      throw new Error(`request timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw new Error(`request failed: ${err?.message ?? err}`);
  }

  // Read the body once as text so both success and error paths can include provider detail.
  const text = await res.text();

  // Turn HTTP errors into one actionable message. 401 and 402 get specific hints because they are the common setup failures.
  if (!res.ok) {
    const hint =
      res.status === 401
        ? ' (bad or revoked key)'
        : res.status === 402
          ? ' (out of credits)'
          : '';
    throw new Error(`OpenRouter ${res.status}${hint}: ${text.slice(0, 400)}`);
  }

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`OpenRouter returned non-JSON: ${text.slice(0, 400)}`);
  }

  if (body?.error) {
    const message = body.error.message ?? JSON.stringify(body.error);
    throw new Error(`OpenRouter error: ${String(message).slice(0, 400)}`);
  }

  return body;
}


/**
 * Keep only the parts of an assistant reply that belong in conversation history: content and any tool_calls. Provider scratchpad fields are deliberately dropped so they are not echoed back to the model later.
 */
export function sanitizeAssistant(message = {}) {
  const out = { role: 'assistant', content: message.content ?? '' };
  if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
    out.tool_calls = message.tool_calls;
    if (message.content == null) delete out.content;
  }
  return out;
}

export default chat;
