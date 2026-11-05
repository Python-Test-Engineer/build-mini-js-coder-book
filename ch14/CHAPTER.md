# Chapter 14 — Stage 14: Sessions and CLI polish

**Book:** Stage 14, "Sessions, history trimming and full CLI polish"
**Plan:** Stage 14
**Goal:** The final CLI shape: sessions with trimmed history, a configuration banner, warnings and exit-code mapping.

## What changed
- `src/cli.js`: `MAX_HISTORY`, `trimHistory`, `taskExitCode`, `printBanner`, per-task summaries, session counter, full flag set and entry guard.
- Added `test/session.test.js`.

## Run it
```bash
npm install
node --test test/session.test.js
node src/cli.js
node src/cli.js --max-steps 1 "Keep calling tools forever"
node src/cli.js < /dev/null; echo "exit=$?"
```

## It works when
- [ ] `/new` clears conversation history but leaves workspace and memory untouched.
- [ ] `/quit` and `/exit` end the session.
- [ ] A follow-up task sees the previous conversation but a fresh system prompt with the latest memory.
- [ ] Every task starts its own step budget.
- [ ] A hook rewriting the task rewrites the new task, not history.
- [ ] No task + non-TTY stdin exits 2.
- [ ] Hitting the step limit exits 3.
- [ ] Live mode without a key exits 1.
- [ ] The banner prints on every normal run.
- [ ] Non-zero exits print a plain-English note.

## Stage limits
- No new product features after this point; the next two chapters harden tests and docs.

## If it goes wrong
- **History starts with `tool`** — move the trim boundary forward until it lands on `user`.
- **The banner needs a key** — it must print from config, not from a network call.

## Read next
- Book: `../mini-js-coding-harness.md` Stage 14
- Theory: same book, "What this stage is really about" - Stage 14
- Contract: `../plan.md` Stage 14
