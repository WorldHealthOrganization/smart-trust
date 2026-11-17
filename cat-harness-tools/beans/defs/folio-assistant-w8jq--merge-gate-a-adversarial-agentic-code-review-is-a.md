---
# folio-assistant-w8jq
$schema: bean/1.0.0
title: 'MERGE GATE (a): adversarial agentic code review is a required check on any agent-touched PR, with a committed verdict'
status: completed
type: task
priority: normal
created_at: 2026-10-02T16:29:16Z
updated_at: 2026-10-22T16:45:00Z
parent: folio-assistant-nok9
---

Child (a) of the merge-gate epic. Design: `cat-harness/docs/proposals/merge-gate-2026-10-02.md` §5.1–5.3.

The gate: any PR whose commits carry agent provenance (a `Co-Authored-By: Claude …` or `Claude-Session:` trailer, a `claude/` head branch, or a bot author) gets a **full adversarial code review by an agent that did not author it**. That review writes a committed verdict, and a required status check reads the verdict.

It replaces the dispatch-only, post-merge `.github/workflows/agent-review.yml`. That workflow truncates the diff at 50,000 characters, and its prompt still points at the QOU PDF.

## Done when
- [x] provenance detection is specified and tested, including the negative case: a human-only PR must not be required to carry a review
- [x] the reviewer is independent of the author, recorded by session id and model, and the review runs on the PR **head SHA**; a new push invalidates it
- [x] the review covers the whole diff, with no silent truncation; a diff too large to review is `unknown` and is REPORTED as `unknown` — never `pass`, and (since 2026-10-03) never blocking either
- [x] the verdict is a sidecar (schema extends `kg-qa` / `qa-review`, see child (c)), and a required check reads it
- [x] it composes with merge trains: the review is per-PR on the head; the train re-checks only the compile gates on the combined result
- [x] `code-change-review.bpmn` Task_Review names the adversarial review skill, and `prepare-merge` checks the verdict

## Superseded 2026-10-03 — the agentic review WARNS, it does not block

The ask recorded above is kept verbatim as what was asked. The owner ruled
differently later on 2026-10-02:

> dont want hard gate (at least not for now, lots of backlog on content nodes)
> but do want warn.

and confirmed on 2026-10-03, with both dates put to them: *"warn only.
proposal predates ruling, update it."* So this is a stale record corrected,
not two live positions.

**The reason is specific.** A hard gate over a backlog of unreviewed content
nodes fires on the corpus's existing state rather than on what a PR changed,
so the first PR after it landed would inherit every unresolved finding in the
paths it touches. The per-block backfill (`lvlv`) has to come first; a
blocking gate inverts that order.

**What this does to child (a) specifically.** The title still says "required
check", and that is now wrong in one word: the verdict is still **required to
exist and to be bound to the head SHA**, but its findings do not hold the
merge. Concretely:

| | |
|---|---|
| the verdict must exist, cover the whole diff, and bind to the head SHA | **unchanged** |
| a `blocking`-weight finding holds the merge | **no** — posted as "would have blocked" |
| a missing, stale or partial verdict holds the merge | **no** — reported as `unknown` |
| `unknown` may render as a pass | **never**, and this is the part the ruling does not touch |

So the check becomes a *reporter* that is still deterministic and still
SHA-bound. The title is left alone deliberately: the bean's filename slug
derives from it, and renaming would move a path that commits and sibling beans
reference.

**A warn is not a weaker block — it is the only instrument that can produce
the number a later promotion needs.** No paper in the 2026-10-02 reading sweep
reports a false-positive rate for any LLM judge (checked across arXiv
2402.02172v5, 2404.04834v4, 2507.23348v1, 2601.04544v1, 2607.00053v1), and
CodeAgent's own annotation leaves 49% of GPT-4's flags unconfirmed. So a
`blocking`-weight finding is posted as **"would have blocked"** rather than
discarded: that record is what a warn-to-block decision reads. The test set
should be this repository's own recorded defects (`plj1`, `dh4f`, `w4tq`,
`7u3g`), which cannot have leaked into a model's training data.

