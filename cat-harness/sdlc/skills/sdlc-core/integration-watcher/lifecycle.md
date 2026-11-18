---
part-of: integration-watcher
description: >
  Detail for `integration-watcher`, split out of it so the parent stays a
  short entry point. NOT a skill of its own — it is reached through the
  parent, and section numbers are the parent's.
---

# integration-watcher — §1–§4, the watch lifecycle

The run-once setup, the watching loop, the trigger filter and the per-event
pipeline. Read this when you are **running** a watcher; the parent carries what
binds you before you start.

**Section numbers are the parent's and do not change here** — children cite
`parent §4b` and `parent §4e`, and those references resolve to this file.

## 1. Baseline + setup (run once per session)

```bash
# Repo identity — declared once, referenced everywhere below.
# Read from the project config / git remote, not hard-coded.
OWNER=<repo-owner>
REPO=<repo-name>

# Bootstrap the queue + ledger under beans/ (queue tracked as a bulk-JSON
# coordination queue; ledger gitignored — both survive branch switches)
mkdir -p beans
NAME="<your-watcher-name>"
[ -f "beans/${NAME}-queue.json" ] || \
  echo '{"items":[],"audited":{},"reviewed_up_to":{}}' > "beans/${NAME}-queue.json"
[ -f "beans/${NAME}-ledger.md" ] || cat > "beans/${NAME}-ledger.md" <<EOF
# ${NAME} — session ledger

| ts (UTC) | event | scope | findings | action |
|----------|-------|-------|----------|--------|
EOF

# Stash main baseline so timeout recovery (watch.md §5b) can diff cleanly.
# Explicit refspec — see coordinate.md §8a: a bare fetch may not write
# refs/remotes/origin/main, and a baseline read from an unwritten ref is not one.
git fetch origin '+refs/heads/main:refs/remotes/origin/main' 2>/dev/null
git rev-parse origin/main > "/tmp/_${NAME}_main.sha"
```

Queue file shape (children may extend with extra fields but must keep
this core):

```json
{
  "items": [
    {
      "id": "<sha1-12 of block-or-script + finding-class>",
      "block_or_script": "<label or path>",
      "paths": { "ts": "...", "md": "...", "formal": "...", "py": "..." },
      "finding": "<domain-specific from Slot D>",
      "severity": "critical | major | minor",
      "source": "watch:main:<sha> | watch:pr:<N>:<event-ts> | backlog",
      "source_sha": "<full SHA of the commit that triggered or backlogged this item>",
      "evidence": "<one paragraph: file:line + offending text>",
      "attempts": [ { "ts": "...", "tactic": "...", "outcome": "fail|partial|ok" } ],
      "status": "queued | in-progress | resolved | needs-author | wontfix | queued-for-removal",
      "asked_author_at": null
    }
  ],
  "audited": {
    "<block-or-script>": {
      "ts": "<ISO-8601 ts of last audit pass>",
      "sha": "<full SHA of main HEAD at audit time>",
      "criteria": ["<domain-specific finding-class>", "..."]
    }
  },
  "reviewed_up_to": {
    "<criterion>": "<full SHA of main HEAD at which all commits up-to-and-including have been audited under this criterion>"
  }
}
```

Schema notes:

- **`source_sha`** on every queue item records the commit that
  triggered the finding. For backlog items, set to the main HEAD at
  backlog-pass time.
- **`audited[<block>]`** is an object (not a bare timestamp). The `sha`
  records WHICH main HEAD the audit was against; the `criteria` array
  records WHICH finding-classes (Slot D) were checked.
- **`reviewed_up_to[<criterion>]`** is the per-criterion pointer to the
  most recent main commit at which the watcher has completed a full
  sweep under that criterion. Used by §5l resume to compute the
  unreviewed-commits queue.

The idle backlog sweep (§5) skips blocks whose `audited` entry covers
the current set of criteria AND was taken at a SHA ≥ the most recent
change to the block's source files. Anything else gets re-audited.

## 2. Active watching

### 2a. Watch `origin/main` (Monitor poll)

Arm exactly **one** persistent Monitor per session. Each new commit
line triggers the §4 per-event pipeline. **Emit every commit** — do
not cap with `head -N`, or fast bursts silently drop tail commits.

```
Monitor:
  description: "origin/main new commits — <NAME>"
  persistent: true
  command: |
    last=$(git ls-remote origin main 2>/dev/null | cut -f1)
    while true; do
      cur=$(git ls-remote origin main 2>/dev/null | cut -f1)
      if [ -n "$cur" ] && [ "$cur" != "$last" ]; then
        git fetch origin main 2>/dev/null
        # Use %H (full SHA) so downstream `git diff-tree` / `git show`
        # calls don't risk abbreviation ambiguity in long sessions.
        git log --reverse --format='MAIN %H %s' "$last..$cur"
        last=$cur
      fi
      gh_now=$(date -u +%s)
      if [ -z "$last_pr_check" ] || [ $((gh_now - last_pr_check)) -gt 300 ]; then
        printf 'TICK %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
        last_pr_check=$gh_now
      fi
      sleep 300
    done
```

