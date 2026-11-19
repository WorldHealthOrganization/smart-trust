---
# folio-assistant-24fa
$schema: bean/1.0.0
title: beans:claim pushes to main, which GUARANTEES a refuse-class conflict on the claiming branch's own completion
status: completed
type: bug
priority: normal
created_at: 2026-10-03T00:43:10Z
updated_at: 2026-10-07T17:38:00Z
parent: folio-assistant-d33q
---

## Measured on itself, 2026-10-03

`bun run cat beans:claim 8rff` writes the claim **straight to `main`**:

> `_2026-10-03T00:27:48Z_ — Claimed by claude/merge-patterns-8rff — pushed to
> main so sibling sessions see it before this branch has a PR (bean 35nj)`

That is deliberate and it works — `35nj` ("A bean claim is invisible to a
sibling until the PR exists, so claim-before-work does not prevent a
same-minute duplicate", `completed`) is the bean it solves.

**The cost is not recorded anywhere, and `35nj` mentions conflict zero
times.** The claiming branch then edits the same bean to complete it, so both
sides diverge from the merge base in the same file:

| side | change |
|---|---|
| `main` | `status: todo → in-progress`, new `updated_at`, the claim note appended |
| the claiming branch | `status: todo → completed`, new `updated_at`, a `## Summary of Changes` |

`merge-conflict-patterns` classifies `beans/defs/**` as **`refuse`** on
purpose, and `merge:main` is all-or-nothing, so **the whole merge refuses** on
a bean the claiming session owns outright and nobody else touched.

Measured instance: PR #1943 merging `origin/main` (`ea1d8b105`) refused on
**exactly one** path — `beans/defs/folio-assistant-8rff--…md` — and that
conflict was entirely between two actions of the same session.

## Why this is worth more than its size

**Every bean-completing PR now hits it.** Claim the bean (pushes to main),
complete it on the branch, merge — refuse. It is not an edge case; it is the
normal path, and it manufactures precisely the `[beans: refuse]` class that
blocked #1894 and then #1943.

It also makes the refusal reason misleading. The resolver says *"two sessions
editing one bean is a coordination question"* — true in general, and **false
here**: it is one session, and there is nothing to coordinate. An agent
reading that text looks for a sibling who does not exist.

## Options, none chosen

1. **Claim on the branch and let the PR carry it.** Loses `35nj`'s whole
   point — the claim becomes invisible until the PR exists.
2. **Keep the main push, and have `beans:claim` also write the identical note
   to the branch.** Then the body merges cleanly (git merges identical
   changes) and only the front-matter `status` line can conflict. Cheap, and
   it is what was done by hand on #1943.
3. **A `beans-claim-note` strategy** that resolves the claim block by union
   while leaving the rest of `beans/defs/**` refused. Narrow, and it would
   have to dedupe `updated_at` — `check-bean-front-matter`'s recorded defect.
4. **Accept it**, and change the refusal TEXT so it stops asserting two
   sessions when one will do.

(2) and (4) are compatible and together cost least. Recorded as options
because this is a design question, not a defect with one fix.

## Done when
- [ ] owner or coordinator picks an option
- [ ] if the text stays: the refusal no longer claims "two sessions" when the
      two edits may be one session's
- [ ] `35nj` annotated with the cost its remedy creates, since it is the bean
      a reader lands on


## Measured, 2026-10-03 — how much of main's movement this is

Of the last **60 tip-moves** on `main` (`git log origin/main --first-parent`):

| what moved the tip | count |
|---|---|
| PR merges | 48 |
| **`beans:claim` pushing straight to `main`** | **10** |
| other direct pushes | 2 |

So roughly **one main-move in six is a claim**, not a merge. Measured with
`--first-parent`: a plain `git log` walks the merged branches' own commits and
gives a badly misleading split (it reported 27 merges against 165 "other"),
which is worth recording because the wrong number makes claims look negligible.

### Why this now costs more than it looks

Each tip-move re-conflicts every open PR and, until bean `o8s9` lands, cancels
the in-flight per-PR jobs of the `merge-main` sweep. A claim therefore pays the
full price of a merge while landing no reviewed change.

It also defeats a merge freeze. The owner froze merges to `main` on
2026-10-03 (recorded on `o8s9`) so the queue could be drained after the
mechanism was fixed. `main` moved anyway, during the freeze, from
`1aaa669f998` to `c4036a79af0` — and that commit is
`beans(folio-assistant-8c6v): claim in-progress from
claude/docs-pages-merge-pattern-declare-8c6v`, a claim pushed by an agent this
session had dispatched. **A freeze on merges is not a freeze on `main` while
claims bypass the PR path.**

PR #1947 (merged) made a claim mirror its note to the branch, which is the
same problem seen from the other side.

This is evidence for the ruling this bean is already waiting on, not a new
question, and not an argument for any particular answer: a claim that
announces on `main` is exactly what makes it visible to a sibling session, which
is the thing `bean-coordination` wants. The cost is now measured, so the
trade-off can be decided rather than estimated.

_2026-10-07T05:10:06Z_ — Claimed by claude/laughing-ramanujan-uripip — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

## Decided 2026-10-07 (owner, option 1 of #2376)

After a successful push, beans:claim brings the claim commit into the claiming branch: fast-forward with no commits of its own, merge commit otherwise; a detached checkout, local edits in the way, or a conflicting merge aborts cleanly and falls back to the text mirror, and the outcome says so. Copying the text was measured insufficient on #2344 (byte-identical copy, still conflicted on updated_at and the body end), and a conflicted PR gets no CI (#2376, seven PRs).

## Done when
- [x] claim-bean.ts joins the claim commit (joinClaim); describe() says how, or why not.
- [x] Tests: fast-forward, merge commit, fallback, and the end-to-end claim→complete→merge main that fails on the old code.
- [x] merge-conflict-patterns skill updated.
- [ ] Merged, and the next claim from a fresh branch fast-forwards in real use.

## Completed on landed evidence
Landed on main in PR #2419 / commit 5026618c4aef (claim-bean: give joinClaim's merge commit an identity).
