---
name: npm-kg-distribution
description: >
  Package, release, distribute, and retrieve Knowledge Graphs using npm tooling
  and tarballs: declare `package.json` as an authored pre-packaging asset in the
  Knowledge Graph, build `.tgz` packages via `bun pm pack`, record publications as
  `folio-binary-release/v1` state documents hosted on GitHub binary releases,
  and retrieve remote Knowledge Graphs using `npm install` for both unhydrated
  source graph and hydrated materialized graph views.
adapters: [document, paper, dak]
profiles: [document, paper]
---

# NPM Knowledge Graph Distribution

Knowledge Graphs in the folio ecosystem can be distributed and consumed as
**npm packages** — packaged tarballs (`.tgz`) containing either the authored
source graphs, pre-compiled hydrated graph views, or both.

| | where |
|---|---|
| the packaging tool | `pack-tarball` (`bun run cat-harness-tools/scripts/pack-tarball.ts`) |
| the retrieval tool | `kg-retrieve-npm` (`bun run cat-harness-tools/scripts/kg-retrieve-npm.ts`) |
| the release schema | `schemas/sdlc/binary-release.ts` (`folio-binary-release/v1`) |
| asset verification | `cat-harness-tools/scripts/check-declared-assets.ts` |
| related skills | [`remote-mount`](remote-mount.md), [`kg-export`](kg-export.md), `package-release` (opt-in `cat-harness.sdlc`), [`kg-subscription`](../../../library/skills/large-datasets/kg-subscription.md) |

---

## 1. `package.json` as an authored pre-packaging asset in the KG

A file that is not declared in `<instance>.json` is a file no check verifies,
so `package.json` is declared as an **authored Knowledge Graph asset**
that defines package identity, exports, dependencies, scripts, and the tarball
inclusion whitelist (`files` array).

Each layer that publishes an npm package declares `package.json` under `assets`
in its `<instance>.json`:

```json
{
  "id": "npm-manifest",
  "src": "package.json",
  "role": "package-manifest",
  "title": "package.json",
  "description": "The npm pre-packaging source manifest declaring package identity, exports, dependencies, scripts, and tarball whitelist."
}
```

### Why declare it under `assets`

- **Verification at commit and mount time**: `check:declared-assets` verifies
  that every declared asset exists on disk.
- **Remote mount resolution**: `remote-mount.ts` and `mount-from-lock.ts` check out,
  lay down, and verify declared layer assets so that mounted dependencies carry
  their package identity.
- **Single source of packaging truth**: `package.json`'s `files` field acts as the
  authoritative whitelist for what is bundled into the distribution tarball.

---

## 2. Packaging via `bun pm pack` & `folio-binary-release/v1`

An npm package is built as a compressed tarball (`.tgz`) using `bun pm pack`:

```sh
bun run cat-harness-tools/scripts/pack-tarball.ts --root <instance-root> --destination <out-dir>
```

The packaging process:
1. Reads the authored `package.json` to verify package identity (`name` and `version`).
2. Invokes `bun pm pack --destination <dir>`, which respects `.npmignore` and the
   `files` array in `package.json`.
3. Computes the exact file size in bytes and the SHA-256 digest of the `.tgz` tarball.
4. Generates and validates a `folio-binary-release/v1` state node recording the release event.

### The `folio-binary-release/v1` state node

A published tarball is represented in the Knowledge Graph as a `folio-binary-release/v1`
document (`schemas/sdlc/binary-release.ts`). A release record captures the **publication event**,
never the binary payload itself:

```json
{
  "$schema": "folio-binary-release/v1",
  "release": {
    "id": "cat-harness-v1.0.0",
    "version": "1.0.0",
    "tag": "v1.0.0",
    "publishedAt": "2026-10-08T18:30:00.000Z",
    "url": "https://github.com/litlfred/cat-harness/releases/tag/v1.0.0"
  },
  "origin": {
    "kind": "github-release",
    "repository": "litlfred/cat-harness"
  },
  "assets": [
    {
      "name": "cat-harness-1.0.0.tgz",
      "bytes": 524288,
      "digest": {
        "algorithm": "sha256",
        "digest": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "verifiedAt": "2026-10-08T18:30:00.000Z"
      },
      "fetchedFrom": "https://github.com/litlfred/cat-harness/releases/download/v1.0.0/cat-harness-1.0.0.tgz",
      "contentType": "application/gzip",
      "disposition": "published"
    }
  ]
}
```

Key invariants:
- **Never the bytes**: The schema is `.strict()`. Content and blobs are rejected.
- **Verifiable fixity**: SHA-256 digests and byte counts are required.
- **Provenance**: `fetchedFrom` must state where the binary can be retrieved.
- **Dispositions**: An asset's state after publication is tracked (`published`,
  `superseded`, `deleted-before-deploy`). Any deliberate removal must provide a
  `dispositionReason`.

