---
# note on folio-assistant-qj9a from claude/wizardly-galileo-feyypz
$schema: folio-bean-note/v1
bean: folio-assistant-qj9a
branch: "claude/wizardly-galileo-feyypz"
created: "2026-10-02"
---
## handover: preview size / page weight 2026-10-02

## Handover report: preview size / page weight (session `01WmQ8e6wkd4dbzbe1En9znA`)

- **Session:** https://claude.ai/code/session_01WmQ8e6wkd4dbzbe1En9znA
- **Written:** 2026-10-02T20:45Z; **updated 21:45Z**, stopping on the merge steward's report that the owner's weekly budget is at ~3%. Updated in place rather than appended, per `handover-report` rule 6.
- **Role and mandate:** bean `qj9a` (preview size, issue #843) and what fell out of it. Owner rulings, verbatim and dated:
  - 2026-10-02: *"relax…'reachable without JavaScript' to 'reachable without XSS'"*
  - 2026-10-02: *"print/pdf needs to wait until loaded/rendered before printing (assuming can load assets)"*
  - 2026-10-02: *"1 but shouldnt todos be put into proper Todo content nodes?"* — which redirected the todo-listing fix from a fetch to R1.
  - 2026-10-02: *"1 2 3"* — approving the staging-banner fix, the `gates.ts` fix, and asking #1886 for `footer_custom.html`.

**Written by hand rather than with `bun run cat beans:note`**, because that script is added by PR #1912 and is not on this branch. Same path convention and one file per branch per bean, so it should not conflict.

### Where I'm going (current arc)

Reduce what a published page and a preview carry, without weakening what a reader with JavaScript off gets. Serves epics `1xhc` (CI reliability) and `o3xy` (UI & accessibility). Done looks like: the minifier shipped (it is), the todo listing rendering at its own node rather than on every page, and the two self-inflicted CI defects fixed so `bun run cat gates` is usable again.

### Done so far

| outcome | evidence |
|---|---|
| Post-build HTML minification — **−63.3 MiB** on the main site, −21.9 % gzipped | `d4766eebdbd`, issue #1890 |
| `fa-translation-index` island → dynamic load — **−18.04 MB** measured on two full builds | `0413a5a91d6` |
| R4 scoped to the board; two client-side rules re-homed to `ui-accessibility` | `166507acd1b` |
| Staging banner flush on any layout (owner's screenshot) | `ead62ab06ef`, issue #1914 |
| `bun run cat gates` can reach a clean run again | `dd9eccd24d3`, issue #1915, bean `9zok` |
| Linear floor measured properly: **~104 MB**, not the 19.5 MB in circulation | `f71e95b4b2f` |
| `todos/index.html` serves ZERO notes without JS — new defect | bean `dm4j` |

### In flight

| item | kind | state | next action | owner |
|---|---|---|---|---|
| **#1889** | PR, ready for review, `ready-to-merge` + `merge-main` | head `e2df58dd6f8`; gate set **in progress**. Last complete run green at `787433bdc3d` | read the dispatch on `e2df58dd6f8`; if red, it is mine | me / Merge Manager |
| **#1895** | PR, ready for review, `ready-to-merge` | head `14b75e8ce59`; gate set **in progress**. **Green at `b028e5d65f9`**, `ready:` posted | read the dispatch on `14b75e8ce59` | Merge Manager |
| #1888 | PR | **not started** — stopped on the budget report | the refused-merge handback | unassigned |
| #1892 | PR | **not started** | write the methodology page | unassigned |
| #1894 | PR | **not started**; owner ordered it after #1888 and #1895 | the merge-pipeline epic | unassigned |

**#1895 is finished as a piece of work.** Its one unchecked box — "`bun run cat gates` green" — is done: the set reported 4 of 212 failed, three were its own (`check:partition`'s five unclassified modules, `check:bean-parents`' two orphans `blgm`/`8rff`, and the same two seen through `bun test`), all fixed in `b028e5d65f9`, which then went green. The fourth, `translation:catalogue:check -- --base "$base"`, is bean `9zok` / issue #1915 and fails on every branch; its fix is on #1889.

### Blockers and dependencies

| blocker | waits on | since | expires / re-check |
|---|---|---|---|
| R1 todo fix (`footer_custom.html`) | session `013Wb` agreeing, since it is `gp2f` phase C territory | 2026-10-02 ~20:05Z | re-check 2026-10-03; if silent, ask the owner whether to proceed anyway |
| CI signal on #1889 | a manual `workflow_dispatch` | every push | **every head** — see below |

### The thing most at risk, and it is not a merge conflict

**`pull_request` runs on this branch complete as `action_required` and never execute.** Measured three times: zero check runs on `cd643aa0b6d`, on `2ba8f365b3c`, and on `bd2f0395193`. Worse, a `check_suite.completed` event arrives saying *"No third-party check suite … is still running or failed. If you were waiting on CI, continue with the next step."* — over a head where 11 of 12 jobs never ran. Recorded on bean `0qjq` (`2ba8f365b3c`).

**So a green PR page here does not mean the gates ran.** The count of check runs on a head is the measurement. The workaround needs no extra permission: `code-quality-gates.yml` carries `workflow_dispatch` at line 90.

Not repo-wide — run 6108 on `claude/stickies-no-tile-strip` executed as a `pull_request` event at 18:56Z, so it may be branch-specific. Not settled.

### Decisions pending (owner)

1. **Whether to fix `beans create` not regenerating `beans/README.md`.** Filing any bean moves the `beans/defs/` file count that `beans/README.md` carries in a generated section, so **the next push after any bean is red**. Happened three times in one session to three different authors (`884e285989e`, `5a96e3bcf82`, and an earlier one). Not fixed because there are at least three designs — regenerate inside `beans create`, drop the count from the generated section, or have the gate derive the count rather than compare it. **Recommendation: have the gate derive it**, since that removes the class rather than one instance. Default if unanswered: leave it, it is reported here.
2. **Whether to proceed with the R1 todo fix if #1886 stays silent.** Recommendation: wait one more day, then proceed, since R1 is already written and the change is one `{%- include -%}` line plus a conditional.

### Unpushed or at-risk state

- **Nothing unpushed.** `git log @{u}..HEAD` is empty; working tree clean.
- **Scratchpad, not reproducible without re-running:** the Chromium probes under the session scratchpad that measured the banner at `top: 8, left: 64` before and `top: 0, left: 56` after. **The measurements are in issue #1914 and in `ead62ab06ef`'s message**, and the two e2e tests in `staging-banner.e2e.ts` re-derive them on every run, so nothing is lost.
- **A dispatched `code-quality-gates` run** may be in flight for an older head; its result is on the Actions tab, not here.
- **Both subagents have ended.** One finished cleanly; the other (`ab58d9586a0b71900`) terminated on a session rate limit **after** handing back its final report, and its work is committed and pushed.
- No secrets held.

### How to resume

1. **Read the two in-flight dispatches** — `e2df58dd6f8` (#1889) and `14b75e8ce59` (#1895). Do NOT read the PR page as the signal; count the check runs on the head (see the risk section).
2. **If #1889 is red**: the causes already fixed are `kg:audit:check` (attested), `beans/README.md`, two bean parents, the health producer hash, `audit:coverage` twice, and eight generated artefacts the main-merge left on main's side. A new red is a new cause — read the job log.
3. **Then #1888**, the refused-merge handback, which is where the owner's queue resumes. After it, #1892 (methodology page) and #1894 (the merge-pipeline epic, which the owner ordered last).

### Two traps that cost me time here, both reproducible

- **A `git worktree` does not inherit `node_modules`.** I resolved a generated conflict in one and regenerated there; the generators ran without the TypeScript compiler API, and `regen-after-merge` reported "7 unrepaired — a real defect, not staleness". That verdict was true of its own run and false about the branch — `uml:overview:check` passes in the real checkout. Symptom: `TypeError: undefined is not an object (evaluating 'ts.ScriptTarget.Latest')` inside an unrelated generator. I discarded that output rather than commit it, which left the artefacts stale and cost two further red rounds.
- **Resolving a generated conflict to either side is only correct if the regeneration then actually runs.** Ten files on #1889 and three on #1895 were resolved to main's side; each needed `skill:register` / `readme:subgraphs` / `library:viz` / `audit:coverage` afterwards. `audit:coverage` is NOT among `skill:register`'s nine, so it stays stale unless asked for by name.
