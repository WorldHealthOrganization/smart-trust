---
# folio-assistant-w5h0
$schema: bean/1.0.0
title: 'TOOL 9/13: Task_AuthorBlocks — block authoring & prose structure (14 files, 1 entry point)'
status: scrapped
type: task
priority: low
created_at: 2026-09-20T04:34:56Z
updated_at: 2026-09-25T17:34:06Z
parent: folio-assistant-d308
---

Group 9 of 13 in `d308`. **14 files, 1 entry point.**

`render-markdown`, `markdown-ast`, `block-module`, `front-matter`,
`build-foreshadows`, `generate-index`, `readme-toc`, `section-story-audit`,
`audit-status-sections`, `extract-status-sections`, `find-dangling-remarks`,
`conditional-class-banner-audit`, `language-trap-audit`, `check-voices`.

**BPMN:** `authoring-a-paper · Task_AuthorBlocks` (`serviceTask`, refs
`content-author`) and `authoring-a-document · Task_AuthorBlocks` (refs
`document-authoring`) — two skills, one Tool, which is legitimate and is what
`satisfies` being an array is for.

**Target repo (#223):** `folio-assist-core`. The 14 `adapters/` files (LIB) sit
behind it.

## Done when
- [ ] a Tool node over the block authoring path
- [ ] `satisfies` names BOTH `content-author` and `document-authoring`
- [ ] the paper/document adapter split preserved — `adapterForKind` stays total
- [ ] `tool-coverage` reflects it

---

## CORRECTED 2026-09-20, before any node was written

**"1 entry point" was wrong twice over.** See `d308`'s CORRECTION section.

That one file is `scripts/check-voices.ts` — **a voice checker.** It belongs with
QA and voice review (`voice-review · Task_MechanicalHalf`), not with block
authoring. It landed here because the categoriser's rule for this group matched
`check-voices` on prose-structure grounds, which was a rule bug, not a finding.

Strip it and **this group has no mechanism in this repository at all.** The other
13 files are library modules invoked from a folio's `package.json`, which cannot
be read from here.

## So the question this bean now carries, instead of a node it assumed

`authoring-a-paper · Task_AuthorBlocks` is marked `serviceTask` — automated. But
authoring a block is **an agent writing a manifest**, which is judgement.
`tool-coverage`'s own tier scheme has a name for that: tier B, a `userTask` only.

Three possibilities, and they are not equally likely:

1. **The diagram is wrong** and `Task_AuthorBlocks` should be a `userTask` or an
   agent task. Then this group needs no Tool node and the row is a
   mis-classification in `d308`, not work.
2. **The mechanism is `block-module` used as a library** by the render path, in
   which case its Tool node is the RENDER node (`jh2j`) and this row folds into
   that one.
3. **A folio provides the command** and the platform genuinely cannot see it, in
   which case the node is authored here and verified in a folio — the same
   posture as `h588`.

**Do not write a node for this group until that is settled.** A Tool whose
`invoke` pointed at `check-voices` would be a node asserting that authoring a
block is checking a voice, which is false and would be published in the graph.

## Done when — REPLACES the list above

- [ ] `check-voices` re-filed under voice/QA in the categoriser, and `d308`'s
      counts re-derived after
- [ ] which of the three possibilities holds, established from the diagram and
      from a folio's own `package.json` — not inferred from here
- [ ] if (1): the diagram corrected and this row reclassified in `d308`
- [ ] if (2): folded into `jh2j` and this bean scrapped with its reasons
- [ ] if (3): a node authored here with its verification posture stated on it


---

## SCRAPPED 2026-09-25 — nodeless by the owner's decision, and two of three refuted

Owner, asked which of this bean's three possibilities holds:
**"Record it nodeless; note what a folio owes."**

Two of the three were refuted by measurement first, so the question put to the
owner was narrower than the one above.

### Possibility 1 — "the diagram is wrong" — REFUTED

`Task_AuthorBlocks` being a `serviceTask` is not a drafting error.
`content-author` is named by **five activities across four diagrams in three
element types**:

| diagram | element | type |
|---|---|---|
| `authoring-a-paper.bpmn:106` | `Task_AuthorBlocks` | `serviceTask` |
| `editing-hci-validation.bpmn` | `Task_DraftEdit`, `Task_ReviseEdit` | `serviceTask` |
| `evidence-retrieval.bpmn` | `Task_FramePico`, `Task_AttachEvidence` | **`userTask`** |
| `content-lifecycle.bpmn`, `draft-to-publication.bpmn` | `CallActivity_Editing` | `callActivity` |

So the corpus **already** says this skill is agent-performed in some lanes and
person-performed in others. That is the *one mechanism, several dispatch points*
pattern the owner has now ruled on twice (`vo9d`: **"1 2 3 are all triggers"**,
then **"all for triggers or tools as appropriate"**), written up in
`covered-is-not-reachable` §"Reachability is PLURAL". Re-asking it would be the
failure that skill exists to stop.

### Possibility 2 — "fold into `jh2j`, the render node owns `block-module`" — REFUTED

`block-module` is imported by at least **eight** modules — `schemas/jsonld.ts`,
`gen-block-jsonld`, `qa-utils`, `graph-index`, `verify-block-walk`,
`conditional-class-banner-audit`, `conjectural-propagation-audit`, and itself's
consumers. It is a shared library across the whole pipeline, not render-path
specific. Folding this row into `jh2j` would file a general library under one of
its many consumers.

### Possibility 3 — the residue, and why it closes rather than opens work

This group has **no entry point in this repository at all**. 13 of its 14 files
are libraries; the 14th, `check-voices.ts`, was a categoriser bug and has since
been re-filed into core with a recorded reason (*"its subject is content"*). A
Tool node needs an `invoke`, and the command that authors a block lives in a
folio's `package.json`, which the platform cannot read.

`d308` asks which platform code is unreachable. **This group's answer is that
none of it is a command** — the libraries are reached through their consumers,
which is the same criterion that already exempted `pdf-extract` and
`pdf-structure` in `81t5`. So the row is satisfied, not outstanding.

### What a folio owes, recorded where an agent will hit it

`UNCOVERED_BY_DESIGN` in `cat-harness/scripts/tool-coverage.ts`. `content-author`
and `document-authoring` now annotate in the tier-A listing as
`← by design (folio-mechanism)`, alongside `content-publish` (bean `v7bg`).

The annotation is on the **row**, not in a footnote, because the failure it fixes
is an agent reading tier A top to bottom and treating every line as work. And
every entry must match a skill that is *currently* uncovered and tier A, or the
run fails — `staleAnnotations`, enforced by
`tool-coverage-uncovered-by-design.test.ts` (11 tests), because
`tools:coverage` is a report in no workflow and its own exit code reaches only a
person who runs it. An annotation reading "do not bother" over work that has
since become real is worse than none, because it is believed.

`contract-unsatisfied` is the table's second state and is **deliberately
empty**: `latex-authoring` and `proof-verification` are its candidates per
`jh2j` — *"an authoring skill's contract names the artefact being created; the
corpus has checking mechanisms"* — but the owner ruled on `folio-mechanism`
only, and a declaration is not the place to settle a second question quietly. A
test asserts it is still empty, so populating it is a decision somebody takes on
purpose.

### Done when — all settled

- [x] `check-voices` re-filed — done elsewhere, with a recorded reason
- [x] which of the three possibilities holds — (3), with 1 and 2 refuted by measurement
- [x] ~~if (1): the diagram corrected~~ — refuted; the diagram is right
- [x] ~~if (2): folded into `jh2j`~~ — refuted; `block-module` is a shared library
- [x] (3): recorded nodeless, and what a folio owes is declared in `UNCOVERED_BY_DESIGN`

**Scrapped rather than completed**, and rather than deleted: no Tool node was
authored, so calling it complete would misreport what happened — while deleting
it would leave the next agent unable to tell a decided dead end from an
abandoned one, and `d308`'s table still names this row.
