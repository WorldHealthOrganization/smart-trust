---
name: materialize-on-demand
description: >
  After bootstrap, a person asks for part of a remote subgraph to be held
  locally. Check what is already here (cache:index), put a number on the ask
  before anything is fetched, then run materialize-remote. Eviction is a
  report, never an act.
---

# Materialize on demand

Bootstrap brings an agent to a working harness. It does **not** bring the
corpus, and must not: a remote source such as IRIS runs to about a million
files and hundreds of gigabytes. What arrives is the **reference**; a person
asks, as they come to need it, for parts of subgraphs to be materialized.

This skill is that ask. The gates are not here; they are in
[`materialize-remote`](materialize-remote.md), once.

## 1. What is already here

```sh
bun run cat cache:index          # summary and eviction candidates
bun run cat cache:index --all    # every copy
```

Read the columns for what they are:

| column | values | what it means |
|---|---|---|
| size | `recorded` · `measured` · `directory` · `absent` | `measured` is the file now, not when it landed. A directory is counted through its parts. `absent` is not zero. |
| fetched | a date, or `not recorded` | only the record's `materializedAt` |
| last read | `not recorded`, always | nothing records reads; file access times are not used, because they are often off or reset by a checkout. |
| freshness | `fresh` · `expired` · `no-expiry` · `permanent` | from `freshness()`. `no-expiry` is a finding: a working copy nobody gave a lifetime. |

If what they want is already held and fresh, stop: point them at it.

## 2. Put a number on the ask BEFORE anything moves

Asking must not mean hundreds of gigabytes arrive without a number first. Before
calling `materialize-remote`:

- **Name the subset** in the source's own terms: its identifiers, or a subset
  strategy its descriptor (in the owning layer's declared `sources/`, e.g.
  the IRIS replica's `sources/`) supports.
- **Close it over dependencies** if the descriptor says the subset is not
  self-contained (`subsetIsSelfContained: false`, mathlib). The size that
  matters is the closure's.
- **State the size and its basis**: from the descriptor's enumeration, or a
  measured listing. If neither gives a number, say that. The SIZE gate
  refuses on an unknown, and so should this conversation.
- **Say what it would add** to the cache total from step 1.

Then ask the person, with the number in front of them.

## 3. Materialize

Run `Process_MaterializeRemote`. Its five gates decide; this skill does not
second-guess them. A refusal leaves the content `referenced`, with the reason
recorded. That is the process working, not failing.

## 4. Eviction is a report

`cache:index` lists candidates: `expired` first, then `no-expiry` working
copies, largest first. **An archival copy is never a candidate.** Nothing is
removed by the tool or by you. Show the list with sizes and reasons, and let
the person decide (`deletion-requires-confirmation`).
