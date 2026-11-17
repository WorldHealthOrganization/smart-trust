---
# folio-assistant-1xhc
$schema: bean/1.0.0
title: 'CI RELIABILITY: a gate that does not fire is indistinguishable from one that passed'
status: in-progress
type: epic
priority: normal
created_at: 2026-09-19T11:43:44Z
updated_at: 2026-11-15T18:55:00Z
parent: folio-assistant-rwmf
---

A gate that does not fire is indistinguishable from one that passed.

That is `xom7`'s lesson one layer up, and every item here is an instance:
`3pqn` (a PR that opens with zero checks looks exactly like one whose checks
are green), `dzl3` (playwright fails before any test body runs), `t373`
(`readme:audit` is in no workflow at all, and `main` carried eight dead links),
`bgle` (a guard that enumerates with `git ls-files` cannot see a new file),
`v8gh` (nothing checks `AGENTS.md`'s own links).

`xd1s`, `w2g5` and `lx2s` are the staging and concurrency machinery those gates
run inside. Fixing any one without the others leaves the same class of silence
somewhere else.

_2026-09-19T11:58:51Z_ — Wired 14 gates into CI that were registered in package.json and run by nobody.

Measured 2026-09-19: of 33 check:/:check scripts, 21 appeared in NO workflow. That is 5rfy's defect (a gate that never fires) and it is worse than a missing gate, because package.json advertises it. I ran several of them by hand across this session, reported them green, and assumed CI did the same. It did not.

All 14 pass on main as of this commit, so wiring locks in a property the repo HAS rather than demanding work.

Deliberately NOT wired, each with a stated reason in the workflow: check:ci-health (a report, reads the default branch, so on a PR it describes main not the diff; ci-health.yml runs it), check:corpus-gate (needs a folio; the platform carries none), check:upstream-pins (upstream-pins.yml runs it weekly), check:partition:edges (prints the list; check:partition is the gate), translate-*:check (need a toolchain not on the runner).

Also added check:bean-parents + 8 tests: every OPEN bean must carry a parent naming a real epic. That guards the invariant PR #410 established, which nothing enforced -- a sibling's Created folio-assistant-iqzy folio-assistant-iqzy--untitled.md would silently rebuild the Miscellaneous tail.

A correction worth recording: I first reported check:declared-paths as pre-existing RED at 39-vs-37. It was not. My own new script hardcoded join(root,'beans','defs') and those were the 2 literals. The ratchet was right; I rewired the script to read the bean graph's declaration via parseBeanGraph/nodeOfKind, and declared-paths went green and is now wired too.

_2026-09-19T12:05Z_ — The new `check:bean-parents` gate FAILED on its own first
CI run, and the failure was real. `folio-assistant-iqzy` — `title: Untitled`,
empty body, created 11:58:51 — was swept into commit `bd56215b7` by `git add
-A`. **It was mine, not a sibling's**: I said "a sibling added an unparented
bean" before checking `git log`, which is the third time in this session I
reached for "pre-existing / not mine" and was wrong.

What created it is UNEXPLAINED and worth knowing, because a script that mints
a stray bean on every run will keep doing it. Ruled out by reading the code:
`beans-fallback create` refuses an empty title, and `noteBean` only appends.
Not ruled out: the third-party `beans` CLI itself, invoked during the gate
sweep. I did not reproduce it, and I am not guessing at a cause I cannot show.

Removed from the branch rather than scrapped: it was added by an unmerged
commit and has never existed on `main`, so `git rm` is equivalent to never
having committed it. `AGENTS.md`'s "never delete ANY bean" protects a record
of work considered and rejected; an empty file that recorded nothing and was
never in the shared plan is not that. Scrapping it would have added a
permanent `Untitled` row to a store this session just spent a PR organising.

The gate caught a defect in the commit that was adding gates, for the second
time in one PR — first `check:declared-paths` on the hardcoded bean path, now
this.


_2026-09-20T03:05Z_ — **Converged two gate runners into one. `scripts/ci-gates.ts` retired; `scripts/gates.ts` (`n60j`) is the single answer.**

Two sessions built the same tool within hours of each other, both deriving the
gate list from `code-quality-gates.yml`, both for the same stated reason
(locally green, red in CI). That is this epic's own defect wearing a new hat:
two answers to "what will CI run" are free to disagree, and `rlp5` is the
standing record of what a second spelling costs.

`gates.ts` is a strict superset, so the choice was not close:

| | `ci-gates` (retired) | `gates` (kept) |
|---|---|---|
| gates run | 35 | **40** — includes the `e2e` job |
| browser handling | detect-and-report `UNDET` + a `--with-browser` flag | derived from **job membership** |
| parsing | regex over YAML | a real YAML parser |
| vacuity guard | **none** | fails when the extraction finds nothing |
| skill doc | none | `platform-gates.md` |

The vacuity guard is the one worth naming: a runner that silently executes an
empty list exits 0 and reads as a clean sweep — precisely the silence this
epic exists to remove, and the retired runner did not have it.

Removed with the owner's explicit say-so, per
`deletion-requires-confirmation`: reported first with sizes and ages (4 985 B /
114 lines, and 4 520 B / 107 lines, both a day old), then deleted. Nothing
referenced them outside `package.json`.

The `UNDET` third state was NOT ported. `gates.ts` answers the same question
structurally — it does not run browser gates unless asked — so there is nothing
to detect, and adding a detector would be a second mechanism for a case the
first design does not have.


## `bun run cat gates` ON A BRANCH HEAD IS NOT WHAT CI RUNS — 2026-09-26, and it cost two CI rounds

A new instance of this bean's sentence, and the most expensive one so far, because
**no local run can detect it** — not even a pristine clone.

`actions/checkout` on a `pull_request` event checks out `refs/pull/N/merge`:
`main` MERGED INTO the branch, not the branch head. So CI's verdict is about a
tree that exists nowhere locally.

### The measurement, PR #1425

`Skill-registration chain` red on `kg:audit:check`, twice. Reproduced nowhere:

| environment | verdict |
|---|---|
| this container, clean tree, same commit | exit 0 |
| a pristine `git clone` of that commit, `bun install --frozen-lockfile` | exit 0 |
| CI, same commit | **exit 1**, twice |

Finding counts were IDENTICAL between CI and the clone on every comparable line,
so the audit saw the same graph; only the pass/fail differed. The cause:
`prose-reviewed-since-code-changed` keeps a committed attestation of two files'
content hashes, and `main` had moved BOTH of them —

    .github/workflows/code-quality-gates.yml   head bb6cbd2d26c2   main 8a07b7de6278
    cat-harness/processes/code-quality-gates.bpmn   head f8dd3d54012d   main 2286ea1f8f1b

— so the attestation was correct for the head and stale for the merge. Merging
`main` and regenerating moved exactly the one sidecar CI had named.

### Why this belongs to THIS bean specifically

The bean's line is *"a gate that does not fire is indistinguishable from one that
passed."* Here the gate fires only in a tree the author cannot construct by
checking out their own branch, so locally it is indistinguishable from passing —
and the natural response, which I made, is to suspect the environment or a flake.
Two hypotheses died first: `kg-audit`'s gitignored-file disk walk (real, recorded
on `xd1g`, changed no sidecar) and a flake (the re-run failed identically).

