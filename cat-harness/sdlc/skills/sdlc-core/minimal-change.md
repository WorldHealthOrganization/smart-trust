---
name: minimal-change
description: >
  Three rules for any edit to a repository: make the smallest change that does
  the job and keep the diff minimal; read the repository's code-style files
  before writing code; and write Markdown without HTML tags. Use before
  writing a change and again when reviewing its diff.
user_invocable: true
---

# Minimal change

## 1. The smallest change that does the job

Every changed line is a cost to the reviewer. Reach the goal with the fewest
lines changed.

- Keep existing whitespace, indentation, line order and names as they are,
  unless changing them is the point of the change.
- Do not reformat, reorder or rename code you are passing through.
- A diff should show the change and only the change. When one is asked for,
  give a minimal unified diff.
- Small is not the same as narrow. When the same defect has siblings, fix
  them too: see [`generalise-the-fix`](generalise-the-fix.md). This rule is
  against unrelated churn, not against a complete fix.

## 2. Read the code-style files first

Before writing code, look for the files that set this repository's style and
follow them: `AGENTS.md` (and the `CLAUDE.md`, `GEMINI.md` and
`.github/copilot-instructions.md` that point to it), any `codestyle.md`,
`code_style.*`, `CONTRIBUTING.md`, `.editorconfig`, and the linter and
formatter configs. Where they disagree with your habit, they win.

## 3. No HTML tags in Markdown

Write Markdown with Markdown: headings, lists, tables, links and code
fences, not `<br>`, `<b>`, `<div>`, `<table>` or `<details>`. HTML in
Markdown renders differently from one renderer to the next and hides
content from tools that read the source.

HTML comments are not tags and are allowed. Generators use them as region
markers (for example `<!-- bean-notes:begin -->`), and removing them breaks
the generator.
