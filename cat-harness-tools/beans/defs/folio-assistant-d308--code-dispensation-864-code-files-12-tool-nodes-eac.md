---
# folio-assistant-d308
$schema: bean/1.0.0
title: 'CODE DISPENSATION: 868 code files → 13 Tool nodes, each bound to a BPMN task'
status: completed
type: epic
priority: normal
created_at: 2026-09-20T04:08:50Z
updated_at: 2026-10-29T07:40:00Z
parent: folio-assistant-zzmr
---


Owner, 2026-09-20, which is the framing and not a paraphrase of it:

> i dont want platform code. there should be NO code, only skills/tools in the
> KG. the code needs to do something. please analyze and create a table
> categorizing and dispensation options. can be part of large general
> processes for now, writing a paper. associate them to a task in a large
> process as to where where they would be used as part of bpmn(s).

Sibling of `ce65`, which asks the same question from the other side. `ce65`:
**which skills lack a Tool.** This bean: **which code lacks a Tool node to be
reached through.** Neither answers the other, and a Tool is where they meet.

## The headline, and why it is smaller than the file count suggests

**868 code files. 229 of them are loose — and they collapse to 13 groups.**

The 229 are the only ones the owner's rule actually indicts: everything else is
already a knowledge-graph node (225), already reachable as or through a declared
Tool (88), a gate (10), a library with no entry point (25), a test riding with
its subject (242), a one-shot to scrap (17) or host config that no agent names
(32).

And within the 229, only **42 files are commands this repository can run** and
**30 more are executables run directly** — 72 together. The remaining **157 are
could-not-determine, not zero**, and the difference matters; see the correction
below. So the dispensation is **13 Tool nodes**, whose `invoke` names one entry
point each and whose siblings become unreachable except through it. That is the
state the owner asked for, and it is thirteen nodes of work, not eight hundred
files of it.

## CORRECTION, 2026-09-20: "entry points" was one number where it needed three

The first pass counted an entry point as *named by a `package.json` script, or
mode 755*, and reported one figure. That collapses a real distinction, and the
collapse was caught the moment the first node was attempted.

**This repository has no `content:build`, no `render:*`, no `validate`, no
`qa:sweep`, no `lean:build` and no `latex:*` among its 89 scripts** — because,
as `AGENTS.md` states, **the platform carries no folio**. `content/pipeline/*.ts`
are library modules invoked from a FOLIO's `package.json` (`litlfred/qou`), which
cannot be read from here. So a pipeline file with no local script is not a file
with no entry point; it is a file whose entry point is **in a repository this
measurement cannot see.**

That is the third-state rule applied to my own metric, and it had been broken:
could-not-determine was being rendered as a count. The table now carries three
columns, and the reading is:

| column | meaning |
|---|---|
| **run here** | named by THIS repo's `package.json` — a Tool node here can be exercised and verified |
| **mode 755** | an executable run directly, no script entry |
| **can't tell** | no local entry point. For a `content/pipeline/` file this means *invoked from a folio*, never *unused* |

### What it changes about the work, which is the reason it is not a footnote

Six groups have **zero** files this repo can run — Lean (0/16/17), LaTeX
(0/3/13), Bibliography (0/3/8), FHIR (0/0/3) — or effectively zero: QA sweep
(2/0/25), Content graph (1/0/18). **A Tool node for those must be authored here
and verified in a folio.** `h588` already recorded that for FHIR, where
`qa-sweep` and `witness-refresh` fail by design in the platform repo. It is not
special to FHIR; it is true of six of the thirteen.

So the build order is not the process order. It is **verifiable-here first**:
`shzs` KG-audit (11), `v7bg` Publish (16), `7ajt` narratives (1/1, wholly here),
then the six that need a folio to prove.

### And one group is mis-scoped, not just mis-counted

