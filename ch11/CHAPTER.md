# Chapter 11 — Stage 11: Lifecycle hooks

**Book:** Stage 11, "Lifecycle hooks"
**Plan:** Stage 11
**Goal:** Nine extension points that are asked, not merely notified: observe, rewrite, block and replace.

## What changed
- Added `src/hooks.js`: `Hooks`, `HOOK_NAMES`, `HOOK_META`, `HOOK_SUMMARY`, `traceHooks`, `printHookCatalogue`.
- Added `test/hooks.test.js`.
- `src/cli.js` fires all nine hooks in the manual tool loop, prints a trace by default, and exposes `--hooks` and `--no-hooks`.

## Run it
```bash
npm install
node --test test/hooks.test.js
node src/cli.js --hooks
node src/cli.js --no-hooks "Say hello"
```

## It works when
- [ ] Every hook has an icon, colour, when, gets, may and why.
- [ ] The catalogue prints all nine and marks attached hooks.
- [ ] An unknown hook name throws.
- [ ] Handlers run in order and the first block wins.
- [ ] A throwing hook is reported, never fatal.
- [ ] Notes print and `once` handlers detach.
- [ ] `off` by id works.
- [ ] `[HOOK:Name]` traces print by default; `--no-hooks` silences them.
- [ ] `--hooks` prints the catalogue with no key.

## Stage limits
- The loop still lives in `cli.js`; `agent.js` arrives next.

## If it goes wrong
- **A hook kills the run** — catch handler errors and report them as warnings.
- **Blocking does nothing** — stop at the first `{ block: true }` and honour it on every path.

## Read next
- Book: `../mini-js-coding-harness.md` Stage 11
- Theory: same book, "What this stage is really about" - Stage 11
- Contract: `../plan.md` Stage 11
