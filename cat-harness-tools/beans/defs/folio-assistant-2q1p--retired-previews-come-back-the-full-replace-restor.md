---
# folio-assistant-2q1p
$schema: bean/1.0.0
title: 'RETIRED PREVIEWS COME BACK: the full-replace restore carries _retired as a record but never consults it, so a retirement is undone by the next main-site publish'
status: completed
type: bug
priority: high
parent: folio-assistant-1xhc
created_at: 2026-10-02T12:00:53Z
updated_at: 2026-10-07T05:05:00Z
---

Found 2026-10-02 by testing ONE preview retirement before dispatching 57 —
which is the only reason it was found rather than paid for 57 times.

## The failure, measured on `gh-pages`

| commit | what it did |
|---|---|
| `a46c58ca9df` | `staging(cleanup): remove STAGING/claude-fervent-brahmagupta-rbwhzm` — **1615 files deleted** |
| `93ffa64488c` | `docs(gh-pages): site from a07c3c66…` — **all 1615 re-added** |

`git diff --name-status a46c58ca9df 93ffa64488c -- STAGING/claude-fervent-brahmagupta-rbwhzm/`
gives 1615 `A` lines. The dispatch reported **success**, and the retirement
record is on the branch saying:

```json
"retiredOn": "2026-10-02T09:17:23.071Z",
"retiredReason": "removed by dispatch from litlfred"
```

while the preview it describes is live. **The record asserted a removal that
had been undone**, which is worse than no record: its whole value is that a
reader believes it.

## Why

`docs-site.yml` full-replaces `gh-pages`, so `restore-staging.ts` carries the
previews into `_site` first — that is `plj1`'s fix and it is correct.
`CARRIED_PREFIXES` also carries `STAGING/_retired` **unconditionally**, with a
docstring explaining that a liveness-gated carry would drop exactly the records
of closed pull requests it exists to keep.

The two halves never met: the restore carried the records and restored the
previews **without consulting them**. So retirement survived as a record and
was undone as an artefact, on every deploy, for every retired slug.

The workflow's own comment anticipates the race window — *"a window in which a
`feature-staging` deploy could land a preview this push then removes"* — but
only in the direction of losing an ADDITION. The symmetric case, losing a
REMOVAL, resurrects the thing.

## Summary of Changes

- `previewsAt` excludes any slug with a `_retired/<slug>.json` record. The
  store IS the set — a record is `<slug>.json` — so no second list can fall out
  of step with it.
- `retiredSlugs` reads it, and keeps the third state: a **missing** store is a
  determined empty set, an **unreadable** one is a reason that makes the whole
  restore `unknown`. Collapsing those would restore every retired preview —
  the defect, reintroduced by the guard against it.
- `copyPrefix` became `copyPaths`, taking a LIST, because the previews can no
  longer be archived wholesale: `STAGING/` entire would copy a retired slug
  whatever the caller decided. Naming the paths keeps the decision in
  `previewsAt`, where it is tested, rather than writing directories out and
  deleting some again.
- `copyPaths` **refuses an empty list**. `git archive <rev>` with no pathspec is
  the whole tree, so a filter that removed every path would have published a
  copy of the branch over the built site.

### Verified by reproducing, not by going green

Six tests added to `restore-staging.test.ts`, on the existing harness (a real
bare remote, a real replay of the publish). With the filter reverted, **3 go
red** — the resurrection, the verifier, and the whole-tree guard. With it, 33
pass.

The fixture is deliberately the HARDER case: the retired directory is still
present alongside its record, which is what a race actually produces, rather
than a branch where the cleanup commit has already landed cleanly.

## Resolution

- [x] Code defect resolved: `previewsAt` excludes any slug with a `_retired/<slug>.json` record, and `copyPaths` takes the filtered list and refuses empty. Tested and verified in PR #1844 (`c7cb4ab0913cb8b0e39dc170d526df47aff3e042`).
- Operational cleanup of historical previews on `gh-pages` is an owner action governed by `deletion-requires-confirmation.md` and tracked in `qj9a`.

Related: `tcd6` (the cleanup job that could not run at all), `plj1` (the
full-replace deploy that deleted previews), `6pfo` (the retired-record store),
`qj9a` (staging size and what `critical` asserts).

_2026-10-07T05:01:39Z_ — Claimed by claude/2q1p-close-on-evidence — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

## Evidence

Closed on evidence per AGENTS.md bean discipline:
1. Landed on `main` in PR #1844 (commit `c7cb4ab0913cb8b0e39dc170d526df47aff3e042`: *"Staging cleanup could not run, and retirement did not stick — fix both, and gate the first (#1844)"*).
2. `cat-harness/scripts/restore-staging.ts` implemented `retiredSlugs`, updated `previewsAt` to exclude retired slugs, and switched `copyPrefix` to `copyPaths` with non-empty validation.
3. 33 unit and fixture tests pass in `cat-harness/scripts/tests/restore-staging.test.ts` (including reproduction/reversion tests).
4. Bean hygiene tests pass.
