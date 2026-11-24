<!-- GENERATED from folio-assistant-core/processes/library/ingest-l1-completeness-gate.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Ingestion subprocess — the L1 completeness gate

> **Generated, and not the authority.** This is `folio-assistant-core/processes/library/ingest-l1-completeness-gate.bpmn` (process `Process_L1Gate`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Decide whether the derived content is complete enough to promote to the L1 graph, and who says so.

## Begin — L1 graph built (`StartEvent_KgBuilt`)

- Begin here.
- Call `workflow_start` with `process: "Process_L1Gate"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_CheckDerived` (Is every derived artefact present?)

### 1. Is every derived artefact present? (`Task_CheckDerived`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `document-intake`.
- What: L1 source to L1 KG is NOT complete while a required derived artefact is missing.
- Record it: `workflow_complete` with `node: "Task_CheckDerived"`.
- next: → `Task_RoundTrip` (Round-trip translation QA)

### 2. Round-trip translation QA (`Task_RoundTrip`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `translation-manager`, `untainted-verification`.
- What: Back-translate each localized narrative into its source language and compare the meaning, to catch semantic drift and bad terminology that a forward-only check cannot see.
- Record it: `workflow_complete` with `node: "Task_RoundTrip"`.
- next: → `Gateway_Drift` (Drift or bad terminology?)

### Decide — Drift or bad terminology? (`Gateway_Drift`)

- Answered by the round-trip translation QA: did it flag semantic drift or a terminology miss?
- Call `workflow_complete` with `node: "Gateway_Drift"` and `outcome` set to the label that holds:
  - «drift» → `Task_FlagDrift` (Adjudicate the flagged passage)
  - «clean» → `Task_Verdict` (Record the L1 completeness verdict)

### 3. Adjudicate the flagged passage (`Task_FlagDrift`)

- Who: the `Reviewer (SME or editor)` lane (role `reviewer`).
- Skill: `document-intake`, `adjudication`.
- What: A machine can detect that two readings differ.
- A subprocess (`Process_Adjudication`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_DriftOutcome` (Which reading was right?)

### 4. Record the L1 completeness verdict (`Task_Verdict`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `document-intake`.
- What: Record the completeness verdict in three states — met, unmet, or not yet derivable — as bun run cat check:l1-complete reports it.
- Record it: `workflow_complete` with `node: "Task_Verdict"`.
- next: → `EndEvent_Verdict` (Verdict recorded)

### Decide — Which reading was right? (`GW_DriftOutcome`)

- All three converge on Task_Verdict, and that is deliberate rather than the codes being decoration: this lane adjudicates ONE passage while Lane_0 still owns the completeness verdict as a whole, so the outcome of a passage is a REASON recorded against that verdict, never a different next step.
- Call `workflow_complete` with `node: "GW_DriftOutcome"` and `outcome` set to the label that holds:
  - «the drift is real» → `Task_Verdict` (Record the L1 completeness verdict)
  - «false positive» → `Task_Verdict` (Record the L1 completeness verdict)
  - «the SOURCE is wrong» → `Task_Verdict` (Record the L1 completeness verdict)

## Done — Verdict recorded (`EndEvent_Verdict`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
