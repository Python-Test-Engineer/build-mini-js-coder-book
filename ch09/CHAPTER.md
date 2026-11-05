# Chapter 9 — Stage 9: Command execution

**Book:** Stage 9, "Command execution"
**Plan:** Stage 9
**Goal:** `run_command` with a tokeniser, write-target scan, hard deny-list, policy, safe environment and timeout.

## What changed
- Extended `src/sandbox.js` with `tokenizeCommand`, `shellWriteTargets` and `checkCommand`.
- Extended `src/tools.js` with `run_command`, `safeEnv`, hard denies and clipped result formatting.
- Added `test/shell-sandbox.test.js`; extended `test/tools.test.js`.
- `src/cli.js` accepts `--yes` / `--allow-commands` and wires a `confirm` function.

## Run it
```bash
npm install
node --test test/shell-sandbox.test.js test/tools.test.js
node src/cli.js "Run node --version and tell me the result"
CMD_POLICY=deny node src/cli.js "Run node --version"
```

## It works when
- [ ] `run_command` returns exit code, stdout and stderr.
- [ ] Hard-denied commands are refused even with `--yes`.
- [ ] `CMD_POLICY=deny` refuses all commands.
- [ ] A shell copy to the Desktop is refused before running.
- [ ] A redirect outside the workspace is refused before running.
- [ ] Quoted arguments with spaces stay one token.
- [ ] The child environment does not contain `OPENROUTER_API_KEY`.
- [ ] Timeouts are handled gracefully.
- [ ] `safeEnv` keeps only allow-listed names.

## Stage limits
- No memory, hooks or extracted agent loop yet. The tool loop still lives in `cli.js`.

## If it goes wrong
- **A command writes outside** — the scan must run before approval and before execution.
- **The child sees the key** — pass `env: safeEnv(process.env)`, never the raw environment.

## Read next
- Book: `../mini-js-coding-harness.md` Stage 9
- Theory: same book, "What this stage is really about" - Stage 9
- Contract: `../plan.md` Stage 9
