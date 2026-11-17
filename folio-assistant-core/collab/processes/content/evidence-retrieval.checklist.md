<!-- GENERATED from folio-assistant-core/collab/processes/content/evidence-retrieval.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Evidence for a recommendation

> **Generated, and not the authority.** This is `folio-assistant-core/collab/processes/content/evidence-retrieval.bpmn` (process `Process_EvidenceRetrieval`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Frame a question for a recommendation, retrieve and appraise evidence from trusted sources, and either attach it or record the gap; a change that states or alters no recommendation ends at its own event before any search.

## Begin — An edit is about to be drafted (`StartEvent_Recommendation`)

- Begin here.
- Call `workflow_start` with `process: "Process_EvidenceRetrieval"` and the subject this run is about; keep the instance id it returns.
- next: → `Gateway_RecommendationInPlay` (Does the change state or alter a recommendation?)

### Decide — Does the change state or alter a recommendation? (`Gateway_RecommendationInPlay`)

- The author answers before any search starts.
- Call `workflow_complete` with `node: "Gateway_RecommendationInPlay"` and `outcome` set to the label that holds:
  - «yes» → `Task_ReviewExisting` (Review the existing guidance)
  - «no» → `EndEvent_NoRecommendation` (No recommendation in this change)

### 1. Review the existing guidance (`Task_ReviewExisting`)

- Who: the `Author / guideline developer (person)` lane (role `author`).
- Skill: `content-review`.
- What: The author reads what the document, DAK or IG ALREADY says on this question, before looking outward.
- Record it: `workflow_complete` with `node: "Task_ReviewExisting"`.
- next: → `Task_FramePico` (Frame the question as PICO)

## Done — No recommendation in this change (`EndEvent_NoRecommendation`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 2. Frame the question as PICO (`Task_FramePico`)

- Who: the `Author / guideline developer (person)` lane (role `author`).
- Skill: `content-author`.
- What: Population, Intervention, Comparator, Outcome.
- Record it: `workflow_complete` with `node: "Task_FramePico"`.
- next: → `Gateway_RetrievalFork` (Retrieve across evidence classes)

### Do all of — Retrieve across evidence classes (`Gateway_RetrievalFork`)

- Work every branch; none is optional. Branches: → `Task_L1Sources` (Search trusted L1 sources), → `Task_L2L3Content` (Search trusted L2 and L3 content), → `Task_DataRepos` (Query data repositories and statistical datasets)
- The engine passes through this gateway itself; there is nothing to record here.

### 3. Search trusted L1 sources (`Task_L1Sources`)

- Who: the `Evidence agent (system)` lane (role `evidence-agent`).
- Skill: `document-intake`.
- What: Ingested primary literature under library/: the sections/*.md tree and, where a document was scanned, ocr/page-NNN.txt.
- Record it: `workflow_complete` with `node: "Task_L1Sources"`.
- next: → `Gateway_RetrievalJoin` (Candidates assembled)

### 4. Search trusted L2 and L3 content (`Task_L2L3Content`)

- Who: the `Evidence agent (system)` lane (role `evidence-agent`).
- Skill: `document-intake`, `document-intake`, `document-intake`.
- What: Already-adjudicated guidance: WHO SMART DAKs at L2 and FHIR Implementation Guides at L3.
- Record it: `workflow_complete` with `node: "Task_L2L3Content"`.
- next: → `Gateway_RetrievalJoin` (Candidates assembled)

### 5. Query data repositories and statistical datasets (`Task_DataRepos`)

- Who: the `Evidence agent (system)` lane (role `evidence-agent`).
- Skill: `document-intake`, `document-intake`, `document-intake`.
- What: Indicator and microdata sources.
- Record it: `workflow_complete` with `node: "Task_DataRepos"`.
- next: → `Gateway_RetrievalJoin` (Candidates assembled)

### Wait for all — Candidates assembled (`Gateway_RetrievalJoin`)

- Continue only when every one of the 3 incoming branches is done; the engine passes through itself.
- next: → `Task_VerifyAuthority` (Verify authority against the registry)

### 6. Verify authority against the registry (`Task_VerifyAuthority`)

- Who: the `Trusted registries and observatories (external)` lane (role `external-registry`).
- Skill: `registry-authority-contract`.
- What: Each candidate is resolved against the standard API of the body that publishes it, so that 'authoritative' is a RESOLVED FACT rather than an assertion in the citation.
- Record it: `workflow_complete` with `node: "Task_VerifyAuthority"`.
- next: → `Gateway_Authoritative` (Authority confirmed?)

### Decide — Authority confirmed? (`Gateway_Authoritative`)

- Answered by checking the source against the observatory or registry API: is its authority confirmed?
- Call `workflow_complete` with `node: "Gateway_Authoritative"` and `outcome` set to the label that holds:
  - «no» → `Task_RecordUnverified` (Open a bean for the unverified citation)
  - «yes» → `Task_AppraiseGrade` (Appraise and grade the body of evidence)

### 7. Open a bean for the unverified citation (`Task_RecordUnverified`)

- Who: the `Author / guideline developer (person)` lane (role `author`).
- Skill: `todo-manager`.
- What: An unresolvable citation is not dropped and not silently kept.
- Record it: `workflow_complete` with `node: "Task_RecordUnverified"`.
- next: → `Task_AppraiseGrade` (Appraise and grade the body of evidence)

### 8. Appraise and grade the body of evidence (`Task_AppraiseGrade`)

- Who: the `Author / guideline developer (person)` lane (role `author`).
- Skill: `evidence-appraisal`.
- What: Certainty of evidence per the grading system the folio declares.
- Record it: `workflow_complete` with `node: "Task_AppraiseGrade"`.
- next: → `Gateway_Sufficient` (Sufficient for a recommendation?)

### Decide — Sufficient for a recommendation? (`Gateway_Sufficient`)

- Answered by the appraisal: is the graded evidence enough to support a recommendation?
- Call `workflow_complete` with `node: "Gateway_Sufficient"` and `outcome` set to the label that holds:
  - «no» → `Task_RecordGap` (Record the evidence gap)
  - «yes» → `Task_AttachEvidence` (Attach the evidence)

### 9. Record the evidence gap (`Task_RecordGap`)

- Who: the `Author / guideline developer (person)` lane (role `author`).
- Skill: `todo-manager`.
- What: Insufficient evidence is a RESULT.
- Record it: `workflow_complete` with `node: "Task_RecordGap"`.
- next: → `EndEvent_GapRecorded` (Gap recorded, no recommendation)

### 10. Attach the evidence (`Task_AttachEvidence`)

- Who: the `Author / guideline developer (person)` lane (role `author`).
- Skill: `content-author`.
- What: The PICO, the graded body of evidence, each verified citation and its resolved authority record are written onto the recommendation block, so a reader can retrace the whole chain from the sentence back to the source.
- Record it: `workflow_complete` with `node: "Task_AttachEvidence"`.
- next: → `EndEvent_EvidenceAttached` (Recommendation is evidence-backed)

## Done — Gap recorded, no recommendation (`EndEvent_GapRecorded`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Recommendation is evidence-backed (`EndEvent_EvidenceAttached`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
