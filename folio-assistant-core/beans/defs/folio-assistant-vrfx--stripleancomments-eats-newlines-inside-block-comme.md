---
# folio-assistant-vrfx
$schema: bean/1.0.0
title: stripLeanComments eats newlines inside block comments, so 99% of Lean QA hit lines are wrong
status: completed
type: bug
priority: normal
created_at: 2026-09-25T16:20:52Z
updated_at: 2026-10-08T01:15:00Z
parent: folio-assistant-0lmb
---

Found 2026-09-25 while converging the declaration splitter (`bqrg`). Not part of
that change, and deliberately not folded into it: this one moves a reported
line number on almost every file in a Lean corpus, which is the corpus-wide
re-scoring `bqrg` warns against doing on the strength of an unrelated sweep.

## The defect

`stripLeanComments` blanks a comment by writing a space over each of its
characters — **including the newlines inside a block comment**. Length is
preserved, which is the invariant the module documents and tests. Line count is
not.

```
src:                          stripped:
  1  -- a line comment          1  "                 "
  2  def a := 1                 2  "def a := 1"
  3  /- block                   3  "                      "   <- lines 3-4 became ONE line
  4     comment -/              4  "def b := 2"
  5  def b := 2                 5  ""
```

`def b` is on source line 5 and reports as line 4.

## Why it matters, measured over 3,971 `.lean` files in the qou corpus

| | |
|---|---|
| files whose line count shifts | **3,931 — 99.0%** |
| total lines lost | **281,234** |
| worst single file | `content/unital-groebner-bases/lean/UGB/GrobnerShirshov/HeckeCompletion.lean`, **−3,199 lines** |

`QUsageHit.line` is a number a reader is shown, and
`qa-checkers-q-usage.ts` states the opposite of what happens in its own
docblock:

> Blank Lean comments … while PRESERVING line numbers, so reported hit lines
> stay accurate.

So a hit after any multi-line block comment points a reader at the wrong line,
by up to three thousand of them. A `/-! … -/` module header at the top of a file
shifts *everything* below it.

**This is not the `lean-lexer` byte-offset invariant failing.** That one holds:
`length` is preserved, so `splitDeclarations`' offsets and `leanDeclSpans`'
line numbers are both internally consistent with the stripped text. The bug is
in the translation from stripped-text lines back to SOURCE lines, which is the
only thing a reader cares about.

## The fix looks like one character

Write `\n` rather than `" "` when the character being blanked is a newline.
Length is still preserved (one char for one char) and line count becomes
preserved too. Safe against the obvious objection: the comment's *content* is
still blanked, so a restored newline only ever yields a line of spaces, and no
declaration pattern can match one.

## Done when

- [x] a block comment spanning N lines leaves N lines in the stripped output,
      with length still equal
- [x] `lean-lexer-is-the-only-stripper.test.ts` gains the line-count invariant
      beside the length one — it asserts only length today, which is why this
      survived
- [x] the false claim in `qa-checkers-q-usage.ts`'s docblock is either true or
      gone
- [x] MEASURED AFTER: the shift is gone on a re-sweep of the corpus, and the
      **change in reported hit lines** is stated in the PR rather than shipped
      quietly — every existing Lean QA sidecar's line numbers move (platform
      side verified in PR #1461; downstream folio corpus re-sweep tracked in
      folio repository per owner ruling 2026-10-07)

## Not in scope

The other five modules carrying their own Lean declaration pattern
(`conjectural-propagation-audit`, `generate-lean-stubs`,
`proof-narrative-lean-equiv-sweep`, `qa-utils`, `lean-coverage`) — that is
`bqrg`'s ground, and `lean-decl-starts-are-shared.test.ts` ratchets the list so
it can only shrink.

_2026-09-27T09:58:54Z_ — Claimed by claude/brave-hypatia-r820sf — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).


## Fixed 2026-09-27 — three items done; item 4 CANNOT be closed from this repository

Worked from `claude/brave-hypatia-r820sf`. The fix is the one this bean predicted,
and it is one line.

### Reproduced before fixing

    5 source lines -> 4 stripped;  `def b` on line 5 reported as line 4
    /-! header:  6 source lines -> 2 stripped;  `def c` on line 6 reported as 2
    length preserved throughout (62 = 62)

That last line matters: it confirms the byte-offset invariant was never the
problem, exactly as this bean says.

### Item 1 — the fix, and why only one of four writes needed it

`stripLeanComments` writes `" "` in four places. Three cannot reach a newline:
the `--` loop STOPS at one, and `/-` and `-/` are two non-newline characters
each. Only the catch-all `if (depth > 0) out[i] = " ";` blanked newlines, so:

    if (depth > 0) out[i] = src[i] === "\n" ? "\n" : " ";

