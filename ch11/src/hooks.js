/**
 * hooks.js - the lifecycle event bus.
 *
 * Nine named moments wrap a run: SessionStart, UserPromptSubmit, PreModel,
 * PostModel, PreToolUse, PostToolUse, Stop, StepLimit and SessionEnd. Four are
 * DECIDING: they may block, rewrite the task or replace an observation. The
 * other five observe. A hook that throws is reported and ignored so a broken
 * extension cannot take down the agent.
 *
 * HOOK_META is also the documentation: it says when each hook runs, what it
 * receives and why it exists.
 */

import { ui } from './ui.js';


/**
 * The nine lifecycle moments, in the order a successful run usually meets them.
 */
export const HOOK_NAMES = [
  'SessionStart',
  'UserPromptSubmit',
  'PreModel',
  'PostModel',
  'PreToolUse',
  'PostToolUse',
  'Stop',
  'StepLimit',
  'SessionEnd',
];


/**
 * Documentation for every hook: icon, colour, when it runs, what it receives, what it may do and why it exists.
 */
export const HOOK_META = {
  SessionStart: {
    icon: '🚀',
    colour: 'cyan',
    when: 'once, before the first model call',
    gets: 'task, messages',
    may: 'refuse, note',
    why: 'refuse a run before any tokens are spent',
  },
  UserPromptSubmit: {
    icon: '✍️',
    colour: 'blue',
    when: 'once, as the task enters the loop',
    gets: 'task, messages',
    may: 'rewrite task, block',
    why: 'policy can rewrite or reject a prompt',
  },
  PreModel: {
    icon: '🧠',
    colour: 'magenta',
    when: 'before every model call',
    gets: 'step, maxSteps, messages, tools',
    may: 'observe',
    why: 'trace what the model is about to see',
  },
  PostModel: {
    icon: '💬',
    colour: 'cyan',
    when: 'after every reply',
    gets: 'step, message, finishReason',
    may: 'observe',
    why: 'trace what the model returned',
  },
  PreToolUse: {
    icon: '🛠️',
    colour: 'yellowBright',
    when: 'before every tool call',
    gets: 'name, args, step',
    may: 'block',
    why: 'a permission layer that can stop a tool call',
  },
  PostToolUse: {
    icon: '📦',
    colour: 'green',
    when: 'after every tool call',
    gets: 'name, result, step, ok',
    may: 'replace observation',
    why: 'redact or reshape what the model reads',
  },
  Stop: {
    icon: '🏁',
    colour: 'greenBright',
    when: 'the model answered and the loop ends',
    gets: 'answer, messages, steps',
    may: 'observe',
    why: 'measure the successful end of a run',
  },
  StepLimit: {
    icon: '⏳',
    colour: 'yellow',
    when: 'maxSteps is reached',
    gets: 'maxSteps, messages',
    may: 'observe',
    why: 'notice runs that ran out of budget',
  },
  SessionEnd: {
    icon: '🔒',
    colour: 'red',
    when: 'always, finished or not',
    gets: 'ok, reason, messages, durationMs',
    may: 'observe',
    why: 'clean up and record the outcome',
  },
};


/**
 * Counts and names used by --hooks and the banner.
 */
export const HOOK_SUMMARY = {
  total: HOOK_NAMES.length,
  deciding: 4,
  names: HOOK_NAMES,
  decidingNames: ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse'],
};


/**
 * The four hooks whose return value can change the run rather than merely observe it.
 */
const DECIDING = new Set(HOOK_SUMMARY.decidingNames);

/**
 * Registry of handlers for the nine lifecycle events. run() collects decisions from handlers and isolates any handler that throws.
 */
export class Hooks {
  constructor({ log = () => {} } = {}) {
    this.log = log;
    this.handlers = new Map(HOOK_NAMES.map((name) => [name, []]));
    this.counter = 0;
  }


  /**
   * Register a handler for a named hook. Returns the handler id, which can be used with off(). The once option removes the handler after its first run.
   */
  on(name, fn, { id, once = false } = {}) {
    if (!this.handlers.has(name)) throw new Error(`unknown hook: ${name}`);
    if (typeof fn !== 'function') throw new TypeError(`hook ${name} needs a function`);
    const handlerId = id ?? `${name}:${(this.counter += 1)}`;
    this.handlers.get(name).push({ id: handlerId, fn, once: Boolean(once) });
    return handlerId;
  }


