# Chapter 7 — Stage 7: Read-only tools

**Book:** Stage 7, "Read-only tools"
**Plan:** Stage 7
**Goal:** The model can list folders and read files, but cannot write anything.

## What changed
- Added `src/tools.js` with `list_files` and `read_file`, validation and `runTool`.
- Added `test/tools.test.js`.
- Modified `src/prompt.js` usage so the CLI passes `TOOL_NAMES`.
- Modified `src/cli.js` to run the manual tool loop: model → tools → model → answer.

## Run it
```bash
npm install
node --test test/tools.test.js
node src/cli.js "List the files in this project, then read package.json"
```

## It works when
- [ ] The model can call `list_files` and see directory listings.
- [ ] The model can call `read_file` and see numbered file contents.
- [ ] Bad tool arguments return text errors, not crashes.
- [ ] Reads outside the workspace succeed (e.g. `../package.json`).
- [ ] A missing file returns `ERROR: no such file`.
- [ ] A directory read returns `ERROR: is a folder`.

## Stage limits
- Writes do not exist yet: no `create_file`, `write_file` or `edit_file`.

## If it goes wrong
- **A tool throws out of the loop** — `runTool` converts handler exceptions into observations.
- **The loop never stops** — each tool call must append exactly one `tool` message.

## Read next
- Book: `../mini-js-coding-harness.md` Stage 7
- Theory: same book, "What this stage is really about" - Stage 7
- Contract: `../plan.md` Stage 7
