---
title: "Prior art — open-source projects taking a similar approach"
kind: research
bean: folio-assistant-vq8o
summary: >-
  Who else combines agent skills, a committed work plan, role-based processes and Lean-backed documents? Eighteen projects checked against their own repositories on 2026-09-23; none combines all of it. Includes a health comparison of beans and Beads (rechecked 2026-10-24).
---

# Prior art
{: .no_toc }

1. TOC
{:toc}

---

> **What this page is, and what it is not.** It answers one question — *who
> else is doing something like this?* — for a reader deciding whether to
> build, borrow or adopt. It is **not** the list of methodologies this
> repository has adopted; that is [Methodologies]({{ '/methodologies/' | relative_url }}), and a
> project moves there only when something from it is actually taken on.
> Each entry was checked against the project's own repository on
> **2026-09-23**, with `beans` and `Beads` re-measured on **2026-10-24**. Licences and star counts move; re-check before
> relying on one.

## Summary

No single project found does what folio-assistant does. Most overlap on
**one** axis. Three things together seem to be unusual here:

1. **Processes are executable BPMN/DMN that gate agent steps**, with instance
   state committed to git — rather than workflows written as prose or prompts.
2. **One platform, several content types** — Lean-backed papers and WHO SMART
   Guideline / FHIR IGs — separated by content adapters and profiles.
3. **Actor, role and permission are separate declared objects** — a role is a
   BPMN swimlane an actor steps into, not a persona the agent *is*.

