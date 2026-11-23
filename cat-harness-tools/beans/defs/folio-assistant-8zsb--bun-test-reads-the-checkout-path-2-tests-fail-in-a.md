---
# folio-assistant-8zsb
$schema: bean/1.0.0
title: 'bun test reads the CHECKOUT PATH: 2 tests fail in any worktree not named folio-assistant'
status: completed
type: task
priority: normal
created_at: 2026-09-30T17:53:09Z
updated_at: 2026-09-30T19:49:03Z
parent: folio-assistant-1xhc
---

## What was measured

`bun test` on `origin/main` `da684477383`, run four times, varying **only the
directory the checkout sits in**. Same commit, same `node_modules`, same
command.

| checkout path | basename | parent | result |
|---|---|---|---|
| `/home/user/folio-assistant` | `folio-assistant` | `/home/user` | pass |
| `/tmp/probe-main/folio-assistant` | `folio-assistant` | `/tmp/probe-main` | **28 pass, 0 fail** |
| `/tmp/wt-main-probe` | `wt-main-probe` | `/tmp` | **2 fail** |
| `/tmp/wt-ymsu` | `wt-ymsu` | `/tmp` | **2 fail** |

Two failures, and they are **two different mechanisms**. Conflating them
would hide one.

## Mechanism 1 — the BASENAME is asserted

`cat-harness/scripts/tests/navbar-consistency.test.ts:208`

```ts
const names = instanceRootsIn(REPO).map((p) => p.split("/").pop());
expect(names).toContain("folio-assistant"); // the root declares
```

`instanceRootsIn` returns **paths**; `.pop()` turns the repository root into
whatever its directory happens to be called. The literal it is compared
against is the instance's **declared id**. Those are equal only by the
convention that you clone into a directory named after the repo.

Received in `/tmp/wt-main-probe`:

```
[ "wt-main-probe", "agent-skills", "bootstrap", "bootstrap-tools", ... ]
```

Every other entry is a real declared instance. The first is a directory name.
The assertion is testing `basename(REPO)`, which is a fact about the
**operator's filesystem**, not about the corpus.

## Mechanism 2 — the PARENT is scanned, and `/tmp` is full of fixtures

`cat-harness/scripts/tests/voice-skills.test.ts:145` →
`readVoicesGraph` → `directoriesForGraph` → `resolveDirectories` →
`readDeclaration`:

```
error: /tmp/folio-dir-bad-01bGPz/folio-dir-bad-01bGPz.json is not valid JSON:
       JSON Parse error: Expected '}'
  at readDeclaration (cat-harness/schemas/cat-harness.ts:3419)
```

`/tmp/folio-dir-bad-01bGPz/folio-dir-bad-01bGPz.json` contains, in full:

```
{ not json at all
```

It is a **deliberate fixture**, built by a test that wants to prove a bad
declaration is reported rather than swallowed — and it is **never cleaned
up**. There are **163** of them in this container, the oldest dated Sep 23.

Alone that is litter. It becomes a failure because a checkout placed directly
in `/tmp` makes `/tmp` the repository's parent, so the resolver walks into the
litter and hits a file that is invalid **on purpose**. The controlled pair is
rows 2 and 3 of the table: same `/tmp`-adjacent placement, parent
`/tmp/probe-main` (empty) passes, parent `/tmp` (163 fixtures) fails.

## Why this is not a curiosity

**The standard agent worktree is `.claude/worktrees/agent-<hash>`.** Its
basename is never `folio-assistant`. So mechanism 1 fires for **every agent
that runs `bun test` in the worktree this repository tells it to use** — two
red tests that have nothing to do with the change under test.

That is `ymsu` symptom (2) — *a gate that fails for something that is not its
subject* — arriving from a direction `ymsu` did not cover: not a gate writing
into its own subject, but a gate **reading its operator's filesystem layout**
as if it were corpus.

## What it cost, measured

One full `bun run cat gates` run on #1616 (~25 min) reported `✗ 1 of 189 failed`
for these two tests. The branch was clean. The gate set was measuring the
worktree's name.

## Done when

- [x] `navbar-consistency.test.ts:208` asserts against the **declared** id,
      not `basename(REPO)` — or the test is retired if the property it wants
      is already covered by the denominator test beside it
- [x] the `folio-dir-bad-*` fixture cleans up after itself (`afterEach`/
      `rmSync`), so a crashed run leaves at most one
- [x] decide — separately, and **not** in the same change — whether
      `resolveDirectories` walking the checkout's **parent** is intended.
      It may well be; that is what finds sibling instances. If it is, the fix
      is entirely in the fixture, and this box closes with that reasoning
      written down rather than with a code change.
- [x] the 163 leftovers in this container are **not** deleted by an agent on
      its own initiative (`deletion-requires-confirmation`); they are `/tmp`
      scratch in an ephemeral container and will go with it.

## Not established

Whether any test **other** than these two reads the checkout path. The
measurement above is a whole-suite run, so the count 2 is the suite's answer
under one wrong name — it is **not** a proof that no third test would fail
under a different one.


## This is the first FILING, not the first sighting — and that is the point

Recorded 2026-09-30, after #1616 merged.

**#1616's own PR body already diagnosed mechanism 1, correctly and in full**,
three hours before this bean existed:

> The one `bun test` failure present in both runs is `instanceRootsIn includes
> the repository root`, which asserts the checkout directory is named
> `folio-assistant`. This worktree is named `agent-a8366c7084ef9fa2b`, and the
> assertion's own received list contains that string. A checkout-name artefact,
> not this change; CI checks out into a correctly named directory.

