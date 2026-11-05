# Leanpub — About Your Book

Copy each field below into the matching field in Leanpub's **About Your Book** webform. The long description uses Markdown where Leanpub allows it.

---

## Book title

**Build a Mini Coding Agent in JavaScript**

## Subtitle

**A tiny Node coding-agent harness, built one runnable stage at a time**

## Author

**Craig West**

## Author website

https://craigwestai.com/

## Language

English

## Meta tags

If the webform accepts raw meta tags, paste this block:

```html
<meta name="description" content="A tiny Node coding-agent harness built one runnable stage at a time. Start with a chatbot, then add nine tools, memory, lifecycle hooks and a testable ReAct loop.">
<meta name="keywords" content="coding agent javascript, build ai agent nodejs, react loop tutorial, llm agent book, ai agent harness, coding agent from scratch, node.js ai project, tool calling llm, agentic ai programming, javascript llm book">
<meta name="author" content="Craig West">
<meta name="language" content="en">
<meta property="og:type" content="book">
<meta property="og:title" content="Build a Mini Coding Agent in JavaScript">
<meta property="og:description" content="Most coding-agent books start with the sandbox. This one starts with a chatbot — then gives it hands, memory and a loop, one runnable stage at a time.">
<meta property="og:url" content="https://github.com/Python-Test-Engineer/build-mini-js-coder-book">
```

If the form wants plain comma-separated values instead, use:

```text
coding agent javascript, build ai agent nodejs, react loop tutorial, llm agent book, ai agent harness, coding agent from scratch, node.js ai project, tool calling llm, agentic ai programming, javascript llm book
```

## Short description / tagline

Most coding-agent books start with the sandbox. This one starts with a chatbot — then gives it hands, memory and a loop, one runnable stage at a time.

## Teaser text

Build a coding agent the way you actually learn: one runnable stage at a time. You will start with a chatbot at Stage 3, give it file tools, memory and lifecycle hooks, then turn the whole thing into a testable ReAct loop — with no framework, no agent SDK and one runtime dependency. By the end you will own a small Node.js coding-agent harness you can explain, test and extend.

## Book description

**A tiny Node coding-agent harness built one runnable stage at a time.**

Most coding-agent books start with the sandbox. They teach you to build the container, the permission model and the tool registry before the program ever says a word. It makes a tidy diagram and a slow lesson — you wait hours before anything talks.

This book does the opposite.

**By Stage 3 you have a chatbot.** By Stage 7 it can read your files. By Stage 9 it can run commands. By Stage 12 it has a real ReAct loop, and by the end it has nine tools, a workspace sandbox, persistent memory, nine lifecycle hooks, an offline demo and a test suite.

### Why start with a chatbot?

Because every stage should feel like a superpower, and because you should meet the failure modes in the order a real user does:

- A bad key is a Stage 2 problem.
- A model that forgets the previous turn is a Stage 4 problem.
- A model that writes the wrong file is a Stage 8 problem.
- A command that hangs is a Stage 9 problem.
- A model that loops forever is a Stage 12 problem.

Build the loop first and you hide all of them behind a harness you do not yet understand.

### What you get

- **17 stages**, each a complete, runnable Node project
- **9 tools**: list, read, create, write, edit, delete, run commands, remember, recall
- **9 lifecycle hooks** that can observe, rewrite or block a run
- A workspace sandbox that refuses escapes — including symlinks and shell commands
- A testable ReAct loop with step limits and a truncation guard
- An **offline demo** that proves the safety guards with no API key
- An offline test suite and a 20-item acceptance checklist
- A **185-question architecture Q&A** and a function-by-function code reference
- Teacher material: run sheets, a live-demo script, the factory analogy, misconceptions and a rubric

### What it deliberately is not

No framework. No agent SDK. No database. One runtime dependency (`chalk`). And no false claims: the sandbox is a teaching policy, not a security boundary — the book says so repeatedly, because overclaiming safety is worse than naming its limits.

### Who it is for

Developers who can read modern JavaScript — modules, `async`/`await`, `fetch`, classes. You do not need to have built an agent before. Bring Node.js 20+ and a terminal. The live chapters use an OpenRouter key; the tests and the demo need none.

### The promise

By the last page, every coding agent you meet will look like a variation on a program you can read. You will recognise the loop, the tools, the context budget, the safety layers and the extension points — and you will know exactly where the design stops being safe.

