---
name: goal-review
description: >
  Cold start, then review a time window of activity — sibling sessions, the
  work plan, issues, change proposals, branches, CI — and prioritise what it
  finds against goals stated in the owner's words. Inputs are the window, the
  goals, the scope and the axes; the output is a synopsis (closed, open,
  needs doing, with effort), a priority queue per goal with selectable next
  actions, and the instruction gaps met on the way, each recorded as a work
  item. Use when asked "what happened", "what is stalled", "what should we do
  next for X", or at the start of a session that inherits parallel work.
user_invocable: true
allowed-tools: Read Grep Glob Bash Agent AskUserQuestion
---

# Goal review — cold start, sweep a window, prioritise against stated goals

**This is a review, not a plan.** It reads everything and writes only work
items for the gaps it finds. Picking up the queue it produces is
[`pickup`](pickup.md); declaring intent is [`session-intent`](session-intent.md);
this skill sits before both and feeds them.

## Inputs — four, all stated before the first read

| input | what it is | default if the owner gives none |
|---|---|---|
| **window** | the time period to sweep, as a duration or two instants | the last 4 hours |
| **goals** | the outcomes to prioritise against, **in the owner's words** | the store's goal **milestones**, offered in the closing question (§"No goals given"); only if there are none, ask, or review without a queue and say so |
| **scope** | which repositories and stores are in the sweep | the checkout you are in and its forge repository |
| **axes** | which kinds of activity to read | all six below |

Keep the owner's wording for a goal verbatim through the whole report. A goal
paraphrased by the agent is a different goal, and the reader cannot tell
which one the queue was built for.

**No goals given — but the store may already hold them.** With no goals
given, list the open milestones (`beans list -t milestone`), each
title **verbatim**, and offer them as the queue basis in the closing question.
Say which milestones **quote the owner** (their body carries the owner's own
words) and which are a milestone's wording only — a title is the owner's words
only where it says so, and presenting one as such is the paraphrase this
section forbids, one level up.

## Cold start — before any durable read

Run the layer's cold-start line (the top of `AGENTS.md`), so the work-plan
Tool is in hand and primed.

- **The line can be wrong.** If it fails, the
  fallback Tool for the work plan still exists — find it through the tools
  graph, do not stop — and the failure is the first instruction gap to record.
- **Fetch every branch, not just the default.** Most of a window's activity
  is on sibling branches that have not merged.

Then fix the window's two edges as commits on the default branch: the last
commit before the window opened and the head now. Every "before → after"
measurement below is a diff between those two.

## The six axes, and what each one can and cannot tell you

**1. Sibling sessions. ASK THE SESSION API FIRST.** List the sessions; where
it answers, it gives what no inference can — each session's `session_status`,
and a `task_summary` that carries a held question in plain text. **Fall back to
commit trailers when it does not answer, and report "could not determine" when
neither does.** Never present the fallback as the method.

**Reading the listing.** It is ordered by **creation, not activity**, so
in-window sessions are interleaved with ones last active weeks earlier.
**Page until a whole page was created before the window opened, then stop** —
a session cannot be updated before it exists, so no later page can hold an
in-window row. A reader who does not know the order either stops at page 1 or
pages forever. The listing is large (~75 KB per 40 sessions): parse
it, do not read it, and note the JSON sits inside an untrusted wrapper line.
Read `status_bucket` / `session_status` and `task_summary`; a summary on a
session that requires action is a **held question — quote it**, it is the
sweep's most valuable line.

The trailer route, for when it is needed: the durable identity of a session is
the trailer it leaves on its commits. Sweep the window's commits across all
branches for those trailers, group by session, and record for each: commit
count, first and last commit, and the branches whose **tip** it wrote. A
session's state is then read from its branch: an open proposal that is
green, red, conflicted, or one that merged. Say plainly that this is inferred.

**2. Branches.** Refs with commits in the window, each with its count ahead
of the default branch and its tip session. A branch that is ahead by zero
has merged; one ahead by sixty-five is a workstream the default branch
cannot see (axis 4 says why that matters).

**3. Change proposals (pull requests).** Two lists: closed in the window,
with merged distinguished from abandoned; and open, sorted by last update.
For each open one, read the merge state, the CI outcome on the current head,
the last comment, the reviews, and whether the body or last comment carries
a question to the owner — quote the question. "Green" means every check on
the head passed; a head with no checks is not green.

**4. The work plan.** Diff the store between the window's two edges: items
added, and every status transition (`todo → completed`, `in-progress →
completed`, `todo → in-progress`, anything → `scrapped`). Then two
measurements the store's own status field cannot give you:

- **Claims without activity** — items `in-progress` with no change in the
  window. `in-progress` records a claim; it
  does not record that anyone is working (`bean-coordination` (opt-in `cat-harness.work-plan`)
  §"A quiet claim").
