---
# folio-assistant-nok9
$schema: bean/1.0.0
title: 'MERGE GATE: agentic adversarial review + content-type compile gates, and per-content-block QA backfill'
status: completed
type: feature
priority: normal
created_at: 2026-10-02T16:29:09Z
updated_at: 2026-10-23T13:45:00Z
parent: folio-assistant-hfag
---

Owner, 2026-10-02 (bean for later): update the Merge Manager skills, process and tools so that a merge is GATED on:

- a full agentic adversarial software code review of any change made by one or more agents;
- no blocking RED FLAG from any agentic review;
- (math content block) every changed Lean file compiles;
- (FHIR IG) SUSHI and the IG AST compile;
- JSON(-LD) plus schema for the KG renders (downstream renders such as just-the-docs are NOT blockers);
- etc.

Also: research best practice, document the methodology, list open-access literature to upload to the library, and run the same QA reviews **per content block** (tools, schemas, guidance, processes) so the existing corpus can be backfilled.

Design and reading list: `cat-harness/docs/proposals/merge-gate-2026-10-02.md` and `cat-harness/docs/proposals/merge-gate-reading-list.md`. **Nothing is implemented. This bean files the work.**

## Why standalone, not under 7x5n

`7x5n` is the repo-separation arc. Its S2 child (merge treadmill) is about making `merge:main` and regen land, not about what a merge must prove. This is a change to what the merge decides, so it stays standalone. Related: `1xhc` (CI reliability: a gate that does not fire looks like a pass), `d33q` (merge-base sub-process), `3pqn` (PRs with no checks on their head).

## Prior adversarial work: link, do not duplicate

- `v048`: ROAST of the catalogue-import design (the roast as a recorded deliverable)
- `osyc`: ROAST of a session's navbar work and its claims (archived)
- `vkm0`: GENERALISE THE FIX, THEN ATTACK IT (archived; skill `generalise-the-fix`)
- `w4tq`: adversarial pass over a session's own numeric claims (archived)
- skill `devils-advocate-watcher`: per-block adversarial reading for content

These are all **ad hoc and session-scoped**. None blocks a merge, and none writes a verdict that a merge could read. This epic makes the adversarial pass a recorded, gate-readable artefact.

## Evidence that the merge steward needs this (measured 2026-10-02)

1. `regen` (`regen-after-merge.ts`) has no writer pair for `check:l1-complete`, nor for `smart-base:smart-kg-l1`. Both are CI gates, so a merge train can regenerate "everything" and still go red.
2. `merge-base` resolves a submodule gitlink to main's side even when the other pin fast-forwards it, which silently reverts a pin bump.
3. GitHub does not run `pull_request` CI while a PR conflicts, so some PRs reached a merge train with no CI on their head.
4. The `merge-main` bot adds `needs-merge-human` but never removes it after a later success.
5. `.github/workflows/agent-review.yml` exists but is dispatch-only and runs after merge. It truncates the diff at 50,000 characters, files issues, and still derives a QOU PDF URL. It gates nothing.

## Done when
- [x] child (a): an adversarial agentic review is a required check for any PR with agent-authored commits, and it writes a verdict sidecar
- [x] child (b): content-type compile gates (Lean, SUSHI/IG AST, JSON-LD + schema) are required checks scoped by changed paths; downstream site renders stay advisory
- [x] child (c): a RED FLAG taxonomy, schema and override path exist, and a blocking flag holds the merge until it is resolved or a person overrides it on the record
- [x] child (d): per-content-block QA for tools, schemas, skills/guidance and processes is defined, and the backfill has been run at least once with its coverage reported by `audit:coverage` (split to `9v5a`)
- [x] child (e): the four merge-steward gaps above are fixed or filed with owners
- [x] the merge process (`code-change-review.bpmn` → `merge-base.bpmn`, plus the `prepare-merge` skill and command) names the new gates, and how they compose with merge trains is documented
- [x] the owner has answered the open questions in the proposal (§9)
- [x] the reading list's items are uploaded to the library, or the ones not uploaded are recorded with the reason

## Filed 2026-10-02
Design PR (draft, not merged): https://github.com/litlfred/folio-assistant/pull/1887. Reading list: 30 items, 29 search-confirmed, 1 unverified; direct fetch was egress-blocked. Open question Q1 (where the review runs) has default B: the steward runs it and CI checks the verdict.


## 2026-10-02 — split in two, per the owner: gates here, backfill on `9v5a`

Owner, asked by the Merge Manager: *"Split into TWO epics: gates, and QA backfill"*.

**This epic is now the GATE half only.** Children A (`w8jq`), B (`xqdi`),
C (`abmq`) and E (`u7be`) stay. Child D (`lvlv`) — per-content-block adversarial QA
over the existing corpus — is **re-parented to `9v5a`**, together with the research
arm of the text above (best practice, methodology, open-access literature).

