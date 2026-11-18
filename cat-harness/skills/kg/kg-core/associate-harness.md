---
name: associate-harness
description: >
  Declare a harness this one knows about and does not hold (`associatedHarnesses`):
  a folio in another repository, published at its own site. Referenced, never
  loaded, never materialized.
adapters: [document, paper, dak]
profiles: [document, paper]
consulted: true
---

# Associate a harness

`associatedHarnesses` is an optional list on any harness that inherits
cat-harness, including cat-harness itself. It names a harness published from
its own repository, without publishing or materializing it here.

## What an association is, and what it is not

A harness has four ways to relate to another:

| relation | field | what it does |
|---|---|---|
| depends | `needs` | loads the other harness under this one (the overlay) |
| references | `remoteGraphs` | knows one **graph** held elsewhere |
| utilizes | `dependencies` (config) | resolves another folio's skills and translations |
| **associated** | `associatedHarnesses` | knows another **harness**, and where it lives |

**`needs` is required of every layer in this repository, and so is a harness
IRI.** `check:instance-graph` fails on:

- a layer with no `needs` (write `[]` for the floor; absent stays a legal
  runtime state and reports `unknown`, but a repository does not ship it);
- a `needs` name that resolves to nothing, or a cycle;
- a layer with no absolute harness IRI, or two sharing one.

The IRI is **derived, never written**: `kg-export`'s `exportIdentity` mints
`<canonicalUrl>/<stub>.jsonld` for a layer that declares its own base, and
`<host base>/<stub>/<stub>.jsonld` for one published from the host. The gate
calls that function rather than restating it, so the gate and the published
`@id` cannot disagree, and the one place to change a base stays one place.

An associated harness is **not loaded, not built and not copied**. This site
does not publish it. The config panel lists it under "Associated ↗ remote",
and its links go to the harness's own site and its own repository.

## Declare one

Add an entry to `associatedHarnesses` in the declaring layer's `<name>.json`:

```json
"associatedHarnesses": [
  {
    "name": "ihris",
    "title": "iHRIS Knowledge Base",
    "url": "https://litlfred.github.io/ihris/",
    "repository": "https://github.com/litlfred/ihris",
    "relation": "folio-of",
    "note": "A folio on this platform, published from its own repository."
  }
]
```

- `name` is the harness's layer name as **its** declaration gives it.
- `url` is required: where a reader goes.
- `repository` is where the panel's ✎ points. Leave it out if the harness has no
  public source, and the panel shows no ✎. It never falls back to this
  checkout's `origin`.
- `relation` is a few words; `folio-of` means "a folio built on this platform".

## What the schema refuses

`AssociatedHarnessSchema` is strict. It refuses:

- an unknown key (a misspelt `repo` would otherwise vanish and leave ✎ pointing nowhere);
- the same `name` twice;
- a `name` that is also in `needs` (then it would be both loaded and not loaded);
- a `name` that is a harness in this checkout. That one is local, and belongs
  in `needs` or nowhere (`associated-harness-config.test.ts`).

## Then

Run `bun run cat docs:harness` to write `docs/_data/harness.json` (built at
publish, never committed: it is declared under `builtAtPublish`). The Harnesses
panel (the ⚙ on a sidebar divider, or the glass tile) reads it from there.
