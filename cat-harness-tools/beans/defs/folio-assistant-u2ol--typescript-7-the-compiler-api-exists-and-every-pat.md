---
# folio-assistant-u2ol
$schema: bean/1.0.0
title: 'TYPESCRIPT 7: the compiler API exists, and every path to it is namespaced `unstable/`'
status: completed
type: task
priority: normal
created_at: 2026-09-23T01:37:44Z
updated_at: 2026-09-27T09:25:00Z
parent: folio-assistant-1xhc
---

## What

Dependabot #910 and #914 raise `typescript` 6 → 7. The owner ruled *"everything,
including the TS 7 rewrite"* (issue #956, 2026-09-22), with the stated escape:
*if TS 7 ships no supported compiler-API equivalent, pin to 6 and say so.*

**Neither branch of that ruling is what the measurement found.** An equivalent
exists, it works, and its own package path says `unstable`.

## Measured 2026-09-23 against `typescript@7.0.2`, installed in a scratch

**The main entry is gone.** `require("typescript")` exposes **two** exports —
`version` and `versionMajorMinor`. Every one of these reads `undefined`:

    createSourceFile   SyntaxKind   forEachChild
    ScriptTarget       createProgram   isInterfaceDeclaration

That is why the two consumers show 69 + 38 errors: `schema-graph.ts` and
`content/pipeline/qa-criterion-hash.ts` use **61 `ts.*` references** between
them.

**But TS 7 does ship an AST API — under `./unstable/`.** Loaded and confirmed
working:

| subpath | exports |
|---|---|
| `typescript/unstable/ast` | 409 |
| `typescript/unstable/ast/is` | 347 |
| `typescript/unstable/ast/scanner` | 25 |
| `typescript/unstable/sync` | 44, including `Program` and `Project` |

**Every type guard these two files use already exists there.** Checked one by
one — `isIdentifier`, `isPropertyAccessExpression`, `isStringLiteral`,
`isVariableStatement`, `isTypeAliasDeclaration`, `isPropertyAssignment`,
`isInterfaceDeclaration`, `isFunctionDeclaration`, `isEnumDeclaration`,
`isClassDeclaration` — **0 missing**.

## What is NOT there, and it is the part that decides the cost

**No standalone parse, and no read-only walk.** `createSourceFile`,
`parseSourceFile` and `forEachChild` are absent from `unstable/ast`,
`unstable/ast/is`, `unstable/ast/utils` and `unstable/ast/scanner` alike.
`unstable/ast/visitor` offers `visitNode`, `visitNodes`, `visitEachChild` —
a **transform** vocabulary, not the read-only descent both consumers do.

The replacement for "parse this one file and walk it" is
`unstable/sync`'s `Project` / `Program`: you construct a project and query it.

**So this is not a port. It is a re-architecture** of how both files acquire
their tree, and the type guards — the part that looks like the bulk — are the
part that needs no work at all.

## The decision, and why it is not an agent's

The rewrite is *possible*. The question is whether two scripts that run inside
`bun run cat gates` on **every push** should depend on an API whose own path says
`unstable`. Upstream reserves the right to change it in a patch release, and
these are not optional tools:

- `schema-graph.ts` builds the schema knowledge graph from TS declarations
- `qa-criterion-hash.ts` freshness-hashes QA criteria from source

A gate that breaks on somebody else's patch release is the `1xhc` failure
bought deliberately.

## NOT done here

No rewrite, no pin change. `typescript` stays at 6 and **#910 / #914 stay open
with this measurement as their stated reason**, rather than rotting unexplained
— which is what the ruling's escape clause asks for.

## Done when

- [x] TS 7's actual export surface measured, not inferred from release notes
- [x] Every type guard the two consumers need checked for existence — 0 missing
- [x] The absent primitives named, and the `Project`/`Program` replacement found
- [x] The owner decides: rewrite against `unstable/`, or hold at 6 until the
      API is stable — **it is a risk call about gates, not a feasibility one**.
      **DECIDED 2026-09-27: hold at 6, with the revisit condition recorded.**
      See §"The decision, made" at the end.
