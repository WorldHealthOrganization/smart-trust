---
# folio-assistant-z1x6
$schema: bean/1.0.0
title: 'PAGE WEIGHT: post-build HTML minification, and nav_exclude for the generated reference sections (#1885)'
status: completed
type: task
priority: normal
created_at: 2026-10-02T16:51:57Z
updated_at: 2026-10-07T17:15:00Z
parent: folio-assistant-o3xy
---

Owner-approved, 2026-10-02. Three changes were proposed; two are mine and one stands down.

**Brief — what and why.** The published gh-pages tree holds 2481 MiB of HTML (measured below). About 9-10% of every page is HTML comments: maintainer prose in `head_custom.html` and generator banners, serialised into every one of 14,543 pages. A decision memo proposed hand-converting 30 comments in one include to Liquid `{% comment %}` blocks ("Option 6"). That is subsumed by minifying the BUILT tree, which the memo closed on the wrong ground - it ruled out a Jekyll *plugin* (correct: CI builds with `actions/jekyll-build-pages@v1`, a gem allow-list) and concluded minification was unavailable. But both site workflows ALREADY post-process `_site`: `strip-preview-seo.ts`, `set-html-lang.ts`, `rail-standalone-pages.ts`. A minify pass slots in beside them with no plugin and no theme un-pinning, and it reaches EVERY comment on every page rather than one include's thirty.

**What I already know, with provenance.** gh-pages at 752e3a7 (remote tip, fetched in this container): 14,543 HTML files, 2481.1 MiB, via `git ls-tree -r -l origin/gh-pages`. Prior memo measured -10.0% from comments and -10.7% with inter-tag whitespace on three sampled pages - so the whitespace half is worth ~0.7 points against comments' 10, which inverts the risk/reward and is why the whitespace rule here is conservative rather than `>\s+<`.

**How, and what would falsify it.** A single-pass tokenizer that protects `<pre>`, `<code>`, `<textarea>`, `<script>`, `<style>`, `<title>` verbatim; drops whitespace-only inter-tag runs only where the adjacent element cannot render them, and otherwise collapses to ONE space (always safe outside pre, since CSS collapses a run to one space). Falsified if: a comment turns out to be read at runtime (audited by enumerating every distinct comment in the built tree, not by assumption); if `first-paint-scheme.e2e.ts` goes red, which is where a head-order or style-content defect would surface and nowhere else; or if re-derived savings come in materially under the memo's.

**Not doing.** (a) Option 6 itself - subsumed. (b) Dropping the duplicated harness navbar: bean `gp2f` / #1886 phase C explicitly owns it, at the navbar session's request, and #1804/#1805 are open on `gen-navbar-include.ts`/`lib/navbar.ts`. Stood down; I settle its open rendered question and hand the answer over instead.


## Scope revised, 2026-10-02 — two of three items stood down

The coordinator dispatched this without the platform-refactor collision review
that PR #1886 had just landed as a STRICT rule
(`skills/sdlc/sdlc-core/coordinate.md` §"Before a platform refactor"). I ran it
and it found two of the three items already claimed:

| item | verdict | why |
|---|---|---|
| A — post-build minification | **mine, done** | #1886's bean `gp2f` claims no phase over comments or whitespace; no open PR touches `minify-site.ts` or the publish-time region of either workflow |
| B — drop the duplicated harness navbar (~60 MiB) | **stood down** | `gp2f` phase C: *"Harness bar and footer. Emitted once and made responsive with CSS"* — recorded there as *"owned here, at the navbar session's request"*, waiting on #1804, #1805, #1808, #1819. #1804 edits `gen-navbar-include.ts` and #1805 edits `lib/navbar.ts`, which are the files the change needs |
| C — `nav_exclude` the generated reference sections | **stood down, measured and offered** | aimed at the same bytes as `gp2f` phase D, and it reaches `check:nav-names`, which #1804 is changing. Measurements handed over rather than dropped |

Collision review, 2026-10-02, over all 27 open PRs (REST `/pulls/<n>/files`,
every page, not just the first 100):

