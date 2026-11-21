---
name: compiled-artefact-cache
description: >
  The general pattern for caching expensive compiled artefacts (Lean .oleans,
  FHIR ASTs) across builds. Defines branch-based storage, validity checking,
  exit code protocol, safety guards, and the restore→build→contribute loop.
---

# Compiled Artefact Cache

This skill documents the generalisable pattern for caching compiled artefacts (such as Lean caches and FHIR ASTs). It is the shared contract that specific implementations (e.g. `lean-cache-restore` and `ig-ast-delta`) adhere to.

## The restore→build→contribute loop

The cache is not a maintenance chore but the **output of every authoring session**. Every session should leave the cache warmer than it found it:

```
restore  ──▶  draft / edit  ──▶  build  ──▶  contribute
   ▲                                              │
   └───────── next agent starts here ─────────────┘
```

## Branch-based storage

Artefacts are stored on orphan branches named for their package and toolchain (e.g. `lake-cache/<package>-<toolchain>`). This keeps the repository clean while persisting large derived outputs across builds.

A branch that keeps every seed grows by what each seed's writer changes. Write seeds by [`git-friendly-churn`](git-friendly-churn.md): the same bytes when nothing changed, and a stable path for each file, so a new seed costs deltas, not copies.

## Validity checking (3-valued)

The validity of a cache is not a simple boolean. It relies on the `CompiledInputsSchema` defined in the content core's `schemas/materialization.ts`. Validity is checked BEFORE use via `compiledValidity()` and returns one of three states:

- `valid`: The cache matches the current inputs (e.g. toolchain, source revision, input digest). Restore and build.
- `stale-inputs`: Identifies exactly which input changed. The cache cannot be used as-is; restore for the current toolchain instead, or build cold.
- `cannot-tell`: The cache record lacks required input fields. Never a pass. Build cold or find the missing inputs first.

## Exit code protocol

Scripts managing the cache must adhere to a standard exit code protocol. Branch on these codes rather than grepping the output:

| Code | Meaning | Next |
|---|---|---|
| `0` | present / restored / published | proceed |
| `1` | miss — no such branch | build cold, then `contribute` |
| `2` | usage or environment error | stop the run, read the message, do not fallback to full build |
| `3` | found but **unusable** (corrupt, won't link, wrong toolchain) | repair or reseed |

## Safety guards

When contributing a build back to the cache, it must be safe to run unconditionally. The contribution is refused unless it passes these guards:

- **Non-empty:** There must actually be artefacts to cache.
- **Own-package:** Artefacts must belong to the package itself, not just its dependencies.
- **Trace coverage:** There must be sufficient metadata (e.g. >90% traced) for the build tool to use the cache effectively.
- **No-shrink:** The new result must not be materially smaller than the incumbent cache, preventing partial builds from destroying a fuller cache.

For cold starts, seeding the cache uses a test-branch staging approach: the cache is seeded to a `-test` branch, and a restore is verified from a clean clone before touching production.

## The warm-start principle: Cache the intermediates, not just the output

The core value of the cache is that an expensive step's intermediate outputs survive across builds. The pattern is: a cache branch carries not just the final output but also the **intermediate build artifacts** that prevent the build system from re-deriving them:

| cache type | final output | intermediate artifacts | what they prevent |
|---|---|---|---|
| Lean | `.olean` files | `.trace` files | Lake rebuild + eviction |
| FHIR AST | AST JSON + edges | `txcache/` (tx.fhir.org expansions) | Publisher re-hitting tx.fhir.org for every ValueSet |

`input-cache/txcache/` goes on the `fhir-ast` branch alongside the AST files.

Preserving these intermediates is what makes subsequent incremental builds (such as those in `ig-incremental-build.bpmn`) fast: a warm build with cached packages and terminology runs several times faster than a cold one.

## Instantiations

| Aspect | Lean Cache (`lean-cache-restore`) | FHIR AST (`ig-ast-delta`) |
|---|---|---|
| Artefacts | `.olean` files, `.trace` files | Per-resource AST JSON, `dependencies.json`, `txcache/` |
| Inputs Schema | `CompiledInputsSchema` | `CompiledInputsSchema` |
| Key Inputs | `toolchain` (Lean version), `sourceRevision` | `toolchain` (Publisher version), `sourceRevision`, `inputDigest` |
| Storage Branch | `lake-cache/<package>-<toolchain>` | `fhir-ast/<ig-package-id>` |
| Service Script | `lake-cache.sh` (9 verbs) | `ig-cache.sh` (7 verbs) |
| Refreshed by | an agent's `lake-cache.sh contribute` | a reusable workflow of the IG layer, on a runner (the Publisher needs Java and a 10 GB heap), which each IG repository dispatches; a site build refuses an AST that is not valid |
| Cone Engine | Lake's `.trace`-based dependency graph | SUSHI's `fsh-index.json` (forward: file → resource) + `fsh-cone.ts` (reverse: who uses this file) + `AstPlanCli` |
| Incremental | `lake build` (only stale modules) | `IncrementalBuildCli` (cone rebuild loop) |

## The file-to-resource mapping comes from the toolchain, not from us

**Do not reimplement what the compiler already knows.** SUSHI already writes
`fsh-generated/data/fsh-index.json` on every run — the authoritative mapping
from source `.fsh` file to output FHIR resource, with source locations. The AST
exporter copies it into the AST directory; the incremental planner reads it
there. No modification to SUSHI is needed.

`fsh-cone` (a Tool node, declared by the FHIR IG layer) provides the **reverse**
half — who depends on a file — so a changed RuleSet- or Alias-only file (which
produces no resource itself) can be traced to the resources it affects. These two
maps together give the planner a complete cone. Without `fsh-index.json` the
planner can only plan a full build; with it, a single-file change rebuilds only
the resources in its cone, which is a small fraction of an IG.
