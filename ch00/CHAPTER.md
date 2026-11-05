# Chapter 0 — Stage 0: Scaffold

**Book:** Stage 0, "Scaffold"
**Plan:** Stage 0
**Goal:** A flat project with one runtime dependency and one writable folder.

## What changed
- Created `package.json`, `.gitignore`, `src/.gitkeep` and `workspace/.gitkeep`.
- Configuration comes from the shared project-root `.env`; chapters do not carry their own copy.

## Run it
```bash
npm install
npm ls --depth=0
node --test
```

## It works when
- [ ] `npm install` installs only `chalk`.
- [ ] `node --test` reports 0 tests without failing.
- [ ] `workspace/` is ignored except `.gitkeep`.
- [ ] `"type": "module"` is set.

## Stage limits
- No UI, model client or CLI yet.

## If it goes wrong
- **`Cannot use import statement outside a module`** — `"type": "module"` is missing or Node is too old.
- **`npm ls` shows extra packages** — `npm uninstall <name>` them; do not keep a package "for later".

## Read next
- Book: `../mini-js-coding-harness.md` Stage 0
- Theory: same book, "What this stage is really about" - Stage 0
- Contract: `../plan.md` Stage 0
