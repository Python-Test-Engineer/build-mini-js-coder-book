# Chapter 12 — Stage 12: The ReAct loop

**Book:** Stage 12, "The ReAct loop"
**Plan:** Stage 12
**Goal:** Extract the conversation loop into `agent.js`, a library the CLI and tests can both call.

## What changed
- Added `src/agent.js` with `runTask`, the seven beats, truncation guard, entry guards and step limit.
- Added `src/heartbeat.js`.
- Added `test/agent.test.js`.
- Rewrote `src/cli.js` to call `runTask`; the manual loop is gone.

## Run it
```bash
npm install
node --test test/agent.test.js
node src/agent.js
node src/cli.js "List the files and read package.json"
```

## It works when
- [ ] The loop runs tools then stops on a plain answer.
- [ ] A failing tool result is fed back so the model can correct.
- [ ] The loop is capped at `maxSteps`.
- [ ] A truncated reply is not dispatched; the model is asked to continue smaller.
- [ ] The heartbeat prints waiting lines during slow calls.
- [ ] Blocked hooks produce the correct exit paths.
- [ ] The step limit fires `StepLimit` then `SessionEnd`.
- [ ] A follow-up task sees previous conversation but a fresh system prompt.
- [ ] `node src/agent.js` prints a hint and does not import the CLI.

## Stage limits
- No offline demo and no session trimming/banner yet.

## If it goes wrong
- **The loop hangs** — stop the heartbeat on every path, including errors.
- **A truncated tool call runs** — check `finish_reason === 'length'` before dispatch.

## Read next
- Book: `../mini-js-coding-harness.md` Stage 12
- Theory: same book, "What this stage is really about" - Stage 12
- Contract: `../plan.md` Stage 12