- [→] #910 carries a comment pointing here (2026-09-26). **#914 needs none — it
      MERGED on 2026-09-25**, which this bean's plan did not anticipate; see the
      update below

---

## UPDATED 2026-09-26 — #914 merged, and there is a SECOND blocker that is not about `unstable/`

Three things, and the first corrects this bean rather than adding to it.

### 1. `#914` is merged, so *"#910 / #914 stay open"* is no longer true

Merged 2026-09-25T18:06Z by the owner. It bumped
`cat-harness/schemas/block-qa-schema` from `5.9.3` to `7.0.2`, so **main already
carries TypeScript 7 in one package** while the root sits at `^6.0.3`.

Measured before calling it harmless:

| question | answer |
|---|---|
| is it a workspace member? | **no** — the root `package.json` has no `workspaces` key, so its devDependency is resolved independently |
| does it import the TS compiler API? | **no** — no `from "typescript"` anywhere under it |
| how does it use `tsc`? | as a build tool only: `tsup … --dts`, tests under `vitest` |
| does any gate run it? | `code-quality-gates.yml` never names it |

So the split is real but **inert**: it is not the shared-compile inconsistency it
looks like, and it does not touch the `unstable/` problem, which is about code
that `import`s the compiler. The correction that matters is to the *record* —
this bean's plan assumed both PRs would be held, and an agent reading it would
have gone looking for an open `#914`.

### 2. `typescript-eslint` REFUSES to load on TS 7.0 — a second, independent blocker

Not mentioned here, and it is not about `unstable/` at all.
`typescript-eslint@8.70.0` declares

    peerDependencies.typescript:  >=4.8.4 <6.1.0

and it does not warn-and-degrade. Run in an isolated probe — `typescript@7.0.2`
+ `typescript-eslint@8.70.0` + `eslint@9.39.5`, one file,
`recommendedTypeChecked`:

    typescript-eslint does not support TS 7.0.
    Please see …/announcing-typescript-7-0/#running-side-by-side-with-typescript-6.0
    to run typescript-eslint using the TS 6 API.
    See also typescript-eslint#10940 for tracking support for TS >=7.1

    Error: typescript-eslint does not support TS 7.0.   → eslint exit 2

A hard throw at module load, so `bun run cat lint` would not run at all. That is the
*better* failure mode — loud rather than silent — but it means the hold at 6 has
a **second** reason, and unlike the `unstable/` one this reason comes with a
**condition for revisiting**: upstream's own issue tracks TS ≥ 7.1. Two blockers
with different owners should not be carried as one.

Upstream also documents a side-by-side arrangement (typescript-eslint on the TS 6
API), which is a third option this bean's decision list does not offer and which
would let the compiler and the linter disagree about version on purpose.

### 3. What holding at 6 actually costs, since nothing here had priced it

`tsc -p tsconfig.json --noEmit`, both binaries run directly rather than through
`bunx`, same config, same tree:

| | exit | wall | diagnostics |
|---|---|---|---|
| `typescript@6.0.3` (current) | 0 | **31.1 s** | 0 |
| `typescript@7.0.2` (`#910`) | 0 | **6.6 s** | 0 |

**This does NOT contradict this bean's "69 + 38 errors", and the distinction is
the whole point.** Two different questions:

- *can TS 7 typecheck this codebase?* — yes, cleanly, ~4.7× faster. That is what
  `tsc --noEmit` answers.
- *is the compiler API those two scripts import still there?* — no. Re-verified
  independently today: `import("typescript")` under 7.0.2 exposes **2** exports,
  `version` and `versionMajorMinor`, and `createSourceFile`, `forEachChild`,
  `SyntaxKind`, `createProgram` and `ScriptTarget` all read `undefined`. Exactly
  what this bean measured on 2026-09-23.

