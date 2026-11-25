<!-- GENERATED from fhir-harness/processes/content/ig-ast-cache.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — An IG site, built from the AST on its cache branch

> **Generated, and not the authority.** This is `fhir-harness/processes/content/ig-ast-cache.bpmn` (process `Process_IgAstCache`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

How an IG repository's own site is published, and how the AST it is built from is kept current (skill `ig-build-pipeline` §"The AST cache lifecycle").

## Begin — IG site publish wanted (`Start_Publish`)

- Begin here: A publish of the IG repository's default branch (the site root) or of another branch (a preview), by `stage-local.ts`.
- Call `workflow_start` with `process: "Process_IgAstCache"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_Restore` (Restore and judge the cached AST)

### 1. Restore and judge the cached AST (`Task_Restore`)

- Who: the `Site build (agent, stage-local)` lane (role `build-pipeline`).
- Skill: `ig-ast-delta`, `ig-build-pipeline`.
- What: `ig-cache.sh restore --ig-root .` fetches `cat/fhir-harness/fhir-ast/<package id>` into `output-ast/` (with the Publisher's `txcache/`), then `ig-cache.sh verify` runs `ig-ast.ts validity`: exit 0 valid, 1 stale-inputs (naming which input), 2 cannot-tell.
- Record it: `workflow_complete` with `node: "Task_Restore"`.
- next: → `GW_Valid` (AST valid for this commit?)

### Decide — AST valid for this commit? (`GW_Valid`)

- Answered by Task_Restore's verdict.
- Call `workflow_complete` with `node: "GW_Valid"` and `outcome` set to the label that holds:
  - «yes» → `Task_BuildSite` (Build and publish the site from the AST)
  - «no — refused:
stale, cannot tell, miss» → `Task_Dispatch` (Dispatch AST refresh)

### 2. Build and publish the site from the AST (`Task_BuildSite`)

- Who: the `Site build (agent, stage-local)` lane (role `build-pipeline`).
- Skill: `ig-render-jekyll`, `ig-build-pipeline`.
- What: Runs the site route's steps via `stage-local.ts` → `build-instance-site.ts`: `ig-site:sidecars` (IG API sidecars, if the landing layer has the step), `ig-site:compose` (artefact index and thin pages from the AST, the IG composed at the root), `ig-site:openapi` (if the IG holds OpenAPI pages), `ig-si
- Record it: `workflow_complete` with `node: "Task_BuildSite"`.
- next: → `Task_SizeReview` (Review the site's size)

### 3. Dispatch AST refresh (`Task_Dispatch`)

- Who: the `Publication manager (owner, or the agent the owner delegates to)` lane (role `publication-manager`).
- Skill: `ig-build-pipeline`.
- What: Actions → "IG AST refresh (by hand)" → Run workflow on the default branch, inputs `ref` = the default branch, `force` = false.
- Record it: `workflow_complete` with `node: "Task_Dispatch"`.
- next: → `Task_Export` (Build the IG with the AST exporter)

### 4. Review the site's size (`Task_SizeReview`)

- Who: the `Site build (agent, stage-local)` lane (role `build-pipeline`).
- Skill: `ig-publication`.
- What: Read the size report the build printed before its push, and fix what it shows, or raise a decision card with the owner when no known fix applies (skill `ig-publication` §"Size review").
- Record it: `workflow_complete` with `node: "Task_SizeReview"`.
- next: → `End_Published` (Site published from the AST)

### 5. Build the IG with the AST exporter (`Task_Export`)

- Who: the `AST refresh (GitHub runner: IG Publisher with the AST exporter)` lane (role `ig-publisher-service`).
- Skill: `ig-publisher-fork`.
- What: The runner mounts the layers the IG repository's `index.lock.json` pins, then restores and judges the cache itself.
- Record it: `workflow_complete` with `node: "Task_Export"`.
- next: → `GW_Seedable` (On the default branch, with its inputs?)

## Done — Site published from the AST (`End_Published`)

- The instance completes here: The site says what built it (`folio-build.json`), and every artefact page carries the AST's provisional mark. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### Decide — On the default branch, with its inputs? (`GW_Seedable`)

- Yes when the built commit is an ancestor of the default branch's tip AND `sushi-config.yaml`, `ig.ini` and `input/` are the same at both.
- Call `workflow_complete` with `node: "GW_Seedable"` and `outcome` set to the label that holds:
  - «yes» → `Task_Seed` (Seed the cache branch)
  - «no» → `End_NotSeeded` (AST kept as a run artifact; cache unchanged)

### 6. Seed the cache branch (`Task_Seed`)

- Who: the `AST refresh (GitHub runner: IG Publisher with the AST exporter)` lane (role `ig-publisher-service`).
- Skill: `compiled-artefact-cache`.
- What: `ig-cache.sh seed --ig-root .
- Record it: `workflow_complete` with `node: "Task_Seed"`.
- next: → `Task_Restore` (Restore and judge the cached AST)

## Done — AST kept as a run artifact; cache unchanged (`End_NotSeeded`)

- The instance completes here: The AST is uploaded with the run, for that ref's own review; the shared cache is left alone. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
