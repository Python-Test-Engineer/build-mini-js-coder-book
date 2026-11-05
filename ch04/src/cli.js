/**
 * cli.js - the command-line front end.
 *
 * It parses flags, loads configuration, builds the workspace/sandbox/memory/
 * hook context, prints the banner, and chooses between help, hook catalogue,
 * memory inspection, the offline demo, a one-shot task and an interactive
 * session. Flags handled here: --help, --model, --max-steps.
 *
 * The bottom entry guard means importing this module in a test does not start
 * the program.
 */

import { pathToFileURL } from 'node:url';
import readline from 'node:readline/promises';
import { loadConfig } from './config.js';
import { chat } from './llm.js';
import { ui } from './ui.js';

export const SYSTEM_PROMPT = 'You are a helpful assistant.';


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
 * Append the user turn, call the model with the full history, append the assistant reply and print the answer. This is the smallest possible chat turn.
 */
async function send(config, messages, task) {
  messages.push({ role: 'user', content: task });
  const reply = await chat({
    apiKey: config.apiKey,
    model: config.model,
    timeoutMs: config.requestTimeoutMs,
    messages,
  });
  const answer = reply.choices?.[0]?.message?.content ?? '';
  messages.push({ role: 'assistant', content: answer });
  console.log(ui.answerRule());
  console.log(ui.answer(answer));
  return answer;
}


/**
 * Interactive loop: read a task, run it, keep the history for the next turn, and handle /new, /quit and /exit.
 */
async function runSession(config) {
  // The system prompt is freshly built, prior history is resumed without its old system message, and the new task is appended last.
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
  let turns = 0;

  console.log(ui.note('interactive session - type a task below (/quit exits)'));

  for (;;) {
    const line = await askTask();
    if (line === null || line === '/quit' || line === '/exit') break;
    if (line === '/new') {
      messages.length = 0;
      messages.push({ role: 'system', content: SYSTEM_PROMPT });
      console.log(ui.note('new conversation'));
      continue;
    }

    try {
      await send(config, messages, line);
      turns += 1;
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
async function runOneShot(config, task) {
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
  try {
    await send(config, messages, task);
    return 0;
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

  const config = loadConfig({ model: opts.model, maxSteps: opts.maxSteps });

  if (task) return runOneShot(config, task);

  // Non-interactive stdin without a task is a usage error, not an empty session. Exit code 2 is part of the CLI contract.
  if (!process.stdin.isTTY) {
    console.error(ui.error('no task given - pass a task or run in a terminal'));
    console.error(ui.note('try: node src/cli.js "Say hello"'));
    return 2;
  }
  return runSession(config);
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
