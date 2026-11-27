---
name: lean-cache-manager
description: >
  The merge manager's Lean sub-lane: own the Lake cache branch and its addon
  overlays, run direct Lean verification (`lean` against the restored cache,
  plus `#print axioms`) for threads that have no Lean toolchain, watch the
  toolchain and Mathlib pins for drift, and keep the cache warm after every
  merge that touches Lean. Use for "is the cache current", "run lean-direct
  on this", "the restore missed", "bump Lean / Mathlib", "contribute the
  oleans", and whenever a merge request names a `.lean` file.
user_invocable: true
---

# Lean cache manager — a sub-lane of the merge manager

The Lean cache manager is the session that holds the merge-steward lane
([`merge-manager-watcher`](merge-manager-watcher.md)) acting on one more
watched ref: the folio's Lake cache branch. It is a sub-lane, not a second
merge manager. It merges nothing the merge manager would not, and it writes
the cache branch only through the guarded `contribute` verb. The general
pattern it instantiates is
[`compiled-artefact-cache`](../../../skills/process/process-core/compiled-artefact-cache.md).

## What it owns

| Ref | What it is | Who writes it |
|---|---|---|
| The **base cache**: an orphan branch named by the folio's cache-family resolver, of the shape `cat/<org>/<layer>/lake-cache/<family>-<toolchain-tag>` | `.olean` and `.trace` files for the whole package at one toolchain and Mathlib pin | Only `contribute`, after a full build on main, run by this lane |
| **Addon overlays**: `<base>-<addon>` (for example `<base>-mathlib-gap-modules`) | Modules the base lacks: a Mathlib module the pin does not prebuild, a newly added folio module | `contribute --addon`, run by this lane |
| The **pins**: `lean-toolchain`, `lake-manifest.json`, the Mathlib rev | What every cache key is derived from | A PR, through the merge manager like any other |

The branch name is never typed by hand. The folio declares a resolver (for
example a `lake_cache_read_branch` shell function in its cache-family
library); read the name from it, so a renamed family moves every reader at
once. The folio's restore check (for example a restore trace check script)
says whether a restore is usable: branch on its exit code, per
[`compiled-artefact-cache`](../../../skills/process/process-core/compiled-artefact-cache.md)
§"Exit code protocol".

## 1. Direct Lean verification for threads without Lean (on request)

Many sibling sessions have no toolchain, and some write Lean without a
compiler. Their merge request says so. The cache manager verifies for them:

1. Restore the cache for main's pins (base, then overlays). Exit `1` or
   `3`: say so to the requester; do not cold-build the whole of Mathlib in
   a merge sweep.
2. Check out the PR's **exact head SHA** (the one in the merge request; a
   different head is a new request).
3. For each `.lean` file the PR adds or changes, run Lean directly against
   the restored environment, for example
   `lake env lean -DautoImplicit=false -s 65536 <file>`, and record the exit
   code and every error or warning.
4. Run `#print axioms` on each theorem the requester names, and on every new
   top-level theorem. Report the list per theorem. Flag `sorryAx`, any
   `axiom` declaration, `native_decide` and `Lean.ofReduceBool`.
5. Reply to the requester with: head SHA, files, exit codes, axiom lists,
   and the errors verbatim (first 20 lines each). A failure goes back to the
   author with the errors; the cache manager does not fix another session's
   proof.

This is a verification **service**, not a repository gate. The only red
gate before a merge is the KG JSON-LD publication check
(`req:agent-workflow` `never-self-merge`). But the merge manager does not
merge a Lean file that the requester asked to have verified and that failed
verification: it returns it, as any request that its own sender withdrew.

**Axiom census.** A new axiom declaration, or a non-constructive step that
does not rest on the corpus's one shared non-constructive axiom, is reported
to the requester and the owner (`req:content-lifecycle`
`one-nonconstructive-axiom`). It is not merged quietly.

## 2. Keep the cache warm after merges

After a merge that touches `.lean`, `lakefile.*`, `lean-toolchain` or
`lake-manifest.json`:

1. `lake build` on main's new head from the restored cache (only the stale
   cone rebuilds).
2. `contribute` to the base, or to an overlay when the new modules are
   outside the base's package. The contribute guards (non-empty,
   own-package, trace coverage, no-shrink) are never bypassed.
3. Record the new cache head and the main SHA it was built from on the
   cache bean or in the merge manager's sweep note.
4. A module that has no olean in the cache yet (a PR imported it before
   anyone built it) is built and contributed here, once, so the next
   verification of a file that imports it is fast.

Post-merge build failures go to [`merge-manager-watcher`](merge-manager-watcher.md)
§"Red mains and failing runs": dispatch a fixer, fix forward.

## 3. Pin drift

On each merge-manager sweep, compare:

- main's `lean-toolchain` and Mathlib rev against the cache branch's
  recorded inputs (`valid` / `stale-inputs` / `cannot-tell`);
- every open PR that changes a pin against main's pins.

| Reading | Do |
|---|---|
| Cache `stale-inputs` after a pin moved on main | Build and seed the new family branch (seed to `-test`, verify a restore from a clean clone, then publish), and point the resolver at it in its own PR |
| Cache `cannot-tell` | Never a pass. Rebuild the record from a clean restore |
| A PR moves a pin | It is a re-pin PR: the merge manager sequences it alone, not in a train, and the cache is reseeded right after it lands |
| Two open PRs move the same pin differently | Tell both authors; the owner chooses on a card if they cannot converge |
| An upstream release (Lean, Mathlib) is available | Do nothing automatically. Offer it to the owner on a card with what it would cost to move |

## 4. What it watches for the merge manager

Anything merge-related that a Lean change touches: a merge request naming a
`.lean` file, a PR adding a module import, a red Lean job after a merge, a
cache restore that missed in any sibling's report, and a sibling asking
whether a module has an olean yet. Each is answered in the merge manager's
sweep, not in a separate loop.

## Safety (STRICT)

- Never force-push or delete a cache branch. Reseed to a new name.
- Never `contribute` from a partial build, a sparse checkout, or a PR head.
  Only main's head, after the merge.
- No repository secrets are added or used to reach the cache
  (`never-self-merge`). Use the session's own git credentials.
- Never merge. The cache manager is the merge manager's lane: merges follow
  [`merge-manager-watcher`](merge-manager-watcher.md) §"Operating rules
  (owner, 2026-11-27)".

## Related

[`repo-cache-manager`](repo-cache-manager.md) (the same lane for other
caches), [`cache-first-ci`](cache-first-ci.md),
[`compiled-artefact-cache`](../../../skills/process/process-core/compiled-artefact-cache.md),
[`ref-stewardship`](ref-stewardship.md).
