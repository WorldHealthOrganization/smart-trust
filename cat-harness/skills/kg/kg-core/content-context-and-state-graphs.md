---
name: content-context-and-state-graphs
description: >
  Every declared graph is the subject a process produces, static context it
  reads, or live state it writes. The one question that settles it, the
  classification of every kind with its reason, what a consumer may assume of
  each layer, and why agent memory is context rather than state.
consulted: true
---

# Content, context and state graphs

A layer declares directories, and each says what **kind** of graph it
holds. Each kind also says which layer it is on, so a consumer can tell the
subject matter from a record about it, and a record it may write from one it
may not.

## One question settles every kind

> **Does a running process WRITE it, READ it, or is it the SUBJECT?**

| layer | the process… | example |
|---|---|---|
| **`content`** | produces it — that is usually the point | a skill, a schema, a folio chapter |
| **`context`** | **reads it and never writes it**. Static for the duration of a layer; it changes only when a human directs an authoring act, outside any process | an agent-memory entry |
| **`state`** | **writes it as it runs** — a work item's status changes because a step completed | a work item, a workflow instance, a QA verdict |
| **`derived`** | produces it **from a source**, and would regenerate it rather than re-author it. Not the working corpus | a `library/` section |

It is `holds` on `GraphTypologyDef` in `schemas/kg/cat-harness.ts`, and it is
**required**: `tsc` refuses a kind that has not said.

**A step that writes to a `context` graph is a defect, not an update.** That
is the reason the layer exists.

## Two supporting questions, for a hard case

The one above decides almost everything. When it does not, these two do, and
they have agreed with each other in every case here.

**Does it stand on its own?** Detach a node from everything else. A skill still
instructs, a schema still constrains, a library section still reads. A work item
names work on something that is no longer there; a QA verdict judges an absent
subject. **If detaching it empties it, it is not content.**

(A library section passes this and is still not `content` — standing on its own
rules out `state`, not `derived`; see §"`derived`" below.)

**Would you regenerate it or re-author it?** Content and context are *written*
by somebody with an intention. Live state is *arrived at* — re-running is how
you would get it back. A `.po` catalogue is authored; a health report is
arrived at.

Where they disagree with each other, **say so rather than picking**: a shape
this axis has not met is how a vocabulary acquires a category nobody can use.

## The classification

Ask the code, not this page — `graphTypologiesOfLayer("context")` returns the
live answer. No count appears here: a count in prose is a claim nothing
checks.

What is worth writing down is the reasoning for the kinds that are **not
obvious from their name**.

**`memory` is `context`.** It is static during a process: a process
**reads** memory and no step writes it. It changes only when a human directs an
authoring agent, which is an act **outside** any layer. Todos and work items are
not static.

**`todos` is `state`, and that is the pair worth understanding.**
`todos/todos.json` states a 2×2 — memory vs workflow management, human vs agent
— and puts `todos/` and agent memory in the same *memory* row. **This axis cuts
across that row.** A todo is an **outstanding item** a process closes; a memory
entry is an **established fact** nothing mid-process revises. Same row of that
2×2, opposite sides of this line. Neither model is wrong; they are asking
different questions, and a reader who assumes they align will expect memory to
behave like a todo.

**`fsh-guts` is `context`, and it is the one that reads like content.** It
holds structured material that *could* be rendered, and the fact it carries is
*where something got to*: abandoned, superseded, decided against. But **no
running step writes it**. Relocating something there is a human-directed act
([`deletion-requires-confirmation`](../../conduct/conduct-core/deletion-requires-confirmation.md)).

**`qa` and `health` are `state`.** A verdict is where a *review* got to, and
the sweep that produced it writes it. `health` is the same shape one level
out — about the repository rather than its artefacts. Both fail the
stand-alone question outright: detached from what they judge, they assert
nothing. This is also why the `kg-qa/` tree **mirrors** each subject's path
rather than being flat — a verdict's identity is partly the thing it is about.

