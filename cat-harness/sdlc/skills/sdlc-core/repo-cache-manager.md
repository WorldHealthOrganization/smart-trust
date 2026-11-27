---
name: repo-cache-manager
description: >
  The merge manager's sub-lane for every repository cache other than Lean:
  LaTeX/PDF build caches, FHIR AST branches, generated-artefact and render
  caches, CI step caches. Says what it owns, how it finds each cache, when it
  refreshes one after a merge, how it reads drift in a cache's inputs, and
  what it watches for the merge manager. Use for "the PDF cache is stale",
  "the build restored nothing", "who refreshes this cache", and when adding a
  new cache to a folio.
user_invocable: true
---

# Repository cache manager — the other caches, one lane

The repository cache manager is the merge manager acting on each cache a
folio declares, the way [`lean-cache-manager`](lean-cache-manager.md) acts on
the Lake cache. One session, the merge manager, holds all of these lanes, so
a cache refresh is sequenced with the merge that made it stale. The pattern
each cache follows is
[`compiled-artefact-cache`](../../../skills/process/process-core/compiled-artefact-cache.md)
(branch storage, three-valued validity, the exit codes, the contribute
guards). CI step caches follow [`cache-first-ci`](cache-first-ci.md).

## Find the caches; never assume them

A cache exists if the folio declares it: a directory's `storage` in
`cat-harness.json`, a cache-family resolver script, or a `cached-step` key.
List them at the start of the lane and on any PR that changes a declaration.
A cache found only by its branch name is reported as undeclared, not used.

| Kind | Typical storage | Refreshed after | Inputs that key it |
|---|---|---|---|
| LaTeX / PDF build | a branch or Actions cache holding `.aux`, `.bbl`, `.toc`, figures and the last PDF | a merge that touches `.tex`, `.bib`, figures, the class or the build script | engine version, class and package versions, source revision |
| FHIR AST | `fhir-ast/<ig-package-id>` | an IG source merge | Publisher version, source revision, input digest |
| Generated artefacts (JSON-LD, indexes, renders) | the generator's own output, or a cache branch | the `post-merge-regen` run | generator version, inputs |
| CI step caches | the `cached-step` primitive | never by hand | the derived key |

## On each merge-manager sweep

1. **After a merge** that touches a cache's inputs, refresh that cache from
   main's new head with the cache's own `contribute` verb (guards on). Note
   the cache head and the main SHA in the sweep note.
2. **Drift**: for each declared cache, read its validity against main.
   `stale-inputs` means refresh or reseed; `cannot-tell` is never a pass.
3. **A sibling reports a miss** (a restore that found nothing, or a build
   that ran cold): reproduce from a clean clone. A real miss is refreshed
   here. A key that missed an input is a bug in the key: open a PR to the
   key, per [`cache-first-ci`](cache-first-ci.md) §"The key is DERIVED".
4. **Budget**: when a cache store nears its budget, evict by the cache's
   own policy, never by deleting a branch that a resolver still names.

## Pre-merge versus post-merge

Caches never gate a merge. The only red pre-merge gate is the KG JSON-LD
publication check (`req:agent-workflow` `never-self-merge`). A PDF that will
not build, a stale render, or a cold cache found after a merge is fixed
forward: the merge manager dispatches a fixer
([`merge-manager-watcher`](merge-manager-watcher.md) §"Red mains and failing
runs").

## Safety (STRICT)

- Never force-push or delete a cache branch; reseed under a new name and
  move the resolver in a PR.
- Contribute only from main's head after a merge, never from a PR head.
- No repository secrets are added or used for any cache.
- Never merge; merges follow [`merge-manager-watcher`](merge-manager-watcher.md).

## Adding a new cache

A new cache is a PR that declares it (storage, resolver, keyed inputs, the
contribute guards) and adds a row to the table above. Until it is declared,
nobody restores from it.
