---
name: rendered-impact
description: >-
  The list of rendered files a Change Set alters, and how a reviewer approves
  against it. Each renderer maps the input files a change touched to the
  rendered files of its site through its dependency cone, before any build;
  a build diff then confirms the prediction. Use when opening or reviewing a
  Change Set PR, when asked "which pages does this change", when a
  prediction and a build disagree, or when adding a renderer.
user_invocable: true
allowed-tools: Read Grep Glob Bash
---

# Rendered impact — which rendered files a Change Set changes

> Skill id: `rendered-impact` · Package: `sdlc-core`

A Change Set's PR is approved against **what it does to the rendered site**,
not only against its source diff. A one-line FSH edit can re-render one page
of 722 or all of them, and a reviewer cannot tell which from the diff. So
every renderer answers one question, and the PR shows the answer.

## Scope

- Every renderer maps a list of changed input files to the list of changed
  rendered files, from its dependency cone.
- The public-comment Change Set (`changeset/1.0.0`) is the Change Set for ANY
  folio change, and the rendered list is one of its fields.
- The original stays in `library/`; a Change Set applies to the folio
  materialised in `folio/`, never to the library source.

## The contract: `rendered-impact/v1`

Declared in `cat-harness/schemas/ui/rendered-impact.ts`. A renderer takes the
changed input files and returns:

| field | says |
|---|---|
| `files[]` | each rendered file the change alters: `path` in the built site, `change` (changed, added, removed), `role` (content, data, index) and `via`, the chain that reached it |
| `files[].anchors` | for a page that assembles many units (a document page), the fragment ids the change alters; the review list links `path#anchor` |
| `undetermined[]` | each input the renderer could NOT place, with its reason, and `scope: all` when it can change any page |
| `method` | `cone` (predicted before a build) or `build-diff` (measured after one) |

Three rules, each one a refusal:

1. **Could-not-determine is never "no change".** An empty `files` with a
   non-empty `undetermined` is "not known", and the PR says so in those
   words. A renderer that drops an input it cannot map is broken.
2. **Index files are listed and marked, not dropped.** The reviewer's list
   (`reviewList`) leaves out `role: index` (search data, sitemaps, an
   artefact index) because review is of content, not indexes. The
   renderer marks the role; the reader filters.
3. **A page whose bytes do not change can still change.** An AST artefact
   page loads its resource in the browser, so the cone names the page AND
   its data file, and a build diff sees only the data file. That is
   `unconfirmed`, not a defect.

## Checking a prediction: the one comparison that matters

`comparePrediction(predicted, measured)` sorts every file into three groups:

- **`missed`**: the build changed it, the cone did not predict it. **A cone
  defect, never a pass.** Report it on the PR and fix the renderer: the next
  Change Set relies on the same cone to tell the reviewer what to open.
- **`confirmed`**: predicted and measured.
- **`unconfirmed`**: predicted, not measured. Expected for content pages that
  load their data (rule 3). For anything else it means the cone is too wide:
  it is safe, but say so.

## The renderers today

| renderer | maps | how | status |
|---|---|---|---|
| `fhir-ig-pages` | `.fsh`, `.cql`, `input/pagecontent/*.md` | `fsh-cone` forward cone → SUSHI's `fsh-index.json` → AST artefact page + served JSON; a page → itself and every page that includes it | in the FHIR layer, documented with its AST tooling (`skill_fetch ig-ast-delta`) |
| `document-site`, `public-comment-site`, `library-site` | a block, a document/chapter/section manifest, `media/*`, the public-comment store, a file in a declared library entry or a folio `review-anchors.json` naming one (the entry's Document view and `doc.json`; its `structure.json` also the library index) | loaded from the published `changeset.json` (each changed block's label and file) and `outline.json` (the documents), never from source: a block lands on its document's page, anchored at its label (`anchors`) — on a LAZY page (`outline.json` `lazy`) on its `blocks/NNN.json` chunk and `index.hydrated.html` instead, and a block added, removed, renamed or moved reshapes the shell and every chunk from its position on; a file no builder of the site reads is an input with no page: each builder in the folio's build command exports `siteReads` (the folio; the comment store; every directory of a typology holding a kind it renders), and a file outside all of them, the submodules, `.github/` and the root's non-Markdown files reaches nothing — so `beans/` reaches no page, while `todos/`, whose pages are rendered, still may. A step that exports no `siteReads` excludes nothing; never decide it from the layer's declaration, which also declares what no builder reads | in the document layer, with the ChangeSet Tool |
| `docs-site` | any file | a file in the COMPOSED Jekyll tree (`docsLayers`, `composedInstances`) → its page (permalink, or `.md` → `.html`) or asset; an include → the pages that include it, transitively; `_data` → the pages and includes that read it; a layout, a THEME include (read from the installed theme; unreadable means every include) or an include nothing calls → any page; any page change → the search index; a file outside the tree → `undetermined` when the staging cone carries any directory, nothing when it reaches none | `cat-harness-tools/scripts/docs-rendered-impact.ts` |
| `published-provenance` | a mounted layer's skill, process or schema (anything a generator renders) | the published root's own record of what each page was generated from — the "Generated from `<path>`" note and `data-src` on the edit link — read back as source → pages; a new source has no page yet and an index names no source, so both stay for the QA diff | `cat-harness-tools/scripts/staging-changes.ts` (`predictByProvenance`) |

