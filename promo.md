# Advertising copy — *Build a Mini Coding Agent in JavaScript*

Author: Craig West · craigwestai.com
Repo: https://github.com/Python-Test-Engineer/build-mini-js-coder-book

---

## Positioning line (use everywhere)

**A tiny Node coding-agent harness built one runnable stage at a time.**

## One-liner

Most agent books start with the sandbox. This one starts with a chatbot — then gives it hands, memory and a loop, one runnable stage at a time.

## Elevator pitch (50 words)

Build a real coding agent in plain JavaScript by starting where every agent really starts: a conversation. No framework, no agent SDK, one dependency. Seventeen runnable stages take you from an empty folder to nine tools, a workspace sandbox, long-term memory, nine lifecycle hooks, and a testable ReAct loop.

---

# Amazon KDP description

> Paste into the KDP description field. Uses only supported HTML tags. No external links.
> Length: ~2,900 characters (limit 4,000).

```html
<h2>Most coding-agent books start with the sandbox. This one starts with a chatbot.</h2>

<p>Traditional agent tutorials build the plumbing first: the container, the permission model, the tool registry, the architecture diagram. You spend hours assembling infrastructure before the program says a single word. It diagrams well. It teaches badly.</p>

<p><b>This book builds in the opposite direction.</b></p>

<p>By Stage 3 you have a chatbot you can talk to. By Stage 7 it can read your files. By Stage 9 it can run commands. By Stage 12 it has a real ReAct loop. Every stage is a complete, runnable Node project, and every stage makes the program do something new that you can feel immediately.</p>

<p><b>A tiny Node coding-agent harness, built one runnable stage at a time.</b></p>

<p>No framework. No agent SDK. No database. One runtime dependency, <i>chalk</i>. Just modules, <i>async</i>/<i>await</i>, a <i>fetch</i>, and a <i>for</i> loop you can read line by line.</p>

<h2>What you build</h2>
<ul>
<li>Load configuration with visible provenance, so you always know where a value came from</li>
<li>Hold a multi-turn conversation with a system prompt and trimmed history</li>
<li>Call <b>nine tools</b>: list, read, create, write, edit, delete, run commands, remember, recall</li>
<li>Refuse writes outside a workspace — even through symlinks and shell commands</li>
<li>Run shell commands under a layered policy with timeouts and exit-code explanations</li>
<li>Persist long-term memory to a file that survives restarts</li>
<li>Expose <b>nine lifecycle hooks</b> that can observe, rewrite or block a run</li>
<li>Drive a testable ReAct loop with a step limit and a truncation guard</li>
<li>Prove every safety guard offline with a scripted demo — no API key required</li>
<li>Pass an offline test suite and a 20-item acceptance checklist</li>
</ul>

<h2>Why conversation first?</h2>

<p>Because you learn the failure modes in the order a real user meets them. A bad key is a Stage 2 problem. A model that forgets the previous turn is a Stage 4 problem. A model that writes the wrong file is a Stage 8 problem. A command that hangs is a Stage 9 problem. A model that loops forever is a Stage 12 problem. Build the loop first and you hide all of them behind a harness you do not yet understand.</p>

<h2>Who it is for</h2>

<p>Developers comfortable with modern JavaScript — modules, <i>async</i>/<i>await</i>, <i>fetch</i>, classes. You do not need to have built an agent before. You need Node.js 20+, a terminal, and an OpenRouter key for the live chapters. The tests, the offline demo and the help commands need no key at all.</p>

<p><b>For self-paced builders</b> who want a working agent and an understanding of every layer. <b>For students</b> who need concrete stages and checkpoints. <b>For teachers</b> who want a workbook with run sheets, a live-demo script, common misconceptions and an assessment rubric.</p>

<h2>What makes it different</h2>

<p>Every stage ships as a finished snapshot in the companion repository, so you never type boilerplate or copy files between chapters: open the folder, <i>npm install</i>, run it, then read the code that made it work. A function-by-function reference and a 185-question architecture Q&amp;A sit beside the book. And the book is honest about limits: the sandbox is a teaching policy, not a security boundary, and it says so repeatedly.</p>

<p><b>By the last page, every coding agent you meet will look like a variation on a program you can read.</b></p>
```

---

# Amazon back-cover / short blurb

**Build a real coding agent the way you actually learn: one runnable stage at a time.**

Most agent books begin with the sandbox — permissions, containers, architecture diagrams — and leave the conversation until the end. This one starts with a chatbot, then gives it hands.

