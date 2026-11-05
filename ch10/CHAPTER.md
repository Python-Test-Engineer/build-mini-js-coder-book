# Chapter 10 — Stage 10: Long-term memory

**Book:** Stage 10, "Long-term memory"
**Plan:** Stage 10
**Goal:** File-backed memory: a bounded digest in the system prompt plus `remember` and `recall` tools.

## What changed
- Added `src/memory.js` and the initial `src/memory.md` store.
- Added `test/memory.test.js`.
- Extended `src/tools.js` with `remember` and `recall`.
- `src/prompt.js`'s digest injection is now live.
- `src/cli.js` gained `--memory` (print store and digest) and `--no-memory`.

## Run it
```bash
npm install
node --test test/memory.test.js
node src/cli.js --memory
node src/cli.js "Remember that I prefer tabs, then recall it"
```

## It works when
- [ ] Writes and reads survive a new `Memory` instance.
- [ ] Duplicates refresh the date; no duplicate bullets.
- [ ] `maxEntries` drops the oldest and long notes are truncated.
- [ ] Empty notes are refused.
- [ ] The digest is bounded, newest first and states the hidden count.
- [ ] `forget` removes matches; hand edits are picked up immediately.
- [ ] `remember`/`recall` work through the tools.
- [ ] No memory store returns an error string, not a throw.
- [ ] `--memory` prints the digest and exits 0.
- [ ] `--no-memory` disables memory for that run.

## Stage limits
- No hooks. The manual tool loop still lives in `cli.js`.

## If it goes wrong
- **Hand edits are ignored** — never cache the parsed store; read the file each call.
- **The digest is unbounded** — cap both entry count and character budget.

## Read next
- Book: `../mini-js-coding-harness.md` Stage 10
- Theory: same book, "What this stage is really about" - Stage 10
- Contract: `../plan.md` Stage 10