**`attestations` is `state` too, and it is the half of `qa` that stays on
`main`.** Every QA verdict is split by whether it can be regenerated. The
DERIVED half (`qa`, and `health` with it) is state a CI run writes, and its
record lives on the orphan `qa-reports` branch keyed by commit — the
checkout's `test/results/` is a working copy. The JUDGEMENT half — agent, human
and baseline-pair attestations, `qa-attestations/v1` under `test/attestations/`
— is written by a review step too, so it is `state` by the same question, but
it is the one state graph here that **cannot be rebuilt by re-running its
writer**. That is why it stays on `main`, and why a merge conflict in it is a
person's to read rather than a generator's to repeat. The layer answers *who
writes it*; where it is kept answers *can it be reproduced*.

**`uploads` is `state` and `library` is `content`.** The clearest proof the
axis is not about file type: the same PDF is state in one directory and content
in the other. `uploads/` is a queue, and ingestion writes and drains it; the
declaration already says these files are not L1 and read as absent to every
corpus consumer. `library/` is what ingestion produced.

## What a consumer may assume

| | content | context | state |
|---|---|---|---|
| means what it says without resolving a reference | yes | no | no |
| a step may write it | no — authoring writes content, and that is the subject of a governed process, not bookkeeping | **no — a write is a defect** | yes |
| can be stale | it is wrong or right | yes — against a codebase that moved on | yes |
| same node in two layers is the same thing | yes | no | no |

**Of an unregistered kind, nothing.** `graphLayer()` returns `undefined`, and
the three predicates are deliberately **not** each other's negations. Reading
an absence as `content` is how somebody asking for a skill gets handed a QA
verdict.

**Use `processMayWrite()` rather than `=== "state"`.** It is the question
`isStateGraph` is usually being asked in service of, and naming it means a
fourth layer is one edit rather than a search.

## Where each layer lives

The layer a kind already declares (`holds`) decides where its graph lives by
default. The declaration makes it explicit and checkable.

| layer (`holds`) | example | default ref | keyed by | write shape |
|---|---|---|---|---|
| `content` | chapters, skills, processes | `main` | — | PR |
| `context` | interaction prefs, roles | `main` | — | PR |
| `state` | work items, workflow instances, todos | dedicated branch-store branches (e.g. `cat/cat-harness/beans`, `cat/cat-harness/todos`) | **tip** — one living tree | fetch → splice → push, never `-f` |
| `derived` (verdicts) | QA sidecars | `cat/cat-harness/qa-reports` | commit | append under `main/<sha>/`, `pr/<n>/<sha>/` |
| rendered | the docs site | `gh-pages` | commit (the build stamp) | replace, previews kept |
| cache | Lake builds | `lake-cache/*` | toolchain + inputs | one key per branch, pruned |

The distinction that matters between `state` and `derived`: **state is not
regenerable**. A QA verdict can be recomputed from the tree, so a commit-keyed
snapshot per run is right and losing one costs a rerun. A work item is somebody's
decision; it must be a single living tree whose history is the audit trail, and
a lost write is lost work. So `state` is tip-keyed (`storage.keyedBy: tip`),
stored on dedicated branch-store branches like `cat/cat-harness/beans`, `todos`,
and `fsh-guts`, and its write loop must splice, never replace.

## Where a graph is STORED — `storage.keyedBy`

The layer says who may write a graph. The directory's `storage` field says
where the graph lives when that is not `main`. The two are independent, but
only process-written graphs are candidates for `storage`:

| `keyedBy` | what the branch holds | for | API |
|---|---|---|---|
| `commit` | one entry per commit (`main/<sha>/`, `pr/<n>/<sha>/`) | `qa` — derived verdicts read against a baseline | `scripts/qa-store.ts` |
| `tip` | ONE live copy; the tip IS the current state | work items, todos — `state` with one truth at a time | `scripts/branch-store.ts` |
| `route` | one entry per published site route | the auto-doc page families — `derived`, regenerable | `scripts/branch-store.ts` |

### `route` is not a synonym for `tip`, and the difference is REGENERABILITY

Both live at a branch tip. The question that separates them: **can this be
recomputed from the tree?**

- A work item cannot. It is somebody's decision, a lost write is lost work, so a
  tip-keyed change carries `expect` (the blob its author read) and two sessions
  editing one file is a **`conflict` the caller settles**.
