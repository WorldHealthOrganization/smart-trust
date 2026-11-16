---
name: benchmarking-mode
description: >
  Benchmarking output is a synthesized report across models and configurations,
  deliberately excluded from declared knowledge-graph typologies. Contrast with
  QA review mode, where reports land (build/benchmarks/ or reports/), and path
  guards preventing benchmark data from polluting the knowledge graph.
---

# Benchmarking mode — reports across models, deliberately excluded from the KG

> Skill id: `benchmarking-mode` · Package: `sdlc-core`

**Benchmarking output is a report about model performance across configurations, not an assertion about the subject folio.** Every other verdict this platform produces goes into a declared graph (`test/results/` for the `qa` graph, `test/attestations/` for `attestations`, `test/health/results/` for `health`). Benchmarking output is a deliberate exception: it does not enter any declared graph, has no graph typology, and must never be committed to graph directories.

## The rule, and why it is not obvious

Every QA review sidecar, witness file, and `kg-qa` verdict this project produces goes **into** a declared graph (`test/results/`, `qa` graph) precisely so that findings are addressable nodes in the repository's knowledge graph.

**Do not declare a `benchmark-results` or `benchmarks` graph typology** in `cat-harness.json`.

The distinction is an ontological one:

| | QA review mode | Benchmarking mode |
|---|---|---|
| **What it asserts** | Facts about the **subject folio** (e.g., voice compliance, translation fidelity, schema validity, structural correctness) | Facts about the **model and runner configuration** (e.g. prompt template, inference engine, context window, temperature, seed) at one point in time |
| **Reproducibility across clones** | Invariant across checkouts: the subject folio either passes or fails | Dependent on model availability, vendor versions, non-deterministic weights, and compute access |
| **Graph status** | **Declared graph content** (`test/results/`, `qa` graph, `attestations` graph) | **Deliberately NOT graph content** — excluded from all declared graphs |
| **Output destination** | `test/results/**`, `test/attestations/**` | `build/benchmarks/` (default, gitignored) or `reports/` (synthesized CRDM reports) |
| **Audience & lifetime** | Platform gates, CI verification, and release attestations | Model evaluation, verifiability studies, and CRDM requirements synthesis |

If benchmark metrics were admitted as KG nodes, the repository's graph contents would depend on which model happened to execute the run. Two checkouts of the exact same commit running on different machines with different model backends would instantiate conflicting graphs.

## Where benchmark reports land

Benchmark outputs land in locations that are **never** declared as `graphTypologies` entries:

1. **`build/benchmarks/` (default for raw outputs and runs)**:
   All runner scripts (such as `scripts/toc-benchmark.py` and `scripts/page-label-benchmark.py`) default their file output to `build/benchmarks/<tool>.json`. Because `build/` is gitignored across all folio and harness layouts, automated runs never dirty git status or pollute repository state.
2. **`reports/` (synthesized human-readable reports)**:
   When benchmark runs across multiple models or prompt strategies are synthesized into a publication or requirements analysis, the resulting document lives under `reports/` (or CRDM analysis folders) as a standalone report document, not as a KG database node. The shape and contents of synthesized reports answer user needs defined by the CRDM process.

## Enforcement: path guards against graph pollution

The isolation between benchmark execution and declared graphs is **enforced by code**, not left to good intentions:

- **Runner defaults**: Benchmark scripts default output paths into `build/benchmarks/`, never relative roots or graph roots.
- **Path guards**: Both TypeScript (`scripts/benchmark-guard.ts`) and Python (`scripts/_benchmark_guard.py`) implement path verification against `cat-harness.json`. Any benchmark execution attempting to direct output into `beans/`, `todos/`, `test/results/`, `library/`, `schemas/`, `skills/`, or any other declared graph directory is rejected with an explicit refusal.
- **Path audit gates**: `scripts/tests/audit-output-paths.test.ts` scans benchmark runners and pipeline scripts to ensure they never default into `beans/`, `todos/`, or declared graph roots.

## Sibling contrast: translation QA vs benchmarking

The contrast with translation QA clarifies the boundary:
- Translation QA evaluates whether a translated document accurately renders the source. It is an assertion about the folio's fidelity, and therefore joins the audited review record under `test/results/`.
- Model benchmarking tests how well candidate models perform when inferring structures (e.g. table-of-contents extraction or page labeling) across a test bank. It is an evaluation of the models, not of the documents being processed, and therefore produces isolated reports in `build/benchmarks/`.