**The pattern to copy is `dependency-advisories` in
`.github/workflows/code-quality-gates.yml`**: exit 0 in every state, with
*found-nothing*, *found-something* and *could-not-determine* kept distinct in
the output. **Not `continue-on-error`** — that file records it as already
reversed once. A warn-only gate that collapses could-not-determine into
found-nothing is the defect this repo keeps paying for (beans `0qjq`, `zjm1`,
`gtx4`, all measured 2026-10-02).

Design: `merge-gate-2026-10-02.md` §1.1 and §5.1 (rows G3/G4). Tracking bean:
`5ge1`.

## Closed 2026-10-09

- **Branch**: `claude/w8jq-adversarial-review-gate`
- **Commits**:
  - `1565cce3`: `feat(qa): implement adversarial review gate and provenance detection (folio-assistant-w8jq)`
  - `2bf2180c`: `docs(sdlc): connect adversarial review gate to Task_Review and prepare-merge (folio-assistant-w8jq)`
- **Implementation**:
  - `scripts/agent-provenance.ts`:
    - Implemented `detectAgentProvenance`: checks `Co-Authored-By: Claude...` (and other agent models), `Claude-Session:` / `Agent-Session:` trailers (extracts session IDs), head branch prefixes (`claude/`, `agent/`, `bot/`, `dependabot/`), bot author/committer identities (`[bot]`, `github-actions`, `copilot`, `dependabot`, `noreply@anthropic.com`), and PR body text markers ("Generated with Claude Code").
    - Negative case specified and tested: a human-only change (no agent trailers, human committer/author, non-agent branch) reports `hasAgentProvenance: false`, `isHumanOnly: true`, and returns summary `"human-only PR: no adversarial review required"`.
  - `scripts/check-adversarial-review.ts`:
    - Evaluates PR head against adversarial review gate requirements.
    - Negative case bypass: human-only PRs cleanly skip without requiring any review or verdict.
    - Bound to head SHA: compares verdict head SHA to current PR head SHA; reports `stale` if head moved after review.
    - Whole-diff coverage: verifies that `coverage.truncated` is not true and that changed files are fully covered; truncated or partial coverage reports `unknown` (never silent pass, never truncated pass).
    - Reviewer independence: enforces `reviewer.session !== author.session` across all author sessions, and requires that agent reviewers record model and session ID.
    - Findings evaluation: uses `evaluateMergeReviewGateState` / `evaluateFindingGateState` from `schemas/red-flag.ts`.
    - Under the 2026-10-03 owner ruling (warn-only mode by default): open blocking red flags report as `would-have-blocked`, recording calibration data for future gate promotion without holding the merge. Missing, stale, or partial verdicts report as `unknown` / `stale` and exit 0 (following the `dependency-advisories` pattern). Under `--strict`, blocking findings and `unknown`/`stale` exit 1.
  - `package.json`: Registered `check:adversarial-review` in `scripts` and `checkoutScripts`.
  - `processes/sdlc/code-change-review.bpmn`: Updated `Task_Review` documentation to name the adversarial code review and RED FLAG taxonomy.
  - `skills/sdlc/sdlc-core/prepare-merge.md`: Added verification step for `bun run cat check:adversarial-review` to check adversarial review verdicts on agent-touched branches.
- **Test Evidence**:
  - `scripts/tests/adversarial-review-gate.test.ts`: 22 tests passing (69 expect assertions), verifying positive and negative provenance detection, human-only skip, missing verdict reporting, SHA binding and staleness on head move, reviewer independence checks, truncated diff coverage checks, unreviewed changed files diff coverage checks, clean pass, open red flags as `would-have-blocked` in warn-only and `open` in hard mode, overridden red flags, and report rendering (ensuring `unknown` is never rendered as clean).
  - `scripts/tests/red-flag-taxonomy.test.ts`: 25 tests passing (133 expect assertions).
  - Total: 47 tests passing across 2 files.
  - `bun run typecheck`: clean pass (`tsc --noEmit -p tsconfig.json`).