- A rendered page can. Nobody authored either side, the newer generation is
  simply right, and a lost write costs a rerun. So a route-keyed write carries
  **no `expect`** — and `branch-store.ts` **refuses** one that does rather than
  honouring it.

The refusal is the part to understand. Ignoring an `expect` here would let a
caller believe it had the tip-keyed guarantee while getting last-write-wins,
which is the vacuous-pass shape. And an `expect` arriving on a route-keyed
write means the caller thinks the page has two writers — the premise of
route-keying failing, which is worth a loud stop. **If a generated page really
does have two writers, `route` is the wrong keying for it and `tip` is right.**

Four rules:

- **One ref per state subgraph.** Work items are on `cat/cat-harness/beans` and
  todos on `cat/cat-harness/todos`, not on one shared `state` branch.
- **Not every named subgraph gets a branch.** Skills, schemas, processes, roles
  and the declarations themselves are `content` or `context`. They change by PR
  and stay on `main`.
- **A `qa` directory is commit-keyed.** The schema refuses `keyedBy: "tip"`
  **and `"route"`** on one, because either would be read as if it were keyed by
  commit, and a verdict is addressed by the commit it judges — there is no route
  to key it by. The guard names both values rather than only `tip`: one that
  named a single keying would admit every keying added after it.
- **The keying is PASSED to the store, never sniffed from the branch.** A
  manifest whose `keyedBy` disagrees with what the caller opened for is
  `corrupt`, in **both** directions. A store that adopted whatever the branch
  claimed would read a route-keyed branch as state the moment somebody pushed
  the wrong manifest.

A branch-tip read is **hit / miss / corrupt / unknown**, and a branch without a
`state-manifest/v1` root manifest is `corrupt`, not a hit — for a route-keyed
branch too. The `$schema` string says `state-manifest` on both: the format is
identical in every field, and `keyedBy` **inside** the manifest is the
discriminator, because the file declares what it is. A write is spliced onto the tip and pushed **without `-f`**,
retrying when the tip moves. To edit a file somebody else may be editing, pass
the blob you read as `expect`. A tip that disagrees then answers `conflict` and
pushes nothing, so the edit is not silently lost.

**Until a declaration sets `storage`, `main` is authoritative.** A directory
with no `storage` field lives in the checkout, whatever branches exist; that
holds for `route` too.

## Adding a kind

Answer the question and write the answer in `holds`, with the reason beside it
as a comment. Three rules about how:

**Do not add a value without a case that needs it**: a real consumer that
cannot answer a real question. `context` exists because a consumer told only
"this is state" could not tell whether writing to a memory entry was normal or
a bug.

**There is no "could not determine".** A third state is right when a *check*
looked and could not tell, and wrong when an *author* is registering a kind
they are defining. Declining to say moves the burden to every consumer, which
is the position this axis exists to end.

**`holds` is part of a kind's identity.** `sameKind` compares `type`,
`renderable` and `holds`, so two layers registering one name on different
layers is a conflict that throws rather than a diamond where the first silently
wins. `summary`, `skill` and `schema` are descriptive and are not compared.

## `derived`: when the supporting questions disagree — `library/`

| question | answer for a `library/` section |
|---|---|
| does a process write it? | **yes** — `document-ingestion.bpmn` |
| does it stand on its own? | **yes** — a section still reads. Says `content` |
| regenerate, or re-author? | **regenerate**, from the ingested source. Says not-content |

Neither existing answer fits, and each is ruled out by a rule:

- **`context` is ruled out** because a step that writes to it is a defect, and
  a declared process writes `library/`.
- **`content` is ruled out** because QA sweeps only active/working content. A
  QA finding against a derived section is a finding against its **generator**,
  so a sweep that judges `library/` sends a reviewer to fix the wrong file.

`walkBlocks` skips a directory whose declared graphs are all non-`content`, so
`library/` leaves the sweep **with no directory name written down anywhere** —
the same way `fsh-guts/` does — because a hardcoded skip is the kind of
hardcoded path the declaration exists to remove.

**What it does NOT mean.** `derived` is not "unimportant" and not "not
committed". `library/` is L1 corpus, committed and greppable, and every
knowledge-graph reference to a source still resolves through it. The layer says
where a *finding* belongs, not what the material is worth.

