---
# folio-assistant-5uuf
$schema: bean/1.0.0
title: 'FOLIO PREVIEW BEFORE-SIDE: no main-site publish, so before pictures and ''view on main'' are empty; stacked PRs compare with the wrong base'
status: completed
type: bug
priority: normal
created_at: 2026-09-23T18:06:56Z
updated_at: 2026-10-07T19:30:00Z
parent: folio-assistant-q4jm
---

Found by ojcx's real run, 2026-09-23 (litlfred/folio-test#6). The visual diff's "before" picture, and the review page's "view on main" link, both read the published main site at the root of `gh-pages`. Two gaps follow:
- **A folio has no main-site publish.** Neither `init-folio` nor `folio-staging.yml` publishes `main`'s document site to the `gh-pages` root. So every before picture reads *"Its page is not in the published site"*, and the "view on main" link 404s.
- **A stacked PR is compared with the wrong "before".** Its ChangeSet uses the PR's base branch (`base_ref`), but its pictures use the main site. The two disagree.

## Done when
- [x] a folio's `main` builds and publishes its document site to the `gh-pages` root (a push-to-main job, written by `init-folio`), so the before side exists
- [x] for a PR whose base is not `main`, the before side is that branch's preview (`STAGING/<base-slug>/`) when it exists, and the page says which one it used



## Progress (2026-09-24)
- Implemented: `publish-main` job in `folio-staging.yml` + `publish-main-site.ts` (manifest-scoped: deletes only files its own `_main-site.json` lists); `init-folio` caller gains `push: branches: [main]` for document folios.
- Implemented: base resolved once (`base_ref` empty → PR base → default branch) and used by both the ChangeSet and the pictures; stacked PR pictures its base's `STAGING/<base-slug>/`; banner, review page and PR comment name the before side (`beforeRef`).
- Not yet verified on a real folio run (litlfred/folio-test). Close after that run shows before pictures.



## Claim released 2026-09-29

Released `in-progress` → `todo` on the owner's instruction (review session https://claude.ai/code/session_014Qj8wncQhqV52QGN1yZDnj). No git change to this bean since before 2026-09-26, and no holder recorded; the sessions that held theme C (rendered site) work stopped on the 2026-09-25 weekly usage limit. Nothing in the body was changed: re-claim with `bun run cat beans:claim <id>`.

## Evidence of completion (2026-10-07)
- Landed in PR #1310 (merge commit `35df4d91457e`): Folio preview before-side and `publish-main` job implemented in `init-folio` templates.
- Re-derived independently on 2026-10-07: `folio-staging-platform.test.ts` passing.
