# Chapter 2 — Stage 2: Config and model client

**Book:** Stage 2, "Config and the model client"
**Plan:** Stage 2
**Goal:** Load configuration with provenance, and make one OpenRouter POST.

## What changed
- Added `src/config.js` (`.env` discovery, parsing, precedence, fingerprint, model normalisation).
- Added `src/llm.js` (`chat()` with composed abort signal, `sanitizeAssistant`).
- Added `test/config.test.js` and `test/llm.test.js`; all offline.

## Run it
```bash
npm install
node --test test/config.test.js test/llm.test.js
node -e "import('./src/config.js').then(m => console.log(m.loadConfig({}).apiKeySource))"
```

## It works when
- [ ] `loadConfig` resolves `.env`, shell and overrides in the right order.
- [ ] `.env` beats a stale shell key; the shell supplies names `.env` does not define.
- [ ] A missing `.env` is not an error.
- [ ] The fingerprint never exposes the whole key.
- [ ] Bare model names normalise to `vendor/model`, and the change is reported.
- [ ] An override is reported only when the value genuinely differed.
- [ ] `sanitizeAssistant` keeps only `role`, `content` and `tool_calls`.
- [ ] LLM tests mock `fetch`; timeout, `401`, `402`, non-JSON and `.error` are covered offline.

## Stage limits
- No CLI yet: `cli.js` arrives at Stage 3.

## If it goes wrong
- **Your key is printed** — stop, rotate the key, and use `fingerprint` everywhere.
- **`res.json()` throws on an error page** — read the body as text before parsing.
- **The timeout does not fire** — pass the composed signal to `fetch`.

## Read next
- Book: `../mini-js-coding-harness.md` Stage 2
- Theory: same book, "What this stage is really about" - Stage 2
- Contract: `../plan.md` Stage 2
