<!-- GENERATED from folio-assistant-core/collab/processes/content/draft-to-publication.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Draft, review and publish

> **Generated, and not the authority.** This is `folio-assistant-core/collab/processes/content/draft-to-publication.bpmn` (process `Process_Publication`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

How the corpus becomes an officially published folio: a draft publication, its review, and the release authority's decision.

## Begin — Corpus updated (`StartEvent_CorpusUpdated`)

- Begin here: One or more content blocks have landed in the corpus through the editing process.
- Call `workflow_start` with `process: "Process_Publication"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_OpenReleaseBean` (Open the bean)

### 1. Open the bean (`Task_OpenReleaseBean`)

- Who: the `Build pipeline (system)` lane (role `build-pipeline`).
- Skill: `bean-coordination`.
- What: Process_BeanOpen: check before you create, find out whose the bean is, and claim it — or leave it alone when it is someone else's.
- A subprocess (`Process_BeanOpen`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_BeanYours` (Bean claimed?)

### Decide — Bean claimed? (`GW_BeanYours`)

- Reads which end Process_BeanOpen reached.
- Call `workflow_complete` with `node: "GW_BeanYours"` and `outcome` set to the label that holds:
  - «claimed» → `Gateway_BuildMerge`
  - «not yours» → `End_BeanNotYours` (Not yours — left alone)

### Merge — `Gateway_BuildMerge`

- Nothing to do or decide: the paths meet here and the engine passes through.
- next: → `Task_BuildDraft` (Build the draft publication)

## Done — Not yours — left alone (`End_BeanNotYours`)

- The instance completes here: Someone else holds the bean; this run stops without touching it. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 2. Build the draft publication (`Task_BuildDraft`)

- Who: the `Build pipeline (system)` lane (role `build-pipeline`).
- Skill: `content-publish`.
- What: Render the corpus into the draft form of the folio: PDF, HTML site, or FHIR IG.
- Record it: `workflow_complete` with `node: "Task_BuildDraft"`.
- next: → `Task_PublicationQa` (Run publication QA gates)

### 3. Run publication QA gates (`Task_PublicationQa`)

- Who: the `Build pipeline (system)` lane (role `build-pipeline`).
- Skill: `content-test`, `quality-control`.
- What: Publication-readiness QA across layers — QC reports, IG Publisher QA, proof status, broken links, build warnings.
- Record it: `workflow_complete` with `node: "Task_PublicationQa"`.
- next: → `Gateway_QaGreen` (Draft QA green?)

### Decide — Draft QA green? (`Gateway_QaGreen`)

- Answered by the publication QA gates.
- Computed by the DMN table `decisions/draft-qa-gate.dmn#Decision_DraftQaGate`: call `workflow_complete` with `node: "Gateway_QaGreen"` and the `facts` it reads — the table returns the branch; pass no `outcome`.
  - «no» → `CallActivity_Editing` (Editing and HCI validation)
  - «yes» → `Task_CirculateDraft` (Circulate the draft)

### 4. Editing and HCI validation (`CallActivity_Editing`)

- Who: the `Editors + authoring agents` lane (role `editor`).
- Skill: `content-author`, `content-validate`.
- What: The editing sub-process.
- A subprocess (`Process_Editing`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Gateway_BuildMerge`

### 5. Circulate the draft (`Task_CirculateDraft`)

- Who: the `Publication manager` lane (role `publication-manager`).
- Skill: `content-review`, `staging-review`.
- What: The draft publication is circulated to the review team for formal review.
- Record it: `workflow_complete` with `node: "Task_CirculateDraft"`.
- next: → `Gateway_ReviewFork` (Draft under review)

### Do all of — Draft under review (`Gateway_ReviewFork`)

- Work every branch; none is optional. Branches: → `Task_ReviewDraft` (Review the draft publication), → `Task_SmeSignoff` (Clinical or scientific sign-off), → `CallActivity_PublicComment` (Release for public comment)
- The engine passes through this gateway itself; there is nothing to record here.

### 6. Review the draft publication (`Task_ReviewDraft`)

- Who: the `Review team (content · QC · technical officer)` lane (role `reviewer`).
- Skill: `content-review`, `staging-review`.
- What: Content reviewer, QC reviewer and technical officer review the draft as a whole — coherence, phase-gate criteria, breaking vs non-breaking change.
- Record it: `workflow_complete` with `node: "Task_ReviewDraft"`.
- next: → `Gateway_ReviewJoin`

### 7. Clinical or scientific sign-off (`Task_SmeSignoff`)

- Who: the `Clinical / scientific SMEs` lane (role `clinical-sme`).
- Skill: `content-review`, `staging-review`.
- What: Domain sign-off: clinical SMEs for a guideline, subject-matter reviewers for a paper.
- Record it: `workflow_complete` with `node: "Task_SmeSignoff"`.
- next: → `Gateway_ReviewJoin`

### 8. Release for public comment (`CallActivity_PublicComment`)

- Who: the `Public review (commenters, review committee, editor)` lane (role `review-coordinator`).
- Skill: `public-comment`.
- What: When the draft goes out for public comment: the release date is agreed, the draft is frozen as a line-numbered public comment release, every channel is set up against it and announced, and the comments that come back are placed, triaged, recommended on by the review committee and decided by the edit
- A subprocess (`Process_PublicCommentRelease`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `Gateway_ReviewJoin`

### Wait for all — `Gateway_ReviewJoin`

- Continue only when every one of the 3 incoming branches is done; the engine passes through itself.
- next: → `Gateway_ReviewOutcome` (Approved?)

### Decide — Approved? (`Gateway_ReviewOutcome`)

- Asked once every reviewer has answered: is the draft approved?
- Call `workflow_complete` with `node: "Gateway_ReviewOutcome"` and `outcome` set to the label that holds:
  - «no» → `Task_OpenChangeBeans` (Open beans for the change requests)
  - «yes» → `Task_AuthorizeRelease` (Authorise the release)

### 9. Open beans for the change requests (`Task_OpenChangeBeans`)

- Who: the `Publication manager` lane (role `publication-manager`).
- Skill: `todo-manager`, `content-feedback`.
- What: Each requested change becomes a bean, so the editors and agents picking the work up next see exactly what review asked for and what is still open.
- Record it: `workflow_complete` with `node: "Task_OpenChangeBeans"`.
- next: → `CallActivity_Editing` (Editing and HCI validation)

### 10. Authorise the release (`Task_AuthorizeRelease`)

- Who: the `Programme manager (release authority)` lane (role `programme-manager`).
- Skill: `content-publish`.
- What: Publication requires authorisation by the programme manager or designated authority.
- Record it: `workflow_complete` with `node: "Task_AuthorizeRelease"`.
- next: → `Task_PublishRelease` (Version, tag and publish)

### 11. Version, tag and publish (`Task_PublishRelease`)

- Who: the `Publication manager` lane (role `publication-manager`).
- Skill: `content-publish`, `render-kg-to-cdn`.
- What: Version bump, release notes, tag, build the final artifacts, deploy to the publication platform.
- Record it: `workflow_complete` with `node: "Task_PublishRelease"`.
- next: → `Task_CloseReleaseBeans` (Close the release beans)

### 12. Close the release beans (`Task_CloseReleaseBeans`)

- Who: the `Publication manager` lane (role `publication-manager`).
- Skill: `todo-manager`.
- What: What shipped is resolved; what slipped stays open and carries into the next cycle.
- Record it: `workflow_complete` with `node: "Task_CloseReleaseBeans"`.
- next: → `Task_ArchiveReleaseBean` (Close the bean)

### 13. Close the bean (`Task_ArchiveReleaseBean`)

- Who: the `Publication manager` lane (role `publication-manager`).
- Skill: `todo-manager`.
- What: Process_BeanClose: end the bean in a state that says why — complete and archive it, scrap it with its reasons and archive it, or record the blocker and hand it back.
- A subprocess (`Process_BeanClose`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `EndEvent_Published` (Published officially)

## Done — Published officially (`EndEvent_Published`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
