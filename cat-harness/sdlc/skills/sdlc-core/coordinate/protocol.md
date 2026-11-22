---
part-of: coordinate
description: >
  Detail for `coordinate`, split out of it so the parent stays a short entry
  point. NOT a skill of its own — reached through the parent, and section
  numbers are the parent's.
---

# coordinate — the Protocol, §1–§11

The eleven numbered coordination steps. Read this when you are **doing** the
coordination; the parent says when to invoke it and what it is for.

**Section numbers are the parent's** — a citation such as `coordinate.md §8a`
resolves to this file.

## Protocol

### 1.  Read sibling PRs first

For each sibling change proposal (pull request, PR), read its number,
title, body, state, head branch and last update, and the paths of every file
it changes — the *read change proposal* and *list changed files* [forge-operation Tool](../../../../skills/tools/folio-core/skills-and-tools.md#the-forge-operations-one-tool-node-each)s.
Read the **full** file list, not a truncated head — partial scope
maps cause silent overlaps later. File paths are cheap.

Build a **scope map**: which PR owns which workplan phase,
which files, which blocks, which scripts.

### 2.  Identify three relationships per sibling

For every sibling PR, classify yourself on three axes:

| Axis | Values |
|------|--------|
| **Overlap** | none / additive (different files, same goal) / conflicting (same file or same block) |
| **Dependency** | independent / I depend on theirs / they depend on mine |
| **Cherry-pick opportunity** | none / I want X / they probably want Y |

A sibling that is `(none, independent, none)` doesn't need a
coordination comment.  Anything else does.

#### 2-bis.  Domain-contract sync

**If your PR touches an algorithm, pipeline step, or data contract
that the project documents as a *maintenance contract* (a doc whose
`uses[]`, `computation.script`, `computation.witness`, and prose
sections must stay in sync with the actual code), you MUST update the
matching contract block in the same PR.**

Such a contract is not a static document: reviewers diff it against
the code change. When posting your intent comment on a sibling PR
whose scope overlaps such a contract, name the contract block(s) you
will touch alongside the script paths.

### 3.  Post intent before working

Comment on each sibling PR with non-trivial relationship (the `github`
Tool, *comment on change proposal*).  Format:

```markdown
## Coordination from #<your PR>

**Picking up:** <one sentence — which workplan phase / task>

**Scope confirmation:**
- I will touch: `path/to/file:line-range`, `path/to/other`, …
- I will not touch: `<the sibling's territory>`

**Cherry-pick from you:**
- <what you need from them; e.g. "the template you used for `<block>`">

**Cherry-pick for you:**
- <what you'll produce that they may want; e.g. "the reader for
  `<artifact>` is the same shape they need for `<other path>`">

**Asks (small):** <questions they can answer in one line>

**Escalation to author:** <if any; see §6>
```

Keep it short.  One ask per ask.  No prose.

### 4.  Post progress at task boundaries

When you commit something cherry-pickable, post a follow-up:

```markdown
## Progress from #<your PR> · `<short-task-name>`

- Landed in `<commit-sha>`: <one sentence>
- Cherry-pick file pointers: `path/file.py:fn`, `path/file.lean:Decl`
- Updated [`<your-audit-or-plan-doc>.md`](…) §<section>: <what
  changed> — and/or appended a row to
  [`docs/coordination/<goal-slug>.md`](…)
- Next: <next task on your queue>
```

Cherry-pick file pointers are the load-bearing part — the sibling
agent should be able to copy/cite without reading your whole diff.

### 5.  Responding to review comments on your own PR

Code-review tools (`gemini-code-assist[bot]`,
`copilot-pull-request-reviewer[bot]`, `codex[bot]`) and human
reviewers leave comments on your PR.  **Do not silently accept or
silently dismiss.**  The same rules that govern cross-PR
inconsistencies (§6) govern review feedback.

#### 5a.  Triage every comment

For each comment, assign one of four verdicts:

| Verdict | When | Action |
|---------|------|--------|
| `accept` | Suggestion is correct and small | Apply the fix in a single commit citing the comment URL; mark the thread resolved if the tooling permits. |
| `accept-with-modification` | Intent is right but the suggested patch has its own issue (e.g. introduces a different off-by-one, or breaks a sibling-PR's convention) | Apply a corrected version; reply on the thread with one paragraph explaining what you did and why the original suggestion needed adjusting (cite `file:line` where the divergence matters). |
| `reject-with-reason` | Finding is incorrect (mathematically, empirically, or by project convention) | Reply with the reasoning: cite the specific line, definition, or sibling-PR convention that contradicts the suggestion.  Never silent-dismiss. |
| `escalate` | Finding is correct but would cross a sibling-PR's territory, or two reviewers disagree, or the comment exposes an inconsistency in a sibling PR's audit | See §6.  Reply with an `⚠️` flag and tag the author. |

#### 5b.  Verify against the actual artifact / code before replying

Review-tool suggestions can be **subtly wrong**.  Common failure
modes:

- **Off-by-one fixes that flip-flop a convention**: a reviewer
  proposes a boundary change without noticing context that makes
  the original correct.  Read the artifact, not just the suggested patch.
- **Cross-PR convention conflicts**: e.g. PR A names a field
  `active_set`, PR B names it `active_constraints`; a
  reviewer suggesting one without checking the other introduces
  a merge conflict downstream.  Check sibling PRs before applying.
- **Hallucinated context**: review tools sometimes reference PR
  numbers or comment IDs that don't exist.  If the reviewer
  references a comment you didn't write, treat it as a
  hallucination and ignore the cross-reference (but still
  evaluate the substantive content of the comment on its merits).

If you can't verify in &lt; 2 minutes, escalate (§6) rather than
guess.

#### 5c.  Post one consolidated status comment

After triaging all threads from one review pass, post a **single**
PR-level summary (the *comment on change proposal* [forge-operation Tool](../../../../skills/tools/folio-core/skills-and-tools.md#the-forge-operations-one-tool-node-each)):

```markdown
Thanks @<reviewer> — addressed all <N> threads in [`<sha>`](<commit-url>).

| # | Issue | Verdict | Resolution |
|---|---|---|---|
| 1 | Off-by-one in index | accept | Fixed |
| 2 | … | accept-with-modification | Fixed differently — see note below |
| 3 | … | reject-with-reason | See reply on thread |
| 4 | … | escalate | ⚠️ tagged @<author> |

**Re #2 (note):** <short paragraph explaining the modification>
```

One summary avoids a reply per thread while still recording every verdict.
Threads marked `accept` /
`accept-with-modification` should be resolved (the *resolve review thread* [forge-operation Tool](../../../../skills/tools/folio-core/skills-and-tools.md#the-forge-operations-one-tool-node-each))
once the reviewer acknowledges or after a one-day cooling period.

#### 5d.  When the reviewer pushes back

Keep the dialogue **short** — re-state the reasoning or the sibling-PR
convention once, ask for a yes/no on whether the reviewer agrees.  After
the second exchange, escalate (§6), because loops with bots do not converge.

### 6.  Inconsistent findings → escalate, do not paper over

If a sibling PR's finding contradicts yours — **or** if a code-review
comment claims a fact that contradicts a sibling PR's audit (§5a
`escalate`) — do NOT silently change your framing.  Post on every
affected PR:

```markdown
## ⚠️ Inconsistent finding — author input requested

- This PR's claim: <yours, file_path:line cited>
- Sibling #<N>'s claim: <theirs, file_path:line cited>  (or:
  Reviewer's claim in <comment-url>)
- Likely cause: <best guess, ≤ 2 sentences>
- Resolution requested: <which framing to adopt going forward>

Tagging @<author>.  Will hold downstream work blocked on this.
```

The author owns the resolution.  Do not "split the difference" or
guess.  Inconsistent findings — whether between sibling PRs, or
between a reviewer and a sibling PR — are an audit flag.

**Escalation rate-limit.**  An author flooded with pings cannot arbitrate, so
batch-escalate when possible: one comment listing every disagreement found in a
review pass, with a short table.

### 7.  Periodic sibling-PR triage

Sibling PRs land commits and comments while you work.  Without
periodic triage you will:

- duplicate a fix the sibling already landed,
- miss a question they posted directing back at you,
- accept a review-comment that contradicts a finding the sibling
  just published.

Run a triage **every 3–5 of your own commits**, or whenever you
finish one substantive task and pick up the next.  Format:

```
## Sibling-PR triage report (<your PR>, <timestamp>)

| PR | New comments | New commits | CI | Asks for me | Action |
|----|:---:|:---:|:---:|---|---|
| #564 | 6 | 8 | ✅ | (none) | none |
| #565 | 5 | 3 | 🟡 | P6 scope check (3 Q) | answer in next round |
| #568 | 1 | 1 | ⚪ | (cherry-pick acked) | post drop-duplicate notice |
```

For each "Asks for me" with verdict `answer` or `escalate`, queue a
coordination response in the next coordination round.  For verdict
`none` or `acked`, no further action.

**Use a background subagent for triage when possible** —
`Agent(subagent_type=Explore, run_in_background=true, prompt=...)` reads sibling
PRs without blocking your foreground work.  Triage prompt template:

> Background triage of sibling PRs <list>. For each:
> 1. New comments since <my last coordination round timestamp>.
> 2. New commits + sha + 1-line message.
> 3. CI status.
> 4. Specifically flag asks/replies directed at <my PR> + any
>    inconsistent findings vs <my key audit/artifact claims>.
> Report under 400 words; per-PR table.

### 8.  Watching `main` and newly-created branches

Sibling PRs are not the only thing that moves.  `main` lands merges,
and **new branches/PRs** sometimes open mid-session by the author or
other agents — these need to enter the scope map immediately.

#### 8a.  Watch `main` for new commits

Run `git fetch origin main` at each triage cycle.  If new commits
landed since your last fetch, run:

```bash
git log --oneline <last-fetched-main-sha>..origin/main \
  -- <files-or-paths-you-are-touching>
```

For each main-landed commit that touches **a file or block
you are editing**, classify it like a sibling PR using §2: overlap /
dependency / cherry-pick.  Then choose:

- **Merge `origin/main` into your branch** if the changes are
  additive and you don't have local edits to the same files.
- **Cherry-pick the relevant commit** if main's branch tip has too
  much unrelated noise.
- **Escalate to the author (§6)** if main's change contradicts a
  finding you just published.

Do not silently rebase or force-push to incorporate `main` — those
are author-authorised actions, see the repo's Git Operations policy.

##### 8a-bis.  Watch for new skills landing on main

In the same `git fetch origin main` pass, additionally run:

```bash
git diff --name-only --diff-filter=A \
  <last-fetched-main-sha>..origin/main \
  -- '*skills/*.md'
```

For each new skill file:

1. **Read its frontmatter** (`name`, `roles`, `description`,
   `inherits`).
2. **Decide relevance**: does the skill's description overlap your
   branch's scope?
   - Mention a file kind / domain / pattern you're editing (touched
     in `git diff origin/main..HEAD --name-only`), OR
   - Provide a new integration-watcher child (`inherits:
     sdlc-core/integration-watcher`) and your branch is itself an
     integration-watcher PR, OR
   - Provide a new QA / sweep / audit skill (one-voice-*, proof-*,
     compute-*, etc.) and your branch touches the corresponding
     content blocks.
3. **Surface to the user via `AskUserQuestion`** with the standard
   3-chip pattern from `watch.md §3.Q3a`:
   - `Adopt now` — invoke the skill on the relevant subset
   - `Defer to follow-up branch` — record decision, don't change
     this branch
   - `Not relevant` — record so the watcher doesn't re-prompt
4. **Record the decision in the coordination ledger** under a
   new `## New skills detected on main` subsection so future
   sessions don't re-prompt.

This mirrors `watch.md §3.Q3a`, so every coordinator session picks up new
infrastructure as it lands, without the user announcing it to each PR.

#### 8c.  Pre-push stale-state check (MANDATORY)

**Trigger:** before every `git push` (whether new commits or force-
push). The watcher can lapse silently (Monitor timeouts, hooks-busy
windows, background-agent waits), so force a fresh fetch and compute
the upstream delta:

```bash
git fetch origin '+refs/heads/main:refs/remotes/origin/main' 2>/dev/null
DELTA=$(git rev-list --count HEAD..origin/main)
SIBS=$(git log --oneline ${MERGE_BASE:-$(git merge-base HEAD origin/main)}..origin/main 2>/dev/null | wc -l)
echo "main is ${DELTA} commits ahead since branch base"
```

> **Fetch the ref you are about to read, with an explicit refspec.**
> `git fetch origin main` writes `FETCH_HEAD`; it refreshes
> `refs/remotes/origin/main` only when the clone's configured
> `remote.origin.fetch` covers that branch — and it **exits 0 either way**, so
> a clone whose refspec was narrowed to one branch answers every `origin/main`
> question from a stale ref. Use `+refs/heads/<b>:refs/remotes/origin/<b>`,
> which is correct whatever the clone is configured with.
>
> - **Fetch the same ref you then read.** Fetching `main` and then measuring
>   `origin/<BRANCH>` reports 0 missed commits by construction.
> - **A per-branch refspec does not repair `for-each-ref`.** Anything walking
>   `refs/remotes/origin/claude/*` sees only what was fetched by name, so an
>   empty result means "never fetched", not "no siblings". Check
>   `git config --get-all remote.origin.fetch | grep 'refs/heads/\*'` before
>   believing it.

Decision matrix:

| Delta | Action |
|---|---|
| `0..2` | push freely |
| `3..10` | **fetch and triage**: list each new main commit; for any touching files in your branch's diff, classify per §2 (rebase-now, defer, escalate) BEFORE pushing |
| `> 10` | **stop**: announce to the user. Long-discharge sessions risk substantial divergence; offer prepare-merge rebase OR continue + flag |

Additionally, list PRs with the *list change proposals* [forge-operation Tool](../../../../skills/tools/folio-core/skills-and-tools.md#the-forge-operations-one-tool-node-each), filtered to
`state:open updated since <session_start>` and check for sibling PRs
that opened mid-session. Each new sibling enters scope per §3.

A stale base turns a clean fast-forward push into a multi-conflict rebase, so
when pushing many small commits in a row, run this check every ~5 commits or
every 30 minutes of foreground work.

#### 8d.  Long-task drift recovery

If you discover ≥ 5 new main commits AFTER a Monitor timeout or
hooks-busy window, do NOT just "re-arm and continue":

1. **Compare**: `git diff --name-only HEAD..origin/main` to find
   overlapping files.
2. **If overlap is empty**: re-arm watch (silent OK).
3. **If overlap exists**: invoke `coordinate` §2 classification
   on each overlap. Most common: another agent edited the same content
   block (`.lean`, `.md`, `.ts` trio). Resolve BEFORE committing
   more work that will conflict.
4. **Notify the user** if ≥ 2 substantive overlaps: this is the
   signal that multiple agents are working in the same scope and the
   user should coordinate goals.

#### 8b.  Watch for newly-opened PRs / branches

Each triage cycle, list open PRs (number, title, head branch, creation
time) and branches — the *list change proposals* and *list branches*
[forge-operation Tool](../../../../skills/tools/folio-core/skills-and-tools.md#the-forge-operations-one-tool-node-each)s; branches alone are also listable with `git ls-remote
--heads origin`, which needs no forge.

If a **new** PR or branch appears since the last triage and its
title / branch-name overlaps any of your scope keywords (your
audit subjects, your changed files, your blocks), **prompt
the author**:

```markdown
**Q from #<your PR>:** I see #<N> (`<branch>`) opened at
<timestamp>; should I add it to my coordination scope (§3) and
post intent?  Or is it independent of the <goal> goal-thread?
```

Do not silently add the new PR to scope — the author may have
opened it as an isolated probe.  Wait for confirmation before
posting coordination comments on the new PR.

### 9.  Coordination ledger

Maintain a single shared ledger at:

```
docs/coordination/<goal-slug>.md
```

Each PR appends a row (no rewrites of others' rows):

```markdown
| Date | PR | Phase | Status | Cherry-pick |
|------|----|-------|--------|-------------|
| 2026-01-01 | #564 | phase A wire-up | landed `<sha>` | `<reader>` |
| 2026-01-01 | #565 | migration | in-progress | — |
| 2026-01-01 | #567 | sub-lemma | landed `<sha>` | `<block>` template |
```

The ledger lives on the branch where the coordinator is currently
posting; final state can be merged to main when the goal completes.

### 10.  Cherry-picking

**Cherry-picking is fine — treat it as a low-friction default.**
When an in-flight sibling has infrastructure (a script, a witness,
a template, a content block) that you'd otherwise
duplicate, just cherry-pick it: small structured commits exist so that anyone
can pick them up. The rules:

1. **Cite the source in your commit message.** Either
   `Cherry-pick of #<N>:<sha>` on the trailer line or a
   `Co-authored-by:` line. Attribution is cheap and lets
   `git log --grep` surface who originated the change. Optional
   but recommended — missing attribution is not a blocker.

2. **One-voice still applies.** Whatever you keep from the source
   should read as your own work; rewrite voice / framing if the
   sibling's tone clashes (AGENTS.md voice rules don't relax just
   because the source was a different agent).

3. **You may diverge.** If you adapt the cherry-picked file —
   rename imports, change a helper, tighten a tolerance — that's
   normal. No requirement to post the adaptation back on the
   source PR; the sibling will see your divergence in their own
   §7 triage if it matters to them.

4. **You may pre-empt main.** Cherry-picks from open sibling PRs
   are explicitly allowed; you do not need to wait for the source
   to land on `main`. When the source eventually merges, you'll
   either pick up the canonical version on your next rebase
   (drift handled by the `watch` §2a auto-resolve) or
   keep a slight divergence (also fine).

5. **Pre-flagging is optional.** If you're picking something
   substantive (a whole module, a large script) and want to
   reduce the chance of duplicated work, posting a one-liner
   coord comment on the source PR before picking is courteous —
   but it is **not required**. For small picks (single helper, a
   witness JSON, a class declaration), just commit.

When the source PR lands on `main`, attribution stops being
necessary — the file is just upstream code. A fresh PR sourced
from a main-merged commit needs no `Cherry-pick of` line.

### 11.  Asks and responses

Asks are a first-class artefact.  Format every cross-PR ask as:

```markdown
**Q from #<your PR>:** <question>

(answers as inline replies on the destination PR)
```

If a sibling has not answered an ask after 1 calendar day in an
async setting, restate the ask in a fresh comment and tag the
author.  Do not block indefinitely.

