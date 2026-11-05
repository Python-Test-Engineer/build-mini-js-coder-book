# mini-coding-js

A tiny Node coding-agent harness: a ReAct loop, nine tools, long-term memory and nine lifecycle hooks, with **one runtime dependency** (`chalk`, for colour) and no framework, agent SDK, database or hidden global state. The point is to be small enough to read in an afternoon and honest enough to show where the sandbox ends.

## Quick start

```bash
npm install
# put OPENROUTER_API_KEY in the project-root .env
npm start                     # interactive session
npm run demo                  # scripted offline demo - no key, no network
npm test                      # fully offline test suite
```

Live mode needs an [OpenRouter](https://openrouter.ai) API key. Demo mode needs nothing.

## The loop

```
CLI (cli.js)
  ├─ loadConfig()              config.js
  ├─ Workspace + Sandbox       workspace.js / sandbox.js
  ├─ Memory                    memory.js
  ├─ chatFn (real | demo)      llm.js / demo.js
  ├─ Hooks (trace by default)  hooks.js
  └─ runTask() per task        agent.js
       └─ think → model call → tool calls? ──no──→ answer, stop
                    ↑                │
                    └──── yes: run each tool, append result
```

`agent.js` is a library. It knows nothing about flags, colours, `.env` or `process.exit`. The CLI owns all process concerns; tests can run the loop with a fake model and no network.

### The seven beats per step

1. Print the step divider.
2. Ask the `PreModel` hook.
3. Start a heartbeat and call the model; stop the heartbeat in every path.
4. Ask the `PostModel` hook.
5. If the model was cut off by the length limit with no tool calls, append a "continue smaller" instruction and take another step.
6. Append the sanitised assistant message (only `role`, `content`, `tool_calls`).
7. If there are no tool calls: print the answer, ask `Stop`, then `SessionEnd`, and return. Otherwise run each tool in order, asking `PreToolUse` before and `PostToolUse` after, and append exactly one `tool` message per call.

After `maxSteps`, the loop prints the step-limit error, asks `StepLimit`, then `SessionEnd`, and returns `{ ok: false, reason: 'max_steps' }`.

## File-by-file tour

Start with `agent.js`; everything else is support.

| File | Responsibility |
|---|---|
| `src/agent.js` | The ReAct loop, truncation guard, heartbeat wiring, hook beats. |
| `src/heartbeat.js` | A `unref`'d interval that prints "still waiting" during slow model calls. |
| `src/cli.js` | Flags, banner, sessions, history trimming, exit codes, side doors. |
| `src/config.js` | `.env` discovery and parsing, precedence, fingerprint, model normalisation. |
| `src/llm.js` | One `fetch` POST to OpenRouter, composed abort signal, `sanitizeAssistant`. |
| `src/prompt.js` | Behavioural rules and the memory digest injected into the system prompt. |
| `src/workspace.js` | Path policy: reads open, writes fenced, symlink hardening. |
| `src/sandbox.js` | The only module that prints `FORBIDDEN`; command tokenising and write-target scanning. |
| `src/tools.js` | Tool schemas, validation, the nine handlers and `safeEnv`. |
| `src/memory.js` | File-as-database: parse, remember, search, digest. |
| `src/hooks.js` | The nine-event registry, trace helpers and catalogue. |
| `src/demo.js` | The scripted offline model and the 7-check scorecard. |
| `src/ui.js` | Presentation helpers. Every helper returns a string; nothing prints here. |
| `src/memory.md` | The initial long-term memory store. Edit it by hand. |

## The nine tools

| Tool | What it is for |
|---|---|
| `list_files` | List a folder, sorted, skipping `.git`, `node_modules`, `.venv`, `__pycache__`. |
| `read_file` | Read numbered lines with an offset/limit. Reads anywhere. |
| `create_file` | Create a **new** file; refuses to clobber. |
| `write_file` | Write a whole file, creating parents and overwriting. |
| `edit_file` | Replace an exact snippet; `replace_all` is opt-in; `$1` is literal. |
| `delete_file` | Delete a file or an empty folder inside the workspace. |
| `run_command` | Run a shell command in the workspace with policy, deny-list, safe env and a timeout. |
| `remember` | Append a durable note to the memory store. |
| `recall` | Search memory by words. |

## The read/write asymmetry and the shell limitation

**Reads are open; writes are fenced.** `read_file` and `list_files` may read outside `workspace/`; every write, edit and delete must resolve inside it. The fence expands environment variables and refuses absolute paths, drive-relative paths, UNC paths, home-folder paths, system folders and symlinked escapes.

`run_command` is a *convenience*, not a container. The harness scans the command for obvious write targets (redirections, `copy`/`mv` destinations, `del`/`mkdir` arguments, downloader output, PowerShell writers), checks them against the workspace fence, and refuses before execution. It also applies a hard deny-list (recursive root deletes, `del /s`/`/q`, `format`, `diskpart`, `shutdown`, `reboot`, `git push --force`, downloaders piped into a shell, fork bombs, raw disk writes). But a determined command can still do things the scan does not understand. **This is not a container or a VM.** For untrusted work, use a real container.

The child process gets only an allow-listed environment (`PATH`, `PATHEXT`, `HOME`, `USERPROFILE`, `TMP*`, `SYSTEMROOT`, `COMSPEC`, `SHELL`, `LANG`, `LC_ALL`, `TERM`), so it cannot read `OPENROUTER_API_KEY`.

## The nine lifecycle hooks

Hooks are asked, not merely notified. Four are deciding.

| # | Name | Icon | When | May |
|---|---|---|---|---|
| 1 | `SessionStart` | 🚀 | once, before the first model call | refuse, note |
| 2 | `UserPromptSubmit` | ✍️ | once, as the task enters the loop | rewrite task, block |
| 3 | `PreModel` | 🧠 | before every model call | observe |
| 4 | `PostModel` | 💬 | after every reply | observe |
| 5 | `PreToolUse` | 🛠️ | before every tool call | block |
| 6 | `PostToolUse` | 📦 | after every tool call | replace observation |
| 7 | `Stop` | 🏁 | model answered, loop ending | observe |
| 8 | `StepLimit` | ⏳ | `maxSteps` reached | observe |
| 9 | `SessionEnd` | 🔒 | always, finished or not | observe |

Return shapes:

```js
return undefined;                       // observe only
return { note: 'checked' };             // say something
return { task: '…and run the tests' };  // UserPromptSubmit: rewrite
return { replace: 'sk-or-[redacted]' }; // PostToolUse: change what the model reads
return { block: true, reason: 'no' };   // SessionStart/UserPromptSubmit/PreToolUse: refuse
```

A throwing hook is reported and ignored. The first block wins. `--no-hooks` silences the default `[HOOK:Name]` trace; `--hooks` prints the catalogue and exits.

## Long-term memory

`src/memory.md` is the store. One bullet per memory:

```markdown
- [pref] The user prefers tabs. _(2025-02-03)_
```

Tags are `fact`, `pref`, `fix`, `gotcha`. The system prompt gets a **bounded eager digest** (newest first) at the start of every task; the rest is reachable with the `recall` tool. `remember` refreshes an existing duplicate instead of adding another bullet, and drops the oldest when the store reaches `MEMORY_MAX_ENTRIES`. Hand edits are picked up immediately because nothing is cached.

`node src/cli.js --memory` prints the store, the exact digest that would be injected, and the raw file. `--no-memory` disables the store for a run.

## Sessions and history trimming

With no task argument and a terminal, the CLI starts an interactive session. `/new` clears the conversation but leaves the workspace and memory alone. `/quit` and `/exit` end it. History keeps the last 24 messages and always starts on a `user` message, because providers reject histories that begin with `tool` or end with an unanswered assistant `tool_calls`. Every task rebuilds the system prompt (with the latest memory) and gets a fresh step budget.

## Configuration

Precedence: **explicit `--model` override > nearest `.env` > shell environment > defaults.** `.env` deliberately beats a stale exported key so the project's key wins; names `.env` does not define still come from the shell.

| Name | Default | Meaning |
|---|---|---|
| `OPENROUTER_API_KEY` | — | Required for live mode. `OPENROUTER_KEY` is an alias. |
| `OPENROUTER_MODEL` | `deepseek/deepseek-v4.1-flash-1017` | A bare name is normalised to `vendor/model`. |
| `CMD_POLICY` | `ask` | `allow`, `ask` or `deny`. |
| `MAX_STEPS` | `12` | ReAct iterations per task. |
| `REQUEST_TIMEOUT_MS` | `90000` | Per model call. |
| `WORKSPACE_DIR` | `workspace` | The only folder the file tools may write to. |
| `MEMORY_FILE` | `src/memory.md` | The memory store. |
| `MEMORY_MAX_ENTRIES` | `60` | Bound on stored memories. |
| `MEMORY_PROMPT_CHARS` | `1200` | Bound on the injected digest. |

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Answer produced, session ended normally, or a side door ran. |
| `1` | Model request failed or a fatal error. |
| `2` | No task and stdin is not a terminal. |
| `3` | The step limit was reached. |

Non-zero exits print a plain-English meaning via `explainExit`.

## Safety model

1. **Workspace fence** — writes, edits and deletes resolve inside `workspace/`; symlink escapes are refused.
2. **Hard denies** — a short list of catastrophic commands never runs, even with `--yes`.
3. **Command policy** — `ask` (default), `allow` (`--yes`) or `deny` (`CMD_POLICY=deny`).
4. **Environment allow-list** — the child never inherits the harness environment.
5. **No secrets in output** — the key is fingerprinted, never printed whole.
6. **Not a container** — the shell scanner is best-effort. Treat the sandbox as a seatbelt, not a cell.

## Examples

A write that escapes ends like this:

```text
⛔ FORBIDDEN SAVE ../escape.txt - path escapes the workspace: ../escape.txt
FORBIDDEN: SAVE ../escape.txt - path escapes the workspace: ../escape.txt
```

A prompt that ends with a memory:

```text
task › Work out how this package is tested, run the tests, and remember the command.

tool → run_command {"command":"npm test"}
exit code 0
...
tool → remember {"text":"This package is tested with `npm test` (node --test).","tag":"fact"}
remembered in src/memory.md (6 total): - [fact] This package is tested with `npm test` (node --test). _(2025-02-03)_
```

More copy-pasteable prompts are in `demo_prompt.md`.

## Final acceptance

Run these from this folder:

```bash
npm install
npm test
node src/cli.js --help
node src/cli.js --hooks
node src/cli.js --memory
node src/cli.js --demo
node src/cli.js < /dev/null; echo "exit=$?"
node src/agent.js
```

The demo must print **7/7 checks held** and exit 0. Live checks (a real task through OpenRouter) are manual and never part of CI. See `CHAPTER.md` for the twenty-point acceptance checklist.