| PR | file shared with this work | verdict |
|---|---|---|
| #1875 | `docs-site.yml`, `feature-staging.yml` | no conflict — a one-line `# bpmn:` path comment on line 1 of each |
| #1801 | `docs-site.yml`, `feature-staging.yml` | no conflict — adds QA-evidence steps at lines ~134/~173 and a hunk over original lines 606–622; this step lands at ~650 and ~1131 |
| #1816 | `feature-staging.yml` | no conflict — inserts an AST render step before `Build Jekyll site` (line ~563) |
| #1766 | `feature-staging.yml`, `gen-skill-docs.ts` | no conflict for A; it was the collision for C, which is stood down |
| #1804 | `gen-navbar-include.ts` | **blocks B** |
| #1805 | `lib/navbar.ts` | **blocks B** |

## Measured — all numbers re-derived here, on `origin/gh-pages` 752e3a7

Commands: `git ls-tree -r -l origin/gh-pages` for the inventory,
`git cat-file blob` per page streamed through `minifyHtml`, `zlib.gzipSync`
for transfer.

| subject | HTML | comments | + safe whitespace | naive `>\s+<` | gzip |
|---|---|---|---|---|---|
| main site, 4711 pages | 614.1 MiB | −57.7 MiB (9.39 %) | **−63.3 MiB (10.30 %)** | −63.9 MiB (10.41 %) | **−21.9 %** |
| preview `agy-wnhh-…`, 2024 pages | 417.5 MiB | −38.1 MiB (9.13 %) | −41.6 MiB (9.96 %) | −42.0 MiB (10.06 %) | −23.5 % |

**The safe rule gets 99.1 % of the naive rule's saving.** That is the whole
argument for the tokenizer: `>\s+<` → `><` turns `<a>one</a> <a>two</a>` into
"onetwo", and it is worth 0.6 MiB of 63.9.

## Verified

- `bun test cat-harness/scripts/tests/minify-site.test.ts` — 32 pass.
- 546 real published pages (`reference/`, `processes/`, `uml/`, `guides/`,
  `index.html`), written in place: **verbatim regions changed on 0, tag
  sequence changed on 0, rendered text changed on 0**. Second run: 0 files
  changed — idempotent on the real corpus, not only on fixtures.
- Real DOM, pinned Chromium, JS off, **1280 px and 390 px**, the 25 most
  code-dense of those pages (1060 → 230 code blocks each): `innerText`,
  element sequence, `<pre>` text and first-paint background all identical.
- `first-paint-scheme.e2e.ts` — 14/14 pass (baseline; it serves the SOURCE
  tree, so it does not itself see minified bytes).
- So the question it exists for was asked of the minified bytes directly: all
  8 generated dashboards served through a minifying route, JS off, light-
  preferring browser — **all 8 still first-paint `rgb(13, 13, 13)`**.
- Across all 4711 published main-site pages: every `<script>`, `<style>` and
  `<link>` element byte-identical; the `fa-first-paint` markers survive on all
  2383 pages that carry them; the snippet's position relative to the
  stylesheets moved on **0**. The only change inside that block is the
  newlines between its `<script>` and `<style>`, which `<head>` never renders.

## Offered to #1886 phase D (measured, NOT implemented)

Published main site, 4711 pages, 2383 nav-bearing, nav total **166.77 MiB**,
mean **71.7 KB/page**. Per expandable top-level section:

| section | cost across the published main site | per page |
|---|---|---|
| Skill instructions (299 children) | **107.16 MiB** | 46.05 KB |
| Skill schema reference (23) | 7.30 MiB | 3.13 KB |
| UML overview | 4.45 MiB | 1.91 KB |
| Glossary | 3.33 MiB | 1.43 KB |
| Authoring guides | 2.57 MiB | 1.10 KB |
| Architecture | 2.51 MiB | 1.08 KB |

`nav_exclude: true` on the first two is **114.46 MiB, 68.6 % of the whole
published nav**, from one line in `gen-skill-docs.ts` (beside line 1090's
`parent: Skill instructions`) and one in `gen-schema-docs.ts`. Three
generators already emit the key: `compose-docs.ts:340`,
`gen-processes-viz.ts:492,717`, `gen-uml-overview.ts:612`. Reachability
holds without JavaScript: `reference/skill-instructions/` has 300 pages and
its `index.md` carries 301 links. Cost: those 299 lose their left-rail entry.

