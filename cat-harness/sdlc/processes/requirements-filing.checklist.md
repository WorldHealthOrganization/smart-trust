<!-- GENERATED from cat-harness/sdlc/processes/requirements-filing.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Requirements filing: promote, organise, trace, supersede, or retire

> **Generated, and not the authority.** This is `cat-harness/sdlc/processes/requirements-filing.bpmn` (process `Process_RequirementsFiling`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

How a proposal in docs/proposals/<slug>.md is promoted into docs/requirements/<slug>.md when its feature ships, or how an existing filed requirement is amended in place, superseded by a new requirement (status: superseded + supersededBy: req:<new-slug>), or retired (status: retired) without deleting

## Begin — Feature ready to file or requirement lifecycle change requested (`Start_Process_RequirementsFiling`)

- Begin here.
- Call `workflow_start` with `process: "Process_RequirementsFiling"` and the subject this run is about; keep the instance id it returns.
- next: → `A_ClassifyFiling` (Classify filing mode, concern group, and req:<slug> ID)

### 1. Classify filing mode, concern group, and req:<slug> ID (`A_ClassifyFiling`)

- Who: the `Authoring Agent` lane (role `authoring-agent`).
- Skill: `crdm-requirements-workflow`.
- What: Determine whether this filing promotes a proposal from docs/proposals/<slug>.md (promote), amends an existing requirement or replaces it with a new requirement (amend-or-supersede), or retires an obsolete requirement (retire).
- Record it: `workflow_complete` with `node: "A_ClassifyFiling"`.
- next: → `GW_FilingMode` (Which filing transition?)

### Decide — Which filing transition? (`GW_FilingMode`)

- Branches on the kind of requirement filing transition: promoting a proposal from docs/proposals/<slug>.md (`promote`), amending an existing requirement or superseding an older requirement (`amend-or-supersede`), or retiring an obsolete requirement (`retire`).
- Call `workflow_complete` with `node: "GW_FilingMode"` and `outcome` set to the label that holds:
  - «promote» → `A_PromoteOrUpdate` (git mv proposal to docs/requirements/<slug>.md and record proposedIn)
  - «amend-or-supersede» → `A_BindFrontMatter` (Bind Requirement front matter, statements, and 3-axis lineage)
  - «retire» → `A_UpdateLifecycle` (Mark the record superseded or retired)

### 2. git mv proposal to docs/requirements/<slug>.md and record proposedIn (`A_PromoteOrUpdate`)

- Who: the `Authoring Agent` lane (role `authoring-agent`).
- Skill: `crdm-requirements-workflow`.
- What: Record the last commit SHA touching docs/proposals/<slug>.md, execute `git mv docs/proposals/<slug>.md docs/requirements/<slug>.md` so git log --follow preserves the proposal's history, and record `proposedIn: { commit, path: "docs/proposals/<slug>.md" }` in the YAML front matter.
- Record it: `workflow_complete` with `node: "A_PromoteOrUpdate"`.
- next: → `A_BindFrontMatter` (Bind Requirement front matter, statements, and 3-axis lineage)

### 3. Bind Requirement front matter, statements, and 3-axis lineage (`A_BindFrontMatter`)

- Who: the `Authoring Agent` lane (role `authoring-agent`).
- Skill: `specification-management`.
- What: Author or update the YAML front matter conforming to bootstrap/schemas/requirement.schema.json: `id: req:<slug>`, `title`, `status`, `statements[]` (each with stable `#<key>`, RFC 2119 modality MUST/SHOULD/MAY, normative statement, and measurable successCriteria), backward lineage (`proposedIn`, `de
- Record it: `workflow_complete` with `node: "A_BindFrontMatter"`.
- next: → `A_UpdateLifecycle` (Mark the record superseded or retired)

### 4. Mark the record superseded or retired (`A_UpdateLifecycle`)

- Who: the `Authoring Agent` lane (role `authoring-agent`).
- Skill: `specification-management`.
- What: Never delete (`git rm`) a superseded or retired requirement.
- Record it: `workflow_complete` with `node: "A_UpdateLifecycle"`.
- next: → `A_UpdateIndex` (Organise entry in docs/requirements/index.md by concern group & status)

### 5. Organise entry in docs/requirements/index.md by concern group & status (`A_UpdateIndex`)

- Who: the `Authoring Agent` lane (role `authoring-agent`).
- Skill: `crdm-requirements-workflow`.
- What: Add or update the requirement's row in `docs/requirements/index.md` under its canonical concern group (`sdlc`, `process`, `tools`, `kg`, `library`, `content`, `ui`, `conduct` from `code-lists/concern-group.json`) for `in-force` requirements, or move it to the Superseded and Retired Requirements tabl
- Record it: `workflow_complete` with `node: "A_UpdateIndex"`.
- next: → `A_RunCheck` (Run the requirements check)

### 6. Run the requirements check (`A_RunCheck`)

- Who: the `Authoring Agent` lane (role `authoring-agent`).
- Skill: `specification-management`.
- What: Run `bun run cat check:requirements` to verify schema conformance (`bootstrap/schemas/requirement.schema.json`), slug uniqueness across `docs/proposals/` and `docs/requirements/`, acyclicity of `derivedFrom`, existence of all referenced `derivedFrom` / `dependsOn` / `supersededBy` / `skills` / `proc
- Record it: `workflow_complete` with `node: "A_RunCheck"`.
- next: → `GW_CheckPassed` (check:requirements clean?)

### Decide — check:requirements clean? (`GW_CheckPassed`)

- Branches on the exit code of `bun run cat check:requirements`: any schema violation, slug collision, cycle in `derivedFrom`, or unresolved reference loops back to `A_BindFrontMatter` before human review.
- Call `workflow_complete` with `node: "GW_CheckPassed"` and `outcome` set to the label that holds:
  - «fail» → `A_BindFrontMatter` (Bind Requirement front matter, statements, and 3-axis lineage)
  - «pass» → `BA_ReviewFiling` (Review the filed requirement, sign off)

### 7. Review the filed requirement, sign off (`BA_ReviewFiling`)

- Who: the `BA / Feature Requestor` lane (role `business-analyst`).
- Skill: `adjudication`.
- What: The Business Analyst / Owner reviews the filed requirement in `docs/requirements/<slug>.md`, its concern-group organisation in `docs/requirements/index.md`, its three-axis traceability, and any supersession or retirement update, deciding `approve`, `amend`, `reject`, `defer`, or `cancel`.
- A subprocess (`Process_Adjudication`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `A_RecordFilingSignoff` (Record the sign-off and set the stage)

### 8. Record the sign-off and set the stage (`A_RecordFilingSignoff`)

- Who: the `Authoring Agent` lane (role `authoring-agent`).
- Skill: `adjudication`.
- What: Append the human sign-off decision to `test/attestations/requirement-signoff/<set-slug>.attestations.json` (recording who, at, scope, outcome, stage, reason, and issue comment permalink) and update the `RequirementSet` stage to match.
- Record it: `workflow_complete` with `node: "A_RecordFilingSignoff"`.
- next: → `GW_FilingAccepted` (Filing accepted?)

### Decide — Filing accepted? (`GW_FilingAccepted`)

- Routes on the recorded `requirement-signoff` outcome from `BA_ReviewFiling`: `approve` or `amend` completes the filing; `reject`, `defer`, or `cancel` holds the filing with its recorded reason.
- Call `workflow_complete` with `node: "GW_FilingAccepted"` and `outcome` set to the label that holds:
  - «approve / amend» → `End_RequirementFiled` (Requirement filed and organised in docs/requirements/)
  - «reject / defer / cancel» → `End_FilingHeld` (Filing held or deferred — recorded with reason)

## Done — Requirement filed and organised in docs/requirements/ (`End_RequirementFiled`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Filing held or deferred — recorded with reason (`End_FilingHeld`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