Seventeen stages. Nine tools. Nine lifecycle hooks. One dependency. By the end you own a small Node coding-agent harness you can explain, test and extend — and you will recognise the loop, the tools, the context budget and the safety layers inside every other agent you meet.

---

# Amazon keywords / backend phrases

```
coding agent javascript, build ai agent nodejs, react loop tutorial, llm agent book,
ai agent harness, coding agent from scratch, node.js ai project, tool calling llm,
prompt engineering for developers, agentic ai programming, javascript llm book
```

## Amazon category suggestions

- Computers & Technology → Programming Languages → JavaScript
- Computers & Technology → Artificial Intelligence → Machine Learning
- Computers & Technology → Software Development → Software Design, Testing & Engineering

---

# Leanpub description

> Paste as the book description on Leanpub. Markdown, links allowed.

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

---

# Leanpub "Why you should read this book" / marketing blurb

> Short version for the Leanpub landing page or a bundle listing.

You have read enough agent explainers. This is a build book. You will run a real program after every chapter, read the code that makes it work, and finish with a small coding agent you can explain, test and extend.

It starts with a chatbot, not a sandbox — because a conversation is the thing you can feel, and every capability after it is an upgrade you notice immediately. By Stage 3 it talks. By Stage 7 it reads. By Stage 9 it runs. By Stage 12 it thinks, acts and observes in a loop.

One dependency. No framework. No agent SDK. Just the layers, one at a time, with the commands, the acceptance checks and the reasoning behind every decision.

---

# Social posts

## X / LinkedIn (short)

Most agent books start with the sandbox.

Mine starts with a chatbot.

By Stage 3 it talks. By Stage 7 it reads your files. By Stage 9 it runs commands. By Stage 12 it has a real ReAct loop.

A tiny Node coding-agent harness, built one runnable stage at a time. No framework, no agent SDK, one dependency.

## X / LinkedIn (thread opener)

Everyone teaches agents backwards.

Sandbox first. Permissions first. Architecture diagrams first. Then, hours later, the thing finally talks.

I built a book that starts where the agent really starts: a conversation.

Stage 3: you are chatting with the model.
Stage 4: it remembers the last turn.
Stage 5: it gets a job description.
Stage 6–9: it gets hands — files, edits, shell commands, behind a workspace fence.
Stage 10–11: memory and nine lifecycle hooks.
Stage 12: the loop you have been building toward all along becomes a library.
Stages 13–16: an offline demo, a test suite, and an acceptance checklist.

Every stage is runnable. Every stage is a superpower you can feel.

A tiny Node coding-agent harness, one runnable stage at a time. One dependency. No framework.

## Reddit / Hacker News (plain)

**Show: a book that builds a coding agent starting from a chatbot, not a sandbox**

Most agent tutorials front-load the plumbing — permissions, containers, tool registries — and the program does not talk until very late. I think that order is backwards for learning.

So this book builds in the opposite direction. Stage 3 is a chatbot. Stage 7 adds read-only tools. Stage 8 adds a workspace sandbox and writes. Stage 9 adds shell execution. Stage 10 is persistent memory, Stage 11 is nine lifecycle hooks, and Stage 12 extracts the ReAct loop into a testable library. Stages 13–16 add an offline demo, a full test suite and a final acceptance pass.

Seventeen complete, runnable Node snapshots — one per stage, so you never type boilerplate. One runtime dependency (`chalk`), no framework, no agent SDK. The book is explicit that the sandbox is a teaching policy, not a security boundary.

Companion material: a function-by-function code reference and a 185-question architecture Q&A.

Happy to answer anything about the build order or the harness design.

---

# Pull-quotes / taglines (for covers, banners, ads)

- A tiny Node coding-agent harness built one runnable stage at a time.
- Most agent books start with the sandbox. This one starts with a chatbot.
- Make it talk. Then give it hands.
- Seventeen stages. Nine tools. Nine hooks. One dependency.
- Every stage is runnable. Every stage is a superpower you can feel.
- If the program does not do something new after a stage, the stage is not finished.
- By the last page, every agent looks like a program you can read.
- Delete the `for` loop and you have a chatbot with tools it will never call.

---

# Cover copy (front / spine)

**Front**
Build a Mini Coding Agent in JavaScript
A tiny Node harness, one runnable stage at a time
Craig West

**Spine**
Build a Mini Coding Agent in JavaScript · Craig West

**Back cover bullets**
- Start with a chatbot, not a sandbox
- 17 runnable stages, one complete project each
- 9 tools, 9 hooks, a workspace fence and a testable ReAct loop
- One dependency. No framework. No agent SDK.
- Offline demo and test suite — no API key needed
