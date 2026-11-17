<!-- Generated from memory/pages-deploys-are-not-on-the-default-branch.md by `bun run cat agent-memory`. -->
<!-- Not injected into MEMORY.md; read on demand. Edits here are lost. -->

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