**Companion repository:** [github.com/Python-Test-Engineer/build-mini-js-coder-book](https://github.com/Python-Test-Engineer/build-mini-js-coder-book) — every stage, plus the Q&A and the code reference.

**Author:** [craigwestai.com](https://craigwestai.com/)

## Who this book is for

Developers comfortable with modern JavaScript: modules, `async`/`await`, `fetch`, classes and basic Node APIs. You do not need to have built an agent before. You need Node.js 20 or newer, a terminal, and an OpenRouter API key for the live chapters.

It is written for:

- **Self-paced builders** who want a working agent and an understanding of every layer.
- **Students** following a course, who need concrete stages and checkpoints.
- **Teachers** who want a workbook with run sheets, a live-demo script, common misconceptions and an assessment rubric.

## What readers will learn

By the final chapter, readers will be able to:

- load configuration with visible provenance;
- hold a multi-turn conversation with a real system prompt;
- call nine tools: list, read, create, write, edit, delete, run commands, remember and recall;
- refuse writes outside a workspace, including symlink and shell-command escapes;
- run shell commands under a layered policy with timeouts and environment isolation;
- keep long-term memory in a file that survives restarts;
- expose nine lifecycle hooks that can observe, rewrite or block a run;
- drive a testable ReAct loop with step limits and a truncation guard;
- prove safety guards offline with a scripted demo;
- pass an offline test suite and a twenty-item acceptance checklist.

## What makes this book different

- **Conversation first.** The program talks at Stage 3, not after hours of infrastructure.
- **Every stage is runnable.** Each chapter ships as a complete Node project in the companion repository.
- **No framework, no agent SDK, no database.** One runtime dependency (`chalk`).
- **Honest about limits.** The sandbox is a teaching policy, not a container or a security boundary.
- **Built for teaching.** It includes a teacher's handbook, student labs, break-it labs, capstone projects, a Q&A companion and a function-by-function code reference.

## Prerequisites

- Node.js 20 or newer.
- A terminal.
- An OpenRouter API key for live chapters only. The tests, offline demo, `--help`, `--hooks` and `--memory` need no key.

## Suggested category

**Computers & Technology → Programming → JavaScript**

Alternatives:

- Computers & Technology → Artificial Intelligence → Machine Learning
- Computers & Technology → Software Development → Software Design, Testing & Engineering

## Tags / keywords

```text
coding agent javascript, build ai agent nodejs, react loop tutorial, llm agent book, ai agent harness, coding agent from scratch, node.js ai project, tool calling llm, agentic ai programming, javascript llm book
```

## Table of contents

- Preface
- Before you start
- Part 0: The idea before the code
- Phase A: A chatbot that talks
  - Stage 0: Scaffold
  - Stage 1: Terminal language (`ui.js`)
  - Stage 2: Config and the model client
  - Stage 3: The simplest chat loop
  - Stage 4: Conversation history
  - Stage 5: The system prompt
- Phase B: Give the chatbot hands
  - Stage 6: Path policy
  - Stage 7: Read-only file tools
  - Stage 8: Sandbox and write tools
  - Stage 9: Command execution
- Phase C: Memory and observability
  - Stage 10: Long-term memory
  - Stage 11: Lifecycle hooks
- Phase D: The agent loop and polish
  - Stage 12: The ReAct loop
  - Stage 13: Offline demo
  - Stage 14: Sessions, trimming and CLI polish
- Phase E: Hardening and documentation
  - Stage 15: The full test suite
  - Stage 16: Documentation and final acceptance
- Appendices
  - A. The message protocol
  - B. The safety model in one page
  - C. Every bound and cap
  - D. Debugging by symptom
  - E. Glossary
  - F. Reading the finished code
- Part II: The teacher's handbook
- Part III: The student workbook
- Part IV: Deep dives on harness engineering
- Part V: Reference
  - A. Configuration reference
  - B. CLI and exit-code reference
  - C. Tool response reference
  - D. Hook payload reference
  - E. File and API map
  - F. Final acceptance checklist
  - G. Function reference
  - H. Architecture Q&A
- About the author

## Companion links

- **Repository:** https://github.com/Python-Test-Engineer/build-mini-js-coder-book
- **Architecture Q&A:** https://github.com/Python-Test-Engineer/build-mini-js-coder-book/blob/main/qa.html
- **Function reference:** https://github.com/Python-Test-Engineer/build-mini-js-coder-book/blob/main/function-reference.md
- **Author:** https://craigwestai.com/

## About the author

**Craig West** writes and teaches about applied AI and agent engineering. He is the author of *mini-js-coding-harness* and other practical courses that build AI systems from first principles rather than hiding them behind a framework.

You can find his writing, courses and contact details at **[craigwestai.com](https://craigwestai.com/)**.

## Alternate short blurb — Leanpub landing page

**Build a real coding agent the way you actually learn: one runnable stage at a time.**

Most agent books begin with the sandbox — permissions, containers, architecture diagrams — and leave the conversation until the end. This one starts with a chatbot, then gives it hands.

Seventeen stages. Nine tools. Nine lifecycle hooks. One dependency. By the end you own a small Node coding-agent harness you can explain, test and extend — and you will recognise the loop, the tools, the context budget and the safety layers inside every other agent you meet.
