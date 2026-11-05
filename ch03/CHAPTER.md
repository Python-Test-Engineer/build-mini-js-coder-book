# Chapter 3 — Stage 3: The simplest chat loop

**Book:** Stage 3, "The simplest chat loop"
**Plan:** Stage 3
**Goal:** Wire config, model client and UI into a runnable program that can answer one task.

## What changed
- Added `src/cli.js`: hand-rolled flags, `askTask`, one model call, meaningful exit codes.
- Added `test/input.test.js`.

## Run it
```bash
npm install
node src/cli.js --help
node src/cli.js "Say hello in one sentence"
node src/cli.js < /dev/null; echo "exit=$?"
```

## It works when
- [ ] `node src/cli.js --help` prints usage with no key.
- [ ] `node src/cli.js "Say hello"` reaches OpenRouter and prints the reply.
- [ ] No task + non-TTY exits 2 with a helpful message.
- [ ] Missing/invalid key exits 1 with a clear message.
- [ ] `--model` overrides `.env`.

## Stage limits
- One task, one reply. No conversation history, tools or system-prompt module.

## If it goes wrong
- **The program hangs** — check the TTY before prompting.
- **`--help` asks for a key** — the help branch must run before `loadConfig`.

## Read next
- Book: `../mini-js-coding-harness.md` Stage 3
- Theory: same book, "What this stage is really about" - Stage 3
- Contract: `../plan.md` Stage 3
