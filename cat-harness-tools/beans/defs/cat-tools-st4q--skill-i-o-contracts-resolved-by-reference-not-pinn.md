---
# cat-tools-st4q
$schema: bean/1.0.0
title: 'Skill I/O contracts resolved by reference, not pinned to <root>/schemas/skills/ — so a subgraph can keep its own'
status: completed
type: task
priority: high
tags:
    - smart-base
    - subgraphs
    - skill-contracts
created_at: 2026-11-13T12:07:20Z
updated_at: 2026-11-15T17:39:00Z
parent: folio-assistant-95e7
---

## Why

Parent: `folio-assistant-95e7`. smart-base's L1–L4 subgraphs hold their skill `.md` files, but their I/O contracts cannot follow: three readers fix the contract directory at the instance root.

- `scripts/harness-schema-export.ts` `contractsDir(root) = join(root, "schemas", "skills")` — a contract elsewhere is silently not published.
- `scripts/kg-export.ts` `SKILL_IO_DIR = "schemas/skills"` and the `^schemas/skills/([^/]+)/(input|output)\.schema\.json$` regex — a contract elsewhere gets no IRI.
- `scripts/known-skills.ts` lists `<root>/schemas/skills/*` for skill names.
- Also reading the fixed path: `check-tools.ts`, `tool-page.ts`, `tool-coverage.ts`, `gen-schema-viz.ts`, `schemas/sdlc/kg-qa.ts` (`skill-contract-claimed`).

`scripts/skill-contracts.ts` `contractRefProblem` already accepts any instance-relative `.json` ref, and `tool-coverage.ts` records that per-skill dirs as the binding were retired (B3b): the skill's `input:`/`output:` front matter is the binding. The readers should follow that binding.

## Done when

- [x] The contract set is derived from the skills' `input:`/`output:` refs (plus any `schemas/skills/*` left at the root, for layers that have not moved), in one shared helper every reader above uses (`layerContracts` and `contractIdentity` in `scripts/skill-contracts.ts`, landed in `#2013` / `9e91ec3743`).
- [x] `kg-export` mints an IRI for a contract at any instance-relative path; a contract at the root keeps its current IRI byte-for-byte (`scripts/kg-export.ts` `contractIri` via `layerContracts` and `publishedInstanceSchemas`, landed in `#2013` / `ea24d61c`).
- [x] `harness-schema-export` publishes contracts wherever they are referenced, at the same published path as today for root contracts (`scripts/harness-schema-export.ts` `buildSkillIoContracts` via `layerContracts`, landed in `#2013` / `ea24d61c`).
- [x] Tests: a fixture with a contract under a `subgraph: true` directory is discovered, exported and given an IRI (`scripts/tests/skill-contracts-subgraph.test.ts` and `scripts/tests/features/skill-contracts-subgraph.feature`, 7 scenarios passing, landed in `#2013` / `582b4c76`).
- [x] `bun run cat split:baseline --check` unchanged on this layer; fhir-harness and smart-base unchanged (no contract moved yet).

## Summary

Completed in PR `#2013` (merge commit `9e91ec3743ea3c452e7f2fd7d8da347c38894eea`, commits `ea24d61c4c64bc863585aeceab01e332df604cba` and `582b4c76e5e69621feeb8c623e7cded3bccfd596`):

- Added `contractIdentity()` and `layerContracts()` in `scripts/skill-contracts.ts` to derive an instance's contract set from its skills' `input:`/`output:` front-matter refs (including inside `subgraph: true` directories) unioned with any root `schemas/skills/*` contracts, reporting collisions rather than dropping them.
- Updated `scripts/harness-schema-export.ts`, `scripts/kg-export.ts`, `scripts/tool-page.ts`, and `scripts/gen-schema-docs.ts` to read through `layerContracts` / `skillContracts` + `contractIdentity` and updated `scripts/declared-path-baseline.json` (`scripts/kg-export.ts` 2 → 1).
- Added 7 unit tests in `scripts/tests/skill-contracts-subgraph.test.ts` (and Gherkin feature `scripts/tests/features/skill-contracts-subgraph.feature`).
