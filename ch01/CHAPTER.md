# Chapter 1 — Stage 1: Terminal language

**Book:** Stage 1, "Terminal language"
**Plan:** Stage 1
**Goal:** Presentation helpers that return strings, so callers choose where output goes.

## What changed
- Added `src/ui.js` with the full helper surface.
- Added `test/ui.test.js`.
- Held the single-dependency rule: `chalk` only.

## Run it
```bash
npm install
node --test test/ui.test.js
node -e "import('./src/ui.js').then(ui => console.log(ui.title('hello')))"
```

## It works when
- [ ] Every helper returns a string.
- [ ] Styles become ANSI on a TTY and plain text when colour is off.
- [ ] A failed result is red; a clean result is green.
- [ ] Exit code 1 has a plain-English description.
- [ ] A successful command keeps its first stdout line as a dim annotation.
- [ ] `forbidden` produces bold red capitals.
- [ ] Model text with `<red>`, backslashes or JSON prints verbatim.

## Stage limits
- No config, model client or CLI yet. Nothing here prints.

## If it goes wrong
- **Colours disappear in tests** — `chalk` detects a TTY; set `chalk.level` explicitly in the test.
- **Result colour is wrong** — classify from the first line of the observation, not from a boolean.

## Read next
- Book: `../mini-js-coding-harness.md` Stage 1
- Theory: same book, "What this stage is really about" - Stage 1
- Contract: `../plan.md` Stage 1
