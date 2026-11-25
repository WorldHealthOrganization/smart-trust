# Catalogue visualiser — as-is intent

**Covers:** the `catalogue` visualiser that `who-iris/who-iris.json` declares
in `visualisers` (title "Catalogue", renderedBy `iris-pages`, covering the
read-only `who-iris-catalogue` directory, `path: catalogue/`), served at
`<base>/who-iris/catalogue/`. `who-iris/scripts/gen-iris-pages.ts` generates
the page from `who-iris/catalogue/nodes/`; its only script is the node table's
filter and sort.

**Who it is for:** a maintainer of the who-iris instance, or a reviewer of its
catalogue. The replica pages answer "what does IRIS look like"; this page
answers "what does this catalogue know, and what does it record that it does
not know", and says so in its lede.

**What they need to do:**
- see how many catalogue nodes are **materialized** (bytes held here),
  **referenced** (upstream only) or **unknown**, against the size of upstream
  IRIS
- see what the licence and retention gates say about the held bitstreams, with
  `unknown` kept apart from `permitted` ("collapsing the two would turn an open
  question into a clearance")
- scan every node, with its state, kind, title, catalogue path, library id
  ("held as"), record and bitstream count

**What it shows:** the site layout (top band, sidebar), then the `h1` "The
catalogue, as a graph", the lede, the "gap is the point, not a backlog" note
(node count against upstream items and files), three tables (states, gates,
every node) and a "Generated from" note. "Nothing is greyed out": every row
states its own state.

## Findings

`as-is.html` draws the page as built at who-iris `ced6dff`, at 1280×800 and
390×844; `checks/` holds the screenshots and the check report. Each finding
was raised against the earlier replica-styled page and is now fixed.

1. **Horizontal scroll at phone width.** At 390 px the "Every node" table
   pushed the page to 752 px, so "held as", "record" and "bitstreams" started
   off-screen. Now only the node table scrolls, inside its box.
2. **Menu and breadcrumb looked like links and were not.** The page now wears
   the site layout, not the replica's chrome.
3. **No row led anywhere.** Collection and item titles now link their replica
   pages. "Held as" links the library viewer only where the site builds one;
   elsewhere the id is text rather than a dead link.
4. **The node list could not be filtered or sorted,** and held rows came
   last. Held rows now come first; a state select and a title-or-id search sit
   above the table, with "n of N shown", and every header is a sort button.
   The controls stay hidden without scripts.
5. **Replica chrome filled the first screen before the `h1`.** Gone with
   finding 2.
6. **Gate counts had no label** and read as one run ("PERMITTED 3 UNKNOWN 3").
   Each count is now inside its pill and labelled ("permitted: 3 of 6").