- **Items that exist only on a branch.** The store is committed per branch,
  so a long-running proposal can carry an entire epic the default branch has
  never seen. Sweep the open
  branches' stores too, or the review is blind to the largest workstream.

  **Compare against `origin/main`, never a bare `main`** — the local ref is
  whatever this container last checked out, and nothing moves it. A session
  fetches `origin/main` and fast-forwards its own branch; the local `main`
  just sits there, often thousands of commits stale, and a count against it
  can be wrong by two orders of magnitude in the direction that manufactures a
  crisis.

  **And if you cannot confirm the baseline is fresh, report `could not
  determine` rather than a count.** An unverifiable baseline is not a
  measurement — §Rules, rule 1, applied to the ref. Confirming it is cheap:

  ```sh
  # Resolve the default branch, then FALL BACK — `origin/HEAD` is unset in some
  # clones, and without the fallback this exits 128.
  # `session-start-coord-sweep.sh` does the same.
  DB="$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's@^origin/@@')"
  [ -n "$DB" ] || DB=main
  git fetch origin "+refs/heads/$DB:refs/remotes/origin/$DB"
  git rev-list --count "refs/heads/$DB..origin/$DB"   # 0 = the local ref is usable
  ```

  An explicit refspec, not a bare `git fetch origin $DB`: the bare form updates
  `refs/remotes/origin/$DB` only when `remote.origin.fetch` happens to cover it,
  and exits 0 when it does not.

  **Then compare by work item ID, never by file diff against a merge base.** Even
  with a fresh `origin/main`, `git diff --diff-filter=A
  origin/main...origin/<branch> -- beans/defs` diffs against the **merge
  base**, which predates everything main gained since — so the count of
  "added" work items inflates with how far behind the branch is. The check, ids on
  the branch minus ids anywhere on main (archive included):

  ```sh
  ids() { git ls-tree -r --name-only "$1" beans/defs | sed -n 's#.*/folio-assistant-\([a-z0-9]\{4\}\)--.*#\1#p' | sort -u; }
  comm -23 <(ids origin/<branch>) <(ids origin/main)   # beans on the branch and nowhere on main
  ```

  **A large file-diff count from a far-behind branch is the stale-base
  signature, not a hidden epic** — measure by id before reporting either.

**5. Issues.** Updated in the window, and the full open set for
classification. **Measure it; do not expect a size.**

**6. CI on the default branch.** Runs in the window by workflow and outcome.
A red default branch reclassifies every "stalled" proposal, so read this
before judging any of them.

**Compare the tool's span with the window.** `check:ci-health` reads the last
100 runs and says what span they cover ("100 recent run(s) spanning 13.4h"),
which can be shorter than the window. The uncovered part is **could not
determine** (rule 1),
reported as such with its extent. To cover it, page the forge's workflow-run
listing for the default branch by `created` back to the window's start (the
`actions_list` tool, or `GET /repos/{owner}/{repo}/actions/runs?branch=<default>&created=>=<start>`);
`check:ci-health` takes no `--since`.

**Where a check fails, sidecars and generated files are the first suspect**
— for instance a QA sidecar not regenerated after its skill was edited.

## Classify against the goals — judgement, marked as judgement

For each goal, in this order:

1. **Assign** the items from every axis that advance it. Assignment is a
   judgement; say so once, and quote the item's own title so the reader can
   disagree. An item can serve two goals; a goal can have none.
2. **Critical path** — the items in dependency order, from what the goal
   waits on first. Read dependencies from item bodies, not from the
   `blocked_by` field alone: dependencies are often only prose.
3. **Blocked on the owner** — items whose next step is a decision. Quote the
   question verbatim from the item; a paraphrase is a second question.
4. **Done in all but name** — items whose body says everything is finished
   but whose status is not `completed`. Report them; **never resolve a
   sibling's item** (`bean-coordination`). Where
   the body says "not resolving unilaterally, awaiting the owner", that is
   the owner's line to close, and it is the same rule seen from the other
   side.
5. **Effort** — S (under an hour of agent work), M (a session), L (several
   sessions or an epic), with "blocked" as a separate mark, because a
   blocked S is not small.
6. **Contradictions** — two items or rulings that cannot both be followed.
   Name both and stop there; the owner reconciles them.

**Goals that are not in the store are a gap.** If the owner's goals exist
nowhere as objects — no milestone, no epic carrying the goal's words — every
future review re-does this classification from scratch. Record that as a
work item and offer the fix as an option; do not create the objects
unasked.

## Output — three parts, in this order

**1. Synopsis of the window.** Counts first, each with how it was measured:
proposals merged and abandoned, still open by state (green, red, conflicted,
stale); work-plan transitions by kind; items added; claims without activity;
issues touched; CI outcome on the default branch; sessions seen and how. A
count in prose without its measurement is a claim
([`turn-reporting`](turn-reporting.md)); a table is the right shape.

