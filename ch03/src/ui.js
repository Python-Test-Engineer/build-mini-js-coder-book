/**
 * ui.js - terminal presentation helpers.
 *
 * Every helper RETURNS a styled string; nothing here prints. The rest of the
 * harness decides where that string goes: the terminal, a captured log for a
 * test, or a file. Keeping presentation pure is what makes the CLI testable.
 *
 * The palette is intentionally small: cyan for prompts and thinking, yellow
 * for tools, green for success, red for refusals and failures. Colour is
 * derived from the text (isFailure) rather than reported separately, so a tool
 * cannot accidentally claim success while returning an error line.
 */

import chalk from 'chalk';

// Every helper returns a string. Nothing here prints: the caller decides
// whether the output goes to the terminal, a log function or a test buffer.

const FAILURE_HEAD = /^(ERROR|DENIED|FORBIDDEN)\b/;


/**
 * Classify a tool/command result as a failure by looking only at its first line. ERROR, DENIED, FORBIDDEN and a non-zero exit code are failures; everything else renders in the success colour.
 */
export function isFailure(text) {
  const first = String(text ?? '').split('\n')[0];
  return FAILURE_HEAD.test(first) || /\bexit code (?!0\b)\d+/.test(first);
}


/**
 * Common shell exit codes and their human meanings. 128+N is handled separately in explainExit().
 */
const EXIT_MEANINGS = new Map([
  [0, 'success'],
  [1, 'general failure'],
  [2, 'usage error - no task or bad arguments'],
  [3, 'the step limit was reached'],
  [126, 'command found but not executable'],
  [127, 'command not found'],
  [9009, 'command not found (Windows)'],
]);


/**
 * Translate a shell exit code into a short human meaning. Unknown codes still get a useful fallback, including the 128+N signal convention.
 */
export function explainExit(code) {
  const n = Number(code);
  if (!Number.isFinite(n)) return 'unknown exit code';
  if (EXIT_MEANINGS.has(n)) return EXIT_MEANINGS.get(n);
  if (n >= 128 && n <= 164) return `terminated by signal ${n - 128}`;
  if (n < 0) return 'terminated by a signal';
  return 'non-zero exit';
}

const pad = (text, width) => String(text).padEnd(width);

export const ui = {
  title: (text) => chalk.bold.cyan(text),
  field: (label) => `${chalk.green(label)} ${chalk.white('›')}`,
  kv: (label, value) => `${chalk.blue(pad(label, 10))} ${chalk.white(value)}`,
  step: (step, max, width = 40) =>
    chalk.blue(`── step ${step}/${max} ${'─'.repeat(Math.max(0, width))}`),
  think: (text) => `${chalk.cyan('think:')} ${text}`,
  tool: (name, args) =>
    `${chalk.white('tool →')} ${chalk.yellow(name)} ${chalk.white(args)}`,
  result: (text) => {
    const source = String(text ?? '');
    const [first, ...rest] = source.split('\n');
    const colour = isFailure(source) ? chalk.red : chalk.green;
    const lines = [colour(first)];
    if (rest.length > 0) lines.push(chalk.dim(rest.join('\n')));
    return lines.join('\n');
  },
  forbidden: (action, requested, reason) =>
    chalk.bold.red(`⛔ FORBIDDEN ${String(action).toUpperCase()} ${requested} - ${reason}`),
  pass: (text) => chalk.green(`✓ ${text}`),
  fail: (text) => chalk.red(`✗ ${text}`),
  rule: (label = '', width = 44) => {
    const head = label ? `── ${label} ` : '──';
    const tail = '─'.repeat(Math.max(0, width - head.length));
    return chalk.bold.magenta(`${head}${tail}`);
  },
  hookTitle: (label) => chalk.bold.cyan(`hooks - ${label}`),
  hookLine: (icon, name, colour, when, live) => {
    const paint = chalk[colour] ?? chalk.white;
    return `${icon}  ${paint(name.padEnd(18))} ${chalk.dim(when)}${live ? chalk.green('  live') : ''}`;
  },
  hookField: (label, value, colour = 'white') => {
    const paint = chalk[colour] ?? chalk.white;
    return `   ${chalk.dim(pad(label, 8))} ${paint(value)}`;
  },
  hookLive: () => chalk.green('● live'),
  hookNote: (name, text) => `${chalk.cyan(`[HOOK:${name}]`)} ${chalk.yellow(text)}`,
  hookTrace: (icon, name, colour, explanation, detail = '') => {
    const paint = chalk[colour] ?? chalk.white;
    const tail = detail ? ` ${chalk.dim(detail)}` : '';
    return `  ${icon}  ${chalk.dim(`[HOOK:${name}]`)} ${paint(explanation)}${tail}`;
  },
  hookFlow: (steps) => chalk.magenta(steps.join(chalk.dim(' → '))),
  memory: (text) => chalk.magenta(`memory: ${text}`),
  exitNote: (code, meaning) =>
    code === 0 ? chalk.dim(`exit ${code} - ${meaning}`) : chalk.yellow(`exit ${code} - ${meaning}`),
  answerRule: () => chalk.bold.green('── final answer ────'),
  answer: (text) => chalk.white(text),
  warn: (text) => chalk.yellow(`warning: ${text}`),
  waiting: (text) => chalk.dim(text),
  error: (text) => chalk.red(`error: ${text}`),
  note: (text) => chalk.dim(text),
  prompt: (label) => `${chalk.green(label)} ${chalk.white('›')} `,
  dim: (text) => chalk.dim(text),
};

export default ui;
