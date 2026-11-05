/**
 * prompt.js - build the behavioural contract sent as the system message.
 *
 * The rules are rebuilt for each run (and each session turn) so they can
 * mention only the tools that actually exist at that stage. Later chapters add
 * tool-specific advice; earlier chapters must not advertise powers they do not
 * have. The optional memory digest is appended as extra context, never baked
 * into the rules themselves.
 */

import { ui } from './ui.js';

// The behavioural contract. Tool-specific rules are only added once the
// matching tools exist, so an early chapter does not advertise future powers.
export function systemRules(tools = []) {
  const names = Array.isArray(tools) ? tools : [];
  const lines = [
    'You are a careful coding agent working in a small sandboxed workspace.',
    '',
    'Rules:',
    '- Look before you write: read a file before editing it.',
    '- Prefer the smallest change that solves the task.',
    '- Do not invent tool results. Wait for the observation.',
    '- Make one tool call per step unless the task clearly needs more.',
    '- Be concise in your final answer.',
    '- Remember useful facts when the task reveals a durable preference or fix.',
  ];

  if (names.length > 0) {
    lines.push('', `Tools available: ${names.join(', ')}.`);
    if (names.includes('create_file')) {
      lines.push(
        '- Use create_file for a new file, edit_file for a small change, and write_file for a whole-file replacement.',
        '- When editing, copy old_string exactly, including whitespace.',
      );
    }
    if (names.includes('run_command')) {
      lines.push('- Run what you wrote to check it actually works.');
    }
  }

  return lines.join('\n');
}


/**
 * Return the full system message: rules plus, when a memory store is available, its newest-first digest. The prompt is rebuilt rather than carried so memory and tool changes show up immediately.
 */
export function buildSystemPrompt({ memory = null, log = () => {}, tools = [] } = {}) {
  const rules = systemRules(tools);
  const digest = memory?.digest?.() ?? '';
  if (!digest) return rules;
  log(ui.dim(`memory ← ${memory.label} - ${memory.entries().length} entries`));
  return `${rules}\n\n${digest}`;
}

export default buildSystemPrompt;
