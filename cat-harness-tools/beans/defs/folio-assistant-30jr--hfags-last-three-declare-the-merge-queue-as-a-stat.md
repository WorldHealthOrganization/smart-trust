---
# folio-assistant-30jr
$schema: bean/1.0.0
title: 'hfag''s last three: declare the merge queue as a state graph, give it a viewer and tile, and record a train run'
status: completed
type: task
priority: normal
created_at: 2026-10-03T07:25:27Z
updated_at: 2026-10-21T17:26:00Z
parent: folio-assistant-hfag
---

## Brief

Owner, 2026-10-03: *"do the three open hfag items"*, then — when the tile turned out to be
blocked on an integrity constraint rather than on effort — *"1"* (ship the other two, leave
it open) *"and 3"* (surface the queue in the bean store rather than leaving it invisible).

## What landed

**The queue is a declared `state` graph.** Kind `merge-queue` in the registry — `holds: "state"`
by the one question `content-context-and-state-graphs` asks (a running process WRITES it),
`recordsWork: true` because a held entry is open work, and its validator wired to the SAME
export the steward's tooling imports so the kind and the writer cannot drift. Declared in
`beans/beans.json` at `beans/queue/`, beside `workflows/`: this holds the DECISIONS, a
finished run next door holds the EVIDENCE they met.

Both clauses of that box were verified by RUNNING the schema, not by reading it: an override
with no `reason` is rejected, and an entry carrying a GitHub fact is refused by name with the
rule as its message.

**Merge train 6 is recorded** as `beans/workflows/merge-train--train-6.json` — retroactively,
saying so as its first line, following `code-change-review--consolidation-956`. Every entry is
re-derivable from git log and the GitHub API. All 14 node ids verified to exist in
`merge-train.bpmn`; `Task_Bisect`, `Task_Eject`, `Call_EjectHandBack` and `Task_RetryFlaky`
were never reached and hold no token.

Its finding, derived from the check-runs API rather than recalled: **five of eight members
were RED at their own heads and the train landed green.** The reds were generated-file
staleness, which the single regenerate repairs; two were `cleanup` alone; #1928 carried only
THREE check runs. A per-member gate would have refused five admissible pull requests — which
is the premise of the whole train mechanism, now visible rather than asserted.

