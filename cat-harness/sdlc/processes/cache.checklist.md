<!-- GENERATED from cat-harness/sdlc/processes/cache.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — The cache process: restore and save every cache a run can use

> **Generated, and not the authority.** This is `cat-harness/sdlc/processes/cache.bpmn` (process `Process_Cache`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

One optional process for every cache in the harness, used by render, CI, publish and every other consumer, whose components run in parallel where they are independent and in order where they are not.

## Begin — A consumer asks for its caches (`Start_Cache`)

- Begin here.
- Call `workflow_start` with `process: "Process_Cache"` and the subject this run is about; keep the instance id it returns.
- next: → `GW_Enabled` (cache:plan: anything needed?)

### Decide — cache:plan: anything needed? (`GW_Enabled`)

- Run `bun run cat cache:plan <target>`.
- Call `workflow_complete` with `node: "GW_Enabled"` and `outcome` set to the label that holds:
  - «needed» → `Task_Layers` (Layers ref: restore / save)
  - «nothing needed» → `End_Skipped` (Skipped: the consumer builds)

### 1. Layers ref: restore / save (`Task_Layers`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `cache-first-ci`.
- What: Component 1, which everything else needs.
- Record it: `workflow_complete` with `node: "Task_Layers"`.
- next: → `PG_After_Layers` (Independent components)

## Done — Skipped: the consumer builds (`End_Skipped`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### Do all of — Independent components (`PG_After_Layers`)

- Work every branch; none is optional. Branches: → `Task_Image` (Prepared image + node_modules), → `Task_Deps` (bun / pip dependencies), → `Task_Gates` (Gate results: restore / save), → `Task_Sets` (Generated sets: QA copy, pages)
- The engine passes through this gateway itself; there is nothing to record here.

### 2. Prepared image + node_modules (`Task_Image`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `cache-first-ci`.
- What: Component 2a.
- Record it: `workflow_complete` with `node: "Task_Image"`.
- next: → `PG_Join_Independent`

### 3. bun / pip dependencies (`Task_Deps`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `cache-first-ci`.
- What: Component 2b.
- Record it: `workflow_complete` with `node: "Task_Deps"`.
- next: → `PG_Join_Independent`

### 4. Gate results: restore / save (`Task_Gates`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `cache-first-ci`.
- What: Component 2c.
- Record it: `workflow_complete` with `node: "Task_Gates"`.
- next: → `PG_Join_Independent`

### 5. Generated sets: QA copy, pages (`Task_Sets`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `cache-first-ci`.
- What: Component 2d.
- Record it: `workflow_complete` with `node: "Task_Sets"`.
- next: → `PG_Join_Independent`

### Wait for all — `PG_Join_Independent`

- Continue only when every one of the 4 incoming branches is done; the engine passes through itself.
- next: → `Task_Lean` (Lean .oleans: restore / save)

### 6. Lean .oleans: restore / save (`Task_Lean`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `compiled-artefact-cache`.
- What: Component 3, after the layers (the Lean packages are mounted content).
- Record it: `workflow_complete` with `node: "Task_Lean"`.
- next: → `PG_After_Lean` (Independent components)

### Do all of — Independent components (`PG_After_Lean`)

- Work every branch; none is optional. Branches: → `Task_RenderSeed` (Render seed: writer records), → `Task_IgAst` (FHIR IG ASTs: Process_IgAstCache)
- The engine passes through this gateway itself; there is nothing to record here.

### 7. Render seed: writer records (`Task_RenderSeed`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `incremental-render`.
- What: Component 4a, the seed of CI's render (owner, 2026-11-05: CI does not run `render`; its render is `derive:publish`).
- Record it: `workflow_complete` with `node: "Task_RenderSeed"`.
- next: → `PG_Join_Render`

### 8. FHIR IG ASTs: Process_IgAstCache (`Task_IgAst`)

- Who: the `FHIR IG AST cache (the FHIR IG layer)` lane (role `publication-manager`).
- What: Component 4b, in its own lane: the FHIR IG layer's IG AST cache, `Process_IgAstCache` (declared by that layer), integrated, not replaced.
- Record it: `workflow_complete` with `node: "Task_IgAst"`.
- next: → `PG_Join_Render`

### Wait for all — `PG_Join_Render`

- Continue only when every one of the 2 incoming branches is done; the engine passes through itself.
- next: → `Task_Jekyll` (Jekyll cache: restore / save)

### 9. Jekyll cache: restore / save (`Task_Jekyll`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `cache-first-ci`.
- What: Component 5, last: it caches the rendering of what the components above produce.
- Record it: `workflow_complete` with `node: "Task_Jekyll"`.
- next: → `End_Ready` (Caches restored, or saved)

## Done — Caches restored, or saved (`End_Ready`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
