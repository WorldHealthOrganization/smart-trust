---
name: qa-coverage
description: >
  Keep every schema and node type in this folio under semantic QA. Shape
  validation (JSON Schema, folio-assistant's zod, FHIR) is not enough: each
  schema also needs checks that references resolve, counts match what they
  count, and named files exist. A schema with no such check is itself a
  failing finding (qa-missing).
input: src/schemas/skills/qa-coverage/input.schema.json
output: src/schemas/skills/qa-coverage/output.schema.json
---

# QA coverage

Owner, 2026-09-23: *"make sure all node types/schemas have QA. it is a QA in and of itself if there are missing"*.

## The rule

- Every schema this folio **defines** (`src/schemas/*.schema.json`) and every schema it **reuses** (folio-assistant's zod: declarations, config, bean graph, skill package, Tool, catalogue, `pdf-structure/v1`; FHIR R4) has at least one check in the `QA` registry of `src/tools/qa.py` (Tool `ihris-qa`).
- A schema with none → finding `qa-missing`. A registry entry for a schema that no longer exists → `qa-orphan`.
- Every JSON file is covered by some schema (`validate.py`), so every document is under QA.

## Adding a schema

1. Write the schema in `src/schemas/`, and a binding in `bindings.json` if the file carries no `$schema`.
2. Add a check to `qa.py` that establishes something the shape cannot: a reference resolves, a count matches, a file exists at its sha256. Register it under the schema, with a one-line `establishes`.
3. **Prove the check can fail.** Break the data in memory and confirm the check reports it (a mutation test). A check that cannot fail is not QA.

## Upstream facts

When a finding is a fact about the SOURCE, not a defect here (e.g. the 4.3.3 release repeating currency ids inside one module), record it in `src/tools/qa-known.json` with the reason and where it was verified. That file has its own schema and its own check. An entry that no longer matches the data fails, so it cannot hide a new finding.

## Where it runs

`validate.py` runs `qa.py`, and CI (`.github/workflows/ci.yml`) runs `validate.py` on every push and pull request. The site's Schemas page publishes the coverage table.
