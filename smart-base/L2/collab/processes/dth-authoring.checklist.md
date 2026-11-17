<!-- GENERATED from smart-base/L2/collab/processes/dth-authoring.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — DTH authoring

> **Generated, and not the authority.** This is `smart-base/L2/collab/processes/dth-authoring.bpmn` (process `Process_DthAuthoring`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Produces a WHO Digital Transformation Handbook (DTH) from its sources to publication, in seven stages that each end in a recorded milestone: initiate (M0 charter), ingest sources into the library (M1 library frozen), outline and scope (M2 outline agreed), structured drafting (M3 zero draft), working

## Begin — DTH requested (`Start_Requested`)

- Begin here.
- Call `workflow_start` with `process: "Process_DthAuthoring"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_Scope` (0 · Scope the DTH and place it in the DIIG)

### 1. 0 · Scope the DTH and place it in the DIIG (`Task_Scope`)

- Who: the `DTH lead (programme manager)` lane (role `programme-manager`).
- Skill: `content-plan`.
- What: Name the health-system area, the audience and the DIIG phase the handbook supports, citing the one DIIG phase figure (DIIG section 1.1, Figure 1.1.1).
- Record it: `workflow_complete` with `node: "Task_Scope"`.
- next: → `Task_Team` (Form the TWG; record roles and RACI)

### 2. Form the TWG; record roles and RACI (`Task_Team`)

- Who: the `DTH lead (programme manager)` lane (role `programme-manager`).
- Skill: `content-plan`.
- What: Record who is involved and in which role.
- Record it: `workflow_complete` with `node: "Task_Team"`.
- next: → `Task_Scaffold` (Create the DTH repository from the DTH layout)

### 3. Create the DTH repository from the DTH layout (`Task_Scaffold`)

- Who: the `Business analyst` lane (role `business-analyst`).
- Skill: `document-structure`.
- What: Run `bun run smart-base/scripts/dth-init.ts` with --pins-from an existing DTH's index.config.json.
- Record it: `workflow_complete` with `node: "Task_Scaffold"`.
- next: → `Task_SeedBeans` (Seed the work plan)

### 4. Seed the work plan (`Task_SeedBeans`)

- Who: the `Work plan (beans)` lane (role `work-plan`).
- Skill: `todo-manager`.
- What: One bean per stage and per drafting track, children of the handbook's epic.
- Record it: `workflow_complete` with `node: "Task_SeedBeans"`.
- next: → `M0` (Record milestone M0 · Charter recorded)

### 5. Record milestone M0 · Charter recorded (`M0`)

- Who: the `Work plan (beans)` lane (role `work-plan`).
- Skill: `todo-manager`.
- What: Milestone: repository, declaration, TWG, roles and RACI exist.
- Record it: `workflow_complete` with `node: "M0"`.
- next: → `Task_Ingest` (1 · Ingest sources into library/)

### 6. 1 · Ingest sources into library/ (`Task_Ingest`)

- Who: the `Librarian` lane (role `librarian`).
- Skill: `library-ingestion`.
- What: Every source as received, frozen: WHO publications through who-iris, the TWG outline and workbooks from uploads/.
- Record it: `workflow_complete` with `node: "Task_Ingest"`.
- next: → `Task_L1` (Extract L1 from WHO publications)

### 7. Extract L1 from WHO publications (`Task_L1`)

- Who: the `Librarian` lane (role `librarian`).
- Skill: `l1-document-ingestion`.
- What: Sections, figures, tables and the L1 knowledge graph for each WHO publication the handbook draws on.
- Record it: `workflow_complete` with `node: "Task_L1"`.
- next: → `Task_Coverage` (Account for every normative sentence)

### 8. Account for every normative sentence (`Task_Coverage`)

- Who: the `Librarian` lane (role `librarian`).
- Skill: `l1-coverage`.
- What: Each normative sentence is captured or excluded; exclusions are signed by a person, never by the agent that proposed them.
- Record it: `workflow_complete` with `node: "Task_Coverage"`.
- next: → `Call_PublishStatements` (Publish extracted statements)

### 9. Publish extracted statements (`Call_PublishStatements`)

- Who: the `Business analyst` lane (role `business-analyst`).
- Skill: `publish-extracted-statements`.
- What: Statements extracted from the L1 sources (recommendations, requirements, scenario candidates) are published as pages of the handbook and in the shared l1-extraction viewer, each linked to its library entry and section, once coverage has accounted for every normative sentence and before the library i
- A subprocess (`Process_PublishExtractedStatements`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `M1` (Record milestone M1 · Library frozen)

### 10. Record milestone M1 · Library frozen (`M1`)

- Who: the `Librarian` lane (role `librarian`).
- Skill: `todo-manager`.
- What: Milestone: every source in library/, coverage accounted.
- Record it: `workflow_complete` with `node: "M1"`.
- next: → `Task_Outline` (2 · Outline chapters against the dth kind)

### 11. 2 · Outline chapters against the dth kind (`Task_Outline`)

- Who: the `Business analyst` lane (role `business-analyst`).
- Skill: `document-structure`.
- What: Map the outline onto the dth document kind's sections and report every required section that is missing.
- Record it: `workflow_complete` with `node: "Task_Outline"`.
- next: → `Task_Intro` (Draft introduction, audience and DIIG alignment)

### 12. Draft introduction, audience and DIIG alignment (`Task_Intro`)

- Who: the `Business analyst` lane (role `business-analyst`).
- Skill: `document-authoring`.
- What: The three required opening sections of the dth kind: audience and how to use, DIIG and SMART alignment, health programme context.
- Record it: `workflow_complete` with `node: "Task_Intro"`.
- next: → `Task_GlossaryCandidates` (Build glossary candidates from the TWG workbook)

### 13. Build glossary candidates from the TWG workbook (`Task_GlossaryCandidates`)

- Who: the `Terminologist` lane (role `terminologist`).
- Skill: `terminology-management`.
- What: One SKOS candidate per (concept, source); only a person moves a term to authored.
- Record it: `workflow_complete` with `node: "Task_GlossaryCandidates"`.
- next: → `Task_Inventory` (List processes, roles, decisions and indicators to model)

### 14. List processes, roles, decisions and indicators to model (`Task_Inventory`)

- Who: the `Business analyst` lane (role `business-analyst`).
- Skill: `content-plan`.
- What: The inventory that seeds the structured-drafting tracks: each business process becomes BPMN, each role a structured block, each stated decision rule a DMN table.
- Record it: `workflow_complete` with `node: "Task_Inventory"`.
- next: → `Task_OutlineReview` (TWG reviews the outline)

### 15. TWG reviews the outline (`Task_OutlineReview`)

- Who: the `TWG and contributors` lane (role `feedback-provider`).
- Skill: `content-feedback`.
- What: First contributor-feedback round, through the contributor log sheet and GitHub.
- Record it: `workflow_complete` with `node: "Task_OutlineReview"`.
- next: → `M2` (Record milestone M2 · Outline agreed)

### 16. Record milestone M2 · Outline agreed (`M2`)

- Who: the `TWG and contributors` lane (role `feedback-provider`).
- Skill: `todo-manager`.
- What: Milestone: the outline's round-1 comments are dispositioned.
- Record it: `workflow_complete` with `node: "M2"`.
- next: → `GW_DraftMerge`

### Merge — `GW_DraftMerge`

- Nothing to do or decide: the paths meet here and the engine passes through.
- next: → `GW_DraftFork` (3 · Structured drafting)

### Do all of — 3 · Structured drafting (`GW_DraftFork`)

- Work every branch; none is optional. Branches: → `Call_Personas` (Personas and roles), → `Call_Scenarios` (User scenarios), → `Call_Bpmn` (Business processes · BPMN), → `Call_Dmn` (Decision tables · DMN), → `Call_Data` (Data elements, indicators, requirements), → `Call_Steps` (Planning steps per chapter), → `Call_Archimate` (Link to smart-ra ArchiMate), → `Call_Glossary` (Link glossary to smart-ra SKOS)
- The engine passes through this gateway itself; there is nothing to record here.

### 17. Personas and roles (`Call_Personas`)

- Who: the `Business analyst` lane (role `business-analyst`).
- Skill: `l2-dak-authoring`, `l2-component-edit-review`.
- What: Persona and actor-definition blocks; organisational roles and governance bodies get their own kind once it exists.
- A subprocess (`Process_L2ComponentEditReview`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_DraftJoin`

### 18. User scenarios (`Call_Scenarios`)

- Who: the `Business analyst` lane (role `business-analyst`).
- Skill: `l2-dak-authoring`, `l2-component-edit-review`.
- What: User-scenario blocks naming their personas by id.
- A subprocess (`Process_L2ComponentEditReview`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_DraftJoin`

### 19. Business processes · BPMN (`Call_Bpmn`)

- Who: the `Business analyst` lane (role `business-analyst`).
- Skill: `bpmn-authoring`, `l2-component-edit-review`.
- What: One BPMN per business process; every lane bound to a persona or role id.
- A subprocess (`Process_L2ComponentEditReview`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_DraftJoin`

### 20. Decision tables · DMN (`Call_Dmn`)

- Who: the `Business analyst` lane (role `business-analyst`).
- Skill: `dmn-authoring`, `l2-component-edit-review`.
- What: Only rules the text states.
- A subprocess (`Process_L2ComponentEditReview`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_DraftJoin`

### 21. Data elements, indicators, requirements (`Call_Data`)

- Who: the `Business analyst` lane (role `business-analyst`).
- Skill: `l2-dak-authoring`, `indicator-extraction`, `l2-component-edit-review`.
- What: data-element, indicator, functional and non-functional requirement blocks, with their fields as data rather than Markdown tables.
- A subprocess (`Process_L2ComponentEditReview`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_DraftJoin`

### 22. Planning steps per chapter (`Call_Steps`)

- Who: the `Business analyst` lane (role `business-analyst`).
- Skill: `document-authoring`, `l2-component-edit-review`.
- What: Each chapter's inputs, steps, resources, outputs, risks and mitigations as the shared step table.
- A subprocess (`Process_L2ComponentEditReview`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_DraftJoin`

### 23. Link to smart-ra ArchiMate (`Call_Archimate`)

- Who: the `Business analyst` lane (role `business-analyst`).
- Skill: `archimate-models`, `l2-component-edit-review`.
- What: Every block that names an architecture element links to its smart-ra element or view; new elements go to smart-ra, not the handbook.
- A subprocess (`Process_L2ComponentEditReview`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_DraftJoin`

### 24. Link glossary to smart-ra SKOS (`Call_Glossary`)

- Who: the `Business analyst` lane (role `business-analyst`).
- Skill: `terminology-management`, `l2-component-edit-review`.
- What: Each handbook term is exactMatch, closeMatch or narrower to a smart-ra concept; conflicts are raised as issues on smart-ra.
- A subprocess (`Process_L2ComponentEditReview`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `GW_DraftJoin`

### Wait for all — `GW_DraftJoin`

- Continue only when every one of the 8 incoming branches is done; the engine passes through itself.
- next: → `GW_ReviewFork`

### Do all of — `GW_ReviewFork`

- Work every branch; none is optional. Branches: → `Task_Validate` (Validate the draft), → `Task_ArchReview` (Architect group and handbook owners review)
- The engine passes through this gateway itself; there is nothing to record here.

### 25. Validate the draft (`Task_Validate`)

- Who: the `Business analyst` lane (role `business-analyst`).
- Skill: `content-validate`.
- What: Every structured block validates against its kind; required dth sections present; no unlinked architecture names; no empirical claims in formal content.
- Record it: `workflow_complete` with `node: "Task_Validate"`.
- next: → `GW_ReviewJoin`

### 26. Architect group and handbook owners review (`Task_ArchReview`)

- Who: the `Architect group and handbook owners` lane (role `reviewer`).
- Skill: `content-review`.
- What: Runs beside validation, as QA.
- Record it: `workflow_complete` with `node: "Task_ArchReview"`.
- next: → `GW_ReviewJoin`

### Wait for all — `GW_ReviewJoin`

- Continue only when every one of the 2 incoming branches is done; the engine passes through itself.
- next: → `M3` (Record milestone M3 · Zero draft)

### 27. Record milestone M3 · Zero draft (`M3`)

- Who: the `Business analyst` lane (role `business-analyst`).
- Skill: `todo-manager`.
- What: Milestone: every required section drafted and every structured block validates.
- Record it: `workflow_complete` with `node: "M3"`.
- next: → `Task_Comments` (4 · Comment via contributor log sheet or GitHub pc:)

### 28. 4 · Comment via contributor log sheet or GitHub pc: (`Task_Comments`)

- Who: the `TWG and contributors` lane (role `feedback-provider`).
- Skill: `content-feedback`.
- What: The contributor log (Google Sheet) and pc: lines on GitHub issues and PRs.
- Record it: `workflow_complete` with `node: "Task_Comments"`.
- next: → `Task_Import` (Import into review/wg-comment and form change sets)

### 29. Import into review/wg-comment and form change sets (`Task_Import`)

- Who: the `Editor` lane (role `editor`).
- Skill: `public-comment`.
- What: public-comment import --store review/wg-comment; change sets group comments that change the same text.
- Record it: `workflow_complete` with `node: "Task_Import"`.
- next: → `GW_WgDone` (All working-group comments dispositioned?)

### Decide — All working-group comments dispositioned? (`GW_WgDone`)

- Call `workflow_complete` with `node: "GW_WgDone"` and `outcome` set to the label that holds:
  - «yes» → `M4` (Record milestone M4 · Working-group draft)
  - «no: revise» → `GW_DraftMerge`

### 30. Record milestone M4 · Working-group draft (`M4`)

- Who: the `Editor` lane (role `editor`).
- Skill: `todo-manager`.
- What: Milestone: all working-group comments dispositioned.
- Record it: `workflow_complete` with `node: "M4"`.
- next: → `Task_OpenPublic` (5 · Open public comment)

### 31. 5 · Open public comment (`Task_OpenPublic`)

- Who: the `Editor` lane (role `editor`).
- Skill: `public-comment`.
- What: A separate store, review/public-comment, and the public-comment review sheet.
- Record it: `workflow_complete` with `node: "Task_OpenPublic"`.
- next: → `M5` (Record milestone M5 · Public draft released)

### 32. Record milestone M5 · Public draft released (`M5`)

- Who: the `Editor` lane (role `editor`).
- Skill: `todo-manager`.
- What: Milestone: the public draft is out for comment.
- Record it: `workflow_complete` with `node: "M5"`.
- next: → `Task_PublicComments` (Public comments)

### 33. Public comments (`Task_PublicComments`)

- Who: the `TWG and contributors` lane (role `feedback-provider`).
- Skill: `content-feedback`.
- Record it: `workflow_complete` with `node: "Task_PublicComments"`.
- next: → `Task_Disposition` (Disposition comments and apply change sets)

### 34. Disposition comments and apply change sets (`Task_Disposition`)

- Who: the `Editor` lane (role `editor`).
- Skill: `public-comment`.
- What: Changes to structured content go back through its kind's edit-and-review subprocess.
- Record it: `workflow_complete` with `node: "Task_Disposition"`.
- next: → `M6` (Record milestone M6 · Comments dispositioned)

### 35. Record milestone M6 · Comments dispositioned (`M6`)

- Who: the `Editor` lane (role `editor`).
- Skill: `todo-manager`.
- What: Milestone: every public comment dispositioned.
- Record it: `workflow_complete` with `node: "M6"`.
- next: → `Task_Qa` (6 · Editorial, voice and translation QA)

### 36. 6 · Editorial, voice and translation QA (`Task_Qa`)

- Who: the `Editor` lane (role `editor`).
- Skill: `quality-control`.
- What: The DTH voice (smart-base skills/voices/who-digital-transformation-handbook), figures and translations.
- Record it: `workflow_complete` with `node: "Task_Qa"`.
- next: → `Task_Publish` (Publish the handbook)

### 37. Publish the handbook (`Task_Publish`)

- Who: the `Publication manager` lane (role `publication-manager`).
- Skill: `document-publishing`.
- Record it: `workflow_complete` with `node: "Task_Publish"`.
- next: → `End_Published` (M7 · Final published)

## Done — M7 · Final published (`End_Published`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
