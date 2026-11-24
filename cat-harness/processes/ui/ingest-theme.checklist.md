<!-- GENERATED from cat-harness/processes/ui/ingest-theme.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Ingestion subprocess — ingest a theme

> **Generated, and not the authority.** This is `cat-harness/processes/ui/ingest-theme.bpmn` (process `Process_IngestTheme`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Decide whether an ingested artefact is a theme source and, when it is, extract its palette roles and layouts and send them to theme and UI review.

## Begin — Theme source in hand (`StartEvent_Source`)

- Begin here.
- Call `workflow_start` with `process: "Process_IngestTheme"` and the subject this run is about; keep the instance id it returns.
- next: → `Gateway_Kind` (Served, or stated?)

### Decide — Served, or stated? (`Gateway_Kind`)

- The ONE difference between the two paths.
- Call `workflow_complete` with `node: "Gateway_Kind"` and `outcome` set to the label that holds:
  - «served — a deployment» → `Task_ReadStylesheet` (Read the served stylesheet's declarations)
  - «stated — a style guide» → `Task_ReadGuide` (Read the guide's own stated rules)

### 1. Read the served stylesheet's declarations (`Task_ReadStylesheet`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `theme-art-intake`.
- What: Read the ROLE, never the prettiest value.
- Record it: `workflow_complete` with `node: "Task_ReadStylesheet"`.
- next: → `Task_MapRoles` (Map values onto palette roles)

### 2. Read the guide's own stated rules (`Task_ReadGuide`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `theme-art-intake`.
- What: From the INGESTED document's sections, not from a screenshot and not inferred from a site that happens to use the brand.
- Record it: `workflow_complete` with `node: "Task_ReadGuide"`.
- next: → `Task_MapRoles` (Map values onto palette roles)

### 3. Map values onto palette roles (`Task_MapRoles`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `theme-art-intake`.
- What: surface / ink / edge / accent, shared across every kind.
- Record it: `workflow_complete` with `node: "Task_MapRoles"`.
- next: → `Task_Contradictions` (Record contradictions IN the source)

### 4. Record contradictions IN the source (`Task_Contradictions`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `theme-art-intake`.
- What: A step because sources do contradict themselves (one colour given two values on different pages).
- Record it: `workflow_complete` with `node: "Task_Contradictions"`.
- next: → `Gateway_Layouts` (Every layout present?)

### Decide — Every layout present? (`Gateway_Layouts`)

- Is every layout the theme must cover present in the source?
- Call `workflow_complete` with `node: "Gateway_Layouts"` and `outcome` set to the label that holds:
  - «yes» → `Task_Review` (Theme and UI review)
  - «no» → `EndEvent_Refused` (Refused — incomplete)

### 5. Theme and UI review (`Task_Review`)

- Who: the `Ingestion Engine (agent, runs unattended)` lane (role `ingestion-agent`).
- Skill: `theme-ui-review`.
- What: THEME REVIEW HAPPENS HERE AND NOWHERE ELSE: graphical assets are reviewed at ingestion, in the context of the website or app design they are for.
- A subprocess (`Process_ThemeUIReview`): `workflow_next` reports its own steps; complete those — this call activity itself is not completable.
- next: → `EndEvent_Theme` (Theme node)

## Done — Refused — incomplete (`EndEvent_Refused`)

- The instance completes here: Every layout still required, and a missing one stays INVALID rather than degraded. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

## Done — Theme node (`EndEvent_Theme`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
