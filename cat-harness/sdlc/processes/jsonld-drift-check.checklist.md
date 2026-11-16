<!-- GENERATED from cat-harness/sdlc/processes/jsonld-drift-check.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Are the .jsonld siblings still in sync with their .ts manifests?

> **Generated, and not the authority.** This is `cat-harness/sdlc/processes/jsonld-drift-check.bpmn` (process `Process_JsonLdDrift`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Check that the committed `.jsonld` siblings are still in sync with the `.ts` manifests they are generated from.

## Begin — Pull request, push to main, or dispatch (`Start_Change`)

- Begin here.
- Call `workflow_start` with `process: "Process_JsonLdDrift"` and the subject this run is about; keep the instance id it returns.
- next: → `Call_Drift` (Check the .jsonld siblings are in sync)

### 1. Check the .jsonld siblings are in sync (`Call_Drift`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- What: Run the five --check generators in one job — the JSON-LD context, block siblings, library nodes, site graph, then the label-resolution and emitter tests.
- A subprocess (`Process_GeneratedFileDrift`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `End_Checked` (Checked)

## Done — Checked (`End_Checked`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