### The class of artefact at risk, which is the useful generalisation

Any committed artefact whose inputs include files `main` also touches. Named
instances today: a `pair_attestation` (content hashes of two files), and — from
`main`'s own bean `g5o5`, landed the same day — `check:glossary` calling
kg-skills stale in CI and current locally. **Two sessions hit this
independently within hours**, which is the argument for recording the mechanism
rather than either instance.

### Adds to "Done when"

- [x] a contributor can run what CI runs. MEASURED AFTER: one command produces
      the merge tree (`git merge origin/main` into a throwaway worktree, or
      fetching `refs/pull/N/merge`) and runs the gate set against it, and its
      verdict matches CI's on a case where the head's verdict does not (`bun run cat check:merged`, `scripts/check-merged.ts`, bean `nytj`)
- [x] the failure MODE is documented where an agent meets it: `skill:register`'s
      own red message says "if it is red in CI but green here: ask git what the
      corpus is" — correct advice for `xd1g`, and it sent me down that path for
      a case where the corpus was identical and the TREE was not (`formatChainRedDiagnostic` in `scripts/skill-register.ts` now documents both the `xd1g` corpus distortion and the `1xhc`/`nytj` merge-tree `refs/pull/N/merge` vs branch head cause via `bun run cat check:merged`, pinned by `scripts/tests/skill-register.test.ts`)

_2026-11-15T18:55:00Z_ — Progress rollup (`lane-43c1`, subagent `43c12887-2733-443d-b8ef-0e369f856d33`):
- Checked off both `Adds to "Done when"` items above:
  1. `bun run cat check:merged` (`scripts/check-merged.ts`, bean `nytj`) produces the merge tree in a throwaway worktree and runs the gate set against it.
  2. Exported `formatChainRedDiagnostic(checking, red)` in `scripts/skill-register.ts` so `skill:register`'s red diagnostic names both causes of "red in CI, green here" (`1. THE CORPUS (xd1g)` via `scripts/git-corpus.ts` and `2. THE MERGE TREE (1xhc / nytj)` via `refs/pull/N/merge` and `bun run cat check:merged`), pinned by unit test in `scripts/tests/skill-register.test.ts` and scenario in `scripts/tests/features/skill-register.feature`.
- Across all direct child beans of `folio-assistant-1xhc` in `cat-harness-tools/beans/defs/`, every active child is now `completed` (including `cat-tools-sm8r` via [`litlfred/cat-harness-tools#2323`](https://github.com/litlfred/cat-harness-tools/pull/2323) `1860dd6b` and `folio-assistant-g196` completed with live `origin/gh-pages` @ `2b16b35` re-measurement in this PR; 2 are `scrapped`: `m5gx`, `rmcf`), leaving only `folio-assistant-fwtz` in `cat-harness` open by design under the owner's 2026-10-20 `"leave as is"` ruling on the bean-branch `docs-site.yml` trigger.
