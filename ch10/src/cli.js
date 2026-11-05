/**
 * cli.js - the command-line front end.
 *
 * It parses flags, loads configuration, builds the workspace/sandbox/memory/
 * hook context, prints the banner, and chooses between help, hook catalogue,
 * memory inspection, the offline demo, a one-shot task and an interactive
 * session. Flags handled here: --help, --model, --max-steps, --yes, --memory, --no-memory. The manual ReAct loop lives here until Stage 12 extracts it into agent.js.
 *
 * The bottom entry guard means importing this module in a test does not start
 * the program.
 */

import { pathToFileURL } from 'node:url';
import readline from 'node:readline/promises';
import { loadConfig } from './config.js';
import { chat, sanitizeAssistant } from './llm.js';
import { ui } from './ui.js';
import { buildSystemPrompt } from './prompt.js';
import { Workspace } from './workspace.js';
import { Sandbox } from './sandbox.js';
import { runTool, TOOL_SCHEMAS, TOOL_NAMES } from './tools.js';
import { Memory } from './memory.js';


/**
 * Return the --help text as a pure string. Tests can assert flags without spawning a process.
 */
export function usage() {
  return [
    'min-coding-js - a tiny coding-agent harness',
    '',
    'Usage:',
    '  node src/cli.js [options] [task]',
    '',
    'Options:',
    '  --help, -h        print this help and exit',
    '  --model <name>    override the model from .env',
    '  --max-steps <n>   maximum steps for a task',
    '  --yes, --allow-commands  run shell commands without asking',
    '  --memory          print the memory store and digest, then exit',
    '  --no-memory       disable the memory store for this run',
    '',
    'With no task and a terminal, the CLI starts an interactive session.',
    'Session commands: /new, /quit, /exit',
  ].join('\n');
}


/**
 * Parse argv into { opts, task } without a flag library. Unknown --flags are ignored so --help keeps working as the CLI grows.
 */
export function parseArgs(argv = []) {
  const opts = {};
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--model') {
      i += 1;
      opts.model = argv[i] ?? '';
    } else if (arg === '--max-steps') {
      i += 1;
      opts.maxSteps = Number(argv[i]);
    } else if (arg === '--yes' || arg === '--allow-commands') {
      opts.yes = true;
    } else if (arg === '--memory') {
      opts.memory = true;
    } else if (arg === '--no-memory') {
      opts.noMemory = true;
    } else if (arg.startsWith('--')) {
      continue;
    } else {
      rest.push(arg);
    }
  }
  return { opts, task: rest.join(' ').trim() || undefined };
}


/**
 * Read one non-empty task line from stdin. Returns null on Ctrl-C or EOF, which callers treat as "quit".
 */
export async function askTask({ input = process.stdin, output = process.stdout } = {}) {
  // readline gives us an async iterator over lines without a dependency. Terminal mode controls echo and prompts.
  const rl = readline.createInterface({
    input,
    output,
    terminal: Boolean(output.isTTY),
  });
  let interrupted = false;
  rl.on('SIGINT', () => {
    interrupted = true;
    rl.close();
  });

  try {
    // Prompt only on a real terminal; piped input should stay clean for scripts and tests.
    if (output.isTTY) output.write(ui.prompt('  task'));
    for await (const raw of rl) {
      const line = String(raw).trim();
      if (!line) {
        if (output.isTTY) output.write(ui.prompt('  task'));
        continue;
      }
      return line;
    }
  } finally {
    rl.close();
  }
  return interrupted ? null : null;
}


/**
 * Turn CMD_POLICY into a confirmation callback. allow answers yes, deny answers no, ask prompts only in a real terminal and refuses otherwise.
 */
function makeConfirm(policy) {
  return async (command) => {
    if (policy === 'allow') return 'yes';
    if (policy === 'deny') return 'no';
    if (!process.stdin.isTTY) return 'no';
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      const answer = await rl.question(`run command? ${command} [y/N] `);
      return answer;
    } finally {
      rl.close();
    }
  };
}


/**
 * Construct the file-backed memory store using the bounds from configuration.
 */
function makeMemory(config) {
  return new Memory({
    root: config.projectRoot,
    file: config.memoryFile,
    maxEntries: config.memoryMaxEntries,
    promptChars: config.memoryPromptChars,
  });
}


/**
 * Build the per-run context passed to tools: workspace, sandbox, command policy, confirmation callback, memory and hooks.
 */
function makeContext(config, memory) {
  const workspace = new Workspace(config.workspaceRoot);
  const sandbox = new Sandbox({ workspace, root: workspace.root, log: console.log });
  return {
    workspace,
    sandbox,
    commandPolicy: config.commandPolicy,
    confirm: makeConfirm(config.commandPolicy),
    memory,
  };
}

const makePrompt = (memory = null, log = console.log) =>
  buildSystemPrompt({ tools: TOOL_NAMES, memory, log });


/**
 * Print the memory file, its summary and the exact digest that would be injected into the prompt. Used by --memory.
 */
