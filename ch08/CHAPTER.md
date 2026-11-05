# Chapter 8 — Stage 8: Sandbox and write tools

**Book:** Stage 8, "Sandbox and write tools"
**Plan:** Stage 8
**Goal:** Defense in depth: the sandbox is the only place that prints `FORBIDDEN`, and the model can create, overwrite, edit and delete files inside the workspace.

## What changed
- Added `src/sandbox.js`: `Sandbox`, `ForbiddenError`, `ACTIONS`, `save`, `remove`, `check`, `summary`.
- Added `test/sandbox.test.js`.
- Extended `src/tools.js` with `create_file`, `write_file`, `edit_file` and `delete_file`.
- `src/cli.js` creates one sandbox per run and passes it in the tool context.

## Run it
```bash
npm install
node --test test/sandbox.test.js test/tools.test.js
node src/cli.js "Create hello.txt in the workspace and tell me what you did"
```

## It works when
- [ ] `create_file` writes inside the workspace and refuses to clobber.
- [ ] `write_file` overwrites and creates parents.
- [ ] `edit_file` matches exactly, treats `$1` literally, and fails on missing/empty/ambiguous snippets.
- [ ] Every escape shape is refused for save, edit and delete.
- [ ] Deleting the sandbox root is refused.
- [ ] An unknown action to `check()` throws `TypeError`.
- [ ] A refused write prints exactly one `FORBIDDEN` line and returns a `FORBIDDEN:` observation.

## Stage limits
- No shell execution yet. `delete_file` is part of this stage's nine-tool contract (see `../skills/chapter-requirements/references/DEVIATIONS.md`).

## If it goes wrong
- **Two `FORBIDDEN` lines** — only the sandbox prints; the tool layer just returns the text observation.
- **`$1` is expanded** — use the replacer-function form of `String.prototype.replace`.

## Read next
- Book: `../mini-js-coding-harness.md` Stage 8
- Theory: same book, "What this stage is really about" - Stage 8
- Contract: `../plan.md` Stage 8