The `TICK` heartbeat (every 5 min) lets the foreground agent (a)
re-list open PRs and subscribe to any new ones, (b) pull a backlog
item if the queue was idle in the interval.

If the Monitor reports `[Monitor timed out — re-arm if needed]`, apply
**watch.md §5b** timeout-recovery (compare baseline SHA against current
`origin/main`, walk the missed range) before re-arming.

### 2b. Subscribe to PRs

**At setup** subscribe to: (a) own PR (if pushed) and (b) every open PR
updated in the last 7 days.

```python
own = <PR number of HEAD branch>
mcp__github__subscribe_pr_activity(owner=OWNER, repo=REPO, pullNumber=own)

prs = mcp__github__list_pull_requests(
  owner=OWNER, repo=REPO,
  state="open", sort="updated", direction="desc", perPage=40
)
cutoff = now() - 7d
for pr in prs:
  if parse(pr["updated_at"]) >= cutoff and pr["number"] != own:
    mcp__github__subscribe_pr_activity(owner=OWNER, repo=REPO, pullNumber=pr["number"])
```

**Continuously:** at every `TICK` heartbeat, re-list open PRs and
subscribe to any new ones. Subscription is idempotent.

### 2c. Continuous main-following for own PRs (MANDATORY)

Every new commit landing on `origin/main` (detected via the §2a Monitor
poll) **must** trigger an own-PR rebase walk via §5g step 7
**unconditionally** — independent of whether the §3 trigger filter
matches the commit's scope or §4 dispatch runs any specialists. An own PR
left behind `origin/main` reaches reviewers stale and can silently enter
GitHub's "needs rebase" state.

**Fire rule** (every Monitor commit line):

```
on new main commit SHA detected by Monitor:
  1. Refresh local main tracking: git fetch origin main
  2. Walk every own PR (this watcher created in this session)
     per §5g step 7 — worktree rebase + force-with-lease push.
     Witness-drift conflicts auto-resolve via §5f.
  3. THEN (independently) check §3 trigger filter and dispatch
     §4 specialists if in-scope.
```

The walk in step 2 is **idempotent** (a no-op when no own PRs are
behind), so applying it on every commit is cheap.

**Cross-PR rebase caveat (per-session limitation):** the commit-signing
wrapper some repos use emits "missing source" errors when invoked from
a worktree opened by a session that didn't author the commits being
rebased. A watcher session can only auto-rebase PRs it OPENED IN THAT
SAME SESSION — not sibling PRs from other sessions. For sibling PRs,
surface the "behind by N" finding to the user via the §5e idle
author-ask dispatcher instead.

### 2d. Stop conditions

- User says *"stop watching"*, *"unsubscribe"*, or `/unwatch`.
- Branch merged or closed → unsubscribe own PR; keep sibling
  subscriptions if user still wants coordination.
- Session ends.

To stop: call `TaskStop` on the Monitor and
`mcp__github__unsubscribe_pr_activity` on every subscribed PR. Record
the stop event in the ledger.

## 3. Trigger filter — does this event match the domain?

Children fill **Slot B** with the domain-specific filter. The parent
only requires the filter return a boolean `is_in_scope=true|false` and,
if false, that the event be recorded as a one-liner in the ledger and
otherwise skipped.

Common shapes children typically check:

- **File path patterns** in the changed-files list
- **`.ts` block kind** of any touched `content/.../**/*.ts`
- **PR comment body keywords** (for review-comment events)

If `is_in_scope=false`, emit a one-liner to the ledger and return.

### 3a. On-new-commit derivation-completion detection (MANDATORY)

In addition to the domain trigger filter, every watcher must check
whether the incoming commit **closes** a previously-flagged "open" item
in the queue. The check runs **before** the §4 pipeline so the same
event drives both new-violation detection AND queued-item resolution.

```bash
SHA=<incoming commit>
changed=$(git diff-tree --no-commit-id --name-only -r "$SHA")

# Step 1 — look for canonical-form arrivals. Heuristic patterns
# (children override in Slot B-derivation). Content blocks use builder
# calls (`export default theorem({ ... })`), not literal `kind:` fields.
# The formal-layer check fires when an unproved-gap count drops to zero.
new_propositions=$(
  echo "$changed" | while read f; do
    if [[ "$f" =~ ^content/.*\.ts$ ]]; then
      git show "$SHA:$f" 2>/dev/null \
        | grep -qE "export default (theorem|proposition|lemma|corollary)\(" \
        && ! git show "$SHA^:$f" 2>/dev/null \
        | grep -qE "export default (theorem|proposition|lemma|corollary)\(" \
        && echo "$f"
    fi
  done
)
```