Every element is there: the test, the mechanism, the worktree name, the
received list as evidence, and the reason CI cannot see it. The agent that
wrote `ymsu`'s fix found `ymsu`'s sibling while measuring it, wrote it down
accurately — **and it went nowhere**, because the place it was written down
was a PR body.

Then a second session (this one) hit the identical failure on the identical
branch, spent a 25-minute gate run and four controlled re-runs re-deriving it
from scratch, and filed it. **The finding was not lost because it was
unclear. It was lost because a PR body is a record of a change, not a record
of a corpus fact** — nothing scans it, no epic holds it, and the next agent to
run gates in a worktree does not read it.

That is `1xhc` about the corpus rather than about CI: a finding that does not
fire where the next agent will look is indistinguishable from one nobody made.
It is also exactly what `surprise-to-corpus` is for, pointed at a surprise
that HAD already been noticed.

**No blame attaches to #1616 for it.** Its brief was `ymsu`'s fix, it correctly
ruled the failure out of its own scope, and saying so in the PR body is what
a careful agent does. The gap is that ruling something out of scope has no
destination — "not this change" names where it does not belong and nowhere
that it does. Whether that warrants a convention is a question for the owner,
recorded here unanswered rather than decided.

_2026-09-30T19:00:17Z_ — Claimed by claude/magical-archimedes-4qkfxp-8zsb — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

## Progress — 2026-09-30, branch `claude/magical-archimedes-4qkfxp-8zsb`

- **Box 1:** the test now asserts that the repository root is in `instanceRootsIn(REPO)` **as a path**, and applies the not-an-instance check only to the other entries' basenames. Measured in `/home/user/wt-8zsb`, a checkout not named `folio-assistant`: 15 of 15 tests pass, where before it was 14 pass and 1 fail.
- **Box 2:** every root that `folio-dir.test.ts` makes, not just the malformed one, is recorded and removed in `afterEach`. Before and after a run, `/tmp/folio-dir-*` held 1,390 entries both times, so a run adds none.
- **Box 4:** nothing was deleted. The container now holds 1,390 leftovers, not 163. They are ephemeral scratch and will go with the container.

### Box 3 stays open, with this finding rather than a decision

The code's own documentation leans towards **"the climb is not intended for the root instance"**:

- `siblingScopeFor`'s docblock says `repoRootFor` "climbs out of the checkout" for the root instance, and exists so that sibling lookup does not.
- `resolveCoveragePath`'s docblock says the same thing ("going up one lands outside the checkout entirely").
- `rootForScope` (`scope: "repository"` → `repoRootFor`) and `declaredKindsEntryRoot` still compose `repoRootFor` unconditionally. For the root instance, whose instance root IS the repository, that lands in the parent directory, which is `/tmp` for a checkout placed directly in `/tmp`.

**Not established:** which of these produced the voice-skills stack (`readVoicesGraph` → `directoriesForGraph` → `resolveDirectories` → `readDeclaration`). A fix is a resolver change touching every declared `scope: "repository"` path, so per this bean it is a separate change, and it needs that call identified first.

## Box 3 answered — 2026-09-30, branch `claude/magical-archimedes-4qkfxp-8zsb-2`

**Which call climbed:** the test, not a production path. `voice-skills.test.ts:151` calls `readVoicesGraph([REPO])` WITHOUT the repository root **on purpose**, to pin the documented pitfall. That pitfall is that `repoRootFor(REPO)` is `dirname(REPO)`, so the reader scans the checkout's parent. The test asserted the result was `null`, and that is true only while the parent holds no instances. In `/tmp` the walk reached `/tmp/folio-dir-bad-*` and threw. Reproduced from a checkout at `/tmp/wt-probe8`, with this stack:
`readVoicesGraph` (voices-graph.ts:276, `instanceRootsIn(repoRootFor(REPO))`) → `directoriesForGraph` → `resolveDirectories` → `readDeclaration`.

**Is the climb intended?** No, not for the root instance. It is the pitfall that `siblingScopeFor`, `resolveCoveragePath` and `readVoicesGraph`'s own `repoRootIn` parameter each exist to avoid. The production callers pass the root explicitly. **No resolver change is made.** `rootForScope` and `declaredKindsEntryRoot` still compose `repoRootFor`, but no failure has been traced to them, so changing them would be speculative.

**The change:** the test now asserts the DERIVATION (`repoRootFor(REPO) === dirname(REPO)`), which does not depend on what the parent holds, instead of what the wrong root happens to find. Falsified: from a checkout at `/tmp/wt-probe9`, `voice-skills.test.ts` went from 1 fail to 13 pass. It also passes 13 of 13 from `/home/user/wt-8zsb`.


## Box 3 moved to `68k7` — owner ruled 2026-09-30

Box 3 above (*is the parent climb intended?*) stays **unchecked on purpose**,
and the owner's ruling is **leave it open until the call site is named**.

It is tracked in **`68k7`** from now on, because this bean is `completed` and a
completed bean's unchecked box is not reachable by `beans list`. That is this
bean's own lesson — a finding needs somewhere to live that nobody has to
already know about — applied to the bean that taught it.

`68k7` carries what was established (`siblingScopeFor` and
`resolveCoveragePath` both document the climb as NOT intended for the root
instance, while `rootForScope` and `declaredKindsEntryRoot` still compose
`repoRootFor` unconditionally) and what blocks a fix (which call on the
`readVoicesGraph → directoriesForGraph → resolveDirectories → readDeclaration`
stack actually climbs — not yet measured).

Boxes 1, 2 and 4 landed in #1668 and are unaffected.
