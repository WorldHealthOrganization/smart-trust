---
# folio-assistant-9cc0
$schema: bean/1.0.0
title: 'ROOT TYPECHECK IS RED ON MAIN: tsconfig sweeps a separately-published sub-package whose vitest dep is not installed at the root'
status: completed
type: bug
priority: normal
created_at: 2026-09-26T11:06:36Z
updated_at: 2026-09-26T12:54:56Z
parent: folio-assistant-1xhc
---

## What is failing

`bunx tsc --noEmit` exits **2** on `main`:

    cat-harness/schemas/block-qa-schema/tests/parity.test.ts(26,40):
    error TS2307: Cannot find module 'vitest' or its corresponding type declarations.

**Measured on pristine `origin/main` at `a7b5f021498c786a90198196e18eb3d6c27a61ce`
in a clean detached worktree with `bun install --frozen-lockfile` — not on a
branch, not in a dirty container.** Arrived in `832cf524db` (bean `rsi6`, *"the
package's `test` script had never passed"*).

## Root cause, read rather than guessed

Three facts, each from the file that holds it:

| fact | source |
|---|---|
| the root includes `cat-harness/schemas/**/*.ts` | `tsconfig.json` `include` |
| `block-qa-schema` is a SEPARATELY PUBLISHED package that compiles itself | it has its own `cat-harness/schemas/block-qa-schema/tsconfig.json` |
| it declares `vitest: ^4` as its OWN dependency | `cat-harness/schemas/block-qa-schema/package.json:50` |

So the root typecheck reaches into a nested package that owns its own
compilation, and that package's dependencies are not installed into the root
`node_modules`. The glob was written before the nested package had tests.

**Note which gate does NOT see this.** `bun test` passes — 11826 pass — because
the file is a `vitest` suite that bun's runner does not pick up. Only `tsc`
sweeps it. A red typecheck and a green test suite over the same file is the
`1xhc` shape one level out: the runner that would judge the file is not the one
that reaches it.

## A tested patch, not a suggested one

One line in the root `tsconfig.json`:

```json
  "exclude": [
    "cat-harness/schemas/block-qa-schema",
    "dist",
    "node_modules"
  ]
```

**Verified by applying it to pristine `origin/main` in a clean worktree:
`bunx tsc --noEmit` exits 0.** That is the whole diff — 2 insertions, 1 deletion.

## Why this is the shape rather than the alternative

The other obvious fix is adding `vitest` to the ROOT `devDependencies`. That is
worse: it makes the root carry a dependency only one nested package uses, and it
does not address the reason the root is compiling that package's test files at
all. The sub-package's own `tsconfig.json` IS the declaration that it compiles
itself — excluding it makes the root honour that declaration.

**But it is a judgement about the compilation surface, not a defect with one
answer**, which is why this is a bean with a tested patch rather than a push. If
the intent is that the root type-checks every instance's schemas including
nested published packages, then the fix is installing the workspace properly and
the exclude is wrong.

## Why I did not fix it on #1361

It is unrelated to that branch's four features, no fix exists anywhere to port
(searched open PRs for `vitest`/`parity`: 0 results; no bean named it), and
widening a PR the owner has not yet ruled on splitting is the wrong direction.
Reported on #1361 with this patch.

## Done when

[ ] the owner decides which shape is correct: exclude the nested package from the
    root, or install the workspace so the root can compile it
[ ] `bunx tsc --noEmit` exits 0 on `main`
[ ] whichever way it goes, the reason the glob and the nested package disagree is
    written down where the next person adding a nested package will meet it



## And CI cannot see it either — a second masking layer, measured

Run `36238697037` on `75150734ca`, the `TypeScript — tests, lint, types (hard)` job:

    step 5  Install dependencies   success
    step 6  bun test               FAILURE   (main's translation:drift, 1 of 11939)
    step 7  bun run cat lint           skipped
    step 8  tsc --noEmit           skipped
    …       47 further gate steps  skipped

**So `tsc` never runs in CI while `bun test` is red**, and `bun test` is red on
`main` for an unrelated reason (the 25 uncatalogued translations, bean `ngxj`).
The typecheck error this bean is about is therefore invisible in CI *and* invisible
to `bun test`, for two different reasons:

| runner | why it cannot see the defect |
|---|---|
| `bun test` | the file is a `vitest` suite bun's runner does not pick up — 11894 pass over a tree whose typecheck is broken |
| `tsc` in CI | skipped, because an earlier step in the same job failed |

That is why this belongs under `1xhc` rather than beside it. The parent's claim is
*a gate that does not fire is indistinguishable from one that passed*; here the
gate that WOULD fire is skipped by a sequential job, so a real typecheck failure
sits behind an unrelated red indefinitely. It would surface only on the day the
drift test goes green — as a surprise, on somebody else's PR.

**Not proposing the fix for that**, because reordering or decoupling 50 gate steps
in one job is a CI-shape decision, and bean `m5gx` (*"one red test at step 5 masks
149 gate commands in CI"*, from `main`) already owns exactly this subject. Noted
here as evidence for it rather than as a second answer to it.

Measured 2026-09-26 by reading the job's step list, not inferred from the
conclusion.



--------

## 2026-09-26T12:50Z — FIXED ON MAIN, by a narrower patch than the one proposed here

`1e0deb26f8` on `main`: *"tsconfig: stop typechecking block-qa-schema's tests — it
unmasks `bun test`"*.

    root tsconfig.json exclude
      before   ["dist", "node_modules"]
      after    ["cat-harness/schemas/block-qa-schema/tests", "dist", "node_modules"]

Verified on this branch after merging: **`bunx tsc --noEmit` exits 0**, the first
clean typecheck this branch has had.

### Their scope is narrower than mine, and narrower is right

This bean proposed excluding `cat-harness/schemas/block-qa-schema` — the whole
package. They excluded only its `tests` directory. **That is the better patch and
mine was one directory too wide.**

The reasoning I did not finish: the sub-package's non-test sources *should* be
typechecked by the root, because they are ordinary TypeScript that the root can
resolve. Only the `vitest` suite cannot be, because that one dependency is declared
one level down and not installed at the root. Excluding the package would have
quietly stopped typechecking its real code to fix a problem confined to its tests
— a wider silence than the defect.

So: the measurement here was right (reproduced on pristine `main`, in a clean
worktree), the diagnosis was right (root glob sweeping a separately-published
package whose dependency is declared one level down), and the remedy was too broad.
Worth keeping, because "I verified the patch fixes it" is not the same as "I
verified the patch fixes only it" — I tested that `tsc` exits 0 and never asked
what else my exclude would stop checking.

### The second masking layer this bean recorded is unaffected

`tsc` was ALSO skipped in CI behind a failing `bun test`, which this bean documented
from run `36238697037`'s step list. That is still true and still `m5gx`'s subject —
their commit message names the same theme (*"it unmasks `bun test`"*). Nothing here
claims that half is fixed.

Closed on **evidence, not authorship** (`bean-coordination`): the defect is gone
from `main` and verified gone here.