**2. A priority queue per goal**, ordered by the critical path. One line per
item: id, what it is in six words, effort, what it waits on. Split into
*do now* (nothing waits on the owner), *owner decides* (with the question),
and *close or scrap* (done in all but name, superseded, expired notices).

**3. The instruction gaps**, each as a work item. A gap is anything the
instructions said that the sweep could not do as written, said two ways, or
did not say at all. Create the item with the measurement in its body and
the rule it concerns named; parent it to the process epic. Do not create one per stale item — that is a
queue entry, not a gap.

**Then one question, selectable.** The queue will surface several owner
decisions. Ask **one** in full — context, options, recommendation first and
marked, a stated default — and give a **count** of the rest
([`interaction-modality`](../../../skills/conduct/conduct-core/interaction-modality.md) §4.1). A reader on a
low-dexterity profile (`interaction/`) answers by choosing a number.

## Rules

1. **Could not determine is never rendered as clean.** Sessions the API
   cannot see, a store on a branch you did not fetch, a check that did not
   run — each is reported as unknown, and unknown outranks "nothing found".
2. **Measure at the window's edges, not from prose.** A body that says
   "nothing remains" is evidence; the status field is a claim; a count you
   remember from an earlier turn is neither.

   **But a COMMITTED CHECK'S OUTPUT is not prose, and re-deriving it is
   strictly worse than quoting it.** A check's finding was produced by code
   with a test behind it; your inline version of the same question has
   neither. So **quote the finding and name the check that produced it** —
   `bun run cat health`, `check:anchor-names`, whatever it was — and re-derive
   only what no committed check answers. A re-derivation that finds MORE items
   than the instrument hands the owner a larger permission than any instrument
   justified, and `deletion-requires-confirmation` assumes the list put to a
   person is true. Where the rule exists as code (`stagingSlug` in
   `schemas/sdlc/staging.ts`, for a staging slug), import it.

   **Not the same as "read the published survey" below.** That is about a
   SIBLING'S sweep and the reason is duplicated effort. This is about an
   instrument's computed finding and the reason is correctness — a wrong number
   reaching a person who acts on it.
3. **Read the owner's rulings out of the items and carry them forward.**
   An item can be blocked only in name — the ruling already in a sibling's
   body. Quote it and move the item to *do now*.
4. **A window boundary is an artefact.** A bulk edit just before the window
   makes everything look untouched; a bulk edit inside it makes everything
   look active. Say when a count is dominated by one commit.
5. **Generated files inflate every count.** Diff stats, files changed and
   commits touched all double where sidecars, exports or rendered diagrams
   regenerate; count the authored change and say the rest is generated.
6. **The report is not durable; the gaps are.** The synopsis lives in the
   turn and, if it must outlive the session, on the issue that asked for it.
   The work items are what the next agent inherits.
7. **Do not pivot into the queue.** The owner asked what to do next, not for
   it to be done; the first queue item is the next question, and picking it
   up is a separate, declared intent.

## What falsifies a review

- A proposal the review called green that a reviewer finds red on the same
  head: the CI read was of the wrong commit.
- An item the review placed on a goal's critical path that the owner says
  serves a different goal: the assignment was a paraphrase.
- A "stalled" session that was in fact mid-turn: the inference from its
  branch was stated as fact. Re-read axis 1; the word is *inferred*.

## Read the published survey before deriving one

**`bun run cat survey:owed` first**, so that parallel sessions do not each
re-derive the same sweep.

The command answers in four states, and each says what you owe:

| it says | you do |
|---|---|
| **none published** | the whole window is yours. A determined empty, not an error. |
| **covered** | read the survey; do not re-derive it. |
| **a delta** | survey only `to..origin/main` — normally a handful of commits. |
| **unusable** | a published survey's upper edge is unreachable here (rewritten history, another branch). Survey the whole window. |

When you finish a sweep, publish it:

```sh
bun run cat survey:publish --from <sha> --by <session> --axis beans="…" --axis ci="!not looked at, and why"
```

An axis written `name=!reason` records one you did **not** cover. That is a
first-class answer: a survey of four of six axes is useful, and a reader must
be able to tell which two it says nothing about; recording only what you did
lets a partial survey read as a complete one.

**The window's two edge commits are recorded**, so staleness is decidable
rather than guessed. An unreachable upper edge is reported as unusable and
never as covered, because siblings trust a covered survey *instead of*
looking.

This does not claim the window and does not divide the axes between sessions.
It is an artefact: one session writes what
it found, and a later one decides for itself whether that still covers its
question.

## Tools this skill reaches for

Reached through the tools graph the layer declares, never by a remembered
path: the work-plan CLI and its manual fallback; the forge API for proposals,
issues and CI runs; version-control history for trailers, branch tips and the
window's edges; and the session API where it can see siblings. Where one is
absent, the axis it serves is reported as *could not determine*.
