---
# folio-assistant-v1hw
$schema: bean/1.0.0
title: 'VISUALISER: uploads/ — an uningested badge, a browsable queue, and the first WRITABLE surface'
status: completed
type: task
priority: normal
created_at: 2026-09-20T15:00:40Z
updated_at: 2026-10-07T17:32:00Z
parent: folio-assistant-slw1
---

Owner, 2026-09-20, verbatim:

> like libray/ and foilio/ (should) and doc/ have visualtions as tools in the
> harness that defines there schame, we need one for uploads/ that gives
> count/badge of # uningested, lets you see what's there. lets you upload in
> various ways.   defined in skills/tools.

## What it asks for

The `uploads/` visualiser, **a sibling of `jbx2`** (the `library/` one) and of
whatever `docs/` and `folio/` get. Three capabilities, and the third is the one
that makes this different from every other visualiser here:

1. **A count/badge of how many are UNINGESTED** — a number you see without
   opening anything.
2. **See what is there** — the queue, browsable.
3. **UPLOAD, in various ways.** Every other visualiser on this board is
   read-only. This one WRITES, which is why it is the first real consumer of
   the "writable interface *if* writable datastore" conditional on `yj32`.

And the placement rule the owner states as the general one: **the visualiser
lives as a tool in the harness that DEFINES the schema**, declared in
`skills`/`tools`. Not beside the data, and not in whichever layer happens to
render it — the layer that owns the vocabulary owns the tool for looking at it.

## The blocker, and it is the badge itself

**Nothing records that an upload was ingested.** Measured 2026-09-20:

| | count |
|---|---|
| files in `uploads/` (root) | 22 |
| files in `cat-harness/uploads/` | 4 |
| entries in `cat-harness/library/` | 5 |

Those numbers cannot be subtracted. `AssetSource` (`schemas/kg-node.ts:212`)
records `{instance, path, ref}` — where an asset came from in ANOTHER
INSTANCE — which is a different relation from "this library entry was made
from that upload". There is no marker on an upload, no back-reference on a
library entry, and no manifest between them.

So **"# uningested" is not a query anybody can currently run**, and a badge
that guessed would be worse than no badge: it would put a confident number on
a set nobody has defined. The first piece of work here is the relation, not
the widget.

Three shapes for it, none chosen:

- **A back-reference on the library entry** — each entry names the upload it
  came from. Survives the upload being deleted; needs every entry to carry it.
- **A marker on the upload** — a sidecar or a move to an `ingested/`
  subdirectory. Cheapest to read, and it MUTATES the queue, which is the thing
  a person is looking at.
- **A manifest between them** — one file listing the pairs. One place to look,
  one more artefact to keep in sync.

## Depends on

- **`slw1`** (epic, "one pipeline from uploads/ to a complete L1 library") —
  that pipeline is where the ingested-relation would naturally be written, so
  this should not invent a second answer. **Read `slw1` before starting.**
- **`jbx2`** — the `library/` visualiser. It is NOT read-only either: the
  owner added a quick upload+process action to it the same day, which starts
  doc ingest from the corpus view. So the two share a write mechanism and must
  not answer the write-path question twice, and the action there is what makes
  the badge here tick down. One design, two entry points.
- **`2krx`** — the QA axis requiring a visualiser and a doc entry per declared
  subgraph. `uploads` is one of the two named there as declared-with-no-
  renderer, so this bean CLEARS half of that finding.
- **`yj32`**'s open question "what is the writable datastore?" — the upload
  half of this cannot be designed until that is answered. Git is now confirmed
  as the store (`bootstrap/scenarios/roles.json`, the
  `knowledge-graph-data-store` role), so the remaining question is narrower:
  which write path — a forge API, a local server, or a commit from a checkout.

## Two instances declare `uploads`, and the visualiser must not merge them

The root declares `uploads/` and `cat-harness` declares its own. They are two
declarations on purpose (the `wwi6`/name-collision work), and attribution
follows declaration — so a visualiser showing one queue of 26 would be
reporting a set that does not exist. Per instance, or explicitly grouped.

## Done when

- [ ] The ingested relation exists and is readable, agreed with `slw1`
- [ ] A tool in the harness that defines the `uploads` schema, declared in
      `skills`/`tools` rather than placed beside the data
- [ ] Badge count, browsable queue, and an upload path whose write mechanism
      the owner has chosen


---

## THE BLOCKER IS REFUTED — measured 2026-09-20, four of four, hash-verified

This bean's blocker says:

> **Nothing records that an upload was ingested.** … `AssetSource`
> (`schemas/kg-node.ts:212`) records `{instance, path, ref}` … There is no
> marker on an upload, no back-reference on a library entry, and no manifest
> between them. So **"# uningested" is not a query anybody can currently
> run**, and a badge that guessed would be worse than no badge.

**The back-reference exists, and it is stronger than any of the three shapes
proposed below it.** Every `library/<slug>/manifest.jsonld` carries
`meta.source_file` **and** `meta.source_sha256`:

| entry | `meta.source_file` | in a queue | sha256 recomputed |
|---|---|---|---|
| `9789241548960-eng` | `9789241548960_eng.pdf` | yes | **match** |
| `milnorlink` | `milnorlink.pdf` | yes | **match** |
| `who-pub-tps-931` | `WHO_PUB_TPS_93.1.pdf` | yes | **match** |
| `wpr-rdo-2020-003-eng` | `WPR-RDO-2020-003-eng.pdf` | yes | **match** |