function printMemory(memory) {
  console.log(ui.rule('memory'));
  console.log(ui.kv('file', memory.label));
  console.log(ui.kv('summary', memory.summary()));
  console.log(ui.memory(memory.digest() || '(empty)'));
  console.log(ui.rule('raw file'));
  console.log(memory.readRaw().trimEnd() || ui.note('(missing)'));
  return 0;
}


/**
 * The manual ReAct loop used before Stage 12: call the model, run tools, append observations, stop on an answer or the step limit.
 */
async function complete(config, ctx, messages) {
  for (let step = 1; step <= config.maxSteps; step += 1) {
    console.log('');
    console.log(ui.step(step, config.maxSteps));

    const reply = await chat({
      apiKey: config.apiKey,
      model: config.model,
      timeoutMs: config.requestTimeoutMs,
      messages,
      tools: TOOL_SCHEMAS,
    });

    const message = reply.choices?.[0]?.message ?? {};
    // Store only the fields that belong in history; provider scratchpad content is dropped.
    messages.push(sanitizeAssistant(message));

    if (message.content) console.log(ui.think(message.content));

    // No tool calls means the model has produced its final answer.
    const calls = message.tool_calls ?? [];
    if (calls.length === 0) {
      const answer = message.content ?? '';
      console.log(ui.answerRule());
      console.log(ui.answer(answer));
      return { ok: true, answer, messages, steps: step };
    }

    // One assistant message may request several tools. Each observation is appended with the matching tool_call_id.
    for (const call of calls) {
      const name = call.function?.name ?? '(unnamed)';
      const rawArgs = call.function?.arguments ?? '{}';
      console.log(ui.tool(name, rawArgs));
      const result = await runTool(name, rawArgs, ctx);
      console.log(ui.result(result));
      messages.push({ role: 'tool', tool_call_id: call.id, content: String(result) });
    }
  }

  console.log(ui.error(`stopped: hit the ${config.maxSteps}-step limit`));
  return { ok: false, reason: 'max_steps', messages };
}


/**
 * Interactive loop: read a task, run it, keep the history for the next turn, and handle /new, /quit and /exit.
 */
async function runSession(config, ctx) {
  // The system prompt is freshly built, prior history is resumed without its old system message, and the new task is appended last.
  const messages = [{ role: 'system', content: makePrompt(ctx.memory) }];
  let turns = 0;

  console.log(ui.note('interactive session - type a task below (/quit exits)'));

  for (;;) {
    const line = await askTask();
    if (line === null || line === '/quit' || line === '/exit') break;
    if (line === '/new') {
      messages.length = 0;
      messages.push({ role: 'system', content: makePrompt(ctx.memory) });
      console.log(ui.note('new conversation'));
      continue;
    }

    messages[0] = { role: 'system', content: makePrompt(ctx.memory) };
    messages.push({ role: 'user', content: line });
    try {
      const result = await complete(config, ctx, messages);
      turns += 1;
      if (!result.ok) break;
    } catch (err) {
      console.error(ui.error(err?.message ?? String(err)));
    }
  }

  console.log(ui.rule('session over'));
  console.log(ui.note(`session over - ${turns} turn(s)`));
  return 0;
}


/**
 * Run a single task and return a process exit code: 0 success, 1 request failure, 3 step limit when the stage distinguishes them.
 */
async function runOneShot(config, ctx, task) {
  const messages = [
    { role: 'system', content: makePrompt(ctx.memory) },
    { role: 'user', content: task },
  ];
  try {
    const result = await complete(config, ctx, messages);
    return result.ok ? 0 : 3;
  } catch (err) {
    console.error(ui.error(err?.message ?? String(err)));
    return 1;
  }
}


/**
 * Entry point. Parse flags, build shared context, then dispatch to help, catalogue, memory, demo, one-shot or interactive mode.
 */
export async function main(argv = process.argv.slice(2)) {
  const { opts, task } = parseArgs(argv);
  if (opts.help) {
    console.log(usage());
    return 0;
  }

  const config = loadConfig({
    model: opts.model,
    maxSteps: opts.maxSteps,
    commandPolicy: opts.yes ? 'allow' : undefined,
  });
  // --no-memory passes null so tools return a clear "no memory store" error instead of silently writing.
  const memory = opts.noMemory ? null : makeMemory(config);
  if (opts.memory) return printMemory(memory ?? makeMemory(config));
  const ctx = makeContext(config, memory);

  if (task) return runOneShot(config, ctx, task);

  // Non-interactive stdin without a task is a usage error, not an empty session. Exit code 2 is part of the CLI contract.
  if (!process.stdin.isTTY) {
    console.error(ui.error('no task given - pass a task or run in a terminal'));
    console.error(ui.note('try: node src/cli.js "Say hello"'));
    return 2;
  }
  return runSession(config, ctx);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err) => {
      console.error(`fatal: ${err?.stack ?? err}`);
      process.exitCode = 1;
    });
}
