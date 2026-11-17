---
# folio-assistant-yag0
$schema: bean/1.0.0
title: 'WHO-IRIS LIBRARY VIEWER IS A SHELL: the page generates, the link is right, and neither the corpus entry nor the 3 materialized assets appear'
status: completed
type: bug
priority: high
created_at: 2026-09-23T05:46:53Z
updated_at: 2026-10-02T13:36:37Z
parent: folio-assistant-yj32
---

Reported by the owner, 2026-09-23, from the deployed site:

> library for who-iris does not work,
> https://litlfred.github.io/folio-assistant/cat-harness/docs-auto/index/docs/who-iris-docs/
>
> i got to there by clickinv library under
> https://litlfred.github.io/folio-assistant/who-iris/ whcih should toak me to
> who-iris library w/ 3 thigns … (at least, all materialized assets)

## What is NOT wrong — ruled out by building, not by reading

The obvious diagnosis is a mis-targeted link, and it is wrong. Built the site
locally and ran the mount step, then read the rail off the rendered page:

| label | href |
|---|---|
| `library` | `../cat-harness/library/who-iris/` — **correct** |
| `docs` | `../cat-harness/docs-auto/index/docs/who-iris-docs/` |

So the **library link is right on `main`**, and the URL reported is what the
*docs* link points at. Two possibilities for how the owner arrived there, and
this bean does not settle which: a stale deployment (the `ha78` visualiser-ref
fix and the `sjic` navbar work both landed 2026-09-22), or the two rail entries
being adjacent and small.

Also ruled out: the tiles data is correct (`kind: library` →
`/cat-harness/library/who-iris/`), the template is correct
(`href="{{ v.path }}"` labelled `{{ v.kind }}`), the page IS published by the
build, and the page's `h1` IS *"Library — the L1 corpus"* — it is the right
viewer, not the uploads one. An early reading of mine said otherwise; it had
extracted a sub-fragment.

## ~~What IS wrong~~ — STRUCK 2026-09-23, THE FINDING WAS FALSE

**The page is a shell.** `cat-harness/docs/cat-harness/library/who-iris/index.html`,
20,160 bytes, committed and built identically, contains **none** of:

| expected | in page |
|---|---|
| `9789241548960` — the one directory under `who-iris/library/`, which `library-graph.ts` reads as a corpus entry | ✗ |
| `WPR-RDO-2020-003-eng` — materialized | ✗ |
| `WHO_PUB_TPS_93.1` — materialized | ✗ |

`gen-library-viz.ts` runs clean and claims the page: *"17 entr(ies), 3
queue(s), 22 uningested, 6 subject page(s)"*, and writes
`library/who-iris/index.html` among them. So the generator believes it
produced a who-iris subject page, and the page it produced holds no who-iris
subject matter. That is the gap.

The three materialized assets are under `who-iris/uploads/` (the rail's own
raw/CDN links on `/who-iris/` resolve to `who-iris/uploads/<slug>/…`), so the
uploads section of this page is where at least those should appear, and it
renders its empty state.

## Where to look first
1. The subject **scope filter** — the generator filters by subject
   (`inScope`, and `G.uploads.filter(...)`). A scope that matches nothing
   produces exactly this page: generated, well-formed, empty, and silent.
2. Whether `library-graph.ts` reads `who-iris/library/` at all. Its rule is
   that every DIRECTORY under a library graph is a corpus entry and only loose
   files are ignored — and who-iris's `library/` is mostly loose `.html`
   (`collection-*.html`, `item-*.html`) around one directory.
3. Whether `who-iris-uploads` declaring the **library** visualiser path
   (`cat-harness/docs/cat-harness/library/who-iris/index.html`) rather than the
   `uploads/<instance>/` path every other instance uses is related. Two kinds
   name one page here, and the tiles data shows both pointing at it.

## Done when
- [ ] the page lists who-iris's corpus entry and its materialized assets, or
      states in the page why there are none — an empty state that cannot tell
      "nothing here" from "the filter matched nothing" is the defect, not the
      symptom
- [ ] a check fails when a declared subject page renders none of its subject's
      entries, so this cannot recur silently
- [ ] confirm whether the deployed site was merely stale, since that changes
      whether anything about the LINK needs doing at all

## FALSE FINDING — corrected 2026-09-23, issue #1009

**The page works.** Loaded in Chromium against a real build:

```
STATUS LINE: who-iris · 3 entries · 84,292 words · 404 sections
json responses: ["200 .../assets/library/index.json"]
console errors:  []
  contains 9789241548960: true    contains wpr-rdo: true    contains who-pub-tps: true
```

### How the error was made, and why it was unfalsifiable as written

I grepped the committed HTML for the entry names. **The viewer is
client-rendered** — `DATA_HREF = "../../../assets/library/index.json"`, fetched
at runtime, filtered by `inScope(x) { return !SCOPE || x.instance === SCOPE }`.
The names are necessarily absent from the static file for a working page and a
broken one alike. That test could not have returned any other answer.

The bean read as well-evidenced — a byte count, a file path, an "identical
committed and built" comparison — which is what made it convincing and what
made it wrong.

