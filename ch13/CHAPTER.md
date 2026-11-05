# Chapter 13 — Stage 13: Offline demo

**Book:** Stage 13, "Offline demo"
**Plan:** Stage 13
**Goal:** A scripted fake model proves every guard holds with no API key and no network.

## What changed
- Added `src/demo.js`: `DEMO_SCRIPT` (14 tool steps), the final answer, `demoChat`, `sandboxScorecard`.
- `src/cli.js` gained `--demo`, which runs the script and prints the 7-check scorecard.
- `test/agent.test.js` gained a demo assertion.

## Run it
```bash
npm install
node src/cli.js --demo
```

## It works when
- [ ] The demo completes 14 steps plus a final answer.
- [ ] It creates, edits and runs `workspace/demo/hello.js`.
- [ ] It refuses `../escape.txt`, `~/Desktop/pwned.txt` and the shell copy to the Desktop.
- [ ] It allows reading `../package.json`.
- [ ] It denies `git push --force`.
- [ ] The child process reports `OPENROUTER_API_KEY=absent`.
- [ ] It reports exit code 1 with an explanation.
- [ ] It remembers and recalls the run.
- [ ] The scorecard prints **7/7 checks held** and the process exits 0.

## Stage limits
- No sessions/history trimming and no banner yet; `ch14` is the final CLI shape.

## If it goes wrong
- **The scorecard is short** — a tool call id and its `role: 'tool'` message must match.
- **A guard passes on the wrong platform** — the demo is written for the Windows cmd.exe sandbox described in the book.

## Read next
- Book: `../mini-js-coding-harness.md` Stage 13
- Theory: same book, "What this stage is really about" - Stage 13
- Contract: `../plan.md` Stage 13