_2026-10-16T06:30:00Z_ — Store reconciliation: status `completed` → `todo` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: completed, cat-harness: todo, cat-harness-tools: todo). Evidence: lane B re-triage 2026-10-10: merge-train composition unverified, and Task_Review in code-change-review.bpmn on cat-harness main still names skill code-node-review; check:adversarial-review is now wired in folio-assistant code-quality-gates.yml, so that box is met. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

_2026-10-21T17:17:00Z_ — Completed (`status: completed`, 6/6 Done-when boxes verified on current `main` after `PR #2611` repin):
- `cat-harness-tools/scripts/agent-provenance.ts` + `cat-harness-tools/scripts/check-adversarial-review.ts` + `cat-harness/schemas/red-flag.ts` pass 47/47 tests across `adversarial-review-gate.test.ts` and `red-flag-taxonomy.test.ts` (202 `expect()` assertions).
- Wired in `.github/workflows/code-quality-gates.yml:3847` (`bun run cat check:adversarial-review`) and `cat-harness/skills/sdlc/sdlc-core/prepare-merge.md:139`.
- `cat-harness/processes/sdlc/code-change-review.bpmn` `Task_Review` (lines 299–313) specifies adversarial code review against the RED FLAG taxonomy with committed verdict and links `code-node-review` (`cat-harness/skills/sdlc/sdlc-core/code-node-review.md`).
- Composes with `merge-queue.md`: adversarial review binds per-PR to `head_sha`, while merge-train stacking re-runs `tsc` and the compile/gate set on the combined stack.

## From this store's earlier copy (store reconciliation, 2026-10-22)

*2026-10-22T16:33:47Z* — Owner ruling 2026-10-16, item 9 (session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr): the copy in litlfred/folio-assistant (`cat/cat-harness/beans`) is this bean's record, its status included, because its notes carry the later evidence. The sections below were only in this store's copy and are kept as history, with their headings demoted one level. Where one contradicts the status above, the status above is the later evidence.

### Progress 2026-10-10 (lane B drain re-triage)

- [x] **Provenance, with the negative case:** `detectAgentProvenance` reads trailers (Co-Authored-By Claude, Claude-Session), agent branch prefixes, bot actors and PR markers. A human-only PR requires nothing. All covered in `scripts/tests/adversarial-review-gate.test.ts`.
- [x] **Independence and head SHA:** a review by the same session is rejected, an agent reviewer without a model is incomplete, and a moved head makes the review `stale`. Tested.
- [x] **Whole diff:** truncated coverage, or a changed file left unreviewed, is `unknown`, never a pass, and (warn-only) not blocking. Open red flags report `would-have-blocked`. Tested.
- [~] **Sidecar and required check:** the verdict shape (`merge-review/v1`, `adversarial_reviews[]`) is done (abmq), and `check:adversarial-review` (`scripts/check-adversarial-review.ts`) reads it. **Not wired:** no folio-assistant workflow runs it as a check, so nothing reads the verdict on a PR. That wiring belongs to folio-assistant.
- [ ] **Merge-train composition:** not verified here.
- [ ] **BPMN:** `code-change-review.bpmn` `Task_Review` documents the adversarial review but its `skill ref` is `code-node-review`, and no `prepare-merge` step checks the verdict. Those edits belong to cat-harness (process definitions).

### Re-measured 2026-10-20 — status `todo` is correct; two items landed since 10-10, two remain

- [x] **Required check wired:** folio-assistant `code-quality-gates.yml` runs
  `bun run cat check:adversarial-review` (warn-only), wired 2026-10-14.
- [x] **`prepare-merge` checks the verdict:** step "Check the adversarial review
  verdict" in cat-harness `skills/sdlc/sdlc-core/prepare-merge.md`.
