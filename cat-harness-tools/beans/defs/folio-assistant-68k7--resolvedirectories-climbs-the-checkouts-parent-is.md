---
# folio-assistant-68k7
$schema: bean/1.0.0
title: 'resolveDirectories climbs the checkout''s PARENT: is that intended for the ROOT instance?'
status: completed
type: task
priority: normal
created_at: 2026-09-30T19:48:10Z
updated_at: 2026-10-22T16:45:00Z
parent: folio-assistant-1xhc
---

**Owner ruling, 2026-09-30: leave open until the call site is named.**

## Why this is its own bean

It was Box 3 of `8zsb`, and **`8zsb` is `completed`**. A completed bean's
unchecked box is not reachable by `beans list`, so the question was on its way
to being invisible — which is `8zsb`'s own lesson (*a finding needs somewhere
to live that nobody has to already know about*) turned on the bean that taught
it. Two sessions have now declined to guess at this, and declining is only
useful if the next one can find the question.

`8zsb` itself is finished and stays that way: its two fixes landed in #1668,
measured on `main` `61810002758` in a checkout named `wrong-name-probe` —
22 pass, 0 fail, `/tmp/folio-dir-*` delta 0.

## The question

`resolveDirectories` walks the checkout's **parent** looking for sibling
instances. For the ROOT instance — whose instance root IS the repository —
that lands **outside the checkout**. A checkout placed directly in `/tmp`
therefore treats every sibling directory in `/tmp` as a candidate instance,
which is how 163 deliberately-malformed test fixtures took down two unrelated
tests.

