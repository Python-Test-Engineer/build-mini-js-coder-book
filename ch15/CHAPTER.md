# Chapter 15 — Stage 15: The full test suite

**Book:** Stage 15, "The full test suite"
**Plan:** Stage 15
**Goal:** Every module is covered by an offline suite; `npm test` never touches the network and never needs a key.

## What changed
- All thirteen required suites now exist and pass together: `ui`, `config`, `llm`, `input`, `prompt`, `workspace`, `tools`, `sandbox`, `shell-sandbox`, `memory`, `hooks`, `agent`, `session`.
- Added hardening assertions for `UserPromptSubmit` rewriting/blocking and the `PostToolUse` `ok` flag.

## Run it
```bash
npm install
npm test
```

## It works when
- [ ] `npm test` runs fully offline.
- [ ] All suites pass.
- [ ] No test makes a real network call.
- [ ] No API key is required.
- [ ] Tests use temporary directories and injected loggers.

## Stage limits
- No new runtime features. `ch16` documents the finished harness and proves final acceptance.

## If it goes wrong
- **A test reads your real `.env`** — pass an explicit `envFile` or a temporary directory.
- **A mock leaks** — restore `globalThis.fetch` in a `finally` block.

## Read next
- Book: `../mini-js-coding-harness.md` Stage 15
- Theory: same book, "What this stage is really about" - Stage 15
- Contract: `../plan.md` Stage 15
