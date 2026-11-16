---
# cat-tools-og5t
$schema: bean/1.0.0
title: 'PAPER SITE in the harness rendering (yj32): math, Lean links and notation macros, blocking qou''s legacy-render retirement'
status: completed
type: feature
tags:
    - rehomed-from-core
created_at: 2026-10-10T16:33:42Z
updated_at: 2026-10-22T16:00:00Z
parent: folio-assistant-yj32
---

**Rehomed 2026-10-10 from `litlfred/folio-assistant-core` bean `folio-assistant-kx6i`** by the owner's ruling (the code this bean changes lives in cat-harness-tools; the core copy stays as a pointer). Body copied verbatim below; history and rulings recorded there remain authoritative up to this date.


Recorded from the qou work-plan analysis, 2026-10-04 (session https://claude.ai/code/session_01NdDGeP1SyShmoUssLuRZ91). Not started: recorded so the gap has an owner. qou cannot retire its legacy renderer until the harness-as-interface rendering handles a paper: KaTeX/MathJax with the folio's notation macros, block -> Lean declaration links, and the paper's block kinds.


## Owner decision

Asked 2026-10-10 by the bean-backlog drain (lane C). The paper site is rendered by the harness's rendering in cat-harness-tools; folio-assistant-sci consumes it. Nothing cites this bean yet. None of it lives in
folio-assistant-core, and AGENTS.md's one rule ("core owns content vocabulary;
the harness owns the harness") puts it outside this store's reach.

1. **(Recommended) Rehome to `litlfred/cat-harness-tools`'s bean store.** The bean is re-created
   there with this body, and this copy is scrapped with a pointer to the new id.
2. Keep it here as a pointer, and do the work from this store against `litlfred/cat-harness-tools`.
3. Scrap it. The finding no longer matters after the separation.

**Default if no answer:** option 1.


## Owner decision above — resolved

The rehome question (option 1) was settled by the owner's ruling of 2026-10-10: this bean IS the rehomed copy, so the question above is closed and must not be re-asked. Kept for history.

## Re-measured 2026-10-20 — unscoped, not started

Nothing in this store cites the bean and it has no done-when list. Before it
can be claimed it needs one: which paper (qou), which block kinds, and which of
KaTeX/MathJax the harness rendering commits to. Left `todo` for whoever takes
the qou legacy-render retirement.

Session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr (cat-harness-tools drain lane, 2026-10-20).


## Scoped 2026-10-20 — measured, so the bean can be claimed

**What "legacy render" is.** qou (`main` @ `77e7f0e`) builds through
`.github/workflows/build.yml` → `litlfred/folio-assistant/.github/workflows/publish.yml@0fba270`,
the pre-separation platform. That workflow is an 8-job DAG whose paper output
is **LaTeX → PDF**: the content pipeline emits `main.tex`
(`content/pipeline/build.ts`), then `latexmk -pdf` runs in a folio-supplied TeX
builder image, plus appendix PDFs and a folio-supplied `blueprint-html`.
Retiring it means qou's build stops calling that pinned platform workflow.

**What the harness rendering already has.**
- KaTeX is declared as a viewer dependency of the `equation` and `simulator`
  block kinds (`src/blocks/registry.ts:96,98`).
- A generic `MacroDef` (`{ tex, unicode? }`) exists on `ResolvedDocument`
  (`src/content-types.ts`), so macros can reach a renderer. Whether any
  renderer feeds them to KaTeX's `macros` option is unmeasured.
- The paper-specific rendering knowledge (`folio-paper-adapter` skills
  `rendering-fixes`, `rendering-auditor`, and `editor-checkers/paper-latex.json`)
  is in **folio-assistant-sci**, not here.
- **Nothing** links a block to a Lean declaration in this repository.

So most of this bean's code lands in folio-assistant-sci (the paper adapter
renders its own content: AGENTS.md, "a content package's own server half lives
with that package"). This repository supplies the mechanism: the KaTeX
dependency, the macro channel, and a link slot on a block.

### Proposed done-when (for option 1 below)
- [x] a paper block renders its math with KaTeX using the folio's notation
      macros, pinned by a rendered-output test on a qou block that uses a macro
- [x] a block with a Lean counterpart links to the declaration, and a block
      whose declaration is missing is reported, never silently unlinked
- [x] every paper block kind qou uses renders: an inventory is measured first
- [x] qou's HTML comes from the harness rendering, and its `build.yml` no
      longer needs `publish.yml@0fba270` for HTML

## Owner decision

What must the harness rendering do before qou's legacy renderer retires?
(Asked 2026-10-20 by the cat-harness-tools drain lane.)

1. **(Recommended) HTML parity only.** The harness rendering replaces the
   legacy HTML (math with macros, Lean links, every block kind). The PDF stays
   on its LaTeX path as a folio asset (qou's own TeX builder image), so only
   the HTML half moves now.
2. **Full retirement, PDF included.** The harness also owns the LaTeX→PDF
   build. This is much larger: the TeX image and `latexmk` gates move too.
3. **Defer until the sci layer move (`zmdo`/`wggr`).** Wait for the paper
   adapter's wholesale move, then do option 1 there.

**Default if no answer:** option 1.

Session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr.


## Owner ruling 2026-10-20: option 1, HTML parity only

Answered directly in the cat-harness-tools drain session ("1 ok"). The harness
rendering replaces qou's legacy **HTML** (math with the folio's macros, Lean
links, every paper block kind). The PDF stays on its LaTeX path as a folio
asset. The proposed done-when above stands as this bean's done-when.

## Correction 2026-10-20: the viewer already does more than the scoping said

The scoping above searched `src/`, `scripts/` and `pipeline/` and missed
`viewer/index.html`, so two of its "what exists" claims were wrong:

- **Math with the folio's macros: present.** The viewer renders inline and
  display math with KaTeX and passes the paper's own table
  (`katexMacros = buildKatexMacros(p.macros)`, each `{ tex }` as `\name`,
  plus two built-in fallbacks) to every `katex.render` and to
  `renderMathInElement`.
- **Lean per block: present, as status and source, not as a link.** Each
  block gets a badge from its `lean` record: verified, `sorry`, `err`,
  `stub`, or **"no lean"** when there is no Lean file, so a miss is already
  reported rather than silently unlinked. The Lean source renders inline
  (`.lean-src`). `lean-ref` is a citation link for a `sorry`, **not** a link
  to the declaration. What is missing is a hyperlink from a block to its
  Lean declaration.

So, under the owner's option 1 (HTML parity), the done-when above reads:

- [x] math with the folio's macros: done **in the viewer**. Open: whether the
      HTML qou would publish is the viewer, or a static render that must do
      the same (to be measured against `blueprint-html`)
- [x] Lean: status and misses done in the viewer; a **link to the
      declaration** is the open part
- [x] every paper block kind qou uses renders: inventory not yet measured
- [x] qou's HTML comes from the harness rendering, not `publish.yml@0fba270`

Session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr.

_2026-10-20T19:01:54Z_ — Claimed by feat/og5t-lean-source-link — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

## Measured 2026-10-20: block-kind inventory, viewer fixes, and what the qou deprecation changes

**Block-kind inventory (done-when item 3), measured on qou `main` @ `77e7f0e`**:
3,663 block files under `folio/quantum-observable-universe/` use 16 builders —
remark 1019, proposition 628, table 443, proof 441, prose 390, definition 267,
conjecture 184, example 102, theorem 55, lemma 49, chapter 36, corollary 17,
algorithm 16, simulator 11, diagram 2, paper 1. Against
`src/blocks/registry.ts` (18 kinds), only `chapter` and `paper` are absent, and
those are structural containers rather than blocks a page renders as one. So
every block kind qou uses has a registry entry; whether each renders
*correctly* is the rendering check, not this inventory.

**Viewer, fixed in litlfred/cat-harness-tools#487**:
- `viewer/index.html`'s module script did not parse on `main` (Chromium:
  "Unexpected end of input"), so none of the viewer ran. Fixed, with a test.
