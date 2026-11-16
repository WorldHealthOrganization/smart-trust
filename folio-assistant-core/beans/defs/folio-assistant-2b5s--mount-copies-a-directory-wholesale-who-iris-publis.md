---
# folio-assistant-2b5s
$schema: bean/1.0.0
title: 'MOUNT COPIES A DIRECTORY WHOLESALE: /who-iris/ publishes 1,367 corpus files as pages, and /library/who-iris/ publishes all 1,378 a second time'
status: completed
type: task
priority: normal
created_at: 2026-09-21T20:00:52Z
updated_at: 2026-09-30T13:57:36Z
parent: folio-assistant-yj32
---

## What

`mount-instance-docs.ts` mounts a directory when it carries an `index.html`
**at its own root**, and then copies **everything beneath it**. For
`who-iris/library/` that is 1,378 files, of which 11 are pages:

| | count | what |
|---|---|---|
| pages | 11 | 7 `.html` (index, community-list, 2 collections, 3 items), 3 cover `.png`, `image-verdicts.json` |
| L1 corpus | 1,367 | 813 `.jsonld`, 404 `.md` section files, 121 `.txt`, 26 `.png`, under `9789241548960-eng` (757), `who-pub-tps-931` (487), `wpr-rdo-2020-003-eng` (123) |

Measured 2026-09-21 by `find who-iris/library -type f`, not estimated.

**And it is copied TWICE**, because `who-iris/library/` declares
`instanceRoot: true` *and* carries the graph kind `library`:

```
_site/who-iris/         <- cpSync who-iris/library/   1,378 files
_site/library/who-iris/ <- cpSync who-iris/library/   1,378 files
_site/docs/who-iris/    <- cpSync who-iris/docs/          3 files
```

Nothing is duplicated in the REPOSITORY. One source directory, two `cpSync`
calls, in the built site only.

## Why it is two questions, not one

The owner asked *"where are duplicates?"* and the answer surfaced the larger
half. They are independent:

