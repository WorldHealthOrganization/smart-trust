---
name: change-size
description: >
  The change-size rule: keeps review increments adjudicable by establishing a
  line-count threshold (~400 effective lines), recording its empirical basis,
  weighting prose/KG lower than code, and distinguishing size from complexity.
allowed-tools: Read Grep Glob Bash
consulted: true
---

# Change Size Rule — Threshold, Basis, and Complexity Weighting

The rule comes from **github/spec-kit**: a report-only advisory limit of ~400
lines of non-generated, non-lockfile code, with prose and KG documentation
weighted lower, to become a blocking CI gate once calibrated against PR
history.

## The Threshold and its Basis

Like the health checks under `test/health/`, the threshold carries its basis,
because a threshold without one cannot be argued with or recalibrated:

| Field | Value |
|---|---|
| **Metric** | `effective_lines` |
| **Limit** | `400` effective lines |
| **Current Enforcement Mode** | **Report-only (advisory)** — transitioning to blocking CI gate once calibrated against PR history |
| **Code Weight** | `1.0` |
| **Prose / KG Documentation Weight** | `0.25` (4x line allowance) |

### The Empirical Basis

1. **Cisco / SmartBear Code Review Study** (Cohen et al., 2006):
   - Comprehensive study of ~2,500 code reviews over 10 months.
   - **Defect-detection effectiveness falls off sharply above 200–400 changed lines**.
   - Reviewer cognitive fatigue sets in after ~60 minutes; inspecting beyond 400 lines in one session leads to superficial scanning rather than thorough verification.
2. **Google Modern Code Review Case Study** (Sadowski et al., ICSE-SEIP 2018):
   - Small changelists are the primary operational lever maintaining fast review turnaround (median <4 hours) and deep reviewer scrutiny.
   - Large reviews experience disproportionately longer review latency and significantly fewer defects detected per line changed.

## Prose & Knowledge Graph vs Code

A 600-line skill rewrite and a 600-line logic refactor impose fundamentally different cognitive adjudication loads:
- **Code**: non-linear, branching control flow, invariant preservation, state mutations, and type constraints. Higher defect density per line.
- **Prose & Knowledge Graph Documentation**: linear reading flow, descriptive context, documentation updates. Lower cognitive defect hazard per line.

Therefore, prose and knowledge-graph documentation changes are weighted at **0.25x**:
$$\text{Effective Lines} = (\text{Code Lines} \times 1.0) + (\text{Prose/KG Lines} \times 0.25)$$

Under this rule:
- 400 lines of TypeScript = 400 effective lines (reaches threshold).
- 1,600 lines of documentation/skills = 400 effective lines (reaches threshold).

## "Large" vs "Hard to Adjudicate"

A change can be large in lines while being trivial to adjudicate, or small in lines while being dense and risky. The size rule distinguishes uniform mechanical changes from high-cognitive changes.

### Exempted Categories (Zero Effective Lines)

1. **Lockfiles**: `bun.lock`, `package-lock.json`, `yarn.lock`. Large machine-generated dependency trees.
2. **Generated Artefacts**: `*.jsonld`, `*.doc.json`, `*.qa.json`, `*.script-qa.json`, `_site/`, `dist/`. Build and pipeline products whose source is audited elsewhere.
3. **Uniform Mechanical Changes**: Automated renames, bulk import path migrations, or file relocations that preserve logic, provided they carry a **recorded justification** in the PR description.

## Splitting Strategy — GitHub Sub-Issues

When a proposed change exceeds 400 effective lines, or when a feature represents
a multi-increment delivery:

1. **GitHub Sub-Issues**: Decompose the work using GitHub sub-issues under the
   governing parent issue.
2. **Parent Issue Carries the Spec**: The parent issue is the single source of
   truth holding the overarching specification in the declared template
   (`spec-template.md`). Sub-issues reference the parent spec rather than
   forking requirements.
3. **One PR per Sub-Issue**: Each child sub-issue delivers **one standalone,
   adjudicable, reviewable, revertible increment with its own PR**:
   - Each PR must aim to stay within the ~400 effective line review threshold
     (`(code * 1.0) + (prose/kg * 0.25)`).
   - Each increment is independently covered by automated tests.
   - Each increment is safe to revert without breaking repository integrity or CI gates.
4. **Spec-Before-Code Gate**: The spec-before-code gate requires an accepted
   specification on the parent issue *before* code implementation begins on any
   child increment, detectable via `check-spec.ts --spec-before-code`.
5. If a PR cannot be split below 400 effective lines, it MUST record its justification
   in the PR description.

## Reporting Format

Compliance metrics must always be reported as a **count with its denominator**, never as a bare percentage:
- Correct: *"4 of 32 PRs (12.5%) exceeded the advisory threshold."*
- Incorrect: *"12.5% of PRs exceeded the threshold."*