A more reliable alternative: load the affected `.ts` modules via the
content pipeline's TypeScript loader and inspect the parsed `kind` field
directly — heuristic grep is a session-local fast-path.

For each newly-arrived derivation, search the queue for items whose
`status` is in `{queued, needs-author}` and which reference the
now-derived label (directly or transitively via `uses[]`). For each
hit:

1. **Audit downstream impact.** If the queued item was flagged "open"
   because it depended on this derivation, the dependency is now
   closed. Re-classify per §4d.
2. **Trigger removal candidacy.** If the queued item was a placeholder
   or probing block waiting for the canonical form, mark `status:
   queued-for-removal` (see §3b below).
3. **Update the ledger** with a `derivation-completion` row citing both
   the new commit SHA and the queue item id.

This keeps the watcher from carrying stale "open problem" framings after the
closure lands.

### 3b. Removal-over-banner policy (MANDATORY for legacy / superseded)

When a canonical derivation lands and supersedes a legacy / deprecated /
probing block, the watcher's correct response is **remove the legacy
block**, not banner-tag it in place. Banner-tagging is reserved for
blocks that **remain on the canonical chain** with an open piece
(acknowledged-stub); legacy blocks that have been superseded should
leave the paper.

Removal decision matrix:

| Legacy-block shape | Action |
|--------------------|--------|
| Block whose `kind: remark` explicitly says "*superseded*" / "*retained for historical context*" / "*legacy*" | **Remove file** + rewire `uses[]` to the superseding block |
| Falsification report consumed by a summary block | **Remove file**; the summary block carries the negative result |
| Probing block / negative-result attempt whose conclusion is "doesn't close" / "incomplete" | **Remove file** unless the methodology is reused elsewhere |
| Acknowledged-stub that is **still on the canonical chain** | **Banner-tag** (do NOT remove); the block is canonical with one open piece |
| Block that consumes an undisclosed input self-acknowledgedly | **Remove the affected section** (not the whole file); keep the canonical form |

When a child watcher detects a queued-for-removal item, it should:

1. Open a follow-up PR with the file deletion (+ `uses[]` rewires in
   chapter manifests and downstream consumers).
2. **Not** silently delete content in the on-going PR — the removal is
   a separate, reviewable change.
3. Cite the superseding block in the removal PR description.

### 3c. On-new-commit skill-availability detection (MANDATORY)

In addition to the domain trigger filter (Slot B) and the §3a
derivation-completion check, every watcher must check whether the
incoming commit (or batch in the unreviewed range) **added a new skill
file** under a `skills/` directory:

```bash
SHA_RANGE="<LAST_REVIEWED>..<NEW_SHA>"
git diff --name-only --diff-filter=A "$SHA_RANGE" \
  -- '*skills/*.md'
```

For each new skill file:

1. **Read the frontmatter** — extract `name`, `roles`, `description`,
   `inherits`.
2. **Decide relevance** to this watcher's domain (Slot A goal). A new
   skill is relevant when its `description` mentions a file kind /
   pattern this watcher audits, OR it is a sibling integration-watcher
   child (`inherits: sdlc-core/integration-watcher`), OR it provides a new
   specialist this watcher could dispatch via Slot C.
3. **Surface to the user via `AskUserQuestion`** with 3 chips: `Adopt
   now` / `Defer to follow-up branch` / `Not relevant`.
4. **Record the decision in the watcher's ledger** under a `### New
   skills` subsection so future sessions don't re-prompt.

This rule applies to skill files only. Skills landing on sibling PRs
that haven't merged yet do NOT trigger this check — only `main` commits
count.

## 4. Per-event QA pipeline

When the trigger filter passes, fan out to the domain specialists **in
parallel**. The parent owns the orchestration; the child provides the
specialist list.

### 4a. Scope reduction

Compute the changed-block set / changed-script set / changed-witness set
from the event SHA:

```bash
SHA=<event sha>

# changed content blocks (label = kebab basename minus -proof suffix)
changed_blocks=$(git diff-tree --no-commit-id --name-only -r "$SHA" \
  | grep -E 'content/.*\.(md|ts)$' \
  | sed -E 's|.*/||; s|\.[^.]+$||; s|-proof$||' \
  | sort -u)

# changed scripts
changed_py=$(git diff-tree --no-commit-id --name-only -r "$SHA" \
  | grep -E '^computations/.*\.py$' | sort -u)

# changed witness JSONs
changed_witnesses=$(git diff-tree --no-commit-id --name-only -r "$SHA" \
  | grep -E '\.witness\.json$|\.derivation\.json$' | sort -u)