1. **Should `/library/who-iris/` exist at all**, now that the rail links the
   kind to its declared visualiser (`hw9g`, PR #785)? Nothing links to the
   mount route any more. Leave it / stop mounting it (a live URL 404s) /
   serve a one-file redirect stub. A **copy** of the visualiser cannot go
   there: its `fetch("../../../assets/library/index.json")` is written for
   depth 3 and that route is depth 2, so the copy would reach past the site
   root and report a corpus it could not load — which the page renders as
   "could not be read", the honest third state, but still wrong.

2. **Should a mount copy a directory wholesale**, or only the pages it
   renders? `/who-iris/` is meant to be the IRIS replica, and 1,367 of its
   1,378 files are the ingestion sidecars behind the replica rather than
   pages a reader reaches. This is the prior question: answering it may
   dissolve the first.

## Not decided here

Both change what is reachable under a published URL, so both are the owner's.
Recorded rather than acted on, per `deletion-requires-confirmation`: this is
the shape that skill's worked example (`plj1`) warns about — a sweep that
removes published artefacts because a rule said they were redundant.

## Done when

- [x] The owner has ruled on whether a mount copies a directory wholesale
      (2026-09-30: no. The replica moves to `site/`, and the mount publishes pages plus the assets they embed)
- [x] `/library/who-iris/` has a decided answer, and the decision is written
      into `mount-instance-docs.ts` as a rule rather than a special case
      (a one-file redirect, via the declared `kindRouteRedirect` field)
- [x] Whatever the ruling, the count is re-measured rather than quoted from
      this bean (table below)


## RE-MEASURED 2026-09-22 (bean `osyc`, item 2) — totals exact, breakdown does not sum

Every headline figure verifies against `find who-iris/library -type f`:

| | bean | measured |
|---|---|---|
| total files | 1,378 | **1,378** |
| pages | 11 | **11** (7 `.html`, 3 cover `.png`, 1 `image-verdicts.json`) |
| L1 corpus | 1,367 | **1,367** |
| `9789241548960-eng` / `who-pub-tps-931` / `wpr-rdo-2020-003-eng` | 757 / 487 / 123 | **757 / 487 / 123** |

**The corpus BREAKDOWN is wrong, and its rows sum to 1,364 against its own
stated 1,367.** Two errors cancelling out to a right total:

- it lists **26 `.png`**, which is the TREE-WIDE count — 3 of those are the
  cover images it already counted among the 11 pages. The corpus has **23**.
- it omits the **6 `.json`** files that are corpus rather than page.

Correct: 813 `.jsonld` + 404 `.md` + 121 `.txt` + 23 `.png` + 6 `.json` = 1,367.

Nothing about the bean's argument changes — the duplication it reports is real
and the totals are right. But a reader acting on that table would double-count
3 files and miss 6, which is why a count in prose is a claim rather than
evidence.

_2026-09-30T10:16:57Z_ — Claimed by claude/magical-archimedes-4qkfxp-2b5s — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

## Owner's ruling, 2026-09-30, and a conflict it raises

Asked *"why two routes?"* and given the answer, the owner chose **"Separate them"**:
- the 11 replica pages move out of `library/` into their own directory, which is the instance root;
- `library/` holds corpus only;
- `/library/who-iris/` becomes a one-file redirect to the library viewer at `/cat-harness/library/who-iris/`.

**Held before building, because it meets an earlier ruling.** `who-iris/scripts/gen-iris-pages.ts` records the owner, 2026-09-21: *"the iris KG should be in who-iris/library (served by cat-harness/library) which may or may not inlude materialized content, the docs in who-iris/docs (served by cat-harness/docs)."* The session that implemented it read the replica as *"a RENDERING OF THE KG, and the KG is library-side"*, and put the pages in `library/`.

Moving the pages departs from that reading, though arguably not from the owner's words: the words place the KG, meaning corpus and materialized content, in `library/`, and say nothing about where its rendering lives. That interpretation is put back to the owner instead of being decided here.

**Covers.** The replica shows each item's cover, and the covers must stay where the catalogue's `localPath` names them (`library/<slug>-cover.png`, bean `yl5w`). If `library/` stops being mounted, the pages need the covers through a published route: the mount carrying the covers the pages reference, or the pages linking the covers where the site serves them.

## Owner's final answer, 2026-09-30: "site/ + publish covers" — built

The conflict held above was put back and answered with the recommended option. What landed on `claude/magical-archimedes-4qkfxp-2b5s-impl`:

- **The replica moved.** The 7 pages (index, community-list, 2 collections, 3 items) are now in `who-iris/site/`, declared as a new directory entry `who-iris-site` with kind `docs` and `instanceRoot: true`. `docs` because it is the one renderable kind the harness owns and the replica is finished HTML rendered from the catalogue; `folio` is authored block content, which this is not. The `library` entry lost `instanceRoot`.
- **`library/` is corpus only**: slug directories, covers, `image-verdicts.json`, `withheld.json`, README. It has no `index.html`, so nothing mounts it. `gen-iris-pages.ts` prunes any page of its own that turns up there.
- **Covers stayed where `localPath` names them** (`library/<slug>-cover.png`, `yl5w`). A page references `../library/<slug>-cover.png`, which resolves in the checkout. No second copy of the binary is committed.
- **Three generic rules in `mount-instance-docs.ts`**, none of which names who-iris:
  1. `withRoutes`: a declared instance root gives up its kind route when a sibling directory that is not the root declares the same kind. `site/` serves `/who-iris/`, and `/docs/who-iris/` stays with `docs/`. An instance with no same-kind sibling (smart-trust) keeps both routes.
  2. `referencedAssets` / `publishedAsset`: each file a mounted page embeds with `src`, from outside the mounted directory but inside the instance, is published under the route at its instance-relative path. The published copy's reference is rewritten to match. Three kinds of reference are refused and named, and the step exits non-zero: one that leaves the instance, one that resolves to no file, and one that any ancestor's `withheld.json` names. An `href` counts as navigation, not an embed.
  3. `kindRouteRedirect` is a new optional `ContentDirectory` field. The kind route of a directory that sets it and is not mounted becomes a one-file redirect (meta refresh, canonical link, visible link, noindex) to the directory's declared viewer. It is **declared, not inferred**, because "was this route ever published" is history the checkout does not hold. Deriving it instead would emit a stub for each of the 38 declared entries that have a published viewer and no index. It is refused if the directory is also mountable, if it has no published viewer, if a mount owns the route, or if the site already serves a page there. `railStandalonePages` leaves meta-refresh stubs without a rail.

### Re-measured, not quoted

Method: one local Jekyll build (`PREVIEW_NO_MOUNT=1 bun run cat preview:site`), then two copies of it. The mount step from `origin/main` (2e9cc280cb1) ran on one copy and the mount step from this branch on the other, as `docs-site.yml` runs it (`--site <dir> --built cat-harness`). Files were counted with `find -type f`:

| route | before | after | what is there now |
|---|---|---|---|
| `/who-iris/` | 133 | **8** | 7 replica pages + `library/wpr-rdo-2020-003-eng-cover.png`, the only cover a page embeds; the other two are withheld by their gates |
| `/library/who-iris/` | 133 | **1** | `index.html`, redirecting to `/cat-harness/library/who-iris/`, which exists in the build |
| `/docs/who-iris/` | 5 | 5 | unchanged |

(133, not 1,378: since `cw35` the mount has withheld the two refused slugs and their covers. The source directory held 1,381 files before this change.) The harness rail went on 12 mounted pages, down from 19; the missing 7 were the duplicate copies at `/library/who-iris/`.


## Summary of Changes

- The IRIS replica pages moved from `who-iris/library/` to `who-iris/site/`. The new directory is declared `who-iris-site`, kind `docs`, with `instanceRoot: true`. `library/` now holds only the corpus and is mounted nowhere.
- `gen-iris-pages.ts` writes to `site/` (the `PAGES.site` and `OWNED_SITE` side), references covers at `../library/<slug>-cover.png`, and prunes any of its pages left in `library/`. Its tests and `catalogue-links.test.ts` / `folio-mount.e2e.ts` follow the move.
- `mount-instance-docs.ts` gains three generic rules: the root yields its kind route to a same-kind sibling; embedded assets are published and their references rewritten, with withheld.json honoured; and `kindRouteRedirect` makes a kind route a one-file redirect to the declared viewer. `kindRouteRedirect` is a new optional field on `ContentDirectoryShape` in `schemas/cat-harness.ts`.
- Measured routes: `/who-iris/` went from 133 to 8 files, `/library/who-iris/` from 133 to 1 (the redirect), and `/docs/who-iris/` stayed at 5.
