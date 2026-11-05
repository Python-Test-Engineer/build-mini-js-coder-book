# Chapter 5 — Stage 5: The system prompt

**Book:** Stage 5, "The system prompt"
**Plan:** Stage 5
**Goal:** Keep behavioural rules in their own module and rebuild the system prompt on every turn.

## What changed
- Added `src/prompt.js` with `systemRules` and `buildSystemPrompt`.
- Added `test/prompt.test.js`.
- `src/cli.js` now rebuilds the system message instead of hard-coding it; `/new` keeps the prompt.

## Run it
```bash
npm install
node --test test/prompt.test.js
node src/cli.js "What are your rules?"
```

## It works when
- [ ] Rules are the first `system` message on every turn.
- [ ] `/new` keeps the system prompt.
- [ ] No tool names are listed yet: the signature accepts `tools` but the CLI passes `[]`.
- [ ] A memory digest would be appended when a memory store exists.

## Stage limits
- No tools and no path policy yet.

## If it goes wrong
- **The prompt disappears after `/new`** — re-add the freshly built prompt, not the old string.
- **Future tools leak in** — pass `tools: []` until the tools exist.

## Read next
- Book: `../mini-js-coding-harness.md` Stage 5
- Theory: same book, "What this stage is really about" - Stage 5
- Contract: `../plan.md` Stage 5
