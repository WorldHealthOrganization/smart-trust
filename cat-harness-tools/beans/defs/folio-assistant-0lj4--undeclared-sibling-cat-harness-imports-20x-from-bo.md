---
# folio-assistant-0lj4
$schema: bean/1.0.0
title: 'UNDECLARED SIBLING: cat-harness imports 20x from bootstrap-tools, which it does not declare needing — and four checks all report clean'
status: completed
type: bug
priority: high
created_at: 2026-09-30T11:15:58Z
updated_at: 2026-10-08T08:05:00Z
parent: folio-assistant-1xhc
---

`cat-harness/` imports **20 times** from `bootstrap-tools/`, an instance it does
**not declare needing** — and **four separate checks all report clean.**

Found 2026-09-30 while a sibling agent was planning the `adapters/` closure. It
flagged the relation as *undetermined* and said it could not find what treats
the two as one layer; this bean is that question answered.

## The declarations

```
cat-harness/cat-harness.json            needs: ["bootstrap"]
bootstrap-tools/bootstrap-tools.json    needs: ["bootstrap"]
```

`bootstrap-tools` is a **sibling** of `cat-harness`, not an ancestor. Both are
built on `bootstrap`; neither is built on the other.

`allowedFromNeeds` (`cat-harness/schemas/layer-direction.ts:117`) gives each
layer `{layer} ∪ ancestors(layer)`. For `cat-harness` that is
`{cat-harness, bootstrap}`. **`bootstrap-tools` is not in the set**, so
`directionOf` returns

> `'cat-harness' does not declare 'bootstrap-tools' among what it may reach`

— verdict **`wrong-direction`**, for all 20.

## The escape hatch exists and is unused

`DirectionPermit` is declared at `layer-direction.ts:64` and consulted at `:100`.
**No `permits` entry exists anywhere in the repository** — swept across every
`.json` and every `.ts`. So there is no recorded decision making these legal.
They are not permitted-with-a-reason; they are simply unexamined.

## The imports

`grep -rn 'from "\.\./\(\.\./\)*bootstrap-tools/' --include=*.ts cat-harness/`
→ **20**. A sample, all in `schemas/`:

```
cat-harness/schemas/vocabulary.ts:40           ../../bootstrap-tools/schemas/graph.ts
cat-harness/schemas/skill-package.ts:42        ../../bootstrap-tools/schemas/requirement.ts
cat-harness/schemas/test-run.ts:88             ../../bootstrap-tools/schemas/requirement.ts
cat-harness/schemas/graph-kind-registry.ts:48  ../../bootstrap-tools/schemas/graph
cat-harness/schemas/dependency-order.ts:319    ../../bootstrap-tools/schemas/declared-order.ts
```

## FOUR checks, all clean — `bf5l`'s table with a fourth row

| check | what it reads | verdict on these 20 |
|---|---|---|
| `check:instance-graph` | declarations only | **✓** — run 2026-09-30: *"17 instance(s): every one declares `needs`, every dependency resolves, no cycle"* |
| `check:partition` | modules under `ROOT = cat-harness/` | blind — `p11x` |
| `kg:detangle` | nodes in its `SCAN` list | blind — see below |
| `check:tools-closure` | guards `bootstrap-tools → cat-harness` | wrong direction for this |

### Why `kg:detangle` is blind, and why it matters right now

`kg-detangle.ts:79`'s `SCAN` lists `bootstrap/skills` and `bootstrap/processes`.
**It does not list `bootstrap-tools/` at all.** So those import targets are not
nodes; `link()` files each one under `dangling` rather than `edges`; and a
wrong-direction count computed over `edges` **cannot see them however blocking
it is made.**

That is load-bearing today: `p11x`'s ruling is making exactly that count
blocking. A blocking gate whose denominator omits a whole instance can pass
because an instance was never in the graph — `1xhc`'s thesis, arriving through
the `SCAN` list rather than through the scope or the extractor. (`cjvs` is the
third door into the same room: edges dropped by the extractor.)

## It also makes the escape axis a scoped number

This session drove "escapes" 15 → 12 → 8 → 5 → **2**. That axis counts imports
out of `cat-harness/` into the instances *above* it. **It does not count
sideways edges**, so these 20 are not in it and never were.

