/**
 * demo.js - a scripted, offline proof of the safety guards.
 *
 * demoChat() is a fake model that returns a fixed sequence of tool calls, so
 * the real loop, the real tools and the real sandbox run without a network or
 * an API key. sandboxScorecard() then reads the resulting tool messages and
 * checks that each expected refusal or safe result actually happened.
 *
 * The demo is both a teaching device and a regression test: if a guard breaks,
 * the scorecard stops showing 7/7.
 */

const call = (id, name, args) => ({
  id,
  type: 'function',
  function: { name, arguments: JSON.stringify(args) },
});

const step = (id, content, name, args) => ({
  role: 'assistant',
  content,
  tool_calls: [call(id, name, args)],
});


/**
 * The fixed script: seven successful actions and five deliberately refused escapes/attacks. The scorecard checks the latter.
 */
export const DEMO_SCRIPT = [
  step('s1', 'First, let me see what is in the workspace.', 'list_files', { path: '.' }),
  step('s2', 'Now I will create a tiny script.', 'create_file', {
    path: 'demo/hello.js',
    content: "const agent = 'tiny agent';\nconsole.log(`Hello from a ${agent}`);\n",
  }),
  step('s3', 'Let me run it to check it works.', 'run_command', {
    command: 'node demo/hello.js',
  }),
  step('s4', 'Now I will edit the greeting.', 'edit_file', {
    path: 'demo/hello.js',
    old_string: 'Hello from a ${agent}',
    new_string: 'Hello from a ${agent}, edited by a tool call',
  }),
  step('s5', 'Run it again.', 'run_command', { command: 'node demo/hello.js' }),
  step('s6', 'Now I will try to write outside the workspace.', 'write_file', {
    path: '../escape.txt',
    content: 'must never be written',
  }),
  step('s7', 'Reads are allowed outside, so let me read a file one folder up.', 'read_file', {
    path: '../package.json',
    limit: 5,
  }),
  step('s8', 'Try a home-folder write.', 'write_file', {
    path: '~/Desktop/pwned.txt',
    content: 'sandbox should have stopped this',
  }),
  step('s9', 'Try a shell copy out of the sandbox.', 'run_command', {
    command: 'copy demo/hello.js %USERPROFILE%\\Desktop\\hello-copy.js',
  }),
  step('s10', 'Try a dangerous git command.', 'run_command', {
    command: 'git push --force origin main',
  }),
  step('s11', 'Check whether the child can see the API key.', 'run_command', {
    command: 'node -e "console.log(\'OPENROUTER_API_KEY=\' + (process.env.OPENROUTER_API_KEY ?? \'absent\'))"',
  }),
  step('s12', 'Check that a failing command reports its real exit code.', 'run_command', {
    command: 'node -e "process.exit(1)"',
  }),
  step('s13', 'Remember what this demo proved.', 'remember', {
    text: 'The sandbox demo script lives at demo/hello.js and proves every guard holds.',
    tag: 'fact',
  }),
  step('s14', 'Recall the note I just wrote.', 'recall', { query: 'demo' }),
];


/**
 * The fake model’s final text once the script is exhausted.
 */
export const DEMO_ANSWER = {
  role: 'assistant',
  content:
    'Demo complete. I created and edited demo/hello.js, ran it, and the guards refused every escape: the workspace write, the home-folder write, the shell copy to the Desktop, and git push --force. Reads outside the workspace work, the child process cannot see OPENROUTER_API_KEY, run_command reports the real exit code, and memory remembers and recalls the run.',
};


/**
 * One extra step beyond the script lets the fake model return its final answer.
 */
export const DEMO_MAX_STEPS = DEMO_SCRIPT.length + 1;


/**
 * Return a fake model function that replays DEMO_SCRIPT one response at a time, then returns DEMO_ANSWER. The real loop and tools cannot tell the difference.
 */
export function demoChat() {
  let index = 0;
  return async () => {
    const message =
      index < DEMO_SCRIPT.length ? DEMO_SCRIPT[index] : DEMO_ANSWER;
    index += 1;
    return {
      choices: [
        {
          finish_reason: message.tool_calls ? 'tool_calls' : 'stop',
          message,
        },
      ],
    };
  };
}


/**
 * The expected observations, keyed by tool_call_id, that the scorecard must find.
 */
const CHECKS = [
  {
    id: 's6',
    label: 'a write that escapes the workspace is refused',
    pattern: /^FORBIDDEN: SAVE \.\.\/escape\.txt/,
  },
  {
    id: 's7',
    label: 'reads are open - one folder up works',
    pattern: /^\.\.\/package\.json \(\d+ lines\)/,
  },
  {
    id: 's8',
    label: 'a home-folder write is refused',
    pattern: /^FORBIDDEN: SAVE ~\/Desktop\/pwned\.txt/,
  },
  {
    id: 's9',
    label: 'a shell copy out of the sandbox is refused',
    pattern: /^FORBIDDEN: COMMAND COPY /,
  },
  {
    id: 's10',
    label: 'dangerous commands are denied, whatever the policy',
    pattern: /^DENIED: blocked by policy/,
  },
  {
    id: 's11',
    label: 'the child process cannot see the API key',
    pattern: /OPENROUTER_API_KEY=absent/,
  },
  {
    id: 's12',
    label: 'run_command reports the real exit code',
    pattern: /^exit code 1\b/,
  },
];


/**
 * Read the demo tool messages by tool_call_id and check each expected refusal/safe result against its pattern. Returns rows and a passed/total count.
 */
export function sandboxScorecard(messages = []) {
  const byId = new Map();
  for (const message of messages) {
    if (message.role === 'tool' && message.tool_call_id) {
      byId.set(message.tool_call_id, String(message.content ?? ''));
    }
  }

  const rows = CHECKS.map((check) => {
    const seen = byId.get(check.id) ?? '';
    return {
      ok: check.pattern.test(seen),
      label: check.label,
      seen: seen.split('\n')[0] ?? '',
    };
  });

  return {
    rows,
    passed: rows.filter((row) => row.ok).length,
    total: rows.length,
  };
}

export default demoChat;