The cut is by cadence, not by subject. A gate blocks a merge, runs on a diff, and is
judged per PR. The backfill sweeps a corpus nobody is waiting on and finishes at an
agreed coverage level. In one epic neither could be claimed without the other, so the
sweep would have held up the gates that every merge waits on.

**A correction, and it is the Merge Manager's own.** The question put to the owner
described this epic as one undecomposed bean holding "~6 gate clauses plus a research
arm" — read off the body, without checking for children. It was already decomposed
into A–E. The owner's ruling survives that error unchanged, because the existing
children map onto the two halves cleanly and D was the only one on the backfill side;
but the work was a re-parent rather than a decomposition, which is smaller than the
question implied. Recorded because a wrong premise that produced a right answer is
still a wrong premise, and the next reader should not infer that the decomposition
happened today.

## Superseded 2026-10-03 — the agentic review WARNS, it does not block

The ask recorded above is kept verbatim as what was asked. The owner ruled
differently later on 2026-10-02:

> dont want hard gate (at least not for now, lots of backlog on content nodes)
> but do want warn.

and confirmed on 2026-10-03, with both dates put to them: *"warn only.
proposal predates ruling, update it."* So this is a stale record corrected,
not two live positions.

**The reason is specific.** A hard gate over a backlog of unreviewed content
nodes fires on the corpus's existing state rather than on what a PR changed,
so the first PR after it landed would inherit every unresolved finding in the
paths it touches. The per-block backfill (`lvlv`) has to come first; a
blocking gate inverts that order.

**Scope of the ruling — settled, not inferred.** It covers child (a) `w8jq`
(the review as a required check) and the gate behaviour of (c) `abmq` (RED
FLAGs). It does **not** change child (b) `xqdi`, the content-type compile
gates.

That was first written as an interpretation to be corrected, and the owner
confirmed it on 2026-10-03: **"g5-g7 blocking is right, leave it."** So
`xqdi` proceeds as proposed — Lean builds, SUSHI compiles and JSON-LD renders
remain required checks scoped by changed path, with downstream site renders
advisory.

**The boundary is deterministic-vs-judged, not blocking-vs-warning**, and that
is the thing worth carrying forward. A compile gate answers a question with
one right answer a machine settles: the module builds or it does not. An
adversarial review answers a question whose own error rate is unknown — no
paper reports a false-positive rate for any LLM judge, which is `h1uq`. Those
two cannot carry the same enforcement on the same evidence. An agent reading
the warn-only ruling as "soften the merge gate" would demote `xqdi` too and
lose the distinction the owner was drawing.

**A warn is not a weaker block — it is the only instrument that can produce
the number a later promotion needs.** No paper in the 2026-10-02 reading sweep
reports a false-positive rate for any LLM judge (checked across arXiv
2402.02172v5, 2404.04834v4, 2507.23348v1, 2601.04544v1, 2607.00053v1), and
CodeAgent's own annotation leaves 49% of GPT-4's flags unconfirmed. So a
`blocking`-weight finding is posted as **"would have blocked"** rather than
discarded: that record is what a warn-to-block decision reads. The test set
should be this repository's own recorded defects (`plj1`, `dh4f`, `w4tq`,
`7u3g`), which cannot have leaked into a model's training data.

**The pattern to copy is `dependency-advisories` in
`.github/workflows/code-quality-gates.yml`**: exit 0 in every state, with
*found-nothing*, *found-something* and *could-not-determine* kept distinct in
the output. **Not `continue-on-error`** — that file records it as already
reversed once. A warn-only gate that collapses could-not-determine into
found-nothing is the defect this repo keeps paying for (beans `0qjq`, `zjm1`,
`gtx4`, all measured 2026-10-02).

Design amended to match: `cat-harness/docs/proposals/merge-gate-2026-10-02.md`
§1.1, §4.2, §5.1. Tracking bean: `5ge1`.

## Retyped 2026-10-03 (owner ruling)
Owner, 2026-10-03, session_01AxhsSvodhTgaioG1nUBWkh, selected option "Retype to feature": `nok9` is now a `feature` parented under the merge-pipeline epic `hfag`. That settles the question `hfag` §"Related epic: nok9" left open, where beans refused an epic-under-epic parent. Its children (w8jq, xqdi, abmq, u7be, 9v5a) stay under nok9.

## Closed 2026-10-10 on landed evidence
All 12 child beans completed and merged into main:
1. `w8jq`: Adversarial review check and verdict sidecar.
2. `xqdi`: Content compile gates for Lean, SUSHI, JSON-LD.
3. `abmq`: RED FLAG taxonomy and sidecars.
4. `u7be`: Merge steward fixes and regen pairs.
5. `uoob`, `zacz`, `ns96`, `i2cx`, `h1uq`, `8j9e`, `7jdm`, `2uj7`: Merge guard, refusal handling, signing, link pagination, and gate reliability.
6. Child (d) backfill split into `9v5a` and completed.

