---
name: work-plan-restructure
description: >
  Reorganise a work plan that has outgrown one-bean-at-a-time repair — session
  logs typed as epics, duplicate families, generated template work items, stale
  claims, unparented work — through a reviewed PLAN rather than in bulk. The
  taxonomy is stated as data, a dry-run plan lists one row per work item (action,
  new parent, new status, evidence, note) with its before-state so the plan is
  its own inverse, the owner approves it by class or by row, and the apply is
  batched and reversible. Scrap, never delete. Read before changing the parent,
  type or status of more than a handful of work items at once.
graph-typologies:
  - beans
---

# Restructuring a work plan — a reviewed plan, not a bulk edit

[`lsi-indexing`](../../../skills/kg/graph-management/lsi-indexing.md) §"Epic filing"
ends with **"never apply the proposal in bulk"**. A store that needs thousands
of moves — session logs typed as epics, stale claims, duplicate groups,
generated template families — cannot be repaired one work item at a time either.
**This skill is the middle path: a plan file a person reads, approves, and can
undo.** Applying a rule across thousands of work items unread is what
`deletion-requires-confirmation` and the `lsi` method's refusal 3 forbid; the
plan is how the rule gets read without each work item being read alone.

## 1. State the taxonomy as data, first

A restructure is a claim about what each level MEANS. If that claim stays
implicit, the plan cannot be reviewed: the owner would be approving moves
whose criterion they never saw. So the plan file opens with the taxonomy it
applies:

```json
{
  "taxonomy": {
    "milestone": "a GOAL, in the owner's verbatim words (todo-manager §A GOAL is a milestone bean)",
    "epic":      "a SUBJECT that outlives any session; >= 2 children, or it is a task",
    "feature":   "a deliverable a person can accept or reject on its own",
    "task|bug":  "one pull request's worth of work",
    "never a level": ["a session", "a handover", "a generator run", "a PR"]
  },
  "rules": { "max-depth-below-milestone": 3, "epic-min-children": 2 }
}
```

Defaults are the ones this repository already states:
[`todo-manager`](todo-manager.md) for goals, subjects and *a session is a
log*, and `release-epic-planning` (opt-in `cat-harness.sdlc`)
for epic → feature → task. **The types must be the ones `.beans.yml` lets the
CLI write.** A level the store cannot hold, such as a `story` type it does not
configure, is a proposal to the owner. It is not a row.

## 2. Generate the dry-run plan — one row per bean, with its before-state

| column | what it carries |
|---|---|
| `bean` | the id, or `new:<slug>` for an epic the plan creates |
| `action` | `keep` · `reparent` · `retype` · `scrap-duplicate` · `scrap-generated` · `close-landed` · `reset-claim` · `create-epic` |
| `from-parent` → `to-parent` | before and after |
| `from-type` → `to-type` | before and after |
| `from-status` → `to-status` | before and after |
| `evidence` | `explicit` · `rule:<name>` · `latent:<cosine>/<margin>` — never blank |
| `note` | what a reviewer needs: the survivor of a duplicate, the commit that landed it, the rule that fired |

**The `from-` columns make the plan its own inverse.** Swap every `from-*` and
`to-*` and you have the plan that undoes it. Nothing has to be remembered to
reverse it, and that matters most when the session that applied it is gone.

**The evidence comes from tools that already exist.** Do not re-derive any of
it:

| row source | tool | evidence class |
|---|---|---|
| reparent an open work item | `lsi:epics`: a `parent:` chain or a work item id in commits first, cosine second | `explicit`, else `latent` |
| session log typed as epic or milestone | `sessionLogRootBeans` in `test/health/checks.ts` (the `bean-session-log-roots` finding) | `rule:session-log` |
| duplicate | the `bean-store` duplicate groups; the target-object key in [`todo-manager`](todo-manager.md) §"Check before you create" | `rule:same-title`, `rule:same-target` |
| landed work still open | `branch-archaeology`: patch-id equivalence on main | `explicit` |
| stale claim | `bean-stale-in-progress` / `bean-quiet-claims` in `bun run cat health`, network-checked by `check:quiet-claims` | `rule:stale-claim` |
| unparented | `check:bean-parents` | `rule:orphan` |