So the hold is not costing correctness, it is costing ~25 s per typecheck — worth
stating, because a decision framed only as "risk of an unstable API" reads as
having no price on the other side. `schema-graph.ts` (65 `ts.` references) and
`qa-criterion-hash.ts` (37) remain the whole blast radius.

### Still the owner's, and still not an agent's

Unchanged, and now with three options rather than two:

1. rewrite both consumers against `unstable/sync`'s `Project`/`Program`
2. hold at 6 — now until **both** `unstable/` stabilises **and**
   typescript-eslint ships TS 7 support
3. side-by-side: TS 7 for `tsc`, the TS 6 API for typescript-eslint, per
   upstream's own note

No rewrite, no pin change, nothing installed into this repo — both probes ran in
a scratch directory and `git status` was verified clean afterwards.

## A THIRD consumer, found 2026-09-26 — and the bean was right when written

Appended, not corrected: nothing above is wrong. The corpus moved under it.

`u2ol` says two consumers. There are three. `cat-harness/schemas/kind-validator.ts`
carries **8 `ts.` refs** and calls **`ts.createSourceFile` at line 318** — one of the
absent primitives this bean names.

It was not missed. This bean was written **2026-09-23T01:37Z**; that import arrived in
`e8917e7763d` (*rdkm: a graph kind names one node schema per `$schema` family*) at
**2026-09-23T06:39Z**, five hours later.

That cuts one way only: **the cost of the rewrite option grows while the decision sits
open.** A hold is not the static side of this choice.

### The gate exposure, stated narrowly because the wide version was not measured

- **Certain** — `readShape` (line 318) is called directly by `kind-validator.test.ts:194-205`,
  and `bun test` is **gate 1**. This file breaks under TS 7 inside the gate set.
- **Guarded, not shown live** — the only non-test caller is `resolveNodeSchemas` (line 360),
  reached only when a resolved ref carries a `shape`. `check:kind-validators:require-all`
  (gate 80) passes today and no declared ref carrying one was found; the corpus's `"shape"`
  hits are `docs/_data/stickies.json` board stickies. A dead path in today's corpus.

I nearly wrote "a third gate breaks". "Three gates break" and "one gate plus a guarded
path" are different claims and only the second is measured.

### Process note: this was re-derived, and it should not have been

A sibling posted the full measurement on #910 at **05:43Z today** — including two things
this bean lacked (`typescript-eslint` throws a hard `does not support TS 7.0` at module
load; `tsc` itself is 31.1s → 6.6s, so the hold has a price). I re-measured all of it from
scratch before reading that comment, because the bean's last unchecked box — *#910 and #914
carry a comment pointing at this bean* — had just been ticked and the bean did not know.

Same shape as `pesg`. The instrument had the finding; the queue could not see it. Cost here
was ~15 minutes and no wrong artefact, but it is the second time today.

### Still the owner's call

Unchanged: rewrite against `unstable/`, hold at 6, or run side-by-side. This adds one input
(option 1 is three files, not two) and no new option.

---

_Merge note, 2026-09-26T12:45Z._ Both sides of this file appended and neither was
wrong. The one line that had to be chosen is the checklist box: `main` carried
`- [ ] #910 and #914 carry a comment pointing at this bean`, and this branch had
already corrected it to `[→]` on the measurement that **#914 merged on
2026-09-25**, so it needs no comment. The corrected line is kept and the original
dropped — not as a preference, but because the fact under it changed.

The third-consumer section is `main`'s and is left as written. Its argument is the
one that should reach the owner: **the cost of the rewrite option grows while the
decision sits open**, so a hold is not the static side of this choice.


---

## The decision, made — 2026-09-27

**The owner chose: hold at 6, and record the revisit condition.** Asked with the
three options this bean had arrived at, and answered directly. Nothing here is an
agent's reading of a preference.

### Why that option, in the owner's terms

Of the two blockers this bean measured, **only one has a condition for revisiting**,
and that asymmetry is what the decision turns on:

