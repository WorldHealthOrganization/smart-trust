The IG Publisher emits **three serialisations of every resource** — JSON, XML
and Turtle — plus HTML per resource page.

Only the JSON is taken, wrapped in JSON-LD and JSON Schema; RDF, where needed,
is projected from the JSON-LD. The site neither renders nor links a resource's
XML or Turtle copy.

**A representation that arrives and is not taken is recorded as a refusal.**

The Publisher's per-page HTML is a rendering, not a serialisation, and is not
used: it has no front matter, so the navbar, language bar, QA badges and
translation surface cannot reach it. IG pages are rendered as folio pages
instead (see
[`ig-render-jekyll`]({{ '/reference/skill-instructions/ig-render-jekyll.html' | relative_url }})).