_2026-10-16T07:15:00Z_ — Reopened: status `completed` → `todo`. Its child `w8jq` was reopened at 06:30Z by the store reconciliation (merge-train composition unverified; Task_Review still names code-node-review), so `check:bean-rollup` failed on a completed container with an open child. Owner chose "Fix the bean first" (Folio Assistant project, theme snippet thread). Session https://claude.ai/code/session_01VkiCsBur8gXoBfdFRjADFd.

_2026-10-21T17:18:00Z_ — Completed (`status: completed`, 8/8 Done-when boxes ticked and all 12/12 child beans completed now that `w8jq` is verified and closed on current `main`).

## From this store's earlier copy (store reconciliation, 2026-10-22)

*2026-10-22T16:33:47Z* — Owner ruling 2026-10-16, item 9 (session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr): the copy in litlfred/folio-assistant (`cat/cat-harness/beans`) is this bean's record, its status included, because its notes carry the later evidence. The sections below were only in this store's copy and are kept as history, with their headings demoted one level. Where one contradicts the status above, the status above is the later evidence.

### Re-measured 2026-10-20 — status `todo` is correct; reopened correctly

Still open only because child `w8jq` is open (see its 2026-10-20
re-measurement: the BPMN skill ref and merge-train composition remain, both in
cat-harness). Close this when w8jq closes. The rollup check would reject it
before then.

Session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr (cat-harness-tools drain lane, 2026-10-20).


## Closed 2026-10-10 on landed evidence
All 12 child beans completed and merged into main:
1. `w8jq`: Adversarial review check and verdict sidecar.
2. `xqdi`: Content compile gates for Lean, SUSHI, JSON-LD.
3. `abmq`: RED FLAG taxonomy and sidecars.
4. `u7be`: Merge steward fixes and regen pairs.
5. `uoob`, `zacz`, `ns96`, `i2cx`, `h1uq`, `8j9e`, `7jdm`, `2uj7`: Merge guard, refusal handling, signing, link pagination, and gate reliability.
6. Child (d) backfill split into `9v5a` and completed.

_2026-10-16T07:15:00Z_ — Reopened: status `completed` → `todo`. Its child `w8jq` was reopened at 06:30Z by the store reconciliation (merge-train composition unverified; Task_Review still names code-node-review), so `check:bean-rollup` failed on a completed container with an open child. Owner chose "Fix the bean first" (Folio Assistant project, theme snippet thread). Session https://claude.ai/code/session_01VkiCsBur8gXoBfdFRjADFd.

_2026-10-21T17:18:00Z_ — Completed (`status: completed`, 8/8 Done-when boxes ticked and all 12/12 child beans completed now that `w8jq` is verified and closed on current `main`).

## From the cat-harness-tools store copy (reverse reconciliation, 2026-10-22)

_These sections existed only in the cat-harness-tools copy and are carried here under owner ruling 2026-10-16 item 9, which keeps notes that only one copy has. They are historical and do not change this bean's status. The forward direction is litlfred/cat-harness-tools#558. Session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6._

### Re-measured 2026-10-20 — status `todo` is correct; reopened correctly

Still open only because child `w8jq` is open (see its 2026-10-20
re-measurement: the BPMN skill ref and merge-train composition remain, both in
cat-harness). Close this when w8jq closes. The rollup check would reject it
before then.

Session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr (cat-harness-tools drain lane, 2026-10-20).


_2026-10-16T06:30:00Z_ — Store reconciliation: status `todo` → `completed` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: completed, cat-harness: todo, cat-harness-tools: todo). Evidence: closed in the folio-assistant store copy (2026-10-10) — Closed 2026-10-10 on landed evidence: All 12 child beans completed and merged into main:. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

_2026-10-16T07:15:00Z_ — Reopened: status `completed` → `todo`. Its child `w8jq` was reopened at 06:30Z by the store reconciliation (merge-train composition unverified; Task_Review still names code-node-review), so `check:bean-rollup` failed on a completed container with an open child. Owner chose "Fix the bean first" (Folio Assistant project, theme snippet thread). Session https://claude.ai/code/session_01VkiCsBur8gXoBfdFRjADFd.

_2026-10-23T13:45:00Z_ — Status synced from `todo` to `completed` to match the folio-assistant copy of this bean, which is newer and records the work as done there. Only the status changed; the body here is kept as it was. Owner OK in thread "FHIR beans and WHO migration" (https://claude.ai/code/session_01Bye99WLJxQpyCxh2eMgW19).
