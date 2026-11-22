<!-- Generated from memory/read-the-ref-not-the-url.md by `bun run cat agent-memory`. -->
<!-- Not injected into MEMORY.md; read on demand. Edits here are lost. -->

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
