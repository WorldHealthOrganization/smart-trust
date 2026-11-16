---
name: block-change-summary
description: >-
  Post-delivery content block change summary for a folio edit-set: extract
  changed block labels across `.md`, `.ts` and content-type sibling files,
  present a per-chapter table with `.md`-first GitHub blob links, modified
  sibling links, local viewer anchors, and change categories. Refines
  `delivery-summary` for content folios.
---

# Block Change Summary

> Skill id: `block-change-summary` · Package: `content-lifecycle-ext` ·
> Refines `delivery-summary` (opt-in `cat-harness.sdlc`) for content folios.

When delivering changes in a content folio (alongside the server restart
command, commit/diff links, and staging links from
`delivery-summary`),
list every content block that changed, with a clickable link and a short
explanation of what changed.

## 1. How to find changed blocks

Extract labels from changed content blocks: the `.ts` manifest, the `.md`
content and whatever sibling file the content type adds (a `.md`-only edit is
still a block change). Add the content type's sibling extensions to the
pathspec; a paper folio, for example, adds `'content/**/*.lean'`:

```bash
# Collect changed content files (any sibling triggers the block)
changed=$(git diff origin/main..HEAD --name-only -- \
  'content/**/*.ts' 'content/**/*.md' \
  | grep -v '/rendered/' | grep -v 'schema/' | grep -v 'pipeline/')

# For each, resolve to the sibling .ts and pull the label
for f in $changed; do
  ts="${f%.*}.ts"
  [ -f "$ts" ] || continue
  label=$(grep -oP "label:\s*['\"]\\K[^'\"]+" "$ts" 2>/dev/null || echo "")
  [ -n "$label" ] && echo "$ts|$label"
done | sort -u
```

## 2. Link format

The viewer runs on `localhost:<viewer_port>` (from the layer's viewer
configuration). Each block links via its label anchor:

```
http://localhost:8080/assistant/#<label>
```

## 3. Presentation format

Group by chapter. Use a markdown table with columns: **Block** (a GitHub blob
link to the block's `.md` file, always), **Siblings changed** (blob links to
the `.ts` or the content type's other siblings, only those that **also
changed**), **What changed** (1-line description). Never make a sibling the
primary link: readers want narrative first.

| Block | Siblings changed | What changed |
|-------|------------------|-------------|
| [def:central-object](https://github.com/<owner>/<repo>/blob/<branch>/content/.../central-object.md) | [ts](https://github.com/<owner>/<repo>/blob/<branch>/content/.../central-object.ts) | Updated notation |
| [sec:scope](https://github.com/<owner>/<repo>/blob/<branch>/content/.../scope.md) | — | Added first SVG render |

Viewer anchor links (`http://localhost:8080/assistant/#<label>`) may be added
as a row-end column when the folio-assistant is running locally; the `.md`
blob URL is the canonical reference.

## 4. GitHub blob links — ALWAYS PROVIDE

Every created or modified file (`.md`, `.ts`, siblings, config files) gets a
blob URL on the pushed branch:

```
https://github.com/<owner>/<repo>/blob/<branch>/<relative-path>
```

Never report "created/edited `foo.md`" without it. If the branch is not yet
pushed, say so; do not give a URL that will 404.

## 5. Categorize changes

Explain the nature of changes — don't just list files. Common categories:
- **Narrative edit**: `.md` content was modified
- **Re-rendered SVG**: notation/style change caused SVG hash update
- **New SVG render**: block got its first rendered SVG
- **Structural change**: label, uses[], a sibling reference, or kind changed
- **New block**: entirely new content block added

## Example block table in a delivery summary

Combined with `delivery-summary` and `staging-review`:

> ### Changed content blocks
>
> **Chapter 1:**
>
> | Block | Siblings changed | What changed |
> |-------|------------------|-------------|
> | [def:central-object](https://github.com/<owner>/<repo>/blob/claude/feature-xyz/content/.../central-object.md) | [ts](https://github.com/<owner>/<repo>/blob/claude/feature-xyz/content/.../central-object.ts) | Rewrote point 3 for clarity |
> | [rule:main-criterion](https://github.com/<owner>/<repo>/blob/claude/feature-xyz/content/.../main-criterion.md) | — | Re-rendered SVG (notation update) |
> | [sec:scope](https://github.com/<owner>/<repo>/blob/claude/feature-xyz/content/.../scope.md) | — | Added first SVG render |
