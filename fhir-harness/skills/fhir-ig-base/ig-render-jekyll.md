---
name: ig-render-jekyll
graph-typologies:
  - ig-pages
  - ig-artifact-jsonld
description: >
  Rendering a FHIR IG's content through the just-the-docs pipeline instead of
  mounting the IG Publisher's finished HTML — the JSON-only representation
  contract, navigation derived from sushi-config.yaml, and the LHS rail. Read
  before adding a representation, a menu entry, or a page kind.
---

# ig-render-jekyll

> Skill id: `ig-render-jekyll` · Package: `fhir-ig-base` · Layer:
> `fhir-harness`

Render an IG's pages as **folio pages** — markdown with front matter, through
Jekyll and just-the-docs — from the Publisher's structured output, never its
finished HTML. Publisher HTML has no front matter, so the navbar, language bar,
QA badges and translation surface cannot reach it; a folio page gets them all.

Whether an IG repository gets this rendering is asked when it is adopted
(default yes); see [`ig-build-pipeline`](ig-build-pipeline.md) §"Who starts a
build".

## The three contracts

### 1. JSON only

The Publisher emits JSON, XML and Turtle; only **JSON** is taken, wrapped in
JSON-LD / JSON Schema. RDF, where needed, is projected from the JSON-LD.

A representation that arrives and is not taken is recorded as a refusal.

**Not linked either.** The site does not link a resource's `.xml` or `.ttl`
copy: JSON-LD nodes carry only JSON encodings, and the `site.data` artefact
variables only `url.json`. The refusal record still counts what each IG
published in those forms.

### 2. Navigation is derived, never authored

`sushi-config.yaml` already carries both maps the site needs:

- `pages:` — an **ordered map** of source file to title. That is the page order.
- `menu:` — the grouping, including nested subsections.

Derive the navigation from them. Do not hand-author a nav file or write entries
back into `sushi-config.yaml`.

When the config names a page that does not exist, that is a finding, not a
reason to create a placeholder.

### 3. LHS rail, and the theme is captured rather than replaced

Navigation goes in the **left-hand rail**, not the FHIR IG's top bar. The rest
of the IG theme — CSS, typography, resource-page furniture — is **captured into
the theme layer** rather than discarded.

Nav position is a layout setting; nav contents are derived per build.

## What the render reads in the IG repository

Only what the repository declares. Every reader on this path (`build-ig-site`,
`ig-site-data`, `ingest-ig-menu`, `ig-repo-site`) goes
through `scripts/ig-read-scope.ts`, which honours `contentTypes.ig.include` in
the repository's `index.config.json`; anything outside it is not rendered. A
repository with no section is read whole, with a warning. See
[`ig-build-pipeline`](ig-build-pipeline.md) §"What this layer reads".

## Where the variables come from

`artifactVariables` (`build-ig-site.ts`) writes the per-artefact Liquid
variables from the artefact index to `_data/`, read by the same Jekyll run:
`site.data.fhir.artifacts.<ResourceType>__<id>` with `url`
(`canonical`, `page`, `json`), `text`, `link.html` and `elements.<key>`, plus
`artifact_categories`, `artifacts_listed` and `artifact_lists`. An element key
the index does not hold is reported as not sourced, never written empty. The
families and keys follow WHO's `generate_smart_liquid.py`, a build script
outside this layer, without its `smart__` prefix: that prefix is WHO's, and
this layer does not know about WHO.

## What parity means, and what it does not

Parity is a checklist of asset types and page kinds. A page kind the Publisher
emits no data for cannot be rendered.

## Thin pages, the default (`--full-pages` to opt out)

Every IG page is a thin HTML shell that loads its content from the JSON-LD
graph, unless a build passes `--full-pages`. The shell is cat-harness-tools'
`thinPageHtml`.

### Artefact pages (`gen-ig-pages.ts`)

