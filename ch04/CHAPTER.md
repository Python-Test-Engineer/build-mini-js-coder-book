# Chapter 4 — Stage 4: Conversation history

**Book:** Stage 4, "Conversation history"
**Plan:** Stage 4
**Goal:** A multi-turn session where the assistant remembers the current conversation.

## What changed
- Rewrote `src/cli.js` around an interactive `runSession` with a `messages` array.
- Added `/new`, `/quit` and `/exit`, plus a session summary.
- One-shot mode still works.

## Run it
```bash
npm install
node src/cli.js
# then: hello / follow-up question / /new / /quit
node src/cli.js "Say hello"
```

## It works when
- [ ] An interactive session lets follow-up questions reference earlier context.
- [ ] `/new` clears history.
- [ ] `/quit` and `/exit` end the session.
- [ ] The session prints `session over - N turn(s)` on exit.
- [ ] One-shot mode still works.

## Stage limits
- Still a plain assistant: no system-prompt module and no tools.

## If it goes wrong
- **The model forgets** — append both the user message and the assistant reply.
- **`/new` loses the system prompt** — re-add it after clearing.

## Read next
- Book: `../mini-js-coding-harness.md` Stage 4
- Theory: same book, "What this stage is really about" - Stage 4
- Contract: `../plan.md` Stage 4
