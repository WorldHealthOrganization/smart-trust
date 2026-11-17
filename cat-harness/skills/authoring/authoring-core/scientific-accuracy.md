---
name: scientific-accuracy
---

# Scientific Accuracy Skill

## Purpose

Evaluate commits for technical correctness, scientific/scholarly rigor,
and logical consistency.

## Checks

### 1. Quantitative Verification

- All equations, formulas, and numerical computations are correct.
- Dimensional analysis and unit consistency hold.
- Boundary conditions and edge cases are handled appropriately.
- **Derived/computed values must be cited, not hard-coded.** Any
  numerical literal that the project computes from a canonical source
  (a witness file, a registry, an upstream result) should be referenced
  through the project's value-citation mechanism rather than copied as a
  bare literal. See the value-witnessing skill for the registry
  contract, the directive syntax, and the codemod that rewrites bare
  literals. Flag any new hard-coded numeral that has (or could have) a
  registry entry as a drift risk.

### 2. Scientific Rigor

- Claims are supported by evidence or sound reasoning.
- Terminology is used correctly and consistently.
- Referenced constants, data, or facts are accurate.
- **Keep results in their most exact / structural form for as long as
  possible.** Carry symbolic or exact-arithmetic expressions through the
  derivation and only evaluate numerically at the final step;
  premature numerical evaluation discards structure that later steps
  rely on.
- **NO APPROXIMATIONS unless explicitly labeled as such.**
- **NO correction factors, fudge factors, or empirical scaling**
  presented as if derived.
- **NO formulas that are not derived from the project's stated
  foundations.**
- **Distinguish look-alike quantities.** When two measures share a name
  or notation (e.g. two different notions of "degree", "length",
  "dimension", or "volume"), state which one is meant; never silently
  conflate them.
- **EVERY observed/experimental value MUST carry ± uncertainty.** No
  external/measured constant without an error bound; use a single
  source-of-truth registry for such constants.
- **EVERY derived quantity MUST propagate error.** If $f(x)$ depends on
  $x \pm \delta x$, then $\delta f = |f'(x)|\,\delta x$; for products,
  relative errors add in quadrature. Track high-sensitivity
  amplifications explicitly.
- **Do not use $O(\cdot)$ to discard exact structure.** If a quantity is
  an exact count or an exact polynomial degree, state the exact value
  rather than asymptotizing it away.
- **Speculation is OK in conversation** with the author (to explore
  ideas), but **NEVER commit speculative content** without explicit
  author consent. If unsure, ask before committing.
- **Every quantity must trace back to the project's foundational
  definitions.** If a computation cannot be done exactly, say so; do not
  introduce smooth approximations or fitted coefficients and present
  them as derived results.

### 3. Statistical and Methodological Soundness

- Statistical methods are appropriate for the analysis.
- Sample sizes, power calculations, and significance thresholds are
  reasonable.
- Common pitfalls are avoided: p-hacking, multiple comparisons,
  survivorship bias.

### 4. Logical Consistency

- No logical fallacies or unsupported leaps in reasoning.
- Conclusions follow from the presented evidence.
- Internal consistency is maintained across the changeset.

### 4b. Calibration / input discipline

A project that produces predictions from a small number of external
inputs should declare exactly which inputs are *calibrations* (taken
from outside) and which quantities are *derived*. Every numerical
observable should factor as a derived expression times a fixed power of
the declared calibration inputs, with no hidden additional inputs.
**Flag** as part of accuracy review:

- *Free parameters* beyond the declared calibration set — a hidden extra
  input is a hard audit failure.
- *Coefficient fits* to external data labelled "ad hoc", "approx", or
  "tuned".
- *Numerological substitutions* (round/“magic” numbers asserted as data
  without derivation).
- *Tautologies* where a "derivation" uses its own result as input.
- *Rationalization*: prose arguing *why* a value is right rather than
  *deriving* it.

For active monitoring of derivation discipline across incoming commits
and PRs, route the request to the canonical-derivation watcher. The
classification of a candidate as production / exploratory / numerology
is owned by the `production-vs-exploratory-discipline` skill.

### 5. Reproducibility

- Methods are described with sufficient detail to reproduce.
- Magic numbers are explained or referenced.
- Algorithms are correctly implemented.

## Content types with a formal layer

A content type that carries a formal-proof layer beside the narrative adds
its own accuracy checks on top of these: the consequence-versus-axiom audit,
formal cross-references, and validation across the content-object triple.
The layer that ships that content type holds them and names this skill from
its side (for a paper folio, the science layer).

## Glossary terms

Every term registered in a block's `defines: [...]`
must appear wrapped at every mention — once at the canonical definition
site and as a reference everywhere else. Bare-text or emphasized
mentions of a defined term break the canonical-name → canonical
-definition link the validator relies on and are accuracy violations.
Run the project validator in strict mode to catch term-mention-coverage
warnings.

## Mandatory fallback participation

This skill is invoked automatically by the editor's **content-change
fallback** (see `editor` §"Content-change fallback (mandatory review)")
whenever content is modified. When invoked as a fallback, focus on the changed blocks and their immediate
dependencies.

## Output Format

```
- **Summary**: One-paragraph overall assessment.
- **Issues Found**: Numbered list (severity: critical / major / minor).
- **Suggestions**: Numbered list of improvements.
- **Verdict**: APPROVE, REQUEST_CHANGES, or NEEDS_DISCUSSION.
```