Four of four, and the hash is **recomputed from the file on disk** rather than
trusted, so the relation is CONTENT-VERIFIED rather than name-matched. That is
better than option 1 (a back-reference) because it also detects a replaced
file, better than option 2 (a marker on the upload) because it does not mutate
the queue a person is looking at, and better than option 3 (a manifest between
them) because there is nothing extra to keep in sync.

## What the badge actually is, now that it can be computed

| queue | files | ingested | **uningested** |
|---|---|---|---|
| `cat-harness/uploads/` | 4 | 4 | **0** |
| `uploads/` (repository root) | 22 | 0 | **22** |

So the harness layer's own queue is **fully drained** and the repository
root's is **untouched**. Nobody could state either fact before.

**And the 22/23 discrepancy is itself the finding about badges.** The first
run of the reader said 23, because it counted the queue's `.gitignore`. A
badge wrong by one is a badge nobody trusts the second time, so dot-prefixed
names are excluded — the same dot-prefix rule `directory-conventions` applies
to every path segment. This is exactly the failure mode this bean warned
about ("a badge that guessed would be worse than no badge"), caught by
looking at the rendered page rather than at the number.

## Where the bean was right, and it is kept

The relation is only as good as the manifest. An entry whose manifest names
no `source_file` is **`unknown`** — never silently "not from an upload" —
which is the third state, and `differs` (named, present, wrong bytes) is a
fourth. `scripts/library-graph.ts` renders all four and styles none of them
as an error.

## What this leaves open — the WRITE half, unchanged

Nothing above touches the upload affordance. This bean's items 1 and 2 (badge,
browsable queue) are **done**, in the `library/` viewer rather than in a
separate page, since they are one dataset and two pages over it would be two
answers to "how many are queued". Item 3 — **upload, in various ways** — is
still blocked on `yj32`'s write-path question, and deliberately so.

## Done when — revised

- [x] The ingested relation exists and is readable — it always did; it is
      `meta.source_file` + `meta.source_sha256`, and it is verified rather
      than assumed
- [x] Badge count and browsable queue, per declaring instance, never merged
- [ ] An upload path whose write mechanism the owner has chosen (`yj32`)

---

*2026-09-23* — **RE-VERIFIED, and on an entry ingested TODAY rather than only
on legacy ones.**

The refutation above was measured 2026-09-20 over four entries that predated
the pipeline. The obvious weakness in that evidence is that all four were
built by hand, so `meta.source_file` + `meta.source_sha256` being present
proved the relation EXISTS but not that anything still WRITES it.

`skills-in-openai-api` was ingested and promoted today through
`bun run cat ingest` (#1050), and `library-graph` reports it **`upload=match`** —
so `l1-blocks.ts` writes both fields and the hash recomputes against the file
in `uploads/`. The relation is maintained by the pipeline, not merely inherited
from four hand-built entries.

### The badge today

| queue | files | ingested | **uningested** |
|---|---|---|---|
| `uploads` (repository root) | 31 | 12 | **19** |
| `cat-harness/uploads` | 7 | 6 | **1** |
| `who-iris/uploads` | 4 | 3 | **1** |

Every one of the 21 library entries reports `upload=match`. Not one `unknown`,
not one `differs` — which is the third and fourth states this bean insisted on
keeping, and they are still there for when they are needed.

Note the root queue has grown from 22 files to 31 since 2026-09-20 and its
uningested count from 22 to 19, so the relation is tracking movement in both
directions rather than a frozen snapshot.

### The write path — ANSWERED, and built

Owner, 2026-09-23, over a forge API and a local server: **a commit from a
checkout.**

That answer decides the SHAPE of the affordance, not just its plumbing. A
published page cannot write to somebody's working tree, so the upload action
is a PATH AND A COMMAND rather than a control. A button that looked like it
could write would be `pb04` one layer up: a dead link invites a click and
then reads as a broken site.

The panel is generated PER QUEUE from each queue's own `dir`. Three queues
with three different paths; one hardcoded "put it in `uploads/`" would be
wrong for two of them — the same defect as `ingest`'s printed `-o` (#1050).

### `--library` is NOT printed, and that had to be measured

The obvious move is a sibling convention, `<instance>/library`. **The corpus
contradicts it in all three queues**, derived from the `source_file` relation
rather than from the path:

| queue | where its files actually landed |
|---|---|
| `uploads` | agent-skills/library (5) **and** smart-base/library (7) |
| `cat-harness/uploads` | cat-harness/library (5) **and** folio-assistant-sci/library (1) |
| `who-iris/uploads` | **none ingested** — and the convention would have said `who-iris/library` |

**A queue does not determine a destination.** The choice is per document,
which is exactly why `ingest` refuses to guess it, so the page says what the
tool says and prints `<destination>`.

### What the generated-viewer gate caught

The first draft emitted a literal newline inside a single-quoted JS string —
the template literal collapsed the escape one level too far — and the whole
inline script failed to parse. `generated-viewer-scripts` parses every inline
script in every generated viewer and refused it. The page looked fine and was
dead. Fixed, with a regression test on the escape.

Also hit, and it is written down twice elsewhere in this repository: a
backtick in a comment inside the page template literal ends the string and
turns the rest of the file into TypeScript.

## Completed on landed evidence
Landed on main in PR #1050 (apui: ingest is the whole path — the pipeline terminates).
