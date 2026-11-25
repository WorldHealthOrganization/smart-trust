---
layout: default
title: Agent onboarding
parent: Authoring guides
nav_order: 0
lang: en
available_locales: ["ar", "zh", "en", "fr", "ru", "es"]
---

# Agent onboarding
{: .no_toc }

You are an LLM agent that has just been dropped into a repository using
folio-assistant. This page is your orientation: what you are looking at,
what to do first, and where to look things up.

For the *architecture* of skills, roles, and capabilities, read
[Skills & roles](../concepts/skills.html). This page is the practical version.

1. TOC
{:toc}

---

## 1. Work out which repo you are in

There are two kinds, and confusing them is the most common early mistake.

| | **folio-assistant** (the platform) | **A folio** (the content repo) |
|---|---|---|
| Contains | skills, schemas, pipeline, MCP server | the actual paper / guideline / IG |
| Has `content/<paper>/` | no — only `content/pipeline/` | yes |
| You edit here to | change how authoring works | change what is being authored |

<!-- command-path-ok: a PROBE — whether `content/` is here is the answer, so it must not be required to resolve -->
```sh
ls content/          # pipeline/ only  ⇒ platform;  paper dirs ⇒ folio
```

**folio-assistant contains no content.** If you find yourself about to
write subject matter into it — a chapter, a constant, a chapter-keyword
list — you are in the wrong repo, or the thing you are writing should be
folio-supplied data. See §7.

## 2. Your first five minutes

```sh
beans prime && beans list      # the work-plan — see §6
cat-harness-tools/scripts/session-start-coord-sweep.sh  # CLI-independent equivalent
bun run cat check-deps                     # what this environment can do
```

Many checks degrade to `n/a` rather than failing when a tool is missing (no
Lean toolchain, no Atlas, no LaTeX). **An `n/a` is not a pass:** say what was
skipped and why, because "all clean" over skipped checks reports the absence of
data as a result.

## 3. Find the right skill — don't improvise

Skills are the unit of work here. Before hand-rolling a procedure, check
whether one exists. **Ask for it; do not navigate to it,** because a hardcoded
path goes missing the moment the layout moves.

```
skill_list                                      # every skill, with its summary
skill_fetch skill="<id>" package_name="<pkg>"   # the instruction body to follow
work_plan_prime                                 # the work plan — see §6
```

No MCP server attached? The same graph is on disk: open `<name>.json` at the
repository root, take the `directories[]` entries whose `graphTypologies` hold
skills, and read the `.md` files under them.

**Read [`kg-navigation`](../reference/skill-instructions/kg-navigation.md)
before your first search.** It carries both routes in full, what counts as a
skill (three node kinds under those paths are not skills), and the three ways
the search goes wrong — including the one where you edit the wrong copy of a
skill that exists in three.

Where to read more — not where you start:

| Where | What it gives you |
|---|---|
| [Skill schema reference]({{ site.baseurl }}/reference/skills/) | generated input/output contract per skill |
| [Skill instructions]({{ site.baseurl }}/reference/skill-instructions/) | generated full instruction bodies |
| [Skills & roles](../concepts/skills.html) | how skills, roles, and capabilities compose |

Both `reference/` directories are **generated** — never hand-edit them.
Regenerate with `bun run cat-harness-tools/scripts/gen-schema-docs.ts` and
`bun run cat-harness-tools/scripts/gen-skill-docs.ts`.

## 4. The content object model, briefly

A content block is a **triple** sharing a root name:

```
<block>.ts     manifest — label, kind, uses[], lean.ref, cites[]
<block>.md     the narrative a reader actually reads
<block>.lean   the formalisation (when the kind requires one)
<block>.qa.json  QA sidecar — audit results, per criterion
```

The `.ts` manifest is the source of truth for structure. Formalisation
*status* is derived at build time, never stored in the manifest.

## 5. Two dependency relations — do not conflate them

- **`uses[]` is editorial.** "What must a reader have read to follow
  this block?" Authored — agent/human maintained.
- **The formal graph is machine-derived** from `lean.ref`, never
  hand-written.

They diverge legitimately in both directions: a proof invokes `simp`
lemmas nobody needs to read about; a theorem is motivated by an example
it never formally cites.

