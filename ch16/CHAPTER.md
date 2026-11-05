# Chapter 16 — Stage 16: Documentation and final acceptance

**Book:** Stage 16, "Documentation and final acceptance"
**Plan:** Stage 16
**Goal:** Document the finished harness and prove the twenty acceptance checks.

## What changed
- Added `README.md` (the teachable project README) and `demo_prompt.md`.
- Kept every earlier module and test exactly as they were; this stage adds no runtime behaviour.
- Chapters do not carry `.env` or `.env.example`: the shared `.env` at the repository root is discovered by walking up from each chapter.

## Run it
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

## Final acceptance
- [ ] 1. `npm install` succeeds with only `chalk` as a runtime dependency.
- [ ] 2. `npm test` runs fully offline and all suites pass.
- [ ] 3. `node src/cli.js --help` prints usage without needing a key.
- [ ] 4. `node src/cli.js --hooks` prints the full nine-hook catalogue without a key.
- [ ] 5. `node src/cli.js --memory` prints the store and the exact digest that would be injected.
- [ ] 6. `node src/cli.js --demo` completes the 14-step script with **7/7 checks held**.
- [ ] 7. Live mode with a valid key runs a task through OpenRouter.
- [ ] 8. Live mode without a key prints a missing-key error and exits 1.
- [ ] 9. No task + no TTY exits 2.
- [ ] 10. A task that never yields an answer stops at the step limit and exits 3.
- [ ] 11. A write outside `workspace/` prints one `⛔ FORBIDDEN` line and returns a `FORBIDDEN:` observation without touching disk.
- [ ] 12. A read outside `workspace/` succeeds.
- [ ] 13. `CMD_POLICY=deny` refuses all commands; hard-denied commands are refused even with `--yes`.
- [ ] 14. The child shell cannot read `OPENROUTER_API_KEY`.
- [ ] 15. Memory survives process restarts, duplicates refresh, the file is bounded, and hand edits are picked up.
- [ ] 16. Every normal run prints `[HOOK:Name]` traces by default; `--no-hooks` silences them.
- [ ] 17. `/new` clears conversation history but leaves workspace and memory untouched; `/quit` and `/exit` end the session.
- [ ] 18. A follow-up task sees the previous conversation but a freshly rebuilt system prompt containing the latest memory.
- [ ] 19. `agent.js` executed directly prints a hint and does not run the CLI.
- [ ] 20. No framework, agent SDK, database or hidden global state.

## Stage limits
- None. This is the final snapshot.

## Read next
- Book: `../mini-js-coding-harness.md` Stage 16
- Theory: same book, "What this stage is really about" - Stage 16
- Contract: `../plan.md` Stage 16
- Deviations: `../skills/chapter-requirements/references/DEVIATIONS.md`
