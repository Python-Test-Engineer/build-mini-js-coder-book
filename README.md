# mini-js-coding-harness

Course files for the book **[mini-js-coding-harness.md](mini-js-coding-harness.md)** by **Craig West** — [craigwestai.com](https://craigwestai.com/).

A tiny Node coding-agent harness built one runnable stage at a time: a ReAct loop, nine tools, a workspace sandbox, long-term memory, nine lifecycle hooks and an offline test suite. One runtime dependency (`chalk`), no framework, no agent SDK.

## Read the book

- **Book:** [`mini-js-coding-harness.md`](mini-js-coding-harness.md)
- **Plan / build contract:** [`plan.md`](plan.md)


## What's in this repo

| Path | What it is |
|---|---|
| `mini-js-coding-harness.md` | The book: preface, 17 stages, theory, labs, reference and acceptance checklist |
| `ch00/` … `ch16/` | One complete, runnable snapshot per stage |
| `chNN/CHAPTER.md` | The stage's own run sheet |
| `ch16/README.md` | The finished project README |
| `plan.md` | The concise stage contract |

Every chapter is a standalone Node project. `ch00` is the scaffold; `ch16` is the finished harness.

## Quick start

Run the finished stage:

```bash
cd ch16
npm install
npm test
node src/cli.js --demo     # offline; no API key needed
node src/cli.js            # interactive session (needs a key)
```

Run any earlier stage the same way:

```bash
cd ch07
npm install
npm test
```

## Configuration

One shared `.env` lives at the repository root, next to `ch00/` … `ch16/`:

```text
OPENROUTER_API_KEY=sk-or-...
```

`config.js` walks up from each chapter root to find it. Do not commit a real key. The tests, `--demo`, `--help`, `--hooks` and `--memory` need no key.

## Author

**Craig West** writes and teaches about applied AI and agent engineering.

- Website: [craigwestai.com](https://craigwestai.com/)
- Repository: [Python-Test-Engineer/build-mini-js-coder-book](https://github.com/Python-Test-Engineer/build-mini-js-coder-book)
