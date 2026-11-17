---
# folio-assistant-81t5
$schema: bean/1.0.0
title: 'TOOL 8/13: ingest-extract-structure — document ingestion (15 files, 7 entry points)'
status: completed
type: task
priority: normal
created_at: 2026-09-20T04:34:56Z
updated_at: 2026-09-26T00:00:00Z
parent: folio-assistant-d308
---

Group 8 of 13 in `d308`. **15 files, 7 entry points.**

`pdf-extract`, `pdf-ocr`, `pdf-pages`, `pdf-structure`, `pdf-tables`,
`split-pdf-by-chapter`, `extract-candidates`, `tabular-records`,
`archive-contents`, `ingest-document`, `scan-repo-content`,
`smart-base-transform`, `_pdf_doc_id`, `_pypdf_compat`, `_tech_meta`,
`pypdf_safe`.

**BPMN:** `ingest-extract-structure · Task_ExtractText · Task_Ocr ·
Task_Candidates` — three `serviceTask`s. Also `document-ingestion` and
`ingest-derive-content`.

**Target repo (#223):** `folio-assist-core`.

**Partly done already, and that is the point:** `main` added `ingest-stdlib` and
its paired Tool on 2026-09-19 with a measured dependency posture (three installs
to reach a working image extractor: `pypdf`, then `cffi` — whose absence makes
`cryptography` panic on IMPORT under pyo3 — then `Pillow`). So this group has a
worked example of the split-by-dependency-boundary pattern IN the graph already.
This bean is the rest of it, not the start of it.

## Done when

*Superseded 2026-09-20 by the list further down that declared itself
"REPLACES both lists above", and promoted here 2026-09-21 under bean `sfhr`.
Its verdicts are the author's, unchanged; what moved is WHICH list a reader
finds first. This bean carried THREE checklists, and the authoritative one was
the one nobody consults.*

- [x] the nine broken `invoke.shell` paths fixed and gated — `jqv4`
- [x] ~~Stage B: operator-invoked, or run by `ingest-document.ts`?~~ **withdrawn**
      — optional by design; no question, no node owed
- [x] `extract-lean-blocks.py` retired to `fsh-guts/` under the owner's one-shot rule
- [x] `requires.runtime` honest about Python deps, per bean `68dt`
- [x] `extract-candidates.py` has its dispatch point already, and it is a TRIGGER —
      BPMN `Task_Candidates`, not a command. No Tool node is owed. See the second
      correction at the end of this bean: "tier C" was the wrong word for it.


---

## MEASURED 2026-09-20 — the ingest pipeline has a MISSING MIDDLE

> **⚠ BOTH FINDINGS BELOW ARE SETTLED — see the CORRECTION at the end of this
> bean before acting on either.** Finding 1 ("Stage B has no caller") is
> **withdrawn**: `candidates.json` is optional by design. Finding 2
> (`extract-lean-blocks.py`) is **decided**: retired to `fsh-guts/`. Neither is
> an open question for the owner. Kept in place because a withdrawn finding
> stops the next agent re-deriving it.

Two findings, and neither is "add a Tool node to the remaining entry points" as
this bean framed it. A third — nine broken `invoke.shell` paths, including this
bean's own two nodes — became `jqv4` and is done.

### 1 — Stage B has no caller, and Stage C requires its output  ⟵ ~~BLOCKER~~ WITHDRAWN

The pipeline as `gen-library-jsonld.ts` documents it, in its own words:

> `pdf-structure.py` produces `structure.json` + `sections/*.md`, and
> **`extract-candidates.py` produces `candidates.json`**. … `candidates.json`
> **Stage B (input)**

Measured:

| stage | mechanism | called by |
|---|---|---|
| A | `pdf-structure.py` | `ingest-document.ts` ✓ |
| **B** | `extract-candidates.py` | **nothing** — not `ingest-document.ts`, not `package.json`, not any workflow. Only its own test |
| C | `gen-library-jsonld.ts` | requires Stage B's `candidates.json` as an INPUT |

So a consumer declares an input whose only producer is reachable from nothing.
`ingest-document.ts` does not contain the string `candidate` at all.

**The question is a design one and it is the owner's:** is Stage B meant to be
**operator-invoked** between A and C — in which case it wants a Tool node and
nothing says so — or should `ingest-document.ts` run it, making the ingest
entry point produce all three artefacts? Those are different flows, and guessing
would either invent an operator step nobody asked for or change what a single
`ingest` run does.

Not decided here. What is certain is that the pipeline as declared cannot
complete in this repository without someone running Stage B by hand, and nothing
records that as the intent.

### 2 — `extract-lean-blocks.py` is a folio's content living in the platform  ⟵ DECIDED

20,662 bytes, born 2026-09-17 in the bulk import, referenced by **nothing** — not
a caller, not a test, not a workflow. And its own docstring says what it reads:

> Reads **`content/quantum-observable-universe/lean/`** source files, maps
> declarations to content blocks, and writes individual `.lean` files alongside
> their `.ts`/`.md` siblings.

That is **one named folio's path, hardcoded**, in the repository whose own
`AGENTS.md` opens with *"folio-assistant is the platform, not the content … If you
are about to write subject matter here, you are either in the wrong repo or
writing something that belongs in the folio as data."* `content/` does not exist
here at all.

So this is not a Tool-node question. It is a boundary question, and the two
answers are different acts: **move it to `litlfred/qou`**, where its subject
lives and where it might still run, or **retire it to `fsh-guts/`** as spent.
I am not moving a 20 KB script into another repository unasked, and `fsh-guts`
would be the wrong call if it is still wanted over there.

### What is NOT a finding

`pdf-extract.py` and `pdf-structure.py` are both reached — `pdf-structure` from
`ingest-document.ts` directly, `pdf-extract` through `pypdf_safe.py`,
`pdf-pages.py` and `pdf-tables.py`. This bean's criterion *"the other files in the
group reachable only through it"* is satisfied for those, which is why they get no
node of their own.

### Done when — an INTERIM list, superseded below

- [x] the nine broken `invoke.shell` paths fixed and gated — `jqv4`
- [x] ~~**Stage B: operator-invoked with a Tool node, or run by `ingest-document.ts`?**~~
      — **withdrawn**, never the owner's call: `candidates.json` is optional by
      design. Resolved in the first correction below
- [x] ~~**`extract-lean-blocks.py`: move to `litlfred/qou`, or retire to `fsh-guts`?**~~
      — **decided**: `fsh-guts`, under the owner's one-shot-migration rule.
      Resolved in the first correction below
- [x] `requires.runtime` honest about Python deps, per bean `68dt` — the two ingest
      nodes already declare it


---

## CORRECTION 2026-09-20 — the Stage B blocker was WRONG, and is withdrawn

The section above calls Stage B *"a consumer declares an input whose only producer
is reachable from nothing"* and hands it to the owner as a design question. **It is
not a defect and there is no question.** `candidates.json` is **optional by
design**, and both the code and the skill say so. I asserted the opposite from the
pipeline comment's `Stage B (input)` label without reading how the input is
consumed.

Measured, in `cat-harness/content/pipeline/gen-library-jsonld.ts`:

| line | what it says |
|---|---|
| 328 | `function readJson<T>(path: string): T \| undefined` — absence returns `undefined`, it does not throw |
| 479 | `const candidates = readJson<Candidates>(join(dir, "candidates.json"));` |
| 119 | `candidates?: Candidate[]` — optional in the type itself |
| 163, 304, 305, 308 | every read is `candidates?.… ?? null` / `?? []` |

And the one artefact that *is* required fails loudly when missing —
`if (!structure) return { state: "unreadable", rung }` — which is the contrast
that settles it: a required input is guarded, an optional one is coalesced. Stage
C runs without Stage B and emits `null` for the fields Stage B would have filled.

`library-ingestion`'s complete-L1 list **omits `candidates.json`**. Skill and code
agree with each other; only this bean disagreed with both.

So `extract-candidates.py` being called by nothing is a **tier-C reachability
observation**, the same shape as the fifteen can't-tell files — not a broken
pipeline and not an owner's call. It stays uncovered until someone wants it
operator-invoked, and no Tool node is owed.

**Why this is recorded rather than deleted:** a withdrawn finding left in place
stops the next agent re-deriving it, and the failure mode is the one this session
hit eight times — *reasoning from a mechanism's name or label instead of its
body*. The label `Stage B (input)` was accurate prose about data flow and said
nothing about requiredness.

## `extract-lean-blocks.py` — DECIDED under the owner's standing rule

No question here either. The owner's rule from earlier this session —

> if one shot migration useful as examples keep for didactic, otherwise fsh-guts

— decides it, and the answer is `fsh-guts`: ~90 % of its 20,662 bytes is one
folio's data (the block→declaration mapping table at line 206, `CH1_IMPORTS` at
line 21, `namespace='QOU'` at line 295, and a *"Blocks NOT in
QuantumObservableUniverse.lean"* list at line 277), so it teaches nothing
transferable. `git mv` to `fsh-guts/scripts/`, with
`fsh-guts/scripts/extract-lean-blocks.md` (`folio-fsh-guts/v1`) keeping the one
lesson: **a declaration's helpers travel with it** — a declaration lifted out of
a monolithic Lean file without the `private` lemmas it depends on does not
compile, and that dependency is invisible from the declaration's own text.

**Not moved to `litlfred/qou`** — that is a cross-repository act nobody asked
for, and it costs nothing to defer: the body sits beside its record, `git log
--follow` reaches the 2026-09-17 import, and a copy into the folio is one
`git show` away.

### Done when — the working list, now PROMOTED above

*Kept for its reasoning. The canonical section at the top carries these same
verdicts, so the two agree rather than contradict.*

- [x] the nine broken `invoke.shell` paths fixed and gated — `jqv4`
- [x] ~~Stage B: operator-invoked, or run by `ingest-document.ts`?~~ **withdrawn**
      — optional by design; no question, no node owed
- [x] `extract-lean-blocks.py` retired to `fsh-guts/` under the owner's one-shot rule
- [x] `requires.runtime` honest about Python deps, per bean `68dt`
- [x] `extract-candidates.py` has its dispatch point already, and it is a TRIGGER —
      BPMN `Task_Candidates`, not a command. No Tool node is owed. See the second
      correction at the end of this bean: "tier C" was the wrong word for it.


---

## CORRECTION 2026-09-26 — "tier-C reachability observation" was the wrong frame, and the mechanism is reachable

The first correction withdrew the Stage B blocker correctly — `candidates.json`
is optional by design — and then mis-filed what was left:

> So `extract-candidates.py` being called by nothing is a **tier-C reachability
> observation**, the same shape as the fifteen can't-tell files

Two errors in one sentence, and the second is the substantive one.

**`tier C` is not a name this observation can carry.** Tier A–D in
`tools:coverage` is a taxonomy of **skills** — how close a skill is to having a
Tool node that satisfies it. A callerless *script* is not a member of it at all.
So the phrase reads as a classification and denotes nothing, which is worse than
leaving the observation unclassified: a reader who goes looking for tier C finds
a table of skills and cannot tell whether the entry is missing or the frame was.

**And "called by nothing" is false once the question is asked correctly.**
Measured 2026-09-26:

| dispatch point | exists? | evidence |
|---|---|---|
| a named command (`package.json`, a Tool node) | **no** | no entry; only `who-l1-extractor.test.py` imports it |
| a **BPMN activity** | **YES** | `processes/ingest-extract-structure.bpmn:97` — `<bpmn:serviceTask id="Task_Candidates" name="Extract claim candidates">`, in the lane at `:48`, reached by `Flow_e7` from `Task_Structure` and flowing to `EndEvent_Structured` |
| a QA sweep axis | no | — |
| a schedule or watcher | no | — |

`Task_Candidates` carries `<bootstrap.processes:skill ref="document-intake" />`, so
`workflow_next` already hands an agent that skill at that step — and
`document-intake.md:199` gives the literal line to run:

```bash
python3 scripts/extract-candidates.py library/<doc-id>/
```

So the mechanism has **exactly one dispatch point and it is already built**. That
is `covered-is-not-reachable` §"Reachability is PLURAL" in its plainest form:

> the question to ask is not *which caller should this have* but: **What should be
> able to start this — and is each of those a trigger or a Tool?**

The original measurement asked the first question. A grep for callers cannot see
a trigger, because a trigger is not a call site — the process fires the step when
it is reached. This is the `vo9d` shape the skill already records, where *"the
BPMN trigger **already existed**"* and two of three proposed dispatch points were
wasted work.

**Does it also want a Tool node?** No, and the reason is the one the BPMN
documentation states about its own output:

> candidates.json holds extracted theorems and definitions. Proposals only --
> never adjudicated verdicts.

A step whose output is a proposal is a step an operator runs inside the intake
process, with the skill in hand telling them what the output may and may not be
treated as. A Tool node would make it invocable **outside** that process, which
is exactly where the proposal/verdict distinction stops being enforced by
anything. `document-intake` carries the constraint; the BPMN step carries the
skill; a bare command would carry neither.

### What this cost, and the rule it is the third instance of

Nothing, because the bean was still open — but the frame would have propagated:
`d308:377` already cites `covered-is-not-reachable` and a reader following the
citation into this bean would have found a non-existent tier.

The underlying failure is the one this bean's own first correction names, hit a
second time in the same bean: **reasoning from a mechanism's name or label
instead of its body.** The first time it was the label `Stage B (input)` read as
"required". This time it was the phrase "called by nothing", which is a claim
about *callers* being read as a claim about *reachability* — and reachability is
plural.

## Closing

Every item on the authoritative list at the top of this bean is now `[x]`. The
last one was never work: it was a verdict written as a checkbox, which is a
wording error of mine — a verdict belongs in prose where it can carry its
evidence, and an unticked box reads as outstanding work to every agent that
scans the list. Corrected in place rather than deleted, per the standing rule
that a withdrawn or re-framed finding left in place stops the next agent
re-deriving it.

No node is owed by this group. Closing.