`w5h0` Block authoring reported 1 entry point. That one file is
`scripts/check-voices.ts` — **a voice checker, which belongs with QA and voice
review, not with block authoring.** Strip it and the group has no mechanism in
this repository at all, which is the honest answer to what
`authoring-a-paper · Task_AuthorBlocks` runs: **nothing.** Authoring a block is
an agent writing a manifest. That is judgement, and `tool-coverage`'s own tier
scheme has a name for it — tier B, a `userTask` only — except the diagram marks
it `serviceTask`. Either the diagram is wrong or the mechanism is `block-module`
used as a library by the render path. `w5h0` carries the question now instead of
assuming a node.

### These figures were re-derived after merging `main`, not carried over

First measured at 864 / 228 / 12 on the pre-merge branch. Merging 30 commits of
`main` changed them, and the guard is what said so — see the finding below.
A count carried across a merge is a count nobody checked.

## The table

Dispensation codes:

| code | meaning |
|---|---|
| **TOOL** | warrants its own Tool node — this is the list to act on |
| **IS** | already reachable as, or through, a declared Tool node |
| **GATE** | a verification gate; one `gates` Tool bound to a validation task |
| **CARRY** | the code **is** a KG node (zod carrier, content object) — already in the graph |
| **LIB** | no entry point; reachable only *behind* a Tool, never named by an agent |
| **SCRAP** | one-shot migration or codemod; archive under confirmation |
| **TEST** | verification of another row; rides with its subject |
| **HOST** | build/runtime host config; not agent-facing |

| group | files | run here | mode 755 | can't tell | dispensation | BPMN process · task | target repo (#223) |
|---|--:|--:|--:|--:|---|---|---|
| Publication & export (site, JSON-LD, previews) | 34 | 16 | 3 | 15 | **TOOL** | authoring-a-paper · Task_Publish [content-publish] | folio-assist-core (site) / agentic-harness (kg-export) |
| Lean formalisation & proof status | 33 | 0 | 16 | 17 | **TOOL** | authoring-a-paper · Task_Formalize [lean-formalization] | folio-asst-sci |
| QA sweep & witnesses | 27 | 2 | 0 | 25 | **TOOL** | content-lifecycle · Task_Test [content-test] | agentic-harness (sidecar infra) / core (checkers) |
| Translation (POT / PO / round-trip QA) | 24 | 5 | 0 | 19 | **TOOL** | human-translation-workflow · Task_ExtractPOT / Task_InjectPO / Task_RoundTripQA | folio-assist-core |
| Knowledge-graph audit & rendering | 20 | 11 | 0 | 9 | **TOOL** | review-code · Task_RunNodeAudits · Task_ReviewTool | agentic-harness |
| Content graph & dependency analysis | 19 | 1 | 0 | 18 | **TOOL** | authoring-a-paper · Task_Validate [content-validate] | folio-assist-core |
| LaTeX / PDF rendering | 16 | 0 | 3 | 13 | **TOOL** | authoring-a-paper · Task_Render [latex-authoring] | folio-asst-sci |
| Document ingestion (PDF → text → claims) | 15 | 2 | 5 | 8 | **TOOL** | ingest-extract-structure · Task_ExtractText / Task_Ocr / Task_Candidates | folio-assist-core |
| Block authoring & prose structure | 14 | 1 | 0 | 13 | **TOOL** | authoring-a-paper · Task_AuthorBlocks [content-author] | folio-assist-core |
| Schema & constraint validation | 12 | 3 | 0 | 9 | **TOOL** | authoring-a-paper · Task_Validate [content-validate] | folio-assist-core |
| Bibliography, evidence & glossary | 11 | 0 | 3 | 8 | **TOOL** | evidence-retrieval · Task_L1Sources [document-intake] | folio-assist-core |
| FHIR / IG / DAK build | 3 | 0 | 0 | 3 | **TOOL** | l3-fhir-pipeline · Task_Sushi · Task_Validate; ig-incremental-build · Task_Cone | smart-base |
| Narrative confirmation queue (human gate) | 1 | 1 | 0 | 0 | **TOOL** | editing-hci-validation · Task_SmeReview · Task_RecordDecision | folio-assist-core |
| MCP server / routing / adapters | 43 | 1 | 1 | 41 | **IS** | — (the Tool projection) | agentic-harness |
| Scaffolding & environment setup | 13 | 1 | 10 | 2 | **IS** | authoring-a-paper · Task_Scaffold; getting-started | agentic-harness |
| Work plan & session coordination | 12 | 6 | 6 | 0 | **IS** | authoring-a-paper · Task_SeedPlan [todo-manager] | agentic-harness |
| MCP Tool handlers | 12 | 0 | 0 | 12 | **IS** | — (already Tool nodes) | agentic-harness |
| BPMN engine | 8 | 0 | 0 | 8 | **IS** | — (runs every process) | agentic-harness |
| CI health, gates & upstream pins | 10 | 6 | 4 | 0 | **GATE** | code-change-review · Task_RunGates · Task_RunCI; upstream-pin-watch · Task_ReadPins | agentic-harness |
| Doc-page content objects | 133 | 0 | 0 | 133 | **CARRY** | authoring-a-document · Task_AuthorBlocks | stays — this instance's own folio |
| Schema carrier (zod → JSON Schema / JSON-LD) | 59 | 0 | 0 | 59 | **CARRY** | authoring-a-paper · Task_Validate | agentic-harness (harness/tool/role) / core (block/content) |
| Skill-adjacent code (in the kg graph) | 23 | 0 | 0 | 23 | **CARRY** | — (the graph itself) | agentic-harness |
| Translated content objects | 7 | 0 | 0 | 7 | **CARRY** | human-translation-workflow · Task_InjectPO | stays — this instance's own folio |
| Tool node declarations | 3 | 0 | 0 | 3 | **CARRY** | — (the graph itself) | every instance declares its own |
| Content-type adapters | 14 | 0 | 1 | 13 | **LIB** | authoring-a-paper · Task_AuthorBlocks | folio-assist-core |
| Shared library (no entry point) | 11 | 0 | 1 | 10 | **LIB** | — (behind every Tool) | follows its callers |
| One-shot migration / codemod | 17 | 0 | 5 | 12 | **SCRAP** | — | — |
| Tests | 242 | 1 | 1 | 240 | **TEST** | code-change-review · Task_RunGates | follows its subject |
| CI workflow glue | 20 | 0 | 1 | 19 | **HOST** | code-change-review · Task_RunGates | agentic-harness |
| Deploy / container build | 5 | 0 | 4 | 1 | **HOST** | authoring-a-paper · Task_Render | folio-asst-sci |
| Docs-site browser JS | 4 | 0 | 0 | 4 | **HOST** | authoring-a-paper · Task_Publish | agentic-harness |
| Host config | 3 | 0 | 0 | 3 | **HOST** | — | every instance |


