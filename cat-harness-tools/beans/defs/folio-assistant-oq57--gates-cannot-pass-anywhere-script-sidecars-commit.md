---
# folio-assistant-oq57
$schema: bean/1.0.0
title: 'GATES CANNOT PASS ANYWHERE: script sidecars commit engine_version, so main''s new tree-write detector fails on whichever bun version is in the minority'
status: completed
type: bug
priority: normal
created_at: 2026-09-26T20:07:20Z
updated_at: 2026-09-27T06:07:18Z
parent: folio-assistant-1swy
---

Measured 2026-09-26, immediately after merging 51 commits of `main`.

`main` added a check I welcome — `bun run cat gates` now FAILS a run in which a gate
wrote to the tree it is being judged on, even when every gate passed:

    ✗ every gate passed, and the run is NOT clean — 1 gate(s) changed the tree.
      164 verdict(s) above were reached against a tree that a gate had already
      repaired, so the later ones describe a state you have not committed.

That is bean `ymsu`'s subject instrumented, and it is the right check. **It also
cannot be satisfied by anybody, and the reason is already committed.**

## The measurement

`bun test` rewrote **72** script sidecars under
`cat-harness/content/pipeline/script-sidecars/`. The diff per file is not content:

    - "last_run_at": "2026-09-26T19:43:36.482Z"      + "2026-09-26T20:01:32.915Z"
    - "last_run_sha": "abee3acee29e…"                + "80743fab7cfc…"
    - "engine_version": "bun-1.3.14"                 + "bun-1.3.11"

`saveQaScriptSidecar` in `content/pipeline/qa-utils.ts` guards correctly — it
skips the write unless something SUBSTANTIVE changed, comparing `source_file`,
`script_hash`, `script_commit_sha`, `deps_hash`, `engine_version` and
`extra_inputs`, deliberately excluding the two `last_run_*` fields. So the write
happened because **`engine_version` genuinely differs**, and the guard is doing
its job.

**The repository already carries BOTH values:**

    bun-1.3.14 : 72 sidecars
    bun-1.3.11 : 14 sidecars

Written by two different machines. This container runs `bun 1.3.11`; whatever
last swept the other 72 ran `1.3.14`.

## Why there is no fixed point

`engine_version` is a property of the RUNNER, not of the corpus, and it is
committed. So:

- commit my regeneration → 86 sidecars say `1.3.11`, and the next machine on
  `1.3.14` rewrites 86 and its own `gates` run fails
- leave it → my `gates` run fails on 72, every time, forever
- and whichever way it settles, the minority camp's `gates` can never be clean

The tree-write detector turns a pre-existing cosmetic churn into a HARD failure
for everyone whose toolchain differs from the last committer's. Both decisions
are individually right; together they are unsatisfiable.

## What this is NOT — and the archived bean that says so

`kto9` (completed, archived) investigated this exact file family and concluded
*"re-running the sweep leaves every `script_commit_sha` byte-identical; only
`last_run_at` / `last_run_sha` / content hashes move."* That reading treated
`engine_version` as content-derived and stable. **It is not stable**: it is the
runner's. So `kto9`'s conclusion holds only while every contributor runs one bun
version, which the 72/14 split shows is already false.

Not the same as `xd1g` either, though it is the same FAMILY — a committed
measurement whose value depends on the environment. `xd1g` is about scans
reading the wrong FILES; this is about a field recording the wrong MACHINE.

## Candidate remedies — NOT chosen, this is an owner call

1. `engine_version` stops being committed (moved out of the sidecar, or normalised
   to a major/minor). Smallest change; loses the ability to say which engine
   produced a verdict.
2. The tree-write detector ignores paths whose only diff is run metadata. Keeps
   the provenance; weakens the detector with a path list, which is the shape
   `xd1g` teaches not to trust.
3. The toolchain is pinned so every runner agrees. Correct in principle and not
   this repository's to enforce on a contributor's laptop.

I am NOT choosing. Recommendation if asked: (1), because a field that records the
runner is provenance about the RUN and belongs with the run, not in the corpus —
and `kto9` already excludes the other two run fields from the comparison for
exactly that reason, so (1) finishes a line of reasoning the code has half made.

## Done when

- [ ] the owner picks a remedy, recorded here in their words with a date
- [ ] `bun run cat gates` is clean on two machines with DIFFERENT bun versions, from
      the same commit. MEASURED AFTER: both runs report no tree write
- [ ] the `72 / 14` split is gone — one value, or no value


## Resolved by #1442, and this bean was the THIRD independent filing — 2026-09-27

The cause is identified and pinned. `3ozg` is the record to read; this one carries
nothing it does not, so it closes with a pointer rather than staying open.

**What the cause actually was**, established by another session and re-read here
rather than taken on trust: `saveQaScriptSidecar`'s write-skip guard
(`qa-utils.ts:1769`) compares `engine_version` along with the content hashes, and
deliberately excludes `last_run_at` / `last_run_sha`. So `engine_version` was the
only one of the three fields that could ever CAUSE a write, and the other two were
passengers. Nothing pinned Bun — `engines.bun` was a `>=1.0.0` floor and 22
`setup-bun` sites resolved a version at runtime, 18 of them saying `latest` — so CI
itself would have rewritten all 86 sidecars to whatever Bun shipped next.

#1442 landed `.bun-version` at `1.3.14`, that literal at all 22 sites, an
`upstream-pins.json` row and `check:bun-pin`. Verified on this branch after merging:

    Bun pin — .bun-version says 1.3.14; 22 setup-bun site(s) across 33 workflow(s)
      ✓ every site installs it

**This bean's own framing was wrong in one respect worth naming.** It offered
"schema change, weaker detector, or pinned toolchain" as the remedies and read the
detector as the thing at fault. The detector was right every time it fired: a gate
WAS writing to the tree under test. The defect was upstream of it.

**What does NOT close, and it is tracked on `3ozg`, not here.** The pin cannot reach
a container image the repository does not control. Measured on this branch after the
merge: `.bun-version` says `1.3.14`, this container runs `1.3.11`, so `bun test`
here still rewrites the 72 sidecars whose stamp differs, and `bun run cat gates` still
ends 'NOT clean' locally. `3ozg` holds that as an open owner question — pin `1.3.14`
(status quo; CI clean, agent containers not) versus `1.3.11` (both clean, at the
cost of one commit regenerating 72 sidecars and pinning an older patch than the
artefacts record). Adoption of `1.4.2` is a separate, person-only path under
`processes/upstream-version-adoption.bpmn`.

Three beans reached this population independently inside a day — `rmcf` (09-26),
`3ozg` (09-27) and this one — which is what an always-red signal does: every session
that runs `gates` on a clean tree sees it, and nothing told them it was already
written down.