**The queue is surfaced** (owner's option 3): `beans/queue/README.md` documents the graph, and
`beans/README.md`'s subgraph index now lists `queue/` and links to it. Measured first: the
index skips a directory with no visible file, which is why an empty declared directory was
invisible to a reader of the bean store.

## What is open, and exactly what unblocks it

The harness tile. Not effort — an integrity constraint:

1. a tile links only to a page that EXISTS (`harness-tiles`: *a candidate with no page is
   reported, never linked*);
2. that page comes from `state-visualizer`, which renders one dashboard per INSTANCE-declared
   state directory;
3. declaring `beans/queue/` at instance level fails `check:kind-validators` —
   *"EXAMINED NOTHING — merge-queue declares nodeSchemas and no node was found"*.

That finding is TRUE. Measured: every other instance-declared graph has nodes (surveys 2,
notes 11, todos 5, issue-marks 3, interaction 2, memory 47). There is no precedent for an
empty one.

**It unblocks the moment a steward records one real queue entry.** Two ways NOT taken, and
the reasons are the point: seeding a fabricated decision would put a record into the graph
every later reader would take as real, and swapping `nodeSchemas` for a plain `validator`
would silence a correct finding by describing the kind LESS accurately — entries carry
`$schema: folio-merge-queue-entry/v1`, so `nodeSchemas` is the accurate shape.

## Follow-up this surfaced

`TrainMemberEvidenceSchema` is the declared shape for a finished run's per-member evidence,
and `InstanceState` has no field to carry it. The train-6 evidence therefore sits in
`history[].note` as prose — the existing store and schema the box asked for, but not
machine-readable and not checkable by any gate. Recorded here rather than fixed by inventing
an undeclared key.

## Done when
- [x] `merge-queue` declared as a `state` graph, with its validator and its home
- [x] an override with no reason rejected, and GitHub facts refused by name — both run, not read
- [x] merge train 6 recorded as a workflow instance, every node id verified
- [x] the queue surfaced in the bean store's own index
- [x] the harness tile — no longer blocked on an entry (42 real ones since 2026-10-04, below); drawn by litlfred/cat-harness-tools#469 (replacing draft #447) + litlfred/cat-harness#364, merged and re-pinned into the index via folio-assistant#2611 (`674a1b8113`)
- [x] `TrainMemberEvidenceSchema` given a home on `InstanceState`, or a stated reason not to — stated reason not to, below (2026-10-20)


## Incoming insight from an open PR, 2026-10-03 — #2000 `merge-guard`

Watching the other open PRs while this one's CI ran turned up one adjacency worth
recording, and the measured part is small, so it is separated from the inference.

**Measured.** #2000 (`merge-guard`: "`merge:guard` is the single way a steward lands
a PR", bean `dqir`) currently contains exactly ONE file, its own bean, and that
bean's checklist carries:

    - [ ] merge-queue skill: merges go only through merge:guard; skill:register

So #2000 will edit the same `merge-queue` skill this PR registered. That is a known
future conflict in a known place, not a surprise to be discovered at merge time.

**Inferred, and flagged as inference.** #2000 looks like the natural site of the
FIRST REAL QUEUE ENTRY, because a tool that is the single way a steward lands a PR
is a tool that makes steward decisions. If so it unblocks this bean's one open box
on its own. But #2000 has no code yet, so this is read off its framing rather than
demonstrated by it, and nothing here should be planned on it.

**Why it matters to the open box.** The tile is blocked on
`check:kind-validators` refusing an instance-declared `beans/queue/` with
"EXAMINED NOTHING — merge-queue declares nodeSchemas and no node was found". The
second main merge of this PR regenerated `audit-coverage` and it now reports the
same gap from the other direction, independently:

    {"kind": "merge-queue", "state": "no-directory",
     "directories": [], "criteria": [], "subjectKinds": [], "gates": [],
     "typed": true, "hasFiles": false}

Typed, and judged by nothing: zero kg-audit criteria, zero declaring gates. By the
audit-coverage skill's own rule `typed-only` is ALREADY a finding, and
`no-directory` is weaker still. Two independent instruments, one gap — which is
what makes it a real finding rather than one gate's opinion.

Not fixed here. Giving `merge-queue` criteria and a declaring gate is new work with
its own decisions, and the box stays open and honest per the owner's 2026-10-03
ruling.

## Correction, 2026-10-03: `no-directory` is NOT a gap, and I said twice that it was

Earlier the same day I wrote — in a commit on this PR and in the section above —
that audit-coverage reporting `merge-queue` as

    {"kind": "merge-queue", "state": "no-directory", "criteria": [], "gates": [],
     "typed": true, "hasFiles": false}

was "a real gap", and that `no-directory` is "a weaker state than `typed-only`".
**Both claims are wrong**, and the skill that owns the report says so explicitly:

> | `no-directory` | no instance declares one of this kind | `bean-defs`, declared
> inside `beans/beans.json`, reached through its parent — and carrying 8 gates |
>
> `bean-defs` is why the first state is not a gap: it has coverage and no
> instance-declared directory.

`bean-defs` is the SAME SHAPE as `merge-queue` — declared inside `beans/beans.json`,
reached through its parent. The state says WHERE a kind is declared, not whether
anything judges it. I inferred severity from a state name instead of reading the
table that defines it.

What is true is the part that sat next to the error: `bean-defs` carries **8
gates**, `merge-queue` carries **0 criteria and 0 gates**. The emptiness of the
coverage is the finding. The state name never was.

## And that gap cannot honestly be closed yet

Giving `merge-queue` criteria now would mean a validator over zero nodes, which the
same skill forbids by name:

> **A validator over the nodes nobody produces is not coverage.**

`check-harness-state.ts` is where such a family would go — it declares
`@covers health, todos, interaction, issue-marks` and carries one family per kind —
and adding a fifth over an empty kind reproduces the `check:kind-validators`
refusal that already blocks the tile: *"EXAMINED NOTHING"*.

So this is not deferred for effort. **The precondition is the same first real queue
entry the tile waits on**, and until a steward records one there is nothing for a
criterion to have an opinion about. Both boxes unblock together, from one event.

## 2026-10-20: the entry precondition is met, and the tile is in review

**Measured: the queue is no longer empty.** `beans/queue/` holds **42 entries**, every one
a real steward decision (session `019gRX6w`, `decidedAt` from 2026-10-04T13:50Z to
19:30Z, made during the owner's 2026-10-04 *"review all open PRs"* pass). All 42 parse
against `MergeQueueEntrySchema`, with 0 skipped. `beans.nodeSchemas` has routed
`folio-merge-queue-entry/v1` since the first of them turned `require-all` red (see the
registry comment). So "it unblocks the moment a steward records one real queue entry" has
been true since 2026-10-04, and no entry needed writing to unblock it.

**No new entry was written for the owner's 2026-10-20 09:12Z decision** (merge
cat-harness-tools#411 and its 11 caller PRs when green within three hours of
folio-assistant#2600 landing, with #411 held on #2600). The schema cannot record that
decision without inventing parts of it:
- `placement` is required, and the decision has no DMN rule run and no owner-named
  position;
- `hold.expires` is required, and the decision's expiry depends on #2600, which has not
  landed;
- `release` needs a `releasedSha` and the owner's verbatim words with a source URL, and
  "merge when green" names neither.

A record with a made-up placement or expiry is exactly the fabricated decision this bean
refused to seed.

**The tile.** Bean `750a` (cat-harness-tools#351 + cat-harness#295) had since made the
bean store's own page the viewer for the store's parts, nested under `beans` rather than
an instance-level directory of their own. That removes the original obstacle
(instance-level `beans/queue/` → EXAMINED NOTHING) by a route that needs no new
declaration. `merge-queue` was the one part of the store still missing from that page:
- draft **litlfred/cat-harness-tools#447** (issue #443) adds it to `BEAN_STORE_KINDS` and
  draws a "Merge queue" section with decisions only, each row linking its PR so GitHub's
  live facts stay on GitHub;
- draft **litlfred/cat-harness#364** (issue #360) declares it on the `beans` visualiser's
  `coversKinds` and in `state-viewer`'s `renders`.

Run against this store, the section shows 42 decisions and 0 unreadable.
`check:visualiser-routes` is green with both branches checked out. Not done until both
land and the index re-pins.

Still not met, and stated rather than claimed: `hfag`'s wording asks for decisions
*"joined with live GitHub facts at render time"*. The page links to those facts. It does
not fetch them in the browser.

## 2026-10-20: why `InstanceState` does not get a `TrainMemberEvidence` field (yet)

Decided from the code, and not added:

1. **`InstanceState` belongs to the generic token machine** (`cat-harness-tools`
   `src/workflow/instance.ts`). Every process's instance uses it: CRDM, editing,
   ingestion, merge train. `TrainMemberEvidence` belongs to one process,
   `Process_MergeTrain`. A top-level field would make the engine's type carry one
   process's domain.
2. **A field would not make the evidence checkable**, and checkability is the gap this
   bean named. `workflow-state`'s and `beans`' `nodeSchemas` entries for
   `folio-workflow-instance/v1` are `shape: …#InstanceState`, which is a TypeScript
   interface that is typed and never parsed. An optional key on it is still read by no
   gate.
3. **Nothing would write it.** `TrainMemberEvidenceSchema` is imported nowhere but its
   own module (grep, 2026-10-20). Neither recorded run (`merge-train--train-6`,
   `mergetrain--merge-train-2026-10-04a`) can be backfilled honestly, because a snapshot
   taken now would carry today's `observedAt`, not what the steward saw when it acted.
   A field over nodes nobody produces is the same mistake as "a validator over the nodes
   nobody produces".

**What would make it right**, for whoever builds the train tooling's evidence writer:
- carry it on the `HistoryEntry` of the step that observed it (its `at` is the
  observation time), not on the instance;
- tag it with its schema, so the engine stays process-agnostic;
- make `folio-workflow-instance/v1` a parsed family, so a gate can actually check it.

Until such a writer exists, the evidence stays as prose in `history[].note`, which is
honest about what it is.

_2026-10-21T17:26:00Z_ — Completed (`status: completed`, 6/6 Done-when boxes ticked): `litlfred/cat-harness#364` and `litlfred/cat-harness-tools#469` (replacing draft `#447`) merged and re-pinned into `folio-assistant` `main` (`674a1b8113`, PR `#2611`). Verified `check:visualiser-routes` passes (`42 declared visualiser(s), 471 page(s) — one route each, every page inside its Tool's routes`) and `cat-harness-tools/scripts/state-visualizer.ts` renders the `merge-queue` section.