Two builds of one commit differ in every page by a `?v=<build time>`
cache-buster, so `diffBuiltSites` blanks `BUILD_STAMPS` before hashing;
without that, every page reads as missed.

A renderer's command line belongs to the layer that owns it; this layer
names none above it.

## In the review process

`content-change-review.bpmn`:

- **Produce**: the staging build writes `rendered-impact.json` beside the
  preview and puts the review list in the PR comment. Each entry links to
  the preview and to `main`'s copy of the page.
- **Read**: at *Compare main vs staging*, the reviewer opens every file on
  the review list, not only the pages the author mentions. Use
  [`before-after-preview`](before-after-preview.md) for the pairs, and
  [`visual-diff`](visual-diff.md) for figures.
- **Measure**: the staging job diffs its build against `main`'s published
  site (`measure-rendered-impact.ts`, before the banner goes on) and writes
  `rendered-measured.json`: what changed, and what the prediction MISSED.
  Only when that site was built from the PR's base does it count
  (`status: known`); otherwise main's own changes would read as misses
  (`not-base`). No published main site, no file: "not measured", never
  "nothing missed".
  The review page shows it under the list, as the PR comment does: a run
  started by dispatch finds its PR from the branch, so the comment is not
  lost when no `pull_request` event started the run.
- **Show**: every docs-site preview also carries `branches/<slug>/changes/`
  (`cat-harness-tools/scripts/staging-changes.ts`): the
  changed sources, with a re-pinned mount in `index.lock.json` expanded into
  the files its repository changed between the two pins (a re-pin handed to
  a renderer as one JSON line predicts nothing); the cone's files and its
  `undetermined` inputs; and the build diffed against the site at the
  `gh-pages` root, its `missed` files listed as **changed, not in the cone**.
  That diff folds the preview's base URL to the root's, blanks
  `BUILD_STAMPS` and compares a page's `<main>`, because a preview's chrome
  differs on every page; a removed file is listed apart, by directory, since
  most are parts of the site the preview does not carry. The root records
  its build commit in `build.json`; a root not built from the PR's base is
  said on the page, never read as this branch's change.
- **Gate**: `review-coverage-gate.dmn` reads three page counts beside the
  block counts, each with a status fact so an uncomputed count is never 0:
  - `unreviewedPages`: review-list files nobody has reviewed at their
    current pin. A page is reviewed by a `page:` verdict, or block by block
    when every block anchored on it has a verdict; a data file goes with a
    reviewed page that shares its pin.
  - `undeterminedInputs`: inputs no renderer placed, until an `input:`
    verdict or waiver (with a reason) says somebody looked.
  - `missedPages`: measured but not predicted, until a `page:` verdict.

  A pin is the hash of the git blobs of the changed inputs on a file's
  `via` (`pinImpact`), never the built bytes, which carry a per-build
  banner. An edit after review reopens exactly the pages it touched.
  The tag is in `review-comments`.

## Adding a renderer

1. Map each input kind the renderer reads to the rendered files it writes,
   through the dependency information the renderer ALREADY has. Never
   re-derive a mapping the renderer's own tool records (SUSHI's `fsh-index`
   is the authority for FSH → resource).
2. Put every other input in `undetermined`, unless the renderer cannot read
   it at all: then it is an input with no file. Decide that from what the
   layer declares, never from a list of names here.
3. Test it against a real build with `comparePrediction`: 0 missed is the bar.
