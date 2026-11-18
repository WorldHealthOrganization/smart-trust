---
name: visualizer-loading
description: >
  The general strategy for a complex visualizer: the generated page carries
  identity, layout and a pointer, and its bulky or repeated content is fetched
  from the Knowledge Graph in the browser rather than baked into every page.
  What must stay server-side, how to fetch, how to stay equivalent to the
  render being replaced, and how to verify a page whose content is not in its
  HTML. Read before generating any page that shows a KG node's data at length:
  an IG artefact view, a graph viewer, a schema or sidecar view.
---

# Visualizer loading — the page is layout, the graph is fetched

> Skill id: `visualizer-loading` · Package: `ui-core`

## The rule

A generated page for a complex visualizer holds three things:

1. **Identity:** the title, description and front matter that navigation,
   search and a link preview read.
2. **Layout:** headings, tabs and links, arranged by a template
   ([`liquid-templates`](../../../skills/ui/ui-core/liquid-templates.md)).
3. **A pointer:** the KG file the content comes from, resolved by the generator.

The **content** (a sidecar file, a node's properties at length, a table derived
from the graph) is fetched by the browser from the committed KG artefact. It is
never copied into the page.

Each copy is a second answer, free to drift from the first, and copied into a
thousand pages it is most of the site's bytes. [`kg-viewer`](../../../skills/ui/ui-core/kg-viewer.md) is
an instance of the pattern: one page that fetches its sibling graph document
and computes back-links at load.

## What stays server-side

Moving content client-side has costs: a reader without JavaScript loses it, a
search index loses it, and so does the first paint. So these stay in the page:

- **What navigation and search need:** title, description, headings, and the
  link labels a reader scans for.
- **The way to reach the data without JavaScript:** a link to the raw file,
  under `<noscript>` if nowhere else. A view that renders nothing without
  scripts must still say where its content is.
- **Anything short and unique to the page.** A one-line value is not bloat, and
  fetching it costs a request to save a few bytes.

Move a block when it is **large or repeated** and **already a KG file**. A
block that would need a new file published just to be fetched is a design
question for the owner, not a default.

## Where the data is served from — `served: true`

The fetched file is the KG's own, published verbatim. A directory declares
`served: true` in its layer's `<instance>.json`, and `mount-instance-docs`
copies its bytes to `/<instance>/<path>` after Jekyll: no Liquid, no layout, no
index page. Pages under the layer's composed docs then reach it with a
relative path.

**Never copy the file into `docs/` beside the page instead** — a gate flags it
as an unknown file family in a docs directory. A generator whose data is not
served writes no page that would fetch it, and says why.

## How to fetch

- **Relative to the page's own location**, never via a configured base URL, so
  the same bytes work in production and in a staging preview ([`kg-viewer`](../../../skills/ui/ui-core/kg-viewer.md)
  §"The page is generated, not committed").
- **One shared loader per visualizer kind**, published once and referenced by
  every page, never inlined in each page.
- **No dependencies:** no CDN or framework. Same reason as `kg-viewer`: the
  data is this repository's, and a third party in its trust boundary is at
  odds with that.
- **Three states on the page:** loading, loaded, and *could not load*, which
  names the file and the error. A failed fetch that leaves a blank or a
  permanent "Loading…" is the silent-gap defect in another form.

## Stay equivalent to the render you replace

When the page replaces another renderer's page (for example the IG
Publisher's, which every phase must render equivalent to), compute the display
**the same way that renderer does**, and then check it. For example, a page
that shows a file as `JSON.stringify(parsed, null, 2)` differs from the file's
own bytes whenever the file has integer-like keys, which JavaScript orders
first; showing the raw bytes would look right and be wrong.

## Printing and PDFs

A browser prints the page **as it is at that moment**, so fetched content prints
once it has loaded and not before: a PDF taken at `domcontentloaded` holds
"Loading…".

- **Every loader signals completion.** Each counts itself in and out of
  `window.__kgLoads`, and the last one to finish sets `<html data-kg-loaded>`,
  on success or failure. A failed fetch still ends the wait, and its message is
  what prints.
- **Anything that prints or renders a PDF waits for that attribute**, never
  for a fixed delay. That includes a Playwright `page.pdf()`, a PDF build step
  and a screenshot test. A page with no loader never sets it, so a tool that
  waits must first check whether the page loads one of the loader scripts.
- **A reader pressing Ctrl+P** gets the page as loaded. The loaders are fast,
  but a print from a cold cache can still catch "Loading…". That is a
  visible, honest state, not a blank.

## Verify in a browser, not in the HTML

A static check cannot see fetched content: the built HTML holds only
"Loading…". Verification therefore means loading each page in a browser
(Playwright, with the pre-installed Chromium) and comparing what it
**displays** against the reference, as [`rendered-verification`](../../../skills/ui/ui-core/rendered-verification.md)
requires of any rendered artefact.

## Finding what to move

A QA review over a built site:

- **The mechanical half** measures per-page bytes, blocks repeated across
  pages, and blocks matching a committed KG file, and writes a QA sidecar.
- **The agentic half** judges each candidate against §"What stays
  server-side".

Repetition is a measurement, but whether a block may leave the page is a
judgement.

## Do not

- **Bake a KG file's text into a page "for now".** That copy is what the next
  person will have to find and remove.
- **Move navigation or search terms client-side** to save bytes. The saving is
  small and the loss is the page being findable.
- **Add a framework to fetch a JSON file.** `fetch` and `textContent` are the
  whole loader.
