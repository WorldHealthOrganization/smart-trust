<!-- GENERATED from cat-harness/sdlc/processes/publish-verification.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Verify the export before it is deployed

> **Generated, and not the authority.** This is `cat-harness/sdlc/processes/publish-verification.bpmn` (process `Process_PublishVerification`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Run the verifier set over the built tree between the export and the deploy, and report pass, fail or could-not-tell.

## Begin — Documents exported, not yet deployed (`Start_Exported`)

- Begin here.
- Call `workflow_start` with `process: "Process_PublishVerification"` and the subject this run is about; keep the instance id it returns.
- next: → `A_Verify` (Run every verifier over the export)

### 1. Run every verifier over the export (`A_Verify`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `publish-verification`.
- What: Run the verifier set (scripts/publish-verify.ts, `bun run cat publish:verify -- --dir <site>`) over the built tree.
- Record it: `workflow_complete` with `node: "A_Verify"`.
- next: → `GW_Determined` (Could every verifier tell?)

### Decide — Could every verifier tell? (`GW_Determined`)

- Answered by the verifier set's exit code.
- Call `workflow_complete` with `node: "GW_Determined"` and `outcome` set to the label that holds:
  - «no» → `End_Unknown` (Could not verify — treated as failed)
  - «yes» → `GW_Pass` (Did every in-scope document pass?)

## Done — Could not verify — treated as failed (`End_Unknown`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### Decide — Did every in-scope document pass? (`GW_Pass`)

- Answered by the findings.
- Call `workflow_complete` with `node: "GW_Pass"` and `outcome` set to the label that holds:
  - «yes» → `End_Verified` (Verified)
  - «no» → `End_Failed` (A verifier failed)

## Done — Verified (`End_Verified`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — A verifier failed (`End_Failed`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
