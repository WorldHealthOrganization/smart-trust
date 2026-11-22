---
# cat-tools-w7tx
$schema: bean/1.0.0
title: 'WITNESS DATA BECOMES PROGRAM TEXT: witness-parity runs a committed witness JSON invocation.reproduce string as bash -c with the full process environment'
status: completed
type: bug
priority: normal
created_at: 2026-10-31T04:05:00Z
updated_at: 2026-10-31T08:50:00Z
parent: cat-tools-sr31
---

RED FLAG category: `security`. Severity: minor. Rule: `scz-value-never-becomes-program-text`.

`scripts/witness-parity.ts:181` takes `invocation.reproduce` from the witness file (a committed data file) and `:206` runs it with `spawnSync("bash", ["-c", reproduce], { env: { ...process.env } })`. A pull request that adds or edits a witness therefore runs any command wherever `witness:parity` runs, with every secret in that environment. The scratch worktree limits what it reads, not what it can do.

## Done when

- [x] reproduce is parsed into an argv against a declared table of producers (as `run-script.ts` does for script names), or the run gets an empty environment plus an allowlist.
- [x] A test with a witness whose reproduce is `touch /tmp/x; true` shows it refused.