The leak is fixed (#1668). This is the separate question the leak exposed, and
it would still be a question with `/tmp` spotless.

## What the code says about itself

The docblocks lean toward **not intended for the root instance**:

- `siblingScopeFor` — `repoRootFor` *"climbs out of the checkout"* for the root
  instance, and this helper exists **so sibling lookup does not**
- `resolveCoveragePath` — the same, *"going up one lands outside the checkout
  entirely"*

But two callers still compose `repoRootFor` **unconditionally**:

- `rootForScope` (`scope: "repository"` → `repoRootFor`)
- `declaredKindsEntryRoot`

So the intent is written down twice and not enforced in either of those.

## NOT established — and this is the blocker

**Which call produced the failing stack.** Observed:

```
readVoicesGraph → directoriesForGraph → resolveDirectories → readDeclaration
```

Neither of the two unconditional callers above has been shown to be the one on
that path. Until that is measured, a fix is a change to every declared
`scope: "repository"` resolution with no evidence about which one is wrong —
larger than it looks, and aimed by guess.

## Done when

- [x] the call on the `readVoicesGraph` stack that climbs to the parent is
      NAMED, with the measurement that identifies it: `resolveDirectories` line 4801
      calls `rootForScope(link.root, dir.scope)`, which previously called `repoRootFor`
      unconditionally on repository-scoped entries.
- [x] only then: whether the climb is intended for the root instance is
      answered: NOT intended. `g43f` fixed it: `rootForScope` calls `checkoutRootFor(instanceRoot)`
      instead of `repoRootFor(instanceRoot)` so `scope: "repository"` paths on the root
      instance stay within the checkout.
- [x] whichever way it goes, a case that would have caught this is added:
      pinned in `cat-harness-tools/schemas/instance-roots-worktrees.test.ts`:
      `rootForScope: a scope: "repository" path on the root instance resolves inside it`

## Closed 2026-10-09

- **Root Cause Identified**: In `resolveDirectories` (`cat-harness/schemas/cat-harness.ts:4801`), directory path resolution computed `absPath: resolve(rootForScope(link.root, dir.scope), dir.path)`. `rootForScope` previously called `repoRootFor(instanceRoot)`, which climbs out to `dirname(instanceRoot)` when the instance root is already at the repository root.
- **Resolution**: Under bean `g43f`, `rootForScope` was updated to use `checkoutRootFor(instanceRoot)`:
  ```ts
  export function rootForScope(instanceRoot: string, scope?: DeclarationScope): string {
    return scope === "repository" ? checkoutRootFor(instanceRoot) : instanceRoot;
  }
  ```
  `declaredKindsEntryRoot` similarly resolves through `rootForScope`, ensuring that repository-scoped paths on root instances never escape to the checkout parent directory.
- **Verification**:
  - `bun test ./cat-harness-tools/schemas/instance-roots-worktrees.test.ts` passed (18 pass, 0 fail).
  - Explicit test: `rootForScope: a \`scope: "repository"\` path on the root instance resolves inside it` verifies that for both root worktree instances and nested instances, repository scope resolves to the checkout root, not the parent.

## Summary of Changes

Done by drain lane B on the owner's ruling (never outside the checkout): cat-harness#136.

## From this store's earlier copy (store reconciliation, 2026-10-22)

*2026-10-22T16:33:47Z* — Owner ruling 2026-10-16, item 9 (session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr): the copy in litlfred/folio-assistant (`cat/cat-harness/beans`) is this bean's record, its status included, because its notes carry the later evidence. The sections below were only in this store's copy and are kept as history, with their headings demoted one level. Where one contradicts the status above, the status above is the later evidence.

### Explicitly out of scope

Re-litigating `8zsb`'s two fixes. They landed and are verified.

### Owner ruling 2026-10-11 (relayed by lane A)

Never look outside the checkout. Sibling lookup for the ROOT instance stops at the checkout root, and the two callers that compose `repoRootFor` unconditionally are fixed to honour that.



## Owner ruling 2026-10-11 (relayed by lane A)

Never look outside the checkout. Sibling lookup for the ROOT instance stops at the checkout root, and the two callers that compose `repoRootFor` unconditionally are fixed to honour that.

## Summary of Changes

- cat-harness#136 (merged): `siblingScopeFor` now returns the instance itself when it is its own checkout (`isForeignCheckout`: its own `.git`, not a declared submodule), instead of `dirname`. Tests cover the `/tmp` case and the submodule case.
- The two callers this bean named, `rootForScope("repository")` and `declaredKindsEntryRoot`, already went through `checkoutRootFor` since g43f. Verified, no change needed.

## Merged from the folio-assistant copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

````text
## Closed 2026-10-09

- **Root Cause Identified**: In `resolveDirectories` (`cat-harness/schemas/cat-harness.ts:4801`), directory path resolution computed `absPath: resolve(rootForScope(link.root, dir.scope), dir.path)`. `rootForScope` previously called `repoRootFor(instanceRoot)`, which climbs out to `dirname(instanceRoot)` when the instance root is already at the repository root.
- **Resolution**: Under bean `g43f`, `rootForScope` was updated to use `checkoutRootFor(instanceRoot)`:
  ```ts
  export function rootForScope(instanceRoot: string, scope?: DeclarationScope): string {
    return scope === "repository" ? checkoutRootFor(instanceRoot) : instanceRoot;
  }
  ```
  `declaredKindsEntryRoot` similarly resolves through `rootForScope`, ensuring that repository-scoped paths on root instances never escape to the checkout parent directory.
- **Verification**:
  - `bun test ./cat-harness-tools/schemas/instance-roots-worktrees.test.ts` passed (18 pass, 0 fail).
  - Explicit test: `rootForScope: a \`scope: "repository"\` path on the root instance resolves inside it` verifies that for both root worktree instances and nested instances, repository scope resolves to the checkout root, not the parent.

## Summary of Changes

Done by drain lane B on the owner's ruling (never outside the checkout): cat-harness#136.

## From the cat-harness-tools store copy (reverse reconciliation, 2026-10-22)

_These sections existed only in the cat-harness-tools copy and are carried here under owner ruling 2026-10-16 item 9, which keeps notes that only one copy has. They are historical and do not change this bean's status. The forward direction is litlfred/cat-harness-tools#558. Session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6._

### Explicitly out of scope
````