### A second error in the same bean

It said who-iris's `library/` held *"the one directory"*. It holds **three**:
`wpr-rdo-2020-003-eng`, `who-pub-tps-931`, `9789241548960-eng` — exactly the
"3 things" the owner expected. I had read a truncated listing.

### What the evidence says instead

| checked | result |
|---|---|
| the `library` rail link on `/who-iris/` | `../cat-harness/library/who-iris/` — correct |
| the viewer page | 3 entries, `200` on its data, no console errors |
| the data file | 3 entries, 4 uploads, 1 queue tagged `who-iris` |
| the deployment | Docs site succeeded on `47629383` at 06:36Z — NOT stale |

So the owner most likely reached the docs-auto page via the **`docs`** rail
entry, which sits beside `library` as a one-letter glyph plus a bare kind word.

### What actually shipped from this bean

1. **A regression test** — `cat-harness/test/library-viewer-scope.e2e.ts`.
   Its first draft **passed against a fixture with who-iris's entries deleted**,
   because it read the subjects it checked from the viewer's own data: no key,
   no iteration, green. It now takes its expectations from the DECLARATIONS on
   disk, which the failure being looked for cannot empty. Falsified both ways
   before being kept.
2. **The uploads/library visualiser share documented** on who-iris's
   declaration — defensible (the library page carries a scoped uploads section)
   but previously silent, which is why the rail shows two entries at one URL.
3. **`rendered-verification`** gains §"A STATIC read of a client-rendered page
   is not verification — in either direction", written from this failure. The
   skill already existed; I did not consult it.

## Done when
- [x] the page is confirmed to list who-iris's entries — it always did
- [x] a check fails when a declared subject's entries do not reach its viewer
- [x] the deployment question settled: current, not stale
- [x] whether the rail's adjacent one-letter targets need distinguishing — the
      owner's call, and not this bean's to decide (owner, 2026-09-30: yes, folded into `v8n5`; done, see below)



## Claim released 2026-09-29

Released `in-progress` → `todo` on the owner's instruction (review session https://claude.ai/code/session_014Qj8wncQhqV52QGN1yZDnj). No git change to this bean since before 2026-09-26, and no holder recorded; the sessions that held theme C (rendered site) work stopped on the 2026-09-25 weekly usage limit. Nothing in the body was changed: re-claim with `bun run cat beans:claim <id>`.

_2026-09-30T13:39:14Z_ — Claimed by claude/magical-archimedes-4qkfxp-v8n5-theme — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

## 2026-09-30: the rail rows are distinguished — folded into `v8n5` by the owner

Owner's ruling (b), "Fold into v8n5". Branch `claude/magical-archimedes-4qkfxp-v8n5-theme`.

- **Generic, in platform code.** New `cat-harness/scripts/lib/graph-kind-nav.ts` gives every graph-kind navbar row (a) the kind's own SVG glyph and hue from `schemas/avatars.ts` — `library` is books on a shelf, `docs` a page under a magnifier — instead of its initial (which also made `catalogue` and `code` both `C`), and (b) a full accessible name `kind — <head of the kind's registered summary>, <instance>`, e.g. `library — L1 source content, who-iris`, rendered as visually-hidden text inside the link and as its `title`. The visible label stays the kind word and begins the name (SC 2.5.3); the words carry the meaning without the colour (SC 1.4.1).
- Used by BOTH navbars: the rail (`mount-instance-docs.ts` `declaredGraphs`) and the Jekyll sidebar's harness rows (`gen-navbar-include.ts`, hue omitted there because the sidebar paints these marks on its own neutral chip in page ink).
- **Found on the rendered build and fixed:** in the rail's resting 56px strip, LINKED sub-rows were indented past the strip (`.fa-nav-group .fa-nav-sub a` padding) while inert rows were not, so at rest the strip showed marks only for the rows that do NOT open. Kind rows now sit in the strip column (`a.fa-nav-kind`).
- Tested in `navbar.test.ts` §"adjacent graph rows cannot be confused": every row's mark is unique, docs/library carry drawn glyphs with distinct hues, every accessible name is distinct and starts with the visible label.
- Verified in Chromium on the `preview:site` + mount build: the rail's aria snapshot reads `link "docs — Documentation ABOUT the knowledge graph, who-iris"` and `link "library — L1 source content, who-iris"`.

## Summary of Changes

Closed 2026-10-02 on evidence. Every item in Done when was already checked, and the work they name is on `main`:

- `cat-harness/test/library-viewer-scope.e2e.ts`: the regression test. It takes its expectations from the declarations on disk, not from the viewer's own data.
- `rendered-verification` §"A STATIC read of a client-rendered page is not verification — in either direction".
- The rail rows are distinguished (`v8n5`, merged in PR #1611 on 2026-09-30): `cat-harness/scripts/lib/graph-kind-nav.ts` gives each row its own glyph and an accessible name, tested in `navbar.test.ts` §"adjacent graph rows cannot be confused (bean yag0)".

The original "shell page" finding was false. The page always listed who-iris's three entries, and the body records how the error was made.