| project | overlaps on | licence |
|---|---|---|
| [AGENTS.md](#agentsmd) | cross-tool instruction file | MIT |
| [Agent Skills](#agent-skills-skillmd) | skills loaded on demand | Apache-2.0 / CC-BY-4.0 |
| [Superpowers](#superpowers) | skill-carried discipline | MIT |
| [work items](#beans-and-beads) | git-committed work plan | Apache-2.0 |
| [Beads](#beans-and-beads) | dependency-aware work plan for agents | MIT |
| [BMAD-METHOD](#bmad-method) | agent roles + workflows | MIT |
| [Spec Kit](#spec-kit) | phased, spec-driven process | MIT |
| [MetaGPT](#metagpt) | roles following SOPs | MIT |
| [Camunda agentic orchestration](#camunda-agentic-orchestration) | executable BPMN with AI agents | source-available (Camunda 8) |
| [leanblueprint](#leanblueprint) | LaTeX ↔ Lean links + dependency graph | Apache-2.0 |
| [Verso](#verso) | documents with checked Lean | Apache-2.0 |
| [Basic Memory](#basic-memory) | markdown knowledge graph over MCP | AGPL-3.0 |
| [LangGraph](#langgraph) | stateful agent graphs with checkpoints | MIT |
| [CrewAI](#crewai) | role-based agents; deterministic Flows | MIT |
| [AutoGen](#autogen) | multi-agent conversation (maintenance mode) | MIT / CC-BY-4.0 |
| [Letta](#letta) | persistent agent memory | Apache-2.0 |
| [MyST (mystmd)](#myst-mystmd) | typed document AST, many outputs | MIT |
| [Quarto](#quarto) | executable technical documents | MIT |

## Agent instructions and skills

### AGENTS.md

[agentsmd/agents.md](https://github.com/agentsmd/agents.md) — an open format
for a single instruction file read by many coding agents. **This repository
already follows it**: `CLAUDE.md` and `GEMINI.md` are stubs pointing at
`AGENTS.md`.

**Difference.** Here `AGENTS.md` is deliberately a *bootstrap pointer*; the
rules live in skills, and a rule found only in `AGENTS.md` is treated as
migration debt.

### Agent Skills (`SKILL.md`)

[agentskills/agentskills](https://github.com/agentskills/agentskills) — the
open standard, originally from Anthropic, for a skill as a folder with a
`SKILL.md` (name + description front matter, then instructions) plus optional
scripts and resources. Agents load only names and descriptions first and the
body when a task matches (*progressive disclosure*).

**Difference.** folio-assistant's skills are **knowledge-graph content**
declared by a layer's `<instance>.json`, inherited from dependencies, and
served through `skill_list` / `skill_fetch`. Skills are also *bound* to BPMN
activities (`<bootstrap.processes:skill ref>`), so a process step names the skill to run.

### Superpowers

[obra/superpowers](https://github.com/obra/superpowers) — a skills library
that enforces a development discipline: brainstorm → isolate in a worktree →
write a plan → execute (optionally by subagents) under test-driven
development → review → finish the branch. Skills trigger automatically;
supports Claude Code, Cursor, Gemini CLI, Copilot CLI and others.

**Closest in spirit** to this repository's rule that *the discipline is in the
skill*. **Difference:** its process is a sequence the skills describe; here
the process is a diagram the engine runs, and `workflow_complete` refuses a
step that is not enabled.

## Work plans for agents

### beans and Beads

- [hmans/beans](https://github.com/hmans/beans) — **used here.** Tasks as
  Markdown files with front matter, committed alongside the code; `beans
  prime` gives an agent its context through a GraphQL query engine.
- [gastownhall/beads](https://github.com/gastownhall/beads) (formerly
  `steveyegge/beads`) — a dependency-aware issue graph for agents: `bd ready`
  lists unblocked work, `bd update --claim` claims atomically, `bd prime`
  injects context. Stored in **Dolt** (a version-controlled SQL database,
  embedded by default) and synced through git remotes (`refs/dolt/data`).

**Difference.** Both are the store. What folio-assistant adds on top is the
coordination discipline ([bean-coordination]({{ '/reference/skill-instructions/bean-coordination.html' | relative_url }}):
claim before you work, a claim announces rather than reserves, never delete a
work item) and the link between a work item and a running process instance.
Beads' atomic claim (and, from v1.3, leases) is the stronger primitive where
it is available.

**Health, as observed 2026-09-23 and re-measured 2026-10-24.**

| | work items (2026-09-23) | work items (2026-10-24) | Beads (2026-09-23) | Beads (2026-10-24) |
|---|---|---|---|---|
| last commit | 2026-04-06 — none in the three months since | 2026-04-06 (`99260bf`) — zero commits since | ~16 commits a day over the last three months | 2026-10-24 — 592 commits since 2026-09-23 (~19/day) |
| version | v0.4.2, pre-1.0 | v0.4.2 (2026-03-10), pre-1.0; no new releases | v1.3.0 (1.0 on 2026-04-03) | v1.3.2 (2026-10-24), via v1.3.1 (2026-09-30) and 5 RCs |
| storage | Markdown + front matter, one file per item | Markdown + front matter, one file per item | Dolt database; `issues.jsonl` is an export only | Dolt database (embedded Dolt 2.2.0 or proxied `sql-server`); `issues.jsonl` is an export only |
| stars / forks | ~0.9k / 66 | 955 / 72 | ~27k / ~1.9k | 28,166 / 1,897 |
| issues (open / closed) | — | 39 open / 21 closed | — | 1,071 open / 1,807 closed |
| recorded instability | none found | none found | a retracted release (v1.2.1, untested schema migration); issues on data loss across clones after the SQLite → Dolt migration and on `dolt pull` failing after migrations | no new `go.mod` retractions beyond `v1.1.1` / `v1.2.0` / `v1.2.1`; `#2251` and `#4259` closed, `#4356` still open; `v1.3.2` (fix-only) patched two `v1.3.1` data-loss regressions (`#7031`/`#7041` purge deleting closed root above live work; `#7032`/`#7044` auto-backup watermark skipping mid-sync commits) and a `v1.3.1` fan-in fix that reverted concurrent writes (`#7030`/`#7146`); new open multi-clone migration and `dolt pull`/`bd sync` data-loss issues (`#6727`, `#7037`, `#7039`, `#7073`, `#7294`, `#7757`, `#7781`, `#7783`, `#7795`, `#7811`) |

Work items is **quiet**; Beads is **active but churning** in exactly the layer —
storage and merge — this repository leans on hardest. Plain files that
`git diff` and review read directly are also part of why work items fits here: the
work item store is committed and reviewed like any other content.

No storage or corruption defect has surfaced in this repository's use of
`beans`, and `scripts/beans-fallback.ts` covers environments without the Go
binary.

## Roles and processes

### BMAD-METHOD

[bmad-code-org/BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) —
named agent personas — currently Analyst, PM, Architect, Developer and UX
Designer — that hand work to one another through workflows packaged as
`SKILL.md` directories (installed with `npx skills add` or as a Claude Code
plugin). Its loop is Clarify → Plan → Build-and-verify → Learn-and-adjust,
with a **scale-adaptive** choice of path (direct edit, one build session, an
epic, a whole project). Work state is committed: story files, a `tickets.toml`
per epic and a regenerated `sprint-status.yaml`. About 53k stars, monthly
releases (v6.12.0, 2026-09-04), though ~84 % of recent commits come from one
author. Code is MIT; the **name is a trademark** — "compatible with BMad" is
allowed, "BMad" in a product name is not.

**Closest to the role model.** **Difference:** a BMAD agent *is* a persona;
here nothing *is* a reviewer — an actor *acts as* a role for the duration of
a lane, and its permissions sit on the actor, not the role
([role-model]({{ '/reference/skill-instructions/role-model.html' | relative_url }})). BMAD's gating is
prose plus a front-matter state machine in its unattended loop; here a step is
enabled or refused by the BPMN engine. **Worth borrowing:** the
scale-adaptive path choice, and regenerating a status file from the artefacts
rather than trusting it.

### Spec Kit

[github/spec-kit](https://github.com/github/spec-kit) — spec-driven
development as agent commands (`/speckit-specify`, `/speckit-plan`,
`/speckit-implement`, …), plus bug-fix and idea-assessment workflows.

**Overlap:** phased requirements before implementation, as in
[CRDM](../process/crdm-methodology.html). **Difference:** CRDM runs as
`processes/process/crdm-requirements.bpmn`, with its state committed under
`beans/workflows/`.

### MetaGPT

[FoundationAgents/MetaGPT](https://github.com/FoundationAgents/MetaGPT) —
multi-agent framework built on *Code = SOP(Team)*: product manager, architect,
project manager and engineer roles following standard operating procedures.

**Difference:** MetaGPT *is* the agent runtime and its SOPs are code; this
repository is a harness around existing coding agents, and its procedures are
BPMN diagrams any MCP-connected agent can step through.

### Camunda agentic orchestration

[Camunda 8](https://docs.camunda.io/docs/components/agentic-orchestration/ai-agents/)
runs AI agents inside BPMN, chiefly through **ad-hoc sub-processes** (since
8.7), which let an agent choose which tasks to run and in what order within a
modelled scope. 8.9 (2026) added process-instance migration for them.

**The only other place found where the process is real, executable BPMN.**
**Difference:** Camunda is an enterprise process engine that agents run
inside; folio-assistant is an agent harness that carries its own small engine
and commits instance state to git. Camunda 8 is source-available rather than
OSI open source.

## Formal mathematics and documents

### leanblueprint

[PatrickMassot/leanblueprint](https://github.com/PatrickMassot/leanblueprint)
— a plasTeX plugin: `\lean{…}` names a Lean declaration, `\leanok` marks it
formalised, `\uses{…}` records dependencies, and a coloured dependency graph
is generated from them.

**Closest prior art for the `paper` content type.** One contrast is worth
stating precisely: leanblueprint's `\uses` is authored and serves as the
dependency graph, whereas here the **editorial** relation (`uses[]`, what a
reader must have read) and the **formal** one (derived from `lean.ref`) are
kept apart, and `uses[]` is never populated from Lean
([uses-editorial-review]({{ '/reference/skill-instructions/uses-editorial-review.html' | relative_url }})).

### Verso

[leanprover/verso](https://github.com/leanprover/verso) — Lean's own
documentation tool: documents written in a Markdown-like syntax, represented
in Lean, with embedded Lean code checked and highlighted with proof states.
Genres include manuals and blogs.

**Difference:** Verso puts the document inside Lean; folio-assistant keeps a
typed block model with `.lean` siblings and typesets through LaTeX, so the same
platform can carry non-Lean content types.

## Agent memory and knowledge graphs

### Basic Memory

[basicmachines-co/basic-memory](https://github.com/basicmachines-co/basic-memory)
— a Markdown knowledge graph (entities, observations, wiki-link relations)
that agents read and write over MCP.

**Difference:** Basic Memory is one general-purpose memory graph. Here each
directory declares the *kind* of graph it holds and whether a process
produces, reads or writes it
([content, context and state graphs]({{ '/reference/skill-instructions/content-context-and-state-graphs.html' | relative_url }})).

## General agent frameworks

These overlap more loosely: each is an agent **runtime** you build on, where folio-assistant is a
harness around coding agents that already exist.

### LangGraph

[langchain-ai/langgraph](https://github.com/langchain-ai/langgraph) — agents
as a directed graph of nodes and edges written in code, with state saved at
checkpoints and **interrupts** for a person to inspect or change it mid-run.
About 42k stars.

**Closest of the frameworks to an executable process:** a checkpointed graph
with human interrupts is structurally near a BPMN instance with a user task.
**Difference:** the graph is code in one application, not a diagram in a
standard notation that several agents and a person read; there are no lanes,
so no roles.

### CrewAI

[crewAIInc/crewAI](https://github.com/crewAIInc/crewAI) — agents defined by
*role*, *goal* and *backstory*. **Crews** delegate among themselves; **Flows**
are event-driven and deterministic. About 59k stars.

**Difference:** the Crew/Flow split is the same trade folio-assistant makes
between an agent's judgement and an engine that refuses a step — but a CrewAI
role is still a persona the agent *is*, as in BMAD.

### AutoGen

[microsoft/autogen](https://github.com/microsoft/autogen) — multi-agent
conversation framework. **In maintenance mode**: no new features; Microsoft
points new users at its successor, Microsoft Agent Framework. About 61k stars.

**Relevance:** historical. Not a candidate to borrow from.

### Letta

[letta-ai/letta](https://github.com/letta-ai/letta) — formerly MemGPT: agents
with **core memory blocks** in context and **archival memory** retrieved on
demand. Apache-2.0, about 25k stars. That repository now archives the retired
V1 server; active development is in `letta-ai/letta-code`.

**Difference:** Letta's memory is a service the agent calls. Here memory
entries are files committed under `memory/`, reviewed like content, and
classed as `context` — read, never written by a running process.

## Document toolchains without formal backing

### MyST (mystmd)

[jupyter-book/mystmd](https://github.com/jupyter-book/mystmd) — MyST Markdown
parsed to a **specified AST**, with cross-references, citations and directives,
rendered to HTML, LaTeX/PDF (templates for 400+ journals), Word and JATS. MIT.

**Closest to the document content type:** a typed, machine-readable block tree
from which many outputs are rendered. **Difference:** no formal claims, no
QA-verdict sidecars, no Lean.

### Quarto

[quarto-dev/quarto-cli](https://github.com/quarto-dev/quarto-cli) — a
Pandoc-based publishing system: Markdown with executable Python, R, Julia or
JavaScript cells, cross-references, websites and books. MIT.

**Difference:** Quarto checks that code *runs*; a paper folio's `.lean`
siblings check that a claim is *proved*. Different guarantees.

## Not covered

Nothing named on this page is unverified. Microsoft Agent Framework (AutoGen's
successor) and `letta-code` were noticed while checking and **not** examined.
