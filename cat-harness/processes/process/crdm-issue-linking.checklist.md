<!-- GENERATED from cat-harness/processes/process/crdm-issue-linking.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — CRDM — link the work to an issue

> **Generated, and not the authority.** This is `cat-harness/processes/process/crdm-issue-linking.bpmn` (process `Process_CRDM_Issue`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Scan for a GitHub issue matching the feature work, then link it or ask — an issue is never created without the BA's permission.

## Begin — Phase begins (`Start_Process_CRDM_Issue`)

- Begin here.
- Call `workflow_start` with `process: "Process_CRDM_Issue"` and the subject this run is about; keep the instance id it returns.
- next: → `Call_RelatedWork` (Related work: find, sort, ask)

### 1. Related work: find, sort, ask (`Call_RelatedWork`)

- Who: the `Agent` lane (role `authoring-agent`).
- What: When the requirement is initiated or updated through a human-agent chat, search the beans and the repository's issues and open PRs for relevance, categorize and summarize them, and ask the user whether and how to coordinate.
- A subprocess (`Process_RelatedWork`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `A_ScanIssues` (Scan open issues for match)

### 2. Scan open issues for match (`A_ScanIssues`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `crdm-requirements-workflow`.
- What: Search open issues, then recently closed ones, by title and body keywords for one this request belongs to.
- Record it: `workflow_complete` with `node: "A_ScanIssues"`.
- next: → `GW_Issue` (Issue found?)

### Decide — Issue found? (`GW_Issue`)

- Answered by the scan of open issues: does one already cover this work?
- Call `workflow_complete` with `node: "GW_Issue"` and `outcome` set to the label that holds:
  - «no» → `A_AskCreate` (Ask BA to create or link issue)
  - «yes» → `A_LinkIssue` (Link to existing issue)

### 3. Ask BA to create or link issue (`A_AskCreate`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `crdm-requirements-workflow`.
- What: Ask — never create.
- Record it: `workflow_complete` with `node: "A_AskCreate"`.
- next: → `End_Process_CRDM_Issue` (Phase complete)

### 4. Link to existing issue (`A_LinkIssue`)

- Who: the `Agent` lane (role `authoring-agent`).
- Skill: `crdm-requirements-workflow`.
- What: A match was found: ask the person whether the requirements go on #NNN, then link the work there.
- Record it: `workflow_complete` with `node: "A_LinkIssue"`.
- next: → `End_Process_CRDM_Issue` (Phase complete)

## Done — Phase complete (`End_Process_CRDM_Issue`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