## The finding that validates the categorisation

**Every one of the 12 TOOL groups binds to a `serviceTask` that already
exists.** Not one needed a new BPMN task invented for it.

That is the strongest evidence available that the grouping is real rather than
tidy. The owner's second sentence — *"the code needs to do something"* — is a
falsifiable test, and this is what passing it looks like: if a group of code had
had no task to serve, that code would have had no justification, and the finding
would have been "scrap it", not "give it a Tool". Measured across 216 activities
in 34 diagrams, of which 72 are `serviceTask`.

The thirteenth group is the one that arrived by merge, and it is the single best
piece of evidence on this bean: `main` added `scripts/narratives.ts` on
2026-09-19 — a numbered-selection review queue, built explicitly for the owner's
hand function, agent-facing in every respect — and **it is not a Tool node.**
`grep narrative folio-assistant/tools/*.ts` returns nothing. So this is not
historical debt being tidied; the habit is live, and it produced a new instance
of itself the day before the rule was stated. Its task exists and always did:
`editing-hci-validation · Task_SmeReview` / `Task_RecordDecision`, the human
confirmation gate.

`authoring-a-paper` alone absorbs six of the twelve — Task_Scaffold,
Task_AuthorBlocks, Task_Formalize, Task_Validate, Task_Render, Task_Publish —
which is what the owner meant by *"can be part of large general processes for
now, writing a paper"*. The remaining six land on `ingest-extract-structure`,
`human-translation-workflow`, `l3-fhir-pipeline` / `ig-incremental-build`,
`evidence-retrieval`, `content-lifecycle` and `review-code`.

