<!-- GENERATED from cat-harness/sdlc/processes/merge-to-main.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Merge to main

> **Generated, and not the authority.** This is `cat-harness/sdlc/processes/merge-to-main.bpmn` (process `Process_MergeToMain`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Land ONE pull request on `main`, in any repository, as its own step with its own gate: read the head's evidence live, establish that the owner authorised THIS merge, record the authorisation, merge pinned to the evaluated head, then confirm the base, republish the repository's site, re-pin downstrea

## Begin — A PR is to land on main (`Start_Merge`)

- Begin here.
- Call `workflow_start` with `process: "Process_MergeToMain"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_RegenProjections` (Regenerate harness projections (CI))

### 1. Regenerate harness projections (CI) (`Task_RegenProjections`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `harness-projections`.
- What: A workflow step, on the PR head: run the generators whose output is an agent-host projection of the graph (today `skill:commands` for `.claude/commands/`, and the `agent-memory` assembler for `.claude/agent-memory/` and `.claude/agents/`) and commit what changed to the PR branch.
- Record it: `workflow_complete` with `node: "Task_RegenProjections"`.
- next: → `Task_ReadEvidence` (Read the head's evidence, live)

### 2. Read the head's evidence, live (`Task_ReadEvidence`)

- Who: the `Merging session` lane (role `merge-steward`).
- Skill: `merge-to-main`.
- What: On the PR's current head SHA, now: `ciState` (green, red, pending, none, unreadable) per OWED job from the workflow runs whose head_sha is the head; `mergeable` (clean, dirty, unknown); `review` (clear, blocking, unknown), including open CHANGES_REQUESTED reviews, a draft, `needs-merge-human`, and C
- Record it: `workflow_complete` with `node: "Task_ReadEvidence"`.
- next: → `GW_Evidence` (What does the evidence say?)

### Decide — What does the evidence say? (`GW_Evidence`)

- Computed by decisions/merge-evidence.dmn over ciState, mergeable, review and release.
- Computed by the DMN table `decisions/merge-evidence.dmn#Decision_MergeEvidence`: call `workflow_complete` with `node: "GW_Evidence"` and the `facts` it reads — the table returns the branch; pass no `outcome`.
  - «ready» → `Task_ReadAuthorisation` (Find the owner's authorisation for THIS merge)
  - «no-ci» → `Task_LocalGates` (No CI: run the repo's own gates locally)
  - «hand-back» → `Call_HandBack` (Hand it back)
  - «not-yet» → `End_NotYet` (Not yet: re-enter later)
  - «unknown» → `End_Unknown` (Could not determine)

### 3. Find the owner's authorisation for THIS merge (`Task_ReadAuthorisation`)

- Who: the `Merging session` lane (role `merge-steward`).
- Skill: `merge-to-main`.
- What: Classify what exists into one value: `explicit` (the owner's own words naming this merge, given against this head), `waiver` (a valid `memory/waivers/` node with gate merge-to-main, in scope and unexpired), `instruction-only` (a broad instruction about the work, such as "fix all issues until green" 
- Record it: `workflow_complete` with `node: "Task_ReadAuthorisation"`.
- next: → `GW_Authorised` (Authorised?)

### 4. No CI: run the repo's own gates locally (`Task_LocalGates`)

- Who: the `Merging session` lane (role `merge-steward`).
- Skill: `merge-to-main`.
- What: Only on `no-ci`.
- Record it: `workflow_complete` with `node: "Task_LocalGates"`.
- next: → `Task_ReadAuthorisation` (Find the owner's authorisation for THIS merge)

### 5. Hand it back (`Call_HandBack`)

- Who: the `Merging session` lane (role `merge-steward`).
- Skill: `merge-to-main`.
- What: Red CI, a conflict or a blocking review is the PR owner's to fix, not the merger's: `merge-refusal.bpmn` records the reason on the bean and returns the PR.
- A subprocess (`Process_MergeRefusal`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `End_HandedBack` (Handed back, not merged)

## Done — Not yet: re-enter later (`End_NotYet`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Could not determine (`End_Unknown`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### Decide — Authorised? (`GW_Authorised`)

- Computed by decisions/merge-authorisation.dmn over authorisation and ciState.
- Computed by the DMN table `decisions/merge-authorisation.dmn#Decision_MergeAuthorisation`: call `workflow_complete` with `node: "GW_Authorised"` and the `facts` it reads — the table returns the branch; pass no `outcome`.
  - «merge» → `Task_RecordAuthorisation` (Record who authorised, when, and the quote)
  - «ask» → `Task_Ask` (Put the merge to the owner)

## Done — Handed back, not merged (`End_HandedBack`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 6. Record who authorised, when, and the quote (`Task_RecordAuthorisation`)

- Who: the `Merging session` lane (role `merge-steward`).
- Skill: `merge-to-main`.
- What: Before the merge, in the shape of `ReleaseSchema` (schemas/sdlc/merge-queue.ts): verdict, decidedBy (the person), decidedAt, authority (explicit, standing ruling with its date, or waiver id), the quote verbatim with its source, releasedSha (the head approved; a later push voids it) and capturedBy (t
- Record it: `workflow_complete` with `node: "Task_RecordAuthorisation"`.
- next: → `Task_Merge` (Merge, pinned to the evaluated head)

### 7. Put the merge to the owner (`Task_Ask`)

- Who: the `Merging session` lane (role `merge-steward`).
- Skill: `merge-to-main`.
- What: Context, options, recommendation, question (interaction-modality §4.1).
- A subprocess (`Process_AskThePerson`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Task_OwnerDecides` (Merge, hold or refuse)

### 8. Merge, pinned to the evaluated head (`Task_Merge`)

- Who: the `Merging session` lane (role `merge-steward`).
- Skill: `merge-to-main`.
- What: Through `merge:guard <pr> --merge --session <id>` where the repository has it; elsewhere with the merge call pinned to the head SHA, so GitHub refuses if the head moved.
- Record it: `workflow_complete` with `node: "Task_Merge"`.
- next: → `Task_ConfirmBase` (Confirm main's CI on the merge commit)

### 9. Merge, hold or refuse (`Task_OwnerDecides`)

- Who: the `Owner` lane (role `user`).
- Skill: `merge-to-main`.
- What: The owner's answer to the question Task_Ask asked.
- Record it: `workflow_complete` with `node: "Task_OwnerDecides"`.
- next: → `GW_Owner` (Owner's answer?)

### 10. Confirm main's CI on the merge commit (`Task_ConfirmBase`)

- Who: the `Merging session` lane (role `merge-steward`).
- Skill: `merge-to-main`.
- What: Read the runs on the merge commit.
- Record it: `workflow_complete` with `node: "Task_ConfirmBase"`.
- next: → `Task_Republish` (Rebuild and republish the repository's site)

### Decide — Owner's answer? (`GW_Owner`)

- `merge` goes on to the record; `hold` and `refuse` end with the PR open.
- Call `workflow_complete` with `node: "GW_Owner"` and `outcome` set to the label that holds:
  - «merge» → `Task_RecordAuthorisation` (Record who authorised, when, and the quote)
  - «hold» → `End_Held` (Held: PR stays open)
  - «refuse» → `End_Refused` (Refused: not merged)

### 11. Rebuild and republish the repository's site (`Task_Republish`)

- Who: the `Merging session` lane (role `merge-steward`).
- Skill: `merge-to-main`.
- What: A merge that changes what a published site shows is not done until the site shows it (owner, 2026-10-30: "merged PRs by agent should trigger page rebuild in process").
- Record it: `workflow_complete` with `node: "Task_Republish"`.
- next: → `Task_Repin` (Re-pin downstream mounts, as PRs)

## Done — Held: PR stays open (`End_Held`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Refused: not merged (`End_Refused`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 12. Re-pin downstream mounts, as PRs (`Task_Repin`)

- Who: the `Merging session` lane (role `merge-steward`).
- Skill: `merge-to-main`.
- What: For each layer whose index.config.json mounts this repository: a PR moving `ref` to the merge commit, with a trust.consent whose evidence quotes the owner's consent to that pin, and the lock regenerated by `mount:remote`.
- Record it: `workflow_complete` with `node: "Task_Repin"`.
- next: → `Task_Report` (Note the bean, summarise on the issue)

### 13. Note the bean, summarise on the issue (`Task_Report`)

- Who: the `Merging session` lane (role `merge-steward`).
- Skill: `merge-to-main`.
- What: The merge SHA and the authorisation block on the bean; a round summary on the issue (issue-working).
- Record it: `workflow_complete` with `node: "Task_Report"`.
- next: → `End_Merged` (Merged, recorded)

## Done — Merged, recorded (`End_Merged`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
