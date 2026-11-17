---
name: markdown-render-check
---

# Markdown Render Check

## Role

After editing or creating `.md` content blocks, verify the file
renders correctly on GitHub (the canonical view alongside the site's
HTML pipeline). GitHub's renderer is stricter than the build pipelines
about a handful of patterns. This skill catches those before the user
sees them in the browser.

A content type with its own markup (a paper folio's math, for example)
adds checks of its own. The layer that ships that content type holds them
and names this skill from its side.

## When to use

- After editing any `.md` content block.
- As a final pass when running `prepare-merge` or any review skill on
  content blocks.
- After authoring a new `.md` with tables, or lists next to other
  markup.

## Method

### 1. Identify changed `.md` files

```bash
# Files changed vs. the most recent commit
git diff HEAD~1 HEAD --name-only -- '*.md'

# Files changed vs. base branch (when reviewing a PR/branch)
git diff origin/main...HEAD --name-only -- '*.md'
```

### 2. Run the automated grep checks

These patterns are common rendering breaks in any content type. Run each grep against the
changed files; any hit is a likely failure.

| Check | Grep | What breaks |
|-------|------|-------------|
| Tab characters | `grep -nP '\t' file.md` | Inconsistent rendering; replace with spaces. |

### 3. Manual GitHub verification

For each changed `.md`, hand the user the blob URL on the pushed
branch so they can verify rendering in the browser:

```
https://github.com/<owner>/<repo>/blob/<branch>/<path-to>/<file>.md
```

Always link the `.md` (the rendered view), never a `.ts` or other
sibling — default to the `.md` GitHub link.

If the repo is private, `WebFetch` and `raw.githubusercontent.com`
return 404 unless authenticated. The MCP `mcp__github__get_file_contents`
tool returns raw source only, not the rendered HTML. So *automated*
rendered-view inspection isn't possible from this skill — the
author's eyes on the GitHub blob URL are the ground truth.

## Output

Report each check that failed, with file path and line number, then
list the GitHub blob URLs for the user to eyeball.

If all checks pass, say so explicitly and still print the blob URLs
— the user always wants the link list at the end.

## Cross-references

- `md-authoring` — the authoring conventions this skill verifies.
- `html-rendering-qc` — the site-side check: the same blocks as the folio's HTML site renders them.
- A content type's own render checks, named by the layer that ships it.
