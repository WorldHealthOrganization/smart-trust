---
name: canonical-watcher
user_invocable: true
inherits: sdlc-core/integration-watcher
watch_arg: canonical
description: >
  Derivation-discipline integration watcher — watches the default
  branch + open active PRs + newly-opened PRs for non-canonical
  empirical / fitting / calibration inputs beyond the project's declared
  set, numerology, or justification/rationalization in place of
  derivation. Inherits shared mechanics (Monitor, subscriptions, queue,
  ledger, idle sweep, author-ask, watch-prepared-PRs, witness-drift
  recovery, billing-quick-fail flake, post-completion one-voice,
  sibling-PR comment protocol, backlog-found PR spin-up, handover docs)
  from `sdlc-core/integration-watcher`.
allowed-tools: Read Edit Write Bash Grep Glob Agent Monitor Skill
---

# /canonical-watcher

A concrete instance of `sdlc-core/integration-watcher`. The parent encodes
the shared mechanics; this file fills the domain-specific slots A–J for
**derivation discipline**.

**Setup:** use `NAME=canonical-watcher` everywhere the parent's §1
references `${NAME}`. Files at `beans/canonical-watcher-queue.json` and
`beans/canonical-watcher-ledger.md`.

**Authoritative reference:** the project's calibration/derivation
discipline is fixed by the project's stated discipline document(s). Read
them before opening any author ask — the "What is forbidden" section is
the closed list of violations.

## Slot A — Goal statement

Every numerical observable in the project factors as a *derived*
expression times a fixed power of the project's **declared calibration
inputs**, with no hidden extra input. Anything else is a discipline
violation — either a hidden extra calibration, a numerology, or a fit
dressed as a derivation.

### Sibling skill: `production-vs-exploratory-discipline`

When this watcher flags a hidden-extra-input candidate, the resolution
path is through `production-vs-exploratory-discipline`: the 3-category
classification (production / exploratory / numerology), the derivation
menu for production coefficients, the escalation rule for off-menu
coefficients, the locality gate (mandatory pre-flight), and the
pre-promotion checklist. This watcher catches violations post-hoc; the
discipline skill defines the rule it enforces.

### Declared calibration inputs

Maintain the project's enumerated calibration anchors here (each: the
quantity, its source, and what it fixes). These are **exhaustive** — a
further dimensional input anywhere is a hard audit failure. Quantities
*derived* from the anchors are not calibrations.

## Slot B — §3 trigger filter

Pass an event through when its diff touches compute scripts, content
blocks of provable/definitional/remark kind, or the project's
derivation-discipline infrastructure (calibration registry, derivation
-chain validator, reproducibility checks). For PR review-comment events,
pass through if the comment mentions calibration, fit, empirical,
numerology, magic number, rationalization, tautology, or back-fit.

## Slot C — §4b dispatch table

Where a row says "the content type's", the skill is supplied by the layer that ships that content type and names this watcher from its side (for a paper folio, the science layer).

| Specialist | When to run | What it checks |
|------------|-------------|----------------|
| the content type's compute-audit scanner | any changed compute script | hidden-literal leakage, numerology, reproducibility, structured-witness emission |
| calibration-input audit | any changed compute script | declared-input vs over-count classification |
| derivation-chain validator | any changed witness referencing a derivation chain | every numerical claim traces to first principles |
| the content type's value-citation check | any changed block quoting numerical literals | every literal uses the value-citation directive; no hardcoded drift |
| `scientific-accuracy` | any changed provable block with numerical claims | claim is derived, not justified; no rationalization |
| `one-voice-audit` | any changed block | status leaks, work-tracker words |
| the content layer's terminology/ontology skill | any new symbol introduced | notation-register compliance |

## Slot D — §4c finding taxonomy

