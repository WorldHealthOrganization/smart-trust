---
# folio-assistant-1bvx
$schema: bean/1.0.0
title: check:reference-direction fails on main and is in NO workflow — nothing catches it
status: completed
type: task
priority: normal
created_at: 2026-09-30T22:13:49Z
updated_at: 2026-10-06T14:30:00Z
parent: folio-assistant-1xhc
---

Measured on `main` `25bff68c4f3`, 2026-09-30.

```
$ bun run cat check:reference-direction
✗ 1 PENDING entr(y/ies) no longer qualify — delete them
✗ 91 file(s) name several instances above them and are not in PENDING
exit 1
```

```
$ grep -q "bun run cat check:reference-direction" .github/workflows/*.yml
not in any workflow
```

**Red on the default branch, and run by nothing.** That is `1xhc` in its
purest form — *"a gate that does not fire is indistinguishable from one that
passed"* — and `xom7` one level down, where a workflow failed 30 times over two
months with nothing in the repository saying so. Here it is worse in one
respect: there is no failing run to find, because there is no run.

## Its committed sidecar is stale too, and that is a SEPARATE fact

`cat-harness/test/results/reference-direction.qa-results.json` on `main`
records `script_hash: a53a56c05f44`; the script now hashes `5732e61e5d03`, and
the verdict count moved 77 → 90. Some of the paths it names still read
`cat-harness/content/docs/kgraph/…`, a directory since renamed to
`knowledge-graph/`.

So the sidecar describes a corpus that no longer exists, **and** the check that
would say so does not run. The sidecar is the thing a reader consults to tell
"never audited" from "audited clean", which is the whole reason this repository
writes sidecars rather than printing verdicts — and this one silently answers
the second when the truth is neither.

## How it was found, which is itself the argument

Not by looking for it. `check:reference-direction` appeared in a sweep of every
`:check` script in `package.json` while chasing an unrelated CI failure. Nothing
in the normal loop — `bun run cat gates`, CI, a PR — would have surfaced it, because
`gates` derives its list from the workflow file and the workflow does not name
this check.

**That is the general hazard worth recording:** `gates` cannot drift from CI,
which is exactly why it also cannot see a gate CI never adopted. The two
properties are the same property.

## Not established

- **Whether the 91 findings are real defects or a rule that has drifted from
  the corpus.** 91 is large enough that "the check is now wrong" is at least as
  likely as "the corpus is now wrong", and nobody has read one. The count is
  reported here as a COUNT, not as 91 defects.
- **Why it is not in a workflow** — deliberate (it may be advisory by design,
  like `navbar-consistency:strict`) or an omission. `check:merged` and
  `check:session-staleness` are also in no workflow and are plainly local
  tools, so "not wired" is not automatically a defect.

That second point is why this bean does not simply say "add it to CI": wiring a
check that produces 91 findings would turn `main` red on the next push, which
is a decision about what the repository asserts, not a gap to close quietly.

## Done when

- [x] someone reads a sample of the 91 and says whether the check or the corpus
      is wrong — with the sample named, so the judgement is re-derivable
- [x] the sidecar is regenerated so it stops describing renamed directories
- [x] a ruling on whether this check belongs in a workflow at all; if it is
      advisory by design, that is written down where the next sweep will find
      it, so this bean is not re-filed in a month
- [x] if it does belong in CI, it goes in GREEN — findings resolved first, not
      wired red

_2026-10-01T17:45:55Z_ — Claimed by claude/rulings-2026-10-01-late — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

## Closed on evidence, 2026-10-06 (session https://claude.ai/code/session_01EcBv3uwKYcnNbCC6BcPG92)
Re-derived. The claim by `claude/rulings-2026-10-01-late` has no open PR.
- **Check or corpus?** The owner answered this in ruling Q-B, 2026-10-01 (recorded in `zhg2`). The CORPUS is wrong: reword in place (Q1). The named classes where the check would be wrong became exemptions: X3, the three layering specifications, and X1, the translation mirrors.
- **Sidecar:** `cat-harness/test/results/reference-direction.qa-results.json` is no longer tracked on main (`git ls-files` is empty after #2080). It is regenerated each run and stored on `qa-reports` (baseline `qa-reports:main/4c8029c7cad`), so no committed copy can describe renamed directories.
- **Ruling written where the next sweep will find it:** the workflow step comment and the `gates.ts` reasons for `:check` and `:strict` say advisory-by-backlog, ratchet-in-CI, strict-when-drained.
- **Went in green:** `check:reference-direction:check --against main` exits 0 today, with 0 new findings.
