---
$schema: folio-memory/v1
id: document-render-path-takes-no-tex
label: stable
summary: "the document render path takes no TeX"
createdAt: 2026-09-19
roles:
  - code-reviewer
references:
  - kind: agent
    id: platform-boundary-guard
---
`pipeline/render-markdown.ts` assembles the folio to one Markdown
file; `document_render_{md,html,pdf}` take it through pandoc, the PDF via
weasyprint/prince/wkhtmltopdf. It **never** falls back to `latexmk`,
deliberately — a PDF that silently came out of LaTeX would misreport what the
folio needs to build, and the next person on a clean machine pays for that.
Registered for **both** content types, because it is the render that works
while drafting on a machine with no TeX.
