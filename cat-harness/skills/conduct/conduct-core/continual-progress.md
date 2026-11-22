---
name: continual-progress
description: Make in-flight work trackable by others in real time — open a PR from the first commit, push small coherent increments continuously (never hoard uncommitted work), keep a live status checklist in the PR body, and post brief intent on the PR + any overlapping sibling PRs. Use on any multi-step or long-running task, especially when siblings/agents or the author may need to follow, cherry-pick, or take over mid-flight.
user_invocable: true
---

# /continual-progress — trackable, always-PR'd, continually-committed work

Sibling agents and the author can only coordinate with work they can
*see*. This skill makes every in-flight task **trackable in real time**:
the PR is open from the first commit, progress lands as a stream of
small pushed commits, and the PR body carries a live status checklist.
It is the visibility complement to `/coordinate` (opt-in `cat-harness.sdlc`) (which
triages *across* PRs); this one governs how *your own* PR stays legible
while you work.

## The four invariants

1. **Always have an open PR (from commit #1).** Branch, make the first
   (even stub) commit, push, open the PR — *before* further work. The PR
   is the durable, visible artifact; the chat session is ephemeral. Never
   accumulate work on a local branch with no PR. **Never ask permission to
   open one** — branch, commit, push and PR are all pre-authorised.

2. **Commit + push small, coherent increments — continuously.** Each
   logically distinct change is its own commit (a single fix, a single
   module, a single unit of work). Push after each commit (or every 2–3 if
   moving fast). A watcher should be able to `git log` your branch and
   see a legible, bisectable trail — not one giant drop. Target: no more
   than ~20–30 min of work between pushes on a long task.

3. **Keep a live status checklist in the PR body.** Maintain a
   `- [ ] / - [x]` checklist of the task's sub-parts in the PR
   description (or a pinned top comment), updated as each increment
   lands. A sibling or the author should be able to read the PR body and
   know exactly what is **done / in-flight / remaining** — without
   reading the diff or asking in chat.

4. **Post brief intent — on your PR and overlapping siblings.** One short
   intent line on PR-open ("doing X on `<files>`; will touch `<scope>`");
   a one-line comment on any sibling whose scope overlaps ("starting
   `<theme>` on `<files>`; flag conflicts"). Don't *stream* comments —
   update the checklist (invariant 3) for routine progress; comment only
   for genuine coordination (overlap, a blocker, a handoff-relevant
   finding). Defer to `/coordinate` (opt-in `cat-harness.sdlc`) for the full
   cross-PR triage protocol. New work posts its intent only after the
   collision review in `coordinate` §"Starting new work" has been run
   and recorded in the workplan work item.

### Bean edits are pushed to the state branch, not the PR

Work item and workflow-instance edits (`beans/defs/*.md`, `beans/workflows/*.json`) do not belong in the
PR's commit set. The code PR contains code, test, and documentation changes
destined for `main`.

Work-plan progress, work item claims, status updates, and notes are written directly
to the work-plan store through its configured Tool
(`work-plan-store` (opt-in `cat-harness.work-plan`); on a git
state branch, `bun run cat state:push` per
`work-plan-store-git-branch`).

The PR description references the work item via `Closes-bean: <id>` (or in the
status checklist), but commits on the PR branch must not bundle work item file
edits. This avoids merge conflicts on work item files and prevents work-plan edits
from triggering code CI workflows.

## The fifth invariant, and the one agents get wrong

5. **Do not hold a green change proposal back waiting for someone to look at
   it.** This is the rule that gets inverted in the name of care, and inverting
   it is not caution — it is a blocked reviewer.

An agent that has built something it cannot fully verify — a rendered page, a
diagram, a UI — must not leave it open and ask the human to confirm from a
preview first:

> **A human cannot assess a rendered artefact from a description of it, and a
> preview pasted into chat is a strictly worse proxy than the deployed thing.**

Holding the merge does not transfer the verification to them — it *withholds the
only form in which they could do it*, and asks them to adjudicate from a
screenshot.

### Link the PAGE, never the site root

**When you ask somebody to look at a rendered artefact, link the artefact.**
Not the site it is on, not the preview's front door — the exact URL of the
thing you changed.

Linking the root makes the reader reconstruct a route the agent already knew,
and every extra click is a cost passed to a reader who may type with
difficulty. It also hides a real failure: an agent that links the root has not checked that
its page is reachable at all.

So:

- **One link per thing to look at.** Two changed pages is two links, each
  labelled with what to look for on it — not one root and a sentence of
  navigation.
- **Deep-link past the index.** If the change is on
  `/docs/<iris-replica>/kg-to-portal.html`, that is the URL, not `/docs/<iris-replica>/`.
- **Take it from the preview's page list**, never from memory or a source
  path: a branch slug is exactly the kind of string that is almost right. The
  rule, and where the list comes from, is
  [`feedback-deep-links`](../../authoring/content-lifecycle/feedback-deep-links.md).
- **The root is the right link for precisely one thing** — a change to the
  landing page itself.

This is the same rule as the invariant above, one step further on. A human
cannot assess a rendered artefact from a description of it; they also cannot
assess it from a link to somewhere near it.

### What to do with the thing you could not verify

**Say it in the body, and merge anyway.** `## Not verified` is a real section
and an honest one; an unmerged proposal is not a substitute for it.
Reversibility is what makes this safe — a docs or content change is one revert
away, and the cost of reverting is far below the cost of a human blocked on a
decision they have no artefact for.

### A pipe discards the exit code — so a piped run cannot verify anything

**`cmd | tail` makes `$?` the status of `tail`.** Every claim that a command
PASSED must come from a run without a pipe, or from `${PIPESTATUS[0]}`.

This is mechanical rather than a matter of care, because care does not prevent
it. A command whose output *sounds* like a failure, run through a pipe, reads as
a silent pass, and one whose output sounds like a pass hides a failure; a
silent pass is what this repository treats as worse than a loud failure.

**So: when the question is "did this pass", run it bare.** When you want both
the output and the verdict, run it twice or capture the status first. Reading a
verdict off prose you piped is the same error as quoting a count from prose.

### A template is not a page — verify the BUILD, not the source of it

The invariant above says a **human** cannot assess a rendered artefact from a
description of it. This is its twin, and it is the one an agent breaks:

> **An agent cannot assess a rendered artefact from the template that generates
> it.** A correct template and a correct page are different claims, and only the
> second is what a reader loads.

Every source gate can pass over a defect that exists only in the build's
output. For example, a Liquid `-%}` that strips the space between two attributes
makes Kramdown stop treating a block as HTML and escape it into visible text,
while unit tests, lint, type checks, gates, e2e and accessibility suites all
read valid sources and pass.

So the rule is mechanical, not a matter of diligence:

- **When the artefact is a built page, the evidence is the built page.** Build
  the site and read the output. Reading the template proves the template.
- **A screenshot of a scratch render is not a screenshot of the build.** If the
  real build cannot run locally (here the `just-the-docs` remote theme 403s
  through the agent proxy), stub the *theme* and build anyway — a pass-through
  `_layouts/default.html` is enough to see what Kramdown did. Stub the part that
  cannot run; never substitute the part under test.
- **State which one you looked at.** "Rendered and checked" is ambiguous between
  the two, and the ambiguity is where this hid.

`check:escaped-markup`, run in `docs-site.yml` against the assembled `_site/`,
covers the escaped-markup case, because the assembled site is the only place
the answer exists. It does not retire the rule: the next defect of this shape
will be in whatever the build does that no source gate can see.

### The exceptions, and none of them is "I am unsure"

- **Never merge red.** A failing or unrun required check is a real blocker.
- **Never merge over an unresolved review thread** you have not answered.
- **Where the repository requires explicit merge permission, that wins**, and
  nothing here relaxes it by a word. Some folios require an explicit "merge it"
  from the author for *every* merge to the default branch. There the rule reads:
  get it green, get it mergeable, **say once that it is ready**, then stop — do
  not re-ask on a timer, and **do not let "not merged yet" become a reason to
  stop pushing.**

### Green means handed to the Merge Steward — an agent never merges to `main` here

**The merge policy for folio-assistant.** It is the "explicit merge permission"
case above, made into a hand-off rather
than a question:

1. **Never merge to `main` yourself** — not with `gh pr merge`, not with the
   MCP merge tool, not after a green run, not under a standing "merge it"
   from earlier in the session.
2. **When CI is green on EVERY job** (the run list, not the PR page — see
   `prepare-merge` §"NO CHECKS IS NOT GREEN"; on a draft, the fast tier),
   and when the queue allows (§"Pace the ready marking" below): mark the PR
   **Ready for review**, add the label **`ready-to-merge`**, and comment
   **`ready: <head sha>`** — the full sha of the head that went green, so a
   push after it is visibly not what was declared ready.
3. **Ask the merge manager to merge, in six lines** (owner ruling,
   2026-11-07). First check that a merge manager is active and live: the
   latest `merge manager: <session id>` announcement, and that session
   answered within the stall window. Send it the PR URL and full head SHA, your session URL, 1-3
   sentences on what changed, the rendered preview URL for that head (or
   `no preview: <reason>`), what to look for in the preview, and the CI
   verdict on that head. A PR green except for a re-pin is sent as
   `repin+merge:`: do not re-pin it yourself (owner ruling, 2026-11-13). It
   posts them in its chat and asks the owner by card. An approval the owner gives in your own session does not
   authorise a merge. With no live merge manager, follow
   `merge-manager-watcher` (opt-in `cat-harness.sdlc`) §"The sibling's side:
   find the merge manager first": elect one with your siblings, and never
   merge yourself unless you are the one elected. If your
   request is not acknowledged within the stall window, the merge manager
   has stalled: re-elect without it. The format is in §"The merge request:
   six lines" there.
4. **The Merge Steward session ("Separation") merges.** It brings `main` in,
   runs `regen`, re-checks and merges. That is its lane, not yours.
5. **If it reports red, it is yours again**: fix, push, wait for green on
   every job, then re-label and comment `ready: <new head sha>`.

Wherever a merge does happen, it is the
`merge-to-main` (opt-in `cat-harness.sdlc`) sub-process: evidence on the head, the
owner's authorisation for that merge, recorded, then the merge.

So "merge anyway" in §"What to do with the thing you could not verify" reads
here as **mark it ready anyway**, and "merge it as soon as it is green" in the
fix-forward section below reads as **hand it over as soon as it is green**.
The point of both is unchanged: a green PR is not held back.

### Pace the ready marking — the runner pool is shared

The Actions runner pool is shared across the owner's repositories. A draft PR
runs only the fast tier, and marking it ready starts the full tier, about 10
jobs. So the
number of PRs marked ready at once is what fills the queue:

1. **Open every PR as a draft.**
2. **Mark it ready only when its own change is done and its fast checks pass.**
3. **Check the queue first:**
   `gh api "repos/<owner>/<repo>/actions/runs?status=queued" --jq .total_count`.
   If it is more than about 2 queued runs per runner (5 runners on 2026-10-24,
   so more than about 10), hold the marking and check again later.
4. **At most 3 ready, CI-pending PRs per agent per repository.** Hand one over
   or let it finish before you mark another.
5. **A fix that unblocks other work may jump the line**: a link in the repin
   chain, or a fix for a red `main`.

Holding a PR as a draft for pacing is not holding back a green PR: the fast
tier is green, and the hand-off above waits for the full tier.

The merge manager enforces this rule (owner ruling, 2026-11-07, card "Cancel
CI"). When the runners are saturated, it closes superseded PRs, cancels stale
queued runs that never started, and asks the owners of the lowest-priority PRs
to return them to draft: `merge-manager-watcher` (opt-in `cat-harness.sdlc`)
§"Runner relief".

### A new gate is proven downstream before it lands

A PR that adds a gate or `check:*` script to a lower layer passes on its own
main, says how downstream layers run it, and shows a dry run over a fresh
folio-assistant mount. Otherwise the next re-pin inherits the breakage
(`prepare-merge` (opt-in `cat-harness.sdlc`) §"A new gate in a lower layer must
pass downstream").

### One pusher per PR branch

Only the session that owns a PR pushes to its branch (owner ruling,
2026-11-07). Anyone else sends the owner the change, on the PR's thread or
by message. Every push restarts the full CI run: on 2026-11-07, three
sessions pushed to folio-assistant#2985 within 10 minutes, and each push
restarted it.

### Stack instead of waiting

Do not wait for a dependency to merge before starting work that needs it
(owner ruling, 2026-11-07: "they dont need to wait for a merge to start
working on a feature branch needing a dependent feature branch. They can
stack"). The process is the first row of
`merge-request.bpmn` (opt-in `cat-harness.sdlc`).

- **In the same repository:** branch from the dependency PR's branch, and
  open a draft PR whose base is that branch. Pull later changes of the
  dependency in with merge commits. Never rebase or force-push another
  session's branch.
- **Across layers:** develop against the dependency's branch laid over a
  fresh mount. A draft may pin the dependency PR's full head SHA (never a
  branch) so that CI sees it
  ([`remote-mount`](../../kg/kg-core/remote-mount.md)
  §"Stacking across layers").
- **A re-pin is its own PR.** Put the pins, and nothing else, in one PR, and
  stack the work that needs them on it. A fix the re-pin needs lands in
  its owning layer first (owner ruling, 2026-11-07;
  [`remote-mount`](../../kg/kg-core/remote-mount.md)
  §"Re-pinning").
- **Say so:** write `stacked on <repo>#<n>` in the PR body, and list the
  order in the merge request.
- **When the base lands:** retarget the PR onto main and merge main in, then
  mark it ready by the queue rule. Across layers, send `repin+merge:`: the
  merge manager re-pins to the dependency's merge commit on main. Never merge the stacked PR into its base branch,
  and never mark it ready while it pins an unmerged commit.

### Two green PRs can merge into a red main, and the answer is to fix forward

A PR is tested against the main it last merged, not the main it lands on.
Two PRs that are each green can still combine into a failure that neither
branch contained, and no `regen` on either branch can see it.

**The policy is to fix forward, not to add a merge queue or an "up to date"
requirement.** So:

- **Watch main's CI after every merge of yours**, not only your PR's —
  whoever pressed the button.
  "My PR was green" does not mean main is green.
- **A red main whose failure your diff did not cause is still yours to fix
  when you find it.** Establish the cause from the failing run and each
  parent's history first, then regenerate or repair in a small PR of its own,
  and merge it as soon as it is green.
- **Do not blame the last merge because it is the last merge.** Check whether
  the parent was already red.

## Why — the failure modes this prevents

- **Stepped-on work.** A branch that hoards uncommitted work collides
  with siblings the moment it lands. Continual push surfaces intent from
  minute 1 so siblings triage *around* it.
- **Lost work on session reclaim.** Cloud sessions are ephemeral; an
  uncommitted change vanishes when the container is reclaimed. Push it.
- **Opaque progress.** "What's the status?" should be answerable from the
  PR body, not a chat scrollback. The checklist is the source of truth.
- **Un-takeoverable tasks.** If you go idle/blocked, a sibling can pick up
  a continually-committed, checklist-annotated PR; they cannot pick up an
  opaque local branch.

## Checklist (run this as you work)

- [ ] PR open? If not: branch → stub commit → push → open it **now**.
- [ ] Anything uncommitted older than ~20–30 min? Commit + push it.
- [ ] Does the PR-body status checklist reflect the current state?
- [ ] Any sibling whose files I just started touching un-notified? One
      intent line (not a stream).
- [ ] Blocked or going idle? Update the checklist + a one-line
      "blocked on X / handoff-ready" note so a sibling can continue.

## Relationship to other skills

- `pr-description` (opt-in `cat-harness.sdlc`): what the PR body says ABOVE the
  status checklist (the problem, why, approach, constraints, solution, usage,
  what is not done), for a reader who was not here.
- `/coordinate` (opt-in `cat-harness.sdlc`) — cross-PR triage (scope map, sibling
  intent, cherry-picks, ledger). `continual-progress` keeps *your* PR
  legible so `/coordinate` (yours or a sibling's) has something to triage.
- **A folio's own `AGENTS.md`** may carry these rules for that repository, and
  a stricter merge gate — `litlfred/qou` §"Branch + PR workflow" is the worked
  case. This skill is the platform-side statement; where a folio is stricter,
  the folio wins.
- `/todo-manager` — the session work-plan; the
  PR-body status checklist (invariant 3) is its externally-visible
  projection, so a watcher needs no access to the session's work item queue.
