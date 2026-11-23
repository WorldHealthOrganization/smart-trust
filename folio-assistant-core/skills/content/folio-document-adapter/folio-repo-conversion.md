---
name: folio-repo-conversion
description: >-
  The content-folio half of the harness's repo-conversion skill: outside-content
  evidence and refutation candidate scanning, content-type marker declarations,
  and dispatching library and content buckets to document-intake and folio
  authoring.
---

# Folio repository conversion — markers, orphaned evidence, and intake handoff

The harness skill [`repo-conversion`](../../../../cat-harness/skills/conduct/conduct-core/repo-conversion.md)
governs the read-only repository scan (`scan-repo-content.ts`), the three
selection questions (Q1–Q3), marker selection (`--markers`), merging existing
`AGENTS.md` / `README.md` / `.gitignore`, and provisioning `gh-pages`. When
converting an existing project into a content folio, apply these rules
alongside it.

## 1. Preserving outside-content evidence and refutations

In repositories with formal, scientific, or analytical content, crucial
evidence and counterexamples often live **outside** the primary content tree
(`content/` or `folio/`). Carrying only the content tree drops the evidence
that some claims are false.

`scan-repo-content.ts` classifies outside-content artifacts into read-only
candidate classes with their `linkStatus`:

| classification | description | examples |
|---|---|---|
| `math_proof` | Formal proof or theorem outside content tree | `docs/audits/*.lean`, `math/*.lean`, Coq `.v`, Isabelle `.thy` |
| `computation_script` | Numerical or symbolic calculation / verification script | `docs/audits/*.py`, `computations/*.py`, `.sage`, `.ipynb`, `.jl` |
| `macro_definition` | TeX macros, custom commands, environments, or math tables | `macros.tex`, `tables/*.tex`, `preamble.tex`, `defs.tex` |
| `audit_refutation` | Audit refutation or counterexample falsifying a claim | `docs/audits/*is-false*.lean`, `audits/counterexample.py` |
| `derivation_note` | Informal derivation note or scratchpad | `docs/notes/derivation*.md`, `derivations/*.md`, `scratchpad.md` |

- **`linked`**: referenced by at least one block or manifest in the content tree (`linkedBy`).
- **`unlinked`**: orphaned evidence not linked by any content block — present
  these candidates to the author before importing so refutations and
  computations are linked or ingested rather than left behind.

## 2. Dispatching the converted buckets

Once the author has answered Q1–Q3 and chosen the declared `markers` in
`index.config.json` or `<name>.json`:

- **`library` bucket:** hand the selected reference documents to
  [`document-intake`](../../library/ingestion/document-intake.md) and
  [`l1-document-ingestion`](../../library/ingestion/l1-document-ingestion.md)
  (`collab/processes/library/l1-document-ingestion.bpmn`).
- **`content` bucket:** hand the author's own chapters and prose to
  [`document-authoring`](document-authoring.md)
  and [`document-structure`](document-structure.md)
  (or the active content type's adapter skills).