---

## 3. GitHub binary releases hosting `.tgz` tarballs

Published Knowledge Graph tarballs are hosted on **GitHub Releases**:
- The git tag (`v<version>`) marks the exact source commit in the repository.
- The `.tgz` package is uploaded as a release asset attached to the GitHub release.
- The release URL follows the canonical scheme:
  `https://github.com/<owner>/<repo>/releases/download/v<version>/<package>-<version>.tgz`

This provides:
- High availability via CDN.
- Immutability tied to the release tag.
- Checkable fixity against the `folio-binary-release/v1` document.

---

## 4. `npm install` as an alternative retrieval Tool for remote KGs

Remote Knowledge Graphs can be retrieved into a workspace or consumer environment
through three distinct mechanisms, each serving a specific architectural need:

| tool / mechanism | transport | granularity | best when |
|---|---|---|---|
| **`remote-mount`** | Git shallow blobless fetch at 40-char SHA | Transitive dependency closure of declared directories | Developing against dependencies whose TypeScript/code is imported directly |
| **`kg:subscribe`** | Substrate snapshot via HTTP | Selective subgraphs and on-demand assets through 5 gates | Consuming large external reference datasets (WHO IRIS, FHIR) |
| **`kg-retrieve-npm`** (`npm install`) | NPM package tarball (`.tgz`) via registry or GitHub release | Pre-packaged bundle with whitelisted files and optional pre-built views | Distributing versioned Knowledge Graph packages with immediate consumption |

### Unhydrated source graph vs. Hydrated materialized graph views

When an npm package distributes a Knowledge Graph, it can provide two distinct
graph views:

#### 1. Unhydrated source graph view
The authored source files as they exist in the repository:
- `package.json` pre-packaging manifest.
- `<instance>.json` layer declaration.
- Authored source directories: `skills/` (markdown instructions), `schemas/` (Zod/TS definitions),
  `processes/` (BPMN diagrams), `methodologies/`, text-based metadata.
- **Binary media assets excluded**: PNGs, JPGs, PDFs and figures under `library/` and `uploads/`
  are excluded via `.npmignore` during unhydrated packaging, keeping the base package compact (~2-5 MB).
- Packaged as `<package>-<version>.tgz`.
- Ideal for agents and developers authoring new knowledge, extending skills, or compiling
  the graph locally.

#### 2. Hydrated materialized graph view
The complete, materialized Knowledge Graph artifacts and binary assets:
- **Binary media assets included**: Losslessly optimized library PNGs, figures, and covers.
- Named subgraph JSON-LD (`docs/subgraph/<instance>/<path>/index.jsonld`).
- Fully dereferenced hydrated JSON-LD (`index.hydrated.jsonld`).
- Metadata indexes, RDF N-Quads, and pre-computed search indices.
- Packaged via `pack-tarball --hydrated` as `<package>-<version>.hydrated.tgz`.
- Ideal for read-only consumers, visualizers, semantic search engines, and portal
  deployments that require immediate access without installing compilation toolchains
  or running offline export pipelines.

#### 3. The subgraph index package — one per pin

A third, narrow package carries a pin's subgraph index files and nothing
else: `<harness>-subgraph-index@0.0.0-pin.<sha>`, built by the
`subgraph-index-package` Tool through `pack-tarball` and released as
`subgraph-index-<sha>` on every push to `main`. A hydrated remote mount reads
it; see
[`remote-mount`](remote-mount.md) §"Hydrated: the index files are published
per pin, in a package".

### Using `kg-retrieve-npm`

To retrieve and inspect a remote Knowledge Graph tarball or package:

```sh
# Retrieve and inspect both graph views from a tarball
bun run cat-harness-tools/scripts/kg-retrieve-npm.ts path/to/package.tgz

# Retrieve and verify integrity against a folio-binary-release/v1 document
bun run cat-harness-tools/scripts/kg-retrieve-npm.ts path/to/package.tgz --release path/to/release.json

# Retrieve only the unhydrated source graph view into a target directory
bun run cat-harness-tools/scripts/kg-retrieve-npm.ts path/to/package.tgz --view unhydrated --destination ./deps/my-kg

# Retrieve only the hydrated materialized graph view
bun run cat-harness-tools/scripts/kg-retrieve-npm.ts path/to/package.tgz --view hydrated --destination ./static-kg
```

When verified against a `folio-binary-release/v1` document, any mismatch in byte
size or SHA-256 digest immediately refuses the package, preventing corrupted or
tampered graph data from entering the consumer environment.
