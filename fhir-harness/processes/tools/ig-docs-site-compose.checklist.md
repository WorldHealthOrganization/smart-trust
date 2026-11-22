<!-- GENERATED from fhir-harness/processes/tools/ig-docs-site-compose.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Each IG, composed into a host docs site and rendered with just-the-docs

> **Generated, and not the authority.** This is `fhir-harness/processes/tools/ig-docs-site-compose.bpmn` (process `Process_IgDocsSiteCompose`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

How a host docs site builds every IG it mounts INSIDE itself, so each IG's pages wear the host's chrome (one sidebar, one search, one language selector) rather than being a site of their own.

## Begin — Host docs source composed; IG sites wanted (`Start_Compose`)

- Begin here: The host has composed its docs layers into one Jekyll source (`compose-docs --out ./_docs`) and the IG instances are on disk: the remote mounts are replayed from the mount lock (e.g.
- Call `workflow_start` with `process: "Process_IgDocsSiteCompose"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_Indexes` (Build each IG's artefact index)

### 1. Build each IG's artefact index (`Task_Indexes`)

- Who: the `Host docs site build (CI runner)` lane (role `build-pipeline`).
- Skill: `ig-build-pipeline`.
- What: Tool `ig-index-build`: `bun run cat ig-index:build`.
- Record it: `workflow_complete` with `node: "Task_Indexes"`.
- next: → `Task_Pages` (Generate each IG instance's artefact pages)

### 2. Generate each IG instance's artefact pages (`Task_Pages`)

- Who: the `Host docs site build (CI runner)` lane (role `build-pipeline`).
- Skill: `ig-build-pipeline`.
- What: Tool `ig-pages`: `bun run fhir-harness/scripts/gen-ig-pages.ts --instance <instance> ...`, run for every IG instance by its own pages script.
- Record it: `workflow_complete` with `node: "Task_Pages"`.
- next: → `Task_Stage` (Clone each IG at its recorded commit and stage it)

### 3. Clone each IG at its recorded commit and stage it (`Task_Stage`)

- Who: the `Host docs site build (CI runner)` lane (role `build-pipeline`).
- Skill: `ig-render-jekyll`, `ig-build-pipeline`.
- What: Tool `stage-ig-sites`: `bun run fhir-harness/scripts/stage-ig-sites.ts --work ./_ig --baseurl /<repo> --plantuml-jar <jar>`.
- Record it: `workflow_complete` with `node: "Task_Stage"`.
- next: → `Task_ComposeInto` (Compose each staged IG into the host source)

### 4. Compose each staged IG into the host source (`Task_ComposeInto`)

- Who: the `Host docs site build (CI runner)` lane (role `build-pipeline`).
- Skill: `ig-render-jekyll`.
- What: Tool `stage-ig-sites` with `--compose-into ./_docs` (the same run as `Task_Stage`).
- Record it: `workflow_complete` with `node: "Task_ComposeInto"`.
- next: → `End_Composed` (Each IG composed; build list handed to the host)

## Done — Each IG composed; build list handed to the host (`End_Composed`)

- The instance completes here: The host builds its Jekyll source ONCE (`bundle exec jekyll build --source ./_docs --destination ./_site`, Jekyll 4 with `jekyll-remote-theme` loading just-the-docs), then, for each line of the build list, runs Tool `build-ig-site` with `--dedupe-ids ./_site/<instance>`: it keeps the first copy of e `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