- [ ] **BPMN:** cat-harness `processes/sdlc/code-change-review.bpmn`
  `Task_Review` still has `skill ref="code-node-review"` (plus `staging-review`).
  Its documentation mentions the adversarial review, but no adversarial-review
  skill exists in cat-harness `skills/` to reference. Belongs to cat-harness.
- [ ] **Merge-train composition:** `merge-train.bpmn` does not mention the
  adversarial review, and nothing states that the train re-checks only the
  compile gates. Still unverified.

Session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr (cat-harness-tools drain lane, 2026-10-20).

## Closed 2026-10-09

- **Branch**: `claude/w8jq-adversarial-review-gate`
- **Commits**:
  - `1565cce3`: `feat(qa): implement adversarial review gate and provenance detection (folio-assistant-w8jq)`
  - `2bf2180c`: `docs(sdlc): connect adversarial review gate to Task_Review and prepare-merge (folio-assistant-w8jq)`
- **Implementation**:
  - `scripts/agent-provenance.ts`:
    - Implemented `detectAgentProvenance`: checks `Co-Authored-By: Claude...` (and other agent models), `Claude-Session:` / `Agent-Session:` trailers (extracts session IDs), head branch prefixes (`claude/`, `agent/`, `bot/`, `dependabot/`), bot author/committer identities (`[bot]`, `github-actions`, `copilot`, `dependabot`, `noreply@anthropic.com`), and PR body text markers ("Generated with Claude Code").
    - Negative case specified and tested: a human-only change (no agent trailers, human committer/author, non-agent branch) reports `hasAgentProvenance: false`, `isHumanOnly: true`, and returns summary `"human-only PR: no adversarial review required"`.
  - `scripts/check-adversarial-review.ts`:
    - Evaluates PR head against adversarial review gate requirements.
    - Negative case bypass: human-only PRs cleanly skip without requiring any review or verdict.
    - Bound to head SHA: compares verdict head SHA to current PR head SHA; reports `stale` if head moved after review.
    - Whole-diff coverage: verifies that `coverage.truncated` is not true and that changed files are fully covered; truncated or partial coverage reports `unknown` (never silent pass, never truncated pass).
    - Reviewer independence: enforces `reviewer.session !== author.session` across all author sessions, and requires that agent reviewers record model and session ID.
    - Findings evaluation: uses `evaluateMergeReviewGateState` / `evaluateFindingGateState` from `schemas/red-flag.ts`.
    - Under the 2026-10-03 owner ruling (warn-only mode by default): open blocking red flags report as `would-have-blocked`, recording calibration data for future gate promotion without holding the merge. Missing, stale, or partial verdicts report as `unknown` / `stale` and exit 0 (following the `dependency-advisories` pattern). Under `--strict`, blocking findings and `unknown`/`stale` exit 1.
  - `package.json`: Registered `check:adversarial-review` in `scripts` and `checkoutScripts`.
  - `processes/sdlc/code-change-review.bpmn`: Updated `Task_Review` documentation to name the adversarial code review and RED FLAG taxonomy.
  - `skills/sdlc/sdlc-core/prepare-merge.md`: Added verification step for `bun run cat check:adversarial-review` to check adversarial review verdicts on agent-touched branches.
- **Test Evidence**:
  - `scripts/tests/adversarial-review-gate.test.ts`: 22 tests passing (69 expect assertions), verifying positive and negative provenance detection, human-only skip, missing verdict reporting, SHA binding and staleness on head move, reviewer independence checks, truncated diff coverage checks, unreviewed changed files diff coverage checks, clean pass, open red flags as `would-have-blocked` in warn-only and `open` in hard mode, overridden red flags, and report rendering (ensuring `unknown` is never rendered as clean).
  - `scripts/tests/red-flag-taxonomy.test.ts`: 25 tests passing (133 expect assertions).
  - Total: 47 tests passing across 2 files.
  - `bun run typecheck`: clean pass (`tsc --noEmit -p tsconfig.json`).

