---
name: diff
description: Show per-block content changes with viewer links, changelog, and undo impact analysis
user_invocable: true
---

# Diff — Content Block Change Report

Show what changed at the content-block level, with viewer links and
explanations. This is the primary way the user sees what an agent did.

## When to invoke

- After pushing changes (replaces delivery-summary)
- When user asks "what changed", "diff", "show changes"
- At the end of any editing session

## 1. Server restart command

```bash
git fetch origin <BRANCH> && git switch <BRANCH> && git pull origin <BRANCH> && ./cat-harness-tools/scripts/start-folio-assistant.sh --http
```

## 2. Per-block change report

**This is the most important part.** Every changed content block gets a
clickable viewer link and 1-line explanation.

### Finding changed blocks: use the ChangeSet

```bash
bun run folio-assistant/<content-core>/schemas/changeset.ts \
  --folio <folio graph dir> --base origin/main --head worktree --out /tmp/changeset.json
```

`--folio` is the directory the folio declares for its `folio` graph in
`<slug>.json`, usually `folio/`. The path prefix is wherever this folio
links the platform. Its stderr line is the summary. The JSON
(`folio-changeset/v1`, schema in
the content core's `schemas/changeset.ts`) lists every block that differs,
keyed on its **label**, in reading order.

**Do not use `git diff --name-only` over `.ts` files.** It misses three
things a reviewer needs:
- **A prose-only edit.** The `.md` changed and the `.ts` did not, which is
  the commonest edit in a document folio.
- **A move** between sections. It either vanishes or reads as noise.
- **A rename.** A relabelled block reads as a different block.

The ChangeSet matches blocks by label, follows `renamedFrom`, and reads
section position from the manifests.

It reads the base ref as text and never executes it. An unresolvable base is
an error, not "no changes". Say so rather than reporting an empty diff.

### Viewer link format

```
http://localhost:8080/assistant/#<label>
```

Port from `lean-mcp.config.json` `viewer_port`. Use `assistant/` (not
`viewer/`) since the assistant has changelog, before/after toggle, and
undo built in.

### Presentation

Group by chapter. Markdown table: **Block** (link), **What changed**.

| Block | What changed |
|-------|-------------|
| [def:central-object](http://localhost:8080/assistant/#def:central-object) | Rewrote axiom 3 |
| [prf:main-lemma](http://localhost:8080/assistant/#prf:main-lemma) | Added first SVG render |

### Change categories: the ChangeSet's, verbatim

Report each entry with the ChangeSet's own words, so the report and the
review page never disagree:

- **added** / **removed**: the whole block is new, or gone. A removed block
  reports where it WAS.
- **changed**, with every aspect that applies (one edit can carry several):
  - `prose`: the `.md` narrative changed.
  - `manifest`: the `.ts` changed (uses[], lean ref, kind, metadata), ignoring
    the label.
  - `moved`: a different section, or a different order relative to its
    neighbours. Inserting a block above does **not** move the ones below.
  - `renamed`: the label changed and the block records the old one in
    `renamedFrom`. A relabel WITHOUT `renamedFrom` shows as removed + added,
    and the `id-stable` QA criterion fails it. Point that out; do not
    paper over it.

**Once the branch is pushed, link the review page as well.** The folio's
staging preview publishes this same ChangeSet as `changeset.json` and renders
it at `branches/<slug>/review/`: before and after for every block, the heat
map, and the outline. Give that URL next to the table: a reviewer can open
it without a local server, and it uses the same words because it reads the
same file.

Rendered-asset changes (re-rendered or new SVGs) are not in the ChangeSet.
Report them separately, from `rendered[]` hashes.

## 3. Viewer features for reviewing changes

Point the user to these built-in viewer features:

- **Changelog** (`hist` button on each block): shows git log for that
  block's files, with commit links
- **Before/after toggle** (`prev` button on rendered SVGs): switches
  between current and previous version of the SVG
- **Undo** (`undo` button, collaborator+): shows downstream impact
  analysis before reverting

## 4. GitHub links

- **Commits**: `https://github.com/<owner>/<repo>/commit/<sha>`
- **Branch diff**: `https://github.com/<owner>/<repo>/compare/main...<branch>`

## 5. Undo guidance

When users ask to "undo" or "revert" a block change:

1. The viewer's `undo` button calls `/api/undo-impact` which walks the
   reverse `uses[]` dependency graph
2. It shows direct dependents (blocks that `uses` the target) and
   transitive dependents (further downstream)
3. The user confirms before the revert proceeds via `/api/block/revert`
4. Agents should also use `/api/undo-impact` before reverting
   programmatically — never revert without showing consequences

## API endpoints (for agents)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/diff?id=<paper>&base=main&head=<branch>` | GET | Full paper diff |
| `/api/block-changelog?label=<label>&limit=N` | GET | Git log for a block |
| `/api/content-asset-at/<sha>/<paper>/<ch>/rendered/<file>` | GET | SVG at a specific commit |
| `/api/undo-impact?label=<label>` | GET | Reverse dependency analysis |
| `/api/block/revert` | POST | Revert block .md to a commit |

## Example output

> **Restart & preview:**
> ```bash
> git fetch origin claude/feature-xyz && git switch claude/feature-xyz && git pull origin claude/feature-xyz && ./cat-harness-tools/scripts/start-folio-assistant.sh --http
> ```
>
> ### Changed content blocks
>
> **Chapter 1:**
>
> | Block | What changed |
> |-------|-------------|
> | [def:central-object](http://localhost:8080/assistant/#def:central-object) | Rewrote axiom 3 for clarity |
> | [prop:main-relation](http://localhost:8080/assistant/#prop:main-relation) | Re-rendered SVG (notation update) |
>
> In the viewer, click `hist` on any block to see its full changelog,
> or `prev` on rendered diagrams to compare before/after.
>
> **Commits:**
> - [Rewrite axiom 3](https://github.com/<owner>/<repo>/commit/abc123)
>
> **Full diff:** [main...claude/feature-xyz](https://github.com/<owner>/<repo>/compare/main...claude/feature-xyz)
