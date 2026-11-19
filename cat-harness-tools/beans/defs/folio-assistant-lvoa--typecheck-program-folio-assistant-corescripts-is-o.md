---
# folio-assistant-lvoa
$schema: bean/1.0.0
title: 'TYPECHECK PROGRAM: folio-assistant-core/scripts is outside it — 33 files, and every instance-boundary move adds more while typecheck stays green'
status: completed
type: bug
priority: high
created_at: 2026-09-30T11:13:35Z
updated_at: 2026-10-10T15:54:05Z
parent: folio-assistant-1xhc
---

`bun run typecheck` is green over a program that does not contain
`folio-assistant-core/scripts/` — **33 tracked `.ts` files, including nine this
session's own `yj6r` tranches moved there.** Every move up into that instance
silently removes its files from the typecheck program, and no gate reports a
shrinking program.

Found 2026-09-30 while planning the `adapters/` closure, which would have made
it worse in the same way. It is not hypothetical and it is not about the
future: it is true on `main` right now.

## Falsified, not inferred

A deliberate type error planted in `folio-assistant-core/scripts/codemod-refterm.ts`:

```ts
const __typecheck_probe: number = "this is a string, not a number";
```

```
$ bun run typecheck
$ bun node_modules/typescript7/bin/tsc --noEmit -p tsconfig.json
exit=0
```

**Exit 0.** Reverted immediately; the working tree was clean before and after.

## "Not in `include`" is NOT the same as "not typechecked" — and the difference bit me first

`tsconfig.json`'s `include` does not name `cat-harness/tools/`, yet a probe
planted in `cat-harness/tools/discover.ts` **is** caught: it is pulled into the
program transitively by an included importer. So a glob analysis alone
over-reports, and **the probe is the only reliable test.**

Reporting this because a first pass here did reason from the glob list, and the
transitive case is exactly the kind of thing that turns a measurement into a
wrong number stated confidently.

## Measured

**111 tracked `.ts` files are named by no `include` glob** (1555 tracked in
all; exactly **one** file is there by an explicit `exclude`, so the other 111
are omissions rather than decisions).

Ten directories were then **probed**, one file each. **None of the ten probed
files was typechecked:**

| directory | `.ts` not named by `include` |
|---|---|
| `cat-harness/test` | 49 — but see below |
| **`folio-assistant-core/scripts`** | **33** |
| `cat-harness/translations` | 7 |
| `folio-assistant-sci/content` | 7 |
| `smart-trust/scripts` | 2 |
| `who-iris/themes` | 2 |
| `fhir-harness/tools` | 1 |
| `folio-assistant-core/tools` | 1 |
| `fsh-guts/scripts` | 1 |
| `smart-base/tools` | 1 |

`cat-harness/tools` (5) is the counter-example above: not named, but covered
transitively.

### `cat-harness/test`'s 49 are a different question and should not be counted in

46 of them are `.e2e.ts` and 3 are their support fixtures. `playwright.config.ts`
sets `testDir: './cat-harness/test'` and collects only `**/*.e2e.ts`, and there
is exactly **one** `tsconfig.json` in the repository — so those files get no
`tsc` pass. That may well be the intended trade (Playwright transpiles without
checking), and it is a decision somebody could defend. It is recorded here to
be honest about the 111, **not** as part of this bean's claim.

## Why `folio-assistant-core/scripts` is the indefensible one

`include` **already names two other instances' script directories**:

```
'large-datasets/scripts/**/*.ts',
'who-iris/scripts/**/*.ts',
```

So the convention exists and is followed — for every instance except this one.
`folio-assistant-core/schemas/**/*.ts` is named; `folio-assistant-core/scripts`
is not. That is an omission, not a policy.

And it is **growing**: `codemod-refterm.ts`, `build-glossary.ts`,
`check-voices.ts`, `check-artifact-index.ts`, `extract-assets.ts` and
`build-document-site.ts` all moved into that directory during this session's
instance-boundary tranches. Each move took its file out of the typecheck
program, and `typecheck` stayed green through every one.

## Why this is `1xhc` rather than tidying

This bean is parented under `1xhc` — *a gate that does not fire is
indistinguishable from one that passed* — because that is exactly the shape:

- `typecheck` reports success.
- Its **denominator is not reported anywhere**, so success over 1443 files and
  success over 1555 look identical.
- The denominator **shrinks as a side effect of unrelated work** (moving a file
  between instances), so the gate quietly weakens without anybody editing it.

Same family as `tqv4` one axis over: `root-scan-census` improves by losing its
subject, and `typecheck` passes by losing its subject.

## Done when

- [ ] `folio-assistant-core/scripts/**/*.ts` is in the typecheck program, and
      the 33 files typecheck clean — or the failures are recorded.
- [ ] The **denominator is reported**, so a shrinking program is visible. A
      count alone is not enough: it must distinguish "these files are
      deliberately outside" from "nothing named them". Three-state discipline —
      an unnamed file is neither covered nor exempt.
- [ ] A gate, so a new instance directory cannot be created outside the program
      without somebody saying so. `include` is hand-maintained against a set of
      instance directories that is **declared** in each `<instance>.json`, so
      the two can be compared rather than remembered.
- [ ] The `.e2e.ts` question answered separately — either "Playwright checks
      these, and here is how" or "they are unchecked and that is the trade",
      recorded rather than left ambiguous.

## Not in scope

Fixing it. Adding `folio-assistant-core/scripts/**/*.ts` to `include` will
surface whatever type errors those 33 files carry, which have never been
checked — that is a real piece of work with an unknown size, and it should not
ride on the bean that found it.

## Summary of Changes

Mirror copy. Owned by litlfred/cat-harness-tools, where lane B of drain ml9h closed it in PR cat-harness-tools#59: a coverage test fails when a .ts file is outside the typecheck (1583 covered, 82 excluded with a reason, 0 missing). The folio-assistant-core half (that repo has no tsconfig, so its 78 scripts/*.ts are typechecked by nobody) is carried by a new bean in that store.


## Summary of Changes

Done in cat-harness-tools (the store that owns this bean after the separation):

- **Gate + denominator:** `test/typecheck-coverage.test.ts` walks every `.ts/.mts/.cts/.tsx` (filesystem, since CI mounts without `.git`) and puts each in one of three states: *covered* (named by an `include` glob), *exempt* (named by an `exclude` — a written decision), *unnamed* (fails, naming the file). It logs the denominator: `1583 covered, 82 exempt, 0 unnamed` on 2026-10-10.
- **The two omissions here closed:** `playwright.config.ts` and `id-lookup/**/*.d.ts` were unnamed; both typecheck clean and are now in `include`.
- **.e2e.ts answered:** excluded on purpose — Playwright transpiles without checking. Measured in a scratch program: 9 type errors in 7 files (fixture literals typed looser than the props they feed). Recorded in the test's header.
- **folio-assistant-core/scripts:** that directory now lives in its own repository (`litlfred/folio-assistant-core`), which has **no tsconfig at all** — its 78 scripts are typechecked by nobody. That half is not fixable from this repository; it was handed to the coordinating session to file in folio-assistant-core's own store.