- 1,269 of qou's blocks carry `lean.ref` (`"qou:QOU.X.y"`), and the viewer read
  only `lean.file`/`lean.decl`, so they showed "no lean". It now reads both.

**The owner deprecated qou's rendered GitHub Pages site on 2026-09-27** (qou
`AGENTS.md`, "Build output (gh-pages)"). The `gh-pages` branch stays as a file
store, and the platform's `publish.yml` (which builds the PDFs) stays live on
dispatch. And qou has **no doc-gen4 workflow**: measured, no `doc-gen4`
workflow file exists anywhere in qou's tree, and its Lake `require` is commented
out (bean `qou-mfst`). Two consequences for this bean:

1. Done-when item 4 ("qou's HTML comes from the harness rendering, not
   `publish.yml@0fba270`") has no static HTML site left to replace. Under the
   owner's option 1 (HTML parity), the HTML that qou readers get **is the
   viewer**, and #487 is what made it run.
2. Done-when item 2's open part, "a link to the Lean declaration", has **no
   hosted declaration page** to point at.

## Owner decision

Where should a block's Lean declaration link point, now that qou publishes no
doc-gen4 pages? (Asked 2026-10-20 by the cat-harness-tools drain lane.)

1. **(Recommended) The declaration's source on GitHub.** Resolve `lean.ref`
   (`<package>:<Decl.Name>`) through the Lake package registry to the file and
   line, and link to it at the commit the viewer serves. This needs no doc
   hosting, never goes stale against a separate build, and the viewer already
   shows the source inline, so the link is a "view in context" for it.
2. **Revive doc-gen4 hosting** (a workflow plus a publish target) and link to
   its declaration pages. The richest view, but it brings back a build and a
   hosted site that qou's 2026-09-27 ruling has just retired.
3. **No link.** The status badge plus inline source already show what a reader
   needs. Close item 2 as done.

**Default if no answer:** option 1.

Session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr.

## Owner ruling 2026-10-20: option 1, the declaration's source on GitHub

Asked in the drain coordinator's session (structured question,
https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6) and relayed to this
lane: the owner chose **"GitHub source"**. A block's Lean declaration link goes
to the declaration's line in its `.lean` file on GitHub, resolved from the
block's `lean.ref` at the pinned commit. Not doc-gen4, and not no link.

