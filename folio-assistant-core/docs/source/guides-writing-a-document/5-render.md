```
content/**  →  document_render_md   →  build/<slug>.md
                                    →  document_render_html  →  build/<slug>.html
                                    →  document_render_pdf   →  build/<slug>.pdf
```

**Read the Markdown first.** It is the only file with the whole document in
reading order. Look for sections that came out empty, blocks in an order that
does not read, and the `> **Missing block:**` marker.

HTML needs only `pandoc`. PDF additionally needs one TeX-free engine —
`weasyprint` (recommended), `prince`, or `wkhtmltopdf`:

```sh
apt install pandoc
pip install weasyprint
```

If none is installed, `document_render_pdf` says which are missing and stops.
It does **not** fall back to `latexmk`, even where TeX is present.

Both renderers take a `css` path relative to the repo root. Keep the stylesheet
in the folio, and put the print rules (`@page`, page breaks, running heads) in
the same file as the screen rules, so the two outputs cannot drift.
