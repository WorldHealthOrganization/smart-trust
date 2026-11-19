---
name: review
description: >-
  Where to start when a person or an agent reviews a document folio larger than
  one chapter, such as a DAK or an L1 digital transformation handbook. A pointer,
  not a method: it names the review skills that already exist, says which
  question each one answers, and gives the order to read them in. Use when
  someone asks "how do I review this", when a review session starts on a large
  folio, or before writing a new review skill, so it is not written twice.
user_invocable: true
allowed-tools: Read Grep Glob
---

# Review: a pointer to the review skills

This skill holds no rules of its own. The review skills live in cat-harness
(and one in core); each rule below belongs to the skill it names, and that
skill is the one to read and change.

## The skills, in the order a review uses them

| step | question it answers | skill | lives in |
|---|---|---|---|
| 1. What changed | Which blocks did this edit-set add, change, move or remove? | `staging-review` (opt-in `cat-harness.sdlc`) | cat-harness |
| 2. Where to look first | Which sections changed most, have open comments, and are failing or stale on QA? | [`review-heatmap`](../../../cat-harness/skills/authoring/authoring-core/review-heatmap.md) | cat-harness |
| 3. What it looks like | Before/after pictures of a rendered change, and a measured count | `before-after-preview`, `visual-diff` | cat-harness |
| 4. Saying something | How a reviewer comments on a block, and how the comment follows a renamed block | [`review-comments`](../content/content-lifecycle-ext/review-comments.md) | core |
| 5. The gate | Who reviews, and what passing means: Technical Officer first pass, Clinical SME clinical sign-off, Content Reviewer approval | [`content-review`](../../../cat-harness/skills/authoring/content-lifecycle/content-review.md) | cat-harness |

The data these skills read is core's content vocabulary, which is why the
pointer sits here:
- the ChangeSet, `schemas/changeset.ts`
- review comments, `schemas/review-comment.ts`
- reviewer verdicts and coverage, `schemas/review-verdict.ts`

## Why the steps go in this order

A large document is reviewed **diff-first**: start from what changed (step 1),
and let the heat map (step 2) say which slice of it deserves a person's time.
Reading a 300-page handbook front to back spends the same attention on an
unchanged appendix as on a rewritten recommendation. The heat map's coverage
column measures how far that slicing got. Its meaning, and what it must not be
read as, is in `review-heatmap`, not here.

## What is not here yet

None of the following exists as a skill, and none should be written in this
package without a new owner decision:
- `large-document-review`: the method, covering slicing by the folio/ graph,
  role assignment, stop rules and sign-off per slice.
- `review-navigation`: how an agent drives the review page for a person.
- Rules mined from the WHO IG starter-kit SOPs or from IEEE 1028.
