---
name: integration-backlog
user_invocable: true
description: >
  Dispatcher for the `/integration-backlog <axes>` slash command.
  Works the backlog identified by the integration watchers (proof,
  canonical, compute, detangler, one-voice, …) by clustering the
  open findings into review-sized batches (≤ 49 files per PR — the
  reviewer-bot limit), proposing each batch to the author via
  structured AskUserQuestion calls, running `/prepare-merge` on
  each, resolving review comments (auto if mechanical, structured
  AskUserQuestion if architectural), then merging — and repeating
  until the axis is exhausted or the author signals stop.
  Sister command to `/integration-watch`: the watcher MONITORS for
  new events; this skill WORKS the backlog the watcher already
  catalogued.
allowed-tools: Read Edit Write Bash Grep Glob Agent Monitor Skill AskUserQuestion
---

# /integration-backlog — drive the backlog to zero, one PR at a time

A workflow skill that turns each integration-watcher's open findings
into a stream of small, reviewable PRs. Where
[`integration-watch`](integration-watch.md) arms a Monitor + PR
subscriptions to react to new events as they arrive, this skill instead
**drains the existing backlog** that the watchers have already
identified, working through it batch-by-batch with the author in the
loop only when judgement is genuinely needed.

## Argument grammar

```
/integration-backlog                              → ask which axes
/integration-backlog proof                        → just proof backlog
/integration-backlog canonical                    → just canonical backlog
/integration-backlog compute                      → just compute backlog
/integration-backlog detangler                    → just detangler backlog
/integration-backlog one-voice                    → just one-voice backlog
/integration-backlog voice                        → same as `one-voice`
/integration-backlog all                          → drain all enabled axes (sequential)
/integration-backlog proof,canonical              → drain those two (sequential)
/integration-backlog proof canonical              → same (space-separated)
/integration-backlog <unknown>                    → reject, re-prompt
```

**Axes are drained sequentially**, not in parallel — each PR needs to
land before the next batch is computed (otherwise the backlog count
drifts mid-flight and batches overlap). Inside a single axis, multiple
batches may be in flight if they are genuinely independent (different
chapters / different file trees) — see §4.

## Argument-resolution & role gate

Same alias and role-gate logic as `/integration-watch`:

- `voice` → `one-voice`
- `detanglement` → `detangler`
- `compute-integration` → `compute`
- `all` → all enabled axes
- write-side axes (e.g. `compute`, `one-voice`, `all`) require
  `collaborator`+
- `proof`, `canonical`, `detangler` are also `collaborator`+ here (this
  skill writes code; the read-only `reader` analog is
  `/integration-watch`).

If the user is a `reader`, fall back to `/integration-watch <args>` and
explain the difference: the watcher monitors and triages; the backlog
skill writes commits and merges.

If no argument is supplied, surface a 4-chip `AskUserQuestion`
(multi-select) listing the enabled axes plus `all`, prefixed with 🟡 per
the AGENTS.md user-accessibility convention.

## Workflow (per axis)

For each resolved axis, run §1 → §4 and then §6 in order. The loop body in
§2–§4 repeats until the axis is exhausted or the author types "stop".

### §1. Audit — count + cluster open findings

