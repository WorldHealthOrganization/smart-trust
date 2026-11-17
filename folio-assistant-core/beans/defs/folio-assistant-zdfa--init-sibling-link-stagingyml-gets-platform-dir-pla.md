---
# folio-assistant-zdfa
$schema: bean/1.0.0
title: 'INIT SIBLING LINK: staging.yml gets platform_dir ../platform, outside the Actions checkout; a subfolder folio''s workflow lands where GitHub never reads it'
status: completed
type: bug
priority: normal
created_at: 2026-09-23T18:06:56Z
updated_at: 2026-10-07T14:55:47Z
parent: folio-assistant-q4jm
---

Found by ojcx's real run, 2026-09-23. `init-folio --link sibling --assistant ../platform` writes `platform_dir: ../platform` into `.github/workflows/staging.yml`. In Actions, that path is outside the checkout, so the reusable workflow's "Check out the platform" step cannot place the platform there. A sibling checkout exists on the author's machine, never in CI. The folio-test run worked only because the caller was hand-written with `platform_dir: platform`.

A related problem: a folio scaffolded into a SUBFOLDER gets its workflow at `<sub>/.github/workflows/`, which GitHub never reads.

## Done when
- [x] for `--link sibling`, the written caller checks the platform out inside the workspace, and the builder shim resolves to it in CI as well as locally
- [x] scaffolding into a subfolder of an existing repository writes the caller at the repository root, or says clearly that it cannot
- [x] a test covers both cases



## Progress (2026-09-24)
- Sibling link: `folio-staging.yml` (stage and publish-main) now resolves `platform_dir`. A path outside the workspace is checked out at `.folio-platform` inside it, then symlinked to the named path, so the shim and build command resolve the same in CI as locally. The written caller is unchanged. Tested by running the workflow's own step scripts (`folio-staging-platform.test.ts`).
- Subfolder: `init-folio` detects an enclosing repository. It writes no staging workflow there and says why in its notes (the reusable workflow builds from the repository root). It also no longer runs a nested `git init`.
- Not done, possible follow-up: supporting a folio BELOW the repository root would need a `folio_root` input threaded through every step (paths, the ChangeSet's `git archive`, and the pages checkout).



## Claim released 2026-09-29

Released `in-progress` → `todo` on the owner's instruction (review session https://claude.ai/code/session_014Qj8wncQhqV52QGN1yZDnj). No git change to this bean since before 2026-09-26, and no holder recorded; the sessions that held theme C (rendered site) work stopped on the 2026-09-25 weekly usage limit. Nothing in the body was changed: re-claim with `bun run cat beans:claim <id>`.

_2026-10-07T02:33:34Z_ — Claimed by claude/zdfa-close-on-evidence — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

## Evidence

Closed on evidence of landed work:
- Implementation landed on `main` in commit `65829fa426f0c507fd7d61ec1113b3cdb87fe1d2` (PR #1318).
- Re-derived and independently verified on 2026-10-07: `bun test cat-harness/scripts/tests/folio-staging-platform.test.ts cat-harness/scripts/tests/init-folio.test.ts` passes 55/55 tests covering sibling platform resolution and submodule/subfolder warnings.


_2026-10-07T16:55:00Z_ — Closed on owner confirmation and verified evidence of landed work on `main`.
