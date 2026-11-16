---
# folio-assistant-6lre
$schema: bean/1.0.0
title: 'CI WATCH READS A PARTIAL CHECK SET AS GREEN: 1 of 13 registered, verdict PASS — ask the check SUITES, not only the runs'
status: completed
type: bug
priority: high
created_at: 2026-09-30T16:15:00Z
updated_at: 2026-10-06T14:57:00Z
parent: folio-assistant-1xhc
---

Found while using the tool, not while reading it. Sibling of `2c2b`, which
shipped `ci:watch` for issue #1624.

## The defect, measured

`bun run cat ci:watch 29b10a68923` at 16:13:58:

```
16:13:58  29b10a68923  PASS — 1 check(s) completed clean
```

exit **0**. At that instant `get_check_runs` on the same commit returned
`total_count: 1` — the `.jsonld siblings` job — and **nothing else had been
created yet**. The `Code-quality gates` workflow, which carries `Repository
gates`, `TypeScript` and `End-to-end`, had not registered a single run.

Thirteen checks ran on the previous head of the same branch. One of the twelve
missing ones (`TypeScript`) had **failed** on that head. So the tool answered
"may I merge" with **yes**, over a check set that had not started, on a branch
whose immediately preceding commit was red.

## Why `2c2b` does not already cover it

`check-verdict.ts` handles the **empty** case and says so:

> An **empty** run list and an **unreadable** response are BOTH `undetermined`
> rather than `pass`. A check set that is vacuously satisfied is the `dh4f`
> defect.

The guard is `if (judgeable.length === 0)`. With one clean run registered,
`judgeable.length` is 1, nothing has failed, nothing is pending, nothing is
cancelled — so control reaches

```ts
return { state: "pass", names: [], because: `${judgeable.length} check(s) completed clean` };
```

**A partial check set is not an empty one, and it is not a complete one
either.** `2c2b` closed the vacuous hole and left the *nearly* vacuous one
open, which is the harder case: it produces a confident sentence with a
plausible number in it.

## The signal that exists and is not consulted

A check RUN does not exist until its job is created, so the run list cannot
say how many are coming. A check **SUITE** can: GitHub creates the suite when
the workflow is triggered and reports it `queued` before any run appears.
`pull_request_read` / the check-suites endpoint expose that.

So the fix is to ask the suites and treat

- a suite `queued` or `in_progress` with no runs yet → **pending**, not pass

Precedence slots below `fail` and beside the existing `pending`, since a suite
that has not produced runs is the same fact as a run still going.

**A second, weaker signal, deliberately NOT proposed as the fix:** comparing
against the check names seen on the base branch. That is a guess about what
*ought* to run, and a workflow whose triggers changed makes it wrong in both
directions — the `vq8g` shape.

## Why this one is high

Every merge decision in this repo now routes through this tool, and its whole
purpose is to stop an agent merging on an inference. A `pass` over an unstarted
check set does not merely fail to help: it **manufactures** the false
confidence it was built to prevent, and does it in the exact window an agent
polls — right after a push.

Measured in this session: I pushed at 16:13, polled at 16:13:58, and got
`PASS`. Had I taken it, I would have merged a head whose predecessor's
`TypeScript` job was red. That is the same merge I made earlier today at the
cost of a red `main`, arrived at by a different route.

## Done when

- [x] A commit whose suites are queued with no runs reports **pending**, not
      pass, and `ci:watch` exits non-zero.
- [x] Falsified against live data: poll a commit within seconds of pushing it
      and watch it refuse, then watch it pass once the suites finish.
- [x] The base-branch-name-comparison alternative is written down as
      considered and rejected, so it is not rediscovered as an improvement.
- [x] `2c2b`'s docblock says "empty" where it means "empty"; the partial case
      gets its own sentence, since the current wording reads as covering it.

## NOT in this bean

Whether `ci:watch` should be what the session-start sweep runs — that is
`2c2b`'s own open item and a different question.


## CORRECTION 2026-09-30 — the suites fix covers ONE of TWO shapes

Measured before any code was written, which is the only reason this is a
correction rather than a shipped defect.