```

### 4b. Dispatch (parallel `Agent` calls)

Children fill **Slot C** with a table of `Specialist | When to run |
What it checks`. Launch all applicable specialists in a single response
with multiple `Agent` tool calls (NOT sequentially).

**Sidecar-aware dispatch.** Before dispatching a specialist on a block,
check the block's `.qa.json` sidecar for the relevant criterion:

1. Read `<block>.qa.json` → `criteria[<criterion>]` entries.
2. If an entry exists with `result: "pass"` and its `field_hash`
   matches the current file hash → **skip** (block already audited and
   passes).
3. If the entry is stale (hash mismatch) or `result: "fail"` →
   **re-audit**.
4. If no entry exists → **audit** (first time this criterion has been
   evaluated on this block).

This avoids re-auditing the blocks that already pass on each incoming
commit. Only changed blocks and previously-failing blocks get
dispatched.

**Recording results.** After each specialist completes, update the
sidecar with:
- `result`: pass/warn/fail
- `field_hash`: current file hashes
- `reviewer`: `{ kind: "agent", agent_model: "<model>", agent_date:
  "<ISO>", agent_skill: "<skill>" }`
- `evidence`: hits array (on fail/warn)
- `reviewed_at`: ISO date

Multiple reviewer entries per criterion are allowed. The most recent
entry whose `field_hash` matches current sources is authoritative.

Cap each agent's report at ~400 words.

### 4c. Synthesize findings

Apply these synthesis rules (the same in every domain):

1. **Deduplicate** across specialists.
2. **Cluster** by affected block/script.
3. **Severity rank**: critical / major / minor.
4. **Map to queue items** (one queue item per finding) — finding kind
   comes from the child's **Slot D**.

### 4d. Attempt fixes (collaborator+ only)

Every finding falls into one of three discharge bands. Children fill
**Slot E** with domain-specific examples; the band structure is shared:

| Band | Shape | Action |
|------|-------|--------|
| **Auto-discharge** | Finding has a known mechanical fix (registry migration, tactic application, banner addition, cite move, …) | Apply the mechanical fix; re-run the relevant scanner / validator to confirm; commit |
| **Author-assist** | Finding requires human judgement (semantic, architectural, scope) | Open one author ask per stuck block (see §4e) |
| **Defer** | Finding is acknowledged / opt-out / minor stylistic | Mark `wontfix` in queue with reason |

### 4e. Author asks — one ask per stuck block

When a finding lands in the **Author-assist** band, post one ask either
on the source PR (if the trigger was a PR event) or via
`AskUserQuestion` (if the trigger was a main commit and a foreground
user is present).

**Always lead with full context in chat, then ask a structured
question.** Two-part pattern:

1. **Context preamble (chat text).** Before the `AskUserQuestion` call,
   write a short chat message: the finding (one sentence, with
   severity); the affected file (GitHub blob URL, `.md` preferred per
   [`turn-reporting`](../turn-reporting.md) §"Asking for review means
   linking the artefact"); evidence (verbatim quote
   with line numbers); what was attempted and what failed.
2. **Structured question.** Then call `AskUserQuestion` with a tight
   numbered-choice set (2-4 options), each option mapping directly to a
   queue-action. The question stem must be one sentence; the options
   carry the detail.

Format (children fill Slot F with domain-specific question forms):

```markdown
**<watcher-name> ask — `<block-or-script>`** (from <source-pr-or-commit>)

- Finding: <one sentence, with severity>
- File: <github-blob-url to `.md` (or formal/py file if domain-specific)>
- Evidence: `<file:line>` — `<verbatim quote of offending text>`
- Attempted: <which scanners/specialists/tactics were tried>
- Question: <one yes/no or numbered choice>
```

**One ask per stuck block, batched per round.** If the author hasn't
answered in 24 h (async setting), restate once and move on. Do not
block the queue on a single unanswered ask.

### 4f. Update the queue + ledger

After each event:

```bash
ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
echo "| $ts | <event> | <scope> | <N critical / N major / N minor> | <N auto / N asked / N deferred> |" \
  >> "beans/${NAME}-ledger.md"
```

Update `beans/${NAME}-queue.json` with new items + status changes via
`Edit`.

### 4g. Refresh spawned PRs against main — fallback for §2c

The continuous main-following rule is §2c (mandatory, unconditional on every
main commit, **before** §3 / §4 dispatch). This is the safety net: if §2c
didn't fire (e.g. the Monitor
crashed between detection and rebase walk), the §4 pipeline completion
can also trigger §5g step 7 as a fallback. The rebase runs in a
worktree; witness-drift conflicts auto-resolve via §5f; substantive
conflicts halt the rebase and surface as an author ask per §4e.

