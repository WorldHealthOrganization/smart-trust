/* Mermaid configuration for this docs site.

   just-the-docs interpolates this file's contents directly into
   `var config = <here>; mermaid.initialize(config);`
   — see that theme's `_includes/components/mermaid.html` — so this must be a
   bare JavaScript object literal. No `export`, no statements, no semicolon.

   DIAGRAMS ARE ALWAYS LIGHT, IN BOTH COLOUR SCHEMES. The site's stylesheet
   follows the reader's choice; the drawings do not. They render in Mermaid's
   light palette on a white card supplied by `.fa-figure-wrap`
   (site-chrome/assets/css/docs-ui.css), exactly like the BPMN exports beside them,
   which carry their own white backdrop and cannot follow a scheme at all.

   This reverses a decision made an hour earlier in this session, and the
   reversal is the whole point of the comment. Setting `theme: "dark"` did fix
   the ORIGINAL complaint — pale nodes glaring on a dark page — and replaced it
   with a worse one: dark-on-dark, the diagram's own near-black background
   dissolving into the page and the text with it. Owner's call, and it is the
   right one: a schematic is a figure, figures are printed on white, and one
   consistent treatment across BPMN and Mermaid beats two that each look
   correct only in one mode.

   Consequence worth knowing: the palette no longer depends on the reader's
   scheme, so the header's light/dark toggle does not need to re-render
   anything and no longer reloads the page on diagram pages.

   The PARENTHESES are load-bearing. A bare `{ "theme": ... }` at the start of
   a statement parses as a BLOCK, not an object, so eslint rejects it with
   "';' expected" — and eslint lints this file, which is free syntax checking
   worth keeping. `var config = ({ ... });` is exactly as valid as without
   them, so the wrapper costs nothing and buys the linter. */
(({
  "theme": "default",
  "themeVariables": {
    /* Match the card the diagram sits on, so its own backdrop and the
       wrapper's are the same white rather than two near-whites with a seam. */
    "background": "#ffffff"
  },
  /* Long swimlane labels wrap rather than forcing the diagram wider than the
     zoom controls can usefully bring back. */
  "flowchart": { "useMaxWidth": true }
}))
