---
$schema: folio-memory/v1
id: pages-deploys-are-not-on-the-default-branch
label: trap
summary: "Pages deploys are not on the default branch, and cancelled is a third state"
createdAt: 2026-09-20
roles:
  - build-pipeline
references:
  - kind: agent
    id: ci-health-watcher
---
`check:ci-health`'s default-branch query **cannot see a Pages deployment**:
those runs are on the *publish* branch, raised by `github-pages[bot]` on the
`dynamic` event, in a workflow with no file. Measured 2026-09-20: the
default-branch page held **zero**, the publish branch 51 cancelled / 49 green.

**`cancelled` is a third state** — stale, not down, nobody owed a fix. Never
fold it into success or failure. Say **whose** contention it was: one deploy
pushing twice is fixed, several sessions racing for the ref is not. Report the
counts, grade no share — only the floor *"deployments happened, none succeeded"*.

**Never cached.** A Pages outcome is a fact GitHub holds about the repo, not
repository state.

<!-- detail -->
Work item `3yi4`, from the owner's correction: *"they are not. changes status of
repo. tools need to look external."*

## Why the query was too narrow rather than missing

The external reader already existed — `fetchRuns()` in the
tools layer's `scripts/check-ci-health.ts` has always called the GitHub API and
degraded with named reasons. Three properties of a Pages run defeat it at once,
so all three had to be answered together:

| property | consequence |
|---|---|
| runs on the publish branch | `?branch=<default>` excludes them |
| `github-pages[bot]`, event `dynamic` | no file for `knownWorkflows` to row |
| its workflow has no file | addressable only by a per-repository id |

Two cheaper routes were tried and refused by measurement, not by reading:
`GET /repos/{slug}/pages` answers **403** without admin, and the by-path runs
endpoint answers **404** for `dynamic/pages/pages-build-deployment`. So the
workflow list is read once and the entry found by its `dynamic/pages/` path
prefix — and the publish branch is then read off the runs' own `head_branch`,
which also makes a repository publishing from `main` report `main`.

## The measurement to repeat, never to quote

```sh
bun run cat check:ci-health           # the Pages section prints under CI health
```

51/100 cancelled with 25 self-inflicted was one afternoon. Re-run it.