- **Page address:** `artifact/<Type>-<id>.html`, self-canonical.
- **The asset is a JSON-LD node**, `artifact/<Type>-<id>.jsonld`, with no
  `.json` twin (every reader fetches the `.jsonld`), written by
  `ig-artifact-jsonld.ts` from the index (kind
  `ig-artifact-jsonld`; QA `ig-artifact-jsonld.ts check` over the built site).
  It uses the FHIR RDF class, dcterms, schema.org and PROV, and mints nothing.
  The page names the node as `alternate`. Its encodings list the reduced
  `<Type>-<id>.json` at the site root first (`local`), then the full copy in
  the AST cache by raw URL (`mirror`), then the IG's published file
  (`upstream`); `artifact/index.jsonld` names each root file on its entry
  (`schema:contentUrl`; fhir-harness#359).
- **One shared renderer.** `assets/ig-artifact.js` fetches the node, then
  the resource's full copy (the `mirror`, else the `local` one), draws the description, facts, identity table and
  elements, concepts or includes, and hands the narrative and JSON to
  `ast-resource.js`. The page carries only its title, key and a `<noscript>`
  link to the node and resource.
- **The rail is linked:** `folio-navbar: linked`, and the rail pass
  (`rail-standalone-pages.ts`) links its style and scripts rather than
  inlining them.
- **The tab views are thin pages too**, written beside the page wherever the
  site serves the artefact's JSON: a compiled copy (`--compiled-data`) or,
  failing that, the Publisher's own `<Type>-<id>.json` carried as data
  (`--publisher-data <dir>`, from the docs root). An IG repository's site
  (`ig-site:compose`) passes only `--compiled-data .`: the AST's copy, served
  once at the root as `<Type>-<id>.json`.
  Each view keeps the Publisher's file name:
  - `-definitions`: the snapshot's element table, differential marked;
  - `-mappings`: each `mapping` declaration with the elements mapped to it;
  - the JSON view (`.profile.json` for a StructureDefinition, else `.json`),
    drawn by `ast-resource.js`;
  - `-examples`, for every StructureDefinition: the instances claiming it in
    `meta.profile`, or a note that there are none.

  Each uses the same shell (`thinArtifactView`) and renderer; the artefact's
  page links them in a tab bar, and the narrative's links to them are
  relinked. The change history, testing, XML and Turtle views are neither
  rendered nor published. The IG API view pages stay full pages.
- **Nothing under `comparison-v*/` is published.** `ig-site:publisher-pages`
  serves the AST's data and reads no Publisher output.
- In an IG site the docs root is the site root, so `--compiled-data .` points
  each resource at `../<Type>-<id>.json` from `artifact/`. No `ast-data/`
  mirror is published.

### The artefact list and the table of contents (`build-ig-site.ts`)

- **One index node**, `artifact/index.jsonld` (family
  `folio-ig-artifact-index-jsonld/v1`, same kind), lists every artefact once,
  in the Publisher's order, each entry naming its node and carrying only what
  a list row shows; `check` holds it to the artefact index and each node.
- **`artifacts.html` is a thin shell** over that node: a jump list of
  categories, a filter, then every category open (nothing collapsed), anchored
  `#artifacts-<slug>`.
- **What a list draws:**
  - **The IG's own ImplementationGuide is "This guide"**, drawn first
    (`#artifacts-this-guide`), never as a "Not categorised" row; the toc
    lists it first too.
  - **A category that mixes resource types is sub-headed by type**
    (`#artifacts-<category>-<type>`; the Publisher's "Other": Basic,
    Questionnaire, DocumentReference…), and the jump list counts each type.
  - **A table draws only the columns its rows fill.** An instance (an
    artefact with no canonical URL) has no description, so the index copies
    what the resource states: its `meta.profile` (`dcterms:conformsTo`,
    drawn as the last path segment, linked when it is in the same IG) and
    its `code` (`dcterms:subject`). A definition's core profile
    (`shareablevalueset`) is not shown.
- **`toc.html` is a thin shell.** The IG's own pages (`sushi-config.yaml`
  `pages:`, landing page first) stay in its HTML; the artefacts under each
  category are drawn from the index node.
- Both are written by `stageIgSite` when `StageOptions.artifacts.index` is
  given, which `stage-ig-sites.ts` does unless `--full-pages`. Staging thin a
  site whose artefact pages were generated with `--full-pages` (no index node)
  is refused.

### The narrative pages (`composeIgSite`)

- The IG's prose stays in the HTML, rendered by Jekyll; composed into a host
  site, the page wears `thinIgLayout` (`_layouts/ig-thin-<instance>.html`)
  instead of the host's layout, so none of the host's chrome (harness bar,
  SVG sprite, sidebar nav, inline scripts) is written into it.
- Everything around the prose is linked: `assets/ig-artifact.css`,
  `assets/ig-topbar.css`, `assets/ig-source-links.js` and the rail
  (`folio-navbar: linked`). The IG's top bar, edit links, footer and TOC
  declaration stay.
- The thin page has no host search box or QA badges; it has its own search
  box and language picker block (below).

### The footer stays in view

Every IG page ends with the Publisher's footer (`ig-footer.liquid` on the
Jekyll pages, `ig-artifact.js` on the thin pages, one `igSiteFooter` object
for both): publisher and copyright year, `package#version`, FHIR version, the
build day, and Links: Table of Contents | QA Report | Version History |
License, each value read from the IG's package, `sushi-config.yaml` or AST
and left out when none holds it. Unlike the Publisher's, it stays at the
bottom of the window (owner, 2026-11-06): it is the body's last box, after
`<main>` on every IG page, `position: sticky` (`ig-artifact.css`), so it spans
the width beside the rail, the page scrolls under it and nothing is left
behind it at the end of the page. The body is a column at least the window's
height with `<main>` taking the free space, so on a page shorter than the
window the footer lands at the window's bottom too. In print both are off:
the footer is static, once, at the end. "QA Report" is `qa.html`, the
harness's QA report (`ig-qa-page.ts`): the FHIR QA the build holds (the
Publisher's `qa.json` carried with the AST, the AST's record and validity) and
the knowledge graph's (cat-harness-tools `kg-qa-report.ts`).