| blocker | condition for revisiting |
|---|---|
| the compiler API lives under `unstable/`, and two of the three consumers run inside `bun run cat gates` on every push | **none** — upstream may change it in a patch release, and nothing says when it stabilises |
| `typescript-eslint@8.70.0` declares `typescript: >=4.8.4 <6.1.0` and **hard-throws at module load** on TS 7.0, so `bun run cat lint` would not run at all | **yes** — upstream's own [typescript-eslint#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940) tracks TS ≥ 7.1 |

So the hold is not indefinite by default: it ends when `typescript-eslint` ships TS 7
support, at which point the `unstable/` question is the only one left and can be asked
on its own.

### What the hold costs, stated because a risk decision reads as free otherwise

**~25 s per typecheck.** `tsc -p tsconfig.json --noEmit`, same config, same tree, both
binaries run directly: **31.1 s on 6.0.3 against 6.6 s on 7.0.2**, both exit 0 with 0
diagnostics. TS 7 typechecks this codebase cleanly and ~4.7× faster. That is a real
price and it is being paid deliberately.

### And the cost of the OTHER option keeps growing

This bean said two consumers; there are **three**. `schemas/kind-validator.ts` arrived
in `e8917e7763d` five hours after this bean was written, carrying 8 `ts.*` refs and a
`ts.createSourceFile` call at line 318 — one of the primitives `unstable/` does not
ship. The rewrite is now **110 `ts.*` references across three files**, and that number
moves in one direction while the decision waits. Recorded so a later reader does not
re-derive the rewrite's cost from the two-consumer figure.

### What was NOT done, and why

**#910 is left OPEN with a comment recording this decision**, rather than closed. Two
reasons: the owner chose the hold and did not ask for the PR to be closed, and this
repository's standing constraint is that an agent never force-pushes or rebases a
dependabot branch — a closure is the same class of unasked-for act on somebody else's
PR. If it should be closed, that is one instruction away.

**No revisit tracker was created.** The condition is recorded here and on #910, which
is where a reader arrives from. Opening a bean to watch an upstream issue is
speculative work-planning, and `check before you create` applies as much to a tracker
as to anything else.

## Summary of Changes

No code changed and no pin moved — the bean's subject was a decision, and it is made.
`typescript` stays at `^6.0.3`. The three measurements that decided it are above: the
two blockers with only one revisit condition between them, the ~25 s per typecheck the
hold costs, and the rewrite's cost growing from two consumers to three.

## "Typechecks cleanly" holds only side-by-side — measured 2026-09-27

Appended, not corrected: the decision above stands, and this strengthens it.

The 31.1 s → 6.6 s, 0-diagnostic row is real, but it describes one arrangement:
the TS 7 **binary** checking a tree whose `node_modules/typescript` is still
**6.0.3**, so every `import ts from "typescript"` resolves to TS 6's types. That
is the side-by-side option, not #910.

With `typescript@7.0.2` actually installed as the dependency (`bun add -d
typescript@7.0.2` in a scratch worktree of `main`, which also writes the
`bun.lock` change Dependabot never makes), the import resolves to TS 7's
`lib/version` types and `bun run typecheck` **fails with 120 errors**:

| file | errors |
|---|---|
| `cat-harness/scripts/schema-graph.ts` | 73 |
| `cat-harness/content/pipeline/qa-criterion-hash.ts` | 38 |
| `cat-harness/schemas/kind-validator.ts` | 9 |

At run time, `kind-validator.test.ts` and `schema-graph.test.ts` fail 16 of 35
with `TypeError: undefined is not an object (evaluating
'ts.ScriptTarget.ESNext')`.

So merging #910 as-is would redden `typecheck` and `bun test` before
typescript-eslint's refusal is even reached. The two questions this bean
separates — *can TS 7 check the code?* and *is the API the code imports still
there?* — are not independent once TS 7 is the installed package: the second
answer makes the first one false. Nothing was installed into this repository;
the scratch worktree was removed.
