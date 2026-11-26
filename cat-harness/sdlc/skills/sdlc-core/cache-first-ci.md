---
name: cache-first-ci
description: >
  Every CI step is a pure function of its inputs: derive the inputs, hash them
  into a key, restore on a hit, run and save on a miss. Read before adding a
  cache to a workflow, before writing a cache key, before trusting a restored
  output or a skipped verdict, and before pushing a change that moves a cached
  step's key. Covers the one primitive (`cached-step` + `cache:key`), the trust
  classes, what a committer publishes, the 10 GB budget, and the hit-rate report.
adapters: [document, paper, dak]
profiles: [document, paper]
---

# Cache-first CI — a step is a pure function of its inputs

**The principle.** Derive a step's inputs, hash them into a key. On a hit,
restore the output (or the verdict) and skip the step. On a miss, run the
step, then save. The full set still runs on main's integration run, nightly
and on every release candidate (release-gated CI, owner card Q-CIB-4 A,
2026-11-08), and that is what catches a key that missed an input.

## One primitive, not one cache per author

A checkout's CI has ONE cache primitive. In folio-assistant it is the composite
action `.github/actions/cached-step` (its README is the operational detail).
A new cache goes through it, and an old bespoke one is ported onto it by its
owner. Then every cache has the same key shape (`cs1-<step>-<key>`), the same
trust policy, the same `hit | warm | miss — why` line in the job summary, and
a row in the daily hit-rate report. A cache that bypasses it is one nobody can
audit.

## The key is DERIVED, never hand-declared

Owner ruling, work item `4rbc`: *"derived is BEST"*; *"DERIVED = no drift, no extra
data fields"*. A key comes from one of these:

- `bun run cat cache:key <script>` (cat-harness-tools `scripts/cache-key.ts`).
  This is the `f017` fingerprint of the script: its import closure, audited for
  every environment, network, clock and git read (`input-sites.ts`); the tool
  versions; `bun.lock`; and its `task-io` declaration, where `{tracked}` means
  the whole tree.
- A lock's digest, when the lock pins every input. `index.lock.json` pins every
  mounted tree. `cache:key --hash-files` prints what the runner's
  `hashFiles()` prints.
- A digest script that hashes the tree and the exact tool versions
  (`bundle-cache.sh digest`).

**Never narrow a key by hand to get more hits.** A hand-picked list of input
globs is a claim nothing checks. When the key does not hit often enough, the
fix is to derive the inputs more finely (the cone, `ci-cone.ts`). Hand-listing
is not the fix.

**Could-not-determine is never a hit.** An undetermined key runs the step and
saves nothing.

## The trust classes (owner, 2026-11-05)

Committers, both people and agents, produce cache entries locally where CI can
verify them cheaply, so CI only verifies.

| class | what | who produces it | how CI accepts it |
|---|---|---|---|
| **(a) exactly verifiable** (`trust: exact`) | `verify` checks the output against a reference derived from THIS tree — the mounts and the layers ref against the lock's digests — so a bad entry is only a miss | main, a PR into its own scope, **or a committer** with `cache:publish` (never consumed on main) | a hit only after `verify` passes; a prefix restore is a warm start, never a hit |
| **(a′) verifiable with provenance** (`trust: exact` + a source rule) | a bundle checked only against the manifest it carries, from a deterministic producer | main, or a run whose head is this head, a parent, or a commit with this tree | the manifest check AND the source rule; never from a committer |
| **(b) verdicts** (`trust: verdict`) | "this gate passed on these inputs" | CI (main, or a PR into its own scope); a committer's local gate record goes through #2957/#2958 | exact key only; reported **SKIPPED, not passed**, naming the run that recorded it; committers' records are re-verified deferred or sampled |
| **(c) everything else** (`trust: main-only`) | outputs neither checkable nor deterministic | main only | exact key only |

The Actions cache scopes an entry by ref. A PR's save is readable only by
that PR's own runs, so a PR cannot poison what main or another PR reads.
`pull_request_target` never saves.

**A manifest the entry carries proves it intact, not built from these
inputs**: a poisoner ships a matching manifest. That is why (a′) needs a
source rule, and why only (a) is safe to take from anyone. A producer the
determinism audit (`determinism-audit.sh`: build twice in one tree, diff the
bytes) has not cleared cannot hit across commits at all.

**A private cache scheme is held.** A pull request that adds a cache outside
the primitive is held and returned to its author with a pointer here, the
same rule the merge manager applies.

## What a committer runs before pushing

For each class-(a) step that the change moves the key of, run:

```
bun run cat cache:publish <step>
```

This builds nothing. It publishes what you already built to
`refs/cache/cs1-<step>-<key>`.

**The mounts have their own committer path**, the layers ref
(`refs/cat/layers/<key>`; `bun run cat layers:publish`, which `mount:remote`
runs after it changes the lock). Its replayer verifies each layer against the
lock and serves every layer that did not move, which is finer than a single
all-or-nothing hit. So it is declared as a cache node and is not wrapped in
`cached-step`. One committer path per cache.

## The budget

GitHub keeps **10 GB of Actions cache per repository**. It evicts the
least-recently-used entries beyond that, and any entry left unread for 7 days.

- **Big bundles** go to GHCR or to git refs, never to the Actions cache. The
  prepared image, the QA working copy and the publish-time pages are all big
  bundles, and any one of them can evict every small entry.
- **Small outputs and verdicts** go to the Actions cache, namespaced by step.
- **Pruning** deletes only what no run can read any more: entries scoped to a
  closed PR's merge ref.

## The hit-rate report

Every restore writes `hit | warm | miss` and why to the job summary. The daily
report (folio-assistant `cache-report.sh`, run from `sweeps.yml`) gives the hit
rate per step, the cache usage and the size of each namespace. When you claim
a speed-up, report the hit rate and runner-minutes before and after, with run
ids. A claim without run ids is a guess.

## Related

- [`prepare-merge`](prepare-merge.md): the local checks before a push include
  the `cache:publish` above.
- [`ci-health`](../../../skills/process/process-core/ci-health.md): a cached SKIPPED is not a pass. Read verdicts
  as that skill says.
- [`platform-gates`](../../../skills/process/process-core/platform-gates.md): which gates run where.