**`lsi:epics` prints a calibration line, and the plan carries it.** Its
agreement rate is well short of certain, so a latent row is a proposal, never
presented as a finding.

Write the plan as a **work item note** on the work item that owns the restructure
(`bun run cat beans:note <id>`), with the summary first and the rows as a table.
The `notes` directory is declared and keyed by branch, so the plan is committed
and reviewed in the PR diff without inventing a new directory. A plan too large
for one note is split **by action class**, one note per class, because that is
how the owner approves it.

## 3. The owner gate — approve by class, never by silence

Present the summary before any row, following
[`interaction-modality`](../../../skills/conduct/conduct-core/interaction-modality.md)
§4.1 (context → options → recommendation → question):

- counts per action;
- open children per epic, before and after;
- orphans after (it must be 0);
- every row whose `to-status` is `scrapped` or `completed`.

Then ask:

- **A class approval covers `explicit` and `rule:` rows only.** Latent rows are
  approved row by row, or by the owner's explicit words extending the approval
  to them. A latent row that was not approved stays `keep`. It is never applied
  on the strength of its cosine.
- **Scrap and close are the deletion-shaped actions.** They take the owner's
  word under [`deletion-requires-confirmation`](../../../skills/conduct/conduct-core/deletion-requires-confirmation.md),
  or a recorded [`confirmation-waiver`](../../../skills/conduct/conduct-core/confirmation-waiver.md)
  for the `deletion` gate that names this plan.
- **No answer is not approval.** Say what happens if they say nothing: the
  plan stays a note, and the store is untouched.

## 4. Apply in batches, re-reading each bean first

1. **One action class per commit, at most ~100 rows.** The commit message names
   the plan note and the class. A bad batch is then one `git revert`.
2. **Re-read each work item before you write it**
   ([`todo-manager`](todo-manager.md) §"Check before you WORK"). If its current
   parent, type or status differs from the row's `from-*`, a sibling moved it
   after the plan was made. **Skip the row and report it**; do not overwrite.
3. **Respect live claims.** Leave alone any work item that is mid-flight under
   [`bean-coordination`](bean-coordination.md): touched within 72 h, or named
   by an open PR. The exception is the owner naming that work item.
4. **One flag per `beans update`, then read the front matter back.** A
   multi-flag update can apply only some of its flags and still report success
   ([`todo-manager`](todo-manager.md) §"After you create").
5. **Notes go in by note or `--body-append`, never `--body-file`.**
   `--body-file` replaces the body silently.
6. **Scrap, never delete.** `scrap-duplicate` names the survivor in the
   scrapped work item. `scrap-generated` names the generator and the sidecar or
   queue that should have held the item instead (work items are not sidecars). A
   session log is closed or scrapped with a pointer to where its children
   went. Archiving is a view, not an exit
   ([`bean-coordination`](bean-coordination.md) §"Archiving is a VIEW").
7. **After each batch:** `bun run cat check:bean-parents`,
   `bun run cat readme:subgraphs` and `bun run cat health`. The batch is not done until
   the guards agree with the plan's "after" column.

## 5. Reversing it

If nothing has landed on the store since, revert the batch commits; the store
is committed, which is what makes that possible. If siblings have edited it
since, apply the **swapped** plan: the `from-*` columns become the targets.
Its rows go through the same re-read rule in step 4.2, so a row that a sibling
has since moved is skipped rather than clobbered.

## What this skill does not do

- **Decide the taxonomy.** It states one for the owner to accept or amend. A
  disputed filing (symptom against subject, as `lsi-indexing` puts it) is the
  owner's call, not the score's.
- **Run unattended.** No step from 3 onward happens without the owner's
  approval for that plan.
- **Fix the cause.** If a generator or a skill is minting the work items being
  scrapped, fix that first. Otherwise the plan is repaired again next week.
