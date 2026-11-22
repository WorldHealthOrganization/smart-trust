---
# cat-tools-a1p9
$schema: bean/1.0.0
title: 'UNPINNED ACTIONS IN WRITE-TOKEN WORKFLOWS: both release-npm.yml files and the folio-qa-sweep workflows run third-party actions by tag with contents: write and NPM_TOKEN'
status: completed
type: bug
priority: high
created_at: 2026-10-31T04:05:00Z
updated_at: 2026-10-31T08:50:00Z
parent: cat-tools-sr31
---

RED FLAG category: `security` (supply chain). Severity: major. Rule: `scz-pin-third-party-by-full-sha`; `security:gate` blocks on exactly this.

| file | unpinned | token |
|---|---|---|
| cat-harness `.github/workflows/release-npm.yml` | `actions/checkout@v4`, `oven-sh/setup-bun@v2`, `actions/setup-node@v4`, `softprops/action-gh-release@v2` | `contents: write`, `NPM_TOKEN` |
| cat-harness-tools `.github/workflows/release-npm.yml` | the same four | the same |
| cat-harness-tools `folio-qa-sweep.yml`, `folio-qa-sweep-nightly.yml`, `folio-section-title-audit.yml` | `actions/checkout@v7`, `actions/upload-artifact@v7` | `contents: write` (sweep, nightly) |

Evidence: `grep -n 'uses:' .github/workflows/*.yml | grep -v '@[0-9a-f]\{40\}'` in each repo, 2026-10-31 heads. A moved tag runs new code with the job's write token and the npm publish token.

Also noted, lower risk: every cat-harness caller workflow uses `litlfred/cat-harness-tools/.github/workflows/layer-*.yml@main` and `.github/actions/mount-layers@main`. Same owner, but a push to tools main changes what runs with each caller's `contents: write` token without a pin.

## Done when

- [x] `bun run cat actions:pin` applied to these workflows, with `# <ref>` comments. (tools: this PR, plus the `mount-layers` composite action by hand; cat-harness: its own PR)
- [x] `security:gate` action-sha-pinning passes in both repos. (measured 2026-10-31 on both branches)
