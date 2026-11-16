---
name: kg-viewer
description: >
  Render a published knowledge-graph document so a person can read it — faceted
  index, node detail, followable edges, and an honest account of what the
  document is missing. Host-agnostic; the publishing is a separate Tool.
---

# Rendering the knowledge graph

`kg-export` serialises the layer's graph to one JSON-LD document. This skill
is **making that document legible to a person.** The two are separate
capabilities — serialising is mechanical and
host-agnostic, rendering is a design problem, and posting the result to a host
is a third thing that belongs to the `pages-publish` Tool.

## The page is generated, not committed

The viewer must fetch the graph document, and that document is named after the
repository — `<stub>.jsonld`, never a generic `kg.json`. A committed page would
have to either:

- **Hardcode one layer's stub**, so a platform script works in exactly one
  repository; or
- **Compose the name at runtime** from the URL or a convention, which breaks
  the "resolve, do not compose" rule: a consumer should never have to
  manipulate a string to find a document.

So the exporter, which already knows the stub, writes it into the page. The
page resolves nothing.

**It fetches the document relative to its own location.** The page is
`<site>/<stub>/index.html` and reads `../<name>/<stub>.jsonld` (the document's
own path, under its layer's directory, the host's included), so the same
bytes work on the canonical site and under `branches/<slug>/` with no
configuration, no `--base-url`, and no build-time branch. A staging build that
needed a different page would test something other than what ships. Which
documents the site publishes, and where:
[`instance-publication`](../../kg/kg-core/instance-publication.md) §"What each
layer publishes".

## No dependencies, and that is a requirement rather than a preference

No CDN, no framework, no build step — one HTML file. A page that needs a
third-party fetch to render cannot be opened from a file or reviewed offline
or from a restricted network, and adds a third party to the trust boundary of a page that displays
this repository's own data.

"No CDN" means no THIRD party's. A script or stylesheet this site publishes
itself, shared by many of its own pages, is the opposite case and is what the
next section requires.

## Every asset has its own IRI — a materialized path, loading published JSON-LD

Four rules, for every viewer that shows addressable things:

1. **Every addressable asset has its own IRI, and it is a PATH** —
   `<viewer>/<instance>/<id>/`. Never a query string (`?entry=`, `?id=`) and
   never a fragment (`#<id>`) as the asset's address. A fragment may still
   point INSIDE a page; it is not an asset's name.
2. **The IRI is a real file on gh-pages**, returning 200, written by the
   viewer's generator and compared by its `--check`. No `404.html` routing,
   no SPA fallback: a URL that works only because a not-found page rewrote it
   is a 404 to every crawler, cache and standards-following client.
