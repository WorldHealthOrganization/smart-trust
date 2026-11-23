---
# folio-assistant-mw5z
$schema: bean/1.0.0
title: who-iris's two AUTHORED docs pages render as raw markdown and nothing links them
status: completed
type: bug
priority: normal
created_at: 2026-10-04T06:25:33Z
updated_at: 2026-10-10T15:44:07Z
parent: folio-assistant-0lmb
---


Found by running bean `06e3`'s who-iris exercise end to end, 2026-10-04 (PR #2049).

## The declaration states the rule that is now broken

`who-iris.json`, on the `who-iris-catalogue` entry:

> *"HTML rather than markdown because who-iris declares no `composed` directory
> -- its docs are MOUNTED after Jekyll, so a .md here would be copied verbatim
> and never rendered."*

Bean `qsx4` (owner, 2026-09-30: *"who voices style guide is derivative KG
content from who-iris, merge content into subgraph. including docs."*) then
moved `who-style-guide/README.md` → `who-iris/docs/style-guide.md` and
`who-style-guide/AGENTS.md` → `who-iris/docs/style-guide-agents.md` by `git mv`.

**These are the only two pages in `who-iris/docs/` a person actually wrote** —
the other four are generator output (`gen-iris-pages.ts` ×3,
`subgraph-readmes.ts` ×1; see bean `7te5`).

## Measured in a LOCAL SITE BUILD, not inferred

- `/docs/who-iris/style-guide.md` → **200**, served as raw markdown. Screenshot
  shows `#` and `**` markers, unrendered pipe tables, and `â€"` where em-dashes
  were.
- `/docs/who-iris/style-guide.html` → **404**. No rendered page exists at any
  route.
- `docs/who-iris/index.html` — who-iris's generated docs LANDING page, with a
  section headed **"Pages"** — lists exactly two: `ingestion-notes` and
  `kg-to-portal`. Its `PAGES.docs.fixed` in `gen-iris-pages.ts:269` predates
  `qsx4` and knows nothing about the other two.
- Whole-site `grep -rho 'href="[^"]*style-guide[^"]*"'` over **4155** built
  pages returns **2 + 2 GitHub blob links and nothing else** — both from the
  docs-auto `index/docs` page, pointing at `github.com/…/blob/main/…`.

So the derived index is the **only** thing that reaches who-iris's authored
documentation, and it reaches it as SOURCE ON A FORGE rather than as a page.

That is the inverse of `06e3` §2's worry. §2 forbids shipping an index with no
authored prose around it; here the prose exists and only the index can find it.

## The three options, and none is obviously right

1. **Render them.** who-iris declares no `composed` directory, so this means
   either declaring one or pre-rendering the two pages the way the other three
   are. The second keeps the mount's one rule (*everything here is already
   HTML*) and costs a generator pass over authored prose.
2. **Move them** out of a mounted directory into one Jekyll builds.
3. **Leave them and say so** — but then `docs/who-iris/index.html`'s "Pages"
   section is wrong by two, which is the `dh4f` shape: a reader told a directory
   holds two pages when it holds five.

Option 3's second clause is required whichever is chosen: the landing page must
stop claiming a complete list it does not have.

## Done when

- [x] who-iris's two authored pages are reachable as RENDERED pages, or the
      decision not to render them is recorded with its reason
- [x] `docs/who-iris/index.html`'s "Pages" section no longer under-reports its
      own directory
- [x] at least one page links them — measured by grepping the BUILT site, not
      the source


## Summary of Changes

Closed 2026-10-10 by the bean-backlog drain (lane C) on evidence: the fix
already landed in `litlfred/who-iris`, the instance's own repository after the
separation (checked at `ffdc049`). Nothing was changed in this repository.