## The tension in #223 worth stating rather than smoothing

Issue #223 says `agentic-harness` **"doesn't 'Do' anything"**. Yet the BPMN
engine, the MCP server, the gate runner and the work-plan code all land there by
the same issue's own descriptions, and every one of them does something.

The reading that survives: *does nothing* means **carries no subject matter**.
`agentic-harness` runs processes; it never authors content. That is a real
distinction and it is worth writing down, because the literal reading would
argue the BPMN engine out of the only repo it can live in.

## Done when

- [x] the owner picks a dispensation order (the four options are on #223; verifiable-here first executed across 27 completed child beans)
- [x] each chosen group has a Tool node whose `invoke` names one entry point (all 13 groups done across `cat-harness`, `folio-assistant-core`, `folio-assistant-sci`, `fhir-harness`, and `smart-base`, with `v7bg`'s `kg-viewer` re-pinned on `main` in `#2614`/`#2616`)
- [x] `satisfies` on each names the skill its BPMN task already refs
- [x] the 157 non-entry-point files in those groups are reachable only through it
- [x] `bun run tool-coverage` shows the group's task covered (`bun run cat tools:coverage` reports 227 tools declared across 4 instances; all 12 tool-warranted groups covered)
- [x] the 17 SCRAP files reported with sizes and ages, and **waited on** —
      never removed on an agent's own initiative
      (`deletion-requires-confirmation`; resolved in child bean `nfgo` after owner ruling on #1644)

## How this was measured, so the number can be re-derived rather than trusted

`git ls-files` filtered to `.ts .tsx .js .mjs .cjs .py .sh .bash`; every file
assigned by an ordered rule set with an **UNCATEGORISED hard failure** rather
than a catch-all bucket. It fired three times: 9 files while the rules were
being written, then 0, then **1 after merging `main`** — and that third firing
is the reason the guard is worth its cost. A catch-all bucket would have
absorbed `scripts/narratives.ts` silently and the thirteenth group would not
exist. Entry points are the union of files named by a `package.json` script (57)
and mode-755 code files (64), 121 distinct. BPMN tasks read from the 34 diagrams directly, not from prose.

**No count here should be quoted from this bean into a second place.** That is
the failure `kg:audit`'s reading rules name, and this bean is exactly the sort of
document that invites it.

---

## CROSS-VALIDATION, 2026-09-20 — and it is the strongest result on this bean

`bun run cat tools:coverage` was finally run, rather than reasoned around. It tiers
all 179 uncovered skills by BPMN evidence and reports **tier A = 28 skills**, "a
`serviceTask` names it, or it has an I/O contract. A Tool is warranted."

**Eleven of this bean's thirteen code groups map onto a tier-A skill, and those
eleven skills are uncovered.** Two independent instruments — one built over
*code* for this bean, one built over *skills* two days earlier for `ce65` —
converge:

| group | skill its BPMN task refs | tier | covered? |
|---|---|---|---|
| `v7bg` Publish | `content-publish` | **A** | no |
| `eu38` Lean | `lean-formalization`, `proof-verification` | **A** (both) | no |
| `zq4z` QA sweep | `content-test` | **A** | no |
| `oait` Content graph | `content-validate` | **A** | no |
| `jh2j` LaTeX | `latex-authoring` | **A** | no |
| `81t5` Ingestion | `document-intake` | **A** | no |
| `w5h0` Block authoring | `content-author`, `document-authoring` | **A** (both) | no |
| `9x17` Schema validation | `content-validate` | **A** | no |
| `1oqu` Bibliography | `document-intake` | **A** | no |
| `h588` FHIR | `fhir-validation`, `ig-publication`, `l3-fhir-authoring` | **A** (all) | no |
| `7ajt` Narratives | `content-review` | **A** | no |
| `pha7` Translation | `translation-extract` &c. | — | **COVERED, 5 nodes** |
| `shzs` KG audit | `kg-export` | — | **COVERED, 5 nodes** |

That convergence is worth more than either list alone. A grouping of code derived
from filenames and a tiering of skills derived from BPMN task TYPE had no
common input, and they agree on eleven rows.

### It also corrects two of the fifteen children

`pha7` and `shzs` were written as if their skills were uncovered. They are not,
and both beans now say so.

### And it names the complement, which is `ce65`'s half not this one's

Tier A holds ~17 skills with **no corresponding code group at all**:
`content-plan`, `content-review`, `content-feedback`, `bpmn-authoring`,
`dmn-authoring`, `document-structure`, `normative-statements`,
`quality-control`, `terminology-management`, `l2-dak-authoring`,
`interaction-modality`, `delivery-summary`, `feature-staging`, `prepare-merge`,
`upstream-version-adoption`, `document-publishing`.

A skill in tier A with no code is a skill whose mechanism is **inlined in its
prose** — exactly the debt `skills-and-tools` names and `ce65` exists to pay.
So the two beans are complementary halves of one surface and neither is
redundant:

- **`d308`**: code with no Tool to be reached through — 13 groups
- **`ce65`**: skills with no Tool and a mechanism in their prose — ~17 more
- **the overlap**: 11 rows where both are true, and one node fixes both

### The uncomfortable part, again

`tool-coverage.ts` has said "tier A is the list to act on" since 2026-09-18. I
hand-rolled a Python categoriser in a scratchpad to answer the adjacent question
and did not run it until the first node was already being written. The
convergence above is real; that it took this long to look is the finding about
process rather than about code.

## Also worth recording: 14 of the 28 in tier A are ALSO a `userTask`

`tool-coverage` says so itself: "for those the question is not *should this be a
Tool* but *which part of it is*. Splitting the mechanism out is the work; the
judgement stays."

`content-author` is one of them — `serviceTask, io-contract, userTask` — which is
independent confirmation of the `w5h0` correction above. Its judgement half is an
agent writing a manifest and will never be a Tool. Its mechanical half is the
render path. That is why `w5h0` carries a question rather than a node.

---

## RE-DERIVED after the `cat-harness` inversion, 2026-09-20

`main` moved the whole tree into `cat-harness/` — `wggr`'s stub inversion landed —
so every path in the table above is stale. Re-derived rather than carried, which
is this bean's own rule about counts turned on itself.

**The groupings held. Only the addresses moved.** 888 code files (was 868), 231
loose (was 229), **still 13 groups**. The categoriser needed no new rules: its
predicates key on FUNCTION, so stripping the `cat-harness/` prefix was the whole
change. That is the sharpest evidence available that the grouping is about what
code DOES rather than where it sits — a relocation that renamed every path left
the table's shape intact.

### The guard fired a fourth time, and one of the three was real

Two were my own regexes requiring a leading `/docs/` and `/translations/`, which
the prefix strip removed. The third, `cat-harness/scripts/kg-validate.ts`, is
**new from main** — a KG validation script added in the inversion, filed under the
audit family.

Four firings now, and only one was noise. A catch-all bucket would have absorbed
all four silently.

### What changed in the numbers, and why

| | before | after | why |
|---|--:|--:|---|
| code files | 868 | 888 | main added 20 |
| TOOL | 229 | 231 | `kg-validate` + one more |
| GATE | 10 | 14 | main added gates; the fast set went 38 → 43 |
| CARRY | 224 | 229 | main added schema and content nodes |
| TEST | 242 | 252 | main's new tests |

### The layout goal is substantially met

Top level is now `cat-harness/`, `beans/`, `.claude/`, `.github/`, `fsh-guts/`,
`bootstrap/`, `todos/` and a handful of config files — **4047 of ~4600 tracked
files sit under `cat-harness/`.** The owner's direction on `wggr` was *"so there
would be in top-level only bootstrap/ cat-harness/ f-a-core/ etc."*, and that is
close to done. `tools/index.ts` stays at the root deliberately: it is the overlay
barrel, and the whole reason it is there is that no consumer should bake a stub
into an import path.

## The table, re-derived

| group | files | run here | mode 755 | can't tell | dispensation | BPMN process · task | target repo (#223) |
|---|--:|--:|--:|--:|---|---|---|
| Publication & export (site, JSON-LD, previews) | 35 | 17 | 3 | 15 | **TOOL** | authoring-a-paper · Task_Publish [content-publish] | folio-assist-core (site) / agentic-harness (kg-export) |
| Lean formalisation & proof status | 33 | 0 | 16 | 17 | **TOOL** | authoring-a-paper · Task_Formalize [lean-formalization] | folio-asst-sci |
| QA sweep & witnesses | 27 | 2 | 0 | 25 | **TOOL** | content-lifecycle · Task_Test [content-test] | agentic-harness (sidecar infra) / core (checkers) |
| Translation (POT / PO / round-trip QA) | 24 | 5 | 0 | 19 | **TOOL** | human-translation-workflow · Task_ExtractPOT / Task_InjectPO / Task_RoundTripQA | folio-assist-core |
| Knowledge-graph audit & rendering | 21 | 12 | 0 | 9 | **TOOL** | review-code · Task_RunNodeAudits · Task_ReviewTool | agentic-harness |
| Content graph & dependency analysis | 19 | 1 | 0 | 18 | **TOOL** | authoring-a-paper · Task_Validate [content-validate] | folio-assist-core |
| LaTeX / PDF rendering | 16 | 0 | 3 | 13 | **TOOL** | authoring-a-paper · Task_Render [latex-authoring] | folio-asst-sci |
| Document ingestion (PDF → text → claims) | 15 | 2 | 5 | 8 | **TOOL** | ingest-extract-structure · Task_ExtractText / Task_Ocr / Task_Candidates | folio-assist-core |
| Block authoring & prose structure | 14 | 1 | 0 | 13 | **TOOL** | authoring-a-paper · Task_AuthorBlocks [content-author] | folio-assist-core |
| Schema & constraint validation | 12 | 3 | 0 | 9 | **TOOL** | authoring-a-paper · Task_Validate [content-validate] | folio-assist-core |
| Bibliography, evidence & glossary | 11 | 0 | 3 | 8 | **TOOL** | evidence-retrieval · Task_L1Sources [document-intake] | folio-assist-core |
| FHIR / IG / DAK build | 3 | 0 | 0 | 3 | **TOOL** | l3-fhir-pipeline · Task_Sushi · Task_Validate; ig-incremental-build · Task_Cone | smart-base |
| Narrative confirmation queue (human gate) | 1 | 1 | 0 | 0 | **TOOL** | editing-hci-validation · Task_SmeReview · Task_RecordDecision | folio-assist-core |
| MCP server / routing / adapters | 43 | 1 | 1 | 41 | **IS** | — (the Tool projection) | agentic-harness |
| Scaffolding & environment setup | 13 | 1 | 10 | 2 | **IS** | authoring-a-paper · Task_Scaffold; getting-started | agentic-harness |
| Work plan & session coordination | 12 | 6 | 6 | 0 | **IS** | authoring-a-paper · Task_SeedPlan [todo-manager] | agentic-harness |
| MCP Tool handlers | 12 | 0 | 0 | 12 | **IS** | — (already Tool nodes) | agentic-harness |
| BPMN engine | 8 | 0 | 0 | 8 | **IS** | — (runs every process) | agentic-harness |
| CI health, gates & upstream pins | 14 | 10 | 4 | 0 | **GATE** | code-change-review · Task_RunGates · Task_RunCI; upstream-pin-watch · Task_ReadPins | agentic-harness |
| Doc-page content objects | 133 | 0 | 0 | 133 | **CARRY** | authoring-a-document · Task_AuthorBlocks | stays — this instance's own folio |
| Schema carrier (zod → JSON Schema / JSON-LD) | 62 | 0 | 0 | 62 | **CARRY** | authoring-a-paper · Task_Validate | agentic-harness (harness/tool/role) / core (block/content) |
| Skill-adjacent code (in the kg graph) | 24 | 0 | 0 | 24 | **CARRY** | — (the graph itself) | agentic-harness |
| Translated content objects | 7 | 0 | 0 | 7 | **CARRY** | human-translation-workflow · Task_InjectPO | stays — this instance's own folio |
| Tool node declarations | 3 | 0 | 0 | 3 | **CARRY** | — (the graph itself) | every instance declares its own |
| Content-type adapters | 14 | 0 | 1 | 13 | **LIB** | authoring-a-paper · Task_AuthorBlocks | folio-assist-core |
| Shared library (no entry point) | 11 | 0 | 1 | 10 | **LIB** | — (behind every Tool) | follows its callers |
| One-shot migration / codemod | 17 | 0 | 5 | 12 | **SCRAP** | — | — |
| Tests | 252 | 1 | 1 | 250 | **TEST** | code-change-review · Task_RunGates | follows its subject |
| CI workflow glue | 20 | 0 | 1 | 19 | **HOST** | code-change-review · Task_RunGates | agentic-harness |
| Deploy / container build | 5 | 0 | 4 | 1 | **HOST** | authoring-a-paper · Task_Render | folio-asst-sci |
| Docs-site browser JS | 4 | 0 | 0 | 4 | **HOST** | authoring-a-paper · Task_Publish | agentic-harness |
| Host config | 3 | 0 | 0 | 3 | **HOST** | — | every instance |

## Progress: 7 of 13 groups have a node

`kg-graph-export`, `ns-vocabulary`, `content-context`, `schema-docs`,
`skill-docs`, `themes-css`, `avatars-css` — plus two new skills
(`covered-is-not-reachable`, `site-presentation-assets`), one new QA criterion
(`skill-is-a-stub`), and five stubs closing the unservable remote declarations.

Remaining, in verifiable-here order: `shzs` the audit family (12 run here — now
the highest), then the six that need a folio to prove.

## All 6 checkboxes met (2026-10-22)

All 28 child beans of `d308` are now closed (`27 completed`, `1 scrapped` `8t6r`), with `v7bg` (`Task_Publish`, including `cat-harness/tools/kg-viewer/kg-viewer.ts` from `cat-harness#406`) re-pinned on `folio-assistant` `main` in `#2614`/`#2616` and closed. Every chosen group has its Tool node(s) declared across `cat-harness` (175 tools), `folio-assistant-core` (33), `folio-assistant-sci` (9), `fhir-harness` (6), and `smart-base` (4), and `epic-under-epic:folio-assistant-d308` is retired from `cat-harness-tools/scripts/bean-parents-baseline.json`.


## All 6 checkboxes met (2026-10-22)

All 28 child beans of `d308` are now closed (`27 completed`, `1 scrapped` `8t6r`), with `v7bg` (`Task_Publish`, including `cat-harness/tools/kg-viewer/kg-viewer.ts` from `cat-harness#406`) re-pinned on `folio-assistant` `main` in `#2614`/`#2616` and closed. Every chosen group has its Tool node(s) declared across `cat-harness` (175 tools), `folio-assistant-core` (33), `folio-assistant-sci` (9), `fhir-harness` (6), and `smart-base` (4). Kept `status: in-progress` until `epic-under-epic:folio-assistant-d308` is removed from `cat-harness-tools/scripts/bean-parents-baseline.json` (which otherwise fails `check-bean-parents.ts` when `d308` closes).

_2026-10-24T15:05:00Z_ — Opened [`litlfred/cat-harness-tools#767`](https://github.com/litlfred/cat-harness-tools/pull/767) (`b6ed0fd`) retiring `"epic-under-epic:folio-assistant-d308"` from `cat-harness-tools/scripts/bean-parents-baseline.json` and marking `d308` `completed` in `cat-harness-tools/beans/defs/`. Ready to flip `v7bg` and `d308` to `completed` once `cat-harness-tools#767` merges and is repinned.

## Closed 2026-10-29

All done-when boxes met. cat-harness-tools#767 retired the epic-under-epic baseline entry, merged 2026-10-29. (Lane B drain thread.)


## Closed 2026-10-29

All done-when boxes met. cat-harness-tools#767 retired the epic-under-epic baseline entry, merged 2026-10-29. (Lane B drain thread.)
