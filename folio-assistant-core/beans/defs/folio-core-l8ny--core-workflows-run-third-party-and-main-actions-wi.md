---
# folio-core-l8ny
$schema: bean/1.0.0
title: 'Core workflows run third-party and @main actions with write tokens'
status: completed
type: bug
priority: high
tags:
    - security
    - security-review-2026-10-31
    - red-flag-security
created_at: 2026-10-31T04:01:25Z
updated_at: 2026-10-31T04:22:00Z
---

Found by the 2026-10-31 security and QA review of the folio-assistant layers (SOP: cat-harness `skills/conduct/security/`, the 16 rules of `skills/voices/secure-code-authoring/voice.json`, RED FLAG categories of cat-harness-tools `schemas/sdlc/red-flag.ts`). No fix PR yet: fixes wait for the owner's go-ahead.

**Category:** security · **Severity:** major

Rule `scz-pin-third-party-by-full-sha`. Measured with cat-harness-tools `pin-actions.ts` (dry) and a grep at `bfe4bed`.

**Unpinned third-party actions (7):**
- `.github/workflows/public-comment-check.yml:43,54`: `actions/checkout@v7` (job holds `contents: write`, `issues: write`)
- `.github/workflows/public-comment.yml:69`: `actions/checkout@v7` (job holds `contents`, `issues`, `pull-requests`, `actions: write`, and fires on public `issue_comment` / `pull_request_target` events in the calling repo)
- `.github/workflows/release-npm.yml:22,25,30,62`: `actions/checkout@v4`, `oven-sh/setup-bun@v2`, `actions/setup-node@v4`, `softprops/action-gh-release@v2` (job holds `contents`, `packages`, `id-token: write` and `secrets.NPM_TOKEN`)

**First-party refs on a moving branch:** `litlfred/cat-harness-tools/.github/actions/mount-layers@main` (public-comment.yml:73, public-comment-check.yml:44,57) and the `layer-*.yml@main` reusable workflows in `cancel-on-close.yml:16`, `pr-checks.yml:20,35`, `publish-context.yml:18`. A push to cat-harness-tools main changes what runs here with this repo's write token. folio-assistant pins the same reusable workflow by SHA (`main-qa.yml:35`), so the pattern exists.

`bun run cat actions:pin` produces the SHAs.

## Done when

- [x] Every `uses:` in core's workflows is a full SHA with its `# <ref>` comment
- [x] The cat-harness-tools action and reusable workflows are pinned by SHA (and kept current by the repin process)

## Summary of Changes

Fixed in litlfred/folio-assistant-core#336 (merge `ac5cde9`): all 14 `uses:` lines pinned to full SHAs, cat-harness-tools refs pinned to main `45b0894`.