| Violation | Severity | Definition | Auto-fix? |
|-----------|----------|------------|-----------|
| `extra-calibration` | critical | introduces an external input beyond the declared set | No — author ask |
| `coefficient-fit` | critical | a coefficient labelled "ad hoc"/"approx"/"tuned to data" | author ask; sometimes "demote to remark" |
| `numerology` | critical | a magic number / named constant asserted without a derivation chain | author ask |
| `hidden-data-literal` | major | free-floating external-data string outside the registry | Yes — registry migration |
| `tautology` | major | a "derivation" that uses its own result as input | Yes — add tautology banner + flag |
| `out-of-scope-input-leak` | critical | a derivation consumes a quantity from a side that should not feed it | author ask |
| `second-anchor-pin` | critical | a second independent fit to an already-declared anchor | author ask |
| `convergence-overclaim` | major | "N routes agree" where the routes compute different objects | author ask; demote to remark |
| `universal-extrapolation` | major | a single-case result extrapolated to "universal" | author ask; demote |
| `rationalization` | major | prose arguing *why* a value is right rather than *deriving* it | `scientific-accuracy` rewrite or author ask |
| `negative-result-in-paper` | major | a content block whose primary content is a negative empirical finding | author ask; move to a dated audit doc, replace with a one-line forward reference |
| `refutation-scope-unmarked` | major | a durable artifact declares something "refuted"/"ruled out" for a mechanism tested *alone*, without scope-limited phrasing or a cited proved invariant | re-scope; keep the result, fix only the scope claim |

### Allowed-class opt-outs (extends parent's defer band)

Three opt-out classes, each requiring an explicit marker:

| Class | What it is | How to mark |
|-------|------------|-------------|
| **Class-A** | acknowledged stub openly stating it is currently empirical and listing what would derive it | banner in docstring / front-matter callout; commit cites Class-A |
| **Class-B** | baseline-extraction script that *produces* a calibration input (by definition consumes external data) | filename/docstring labels purpose; review confirms no derived-side claim is drawn from it |
| **Class-C** | diagnostic probe / cross-check — read-only, never feeds a downstream witness | docstring `# Class: C — diagnostic probe` + no witness consumer |

When classifying a finding as `wontfix-allowed`, record which class and
verify the marker exists. Missing marker → the finding is a violation;
the fix is to add the banner.

## Slot E — §4d discharge bands

| Band | Examples |
|------|----------|
| **Auto-discharge** | `hidden-data-literal` → registry migration; `tautology` missing banner → add banner + footnote; over-count with a declared-input alternative scripted → switch the consumer |
| **Author-assist** | all other violations |
| **Defer** | Class-A/B/C with banner present |

## Slot F — §4e author-ask template

```markdown
**canonical-watcher ask — `<block-or-script>`** (from <source>)

- Violation: `<kind>` — <one sentence>
- Severity: <critical | major | minor>
- File: <blob-url>
- Evidence: `<file:line>` — `<offending literal/claim>`
- Attempted: <which fixes/scanners were tried>
- Question:
  1. Acknowledge as Class-A/B/C exception (add banner)
  2. Derive (point to a derivation chain or open a TodoItem)
  3. Demote to remark / null result
```

## Slot G — §5a backlog discovery

Run the project's calibration-input compliance check and read its
recommended-next list (compute side); enumerate all provable/definition
/remark content blocks (content side) for sweep.

## Slot H — §5b prioritisation

1. Severity (fail > warn > pass).
2. Downstream dependents (more dependents → earlier) via `uses[]`.
3. Last-audit recency (older → earlier).
4. Alphabetical as tie-breaker.

## Slot I — §6 invariants

| Invariant | Check |
|-----------|-------|
| No new free-floating external-data literal | scanner reports no new hits vs the default branch |
| No new tautology without banner | new scripts/blocks consuming their own result carry the banner or are flagged |
| No new extra-calibration script | calibration-input audit over-count delta vs default branch ≤ 0 |
| No new naked numerology | any new numerical literal in provable bodies uses the value-citation directive |
| Derivation chain unbroken | the derivation-chain validator's all-passed remains true |

## Slot J — Probe follow-up discipline

Every probe / audit / structural claim in a witness, audit doc, or
content block **must** explicitly report (or note as N/A with reason)
the project's standing probe diagnostics — the small set of labels that
keep "interesting" findings straight (e.g. which filtration level / which
order of correction / which symmetry class the claim lives at). Define
this diagnostic set per project. A structural claim without them is
unauditable: it cannot be cross-referenced against the derivation menu
without the labels. Apply to probes (in the witness `description` or a
`probe_diagnostics` field), audit-doc headline findings, and new
structural content blocks.

## Domain-specific anti-patterns (extends parent)

- ❌ Auto-fix a `coefficient-fit` or `numerology` finding. Those always
  require author input — "no fits beyond the declared inputs" is a claim
  about the project, not a code-style choice.
- ❌ Silently mark a Class-A/B/C opt-out without verifying the marker
  exists in the source.
- ❌ "Resolve" a finding by reframing it as "this is acceptable
  because…". The discipline is not negotiable per-PR; escalate.
- ❌ Emit a probe witness without the §Slot J diagnostics.
