---
# folio-assistant-676g
$schema: bean/1.0.0
title: kg:validate cannot own a NESTED instance's path, so 15 instances' committed QA sidecars are consumer-validated by nothing
status: completed
type: task
priority: normal
created_at: 2026-09-27T16:50:03Z
updated_at: 2026-10-02T06:44:57Z
parent: folio-assistant-1xhc
---

## What was measured

`kg:validate` resolves declared directories from ONE instance root, so a sidecar
in a nested instance is refused rather than validated. Measured 2026-09-27, from
the repository root:

    bun run cat-harness/scripts/kg-validate.ts cat-harness/test/results/kg-qa/processes/adjudication.kg-qa.json
      ✓ … [qa]

    bun run cat-harness/scripts/kg-validate.ts bootstrap/test/results/kg-qa/skills/discussion.kg-qa.json
      ? … could not determine: no declared directory owns this path, or the one
          that does declares several graphs and which applies is not stated

    bun run cat-harness/scripts/kg-validate.ts smart-dak/test/results/kg-qa/scenarios/kg.kg-qa.json
      ? … same

**This is PRE-EXISTING, not caused by the loop.** bootstrap declared `qa` →
`test/results/` and committed its sidecars in bean `bjzs` box 6, before
`kg:audit:all` existed, and they have never been consumer-validated either. The
per-instance loop did not create the gap; it multiplied the artefacts sitting in
it from 2 instances to 15.

The message's second clause is a red herring here: `smart-dak.json` declares
`test/results/` with `graphKinds: ["qa"]` — exactly one kind — so the failing
branch is "no declared directory owns this path", i.e. the resolver never read
that instance's declaration at all.

## Why it matters, in the corpus's own terms

`check:artefact-verification` asks, per generated-artefact check, *what verifies
the artefact for its CONSUMER* as opposed to verifying the committed copy is
current — and its own comment says why the distinction is not academic:

> the difference has cost six pages — `library:viz:check` was green while the
> page it generated could not run (PR #805).

`kg:audit:all:check` proves currency: every sidecar matches what the auditor
would write today. Nothing proves a sidecar PARSES as `kg-qa/v1` for a reader
that picks one up, because the one tool that would say so cannot address it. So
the entry for that gate is `none` with this bean as its reason, not `verified`.

## What this is NOT

Not `pgzn`. That one is `kg:audit --instance .` crashing on the instance declared
at the repository ROOT. This is the reverse direction: a consumer run from the
root failing to own a NESTED instance's declared path. Same family as the five
cross-instance issues in `bjzs`, and the same polarity as the fifth — a tool
seeing less than the declarations say.

## Done when

- [x] `kg:validate <nested-instance>/test/results/kg-qa/**` validates rather than
      reporting "could not determine" — for bootstrap and for the 13 the loop
      added.
- [x] a test pins it against a nested instance, not only the auditor's own.
- [x] `artefact-verification.json` moves `kg:audit:all:check` from `none` to
      `verified`, naming what does the validating. That move is the reason this
      bean exists, and the declaration file may only shrink in the `none`
      direction.

Claimed by claude/kg-audit-bugs (session https://claude.ai/code/session_01CVVoavPoCHMLA7AASxG8cH)

## Summary of Changes

Branch `claude/kg-audit-bugs`, PR #1842, issue #1835.

**Reproduced** on `main` `cf3e624`: `kg:validate smart-dak/test/results/kg-qa/scenarios/kg.kg-qa.json` →
`could not determine: no declared directory owns this path`. The cat-harness sidecar validated.

**Root cause, in two halves**:
1. `kg-validate.ts` passed its own instance root (`cat-harness/`) for every path, so a nested
   instance's declaration was never read.
2. Fixing only (1) gave a new refusal: `schemas/kg-qa.ts does not exist under the instance root …/smart-base`.
   The `qa` kind's validator refs are relative to the instance whose registry DEFINES the kind (cat-harness),
   not the instance that owns the file.

**Fix**: `owningInstanceRoot(path, fallback)` returns the deepest instance in the checkout that contains the
path, by longest prefix, the rule `kindForPath` already uses. `validatePath(file, root, schemaRoot = root)`
keeps the two roots apart.

**Done when**:
- [x] All 701 committed kg-audit sidecars across the checkout validate (`✓` 701, `?` 0). That covers bootstrap
  (hosted), the 13 nested instances and the root instance.
- [x] `cat-harness/scripts/tests/kg-validate-nested-instances.test.ts` checks the deepest-owner rule. It
  includes a falsifier showing the old single root refuses a smart-dak sidecar. It then sweeps every
  instance's `kgQaHomeFor` home, with a floor of at least 5 non-cat-harness instances and more than 50 files.
- [x] `artefact-verification.json` moves `kg:audit:all:check` from `none` to `verified`, naming that test.
