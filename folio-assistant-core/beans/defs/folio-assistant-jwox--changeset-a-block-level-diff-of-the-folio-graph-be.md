---
# folio-assistant-jwox
$schema: bean/1.0.0
title: 'CHANGESET: a block-level diff of the folio/ graph between main and a staging branch — added, removed, modified, moved, renamed'
status: completed
type: task
priority: normal
created_at: 2026-09-22T21:02:54Z
updated_at: 2026-10-08T05:42:00Z
parent: folio-assistant-q4jm
blocked_by:
    - folio-assistant-5xzc
---

**What.** A `ChangeSet` node computed between two refs (`origin/main` and the
branch that STAGING rendered). For each block it records one of: added,
removed, modified (prose / structure / metadata), moved (new parent or order),
or renamed (via `renamedFrom`, child 01). It is keyed on folio/ graph ids,
**not** on file paths.

**Why not reuse `diff`.** The `diff` skill is `git diff origin/main..HEAD` over
the content `.ts` files. It sees files. A move across chapters, or two blocks
in one file, reads as noise at that level.

**Existing pieces to reuse, not rebuild:**
- `scripts/render-changed-blocks.ts` already computes "blocks this branch
  touched", but only for the PDF path.
- `staging-banner.ts` already writes `staging.json` with a compare-with-main
  deep link (g4dv).

**Publishing.** The ChangeSet ships as part of the staging deployment's
metadata graph. This is 6pfo's subject ("staging metadata as a KG graph"), so
it lands there, not in a second file. It is exposed as a Tool node
(`folio_changeset`) so an agent gets the same answer the page shows.

## Done when
- [x] a `ChangeSet` schema in folio-assistant-core/schemas, with the five change kinds. Modelled as added / removed / changed, where changed carries the aspects renamed, prose, manifest and moved (see round 1)
- [x] the computation is a Tool node bound to a BPMN task, tested on a fixture with each kind. `folio-changeset` in `folio-assistant-core/tools/`, reached by p0za's discovery. It satisfies `diff` and `staging-review`, whose skills are referenced by the `content-change-review` and `feature-staging` BPMN tasks. The computation's fixture tests landed in #981
- [x] feature-staging.yml emits it into the staging metadata (coordinated with 6pfo). **Re-homed to ojcx**: this repo holds no folio, so an emission step here would compute over nothing. The emission belongs in the reusable staging workflow that ojcx makes for folio repos (landed in PR #992)
- [x] `diff` and `staging-review` read it instead of re-deriving from git (round 2)


Claimed 2026-09-22 by branch claude/kind-albattani-0qe9gj (session_017nyJj3PsjvszpF3DyGeBgE), stacked after 5xzc (#976).

## Round 1: 2026-09-22

`folio-assistant-core/schemas/changeset.ts`, with the schema, the computation and a CLI; 10 git-fixture tests.

**Shape changed from the bean's wording.** The bean listed five kinds as alternatives: added, removed, modified, moved, renamed. They are not alternatives, because one edit can move, reword and rename a block at once. So a block is added, removed or **changed**, and a changed block lists every aspect that applies.

**Two decisions the tests pin:**
- **Moved is relative.** Only blocks off the longest common subsequence of their section count as moved, so inserting a block at the top of a section moves nothing.
- **A declared rename is not also a manifest edit.** The label and renamedFrom fields are blanked before hashing.

**Safety.** The base ref is read as text: git archive, then `walkBlocks` with verify:false. Old code is never executed.

**Placement.** The module lives in core. Core may import the harness, and the harness may not import core (`check:partition`). So the Tool node that wraps it must live in core too, or read its JSON output.

**Still open:** the remaining three Done-when boxes.

## Round 2: 2026-09-22

- **`diff` skill.** "Finding changed blocks" now runs the ChangeSet CLI. The old recipe grepped changed `.ts` files, so it **missed every prose-only edit** (a `.md` change with no `.ts` change, the commonest edit in a document folio), and it saw moves and renames only as noise. Its change categories are now the ChangeSet's own aspects, so the report and the review page cannot disagree.
- **`staging-review` skill.** It gains a folio-content row in "what changed → which page", and step 1 of content-authoring integration computes the ChangeSet rather than a file list. It ranks "where to start" by changed blocks per section.
- **The Tool is blocked on p0za (new)**, a measured composition gap. Eight of the nine consumers of the tools list read the harness-only barrel. smart-base's Tools are already declared and never served.
- **Staging emission is re-homed to ojcx.** This repo has no folio for it to compute over.

## Round 3 (2026-09-22)

Once p0za's auto-discovery landed, the `folio-changeset` Tool was declared in `folio-assistant-core/tools/index.ts`, and core declares its `tools/` directory. The one box left is staging emission, which is re-homed to ojcx.



## Claim released 2026-09-29

Released `in-progress` → `todo` on the owner's instruction (review session https://claude.ai/code/session_014Qj8wncQhqV52QGN1yZDnj). No git change to this bean since before 2026-09-26, and no holder recorded; the sessions that held theme C (rendered site) work stopped on the 2026-09-25 weekly usage limit. Nothing in the body was changed: re-claim with `bun run cat beans:claim <id>`.

## Completed on landed evidence
Landed on main in PR #981 (commit `2d92b178e65d`), PR #982 (commit `0a016325f15c`), and staging workflow landed in PR #992 (commit `c1b53308013e`).
- Implemented `ChangeSetSchema` and block-level diff calculation in `folio-assistant-core/schemas/changeset.ts` with git fixture tests.
- Registered `folio-changeset` tool in core and auto-discovered via `p0za`.
- Updated `diff` and `staging-review` skills to read ChangeSet.
- Reusable staging workflow `folio-staging.yml` landed in PR #992.

