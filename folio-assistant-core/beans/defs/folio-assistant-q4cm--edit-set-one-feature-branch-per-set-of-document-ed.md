---
# folio-assistant-q4cm
$schema: bean/1.0.0
title: 'EDIT SET: one feature branch per set of document edits, reviewed in review/ — and a tool where accept is a GitHub PR approval that gates publishing'
status: completed
type: task
priority: normal
created_at: 2026-09-22T21:02:55Z
updated_at: 2026-10-07T17:48:00Z
parent: folio-assistant-q4jm
blocked_by:
    - folio-assistant-txut
---

Owner, 2026-09-22: *"skill feature branch for set of document edits, uses
visuakizer. tool, github/git cli for accept=approve for publishing"*.

**The unit of review is an EDIT SET**: one feature branch holding one coherent
set of document edits. It gets a staging build, a ChangeSet (child 02) and a
review/ page (child 04). The branch is what gets accepted or not. An
individual block edit is not.

**Skill: `edit-set`**, in folio-assistant-core/skills/review/:
- open a branch per edit set, with a naming convention the review page can
  parse;
- keep it rebased or merged on `main` so the ChangeSet stays against the
  current base;
- hand the reviewer the review/ link, not a list of URLs;
- say what "done editing" means. This extends `feature-staging` rather than
  duplicating it.

**Tool: `edit_set_accept`**, a Tool node bound to a BPMN task in child 10's
diagram, implemented over the git and GitHub CLI:
- **accept = a GitHub PR review with state APPROVE**, by a person in the
  `editor` lane. roles.json: a `reviewer` judges but **cannot accept**, and
  the tool must refuse a reviewer-lane caller rather than trust the UI.
- request-changes and comment map to the other two review states. Comments
  anchored to blocks are child 08.
- **Approval gates publishing; it does not perform it.** Merge-to-main
  remains the existing explicit-confirmation step (crdm-requirements-workflow
  §Phase 6; qou requires /prepare-merge plus "merge it"). The tool reports
  "approved, ready to publish" and stops there.

**What this settles in child 08.** The ACCEPT decision's write path is the PR
review, which is option A, and it is durable and auditable on GitHub. Whether
per-block COMMENTS also go through the PR is still open. Their anchors are
file lines, which a block move breaks, so child 08 keeps that question.

**Environment note.** The `gh` CLI is not available in cloud agent sessions
here (GitHub MCP is). The tool must therefore work through either, or name
which surface it runs on, and "could not reach GitHub" must never be read as
approval.

## Done when
- [ ] the `edit-set` skill is written and declared, and feature-staging points to it
- [ ] `edit_set_accept` approves through the gh CLI and through GitHub MCP, and refuses a non-editor caller (test)
- [ ] the review/ page's Accept button deep-links to (or invokes) the tool, with the approval state shown on the page
- [ ] approval never merges: a test asserts that no merge call is reachable from the tool


## Roast correction 2026-09-22 (epic q4jm, R2): the owner cannot approve their own PR

Measured: PRs #961–#967 were all opened as `litlfred`, because agents push through the owner's identity, and GitHub rejects an APPROVE from the PR author. So "accept = approve" works for an SME or second editor, and **fails for the most common case here**, the owner accepting an agent's edit set. Owner's call:
1. a second GitHub account in the editor lane;
2. an owner review carrying a fixed acceptance marker, plus the existing "merge it";
3. branch protection with CODEOWNERS and a separate reviewer account.

- [x] the owner-as-author case is decided (see ruling below); testing is tracked in the ruling section


## Owner ruling 2026-09-22: option 1

The owner chose **option 1** when asked with the three options side by side. When the owner authored the PR, acceptance is an owner PR review carrying a fixed acceptance marker, followed by the existing explicit "merge it". A GitHub APPROVE is still used when the accepter is not the PR author, for example an SME or a second editor.

Known cost, accepted: GitHub does not record the owner's acceptance as a formal approval, so it lives in the review body. The tool must therefore parse the marker, and must never treat "could not read reviews" as accepted.

- [x] the owner-as-author case is decided
- [ ] the marker format is fixed, and the tool recognises it (test)

## Owner ruling 2026-10-06: how the owner accepts their own edit sets (roast R2)

Chosen directly by the owner in https://claude.ai/code/session_012qoycyCSGidZqW245vXhze, from three options (recommended first):

1. **CHOSEN: a PR review/comment from the owner carrying a fixed acceptance marker, plus an explicit "merge it".** No second account is needed. GitHub forbids self-approval, so acceptance is recorded as the owner's marked review, not as an Approve.
2. A second GitHub account in the editor lane (not chosen).
3. CODEOWNERS with a separate reviewer account (not chosen).

R2 is unblocked: `edit_set_accept` reads the owner's marker on the PR and binds it to the head SHA.

## Completed on landed evidence
Landed on main in commit bc69a46e1fcc (Edit set: one feature branch per set of document edits — owner ruling on review plus merge).
