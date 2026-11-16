---
# cat-tools-5fmc
$schema: bean/1.0.0
title: 'SCRATCH TREES LEAK: publish-check and ig-index:build leave multi-GB trees in os.tmpdir() when they fail or are cancelled'
status: completed
type: bug
priority: normal
created_at: 2026-11-06T07:40:00Z
updated_at: 2026-11-08T14:35:00Z
parent: folio-assistant-1xhc
---

Measured 2026-11-05 in a cloud session: leaked `/tmp/publish-check-tree-*` copies (5-6 GB each) and `/tmp/ig-index-*` work directories (447 MB) filled the disk, so the next run failed with ENOSPC and leaked again.

- `scripts/publish-check.ts` `scratchCopy`: a copy that throws partway (a full disk, a FIFO) never returned its root, and the `exit` hook was registered only after it returned. SIGTERM and SIGINT (a cancelled job, a timeout) do not reach `exit`.
- fhir-harness `scripts/build-ig-indexes.ts`: the `ig-index-*` work directory it creates (when `--work` is not given) is never removed, on success or failure.

## Done when

- [x] `scratchCopy` removes a partial copy before rethrowing; publish-check removes its copy on SIGINT and SIGTERM. Test: a copy that fails partway leaves `os.tmpdir()` empty.
- [x] build-ig-indexes removes the work directory it created, in a `finally`, and keeps one given by `--work`. Test: fail partway, `os.tmpdir()` clean.

## Completed (2026-11-08)

Both tmpdir cleanup fixes are merged on `main`:

- `litlfred/cat-harness-tools#1582` (`3bdfef2c2b501`, merged as `e5474d05ffdb`): `publish-check: remove scratchCopy on partial failure, SIGINT and SIGTERM`, tested in `scripts/tests/publish-check-scratch.test.ts`.
- `litlfred/fhir-harness#297` (`e6e6bd731f0c6`, merged as `5e6f2972eefc`): `build-ig-indexes: remove tmpdir work directory in finally when --work is not given`.
