---
# folio-assistant-fq5u
$schema: bean/1.0.0
title: 'DOWNSTREAM TOOLS IN QA: a run record per downstream tool, and QA goes stale when its inputs change — LSI first'
status: completed
type: feature
priority: high
created_at: 2026-09-29T23:46:01Z
updated_at: 2026-09-30T17:25:23Z
parent: folio-assistant-1swy
---

**Owner, 2026-09-29:** *"also how do we know tools like LSI are run succesfully... not primary to pieple, but downstream. should be part of QA process (dependences = stall QA)"* — then chose **"Generalize after #1483"**.

## What exists (measured 2026-09-29)
- LSI (latent semantic index) is draft PR #1483 / issue #1482 / bean `ansc`, branch `claude/brave-hawking-511rrx`, NOT merged. It adds kg:audit criterion **`lsi-index-fresh`**: a large-enough prose graph with no index, or an index older than its graph's last change, is a finding (severity minor). It detects corpus staleness by fingerprint; it does NOT record whether the LSI run itself succeeded.
- Other downstream tools with INVISIBLE failure today: the site search index (`search-data.json`, built implicitly by Jekyll; nothing checks it — empty would ship green), staging generators (`|| true`), publish.yml witness regeneration / `check-witnesses` / atlas render, dispatch-only API doc builds. `check:ci-health` sees whole-run conclusions only, so all read green.
- Staleness machinery that exists but not for these: block QA sidecars (`field_hash`/`script_hash`/`deps_hash`/`def_hash`, `entryIsFresh`), `folio-test-run/v1` data/process hashes, render manifest input hashes (no outcome, no CI caller), `check:maintained-artefacts` (presence, not freshness), `publish-verify` VERIFIERS.

## Design (owner's choice)
One QA criterion family generalizing `lsi-index-fresh`: every downstream tool is a Tool node that `maintains` its output with DECLARED inputs and records its run outcome. QA reads:
- **stale** when a declared input's hash changed since the recorded run (dependencies ⇒ stale QA);
- **not-run / failed** when there is no successful run record — never green (the three-state rule);
- **fresh** only when a successful run's recorded input hash matches the current one.

## Done when
- [x] #1483 merged (this builds on `lsi-index-fresh`) — BLOCKED until then
- [x] the criterion family exists, with LSI as its first member (run outcome + input fingerprint)
- [x] the site search index is the second member, with a pre-publish verifier (present, parses, non-empty, entries ≈ page count)
- [x] a downstream tool with no declaration is itself a finding
- [x] stale / not-run surface where people already look (`bun run cat health` or the kg:audit report)

_2026-09-30T17:25:23Z_ — Claimed by claude/magical-archimedes-4qkfxp-fq5u — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

## Summary of Changes

Branch `claude/magical-archimedes-4qkfxp-fq5u`.

- **The declaration.** `schemas/tool.ts` gains `downstream` on a Tool node: `output`, declared `inputs`, `judgedAt` (`checkout` | `published`) and, for `published`, the `verifier` that judges it. Kept apart from `maintains`, which names a PUBLISHED artefact that `check:maintained-artefacts` looks for in `_site/` — LSI's output is a committed sidecar the site never carries.
- **The run record.** New `schemas/tool-run.ts` (`folio-tool-run/v1`, registered in the `qa` kind): tool, target, outcome, input fingerprint, and `downstreamState()` — fresh only for a successful run over the current fingerprint; stale when it moved; not-run / failed never green. No timestamp, so re-runs over the same inputs do not churn.
- **Member 1: LSI.** New Tool node `lsi-index`. `lsi index` writes a record on success AND failure (`indexRecorded`); `graphVerdict` now needs a successful run record, so a sidecar on disk with no record reads `not-run`. `lsi:audit` gains an `index-run-unrecorded` family.
- **Member 2: the site search index.** New Tool node `site-search-index` (`judgedAt: published`) and a `search-index` verifier in `publish-verify`'s set: present, parses, non-empty, every indexed page resolves in the tree, and indexed pages >= 0.5 x pages carrying the search box (basis: a local build on 2026-09-23 had 1,347 of 1,347; halved for pages mounted after Jekyll). The staging preview passes `--search-index borrowed`: it serves the published index or a declared-empty one, so only presence and parsing are asked.
- **The family in `kg:audit`** (`scripts/downstream-runs.ts`): per-Tool `tool-downstream-fresh` (minor; replaces the graph-level `lsi-index-fresh`), and graph-level `downstream-tool-declared` (major, repo-scoped): a member reader, a run record or a publish verifier naming a Tool with no matching declaration is a finding.
- **Where it surfaces:** the kg:audit report and sidecars. Today `tool:lsi-index tool-downstream-fresh (4)` — four prose graphs that need an index and have never been run (agent-skills/library, cat-harness/docs, smart-base/library, smart-trust/smart-trust-docs) — and `tool:site-search-index` `unknown` naming its verifier. `bun run cat health` was not extended; the box allowed either.
