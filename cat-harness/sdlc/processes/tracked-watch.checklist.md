<!-- GENERATED from cat-harness/sdlc/processes/tracked-watch.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Report a verdict on one tracking issue

> **Generated, and not the authority.** This is `cat-harness/sdlc/processes/tracked-watch.bpmn` (process `Process_TrackedWatch`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Report a check's verdict on one tracking issue: close the issue when the check found nothing, open or edit it when the check found something, and leave it untouched when the check could not tell.

## Begin — Check run, verdict written (`Start_Verdict`)

- Begin here: The calling watch's check has run and written its verdict: clean, findings, or unknown.
- Call `workflow_start` with `process: "Process_TrackedWatch"` and the subject this run is about; keep the instance id it returns.
- next: → `GW_Determined` (Could we tell?)

### Decide — Could we tell? (`GW_Determined`)

- Asked of the calling watch's `verdict`, not of the raw exit code.
- Call `workflow_complete` with `node: "GW_Determined"` and `outcome` set to the label that holds:
  - «no» → `End_Unknown` (Unknown: job red, issue untouched)
  - «yes» → `Task_Label` (Ensure the tracking label exists)

## Done — Unknown: job red, issue untouched (`End_Unknown`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 1. Ensure the tracking label exists (`Task_Label`)

- Who: the `Scheduled log sweep` lane (role `build-pipeline`).
- Skill: `ci-health`.
- What: Create the tracking label (the `label` input) with --force so it exists before either issue path runs — the close path filters on it too, and on a repository that has never had a finding it would not exist yet.
- Shared step `GT_EnsureTrackingLabel`, with `label` = `{label}`.
- Record it: `workflow_complete` with `node: "Task_Label"`.
- next: → `GW_Finding` (Anything found?)

### Decide — Anything found? (`GW_Finding`)

- Asked of the same `verdict`, once it is known.
- Call `workflow_complete` with `node: "GW_Finding"` and `outcome` set to the label that holds:
  - «no» → `Task_Close` (Close the tracking issue)
  - «yes» → `Task_Track` (Open or edit the one tracking issue)

### 2. Close the tracking issue (`Task_Close`)

- Who: the `Scheduled log sweep` lane (role `build-pipeline`).
- Skill: `ci-health`.
- What: Clean: close the open issue carrying the tracking label (the `label` input), if any, saying why the verdict is clean.
- Shared step `GT_CloseTrackingIssue`, with `label` = `{label}`.
- Record it: `workflow_complete` with `node: "Task_Close"`.
- next: → `End_Clean` (Clean: issue closed)

### 3. Open or edit the one tracking issue (`Task_Track`)

- Who: the `Scheduled log sweep` lane (role `build-pipeline`).
- Skill: `ci-health`.
- What: Findings: EDIT the one open issue carrying the tracking label (the `label` input) if there is one, otherwise create it, with the report as the body.
- Shared step `GT_TrackIssue`, with `label` = `{label}`.
- Record it: `workflow_complete` with `node: "Task_Track"`.
- next: → `End_Found` (Found: recorded, job stays green)

## Done — Clean: issue closed (`End_Clean`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Found: recorded, job stays green (`End_Found`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
