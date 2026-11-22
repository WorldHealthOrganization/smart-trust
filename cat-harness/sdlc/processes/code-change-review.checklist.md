<!-- GENERATED from cat-harness/sdlc/processes/code-change-review.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Code change and review

> **Generated, and not the authority.** This is `cat-harness/sdlc/processes/code-change-review.bpmn` (process `Process_CodeChangeReview`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Getting a change to the PLATFORM from "this is needed" to merged: claim the work, branch and announce it, make the change, prove it against the platform's own gates, and carry it through review to a merge somebody else is not left holding.

## Begin — A platform change is needed (`Start_Change`)

- Begin here.
- Call `workflow_start` with `process: "Process_CodeChangeReview"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_ClaimBean` (Open the bean)

### 1. Open the bean (`Task_ClaimBean`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `bean-coordination`.
- What: Process_BeanOpen: check before you create, find out whose the bean is, and claim it — or leave it alone when it is someone else's.
- A subprocess (`Process_BeanOpen`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_BeanYours` (Bean claimed?)

### Decide — Bean claimed? (`GW_BeanYours`)

- Reads which end Process_BeanOpen reached.
- Call `workflow_complete` with `node: "GW_BeanYours"` and `outcome` set to the label that holds:
  - «claimed» → `Task_BranchAndAnnounce` (Branch, and announce it)
  - «not yours» → `End_BeanNotYours` (Not yours — left alone)

### 2. Branch, and announce it (`Task_BranchAndAnnounce`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `issue-working`.
- What: Announce the branch WHEN IT IS CREATED, not when the work is done.
- Record it: `workflow_complete` with `node: "Task_BranchAndAnnounce"`.
- next: → `Task_Implement` (Make the change)

## Done — Not yours — left alone (`End_BeanNotYours`)

- The instance completes here: Someone else holds the bean; this run stops without touching it. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 3. Make the change (`Task_Implement`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `continual-progress`.
- What: The loop's only open-ended step.
- Record it: `workflow_complete` with `node: "Task_Implement"`.
- next: → `Task_RunGates` (Run the platform's own gates)

### 4. Run the platform's own gates (`Task_RunGates`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `platform-gates`.
- What: Before pushing, not after CI says so.
- Record it: `workflow_complete` with `node: "Task_RunGates"`.
- next: → `Task_CommitAndOpenPR` (Commit, push, open the PR)

### 5. Commit, push, open the PR (`Task_CommitAndOpenPR`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `continual-progress`, `before-after-preview`, `staging-review`.
- What: The PR opens at the FIRST commit, even on a stub, and permission is never asked for it.
- Record it: `workflow_complete` with `node: "Task_CommitAndOpenPR"`.
- next: → `Task_RunCI` (Run the gates against the merge of head into base)

### 6. Run the gates against the merge of head into base (`Task_RunCI`)

- Who: the `CI/CD pipeline` lane (role `build-pipeline`).
- What: CI tests the MERGE, not the branch.
- Record it: `workflow_complete` with `node: "Task_RunCI"`.
- next: → `GW_CIGreen` (CI green?)

### Decide — CI green? (`GW_CIGreen`)

- Answered by the gates run against the merge of head into base.
- Call `workflow_complete` with `node: "GW_CIGreen"` and `outcome` set to the label that holds:
  - «green» → `Task_Review` (Review the change)
  - «red» → `Task_Diagnose` (Root-cause the failure)

### 7. Review the change (`Task_Review`)

- Who: the `Code reviewer` lane (role `code-reviewer`).
- Skill: `code-node-review`, `adversarial-code-review`, `staging-review`.
- What: A human or an agent acting AS reviewer.
- Record it: `workflow_complete` with `node: "Task_Review"`.
- next: → `GW_ReviewClear` (Review clear?)

### 8. Root-cause the failure (`Task_Diagnose`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `ci-health`.
- What: "Flake" is not a root cause.
- Record it: `workflow_complete` with `node: "Task_Diagnose"`.
- next: → `Task_Implement` (Make the change)

### Decide — Review clear? (`GW_ReviewClear`)

- The reviewer's result.
- Call `workflow_complete` with `node: "GW_ReviewClear"` and `outcome` set to the label that holds:
  - «findings» → `Task_AddressReview` (Address the review)
  - «clear» → `Task_PrepareMerge` (Prepare the merge, and watch it through)

### 9. Address the review (`Task_AddressReview`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `watch`.
- What: Every finding is answered — implemented, or replied to with why not.
- Record it: `workflow_complete` with `node: "Task_AddressReview"`.
- next: → `Task_Implement` (Make the change)

### 10. Prepare the merge, and watch it through (`Task_PrepareMerge`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `prepare-merge`.
- What: `prepare-merge` brings the base in, re-runs the gates and pushes — it does NOT merge.
- A subprocess (`Process_MergeBase`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Task_CloseBean` (Record what was done)

### 11. Record what was done (`Task_CloseBean`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `todo-manager`.
- What: A closed work item is read later by somebody deciding whether to reopen the subject, so "completed" with nothing behind it cannot be audited.
- Record it: `workflow_complete` with `node: "Task_CloseBean"`.
- next: → `Task_ArchiveBean` (Close the bean)

### 12. Close the bean (`Task_ArchiveBean`)

- Who: the `Authoring agent` lane (role `authoring-agent`).
- Skill: `todo-manager`.
- What: Process_BeanClose: end the bean in a state that says why — complete and archive it, scrap it with its reasons and archive it, or record the blocker and hand it back.
- A subprocess (`Process_BeanClose`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `End_Merged` (Merged)

## Done — Merged (`End_Merged`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