The QA report is written in every locale the IG translates its pages into, as
`<locale>/qa.html` (owner, 2026-11-14: *"For this page why is there no
translation?"*). Its own words come from this layer's catalogues
(`translations/<locale>/generated-pages/ig-qa-page.po`, `ig-qa-page-i18n.ts`).
The Publisher's messages come from the Publisher's own translations first:
`ig-publisher-i18n.ts` fetches `Messages_<lang>.properties` from
`org.hl7.fhir.utilities` at exactly the core version the AST recorded and
translates each message by its `message-id`, refusing a Publisher template
whose placeholders differ from the English. What the Publisher lacks comes from
`translations/<locale>/publisher/messages.po`, an agent's machine translation;
`ig-publisher-i18n.ts needs --merge --site <url>` appends what a build lacks,
each entry with an example and links to the rows that print it. Every row is
addressable (`qa.html#qa-m<group>-<row>`), and `assets/fhir-qa/i18n-usage.json`
says, per locale, where each string is used and whether it is the Publisher's or
a machine translation. A translated QA page is never reviewed by a person: it
carries the machine-translation notice, "Show English" shows the Publisher's
original beside each message, and the KG half (cat-harness-tools' English) is
marked `lang="en"` and says it is English only. The page's text direction is
front matter `text_dir`, never `dir`: Jekyll's own `page.dir` is the page's
folder, which drew `dir="/"` on every page.

### Search and the language picker

The folio rail replaces the theme's side menu (`#site-nav` is dropped;
`IG_DROPPED` in `stage-local-ig.ts`), and the IG's top bar carries a search box
over the IG's pages and artefacts (`ig-search.ts`):

- `ig-repo-site.ts compose` writes the index, `assets/ig-search.json` (each
  IG page's title and full text; each artefact's title, id, name, key,
  canonical and description), and the client, `assets/ig-search.js`. The
  index is fetched on the box's first focus, never on page load.
- The box (`form.ig-search`, input `#search-input`) is in the composed
  pages' `.ig-topbar` and the thin pages' `header.iga-top`. It is not
  `.search`, so docs-ui leaves it in the top bar. A build that does not write
  the files (`gen-ig-pages` without `--search`, `StageOptions.search` unset)
  writes no box.
- Any other built page lacking a box (for example an IG API hub page or
  `openapi/index.html`) gets one: `publisher-pages` puts a bar at the top of
  its body (`header.ig-search-top`: the IG's name, the box, the picker's
  slot; `stampSearchBox`, `withSearchBar`). The pass skips `assets/` and runs
  only when the site serves a search index.
- The language picker sits beside the box, in the empty
  `<span data-fa-slot="locale">` that follows it, which docs-ui fills. A site
  with no IG bar keeps the picker in docs-ui's band.
- docs-ui draws the picker from a page's `fa-translation-meta` block, which
  `publisher-pages` writes (cat-harness-tools `lib/translation-meta.ts`) into
  every built page lacking one, from the IG checkout's translation
  declaration; `set-html-lang.ts` reads it afterwards.
- Translated pages (fhir-harness#382). When the IG declares `translations/`
  in `contentTypes.ig.include`, each catalogue
  `translations/<locale>/pagecontent/<page>.po` is injected into its page
  (cat-harness-tools `injectMarkdown`, the segmentation the catalogue was
  extracted with) and staged at `<locale>/<page>.md`, the path the picker
  opens. The page and its translations carry `lang`, `available_locales` and,
  on a translation, `translation_status` and `translation_source`; the thin
  layout writes the picker's block from them, so the picker links each
  language that exists. A span with no translation stays in English. A locale
  is `verified` only when `translations/<locale>/status.json` records a
  sign-off; otherwise `unverified`, and docs-ui shows its notice. Translated
  pages are out of the menu, and relative links climb out of the locale
  folder unless they point at a page translated into the same locale
  (`scripts/ig-page-translations.ts`).

The root parity guard (cat-harness-tools `site-parity.ts`) refuses to publish
a build lacking the search box or language block over a root that had them.

### The opt-out

`gen-ig-pages.ts --full-pages` and `stage-ig-sites.ts --full-pages` build full
pages (`composeIgSite(…, { fullPages: true })`). Pass both or neither.
`--thin` is a no-op; `--thin --full-pages` is refused.

## What this does not replace

**Which AST the pages are drawn from.** An IG repository's site is drawn from
the AST on its cache branch, `cat/fhir-harness/fhir-ast/<package id>`, which a
Publisher run on a runner refreshes; the publish refuses an AST not valid for
the commit. See [`ig-build-pipeline`](ig-build-pipeline.md) §"The AST cache
lifecycle".

The Publisher still runs: validation, dependency resolution and terminology
expansion are its job and are not reproducible from cached output.
