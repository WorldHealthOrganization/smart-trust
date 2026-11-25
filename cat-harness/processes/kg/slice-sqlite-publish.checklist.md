<!-- GENERATED from cat-harness/processes/kg/slice-sqlite-publish.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Build and publish a per-slice SQLite file

> **Generated, and not the authority.** This is `cat-harness/processes/kg/slice-sqlite-publish.bpmn` (process `Process_SliceSqlitePublish`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Build one named slice of a knowledge graph as a SQLite file a browser mounts without parsing, and publish it beside its manifest and its payloads.

## Begin — A corpus needs client-side search (`Start_Need`)

- Begin here.
- Call `workflow_start` with `process: "Process_SliceSqlitePublish"` and the subject this run is about; keep the instance id it returns.
- next: → `A_Define` (Write the slice definition)

### 1. Write the slice definition (`A_Define`)

- Who: the `Platform authoring agent` lane (role `platform-authoring-agent`).
- Skill: `kg-export`.
- What: Add one `SliceDef` to the builder's slice table: the DDL (one table per node type, edge tables, one CONTENTLESS full-detail FTS5), the order each table's rows go in, the `load` that turns the source into rows, where the payloads live (written at deploy, or already published), and the `search` block 
- Record it: `workflow_complete` with `node: "A_Define"`.
- next: → `A_Measure` (Build it locally and measure the file)

### 2. Build it locally and measure the file (`A_Measure`)

- Who: the `Platform authoring agent` lane (role `platform-authoring-agent`).
- Skill: `kg-export`.
- What: Run `bun run cat slice:sqlite -- --slice <name> --out <scratch>` and read the manifest: `bytes`, the row counts, the payload count and bytes, `overBudget`, `duplicateIds` and `findings`.
- Record it: `workflow_complete` with `node: "A_Measure"`.
- next: → `GW_Budget` (Under the ~5 MB budget?)

### Decide — Under the ~5 MB budget? (`GW_Budget`)

- Answered by the manifest `A_Measure` read: `bytes` against `SIZE_BUDGET_BYTES`.
- Call `workflow_complete` with `node: "GW_Budget"` and `outcome` set to the label that holds:
  - «yes — under» → `A_Wire` (Wire it: gate, deploy line, search, tests)
  - «no — over» → `A_Report` (Report the measurement; ship nothing)

### 3. Wire it: gate, deploy line, search, tests (`A_Wire`)

- Who: the `Platform authoring agent` lane (role `platform-authoring-agent`).
- Skill: `kg-export`.
- What: Give the slice everything a slice owes: its manifest (written by the builder from the definition), its `--check` (covered by `slice:sqlite:check`), one deploy line in `docs-site.yml` and in `feature-staging.yml`, its search (the generic page needs no code, only the definition's `search` block), a un
- Record it: `workflow_complete` with `node: "A_Wire"`.
- next: → `A_Check` (Gate every slice: slice:sqlite:check)

### 4. Report the measurement; ship nothing (`A_Report`)

- Who: the `Platform authoring agent` lane (role `platform-authoring-agent`).
- Skill: `kg-export`.
- What: Write the measurement and what was tried into the work context, and ask the owner whether the slice should ship at that size, be cut further, or not exist.
- Record it: `workflow_complete` with `node: "A_Report"`.
- next: → `End_Stopped` (Stopped, with its measurement)

### 5. Gate every slice: slice:sqlite:check (`A_Check`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `kg-export`.
- What: For every slice: build twice and require one sha256; read the row digest back from the file and require it to equal the digest computed from the source without SQLite; run an FTS5 phrase query for a known row; and audit the payloads with `auditPayloadTree` (deploy payloads as written, the kg slice's
- Record it: `workflow_complete` with `node: "A_Check"`.
- next: → `GW_Green` (Every slice green?)

## Done — Stopped, with its measurement (`End_Stopped`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### Decide — Every slice green? (`GW_Green`)

- Answered by the exit code of `slice:sqlite:check`, one line per slice.
- Call `workflow_complete` with `node: "GW_Green"` and `outcome` set to the label that holds:
  - «yes — green» → `A_Deploy` (Build each slice into _site at deploy)
  - «no — red» → `End_Red` (Job RED)

### 6. Build each slice into _site at deploy (`A_Deploy`)

- Who: the `CI/CD Pipeline` lane (role `build-pipeline`).
- Skill: `kg-export`.
- What: `gen-slice-sqlite.ts --out ./_site/assets/slices --payload-out ./_site/payload/sha256 --slice <name>`, once per slice, from the tree being published: the file, its manifest, the slice index, and the deploy payloads beside the committed KG payloads.
- Record it: `workflow_complete` with `node: "A_Deploy"`.
- next: → `A_Verify` (Search the published slice in a browser)

## Done — Job RED (`End_Red`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 7. Search the published slice in a browser (`A_Verify`)

- Who: the `Platform authoring agent` lane (role `platform-authoring-agent`).
- Skill: `rendered-verification`.
- What: Open `slices/search.html?slice=<name>` on the deployed site, run a phrase search for a known row, open it so its payload is fetched, and look at the result; send the screenshot rather than a description of it.
- Record it: `workflow_complete` with `node: "A_Verify"`.
- next: → `End_Shipped` (Slice searchable on the site)

## Done — Slice searchable on the site (`End_Shipped`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
