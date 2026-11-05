/**
 * agent.js - the ReAct loop as a reusable library.
 *
 * This is the heart of the agent: build messages, call the model, show text,
 * run any requested tools, append observations, repeat until an answer or the
 * step limit. It deliberately knows nothing about flags, colours, .env or
 * process.exit; the CLI injects the model client, logger, policy, hooks and
 * memory. That dependency injection is what makes the loop offline-testable.
 */

import { pathToFileURL } from 'node:url';
import { sanitizeAssistant } from './llm.js';
import { buildSystemPrompt } from './prompt.js';
import { runTool, TOOL_SCHEMAS } from './tools.js';
import { Hooks } from './hooks.js';
import { heartbeat } from './heartbeat.js';
import { ui } from './ui.js';


/**
 * Print hook notes with their source event name.
 */
function showNotes(log, result) {
  for (const note of result.notes) log(ui.hookNote(result.event, note));
}

/**
 * The ReAct loop as a library. It knows nothing about flags, colours, .env or
 * process.exit: the caller injects the model, the logger and the policy.
 */
export async function runTask({
  task,
  workspace,
  sandbox = null,
  commandPolicy = 'ask',
  maxSteps = 12,
  chatFn,
  confirm,
  hooks = null,
  memory = null,
  history = [],
  log = console.log,
  heartbeatMs = 5000,
}) {
  const hook = hooks ?? new Hooks({ log });
  const doConfirm = confirm ?? (async () => 'deny');
  const startedAt = Date.now();

  // The system prompt is freshly built, prior history is resumed without its old system message, and the new task is appended last.
  const messages = [
    { role: 'system', content: buildSystemPrompt({ memory, log }) },
    ...(history ?? []).filter((message) => message.role !== 'system'),
    { role: 'user', content: task },
  ];
  const taskIndex = messages.length - 1;

  // Tools receive this context: the path policy, the sandbox, the command policy, memory and the confirmation callback.
  const ctx = {
    workspace,
    sandbox,
    commandPolicy,
    memory,
    confirm: doConfirm,
  };

  // Every return path goes through finish(), so SessionEnd fires exactly once whether the run succeeded, failed or was blocked.
  const finish = async (result) => {
    const ended = await hook.run('SessionEnd', {
      ok: result.ok === true,
      reason: result.reason ?? null,
      messages,
      durationMs: Date.now() - startedAt,
    });
    showNotes(log, ended);
    return result;
  };

  // SessionStart is the cheapest place to refuse: it runs before any tokens are spent.
  const started = await hook.run('SessionStart', { task, messages });
  showNotes(log, started);
  if (started.blocked) {
    log(ui.error(`SessionStart blocked the run: ${started.reason}`));
    return finish({ ok: false, reason: 'blocked_by_hook', messages });
  }

  // UserPromptSubmit may rewrite the task or block the run entirely.
  const submitted = await hook.run('UserPromptSubmit', { task, messages });
  showNotes(log, submitted);
  if (submitted.blocked) {
    log(ui.error(`UserPromptSubmit blocked the task: ${submitted.reason}`));
    return finish({ ok: false, reason: 'blocked_by_hook', messages });
  }
  if (submitted.task !== null) {
    messages[taskIndex].content = submitted.task;
    log(ui.dim(`task rewritten by a hook: ${submitted.task}`));
  }

  for (let step = 1; step <= maxSteps; step += 1) {
    log('');
    log(ui.step(step, maxSteps));

    // PreModel observes exactly what the model is about to see.
    const pre = await hook.run('PreModel', {
      step,
      maxSteps,
      messages,
      tools: TOOL_SCHEMAS,
    });
    showNotes(log, pre);

    let reply;
    // Start the waiting indicator immediately before the network call and always stop it afterwards.
    const beat = heartbeat(log, heartbeatMs);
    try {
      reply = await chatFn({ messages, tools: TOOL_SCHEMAS });
    } catch (err) {
      beat.stop();
      log(ui.error(err?.message ?? String(err)));
      return finish({ ok: false, reason: 'request_failed', messages });
    }
    beat.stop();

    // Providers occasionally return an empty body; defaulting to an empty choice keeps the loop deterministic.
    const choice = reply?.choices?.[0] ?? {};
    const message = choice.message ?? {};

    const postModel = await hook.run('PostModel', {
      step,
      message,
      finishReason: choice.finish_reason,
    });
    showNotes(log, postModel);

    // No tool calls means the model has produced its final answer.
    const calls = message.tool_calls ?? [];

    // A length-truncated reply is not an answer. Ask for a smaller continuation instead of returning half a sentence.
    if (choice.finish_reason === 'length' && calls.length === 0) {
      // Store only the fields that belong in history; provider scratchpad content is dropped.
      messages.push(sanitizeAssistant(message));
      messages.push({
        role: 'user',
        content: 'You were cut off by the length limit. Continue with smaller tool calls.',
      });
      log(ui.warn('reply was cut off by the length limit - asking for a smaller continuation'));
      continue;
    }

    messages.push(sanitizeAssistant(message));
    if (message.content) log(ui.think(message.content));

    if (calls.length === 0) {
      const answer = message.content ?? '';
      log(ui.answerRule());
      log(ui.answer(answer));
      const stopped = await hook.run('Stop', { answer, messages, steps: step });
      showNotes(log, stopped);
      return finish({ ok: true, answer, messages, steps: step });
    }

    // One assistant message may request several tools. Each observation is appended with the matching tool_call_id.
    for (const call of calls) {
      const name = call.function?.name ?? '(unnamed)';
      const rawArgs = call.function?.arguments ?? '{}';
      log(ui.tool(name, rawArgs));

      // PreToolUse is the permission layer: it can block a call before the handler runs.
      const preTool = await hook.run('PreToolUse', { name, args: rawArgs, step });
      showNotes(log, preTool);

      let result;
      if (preTool.blocked) {
        result = `DENIED: a PreToolUse hook blocked this call (${preTool.reason}). Try another approach.`;
      } else {
        result = await runTool(name, rawArgs, ctx);
      }
      log(ui.result(result));

      // PostToolUse can replace the observation, which makes redaction a twelve-line hook.
      const postTool = await hook.run('PostToolUse', {
        name,
        result,
        step,
        ok: !/^(ERROR|DENIED)\b/.test(result),
      });
      showNotes(log, postTool);

      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: String(postTool.replace ?? result),
      });
    }
  }

  // The step limit is a budget, not a crash. Emit a clear reason so the CLI can map it to exit code 3.
  log(ui.error(`stopped: hit the ${maxSteps}-step limit`));
  const limited = await hook.run('StepLimit', { maxSteps, messages });
  showNotes(log, limited);
  return finish({ ok: false, reason: 'max_steps', messages });
}


/**
 * Explain that agent.js is a library, not the program, and point the reader at the CLI entry point.
 */
export function agentHint() {
  return 'agent.js is the loop, not the program.\nRun the CLI instead:  node src/cli.js --help';
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(agentHint());
}

export default runTask;
