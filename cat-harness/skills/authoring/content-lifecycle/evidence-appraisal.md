# Evidence Appraisal

Appraise and grade a **body of evidence** against the grading system the folio
declares. This skill supplies the *procedure*; it does not supply the *system*.

## Why this skill names no grading system

**Which** grading system applies is a methodological commitment of the folio
and the body that publishes it; the platform holds no subject matter, and a
hardcoded system would leave every folio that uses another one working around
the platform.
An evidence-retrieval process in the content layer judges certainty
"per the grading system the folio declares". This skill covers what appraisal
*is*, what it attaches to, and what has to survive as a record afterwards.

Domain layers supply concrete grading systems as refinement skills and code
lists (certainty levels, rating reasons, recommendation strength). Each applies
only when declared, never as a default; with nothing declared, appraisal is
refused.

## Responsibilities

- Appraise the **body** of evidence assembled for one question, not a citation
- Record the grade **with its reasons**, not as a bare label
- Distinguish "the evidence is weak" from "there is not enough to judge"
- Re-appraise when the body changes, and say what moved the grade
- Refuse to grade when no system is declared, rather than picking one

## The unit is the body, not the citation

The grade attaches to the body of evidence for **one PICO question**. This is
why appraisal sits after retrieval's parallel join and not inside the
fan-out: the three retrieval classes (trusted L1 sources, trusted
L2/L3 content, data repositories) contribute to one judgement; grading each
branch separately would produce three numbers that answer no question. A single
citation does not carry a certainty grade.

## "Cannot appraise" is a third state

Three outcomes; "not appraisable" is not a low grade:

| outcome | means |
|---|---|
| graded | the body was appraised and carries a certainty |
| **not appraisable** | too little retrieved, or no declared system, or the question was not framed as PICO |
| gap recorded | nothing authoritative was found, and that is the finding |

Never collapse "not appraisable" into the lowest grade: *"we looked and the
evidence is poor"* is not *"we could not look"*. A recommendation resting on
the first is weak; one resting on the second is unsupported.

## Inputs

- The framed PICO question — without it the search is not
  reproducible and the appraisal is not checkable
- Candidates that passed an authority check, so authority is a resolved
  fact rather than an assertion in the citation
- The grading system declared by the folio

## Outputs

- A certainty judgement for the body, in the declared system's own vocabulary
- **The reasons**, in enough detail that a later reader can tell whether they
  would still hold (`decision-audit`); a grade without them cannot be
  reviewed, only re-litigated
- Any gap, recorded as a gap rather than as a low grade

## This has nothing to do with formal content

A graded body of empirical evidence is **never** an input to a formal
deductive proof. In a content type with a formal proof layer, a formal claim's
assertion is discharged by its machine-checked proof sibling and by nothing
else; certainty grading belongs to empirical guidance about the world, where
the question is what the evidence supports. An empirical grade in a formal
proof obligation is a category error.

## Actors

- Author / guideline developer (lead)
- Domain SME (domain judgement, supplied by the content-type layer)
- Content Reviewer (checks the grade's reasons survive, not the grade itself)
