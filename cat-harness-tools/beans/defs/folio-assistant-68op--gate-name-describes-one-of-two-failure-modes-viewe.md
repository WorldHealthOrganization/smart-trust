---
# folio-assistant-68op
$schema: bean/1.0.0
title: 'GATE NAME DESCRIBES ONE OF TWO FAILURE MODES: ''viewer pages keep the navbar they had'' goes red when the sidecar is ABSENT, and the same run says 0 pages regressed'
status: completed
type: bug
priority: normal
created_at: 2026-10-03T01:08:12Z
updated_at: 2026-10-07T11:50:39Z
parent: folio-assistant-rwmf
---

The step name in `code-quality-gates.yml` names the REGRESSION branch of
`check:viewer-nav`. The check has two failure modes, and the other one -
the sidecar is absent, so the audit cannot see its subject - fails under
the same name. A reader then goes looking for a page that lost its rail,
and the same run tells them none did.

## Measured 2026-10-03 (on PR #1819, heads c975c7da7b9 and 28746eb6a8d)

Job "Repository gates (hard)", step "viewer pages keep the navbar they
had", runs 37080417880 and 37082448045, both red. Reproduced locally at
both heads:

    $ bun run cat check:viewer-nav
      ✗ cat-harness/test/results/viewer-nav/viewer-nav.qa.json is missing — run `bun run cat viewer:nav:audit`
      62 railed, 64 declined, 0 missing, of 126 generated viewer page(s); 0 railed page(s) fail a layout flag

`0 railed page(s) fail a layout flag` and `0 missing`. Nothing regressed.
The gate is red because `viewer-nav.qa.json` was deleted from that branch
by a hand merge resolution, so there is no prior verdict to regress FROM.

## THE SCRIPT IS NOT THE DEFECT — do not "fix" it

`cat-harness/scripts/check-viewer-nav.ts` is right and deliberate. Its
comment at the absent-sidecar branch states the reasoning:

| with no sidecar there is no prior verdict to regress FROM, so the gate
| would pass over anything. A check that cannot see its subject is never
| green — the could-not-determine rule, and the one case where absence is
| the finding rather than a third state.

That is `ci-health`/`health` rule 1 applied correctly, and its console
output names the real cause on the first line. Changing the script would
trade a naming defect for a blind gate.

## The defect is the step NAME, and it is one line

`.github/workflows/code-quality-gates.yml:1143`. The name asserts the
invariant the gate protects, which reads well for the regression branch
and misdescribes the could-not-determine branch. A gate whose name
describes a symptom it is not detecting is worse than an unnamed one: it
sends the reader to the wrong subject with confidence.

## Why this is worth a bean rather than a drive-by rename

The same shape is likely elsewhere: a step named after ITS INVARIANT
rather than after ITS CHECK will misdescribe every could-not-determine
failure in the repo, and the could-not-determine branch is exactly the
one a reader meets least often and understands worst. Worth one sweep
over the step names in `code-quality-gates.yml` for others whose script
has a "cannot see its subject" path.

## Done when

- [x] step 1143 (line 2069) renamed to cover both branches (invariant AND audit
      reachability), without weakening it to something contentless like
      "viewer-nav check": `viewer pages keep the navbar they had, and audit is reachable`
- [x] a sweep over the other step names in code-quality-gates.yml for
      scripts with a could-not-determine path, reporting which are
      mis-named rather than renaming them all blind
- [x] a line in the ci-health skill (`cat-harness/skills/sdlc/sdlc-core/ci-health.md`):
      a step name must describe what the CHECK does, because a
      could-not-determine red wears the same name as a finding

## Evidence

The step is renamed in `.github/workflows/code-quality-gates.yml` (`viewer pages keep the navbar they had, and audit is reachable`), the step-name rule is added to `ci-health.md`, and the sweep below found no other mis-named step; `check:workflows` and `check:viewer-nav` pass on this branch (PR #2348).

### Sweep results over `code-quality-gates.yml`
Swept all 136 steps in `code-quality-gates.yml`:
- Most steps running checks with could-not-determine or missing-baseline branches are named descriptively after the subject under test (e.g. `workflow skill refs`, `knowledge-graph audit`, `swimlane definitions`, `tool definitions`).
- Dual-branch steps already explicitly name both the invariant and the allowance/remedy (e.g. `declared directories exist, or say why not`, `state directories are off main, or recorded as debt`, `every bound prefix is emitted, or declared forward with a reason`, `cat-harness fails standalone no more than its baseline`).
- The single notable outlier asserting only the passing invariant despite failing when the audit sidecar/baseline is unreachable was `viewer pages keep the navbar they had`.
- Renamed step to `viewer pages keep the navbar they had, and audit is reachable` in `.github/workflows/code-quality-gates.yml:2069`.
- Added section "Step names describe what the check does, not merely its passing invariant" to `cat-harness/skills/sdlc/sdlc-core/ci-health.md`.
- Verified `bun run cat check:workflows` (36 workflows parse and validate cleanly).
- Verified `bun run cat check:viewer-nav` (clean exit 0).

## Provenance

Found while triaging whether the un-PR'd `handover-1804/-1819/-1808`
branches held recoverable conflict resolutions (they did not - all three
were already strict ancestors of their PR branches). The sidecar deletion
itself is recorded against `d33q`; this bean is only about the gate name.
Raised at the merge manager's request.

_2026-10-07T01:30:16Z_ — Claimed by claude/68op-gate-name-viewer-nav — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).