## Issue

#1890.


## Landed, 2026-10-02

Commit `d4766eebdbd` on `claude/wizardly-galileo-feyypz`, inside draft PR
**#1889** — that branch already had an open PR and GitHub allows one per head
branch, so this joined it rather than getting its own. Issue **#1890**.
Write-up: https://github.com/litlfred/folio-assistant/pull/1889#issuecomment-5957830080
Coordination comment to #1886 carrying the phase-C and phase-D measurements:
https://github.com/litlfred/folio-assistant/pull/1886#issuecomment-5957838285

Nine files, staged by explicit path (three agents share this working tree):
`minify-site.ts`, `tests/minify-site.test.ts`, both site workflows,
`gates.ts`, `partition/instance-rules.ts`, `beans/README.md`,
`cat-harness/scripts/README.md`, this bean.

Stays `in-progress`: a merge to `main` needs the owner's explicit word, and
the real before/after is what the first deploy through the step reports.


## CI, 2026-10-02 — green, and it settles the attribution

`Code-quality gates` dispatched at head `a309c3aaa83`: **8/8 jobs success**
(run 37041933678), including **Repository gates (hard)** — the full 210-gate
set — and **End-to-end + accessibility (hard)**, the browser job that reaches
`first-paint-scheme.e2e.ts`.

That is the evidence for the local attribution rather than a badge: my local
`bun run cat gates` showed 6 failures in a tree holding three authors'
UNCOMMITTED work; CI runs the committed branch, where the four I attributed to
another author's files are absent, and the two that were mine were fixed
before the push.

**A CI-health fact worth recording (the `xom7` shape).**
`pull_request`-triggered runs on this branch complete with conclusion
`action_required` and never execute. Of the runs on
`claude/wizardly-galileo-feyypz`, only the `push`-triggered "JSON-LD
generated-file drift" had actually run; `Code-quality gates` had not fired
since `70502fde1`, across two commits from an hour earlier. The gate set above
ran because I dispatched it, which is what sibling sessions on other branches
are doing. **A green PR page here does not mean the gates ran.** Not
introduced by this change, and not in scope to fix here.


## Merged-tree re-run, 2026-10-02 — two reds, neither mine (measured to the commit)

Another agent merged `origin/main` into the branch (`b97cb2f5e0d`) after my
green run, so I dispatched the gates again on the merged head
`025aa68106c` (run 37043076553). Two jobs red, both failing the SAME gate:
`skill:register:check` ("every skill is declared, and declares nothing
absent" in Repository gates, and "the registration chain is current, read
unmasked" in its own job).

Measured the way `skill-registration` itself prescribes — that ONE check
against a clean tree, not through `bun run cat gates`:

| | at `20d029597fc` (parent, not mine) | at `025aa68106c` (with my 2 commits) |
|---|---|---|
| | ✗ check:glossary | ✗ check:glossary |
| | ✗ kg:audit:check | ✗ kg:audit:check |
| | ✗ kg:detangle:check | ✗ kg:detangle:check |
| | ✗ lsi:viz:check | ✗ lsi:viz:check |
| | ✗ uml:overview:check | ✗ uml:overview:check |

**Identical, and my commits add zero findings.** These are the glossary, LSI,
KG-audit, detangle and UML-overview artefacts a SKILL edit stales — this
branch's `ui-accessibility.md` work plus the `main` merge. This change adds
no skill and no KG node.

**Not repaired here, deliberately:** `bun run cat skill:register` would
regenerate artefacts embodying another author's in-flight skill edits, and
sweeping those into my commit is what the shared-tree rule exists to prevent.
Whoever ships this branch runs `skill:register` after the last skill edit
lands — possibly twice, since that command's own output warns the chain is not
at a fixed point.

## Completed on landed evidence
Landed on main in PR #1889 (R4 scoped to the board + post-build HTML minification (−63.3 MiB)).