Reproduced a SECOND time, on `0d714756f3d`:

    17:25:41  0d714756f3d  PASS — 1 check(s) completed clean

exit 0, `total_count: 1`. More dangerous than the first: the owner had
authorised merging #1637 on a verified green, so the tool would have merged an
unverified tree.

**The rule proposed above, run against that commit, ALSO says pass:**

    suites: 3
      app='github-pages'    status='queued'     runs=0
      app='claude'          status='queued'     runs=0
      app='github-actions'  status='completed'  runs=1
    judging apps = {'github-actions'}
    WOULD REPORT: pass

The `Code-quality gates` suite DOES NOT EXIST. The rule above was built for a
suite created but queued with zero runs — the 16:13:58 case. This is a suite
never created, and no rule over `check-suites` can catch it, because there is
nothing to find.

### The cause is nameable

`git merge-tree origin/main HEAD`: 28 behind, 7 conflicts. Bean `52cz` — a
conflicted PR creates no `pull_request` run. The checks were not slow; they
were never going to happen.

### Two mechanisms, because there are two causes

| shape | cause | signal |
|---|---|---|
| suite exists, unfinished | runs still being created | a judging app's suite with `status != completed` → pending |
| suite absent | conflict suppresses `pull_request` (`52cz`) | mergeability; locally `git merge-tree`, since `mergeable_state` reads `unknown` (`h2s9`) |
| suite absent | not yet dispatched | reconcile against `.github/workflows/*.yml` AT THAT COMMIT |

### The rejection above was right about the wrong thing

It rejected "comparing against what ought to run" as a guess. Reading the BASE
BRANCH's check names is a guess. Reading the WORKFLOW FILES IN THE TREE BEING
JUDGED is not — it is a fact about that commit, and `code-quality-gates.yml`
declares `on: pull_request` in plain sight. Workflow-file reconciliation is
ADOPTED; base-branch comparison stays rejected; the write-up must not conflate
them.

### Done-when, amended

- [x] A conflicted head does not report pass. This produced the more dangerous
      of the two live reproductions.
- [x] Workflow-file reconciliation at the commit, distinguished IN THE PROSE
      from the base-branch comparison that stays rejected.

The fourth item above ("the base-branch alternative is written down as
considered and rejected") is wrong as written and is superseded by this.

_2026-09-30T18:43:34Z_ — Claimed by claude/cool-fermi-htir5p — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

## Evidence, 2026-10-06 (session https://claude.ai/code/session_01EcBv3uwKYcnNbCC6BcPG92)
Re-derived on main 713b9d3+:
- **Partial set:** `verdictForCommit` turns a would-be pass with `owed.missing` non-empty into `undetermined` ("a partial check set, not a green one"), and `exitCodeFor` exits 2. Covered by `cat-harness/scripts/tests/verdict-for-commit.test.ts:61`. This supersedes the "queued suites" wording of item 1, a rule this bean's own correction showed never terminates: `github-pages` and `claude` suites stay queued forever.
- **Docblock:** `check-verdict.ts:45` names the EMPTY case; the 6lre section names the PARTIAL case in its own sentence.
- **Conflicted head:** `conflictedVerdict` (beans `52cz` and `rwwl`, #2250). Tested at `verdict-for-commit.test.ts:104`.
- **Reconciliation vs base comparison:** the docblock now has a third design, the REJECTED base-branch comparison, kept distinct from the adopted workflow-file reconciliation (this commit).
- **Live falsification (#2286, head e475dee):** I polled `ci:watch e475dee --once` from the moment of the push.
  - 14:15:51: `PENDING — 1 still running`.
  - 14:16:10 to 14:18:06: `UNDETERMINED — every registered run is clean, but 1 workflow(s) OWED for this event have no run — a partial check set, not a green one  Code-quality gates`, exit 2. This is exactly the 29b10a68923 shape: one clean run, gates not yet created.
  - 14:18:18: `PENDING — 14 still running`.
  - 14:55:54: `PASS — 19 check(s) completed clean, and every workflow owed for this event ran`.
- The superseded half of the bean is not done, by design. "Base-branch comparison" is recorded as REJECTED design (3) in the docblock rather than adopted, per this bean's own correction.
