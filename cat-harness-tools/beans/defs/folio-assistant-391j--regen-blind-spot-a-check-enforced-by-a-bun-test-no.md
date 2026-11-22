---
# folio-assistant-391j
$schema: bean/1.0.0
title: 'MERGE SKEW: two green branches merged into a red main (prov-qaqc, 2026-09-24) — not a regen blind spot as first diagnosed; owner decides merge queue vs up-to-date vs fix-forward'
status: completed
type: bug
priority: normal
created_at: 2026-09-24T06:06:37Z
updated_at: 2026-09-30T22:33:44Z
parent: folio-assistant-1xhc
---

Measured 2026-09-24. Main went red on 10b48aed (the #1246 merge) in `TypeScript — tests, lint, types`: the test `prov-qaqc: the real repository > the committed page and logs are current (what check:prov-qaqc gates)` failed. #1245 had added the report; 172b558d (#1190) then committed a new workflow instance without regenerating it. It was fixed by a pure regeneration in #1249.

**Why `bun run cat regen` missed it:** `regen-after-merge.ts` asks only the `:check` scripts that `gates.ts` loads from `code-quality-gates.yml`. `check:prov-qaqc` is enforced by a bun TEST, not by a workflow step, so regen never asks it. A branch that merged main and ran `regen` as instructed could still turn main red.

## Done when
- [x] ~~`regen` asks every `:check` that CI enforces~~. **Not needed:** it already does, and the premise was wrong (see the correction below).
- [x] ~~The same audit for other test-enforced `:check`s~~. **Not needed**, for the same reason.

## Correction, 2026-09-24: the diagnosis above is wrong

**`check:prov-qaqc` IS a CI workflow step** (`code-quality-gates.yml`, "PROV-O QA/QC report"), so `gates.ts` loads it and `regen` does ask it. The premise that it is enforced only from inside a test was false. I inferred it from the test's name and did not check the workflow.

**What actually happened was merge skew, measured:**
- Main went red at **`08fe2c68`**, the merge of #1245, one merge BEFORE mine. That run's `TypeScript — tests, lint, types` failed the same test.
- #1245's branch head `3d5f03d3` lacked `172b558d` (#1190's new workflow instance); main's parent `e5cf533d` had it. Each side was green alone. Their combination was a stale report, and it existed only after GitHub merged them.
- No `regen` on either branch could have seen it. My merge (`10b48aed`) was simply the next CI run on main.

**The real gap:** a PR is merged without being tested against the main it merges into. GitHub offers two remedies, both repository settings, so the owner decides:
- "require branches to be up to date before merging": each PR re-runs CI after merging main in. With several sessions merging every few minutes, that is a constant re-run.
- a **merge queue**: GitHub tests the combination before it lands. The workflows would need to trigger on `merge_group`.

The mitigation in use today is fixing forward fast: #1249 and #1257 each fixed a red main within minutes.

## Done when (re-scoped)
- [x] The owner decides: merge queue, up-to-date requirement, or fix-forward as policy (recorded here). **Decided 2026-09-24: fix forward.**
- [x] If a merge queue: the workflows gain `merge_group:` triggers. **Not applicable: the owner chose fix-forward.**

## Summary of Changes
The first diagnosis ("regen misses test-enforced checks") was wrong: `check:prov-qaqc` is a workflow step. The measured cause was merge skew. #1245's branch lacked #1190's workflow instance, so main was red at #1245's own merge (`08fe2c68`), one merge before the one that got blamed. The owner chose **fix forward** over a merge queue or an up-to-date requirement. `continual-progress` gains a section on it: watch main after every merge you make, fix a red main you find in a small PR of its own, and check the parent before blaming the last merge.

## Five more witnesses in one session, 2026-09-30 — the rate, not just the shape

2026-09-24 measured this once. A session that merged **seventeen** PRs on
2026-09-30 turned `main` red **five** times, and four are this bean's shape:
a corpus-walking artefact staled by the merge sequence rather than by any
diff in it.

| # | what went red | cause |
|---|---|---|
| 1 | `readme:subgraphs:check` | a GitHub **web-UI** upload added 3 PDFs to `uploads/` and ran no generator |
| 2 | `check-bean-parents` | bean `14ve` landed with no `parent` |
| 3 | `readme:subgraphs:check` | `beans/README.md`, `scripts/README.md` — merges, shifting bases |
| 4 | `voices:viz` `folio:viz` `docs:auto` `kg:detangle` | four projections — same |
| 5 | `audit:coverage:strict` + `:require-all` | sidecar recorded 177 gates; a gate had been added, making 178 |

**Incident 2 is the one that costs the most to diagnose**, and it is why the
shape matters more than the count: the failing job was `TypeScript — tests,
lint, types (hard)`, on two pull requests whose diffs were **bean markdown and
nothing else**. The check walks the real corpus, so the failure belonged to no
diff. A reader who trusts the job name looks for a TypeScript regression that
is not there.

**Incident 1 adds a route this bean did not have.** A web-UI commit runs no
generator AND, committed straight to `main`, skips the pull request where CI
would have caught it. Neither remedy this bean names — merge queue, or
require-up-to-date — touches that route, because there is no branch to be out
of date.

### What this does NOT change

The diagnosis stands and the remedy is still a repository setting the owner
picks. Nothing here argues for one over the other; it measures the rate at
which the gap bites when several sessions merge in one window, which is the
number the choice actually turns on.

`bun run cat regen` remains the manual remedy and it works — incidents 3, 4 and 5
were each fixed by running it and committing. **Nothing automates it after a
merge**: `grep -rn regen .github/workflows/` finds no invocation. Whether that
should change is part of the same open decision.


## The ruling REVERSED, 2026-09-30 — merge queue, not fix-forward

This bean closed with *"the owner chose **fix forward** over a merge queue or an
up-to-date requirement"*. **That is no longer the ruling.** Asked again on
2026-09-30 after a day of measured skew, the owner chose **turn on the merge
queue**. Recorded here rather than in a new bean because a superseded decision
left standing in a completed bean is exactly how the next agent implements the
old one.

### What changed between the two rulings is a rate, not an argument

2026-09-24 had **two** skew incidents, each fixed within minutes (#1249, #1257),
and fix-forward was a proportionate answer to that.

2026-09-30 had **nine** red-`main` incidents in one day. Of those, **five were
corpus-walking artefacts staled by the merge *sequence*** — each branch green
alone, the combination stale, which is this bean's mechanism exactly and not a
new one. Three `Unblock main:` PRs were needed in a week (#1563, #1568, #1570).
Fix-forward did not stop scaling gracefully; the *number of sequences* did.

Two of the nine were mine, both from merging with `bun run cat gates` still in
flight — which is a discipline failure rather than skew, and is not counted
toward the argument above.

### Why fix-forward specifically cannot catch this class

Bean `ymsu`: a gate that repairs the tree it is being judged on **cannot fail
inside the runner**. So a branch that would stale a shared artefact reads green
on its own PR, every time, and the staleness first becomes visible on `main`.
Fix-forward is by construction the only thing that *can* work once the merge has
happened — the queue is the only intervention available **before** it does.

### Readiness, measured

The repository is already queue-ready: `merge_group` is declared on both
`code-quality-gates.yml` and `jsonld-gen-check.yml`, so **no code change is
required**. What remains is a repository-settings change (branch protection on
`main` → require merge queue), which no tool available to an agent in this
session can make — the GitHub MCP server here exposes no branch-protection or
ruleset tool, checked 2026-09-30. It is the owner's click.

### What does NOT change

`continual-progress`'s section on watching `main` after every merge you make,
and fixing a red `main` in a small PR of its own. A queue makes that rarer; it
does not make it unnecessary, and the parent-before-blame rule this bean added
is unaffected.


## CORRECTION, 2026-09-30 — the chosen remedy is not available on this repository

The section above closes *"What remains is a repository-settings change (branch
protection on `main` → require merge queue) … It is the owner's click."* **There
is no such click here.** Bean `1hjm` has the measurement: this repository's
ruleset form offers thirteen rules and `Require merge queue` is not one of them.
GitHub renders only the rules a repository is eligible for, so the absence is
the measurement rather than an inference; personal-account ownership is the
*likely* cause and stays labelled as inference, because `docs.github.com` is
egress-blocked from the agent container and the eligibility rule could not be
quoted.

**What this does and does not overturn.** The diagnosis in this bean is
untouched: merge skew is real, it was measured nine times in a day, and
`ymsu` still explains why fix-forward cannot catch the class *before* the merge.
What is overturned is only the availability of the remedy. So the 2026-09-30
reversal — "merge queue, not fix-forward" — **cannot be carried out**, and the
operating procedure reverts by necessity rather than by argument to the
2026-09-24 one: fix forward, watch `main` after every merge you make, check the
parent before blaming the last merge.

Asked which of the two features that ARE available to turn on instead
(`allow_auto_merge`, `allow_update_branch`, both `false`), the owner chose
**neither — leave settings alone**. Recorded so it is not re-proposed.