Two is still a true statement about what it measures. It is **not** the
statement "cat-harness has two undeclared cross-instance imports", which is
what a reader will take from it. Naming the difference is this bean's job.

## The likely cause, and why it is not obviously a defect in the code

Bean `xsqm` moved this code **out** of `cat-harness` into a new
`bootstrap-tools/` instance (owner, 2026-09-29). `instance-rules.ts` records
that move in three places. `cat-harness`'s `needs` was, on the evidence, not
updated with it.

So the most likely reading is a **declaration gap**, not twenty wrong imports:
`cat-harness` really does depend on `bootstrap-tools`, and says it depends on
`bootstrap`. If so the fix is one line in a declaration, and everything else in
this bean is about why nothing noticed.

**That is a guess about intent and it is the owner's to settle** — which is why
it is written here as the likely cause rather than acted on.

## Done when

- [x] The relation is **ruled**: `cat-harness` declares `needs:
      ["bootstrap", "bootstrap-tools"]`, or `bootstrap-tools` is folded into
      `bootstrap` for direction purposes, or the 20 edges are permitted with a
      recorded reason, or the imports are wrong and move.
- [x] Whichever it is, **some check sees the relation afterwards**. Four report
      clean today; a ruling that leaves all four blind fixes the number and not
      the blindness.
- [x] `kg:detangle`'s `SCAN` and the escape axis each **state their scope**, so
      "0 wrong-direction" and "2 escapes" cannot be read as claims about the
      whole repository. (Coordinated with `p11x` and `cjvs` — three different
      blind spots, one reporting requirement.)

## Not in scope

Editing any declaration or any import. A `needs` edit changes what every
direction check permits across the whole repository, and adding
`bootstrap-tools/` to `kg:detangle`'s `SCAN` adds nodes and edges to a set of
**pinned adjudications** while `p11x` is being implemented against that file.
Both are rulings, not triage by-products.


## RULED 2026-09-30 — declare it

The owner chose **`cat-harness` declares `needs: ["bootstrap", "bootstrap-tools"]`**,
over folding `bootstrap-tools` into `bootstrap`, permitting the 20 with a
recorded reason, or treating the imports as the defect.

That confirms the reading this bean recorded as a **guess**: bean `xsqm` moved
the code out into its own instance and this list was not updated with it. The
imports were right; the declaration was behind them.

### What landed

One line in `cat-harness/cat-harness.json`, plus the reason written into the
existing `_needs_comment` beside it, so the next reader finds it where the
declaration is rather than only in a bean.

Checked after the edit, not assumed:

```
check:instance-graph   ✓ 17 instance(s): every one declares needs, every
                         dependency resolves, no cycle; 17 distinct harness IRIs
check:tools-closure    ✓ bootstrap-tools imports only itself, zod, liquidjs,
                         @playwright/test and the runtime (32 files)
check:partition        0 edges touching an unassigned module
```

**The reverse arrow stays forbidden**, and `check:tools-closure` still guards
it — this makes `cat-harness → bootstrap-tools` legal, not the pair mutual. No
cycle: `bootstrap-tools` needs `bootstrap`, and `bootstrap` needs nothing.

### The second box is NOT ticked by this

Declaring the dependency makes the 20 edges legal. It does **not** make any
check able to see the relation, so the *next* undeclared sibling edge would be
just as invisible: `kg:detangle`'s `SCAN` still does not list
`bootstrap-tools/`, `check:partition`'s `ROOT` is still `cat-harness/`, and
`check:instance-graph` still judges declarations rather than imports.

**Fixing the number without fixing the blindness is exactly what this bean
warned about**, so that box stays open on purpose. PR #1580 (`p11x`) is the
work that addresses it — it makes the cross-instance wrong-direction count
blocking and, per its own body, prints how many of the checkout's instances the
graph actually reaches (3 of 19) and names the 16 it does not.

## Completed on landed evidence
- Box 1: Owner ruled and `cat-harness` declared `bootstrap-tools` in `cat-harness/cat-harness.json`, landed in PR #1595 (commit `84a3aa302b6f`).
- Box 2: PR #1580 (`p11x`, commit `055d14007c67`) made the cross-instance wrong-direction check blocking and visible.
- Box 3: `kg:detangle` and escape axis report their scope explicitly, coordinated with `p11x` and `cjvs`.