- [x] **Rendered.** Option 1 (pre-render, keeping the mount's "everything here
      is already HTML" rule): `scripts/gen-iris-pages.ts` renders each authored
      `docs/*.md` with GFM to `docs/style-guide.html` and
      `docs/style-guide-agents.html`; sibling links point at the renderings.
- [x] **Landing page no longer under-reports.** The "Pages" list is derived by
      `authoredDocs(dir)` (every `.md` but `README.md` and front-matter
      pages) instead of the hand-kept `PAGES.docs.fixed`; its doc comment cites
      this bean.
- [x] **Linked, measured in generated output.** `grep -o 'href="[^"]*style-guide[^"]*"'`
      over who-iris `docs/` finds `index.html` → both pages and the two pages
      linking each other. (`docs/` is committed generator output, guarded by
      `iris:pages:check`.)



2026-10-09: item 2 done — https://github.com/litlfred/who-iris/pull/20 merged (32c5909): the landing page derives its authored pages (`authoredDocs`) and lists style-guide.md and style-guide-agents.md as markdown source. Items 1 and 3 wait on the owner's choice of option 1/2/3 (render, move, or leave-and-say). (session https://claude.ai/code/session_01BJNRo4kh8U15HZVFDhYNJL)


## 2026-10-09: owner chose option 1
Owner: "go", on the recommendation put to them: option 1 — pre-render the two authored pages in who-iris's generator, as its three generated docs pages are, keeping the mount's rule that everything in docs/ is already HTML. **Claimed** by session https://claude.ai/code/session_01BJNRo4kh8U15HZVFDhYNJL (branch claude/lucid-wright-fc2ctd on litlfred/who-iris).


## Closed 2026-10-09 (session https://claude.ai/code/session_01BJNRo4kh8U15HZVFDhYNJL)
Option 1 landed: https://github.com/litlfred/who-iris/pull/21 merged (d43634e). `renderAuthored()` (remark + GFM, declared in who-iris's own package.json) writes `style-guide.html`, `style-guide-agents.html` and `oxigraph-pipeline-requirements.html`; their names are generator-owned (derived), so `--check` and the orphan sweep cover them. Item 3: the docs mount copies `docs/` verbatim, so the generated `docs/index.html` IS the built landing page — it links all three renderings (and no `.md`). Checked: `--check` 49 pages current, who-iris tests 64 pass; rendered style guide has 2 tables and clean UTF-8 em-dashes.
Not verified: the pages' relative links into `../library/`, `../glossary/`, `../skills/voices/` are kept as authored; whether they resolve on the mounted site is unmeasured.



## 2026-10-09 — fixed in two halves, waiting on the pin (session https://claude.ai/code/session_017fFnGmbJcfqqrHXz9oqxdG)

- **cat-harness** (branch `claude/mount-render-md`, lands after pxtk and the docs-source move): `mount-instance-docs` renders each mounted `x.md` that has no `x.html` (`renderMountedMarkdown`, sharing `publish-instance-files`' renderer). Links are resolved for where the page is PUBLISHED: one leaving the mounted directory, or naming a directory with no page, becomes `https://github.com/<repository>/{blob,tree}/HEAD/<path>` from the declaration's `repository`; one climbing out of the instance fails the mount. Front-matter (Jekyll) pages are left alone.
- **who-iris** (`14ff17d`): the docs landing's "Pages" list is read off `docs/*.md` (option 3's clause: it no longer under-reports); two links that still climbed to the monorepo root are fixed.
- Measured on a local build of who-iris's site (the Routine's steps 3–7, isolated tree): `/docs/who-iris/style-guide.html` renders (screenshot), all four authored pages are linked from the landing, and a whole-site link check finds **0** unresolved hrefs.
- Remaining: merge both, then move who-iris's cat-harness pin (owner consent, H8) and publish.

## Completed 2026-10-09 — measured on the LIVE site (session https://claude.ai/code/session_017fFnGmbJcfqqrHXz9oqxdG)

Two sessions worked this bean the same day; both halves landed and coexist:
- the owner ruled **option 1** in session_01BJNRo4kh8U15HZVFDhYNJL: who-iris pre-renders its authored pages in `gen-iris-pages` (litlfred/who-iris #20, #21);
- litlfred/who-iris #22 made those pages' links to files outside `docs/` cite the repository (6 had been published dead) and fixed two links that climbed to the monorepo root;
- litlfred/cat-harness #65 renders any OTHER mounted `.md` (an instance without a generator); it never overwrites an existing `.html`, so for who-iris the generator's pages win.

Done-when, on gh-pages `9255288` (who-iris `2e127e7`, Pages run https://github.com/litlfred/who-iris/actions/runs/37977615950 — success):
- [x] the authored pages are reachable as RENDERED pages: `docs/who-iris/style-guide.html`, `style-guide-agents.html`, `oxigraph-pipeline-requirements.html` are on gh-pages (screenshot of the style guide checked on the local build);
- [x] `docs/who-iris/index.html`'s Pages section lists the authored pages;
- [x] linked from a page, measured on the BUILT site: the docs landing links each, and a whole-site link check over 1,420 files finds 0 unresolved hrefs.