1. Read every `<block>.qa.json` (or watcher queue file) for the axis to
   compute the **open-fail list**: per-block label, path, criterion,
   severity, and a brief evidence quote.
   - **Scored rater criteria** have no binary fail; instead order by
     **ascending `score`** (lowest quality first) and treat any block
     with `score.value < 0.66` as open. After the routed improver
     (the content type's simplifier, triage or consolidation skill)
     runs, **re-rate** (re-dispatch
     the rater agent) and confirm `score` rose before closing — the
     rate→improve loop.
2. Cluster the open list into **batches** with these constraints:
   - **≤ 49 files changed per batch** (the reviewer bot's review-comment
     limit — at 50+ files it truncates). The accounting includes
     `.qa.json` sidecars, since each `.md` edit refreshes one sidecar.
   - **Single-criterion batches preferred** (one PR = one axis, easier
     review).
   - **Same-chapter / same-file-tree batches preferred** (less
     cross-cutting impact).
   - **Mechanical vs judgement-needing split**: a batch is "mechanical"
     if every block needs the same rewrite (e.g. emoji → text);
     "judgement-needing" if each block needs an author-decided rename
     (e.g. a notation `\mathcal{C}` → one of several disambiguated
     variants). Surface them separately.
3. Emit a short status: `axis=X, open=N, batches=M (B_mech mech / B_jud
   judgement)`.

### §2. Per-batch user authorization

For each batch, **before** doing any edits, surface an `AskUserQuestion`
(multi-select, 🟡 prefix) with:

- **Evidence**: per-block file paths, line numbers, evidence quotes
  (truncated to 80 chars each) for the first 3-5 blocks. Linkable as
  GitHub blob URLs (use the repo's `https://github.com/<owner>/<repo>/blob/<branch>/<path>`
  form).
- **Per-option trade-offs**:
  - **`apply mechanically`** — agent rewrites all N blocks with the same
    pattern; commits + pushes; expected outcome `criterion: N → 0`.
    Risk: low; reversible.
  - **`split by sub-pattern`** — agent surfaces the 2-4 distinct
    sub-patterns inside the batch and asks again with finer
    granularity. Cost: extra round-trip; better for judgement-needing
    batches.
  - **`defer batch`** — skip this batch, move to next. Use when scope is
    unclear or out-of-skill.
  - **`other`** — free-text note from author overrides default
    behaviour.
- **Concrete consequences**: "if you pick `apply mechanically`, I create
  branch `claude/integration-backlog-<axis>-<theme>-<utc>`, apply the
  rewrite, push, open PR, `/prepare-merge`, address review comments, and
  merge. ~5-15 min wall-clock per batch."

### §3. Branch + commit per batch

For each authorized batch:

1. **Create branch** under the structured-name convention (the folio's own
   `AGENTS.md` sets it; the accessibility half is
   [`interaction-modality`](../../../skills/conduct/conduct-core/interaction-modality.md)):
   `claude/integration-backlog-<axis>-<theme>-<YYYY-MM-DD>`
   - `axis` ∈ the enabled axes
   - `theme` ≤ 40 chars, lowercase, hyphenated
   - example: `claude/integration-backlog-one-voice-emoji-tables-2026-05-20`
2. Apply the batch edits. For mechanical batches, do the substitutions
   directly; for sub-pattern batches, dispatch a focused
   `Agent(subagent_type: general-purpose)` per sub-pattern.
3. **Run validation**: `bun run validate <paper>` and the relevant
   `qa-sweep --only <criterion>`. Refuse to push if either fails —
   surface the failure to the user via AskUserQuestion before
   recovering.
4. **Commit** with the prescribed format (see AGENTS.md commit-message
   guidance: `<axis>: <theme> (N items)`, include before/after counts in
   the body).
5. **Push** `-u origin <branch>` with retry on network errors.
6. **Open PR** via `mcp__github__create_pull_request` with body:
   - Summary (theme, count, before/after numbers)
   - Per-block bulleted change list (or aggregated table)
   - Test plan (validation passes, sweep count drops)
   - **Footer**: a tag identifying this PR as part of the
     `/integration-backlog <axis>` campaign, so sibling sessions can
     deduplicate.

### §4. /prepare-merge-auto integration

Invoke `/prepare-merge-auto` on the PR just opened. This skill handles
the FULL autonomous merge pipeline:

- **Phase 0**: Sibling coordination (notify overlapping PRs)
- **Phase 1**: `/prepare-merge` (rebase, integrate, voice, formal-layer,
  request reviews)
- **Phase 2**: Resolve review comments automatically:
  - Mechanical fixes → commit directly
  - Architectural questions → structured `AskUserQuestion` (🟡,
    multi-select, with file + line + reviewer text quoted)
  - False-positive review comments → polite one-line counter-comment
- **Phase 3**: Structured user questions (only when genuinely blocked)
- **Phase 4**: Merge (after all comments resolved + CI green) via
  `merge_method: "rebase"` per AGENTS.md §Branch + PR workflow rule 7
- **Phase 5**: Post-merge sibling notification

See [`sdlc/skills/sdlc-core/prepare-merge-auto.md`](prepare-merge-auto.md)
for the full workflow specification.

Review-comment triage and the pre-merge owner confirmation are
`/prepare-merge-auto` phases 2–4; the merge-method default (rebase) and the
owner-confirmation requirement are in its Phase 4.

### §6. Loop control

After merging (or deferring) a batch:

1. **Refresh the audit** (`qa-sweep` again — open count may have dropped
   by collateral cleanup or risen if main moved).
2. **Pick the next batch** per §1 clustering rules.
3. **Repeat from §2**.
4. **Stop conditions**:
   - User types "stop" / "done" / "pause" / equivalent.
   - All open fails for this axis are 0.
   - Three batches in a row deferred (signals scope mismatch).
   - The remaining batches all require author judgement and the user has
     answered `defer` ≥ 3 times in a row — surface a summary
     AskUserQuestion: "Remaining N batches all need judgement. Continue /
     Open issue / Stop."

When the axis is exhausted, emit a final status: `axis=X drained: N→0
fails across M batches (M-1 merged + 1 deferred); wall-clock <Z>min`.

## Multi-axis dispatch (`all` or comma-list)

When multiple axes are requested:

1. Compute the open-fail count per axis first; surface a single
   AskUserQuestion asking which axis to drain first (default to the axis
   with the highest critical-fail count).
2. Drain them sequentially (§1-§6 per axis).
3. Between axes, allow the user to insert other work via a pause:
   AskUserQuestion "Axis X complete. Continue to next, or pause?".

## Persistence — `beans/integration-backlog-ledger.md`

Per the coordination ledger rule (`coordinate` §9), every batch decision and merge outcome is appended
to:

```
beans/integration-backlog-ledger.md
```

Entry format:

```markdown
### 2026-05-20T14:50Z — one-voice / voice-emoji-tables
- batch: 17 blocks, 23 files (≤49 ✓)
- user authorized: `apply mechanically` (2026-05-20T14:51Z)
- branch: claude/integration-backlog-one-voice-emoji-tables-2026-05-20
- PR: #952
- /prepare-merge: clean rebase ✓ ; formal-ref ✓ ; validation ✓
- reviews: 0 active, 2 mechanical (fixed inline)
- merge: 2026-05-20T15:02Z @ sha `abcd1234`
- delta: voice-emoji-content 20 → 3 (∇ 17)
```

This is the resume target for sessions that drop the loop mid-campaign.

## Integration

- **Built on**: `integration-watcher` (audit identification),
  `integration-watch` (dispatcher pattern), `prepare-merge-auto` (merge
  workflow), `coordinate` (ledger / sibling-PR coordination)
- **Dispatches to**: per-axis `Agent` calls for mechanical batches,
  direct edits for trivial ones, AskUserQuestion for judgement
- **AGENTS.md links**:
  - work-plan policy (work items queue + idle-trigger)
  - User-accessibility (🟡, multi-select default, structured branch
    names)
- **One branch / one PR for related things** (`integration-watcher` §0a,
  rule 1) — interpreted here as "combine related batches when ≤ 49 files;
  otherwise split"

## Examples

```
User: /integration-backlog
→ Preamble + 4-chip AskUserQuestion; user picks one or more axes.

User: /integration-backlog one-voice
→ §1 audit: "axis=one-voice, open=29, batches=4 (3 mech / 1 jud)"
  §2: AskUserQuestion for batch 1 (emoji tables, 17 blocks, 23 files)
  user answers `apply mechanically`
  §3: branch + commit + push + PR #952
  §4: /prepare-merge-auto; reviewer posts 2 comments; both mechanical → fixed;
      AskUserQuestion "merge?" — user says merge; merged
  → §6: loop to batch 2 …

User: /integration-backlog all
→ Per-axis counts: one-voice=29, proof=18, canonical=4, compute=12, detangler=7.
  AskUserQuestion "Start with one-voice (highest count)?" — user says yes
  Drain one-voice; then ask before moving to proof.
```

## Failure modes

- **Validation fails mid-batch**: revert the .md edits via `git checkout
  .`, surface a focused AskUserQuestion with the validation error + the
  offending line.
- **Sweep counts not dropping**: the batch's rewrite missed a case.
  Surface the leftover hits via AskUserQuestion with the per-block
  residual count.
- **Network / GitHub failures**: retry per AGENTS.md `git push`
  exponential-backoff convention; if persistent, defer the batch and
  continue with the next.
- **Conflicting sibling PR**: detect via
  `mcp__github__list_pull_requests` before opening; if a sibling already
  covers the batch's scope, defer + post a coordinate comment.

## See also

- [`integration-watch`](integration-watch.md) — read-side dispatcher
  (monitor, no commits)
- [`integration-watcher`](integration-watcher.md) — abstract parent for
  the concrete watchers
- [`prepare-merge-auto`](prepare-merge-auto.md) — the merge workflow each
  batch runs through
- [`coordinate`](coordinate.md) — sibling-PR coordination