**Never populate `uses[]` from Lean.** It destroys the signal every
ordering metric is computed from. For impact questions ("what breaks if
this changes?") take the union:

<!-- command-path-ok: run IN A FOLIO — the platform carries no content/, which is this guide's own §1 -->
```sh
bun run content/pipeline/content-graph.ts content/<paper>
```

Auditing whether `uses[]` is well used is its own skill:
`uses-editorial-review`, plus the mechanical `uses` QA axis.

## 6. Track work in beans, not in your head

`beans` is the **single** todo mechanism — session-local *and*
cross-agent. `beans/` is kept on a state branch and mounted at session start
(`bun run cat state:mount`), so a plan survives a resume in a fresh container.

```sh
beans list
beans create "<title>"
bun run cat beans:claim <id>             # CLAIM before you work
```

Claim before working so two sessions don't pick the same item, and never
close a work item a sibling is mid-flight on (a finished one closes on evidence, not on authorship), and never delete ANY work item — scrap it with reasons instead. Do not stand up a parallel todo
store. Do not `beans create` bulk machine-generated queues (`*.qa.json`,
witness files) — those stay as bulk JSON.

Full discipline: `work-plan/skills/work-plan/todo-manager.md`,
`work-plan/skills/work-plan/bean-coordination.md`.

## 7. QA sidecars and axes

Every block can carry `<block>.qa.json` recording, per criterion, what
each reviewer found — `script`, `agent`, or `human`. Entries carry the
source-file hashes at audit time, so an entry goes **stale** when the
block is edited and must be re-adjudicated.

**Where a QA result is kept depends on whether it can be regenerated.**
Derived verdicts, meaning `script` entries and everything under
`<instance>/test/results/`, are a working copy. CI stores the record on the
orphan `qa-reports` branch, keyed by commit, so there is nothing to
regenerate and commit. Judgements by an agent or a human stay on `main` in
`test/attestations/`. Gates over them compute and judge: a finding fails
only if it is new against a stored baseline, and a missing baseline is
*unknown*. The skill is
[`qa-reports`](../reference/skill-instructions/qa-reports.md).

Criteria are grouped into **axes** (`proof`, `voice`, `detangler`,
`uses`, `canonical`, `compute`, `bibliography`, …). Run one:

<!-- command-path-ok: run IN A FOLIO — the platform carries no content/, which is this guide's own §1 -->
```sh
bun run content/pipeline/qa-sweep.ts --axis uses content/<paper>
bun run content/pipeline/qa-staleness.ts content/<paper>
```

Some criteria are `automated: true` (a script decides) and some are
`automated: false` (an agent or human must adjudicate). The second kind
costs real turns — see `semantic-cone.ts` for scoping them by what they
can actually affect.

**Folio-optional axes.** An axis encoding one folio's subject matter is
registered only when the folio opts in:

```json
// harness.config.json
{ "qaAxes": ["q-usage"] }
```

Likewise, folio-specific *data* belongs in the folio, not the platform —
e.g. `content/<paper>/topic-keywords.json` drives
`detangler-topic-coherence`, and absent it the checker reports `n/a`.

## 8. Shipping work

```sh
/prepare-merge [base]
```

Runs the generic recipe plus content-type-specific gates (paper →
content_validate / qa_sweep / proof_status / latex_preflight /
lean_build), then pushes. **It does not merge.**

Watching a sibling PR: `/watch <pr|branch>`.

## 9. Where to look things up

| Question | Answer |
|---|---|
| Project commands, conventions | `AGENTS.md` (the agent-generic source of truth) |
| What a skill does | `skills/**/`, or the generated [instruction bodies]({{ site.baseurl }}/reference/skill-instructions/) |
| A skill's typed contract | [Skill schema reference]({{ site.baseurl }}/reference/skills/) |
| What a QA criterion means | `content/pipeline/qa-criteria-registry.ts` — descriptions are the spec |
| The block schema | `schemas/types.ts` |
| The QA sidecar schema | `schemas/block-qa.ts` |
| What this environment can do | `cat-harness/scenarios/capabilities/*.json`, `--check-deps` |

## 10. Habits that keep you out of trouble

- **Don't hardcode a paper name.** A folio may hold several; resolve
  with `findPapers()` / `soleFolioPaper()` from
  `content/pipeline/repo-root.ts`.
- **Read the criterion description before acting on a finding.** They
  state severity, intent, and what explicitly does *not* count.
