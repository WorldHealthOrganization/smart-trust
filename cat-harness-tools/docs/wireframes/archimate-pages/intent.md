# ArchiMate model page (archimate-pages): as-is intent

**Covers:** `renderedBy:archimate-pages`. That is every declared visualiser whose `renderedBy` is the Tool `archimate-pages`: today `dth-hrh/archimate`, `dpi-h-ra/archimate`, `dth-phc/archimate` and `dth-sfp/archimate`, and any layer that later declares one. This is one shared wireframe (owner, 2026-11-17, option b). The writer draws the same page for every layer, so it is drawn once here, beside the writer (`archimate/scripts/gen-archimate-pages.ts`). A layer that wants its own drawing names its route key in its own `wireframes/index.json`, and that wireframe wins (`check:wireframes`).

**The page drawn:** the MODEL page that the writer puts at `<site>/en/<harness>/<visualiser>/<model>/`. A layer is usually an overlay on the reference architecture: its elements are copies of smart-ra or another DTH, plus its own. The route's own index (`<site>/en/<harness>/<visualiser>/`) is a single list of the layer's models, one line each ("DTH-SFP overlay 0.1.0-draft.1 0.1.0-draft.1 — 4 view(s), 64 element(s)"). It is too thin to need a drawing of its own. The view, element, relationship and metamodel pages under the model page are not drawn here.

**Who it is for:** a reader of a DTH or a reference architecture who wants to know what the layer's ArchiMate model holds. That means which views it draws and which elements it uses, layer by layer. From there the reader opens a view (the drawn figure) or an element (its relationships, and the node it was copied from).

**What they need to do:**
- see the model's size (views, elements, relationships) and what it is an overlay of
- open a view, which is how most readers arrive from a figure in the document
- find an element by ArchiMate layer and type, and open it
- go to the metamodel in use, or back to the list of models
- fetch the model as data (JSON-LD, the Archi file)

## Observed on main (777d5c7f)

This was not drawn from source alone. The writer was run at 777d5c7f (`gen-archimate-pages.ts --instance <dth-sfp at main> --out <site>`; 204 pages, 8 view drawings). The model page was served over HTTP and rendered at 1280×800 and 390×844 in Chromium, after `archimate.js` filled `.am-body`. The candidate draws what rendered there.

1. **Up link and title:** "← ArchiMate models", then the model's title as `h1`. The subtitle reads "Metamodel in use: the element types and relationships this model uses, derived from it", and only its first words are a link.
2. **Summary and contents card:** "4 views · 64 elements · 134 relationships", then the model's own description, which for an overlay explains its `overlay:base` / `overlay:dth` / `overlay:owner` tags. A "CONTENTS" card (`nav.igi-contents`) links Views and each ArchiMate layer, with a count badge. At 1280 px the card sits right of the summary. At 390 px it comes first, above the summary.
3. **Views:** a three-column list of view names, each a link. At 390 px it is one column.
4. **One section per ArchiMate layer** (Strategy 8, Business 18, Application 20, Motivation 18 for dth-sfp). Each `h2` has the layer's colour as a left bar. Each element is a link to its page, followed by its type in plain text ("Business Role"). An element that no view draws adds "· in no view". Columns: three at 1280 px, one at 390 px.
5. **Footer:** "This node as JSON-LD · The Archi model file".

The page carries `<meta name="folio-navbar" content="linked">`. On a built folio site the shared navbar is added by the chrome, which the shared `navbar` wireframe in cat-harness covers. It is not drawn here. A standalone `--out` build, as rendered here, shows no navbar.

## Findings

1. **An overlay's copies are not told apart from its own elements on this page.** The description explains three overlay tags, but no list entry shows which tag an element has. Only the element's own page says "Reused from …". A reader cannot see from here what the DTH added to smart-ra.
2. **The type label runs on as plain text after the link.** "Pharmacovigilance Capability" reads as one name, and in three columns a long type wraps under the next name ("Application / Component"). A screen reader reads the name and the type as one phrase.
3. **Long lists on a phone.** At 390 px the four layer sections for dth-sfp make the page about 3,150 px tall, and the contents card is the only way to jump. The card scrolls away with the page and does not stay in view.
4. **"in no view" is easy to miss.** It is the same grey text as the type, so an orphan element does not stand out.
5. **Views are listed by name only.** There is no thumbnail and no "drawn in the document as Fig. N" here. The view page says that, so the reader learns which view is a document figure only after opening it.