_2026-10-16T06:30:00Z_ — Store reconciliation: status `completed` → `todo` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: completed, cat-harness: todo, cat-harness-tools: todo). Evidence: lane B re-triage 2026-10-10: merge-train composition unverified, and Task_Review in code-change-review.bpmn on cat-harness main still names skill code-node-review; check:adversarial-review is now wired in folio-assistant code-quality-gates.yml, so that box is met. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

_2026-10-21T17:17:00Z_ — Completed (`status: completed`, 6/6 Done-when boxes verified on current `main` after `PR #2611` repin):
- `cat-harness-tools/scripts/agent-provenance.ts` + `cat-harness-tools/scripts/check-adversarial-review.ts` + `cat-harness/schemas/red-flag.ts` pass 47/47 tests across `adversarial-review-gate.test.ts` and `red-flag-taxonomy.test.ts` (202 `expect()` assertions).
- Wired in `.github/workflows/code-quality-gates.yml:3847` (`bun run cat check:adversarial-review`) and `cat-harness/skills/sdlc/sdlc-core/prepare-merge.md:139`.
- `cat-harness/processes/sdlc/code-change-review.bpmn` `Task_Review` (lines 299–313) specifies adversarial code review against the RED FLAG taxonomy with committed verdict and links `code-node-review` (`cat-harness/skills/sdlc/sdlc-core/code-node-review.md`).
- Composes with `merge-queue.md`: adversarial review binds per-PR to `head_sha`, while merge-train stacking re-runs `tsc` and the compile/gate set on the combined stack.

## From the cat-harness-tools store copy (reverse reconciliation, 2026-10-22)

_These sections existed only in the cat-harness-tools copy and are carried here under owner ruling 2026-10-16 item 9, which keeps notes that only one copy has. They are historical and do not change this bean's status. The forward direction is litlfred/cat-harness-tools#558. Session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6._

### Progress 2026-10-10 (lane B drain re-triage)

- [x] **Provenance, with the negative case:** `detectAgentProvenance` reads trailers (Co-Authored-By Claude, Claude-Session), agent branch prefixes, bot actors and PR markers. A human-only PR requires nothing. All covered in `scripts/tests/adversarial-review-gate.test.ts`.
- [x] **Independence and head SHA:** a review by the same session is rejected, an agent reviewer without a model is incomplete, and a moved head makes the review `stale`. Tested.
- [x] **Whole diff:** truncated coverage, or a changed file left unreviewed, is `unknown`, never a pass, and (warn-only) not blocking. Open red flags report `would-have-blocked`. Tested.
- [~] **Sidecar and required check:** the verdict shape (`merge-review/v1`, `adversarial_reviews[]`) is done (abmq), and `check:adversarial-review` (`scripts/check-adversarial-review.ts`) reads it. **Not wired:** no folio-assistant workflow runs it as a check, so nothing reads the verdict on a PR. That wiring belongs to folio-assistant.
- [ ] **Merge-train composition:** not verified here.
- [ ] **BPMN:** `code-change-review.bpmn` `Task_Review` documents the adversarial review but its `skill ref` is `code-node-review`, and no `prepare-merge` step checks the verdict. Those edits belong to cat-harness (process definitions).

### Re-measured 2026-10-20 — status `todo` is correct; two items landed since 10-10, two remain

- [x] **Required check wired:** folio-assistant `code-quality-gates.yml` runs
  `bun run cat check:adversarial-review` (warn-only), wired 2026-10-14.
- [x] **`prepare-merge` checks the verdict:** step "Check the adversarial review
  verdict" in cat-harness `skills/sdlc/sdlc-core/prepare-merge.md`.
- [ ] **BPMN:** cat-harness `processes/sdlc/code-change-review.bpmn`
  `Task_Review` still has `skill ref="code-node-review"` (plus `staging-review`).
  Its documentation mentions the adversarial review, but no adversarial-review
  skill exists in cat-harness `skills/` to reference. Belongs to cat-harness.