  /**
   * Remove a previously registered hook handler by id.
   */
  off(name, id) {
    if (!this.handlers.has(name)) throw new Error(`unknown hook: ${name}`);
    this.handlers.set(name, this.handlers.get(name).filter((h) => h.id !== id));
  }


  /**
   * Number of handlers currently attached to a hook.
   */
  count(name) {
    if (!this.handlers.has(name)) throw new Error(`unknown hook: ${name}`);
    return this.handlers.get(name).length;
  }


  /**
   * True when at least one handler is attached to the hook.
   */
  has(name) {
    return this.count(name) > 0;
  }


  /**
   * List the hook names that currently have handlers.
   */
  attached() {
    return HOOK_NAMES.filter((name) => this.count(name) > 0);
  }


  /**
   * Run every handler for one hook in registration order. Collects notes, task rewrites, observation replacements and errors; the first blocking decision wins and stops later handlers.
   */
  async run(name, payload = {}) {
    if (!this.handlers.has(name)) throw new Error(`unknown hook: ${name}`);
    const out = {
      event: name,
      ran: 0,
      blocked: false,
      reason: null,
      task: null,
      replace: null,
      notes: [],
      errors: [],
    };

    const handlers = [...this.handlers.get(name)];
    for (const handler of handlers) {
      out.ran += 1;
      try {
        const decision = await handler.fn(payload);
        if (decision && typeof decision === 'object') {
          if (decision.note !== undefined) out.notes.push(String(decision.note));
          if (decision.task !== undefined && decision.task !== null) {
            out.task = String(decision.task);
          }
          if (decision.replace !== undefined && decision.replace !== null) {
            out.replace = String(decision.replace);
          }
          if (decision.block) {
            out.blocked = true;
            out.reason = decision.reason ? String(decision.reason) : `${name} blocked this step`;
            break;
          }
        }
      } catch (err) {
        out.errors.push({ id: handler.id, error: err });
        this.log(ui.warn(`hook ${name} threw: ${err?.message ?? err}`));
      } finally {
        if (handler.once) {
          this.handlers.set(
            name,
            this.handlers.get(name).filter((h) => h.id !== handler.id),
          );
        }
      }
    }

    return out;
  }
}


/**
 * Return the short "why" explanation for a hook, used by the trace output.
 */
export function hookDetail(name) {
  return HOOK_META[name]?.why ?? 'observe';
}


/**
 * Attach a tracing handler to all nine hooks. The default CLI uses this so every lifecycle moment prints a visible [HOOK:Name] line.
 */
export function traceHooks({ log = console.log, detail = hookDetail } = {}) {
  const hooks = new Hooks({ log });
  for (const name of HOOK_NAMES) {
    const meta = HOOK_META[name];
    hooks.on(name, () => {
      log(ui.hookTrace(meta.icon, name, meta.colour, meta.when, detail(name)));
      return undefined;
    });
  }
  return hooks;
}


/**
 * Print the full hook catalogue: when each runs, what it receives, what it may do and why it exists. Used by --hooks.
 */
export function printHookCatalogue({ log = console.log, hooks = null } = {}) {
  log(ui.hookTitle('catalogue'));
  log(ui.hookField('Total', String(HOOK_SUMMARY.total)));
  log(ui.hookField('Deciding', String(HOOK_SUMMARY.deciding)));
  log('');
  for (const name of HOOK_NAMES) {
    const meta = HOOK_META[name];
    const attached = hooks?.has(name) ?? false;
    log(ui.hookLine(meta.icon, name, meta.colour, meta.when, attached));
    log(ui.hookField('Gets', meta.gets, meta.colour));
    log(ui.hookField('May', meta.may, meta.colour));
    log(ui.hookField('Why', meta.why, meta.colour));
    if (DECIDING.has(name)) log(ui.hookField('Kind', 'deciding', meta.colour));
    log('');
  }
}

export default Hooks;
