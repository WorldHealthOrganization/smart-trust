<!-- GENERATED from cat-harness/sdlc/processes/publish-alert.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Alert the publication manager

> **Generated, and not the authority.** This is `cat-harness/sdlc/processes/publish-alert.bpmn` (process `Process_PublishAlert`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

One alert for every failure after the publish button — an incomplete export, a failed verification, a failed deploy, a lost preview — kept as a single tracking issue for the publication manager and closed by the next clean publish.

## Begin — A step after the publish button failed (`Start_Failed`)

- Begin here.
- Call `workflow_start` with `process: "Process_PublishAlert"` and the subject this run is about; keep the instance id it returns.
- next: → `A_Label` (Ensure the publication-manager label)

### 1. Ensure the publication-manager label (`A_Label`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- What: The alert is a tracking issue labelled `publication-manager` — the role, not a person, because no actor declares a GitHub account for it.
- Record it: `workflow_complete` with `node: "A_Label"`.
- next: → `GW_Open` (An alert already open?)

### Decide — An alert already open? (`GW_Open`)

- Is a publication-manager tracking issue already open?
- Call `workflow_complete` with `node: "GW_Open"` and `outcome` set to the label that holds:
  - «no» → `A_Open` (Open the tracking issue, naming the failed step)
  - «yes» → `A_Comment` (Comment on the open issue, naming the step)

### 2. Open the tracking issue, naming the failed step (`A_Open`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- What: Open the issue with the step that failed, the run link and — for a verification failure — the verifier report.
- Record it: `workflow_complete` with `node: "A_Open"`.
- next: → `U_Triage` (Triage the failure: hold or fix forward)

### 3. Comment on the open issue, naming the step (`A_Comment`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- What: Add this failure to the open issue as a comment (which notifies), and refresh the body to the latest state.
- Record it: `workflow_complete` with `node: "A_Comment"`.
- next: → `U_Triage` (Triage the failure: hold or fix forward)

### 4. Triage the failure: hold or fix forward (`U_Triage`)

- Who: the `Publication manager` lane (role `publication-manager`).
- Skill: `publish-verification`.
- What: The publication manager reads what failed and decides: hold the release, or fix forward and publish again.
- A subprocess (`Process_AskThePerson`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `End_Triaged` (Triaged)

## Done — Triaged (`End_Triaged`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