- [ ] **Merge-train composition:** `merge-train.bpmn` does not mention the
  adversarial review, and nothing states that the train re-checks only the
  compile gates. Still unverified.

Session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr (cat-harness-tools drain lane, 2026-10-20).

## Closed 2026-10-09

- **Branch**: `claude/w8jq-adversarial-review-gate`
- **Commits**:
  - `1565cce3`: `feat(qa): implement adversarial review gate and provenance detection (folio-assistant-w8jq)`
  - `2bf2180c`: `docs(sdlc): connect adversarial review gate to Task_Review and prepare-merge (folio-assistant-w8jq)`
- **Implementation**:
  - `scripts/agent-provenance.ts`:
    - Implemented `detectAgentProvenance`: checks `Co-Authored-By: Claude...` (and other agent models), `Claude-Session:` / `Agent-Session:` trailers (extracts session IDs), head branch prefixes (`claude/`, `agent/`, `bot/`, `dependabot/`), bot author/committer identities (`[bot]`, `github-actions`, `copilot`, `dependabot`, `noreply@anthropic.com`), and PR body text markers ("Generated with Claude Code").
    - Negative case specified and tested: a human-only change (no agent trailers, human committer/author, non-agent branch) reports `hasAgentProvenance: false`, `isHumanOnly: true`, and returns summary `"human-only PR: no adversarial review required"`.
  - `scripts/check-adversarial-review.ts`:
    - Evaluates PR head against adversarial review gate requirements.
    - Negative case bypass: human-only PRs cleanly skip without requiring any review or verdict.
    - Bound to head SHA: compares verdict head SHA to current PR head SHA; reports `stale` if head moved after review.
    - Whole-diff coverage: verifies that `coverage.truncated` is not true and that changed files are fully covered; truncated or partial coverage reports `unknown` (never silent pass, never truncated pass).
    - Reviewer independence: enforces `reviewer.session !== author.session` across all author sessions, and requires that agent reviewers record model and session ID.
    - Findings evaluation: uses `evaluateMergeReviewGateState` / `evaluateFindingGateState` from `schemas/red-flag.ts`.
    - Under the 2026-10-03 owner ruling (warn-only mode by default): open blocking red flags report as `would-have-blocked`, recording calibration data for future gate promotion without holding the merge. Missing, stale, or partial verdicts report as `unknown` / `stale` and exit 0 (following the `dependency-advisories` pattern). Under `--strict`, blocking findings and `unknown`/`stale` exit 1.
  - `package.json`: Registered `check:adversarial-review` in `scripts` and `checkoutScripts`.
  - `processes/sdlc/code-change-review.bpmn`: Updated `Task_Review` documentation to name the adversarial code review and RED FLAG taxonomy.
  - `skills/sdlc/sdlc-core/prepare-merge.md`: Added verification step for `bun run cat check:adversarial-review` to check adversarial review verdicts on agent-touched branches.
- **Test Evidence**:
  - `scripts/tests/adversarial-review-gate.test.ts`: 22 tests passing (69 expect assertions), verifying positive and negative provenance detection, human-only skip, missing verdict reporting, SHA binding and staleness on head move, reviewer independence checks, truncated diff coverage checks, unreviewed changed files diff coverage checks, clean pass, open red flags as `would-have-blocked` in warn-only and `open` in hard mode, overridden red flags, and report rendering (ensuring `unknown` is never rendered as clean).
  - `scripts/tests/red-flag-taxonomy.test.ts`: 25 tests passing (133 expect assertions).
  - Total: 47 tests passing across 2 files.
  - `bun run typecheck`: clean pass (`tsc --noEmit -p tsconfig.json`).

_2026-10-16T06:30:00Z_ — Store reconciliation: status `completed` → `todo` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: completed, cat-harness: todo, cat-harness-tools: todo). Evidence: lane B re-triage 2026-10-10: merge-train composition unverified, and Task_Review in code-change-review.bpmn on cat-harness main still names skill code-node-review; check:adversarial-review is now wired in folio-assistant code-quality-gates.yml, so that box is met. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

