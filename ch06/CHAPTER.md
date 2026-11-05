# Chapter 6 — Stage 6: Path policy

**Book:** Stage 6, "Path policy"
**Plan:** Stage 6
**Goal:** Reads are open; writes are fenced. This chapter is a library only.

## What changed
- Added `src/workspace.js` with `PathError`, `Workspace`, `resolve` and `resolveRead`.
- Added `test/workspace.test.js`, including symlink hardening and environment expansion.
- The CLI is unchanged: no tool can call the policy yet.

## Run it
```bash
npm install
node --test test/workspace.test.js
```

## It works when
- [ ] Legitimate relative paths resolve and `rel` is correct.
- [ ] Every escape shape is refused.
- [ ] Reads outside the workspace are allowed.
- [ ] A symlinked folder inside the workspace cannot smuggle a write outside.

## Stage limits
- No tools and no sandbox wrapper yet. Nothing prints `FORBIDDEN` at this stage.

## If it goes wrong
- **`../x` slips through** — resolve to an absolute path and compare with `path.relative` before trusting it.
- **A symlink defeats the fence** — resolve the deepest existing ancestor with `realpathSync` and re-check.

## Read next
- Book: `../mini-js-coding-harness.md` Stage 6
- Theory: same book, "What this stage is really about" - Stage 6
- Contract: `../plan.md` Stage 6
