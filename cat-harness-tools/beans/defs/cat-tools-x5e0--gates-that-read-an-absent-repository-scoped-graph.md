---
# cat-tools-x5e0
$schema: bean/1.0.0
title: Gates that read an absent repository-scoped graph should say not-applicable, not fail (content indexes outside folio-assistant)
status: completed
type: bug
priority: high
tags:
    - ci
    - state-mount
created_at: 2026-10-21T07:39:52Z
updated_at: 2026-10-23T09:05:00Z
parent: folio-assistant-1xhc
---

A content index outside folio-assistant (here smart-immunizations, `layer-pr-checks.yml` in index mode) cannot mount the platform's repository-scoped state graphs. `state-mount.ts` reports cat-harness's `beans` and `fsh-guts` as `absent` there, by the owner's ruling of 2026-10-14 (smart-ra#59 "Report as absent"; tools#249 "Tighten it"). Several consumers still read `absent` as a failure or UNKNOWN, so any index that re-pins cat-harness past cat-harness#363 goes red on gates it can never satisfy.

Measured on litlfred/smart-immunizations#66 (771314f, cat-harness ac96988, cat-harness-tools ca99a6b). These are the 4 NEW gate failures:

1. `sweep:mark:check`: UNKNOWN, "beans is on cat/cat-harness/beans and is not mounted".
2. `derive:publish`: stops at `gen-fsh-guts-viz` (exit 2, fsh-guts not mounted), so the pages built at publish are never written. Hence:
3. `document-kinds:viz:check`: `en/cat-harness/document-kinds/index.html` and `.../smart-base/index.html` are "missing".
4. `skill:register:check` and `skill:register:declarations:check`: "no package manifests found — cannot tell registered from unregistered". Not yet explained; it may be a different cause.

## Done when

- Each consumer of a repository-scoped graph that `state-mount` reports `absent` decides, and says in its own output, whether that makes the gate NOT APPLICABLE (skipped, with the reason) or a real failure. A decision per gate, not a blanket rule.
- `derive:publish` skips a writer whose input graph is `absent` (reported, not exit 2), so the other publish-time pages are still built.
- `skill:register`'s missing manifests are explained, and fixed or classified.
- smart-immunizations#66's "No new failures" goes green without changing smart-immunizations.

## Proposed design (2026-10-21, session_016heucWhrncLm4uy52csBcz)

`absent` is decided only at mount time (`state-mount.ts` `fanOut`, which asks the remote whether it carries the namespace). Readers run offline and cannot decide it again, so today they see the same "not mounted" whether the graph is absent or never mounted.

1. **Record it.** When `fanOut` reports `absent`, write `<git-dir>/branch-mounts/<key>.absent.json` with `{id, path, declaredBy, reason}`. A later `mounted` clears it. The record lives beside the mount markers and in the worktree only, never committed.
2. **Answer it.** Add `absent` as a state of `contentAt` (branch-store.ts) and `graphReadPath` (graph-read.ts), answered from the record, and only where a record exists. With no record, the answer stays `not-mounted`/`refused` as today, so "never mounted" still reads as could-not-determine.
3. **Decide per consumer** (the bean's point):
   - `exitUnlessMounted`: `absent` is not applicable. Exit 0 with the reason, write nothing, and let `derive:publish` continue, so the document-kinds pages are built.
   - `sweep:mark:check` (via `resolveBeanGraphNode`): `absent` gives judgement `ok` with "not applicable: …".
   - Every other caller of the two resolvers keeps treating `absent` as it treats `refused` until someone decides otherwise. That is the safe default: no reader turns an absent graph into an empty pass.
4. `skill:register`'s "no package manifests" is investigated separately; it does not look like the same cause.


*2026-10-22T16:45:00Z* — Status (lane A drain, session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr). Three of the four Done-when boxes are met on main:

- **Consumers say not applicable** and **derive:publish skips an absent writer**: #520 (61804f07, 2026-10-21), the proposed design above.
- **skill:register's missing manifests are explained and fixed**: #521 (ac55077b, 2026-10-21, bean j3ls). The cause was not the absent graph. The instance judged is the one mounting the harness, and smart-immunizations declares no knowledge-graph directory: its smart-immunizations.json declares library, l1-extraction and qa only, and none is a KG content typology. It was read as "cannot tell" (exit 2). It is now not applicable (exit 0). Re-measured here against smart-immunizations f6be51f: declaredKgDirectories returns []. The four failures in the body were measured at tools ca99a6b, which predates both PRs.

**Still open:** smart-immunizations#66 goes green without changing smart-immunizations. This was NOT measured here, because litlfred/smart-immunizations is not in this session's repository scope. It needs a re-run of #66's layer-pr-checks with tools pinned at or after ac55077b. Close this bean when that run is green.

## Summary of Changes

All four Done-when boxes are met.

- **Consumers of an `absent` graph say not applicable, and `derive:publish` skips an absent writer:** #520 (61804f07), as designed above.
- **`skill:register`'s missing manifests are explained and fixed:** #521 (ac55077b, bean j3ls). smart-immunizations declares no KG directory, so the check is not applicable (exit 0), not could-not-tell (exit 2).
- **smart-immunizations#66 is green without changing smart-immunizations:** verified here on 2026-10-23.
  - Head `b89d8caa` has every check successful: "checks / No new failures (tests and gates)", head shards 1–4, and both prepare jobs.
  - Lane S re-ran it with every layer at main (08:58Z).
  - #66 is merged. Its only changes are `index.config.json` and `index.lock.json`, so pins move and no smart-immunizations content changes.

Closed by lane A (session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr) on the coordinator's report, which was checked against the PR's check runs and file list.
