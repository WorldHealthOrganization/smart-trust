**Skill package:** `folio-document-adapter` ·
**Adapter:** `document` ·
**Guide:** [Writing a document](../guides/writing-a-document.html)

Structured prose: health-policy guidance (an L1 guideline, say), a standard, a
report, a handbook, a book chapter. Everything a paper is, minus the formal
layer — and therefore minus the two toolchains that serve it.

- **Source model** — the same tree of typed *blocks* as a paper, restricted to
  the kinds whose content is prose rather than a formal claim: `prose`,
  `example`, `remark`, `algorithm`, `simulator`, `equation`, `diagram`,
  `table`, `figure`, `recommendation`.
- **Rendering** — `document_render_md` assembles the folio into one Markdown
  file; `document_render_html` and `document_render_pdf` take it through
  pandoc. The PDF path uses an HTML engine (weasyprint, prince, wkhtmltopdf)
  and **never** falls back to `latexmk`.
- **Enforcement** — `content_profile_check` rejects a math kind, a `lean`
  field or a `.lean` sibling, and runs on every `content_validate`.

Relevant skill schemas:
[`document-authoring`]({{ '/reference/skills/document-authoring.html' | relative_url }}),
[`document-structure`]({{ '/reference/skills/document-structure.html' | relative_url }}),
[`normative-statements`]({{ '/reference/skills/normative-statements.html' | relative_url }}),
[`document-publishing`]({{ '/reference/skills/document-publishing.html' | relative_url }}).
