<!-- GENERATED from folio-assistant-core/collab/processes/content/editing-hci-validation.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Editing and HCI validation

> **Generated, and not the authority.** This is `folio-assistant-core/collab/processes/content/editing-hci-validation.bpmn` (process `Process_Editing`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

What happens to one proposed change to one content block: drafted, validated mechanically and by review, shown to the editor, and committed to the corpus only if accepted.

## Begin — Edit requested (`StartEvent_EditRequested`)

- Begin here.
- Call `workflow_start` with `process: "Process_Editing"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_DescribeChange` (Describe the intended change)

### 1. Describe the intended change (`Task_DescribeChange`)

- Who: the `Editor / author (person)` lane (role `author`).
- What: The editor states the change in natural language; no content has moved yet.
- Record it: `workflow_complete` with `node: "Task_DescribeChange"`.
- next: → `Task_ClaimBean` (Open the bean)

### 2. Open the bean (`Task_ClaimBean`)

- Who: the `Authoring agent (system)` lane (role `authoring-agent`).
- Skill: `bean-coordination`.
- What: Process_BeanOpen: check before you create, find out whose the bean is, and claim it — or leave it alone when it is someone else's.
- A subprocess (`Process_BeanOpen`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_BeanYours` (Bean claimed?)

### Decide — Bean claimed? (`GW_BeanYours`)

- Reads which end Process_BeanOpen reached.
- Call `workflow_complete` with `node: "GW_BeanYours"` and `outcome` set to the label that holds:
  - «claimed» → `CallActivity_Evidence` (Gather and verify the evidence)
  - «not yours» → `End_BeanNotYours` (Not yours — left alone)

### 3. Gather and verify the evidence (`CallActivity_Evidence`)

- Who: the `Editor / author (person)` lane (role `author`).
- What: Before anything is drafted: the author reads the guidance ALREADY in this content, frames the question as PICO, retrieves candidates across the three evidence classes, and has each candidate's authority resolved against its publisher's own API.
- A subprocess (`Process_EvidenceRetrieval`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Task_DraftEdit` (Draft the block edit)

## Done — Not yours — left alone (`End_BeanNotYours`)

- The instance completes here: Someone else holds the bean; this run stops without touching it. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 4. Draft the block edit (`Task_DraftEdit`)

- Who: the `Authoring agent (system)` lane (role `authoring-agent`).
- Skill: `content-author`, `before-after-preview`.
- What: The authoring agent produces a PROPOSED change.
- Record it: `workflow_complete` with `node: "Task_DraftEdit"`.
- next: → `Gateway_ProposalReady` (Proposed change ready)

### Merge — Proposed change ready (`Gateway_ProposalReady`)

- Nothing to do or decide: the paths meet here and the engine passes through.
- next: → `Gateway_ValidationFork` (Run HCI validation)

### Do all of — Run HCI validation (`Gateway_ValidationFork`)

- Work every branch; none is optional. Branches: → `Task_SchemaValidate` (Schema and constraint checks), → `Task_SyntaxSpell` (Syntax, spelling and links), → `Task_BuildGates` (Build and QA gates), → `Gateway_ReviewerKind` (Judgement call?)
- The engine passes through this gateway itself; there is nothing to record here.

### 5. Schema and constraint checks (`Task_SchemaValidate`)

- Who: the `Mechanical validation (system)` lane (role `validation-pipeline`).
- Skill: `content-validate`.
- What: Block schema, label prefixes, required fields, constraint rules.
- Record it: `workflow_complete` with `node: "Task_SchemaValidate"`.
- next: → `Gateway_ValidationJoin` (All checks reported)

### 6. Syntax, spelling and links (`Task_SyntaxSpell`)

- Who: the `Mechanical validation (system)` lane (role `validation-pipeline`).
- Skill: `content-validate`.
- What: Syntax, spelling, cross-references, citation and link resolution.
- Record it: `workflow_complete` with `node: "Task_SyntaxSpell"`.
- next: → `Gateway_ValidationJoin` (All checks reported)

### 7. Build and QA gates (`Task_BuildGates`)

- Who: the `Mechanical validation (system)` lane (role `validation-pipeline`).
- Skill: `content-test`.
- What: Lean build and proof status, LaTeX compile, FHIR/SUSHI validation, QA axes.
- Record it: `workflow_complete` with `node: "Task_BuildGates"`.
- next: → `Gateway_ValidationJoin` (All checks reported)

### Decide — Judgement call? (`Gateway_ReviewerKind`)

- Does this change need a judgement call?
- Call `workflow_complete` with `node: "Gateway_ReviewerKind"` and `outcome` set to the label that holds:
  - «no» → `Task_AgentReview` (Agent review of the change)
  - «yes» → `Task_SmeReview` (Human / SME review)

### Wait for all — All checks reported (`Gateway_ValidationJoin`)

- Continue only when every one of the 4 incoming branches is done; the engine passes through itself.
- next: → `Task_CollateFindings` (Collate findings into a report)

### 8. Agent review of the change (`Task_AgentReview`)

- Who: the `Non-mechanical validation (review agent or SME)` lane (role `reviewer`).
- Skill: `content-review`.
- What: A review agent judges what no checker can: accuracy, voice, exposition, whether the change says what the editor meant.
- Record it: `workflow_complete` with `node: "Task_AgentReview"`.
- next: → `Gateway_ReviewerJoin`

### 9. Human / SME review (`Task_SmeReview`)

- Who: the `Non-mechanical validation (review agent or SME)` lane (role `reviewer`).
- Skill: `content-review`.
- What: Escalated to a human reviewer or subject-matter expert when the change turns on clinical or scientific judgement.
- Record it: `workflow_complete` with `node: "Task_SmeReview"`.
- next: → `Gateway_ReviewerJoin`

### 10. Collate findings into a report (`Task_CollateFindings`)

- Who: the `HCI validation pipeline (system)` lane (role `validation-pipeline`).
- Skill: `content-validate`, `content-validate`, `content-validate`.
- What: Mechanical results and review findings are merged into one report against the proposed change.
- Record it: `workflow_complete` with `node: "Task_CollateFindings"`.
- next: → `Task_LogFindings` (Log findings on the bean)

### Merge — `Gateway_ReviewerJoin`

- Nothing to do or decide: the paths meet here and the engine passes through.
- next: → `Gateway_ValidationJoin` (All checks reported)

### 11. Log findings on the bean (`Task_LogFindings`)

- Who: the `Authoring agent (system)` lane (role `authoring-agent`).
- Skill: `todo-manager`.
- What: Findings are appended to the bean, so the next agent or human sees what is outstanding.
- Record it: `workflow_complete` with `node: "Task_LogFindings"`.
- next: → `Task_ReviewFindings` (Review the findings)

### 12. Review the findings (`Task_ReviewFindings`)

- Who: the `Editor / author (person)` lane (role `author`).
- Skill: `decision-audit`, `decision-audit`, `decision-audit`.
- What: THE GATE: the editor sees every finding BEFORE anything reaches the corpus.
- Record it: `workflow_complete` with `node: "Task_ReviewFindings"`.
- next: → `Call_OptionsAnalysis` (Options analysis accept · revise · discard)

### 13. Options analysis accept · revise · discard (`Call_OptionsAnalysis`)

- Who: the `Authoring agent (system)` lane (role `authoring-agent`).
- What: On the edge out of `Task_ReviewFindings` and before `Task_RecordDecision`: the findings are the evidence, so the options can only be weighed once they exist, and after `Task_RecordDecision` the decision is already written down.
- A subprocess (`Process_OptionsAnalysis`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Task_RecordDecision` (Record the decision and audit note)

### 14. Record the decision and audit note (`Task_RecordDecision`)

- Who: the `Editor / author (person)` lane (role `author`).
- Skill: `decision-audit`.
- What: A decision is an act ABOUT the findings, not a finding.
- Record it: `workflow_complete` with `node: "Task_RecordDecision"`.
- next: → `Gateway_EditorDecision` (Accept, revise or discard?)

### Decide — Accept, revise or discard? (`Gateway_EditorDecision`)

- The editor's recorded decision, with its audit note.
- Call `workflow_complete` with `node: "Gateway_EditorDecision"` and `outcome` set to the label that holds:
  - «revise» → `Task_ReviseEdit` (Revise the proposed change)
  - «discard» → `Task_ResolveBean` (Close the bean)
  - «accept» → `Task_Commit` (Commit into the corpus)

### 15. Revise the proposed change (`Task_ReviseEdit`)

- Who: the `Authoring agent (system)` lane (role `authoring-agent`).
- Skill: `content-author`, `before-after-preview`.
- What: The editor chose revise: rework the proposed change against the findings the editor reviewed, then send it back through validation as a new proposal.
- Record it: `workflow_complete` with `node: "Task_ReviseEdit"`.
- next: → `Gateway_ProposalReady` (Proposed change ready)

### 16. Close the bean (`Task_ResolveBean`)

- Who: the `Authoring agent (system)` lane (role `authoring-agent`).
- Skill: `todo-manager`.
- What: Process_BeanClose: end the bean in a state that says why — complete and archive it, scrap it with its reasons and archive it, or record the blocker and hand it back.
- A subprocess (`Process_BeanClose`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_BeanClosedHow` (How did it end?)

### 17. Commit into the corpus (`Task_Commit`)

- Who: the `Authoring agent (system)` lane (role `authoring-agent`).
- Skill: `corpus-commit-contract`.
- What: Only now does the change become corpus content, together with its QA sidecars.
- Record it: `workflow_complete` with `node: "Task_Commit"`.
- next: → `Task_ResolveBean` (Close the bean)

### Decide — How did it end? (`GW_BeanClosedHow`)

- Which outcome the bean was closed with, so each ends at its own named end event.
- Call `workflow_complete` with `node: "GW_BeanClosedHow"` and `outcome` set to the label that holds:
  - «in the corpus» → `EndEvent_InCorpus` (Change is in the corpus)
  - «discarded» → `EndEvent_Discarded` (Change discarded)

## Done — Change is in the corpus (`EndEvent_InCorpus`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Change discarded (`EndEvent_Discarded`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