3. **The page at that IRI is a thin shell**: identity only (a small JSON
   config block naming the published data and the asset's id), a
   `rel=canonical`, a `rel=alternate type=application/ld+json` to the asset's
   published JSON-LD where there is one, a `<noscript>` link to that data, and
   the viewer's SHARED stylesheet and script by reference. No content of the
   asset is written into it; the script loads it from the KG JSON / JSON-LD
   the site already publishes. If the asset's own serialisation is not yet
   published, publish the KG's existing one — do not invent a format. A shell
   is a few KB; never inline shared chrome into each one.
4. **An old `#<id>` link is legacy**: the shell normalises it ONCE to the path
   IRI with `history.replaceState` (or navigates, when the asset belongs to
   another page), and nothing new emits it.

These rules are measured per node by `bun run cat node-views:report` (the
`node-view-coverage` Tool): for each node a declared directory holds, an IRI,
its `.jsonld`, a page at the path IRI and a row on the folder page. Every row
must read `ok`, or carry a waiver with a ruling; none is recorded (owner,
2026-11-13: every listed node kind gets pages).

### The asset and its rendering are two resources with two IRIs

**This is the one place the rule is stated**; other skills point here.

- **The asset's IRI is extensionless, `…/<kind>/<id>`**, and its `@id`
  says so: absolute, instance-qualified, under the site root the docs are
  served at; its JSON-LD is published at the IRI plus `.jsonld`. A library
  entry's is `<site>/assets/library/jsonld/<instance>/source/<id>`, minted by
  ONE function (`schemas/library/library-iri.ts`) that both the `@id`'s writer and
  the file's publisher call, so the two cannot drift.
- **The rendering has its own IRI** — the viewer page — and it **points to the
  asset**: `rel=alternate type=application/ld+json`, and if the page ever
  carries JSON-LD of its own, `about`/`mainEntity` naming the asset's `@id`.
- **The asset never references its renderings** — no `subjectOf`, no
  `foaf:page`, no viewer URL in its JSON-LD. Renderings change with every
  visualiser; the asset would have to be rewritten each time.
- **A rendering's IRI is DERIVED from the declared visualiser** for the graph
  kind (the harness's `visualisers`, at `<base>/<harness>/<visualiser>/`
  computed by `visualiserRoute`), never authored into the asset. If an index of renderings is useful, generate it; never store it in
  the asset. The library does exactly this: each entry in the GENERATED
  projection (`assets/library/index.json`) carries `view` — the site-root path
  of the page that renders it (another layer's declared root route for an
  entry that layer renders; else the entry's own library page) — and the
  row's slug links there, so clicking it opens the entry's visualiser.

Reference implementation: `gen-library-viz.ts` (`viewerHtml`, `VIEWER_JS`,
`VIEWER_CSS`) and `scripts/lib/library-address.ts`; browser check
`test/library-entry-iri.e2e.ts`.
A library entry's DOCUMENT view — TOC, pages with printed labels, figures,
sections, checks — is `scripts/lib/library-document.ts`: a projection read
from the ingestion schema plus the browser code that renders it, kept in one
module so a test runs the same text the page runs.

## Do not draw the whole graph

**The instinct is a force-directed node-link diagram of everything. Resist it.**
At the size of a real layer (on the order of a thousand nodes) it renders
as a hairball that answers no question, while costing a layout library and a
frame budget.

The questions people actually arrive with are local:

- *What is this node?* → a detail panel with every property.
- *What does it point at?* → edges rendered as controls you can follow.
- *What points at it?* → back-links, **computed at load** rather than published.
  An inverse index stored in the document is a second copy of the edge set that
  can disagree with the first.
- *What else is of this kind?* → facets, with counts from the document's own
  `counts` rather than recounted.

A **one-hop** neighbourhood diagram for the selected node is worth drawing,
because at that scale a picture beats a list. Cap it; a node with two hundred
neighbours is a list, not a diagram.

## Render what the document is missing, in the document's own terms

A viewer must surface what the graph lacks rather than display everything as
though it were all part of the graph. Two things the export reports and the viewer must not swallow:

- **`undeclaredTerms`** — property names absent from the `@context`. Every one
  is *dropped* when the document is processed as the JSON-LD it claims to be,
  and `kg-export` exits non-zero rather than publishing a new one. Mark them in
  the detail panel; do not silently show them as ordinary properties. **Keep
  the marking even while the list is empty** — it is the guard that makes the
  next one visible, and a viewer for this layer is a viewer for any
  layer, including one whose export is older or whose
  context is thinner.
- **`danglingLinks`** and **`problems`** — a link with no target node, and a
  source that could not be read.

## Three states, on the page as everywhere

A document that **could not be fetched** is never drawn as an empty graph. On
screen the two are identical and they mean opposite things: "this layer has
no nodes" versus "I could not read it". Say which. The same applies to a
property that is absent versus one that is present and empty.

## Provenance belongs on the page

The export carries `sourceCommitSha`, `sourceCommitAt`, `sourceTreeDirty` and,
for a preview, a `PreviewGraph` type and a `canonicalDocument` link. Show them.
A reader looking at a staged graph must be able to tell it is staged **from the
data**, not from an injected banner that a JSON file would not carry anyway —
and `sourceTreeDirty` is the difference between a graph a SHA reproduces and
one it does not.

## Translate the chrome from the GENERATOR, never from the page

A generated artefact is not a translation source. Its generator is.

Run an extractor over the emitted HTML and the `.pot` fills with the
generator's OUTPUT: regenerate for any reason — a new node kind, a changed
commit line — and every reference churns while no string has changed, and
every sign-off is invalidated by the regeneration rather than by an edit.

So the viewer's own words live in a **declared table in the source**
(`scripts/kg-viewer-strings.ts`): the English text, which IS the `msgid` as
everywhere else here, plus the translator comment naming where it appears and
what each `{placeholder}` will hold. `bun run cat translate-kg-viewer --extract`
turns the table into `translations/<locale>/kg-viewer.pot` through the shared
`formatPot`, and the generator reads each `.po` back through the shared
`parsePo` and embeds the catalogues. **There is no inject step**: generating
the page is the injection, and a second artefact would serve nothing.

`--check` separates two things that look alike. **Drift fails**: a `.pot` that
no longer matches the table, a translation that dropped a `{placeholder}`, an
entry for a string the page no longer says. **Coverage only reports**: a string
nobody has translated is the ordinary state of a translation in progress, and
the page falls back to English string by string.

## Say where the translation stops

**Chrome-only translation is half a translation, and the half that is missing
is the half the reader came for.** Node titles, descriptions and property names
arrive in the graph document in whatever language the corpus is written in; no
catalogue in the viewer can reach them.

Draw that boundary **on the page**, in the language the reader chose, so the
reader can tell a missing translation from a corpus that is simply English;
silent about it, the reader reads the gap as a defect or as a claim. Three
states, never two, as for an unreadable document.

## A language switcher is a UI control

It is bound by [`ui-accessibility`](ui-accessibility.md) like everything else,
and four things are easy to get wrong:

- **Label each option in ITS OWN language** — Français, العربية, 中文 — and set
  `lang` on the control. That is what a reader scanning for their language
  looks for, it leaves no accessible name to mistranslate, and it is what lets
  a screen reader switch voice.
- **Translate the accessible names too.** A page whose visible text is Spanish
  and whose `aria-label`s are English is a page that is translated for sighted
  readers only, and nothing on screen says so.
- **Announce the change.** The panel is rewritten in place and the reader's
  cursor has not moved.
- **Turn the page, not just the words.** A right-to-left language needs `dir`
  on the document, and the layout has to be checked in it — axe over an RTL
  render catches what an LTR one cannot.

**Do not invent a second locale mechanism.** The docs site already stores the
reader's choice in the `fa-locale` key; read that, let a `lang` query parameter
override it for a shared link, and fall back to the browser's own preference.

**Offer only what the page can show.** A catalogue with nothing translated is
not a language the viewer can render, and listing it would promise a
translation the reader would not get.

## Verifying it

**A rendered artefact is not verified by reading its source**: nobody can
assess a rendering from a description of it, including the agent that wrote
it. "The HTML looks right" is not evidence
that the document loads, that an edge is clickable, or that a failed fetch says
so.

Drive the real page in a real browser. `test/kg-viewer.e2e.ts` is the worked
example, and it asserts against the *generated* artefacts rather than a fixture,
so a test cannot agree with a stand-in while disagreeing with what ships. It
generates them if absent, so the suite runs from a clean checkout.

**Look at it, too.** Take a screenshot: layout problems such as a long nested
property (a Tool's `io`) pushing the rest of a node off screen are caught only
by looking, because no test reports that a property makes a node unreadable.
Nested objects are collapsed behind a disclosure for that reason.

**Count the nodes, too.** A viewer that renders one folder page well can still
leave most of its nodes without a page, an IRI or a row: a census of folder
pages passes over that. Run `bun run cat node-views:report -- --site <built
site>` (or `--base <live url>`) and read the rows for your viewer's kind. It
reads the folder page's data files as well as its HTML, so rows your script
draws count. It is a QA report and exits 0; `node-views:judge --against main`
fails only on a finding your change made new.
