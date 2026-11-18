<!-- GENERATED from cat-harness/sdlc/processes/merge-base.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Merge the base branch in

> **Generated, and not the authority.** This is `cat-harness/sdlc/processes/merge-base.bpmn` (process `Process_MergeBase`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Bring the base branch into a pull-request branch: merge, classify every conflicted path before resolving any, refuse the whole merge if one is authored or undeclared, otherwise resolve, regenerate and prove the result with the gate set.

## Begin — Base moved, or PR conflicted (`Start_Merge`)

- Begin here.
- Call `workflow_start` with `process: "Process_MergeBase"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_Merge` (Merge the base in, without committing)

## Begin — Every member reported (`Start_Report`)

- Begin here: A SECOND trigger, not a step of the merge above: `merge-main.yml` runs one merge per opted-in PR and this fires once per RUN, when all of them have reported.
- Call `workflow_start` with `process: "Process_MergeBase"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_Report` (Report what the run found, once)

### 1. Merge the base in, without committing (`Task_Merge`)

- Who: the `merge:main command` lane (role `build-pipeline`).
- Skill: `prepare-merge`.
- What: `git merge --no-ff --no-commit origin/main` on a clean tree (untracked files refuse too, so the final stage cannot sweep in a scratch file).
- Record it: `workflow_complete` with `node: "Task_Merge"`.
- next: → `GW_Conflicts` (Any conflict?)

### 2. Report what the run found, once (`Task_Report`)

- Who: the `merge:main command` lane (role `build-pipeline`).
- Skill: `ci-health`.
- What: Every member's verdict, in one table in the run's summary: merged, already up to date, refused, an expected race, a repeat of a failure already reported, something new, or a member that could not say.
- Record it: `workflow_complete` with `node: "Task_Report"`.
- next: → `GW_News` (Anything new?)

### Decide — Any conflict? (`GW_Conflicts`)

- `none` still regenerates: a CLEAN merge can produce an artefact neither side would emit (bean `lxpq`), so only the gates can say it is right.
- Call `workflow_complete` with `node: "GW_Conflicts"` and `outcome` set to the label that holds:
  - «none» → `Task_Regen` (Regenerate, asking every CI gate)
  - «yes» → `Task_Classify` (Classify every conflicted path against the declared patterns)

### Decide — Anything new? (`GW_News`)

- `new` on three conditions and no others: a failure whose signature the PR's own comment did not already report; a member that reported no verdict, or one it could not classify; and a systemic failure (every selected PR failed) unless every one of those failures is itself a repeat, in which case each
- Call `workflow_complete` with `node: "GW_News"` and `outcome` set to the label that holds:
  - «new, changed or systemic» → `End_Notified` (Run red: one email)
  - «already reported» → `End_Recorded` (Run green: recorded, not sent again)

### 3. Regenerate, asking every CI gate (`Task_Regen`)

- Who: the `merge:main command` lane (role `build-pipeline`).
- Skill: `prepare-merge`.
- What: `bun run cat regen`: every check/writer pair the CI workflow runs, repeated until the tree settles.
- Record it: `workflow_complete` with `node: "Task_Regen"`.
- next: → `GW_Proved` (Every gate reproduced?)

### 4. Classify every conflicted path against the declared patterns (`Task_Classify`)

- Who: the `merge:main command` lane (role `build-pipeline`).
- Skill: `merge-conflict-patterns`.
- What: The first matching pattern decides: take-base, owned-tree, generated-regions, or refuse.
- Record it: `workflow_complete` with `node: "Task_Classify"`.
- next: → `GW_AllDeclared` (Every path resolvable?)

## Done — Run red: one email (`End_Notified`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Run green: recorded, not sent again (`End_Recorded`)

- The instance completes here: Quiet is not silent. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### Decide — Every gate reproduced? (`GW_Proved`)

- `no` when regen reports an unrepaired check, or one with no writer: a resolution the gates cannot reproduce is not a resolution.
- Call `workflow_complete` with `node: "GW_Proved"` and `outcome` set to the label that holds:
  - «yes» → `Task_Commit` (Commit the merge)
  - «no» → `Task_Abort` (Abort, restore the tree, list what was refused)

### Decide — Every path resolvable? (`GW_AllDeclared`)

- `no` if even one path is refused: the merge is aborted whole, never half-resolved.
- Call `workflow_complete` with `node: "GW_AllDeclared"` and `outcome` set to the label that holds:
  - «yes» → `Task_Resolve` (Resolve each by its declared strategy)
  - «no» → `Task_Abort` (Abort, restore the tree, list what was refused)

### 5. Commit the merge (`Task_Commit`)

- Who: the `merge:main command` lane (role `build-pipeline`).
- Skill: `continual-progress`.
- Record it: `workflow_complete` with `node: "Task_Commit"`.
- next: → `End_Merged` (Merged, proved)

### 6. Abort, restore the tree, list what was refused (`Task_Abort`)

- Who: the `merge:main command` lane (role `build-pipeline`).
- Skill: `merge-conflict-patterns`.
- What: `git merge --abort`.
- Record it: `workflow_complete` with `node: "Task_Abort"`.
- next: → `Task_ByHand` (Resolve by hand, then regenerate)

### 7. Resolve each by its declared strategy (`Task_Resolve`)

- Who: the `merge:main command` lane (role `build-pipeline`).
- Skill: `merge-conflict-patterns`.
- What: take-base paths take the base's copy; generated-regions files take the base's side of each hunk, which lies inside a generated region by construction.
- Record it: `workflow_complete` with `node: "Task_Resolve"`.
- next: → `Task_Regen` (Regenerate, asking every CI gate)

## Done — Merged, proved (`End_Merged`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 8. Resolve by hand, then regenerate (`Task_ByHand`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `prepare-merge`.
- Record it: `workflow_complete` with `node: "Task_ByHand"`.
- next: → `End_ByHand` (Merged by a person)

## Done — Merged by a person (`End_ByHand`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
