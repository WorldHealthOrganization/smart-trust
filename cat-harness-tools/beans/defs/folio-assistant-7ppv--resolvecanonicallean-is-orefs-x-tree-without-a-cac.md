---
# folio-assistant-7ppv
$schema: bean/1.0.0
title: resolveCanonicalLean is O(refs x tree) without a cache, and its two index builders walk .lake/ while listPackageLeanFiles excludes it
status: completed
type: bug
priority: normal
created_at: 2026-09-27T09:37:16Z
updated_at: 2026-10-07T17:18:00Z
parent: folio-assistant-1swy
---

Found 2026-09-27 while moving the resolver from `content/pipeline/qa-utils.ts`
into `content/pipeline/lean-formal-ref.ts` (PR #1465). **The code is unchanged**
— it moved verbatim — so this is a pre-existing cost, not a regression, and it
is filed because it was measured rather than because the move introduced it.

## What is measured

`resolveCanonicalLean(ref, repoRoot, cache?)` takes an OPTIONAL cache. Without
it, `lakeBasenameMap` and `lakeDeclMap` each call their builder **per
invocation**, so a sweep over N refs walks the Lake tree N times.

**And the two builders do not exclude Lake's build directory.** Verified by
reading both bodies: `buildLakeBasenameMap` and `buildLakeDeclMap` both do an
unconditional

```ts
if (e.isDirectory()) stack.push(full);
```

`listPackageLeanFiles`, in the same file, DOES exclude it, with a comment giving
the number: *"Measured on qou 2026-08-30: 8,013 of the 10,412 `.lean` files under
the Lake root live there — 77 %."* `buildLakeDeclMap` is the more expensive of the
two, since it `readFileSync`s and line-scans every file it finds rather than just
recording a basename.

**Realised, not hypothetical.** A probe resolving qou's 1301 distinct `lean.ref`s
without a cache **never finished** and had to be killed; with one shared cache per
column it completes in well under a minute. That is 1301 x ~10.4k files x a
full read in the decl-map case.

## Why the exclusion asymmetry is the interesting half

`listPackageLeanFiles`'s comment argues the exclusion from its own contract —
it feeds orphan-coverage scans, and *"a Mathlib file is not an orphan of this
corpus — it is not ours to cover."* The same argument applies to the two index
builders with more force: a `lean.ref` names a declaration in a PAPER package,
so a Mathlib file can never be the right answer, and indexing 8,013 of them is
pure cost that can also produce a wrong hit. `buildLakeBasenameMap` takes
**first occurrence wins** on an ambiguous basename, so a vendored
`Basic.lean`/`Defs.lean` reached before the paper's own file is a real
mis-resolution risk, not only a slowdown.

**NOT established:** whether any live ref actually resolves onto a `.lake/` file
today. That needs a run with the exclusion added and the results diffed, and it
is the first thing to do here. If any do, `resolveCanonicalLean`'s answers have
been wrong for those refs, which is a correctness bug rather than a cost one.

## Blast radius

Four callers, all going through core's delegating wrapper, which keeps its old
name and arity:

| caller | passes a cache? |
|---|---|
| `qou/scripts/check-base-ring.ts` | **yes** — one `LakeTreeCache` for the whole run, with a comment explaining why |
| `qou/scripts/check-wall-side.ts` | **no** |
| `qou/content/pipeline/qa-agent-entry.ts` | **no** |
| `cat-harness/src/qa-agent-write.ts` | **no** |

Plus `q-usage-audit.ts` on `listPackageLeanFiles`, which is already excluded and
is fine.

Note that the three cacheless callers resolve **one ref per run**, so the cost
does not bite them today — the exposure is any future bulk consumer that copies
the one-ref call shape. `check-base-ring.ts` is the one that would have been
unusable without its cache and is the reason the parameter exists.

## Next step

1. Add the `.lake` exclusion to both builders and diff resolved paths across
   qou's 1301 refs — cost fix AND the correctness question above, in one run.
2. Decide whether the cache should be non-optional (a module-level default map
   would make every caller fast and remove the shape that invites the bug),
   which changes a published signature and so is a separate call.

Nothing here blocks PR #1465: that PR moves the code and must not change it, or
a behaviour change becomes indistinguishable from the move.

## Completed on landed evidence
Landed on main in PR #1465 (formal-ref injection: the six core→sci edges are PAID, and BlockBase never had to change).