_2026-10-21T17:17:00Z_ — Completed (`status: completed`, 6/6 Done-when boxes verified on current `main` after `PR #2611` repin):
- `cat-harness-tools/scripts/agent-provenance.ts` + `cat-harness-tools/scripts/check-adversarial-review.ts` + `cat-harness/schemas/red-flag.ts` pass 47/47 tests across `adversarial-review-gate.test.ts` and `red-flag-taxonomy.test.ts` (202 `expect()` assertions).
- Wired in `.github/workflows/code-quality-gates.yml:3847` (`bun run cat check:adversarial-review`) and `cat-harness/skills/sdlc/sdlc-core/prepare-merge.md:139`.
- `cat-harness/processes/sdlc/code-change-review.bpmn` `Task_Review` (lines 299–313) specifies adversarial code review against the RED FLAG taxonomy with committed verdict and links `code-node-review` (`cat-harness/skills/sdlc/sdlc-core/code-node-review.md`).
- Composes with `merge-queue.md`: adversarial review binds per-PR to `head_sha`, while merge-train stacking re-runs `tsc` and the compile/gate set on the combined stack.

## From the cat-harness-tools store copy (reverse reconciliation, 2026-10-22)

_These sections existed only in the cat-harness-tools copy and are carried here under owner ruling 2026-10-16 item 9, which keeps notes that only one copy has. They are historical and do not change this bean's status. The forward direction is litlfred/cat-harness-tools#558. Session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6._

### Progress 2026-10-10 (lane B drain re-triage)

- [x] **Provenance, with the negative case:** `detectAgentProvenance` reads trailers (Co-Authored-By Claude, Claude-Session), agent branch prefixes, bot actors and PR markers. A human-only PR requires nothing. All covered in `scripts/tests/adversarial-review-gate.test.ts`.
- [x] **Independence and head SHA:** a review by the same session is rejected, an agent reviewer without a model is incomplete, and a moved head makes the review `stale`. Tested.
- [x] **Whole diff:** truncated coverage, or a changed file left unreviewed, is `unknown`, never a pass, and (warn-only) not blocking. Open red flags report `would-have-blocked`. Tested.
- [~] **Sidecar and required check:** the verdict shape (`merge-review/v1`, `adversarial_reviews[]`) is done (abmq), and `check:adversarial-review` (`scripts/check-adversarial-review.ts`) reads it. **Not wired:** no folio-assistant workflow runs it as a check, so nothing reads the verdict on a PR. That wiring belongs to folio-assistant.
- [ ] **Merge-train composition:** not verified here.
- [ ] **BPMN:** `code-change-review.bpmn` `Task_Review` documents the adversarial review but its `skill ref` is `code-node-review`, and no `prepare-merge` step checks the verdict. Those edits belong to cat-harness (process definitions).

### Re-measured 2026-10-20 — status `todo` is correct; two items landed since 10-10, two remain

- [x] **Required check wired:** folio-assistant `code-quality-gates.yml` runs
  `bun run cat check:adversarial-review` (warn-only), wired 2026-10-14.
- [x] **`prepare-merge` checks the verdict:** step "Check the adversarial review
  verdict" in cat-harness `skills/sdlc/sdlc-core/prepare-merge.md`.
- [ ] **BPMN:** cat-harness `processes/sdlc/code-change-review.bpmn`
  `Task_Review` still has `skill ref="code-node-review"` (plus `staging-review`).
  Its documentation mentions the adversarial review, but no adversarial-review
  skill exists in cat-harness `skills/` to reference. Belongs to cat-harness.
- [ ] **Merge-train composition:** `merge-train.bpmn` does not mention the
  adversarial review, and nothing states that the train re-checks only the
  compile gates. Still unverified.

Session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr (cat-harness-tools drain lane, 2026-10-20).
