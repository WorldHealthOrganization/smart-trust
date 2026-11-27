The pandoc renderers (`document_render_*`) have no citations, no bibliography,
no glossary and no automatic cross-reference numbering: `\cite{…}` passes
through **verbatim**, so on that path write references as Markdown links or
footnotes. The site build (`build-document-site.ts`) renders `\cite{a,b}` as
`[a, b]`, each key linked to its entry with `--bibliography-url`, and
`:defterm` / `:refterm` as a term and its link; it has no cross-reference
numbering either.

Cross-references do work: every labelled block emits an HTML anchor, so
`[see the scope statement](#rec:scope)` resolves in both HTML and PDF. Use the
block's `label`, never a heading-derived anchor, which changes whenever the
title is edited.

---