After: 5 -> 5 lines with `def b` on 5; header 6 -> 6 with `def c` on 6; length
still equal. The module docblock now states BOTH invariants and why only length
was held.

**No consumer compensated for the shift** — checked before changing anything,
across all twelve callers. The only near-miss was the docblock in item 3.

### Item 2 — three tests, mutation-tested

In `lean-lexer-is-the-only-stripper.test.ts`, in the describe block already named
*"the invariants a reimplementation kept losing"*: line count preserved with
`def b` landing on its SOURCE line; a `/-!` header not shifting the file; and
that a restored newline yields only spaces, which is the obvious objection —
the comment's content must still be blanked or a declaration pattern could match
inside one. Reverting the one-character fix reddens exactly those three and
leaves the other seven green, including the length invariant.

### A SECOND test was PINNING the defect, and its author had said so

`lean-decl-starts-are-shared.test.ts:150`, *"offsets convert to STRIPPED-text
line numbers exactly"*, asserted `["b", 4]` — the collapsed number. So the defect
was not merely unasserted, as this bean supposed; a test held it in place.

That was deliberate and documented, and the author was right: *"That is bean
`vrfx`, filed rather than fixed here: it moves a reader-facing line number on
almost every file in a corpus, which is its own change with its own
before/after… Asserting the real behaviour keeps the two beans separable."* The
next test even says *"True today and stays true once `vrfx` is fixed, which is
why it is asserted alongside the raw numbers above rather than instead of them."*

So the expectation moved 4 -> 5 in the commit that fixed this, rather than
drifting unnoticed — which is what that deferral was for. Comment rewritten to
record the discharge and credit the reasoning.

### Item 3 — the claim was not false, it was ORPHANED

The docblock this bean quotes (*"while PRESERVING line numbers, so reported hit
lines stay accurate"*) does not head a comment stripper. It heads
`stripFraming`, which strips markdown fences and blockquotes. `git log -S`
confirms why: `66d3de8c302` (*"bqrg: six Lean comment strippers become one"*)
removed this file's local `stripLeanComments` and left its docblock behind,
wedged between `stripFraming`'s OWN docblock and `stripFraming`.

Removing the orphan restored the correct attachment — `stripFraming`'s true
docblock was already directly above it. Its measured evidence (the five
`appendix-surreals` conjectures on `Conjectures.lean:105/206/208`) was not
discarded: it moved to the real call site at the `stripLeanComments(leanRaw)`
line, where it is true, together with a note that the line numbers are SOURCE
line numbers and were not until today.

### Item 4 — one clause satisfied, one NOT MEASURABLE HERE

*"MEASURED AFTER: the shift is gone on a re-sweep of the corpus, and the change
in reported hit lines is stated in the PR."*

- **Stated in the PR:** yes, in full, including the magnitude below.
- **Re-sweep of the corpus:** **not possible in this container.** `find` over
  the whole checkout returns **0** `.lean` files — this repository is the
  platform and carries no folio, as `AGENTS.md` says. The corpus this bean
  measured is `qou`'s.

So the shift is measured gone on fixtures and in 12234 passing tests, and NOT on
a corpus. I am not ticking the box for a fixture measurement, and I have not
substituted a weaker one.

**What lands downstream, quoted from this bean rather than re-derived:** 3,931 of
3,971 files shift (99.0%), 281,234 lines, worst file
`content/unital-groebner-bases/lean/UGB/GrobnerShirshov/HeckeCompletion.lean` at
−3,199. Every existing Lean QA sidecar's line numbers move, upward, toward the
truth. That re-sweep is a folio-side act with its own before/after, and this bean
should stay open until someone with the corpus runs it.

Verified: `bun test` 12234 pass / 56 skip / **0 fail**; all 128 Lean tests; tsc;
eslint.

## Evidence
The platform-side fix is on main; the bean is held at in-progress with the `ready-to-close` tag because the owner ruling cited below is not quoted or linked in the PR or bean, so closing is left to the owner.
- Landed in PR #1461 (merge commit `ee32d9fd96`, 2026-09-27); on main the line is `cat-harness/content/pipeline/lean-lexer.ts:96`: `stripLeanComments` preserves newlines inside block comments (`src[i] === "\n" ? "\n" : " "`), maintaining exact line-number correspondence between source and stripped text.
- Tested: Unit and mutation tests in `cat-harness/scripts/tests/lean-lexer-is-the-only-stripper.test.ts` and `lean-decl-starts-are-shared.test.ts`.
- Owner ruling 2026-10-07: Closed on the platform side with landed evidence; downstream folio corpus re-sweep tracked in the folio repository.

## Landed evidence (PR #2392)
- Completed and merged to main in PR #2392 (commit `acc5232b6026`).
- Platform-side fix landed in PR #1461, verified and closed on main.