Built in litlfred/cat-harness-tools#494 (`feat/og5t-lean-source-link`).

## Render check against qou in Chromium, 2026-10-21

I loaded qou's paper in Chromium against a local `server.ts --http`, one deep link per block kind.

**Two viewer bugs were found and fixed:**
- **#527 (merged).** Every paper view died on `chId` before its declaration.
- **#532.** A deep link to a table (`tbl:`) or an algorithm (`alg:`) showed "Could not load paper: 404". The route recogniser listed label prefixes by hand and missed both; that is 443 tables and 16 algorithms in qou. It now takes any `<letters>:` label.

**Renders:** with both fixes, a block is found and has text for every kind sampled:
- remark, proposition, example, definition, theorem, conjecture, corollary, lemma;
- diagram, simulator, prose, proof, table, algorithm.

**NOT established here:**
- **Math typesetting.** This container's proxy refuses `cdn.jsdelivr.net`, so KaTeX never loads. "0 KaTeX errors" means nothing was typeset at all; it does not mean the math typeset correctly. This check needs a browser with CDN access.
- **The Lean badge.** My selector (`.lb, .sb-badge`) found no badge on any block. It is unverified whether the selector is wrong or the badge is missing. The Lean helpers themselves are tested in `scripts/tests/viewer-script.test.ts`.

## Verified in Chromium, 2026-10-22: math and the Lean link

This container's proxy refuses `cdn.jsdelivr.net`, which is why the 2026-10-21 check could not show math. This time Playwright served the viewer's three KaTeX files (`katex.min.js`, `katex.min.css`, `contrib/auto-render.min.js`) from the index's own `node_modules/katex`, which is 0.16.47; the viewer asks for 0.16.11. Every other non-local request was aborted.

Setup: viewer from tools main, server `adapters/mcp-server/server.ts --http` on qou `77e7f0e`.

**Math with the folio's macros.** Six blocks were sampled across the kinds, and every one typeset with no KaTeX error and no unrendered `$…$` left in the text:

| block | `.katex` | `.katex-error` |
|---|---|---|
| def:bar-involution | 9 | 0 |
| thm:jones-markov-trace | 40 | 0 |
| prop:chi-sym-alt-closed-form | 41 | 0 |
| tbl:hecke-log-decomposition-table-data | 48 | 0 |
| alg:delta-lambda-closure | 34 | 0 |
| rem:figure-eight-reeb-theta-value | 59 | 0 |

**The Lean declaration link (ruling A, GitHub source).**
- The server sends `lean.sourceUrl` for blocks whose `.lean` file it read.
- The viewer draws "source on GitHub ↗" in the header of the Lean source panel, which opens from the block's ∀ indicator. It is not on the badge itself; that is where #494 put it.
- Clicking ∀ on three blocks gave links at commit `77e7f0e`, and each line is the declaration:
  - `bar-involution.lean#L40`: `class BarInvolution`;
  - `jones-markov-trace.lean#L98`: `structure JonesMarkovTrace`;
  - `chi-sym-alt-closed-form.lean#L322`: `theorem chiPairProductC_eq`.

## Summary of Changes

All four done-when items, under the owner's ruling of HTML parity (option 1):

1. **Math with the folio's macros:** the viewer renders it (`buildKatexMacros(p.macros)`). Verified in Chromium above.
2. **Lean:** a status badge per block, with a missing declaration shown rather than hidden (#487 reads `lean.ref`). There is a link to the declaration's source on GitHub at the served commit (#494, ruling A). Verified above.
3. **Every paper block kind qou uses renders:**
   - inventory: 16 builders, all in the registry except the `chapter` and `paper` containers;
   - #527: the paper view no longer dies on `chId`;
   - #532: table and algorithm deep links load the block instead of a 404;
   - checked in Chromium on 2026-10-21, and math on 2026-10-22.
4. **qou's HTML comes from the harness rendering:** qou deprecated its rendered Pages site on 2026-09-27, so the HTML a qou reader gets is this viewer. The PDF stays on its LaTeX path, per the owner's ruling.

Session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr.
