---
name: md-authoring
---

# Markdown Authoring Conventions

## Role

Enforce authoring conventions for `.md` content files so they render
correctly in the HTML viewer (`mdToHtml`) and in every other pipeline the
content type renders through. Flag violations before they reach the viewer.

## Rendering pipeline

Content `.md` files are rendered by the HTML viewer (`ui/app.js` →
`mdToHtml()`, custom regex for markdown → HTML) and by whatever further
pipelines the folio's content type adds. These conventions are the ones every
content type shares.

**A content type with math or a TeX pipeline adds its own rules.** The layer
shipping that content type supplies its math-markdown skill covering display
and inline math, KaTeX limits, math in titles and table cells, and what the
LaTeX pipeline does with tables.

## Rules

### 1. Bold and italic may span lines

The HTML renderer supports `**bold**` and `*italic*` spanning
multiple lines. This is the standard pattern for wrapped prose:

```md
the **minimum data
set** (MDS).
```

### 2. `\cite{key}` renders as `[key]` in HTML

The HTML viewer converts `\cite{key}` to a plain bracketed `[key]`, with no
bibliography lookup and no hyperlink. A TeX pipeline, where the content type
has one, handles it natively.

### 3. Use `--` for en-dash, `---` for em-dash

The HTML renderer converts `--` → `–` and `---` → `—`.
**Do not** use Unicode en/em dash characters directly — they work
but are less portable.

### 4. Tables use GFM pipe syntax

```md
| Header 1 | Header 2 |
|----------|----------|
| cell     | cell     |
```

The HTML viewer renders them as `<table class="md-table">` via regex.

**Alignment**: Use `:` in the separator row to control column
alignment:

```md
| Left   | Center | Right |
|:-------|:------:|------:|
| text   | text   | text  |
```

**Inline code in table cells**: use backticks for identifiers:

```md
| Label | Declaration                  |
|-------|------------------------------|
| def:x | `Project.Namespace.some_decl`|
```

**Rules for table content:**

- **Do not** nest tables.
- **Always** include the separator row (`|---|---|`).
- Keep cell content concise — wide tables overflow in PDF.

### 5. Headings use `##` and `###`

In `.md` content files, `## Heading` renders as `<h3>` and
`### Heading` as `<h4>`. `# Heading` is reserved for chapter titles.

### 6. Lists

Ordered (`1. item`) and unordered (`- item`) lists are supported.
Nested lists are not yet supported by `mdToHtml`.

### 7. Cross-references

Use `[text](#label)` for cross-references. These become clickable
`<a class="uref">` links with hover preview in the viewer.

### 8. Inline code

Use backticks for inline code: `` `code` ``. Rendered with
monospace font and subtle background.

### 9. Glossary terms (`:defterm` / `:refterm`)

Defined terms are wrapped via `remark-directive` syntax — never plain
text or `**bold**` once the slug is registered in any block's
`defines: [...]`:

| Form | Use when | Example |
|------|----------|---------|
| `:defterm[Visible]{#slug}` | Canonical defining occurrence (exactly one block per slug) | `:defterm[care plan]{#care-plan}` |
| `:defterm[term]` | Same, when slug = sluggified label | `:defterm[encounter]` |
| `:refterm[Visible]{#slug}` | Every other mention, anywhere in the project | `:refterm[care plan]{#care-plan}` |
| `:refterm[term]` | Short form when slug = sluggified label | `:refterm[encounter]` |

Rendering: viewer → dotted underline; PDF → plain text with invisible
hyperlink target. The validator (`bun run validate <paper>`) enforces
declaration, resolution, and uniqueness; the codemod
(`bun run pipeline/codemod-refterm.ts`) backfills `:refterm[…]` from
bare-text mentions of known slugs (see the content layer's glossary-build skill).

## QC checklist

When reviewing `.md` content, check:

- [ ] `\cite{}` keys match entries in `content/schema/references.ts`
- [ ] Cross-refs `[text](#label)` point to valid labels
- [ ] Bold/italic delimiters are properly closed
- [ ] Tables have separator row (`|---|---|`)
- [ ] Defined terms (slugs in any block's `defines[]`) wrapped in
      `:defterm` / `:refterm` directives, not plain text or `\emph{}`
- [ ] The content type's own markdown checklist, where its layer supplies one
