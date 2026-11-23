<!-- GENERATED from cat-harness/sdlc/processes/qa-publish.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Publish and keep QA results on qa-reports

> **Generated, and not the authority.** This is `cat-harness/sdlc/processes/qa-publish.bpmn` (process `Process_QaPublish`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

How a run's derived QA results become a durable, commit-keyed record without being committed to main, and how that record is retired.

## Begin — Gates finished (any conclusion) (`Start_GatesDone`)

- Begin here: `needs: gates` with `always()`: the publish runs whether the gates were green or red, because the evidence of a red commit is evidence too.
- Call `workflow_start` with `process: "Process_QaPublish"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_DeriveKey` (Derive the key)

## Begin — Daily schedule, or dispatched (`Start_Daily`)

- Begin here: A `schedule` trigger that actually fires — the lake-cache prune it was modelled on is guarded on `push` inside a dispatch-only workflow and has never run.
- Call `workflow_start` with `process: "Process_QaPublish"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_ReadPrStates` (Read every PR's state)

### 1. Derive the key (`Task_DeriveKey`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `qa-reports`.
- What: `qa:publish --github` reads the event: a push to main publishes under `main/<sha>/`, a pull request under `pr/<n>/<head-sha>/` — the head that was tested, not the merge ref.
- Record it: `workflow_complete` with `node: "Task_DeriveKey"`.
- next: → `Gateway_CanWrite` (Can this token write?)

### 2. Read every PR's state (`Task_ReadPrStates`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `qa-reports`.
- What: `gh pr list --state all`: number, state and when it closed, so each `pr/<n>/` entry can be judged against its close date.
- Record it: `workflow_complete` with `node: "Task_ReadPrStates"`.
- next: → `Task_PlanPrune` (Plan the prune)

### Decide — Can this token write? (`Gateway_CanWrite`)

- A fork PR's token is read-only (spike `3ds9`).
- Call `workflow_complete` with `node: "Gateway_CanWrite"` and `outcome` set to the label that holds:
  - «yes» → `Task_BuildEntry` (Build the entry)
  - «no: fork PR» → `End_SkippedFork` (Skipped: fork PR (::notice says why))

### 3. Plan the prune (`Task_PlanPrune`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `qa-reports`.
- What: Keep every `main/<sha>` for 14 days and one per day after that; drop `pr/<n>` 7 days after the PR closed.
- Record it: `workflow_complete` with `node: "Task_PlanPrune"`.
- next: → `Gateway_Apply` (Apply?)

### 4. Build the entry (`Task_BuildEntry`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `qa-reports`.
- What: First the working copy is produced (`qa:refresh`, bean `3hk4`): while the checkout still tracks `test/results/`, the commit's own copy is the record and nothing runs; once it does not, every declared QA writer runs into the empty tree, because the gates are in judge mode and wrote nothing a publish 
- Record it: `workflow_complete` with `node: "Task_BuildEntry"`.
- next: → `Task_SpliceAndPush` (Splice onto the tip and push (never -f))

## Done — Skipped: fork PR (::notice says why) (`End_SkippedFork`)

- The instance completes here: Exits 0 with a `::notice` naming the reason. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### Decide — Apply? (`Gateway_Apply`)

- Yes on the schedule, or on a dispatch with `apply` ticked.
- Call `workflow_complete` with `node: "Gateway_Apply"` and `outcome` set to the label that holds:
  - «no: dry run» → `End_DryRun` (Plan printed, nothing removed)
  - «yes» → `Task_ApplyPrune` (Commit a tip without the pruned entries)

### 5. Splice onto the tip and push (never -f) (`Task_SpliceAndPush`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `qa-reports`.
- What: Fetch the branch tip, splice this entry into its tree, `commit-tree -p <tip>`, and push without `-f`, with `pack.useSparse=false` so blobs already on the remote under another key are not resent.
- Record it: `workflow_complete` with `node: "Task_SpliceAndPush"`.
- next: → `Gateway_Accepted` (Push accepted?)

## Done — Plan printed, nothing removed (`End_DryRun`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 6. Commit a tip without the pruned entries (`Task_ApplyPrune`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `qa-reports`.
- What: One new commit whose tree lacks the pruned entries, parented on the current tip, through the same fetch → rebuild → push loop as a publish: no `-f`, three attempts.
- Record it: `workflow_complete` with `node: "Task_ApplyPrune"`.
- next: → `End_Pruned` (Retention applied)

### Decide — Push accepted? (`Gateway_Accepted`)

- Read off the push's exit code, never its stderr.
- Call `workflow_complete` with `node: "Gateway_Accepted"` and `outcome` set to the label that holds:
  - «accepted» → `End_Published` (Results stored under their key)
  - «rejected,
attempts left» → `Task_Backoff` (Back off)
  - «third rejection,
or git failed» → `End_PublishFailed` (Not stored (job red, gates untouched))

## Done — Retention applied (`End_Pruned`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Results stored under their key (`End_Published`)

- The instance completes here: The commit's record now exists on `qa-reports`; `bun run cat qa:fetch --ref` reads it back and a gate's `--against` can use it as a baseline. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 7. Back off (`Task_Backoff`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `qa-reports`.
- What: Wait the same intervals `backoff-sleep.ts` uses, then go round again: fetch the new tip and splice onto it.
- Record it: `workflow_complete` with `node: "Task_Backoff"`.
- next: → `Task_SpliceAndPush` (Splice onto the tip and push (never -f))

## Done — Not stored (job red, gates untouched) (`End_PublishFailed`)

- The instance completes here: Three rejections, or a git failure. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