## Classifying a kind is not a ruling on a directory's contents

Classifying a kind says what that KIND holds, not what every node beneath a
directory of that kind is: **a directory of one kind may contain a node of
another, and the containing declaration is not a claim about its contents.**

## The layer is not the source — a branch is not "where state lives"

A declared subgraph also says where its content COMES FROM — the checkout's
directory or a declared repository branch, overridable by the layer config
(`source`, [`directory-conventions`](directory-conventions.md) §"Where a
subgraph gets its content"). **That is a different axis from this one, and
neither is derived from the other.**

"State lives on a branch" is not a rule. `todos` is `state` while its source is
`directory` on `main`, and stays `state` when the config mounts it from
`cat/cat-harness/todos`. `qa` is `state` and is keyed by commit on its branch,
never by tip. A `context` graph mounted from a branch is still read-only to
every process, because what a step may do is `processMayWrite(kind)` — asked of
the KIND, never of where the bytes came from.

So: **ask `processMayWrite` for whether to write, and the resolved source for
HOW to write** — a commit for `directory`, a spliced push for `branch`
(`processes/kg/mount-subgraph.bpmn`). A consumer that branches on one to answer
the other has merged two questions this repository keeps apart.

## A declared ASSET carries a layer too

The axis is not only about directories. `instance-readme` and
`agent-instructions` are declared assets, and both hold **`context`**: static
at process runtime and treated as an asset like memories. `README.md` and
`AGENTS.md` are read at session start and authored by a human, so a step that
rewrites one is a defect by the same rule a step writing to `memory/` is.

**One rule, not two spellings.** `layerIsWritable(layer)` is the whole of it;
`processMayWrite(kind)` and `processMayWriteAsset(role)` both call it, so a
`context` directory and a `context` asset cannot come to mean different
things.

**Where an asset's layer is declared is the one difference.** A directory's
layer is a property of its graph TYPOLOGY; an asset's is a property of its ROLE,
in `ASSET_ROLES`, because an asset has no kind. A per-asset `layer` would be
eleven layers answering one question, and `check:asset-roles` rejects it —
asked of the raw declaration, since `KgAssetSchema` strips an unknown key
without a word.

**Creation at INITIALISATION is not a process write.** A `context` asset that
does not exist yet has to come from somewhere: **initialisation is not process
runtime.** `initialize-harness.bpmn` ends with `A_WriteRootReadme`
(`bootstrap/skills/root-readme.md`), which writes the root `README.md` when
there is none and **never replaces** one that exists — an existing README is
authored content, and the link and install status go in a marker pair that
`readme_sync` owns from then on.

**A process may CREATE or REPAIR the declaration (`<name>.json`) or config
(`<name>.config.json`). It never maintains it.** Every `state` graph is one a
running process keeps current (work items, QA witnesses, workflow tokens). Neither
`<name>.json` nor `<name>.config.json` is that: `init-folio` writes them once
when there is no folio yet, and `ensure-landing-sticky` inserts one missing
`folio` directory entry on `!already` and returns on `already` thereafter — a
one-time repair, never ongoing state maintenance.

Where this page and a skill disagree, **this page wins** and the skill is the
copy that drifted — it says so itself.

## See also

- [`directory-conventions`](directory-conventions.md) — what a declaration is
  and how a path resolves. This page is the axis; that one is the mechanism.
- [`agent-memory`](../../conduct/conduct-core/agent-memory.md) — what a memory entry promises, and the
  injection budget. This page says what layer it is on.
- [`process-state`](../../process/workflow/process-state.md), [`bpmn-processes`](../../process/workflow/bpmn-processes.md) —
  the largest writer of a live-state graph: a workflow instance is a token's
  position in a diagram that lives in a content graph.
- `todo-manager` (opt-in `cat-harness.work-plan`), `bean-coordination`
  — the work plan, and why a work item is never deleted. A state record that
  vanishes leaves a sibling unable to tell abandonment from accident.
- [`instance-publication`](instance-publication.md#what-each-layer-publishes--graph-address-schema-and-what-is-stripped)
  — a `state` graph's nodes are never published. That rule, and every other
  rule about what reaches the site, lives there.
