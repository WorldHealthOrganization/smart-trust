---
# folio-assistant-pgzn
$schema: bean/1.0.0
title: 'kg:audit --instance . crashes: the ROOT instance''s repoRoot resolves outside the checkout'
status: completed
type: task
priority: normal
created_at: 2026-09-27T08:00:22Z
updated_at: 2026-10-02T06:44:57Z
parent: folio-assistant-1xhc
---

## What was measured

`bun run cat-harness/scripts/kg-audit.ts --instance .` exits 1 before auditing
anything. Measured 2026-09-27 on `main` (b4d85f2cf4) as well as on the branch, so
it is pre-existing and not introduced by the skill-resolution fix that found it:

    ENOENT: no such file or directory, open '/home/user/package.json'
      at rootScripts (cat-harness/scripts/pair-claims.ts:181:26)
      at cat-harness/scripts/kg-audit.ts:2504

## Cause

`kg-audit.ts` computes the repository root by hand:

    const repoRoot = resolve(root, "..");

That is `dirname`, and it is correct for every instance EXCEPT the one declared
at the repository root. `folio-assistant.json` sits at the checkout root, so
`root` is the checkout and `resolve(root, "..")` is `/home/user` — outside the
checkout entirely, where there is no `package.json`.

`schemas/harness-config.ts` already documents this exact trap on
`dependenciesFromNeeds`, which chose the other helper for the same reason:

> `siblingScopeFor`, NOT `repoRootFor`: this is a lookup of SIBLINGS by name,
> and `repoRootFor` is `dirname`, which climbs out of the checkout for the one
> instance declared at the repository root. That made the root instance's
> `needs` derive nothing while its authored edge still resolved — an overlay
> that looked like it worked and held one entry.

So this is that bug class at a second call site, with a hand-rolled `dirname`
rather than even `repoRootFor`.

## Why it went unnoticed

The DEFAULT run never audits this instance. `root` defaults to `AUDITOR_ROOT` —
`cat-harness/`, where the script lives — so `folio-assistant`, the instance
declared at the repository root, is audited by nothing unless somebody passes
`--instance .`. That is the `dh4f` shape: not a wrong answer, an absent one.

## Why it is not fixed here

`repoRoot` is passed on to three consumers — `rootScripts`, `discoverPairs` and
`evaluatePairs` — so the fix has to decide what "the repository root" MEANS for
the root instance in each, which is a different subject from skill resolution.
Absorbing it into that change would widen the PR past what the failure needs.

## Done when

- `kg:audit --instance .` audits rather than throwing.
- The root-instance case is exercised by a test, not only by a manual run.
- `scripts/tests/resolution-across-needs.test.ts` drops its `ROOT_INSTANCE`
  exclusion, which names this bean as the reason it exists.

Claimed by claude/kg-audit-bugs (session https://claude.ai/code/session_01CVVoavPoCHMLA7AASxG8cH)

## Summary of Changes

Branch `claude/kg-audit-bugs`, PR #1842, issue #1835.

**Reproduced** on `main` `cf3e624` (2026-10-02): `bun run cat-harness/scripts/kg-audit.ts --instance .` →
`ENOENT: no such file or directory, open '<parent of checkout>/package.json'` at `rootScripts`
(`kg-audit.ts:2717`).

**Root cause** as recorded above, plus seven more call sites of the same class: `repoRootFor(root)`
(`dirname`) was used for the actor and capability registries, `conventionsDir`, `git ls-files`,
`.claude/skills/local`, `skillDefinitionDirs` and `unreadNestedInstances`. For the root instance
each one read a directory above the checkout and said nothing.

**Fix**: `kg-audit.ts` now declares one module constant, `REPO_ROOT = checkoutRootFor(root)`, and
every "where is the repository" question reads it. `checkoutRootFor` matches `dirname` for every nested
instance (measured over all 18) and returns the root itself for the root instance. `kind-validator.ts`'s
`rootOf` had the same trap and now uses `siblingScopeFor`.

**Done when**:
- [x] `kg:audit --instance .` audits: 1 subject, pass 7 / fail 0 / n/a 12 / unknown 3. Its sidecars are
  committed under the hosted home `cat-harness/test/results/folio-assistant/`.
- [x] The test is `cat-harness/scripts/tests/kg-audit-root-instance.test.ts`. It fails on `origin/main`'s
  `kg-audit.ts` with the ENOENT and passes with the fix.
- [x] `resolution-across-needs.test.ts` no longer has `ROOT_INSTANCE` (9/9 pass), and `kg-audit-all.ts` no
  longer skips the root instance, so `kg:audit:all` now covers every declared instance.

The root instance's audit raises one MAJOR finding, `arrow-direction` → unknown: "no schemas directory to
read `@general` declarations from". It is recorded in the sidecar and was not fixed here.
