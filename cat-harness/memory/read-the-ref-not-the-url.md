---
$schema: folio-memory/v1
id: read-the-ref-not-the-url
label: trap
summary: "a 404 or a failed fetch is not evidence — read the publish ref"
createdAt: 2026-09-19
roles:
  - build-pipeline
references:
  - kind: agent
    id: ci-health-watcher
---
**First check for a deployment or 404 question is the publish ref, not a
fetch.** `git fetch origin gh-pages && git ls-tree -r --name-only FETCH_HEAD |
grep <thing>`; staging previews are `branches/<branch-slug>/`.

**A published URL is looked up, never composed** — the `docs/<stub>/` segment
does not reach the site, so a composed URL 404s on a page that is there.

**A failed fetch from an agent container is a proxy result**, not an absence:
`github.io` is blocked and `curl` returns `000` either way.

**CI state is `get_check_runs`, not `get_status`** — the latter reports
`pending, total_count 0` on a green PR. Check its `head_sha` against the PR's
current head.

Skill: `sdlc/skills/sdlc-core/github-state-inspection.md`.

<!-- detail -->
## The measurements behind each claim

- **Composed URL.** `docs/<stub>/proposals/x.md` publishes to
  `/proposals/x.html`. The stub segment is a source-tree convention Jekyll
  does not carry into the site. Measured 2026-09-19 on `bootstrap.md`.
- **Slug shape.** The branch name with `/` replaced by `-`.
- **Proxy.** Outbound HTTPS is proxied; `curl` returns `000` with
  `CONNECT tunnel failed, response 403` whether or not the page exists.
  "Could not determine" is honest, and still the wrong answer when the ref
  could have determined it.
- **Check runs.** This repo posts check runs and no legacy statuses.
  `check_suite.completed` routinely names a superseded sha, and the staging
  workflow's own commits are not PR heads.

## Why this is not tagged to `platform-boundary-guard`

That agent wants the compose-not-resolve half. Measured 2026-09-19 it was
already at **201 of its 200 lines**, so a 14th entry pushes one of its own
TRAPs past the harness cut. The skill is the source of truth; memory only
summarises.
