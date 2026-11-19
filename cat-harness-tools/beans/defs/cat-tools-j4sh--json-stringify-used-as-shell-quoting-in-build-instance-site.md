---
# cat-tools-j4sh
$schema: bean/1.0.0
title: 'JSON.stringify IS NOT SHELL QUOTING: build-instance-site builds bash -c strings with JSON-quoted paths and excludes, where $( ) and backticks still expand'
status: completed
type: bug
priority: low
created_at: 2026-10-31T04:05:00Z
updated_at: 2026-10-31T08:50:00Z
parent: cat-tools-sr31
---

RED FLAG category: `security`. Severity: minor. Rule: `scz-value-never-becomes-program-text`.

`scripts/build-instance-site.ts:695-696` (`publishedRoot`) and `:778`, `:807`, `:814` pass strings through `run()` / `capture()`, which are `spawnSync("bash", ["-c", cmd])` (`:566-575`). Values are wrapped with `JSON.stringify`, which yields a double-quoted string: inside it bash still expands `$(...)`, backticks and `$VAR`. The exclude list and site paths come from layer declarations, which are a trust boundary for a mounted remote layer (security.md, "a remote graph → this instance").

`run-script.ts` already has `shellQuote` for exactly this.

## Done when

- [x] Use argv (`spawnSync("git", [...])` piped to tar) or `shellQuote`.
- [x] A test with an exclude of `$(touch /tmp/x)` shows nothing runs.
