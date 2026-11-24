---
name: merge-manager-watcher
description: >
  The merge manager agent's watch loop: what wakes it, how often it looks,
  how it tells whether it is the active merge manager, what it reads each
  time, which process each reading sends it to (merge train, saturation
  meta-merge, stalled-agent takeover), and how it keeps the swarm in step
  with hold and done broadcasts. Use for "be the merge manager", "watch the
  queue", "who merges", "the queue is stuck", and when starting or handing
  over the merge-steward lane.
user_invocable: true
---

# Merge manager watcher — the loop that runs the merge-steward role

The merge manager is the agent that holds the
[`merge-steward`](../../../scenarios/roles.json) role on one or more
repositories (actor
[`merge-manager`](../../../scenarios/actors/merge-manager.json)). The role
says what the steward may decide. The skills say how: what lands next
([`merge-queue`](merge-queue.md)), how it lands
([`merge-to-main`](merge-to-main.md)), conflicts
([`merge-conflict-patterns`](merge-conflict-patterns.md)), shared branches
([`ref-stewardship`](ref-stewardship.md)), and full runners
([`saturation-meta-merge`](saturation-meta-merge.md)). This page covers the
loop that runs them: when to look, what to read, and where each reading leads.
The process is
[`sdlc/processes/merge-manager-watch.bpmn`](../../processes/merge-manager-watch.bpmn).
It is one of two processes (owner ruling, 2026-11-07), split by phase so each
fits a page:

- [`merge-request.bpmn`](../../processes/merge-request.bpmn), the **sibling
  session**'s side: find or elect the merge manager, send it the request,
  and handle a merge manager that stalls;
- `merge-manager-watch.bpmn`, the **merge steward**'s loop on this page,
  with the **owner** lane below it for the batch card. The owner lane sits
  next to the only lane it talks to.

## Only the merge manager merges and re-pins (STRICT)

Owner rulings, 2026-11-13: "they should not merge and only send to you to
merge. I have not been initiating any merges"; "send to merge manager to
handle merge and repin"; "send to you as merge manager to handle merge AND
repin so you can handle trains and CI".

1. **Only the merge manager merges.** No other session merges, enables
   auto-merge, pushes to `main`, or posts a `ready: <sha>` comment on
   another session's PR. This holds in every repository. For a PR in a
   repository the merge manager cannot reach, the merge manager asks the
   owner by card; the PR's session still does not merge it.
2. **Sessions do not re-pin just in time.** A PR that is green except for a
   re-pin, or for being behind its pins, goes to the merge manager as
   `repin+merge: <owner/repo>#<n> <sha>`, followed by the six lines
   (§"The merge request: six lines"). The merge manager makes the re-pin
   (its own PR, `remote-mount` §"Re-pinning"), sequences re-pin trains and
   CI, then merges.
3. **A scheduled routine never merges.** A routine or check-in that finds a
   green PR reports a `ready:` line to the merge manager, and does nothing
   else.
4. **Standing re-pins and site repositories are the merge manager's**
   (owner cards, 2026-11-13: "C. No auto-merge", replacing "A. MM
   dispatches, auto-merge OK", and "A. Give MM access"). A standing re-pin
   run opens or updates its PR, labels it `needs-repin`, and never merges
   itself: the merge manager judges it once CI is green and merges it. The
   merge manager attaches each site repository and runs its re-pin: it
   dispatches the run, approves the held bot runs, and merges when green
   ([`remote-mount`](../../../skills/kg/kg-core/remote-mount.md)
   §"Standing consent").
5. **Held runs are approved by the merge manager.** A re-pin commit pushed
   by a bot gets runs held at `action_required`, and the merge manager
   approves them before judging the PR. A held run executed nothing, so it
   is neither red nor green.
6. **`merge-guard` becomes a required check** (owner card, 2026-11-13,
   "A. merge-guard required status"). Once the tools layer's workflow
   posts the `merge-guard` commit status (full tier, plus ready), the merge
   manager makes it a required status check on `main` in the layer
   repositories, through branch protection. Until then, `merge-queue`
   §"A PR lands only through `merge:guard`" holds as written.
7. **A red index main pauses the re-pin train** (owner card, 2026-11-13,
   "A. #3119, fix main, pause"). While the index repository's main is red,
   the merge manager disables the re-pin train workflow, so no re-pin lands
   on a red base. It re-enables the workflow once main is green, and says
   so to the siblings and the owner both times.
8. **A one-time consent is quoted where it acts.** The owner's card, with
   its date, goes in the re-pin PR's body and in `trust.consent`'s evidence
   in `index.config.json` (`remote-mount` §"Trust").

## The sibling's side: find the merge manager first

A coding agent whose PR is ready to merge does not know whether a merge
manager exists. It checks, in this order:

1. **Is a merge manager active?** Read the latest `merge manager: <session
   id>` announcement in the coordination group, then check that session is
   live: active, and it answered within the stall window (§"Liveness and
   stalls"). If so, send it the six-line merge request (below) and wait for
   its acknowledgement.
2. **If none is active, elect one with the siblings** by the fixed rule
   (§"Am I the active merge manager?"). A lone session is elected alone.
   The winner announces itself and takes the merge steward lane. Every
   other sibling notes the holder and sends it the request. Nobody merges
   while no merge manager holds the lane.

**An agent with no chat to the merge manager** (a local agent such as
agy, a GitHub Actions job, a scheduled routine, or any tool that only
reaches GitHub) signals on its own PR with a label, because the PR is the
message ([`merge-queue`](merge-queue.md) §"The PR is the message"; owner,
2026-11-13: "need a way to mark this for agents not able to
communicate... label PR?"). It marks the PR ready for review and adds one
of two labels:

- `ready-to-merge`: green; the merge manager merges it.
- `needs-repin`: green except for a re-pin, or for being behind its pins;
  the merge manager re-pins, then merges. This is the label form of
  `repin+merge:`.

A label is a request, never a merge: only the merge manager acts on
either label (§"Only the merge manager merges and re-pins"). The agent
puts the six lines in the PR body or a comment, and still asks the owner
first (§"Ask the user before submitting" in `merge-queue`). Every sweep
reads the open PRs carrying either label in the repositories the merge
manager watches, and treats each as a request. One with no preview, or no
six lines, goes back with a comment saying what is missing. Until the
tools layer's `merge:guard` accepts the label in place of a signed
`ready: <full head sha>` comment (§"What this does not do yet"), the agent
also posts that comment on its own PR.

**Where the announcement lives, so all can use it.** The holder sends
`merge manager: <session id>` to every sibling and the owner, and notes it
durably on the coordination work item. A sibling started later reads the
note, not anybody's memory. A hand-over updates the note.

## When is a merge manager needed?

This measure was first the condition for holding the lane at all (owner
ruling, 2026-11-07: "merge manager needed if lots of conflicting CI runners
causing merge slowdown"). Since 2026-11-13 it measures contention only (see
below). The queue is contended while both of these hold:

1. **Two or more active sessions have ready PRs in the same repositories.**
2. **The merges are slowing each other down**, which shows as either of:
   - the runners are contended: more than about 10 queued runs on a
     repository (the pacing threshold in
     [`continual-progress`](../../../skills/conduct/conduct-core/continual-progress.md) §"Pace the ready
     marking"), or the oldest queued run is more than about 30 minutes old;
   - PRs keep conflicting with or superseding each other: duplicate re-pins,
     or rebases that invalidate each other's CI.

**The lane does not lapse** (owner ruling, 2026-11-13, which supersedes the
lapse of 2026-11-07). A quiet queue does not hand merging back to each
session: a merge manager always holds the lane, and only it merges. The
measured condition above now says when the queue is contended. The merge
manager then batches through trains and enforces runner relief, rather
than landing each PR as it comes.

## Am I the active merge manager?

Exactly one live session holds the lane on each repository. It holds the lane when the owner gave it the lane, when it was
elected (below), or when it took the lane over from a stalled holder
([`stalled-agent-triage`](stalled-agent-triage.md)) and told the owner. On
taking the lane, it announces `merge manager: <session id>` to every sibling
and to the owner, so that every sibling knows where to send PRs. On handing
it over, it says to whom. A memory that one existed yesterday does not count,
either way.

**A lone session is its own merge manager** (owner ruling, 2026-11-07: "if
single, can merge manage self"). When a session is the only active one in
its coordination group, it queues its own PRs and asks the owner directly,
with the same six-line merge request and the same card per batch. It needs
no election and no hand-off. As soon as a second sibling becomes active,
the election rule applies.

**With no merge manager, the siblings elect one** (owner ruling, 2026-11-07:
"if no merge manager, siblings self-determine which will play that role").
No merge manager is active when none has announced itself, or when the last
one has gone inactive. The owner does not have to appoint one. The rule is
deterministic, so two sessions cannot both claim the lane:

1. The active session that owns the P0 PR (the fix for a red main, or the
   re-pin chain) takes the lane.
2. With no P0 PR, the earliest-created active session in the coordination
   group takes it (the `created_at` of `list_sessions`).
3. With two P0 owners, the earlier-created of the two takes it.

The elected session announces itself as above, and hands over explicitly
when it stops. On 2026-11-07 the previous merge manager, merge-planning, went
inactive without a hand-off, and the owner had to appoint one.

### Liveness and stalls

The merge manager, like any agent, may stall (owner ruling, 2026-11-07). So
it has a liveness duty: it acknowledges each merge request within about 10
minutes of receiving it (the role's `holding.heartbeatMinutes`; a request
wakes it), and posts a heartbeat to the coordination group with each sweep.

A sibling treats the lane as vacant when its request has no acknowledgement
within about 30 minutes (`holding.stalledAfterMinutes`), or when the merge
manager's session is inactive. It then runs
[`stalled-agent-triage`](stalled-agent-triage.md): it tells the owner, and
re-elects without the stalled session. The new holder announces itself,
takes over the queue, and tells the owner. A stalled coding agent's PR is
handled the same way, from the other side: the merge manager runs
`stalled-agent-triage` on it (§"Where each reading leads").

**Siblings send merge requests here, and the owner approves here** (owner
ruling, 2026-11-07, card "Approvals", B: "all siblings should communicate
merge requests to you. i will approve here. you queue/prioritize", and "all
my approval is here, not in siblings"):

- There is one merge manager session.
- A sibling never merges its own PR. When the PR is ready, the sibling sends
  the merge manager a merge request in the six-line format below.
- The owner approves in the merge manager's session, with one card per batch
  that names each PR. An approval the owner gives in a sibling's session does
  not authorise a merge.
- A pre-approved PR, one the owner said to "merge when green", needs no
  second card.
- The merge manager queues the PRs in priority order:
  - **P0**: fixes for a red main, and the links of the re-pin chain;
  - **P1**: work those unblock;
  - **P2**: CI speed;
  - **P3**: everything else.

### The merge request: six lines

Owner ruling, 2026-11-07: "anything that indicated to merge should have link
to PR, claude session, explanation of changes, preview URL", and "put that in
chat then ask to merge by card". A sibling's `ready:` message carries:

1. the PR URL and the full 40-hex head SHA;
2. the claude.ai session URL;
3. an explanation of the changes, in 1-3 sentences;
4. the rendered preview URL for that head (feature-staging's `branches/`
   preview, or the layer's equivalent), confirmed rendered, or
   `no preview: <reason>`;
5. what to look for in the preview;
6. the CI verdict on that head (owner ruling, 2026-11-13): `full tier green
   as judged` (rule 1 below). For a pin-only PR in a layer
   repository, line 6 reads `pin-only: layer CI judges nothing (it mounts the
   root's lock)`, because its "No new failures" job runs no tests or gates and
   passes without judging anything. The evidence for those pins is the root's
   own re-pin PR, not the layer's green check.

A PR that is green except for a re-pin is requested as `repin+merge:
<owner/repo>#<n> <sha>` with the same six lines; line 6 then names what
the re-pin must move. The merge manager re-pins it (§"Only the merge
manager merges and re-pins").

The merge manager posts all six lines in its chat, then asks the owner by
card. A request with no rendered preview and no reason goes back to the
sibling.

## What wakes it

- **A timer, at the sweep's cadence** (§"The sweep"): every 10-15 minutes
  while a P0 is in flight, every 30 minutes otherwise. This is a backstop,
  not the main signal.
- **A PR event** on a subscribed PR: ready for review, CI finished, review
  submitted, merged or closed. Subscribe to every open non-draft PR in the
  repositories it holds.
- **A main run finishing**, green or red.
- **A sibling's message**, for example "ready", "hold", or "done".

Never poll in a loop inside a turn. End the turn and let the next event wake
it.

## What it reads each time (live, never stored)

1. The open PRs: draft or ready, head SHA, mergeable state, owed checks, and
   whether any open decision is waiting on the owner.
2. The runner queue on each repository: queued and in-progress runs, and the
   age of the oldest queued run.
3. The latest main push run on each repository, and its verdict.
4. The owners of the PRs: the last push or comment by each owning session.
5. Every harness repository's open `main-red` issue and its newest failed
   runs on `main` and `gh-pages` (§"Red mains and failing runs").

## Red mains and failing runs: dispatch a fixer

Owner, 2026-11-10: *"That should be a part of merge manager (dispatch an
agent to fix them)"*, *"Add to process"*. A red main mails the owner on
every push to it, so watching every harness repository's main is part of
the lane, not something a sibling notices by chance.

**What it watches.** Every repository that runs the layer checks (the
harness layers and the layers above them, and the index), whether or not
the lane holds a PR there:

- the open `main-red` issue (kept by `layer-main-qa.yml`): its failing gates,
  tests and jobs;
- the newest failed run on `main`, and on `gh-pages` for Pages deploys.

**Sort each failure into one cause before dispatching**, because the fix
lands in a different place for each:

| Cause | How to tell | Where the fix goes |
|---|---|---|
| Pins out of step | The failure names a file or test of ANOTHER layer, and that layer's own `main` already differs (a test reads a page the newer layer removed; a heading or type the newer tools already have) | The next re-pin train on the index. A train that fails only on infrastructure gets its failed job re-run once |
| The layer's own bug | The failure names this layer's own file, and it fails at this layer's own `main` | A fix PR in that layer, opened as a draft by the dispatched agent |
| A lower layer's bug | The failure names a lower layer's file, and it fails at that layer's `main` too | A fix PR in the lower layer, then a re-pin |
| Infrastructure | "The runner has received a shutdown signal", a Pages deploy stuck at `syncing_files` until it times out | Re-run once. A second failure is real: a Pages timeout goes to the site-size work |

**Re-run policy (owner, card Q-RERUN-1 B, 2026-11-12).** Every run of a
PR emails the owner when it fails, and on 11-11 more than half of the
failure emails came from re-runs. So a "re-run once" in the table above is
bounded by these rules:
- Re-run a PR's CI only when that PR is about to merge, which means it is
  approved (or non-content inside a merge window) and nothing else blocks it.
- Never re-run held content or committee PRs (smart-ra `CS-` items, `dth-*`
  content, anything without an owner approval).
- After a GitHub outage, wait until GitHub status reports healthy before
  re-running anything. Never re-run PRs in a batch.
- Before re-running a re-pin PR, first refresh its pins to the current mains,
  so the lock-coherence gate does not fail again.
- An update-branch also starts a run, so it follows the same rules.

**Dispatch.** One fixer agent per cause, never one per repository: a single
lower-layer bug can redden every layer above it. Give it the failing run,
the cause row above and the repository, and have it open a draft fix PR,
linked from the `main-red` issue. The fix is a P0 (§"Liveness and
stalls"). Track it like any other PR in the lane, and close the loop when the
next main run is green and the `main-red` issue closes.

**What it never does.** It does not silence the failure: the report job
stays red while main is red (owner, 2026-11-10, card "Merge #1812?", B
"Don't merge"). It does not skip, disable or quarantine a gate or a test.

## The sweep

Owner ruling, 2026-11-07 (card, about 07:55Z): the merge manager's sweep is
documented and tooled.

**Cadence.** Every 10-15 minutes while a P0 PR (a fix for a red main, or a
link of the re-pin chain) is in flight; every 30 minutes otherwise. A PR
event, a merge request or a main run finishing may start a sweep early.

**One sweep**, in this order:

1. Run `merge:watch` over every repository the lane holds. It makes the four
   readings above, and judges each PR by every judge (rule 1 below):

   ```
   bun run cat merge:watch -- --config merge-watch.json --json
   ```

   Name the repositories with `--repo <owner/name>` (repeatable), `--repos
   a,b,c`, or `--config <file.json>` (`{"repos": [...], "staleHours": 2}`).
   `--stale-hours <n>` sets when a silent PR owner is flagged (default 2).
   The layers whose re-pins need the owner's consent default to `smart-*`
   (the WHO SMART upstream layers; an entry ending in `*` matches a
   prefix). `--exclude-layer <name>` (repeatable) or a config's
   `excludedLayers` replaces the default.
   Per repository it prints:
   - each PR's verdict, with a route flag: workflow changes go to a direct
     merge, a folio-assistant PR to the merge train, a pin on an excluded
     layer needs the owner's consent, and `superseded-by #N` marks a
     duplicate;
   - the runner queue: queued and in-progress runs, the oldest queued run's
     age, by event;
   - main's latest push verdict;
   - each PR owner's last push or comment, with stale owners flagged;
   - runner-relief candidates (§"Runner relief"). It only reports them,
     and never lists a main push run that has started.

   Its verdict is rule 1: every "No new failures" judge passes, each
   shard's Q-PIPE-1 table lists 0 new failures, and any run queued or in
   progress on the head blocks.
2. Check each green request with `bun run cat merge:request:check -- <file|->`
   (`--json` for machine output; exit 0 accepted, 1 refused, 2 could not
   determine). It parses the six lines, and checks that the SHA is the PR's
   current head and that the preview was built for that head. Send a
   refused request back with the reason. Post each accepted request's six
   lines in this chat.
3. Ask the owner with **one** batch card for all of them, in priority order.
   Leave off any PR in the pre-approval ledger (below).
4. Land what is approved. A workflow PR, or a PR in a repository with no
   train, merges through `merge:guard`. A folio-assistant PR that does not
   change `.github/workflows/` gets the `merge-train` label (rule 8 below).
5. Send `landed: <repo>#<n> <sha>` to each session that was waiting, or
   `back: <repo>#<n> <reason>` for a PR that cannot land.
6. Post the heartbeat, and re-arm the timer at the cadence above.

**A helper may tabulate, never write.** A helper agent may run step 1 and
tabulate the result (rule 6 below). It never posts, labels, merges,
comments, closes or pushes. Steps 2-6 are the merge manager's.

**The pre-approval ledger.** When the owner says "merge when green" for a
named PR, the merge manager records it: the PR, the owner's words, and when.
It keeps the record on the coordination work item, beside the
`merge manager:` note, so a successor inherits it. A PR in the ledger needs
no second card. It lands at the first sweep that finds it green, and then
leaves the ledger. The ledger covers only the PRs it names. A standing
instruction to "merge everything green" is rule 2's standing OK, not a
ledger entry.

## Where each reading leads

| Reading | Process |
|---|---|
| A merge request for a PR that is all green (rule 1 below) but not yet approved | Post its six lines in chat, then put it on the owner's next batch card (§"The merge request: six lines"). A request with no rendered preview and no reason goes back |
| A `repin+merge:` request | Make the re-pin as its own PR, in a re-pin train with any others due, then land the requested PR on top of it (§"Only the merge manager merges and re-pins") |
| An approved, all-green folio-assistant PR with no `.github/workflows/` change | `merge-train` (Process_MergeTrain): add the `merge-train` label instead of merging it (rule 8 below) |
| An approved, all-green PR that changes `.github/workflows/`, or is in a repository with no train | Merge it directly through `merge:guard`. A workflow PR needs no approval beyond the batch card (owner ruling, 2026-11-07, card "Workflow PRs", A) |
| Queued runs 60+ minutes old with nothing landed, or the owner says runners are full | First relieve the runners (§"Runner relief"). Then `saturation-meta-merge`: offer the card, never run without the owner's tap |
| A PR whose owner has not pushed or answered for 2+ hours | `stalled-agent-triage`: tell the owner and take it over |
| main red, in any harness repository | §"Red mains and failing runs": sort the cause, dispatch a fixer. The fix goes to main as its own PR first; when a dispatched `post-merge-regen` verify run says main is stale, a regen dispatched for the next PR commits the fix and that PR lands with priority (`merge-queue` §"Merge steward procedure: post-merge verification"). Trains wait for main to be green  If it is the index repository's main, disable the re-pin train until it is green (rule 7 of §"Only the merge manager merges and re-pins") |
| Nothing to do | End the turn with no message |

## Merging across dependent repositories (STRICT)

Owner rulings, 2026-11-15 ("prioritize in order of layer dependency";
"update merge manager skills with these (say more generally in terms of
dependencies in software PRs)"; "and with all the improvements we made in
this thread to process"). The rules are written for any project; names in
them are examples only. They hold for any set of repositories where
one consumes another, by package, by pin or by submodule. "Lower" means
depended on; "dependent" means it consumes a lower repository.

1. **Dependency order.** Merge PRs and fix red mains in the lowest repository
   first. Move up to a dependent only when every repository below it has a
   green main and none of its ready PRs is left unmerged. Within one
   repository, finish its ready PRs and fix its red main before leaving it.
   One exception: a pin update (re-pin) that carries a lower repository's fix
   may land as soon as that fix is on the lower repository's main.
2. **CI queue in dependency order.** When runners are scarce, cancel runs that
   are *queued* (never running) for dependent repositories, and re-queue
   them lowest dependency first, feeding each level as runners free up.
   Never cancel an integration run on main or a re-pin run that has started.
3. **Batching.** Combine a repository's ready non-content PRs into one CI run
   (a batch or train), merge the batch on the fast checks, and run the full
   checks on main after it lands. Fix any red on main at once, as a P0. When
   a batch goes red, split it to find the member at fault, and land the rest.
   **CI backlog playbook** (owner, 2026-11-15: "if we get a backlog of CI,
   then stack PRs and merge together/fix fallout"). Rule 3 is the normal
   mode; this is what it becomes when CI cannot keep up.
   - *Switch in* when, in one repository, the oldest queued run is 60+
     minutes old and nothing has landed in that time (the "Saturated" route),
     or three or more ready PRs are each waiting on their own CI run.
   - *Do:* stop running CI per PR. Stack the waiting ready non-content PRs
     of that repository onto one branch, one merge each, run CI once on the
     stack, and merge them together when it passes the fast checks. Then
     watch main's full run and fix any red on main at once (rule 3), splitting
     out the member at fault if it cannot be fixed quickly. Cancel the now
     redundant queued per-PR runs (queued only, rule 2). Re-pins and
     integration PRs are not stacked with ordinary PRs: they still need full
     green (rule 9), and content PRs are never stacked (rule 5).
   - *Switch back* when that repository's oldest queued run is under 15
     minutes old and its main is green: return to one batch per sweep.
   - Say in the status report (rule 10) which repositories are in backlog
     mode, and since when.
4. **Stable point.** The work is stable when all of these hold, each one
   checkable: every repository's main is green on its latest run of each push
   workflow; every integration and re-pin has landed, so each dependent pins
   the current main of everything below it and is green on that pin; no
   ready non-content PR is left unmerged; and every published site is at or
   after its main's last publish-relevant commit. Report progress per
   repository in dependency order, with counts of open, CI running, ready,
   red and conflicting PRs, and main's state. Leave content PRs out of the
   report (they are listed, not counted).
5. **Content PRs** ([`prepare-merge`](prepare-merge.md) §"Content PRs"):
   labelled `content`, never in the queue or the report. They stay drafts
   until the owner asks to review them. A functional change inside one
   (code, configuration, pins, schema, CI, tooling) is split out into its
   own non-content PR and goes through the normal batch. A content PR is
   brought up to its base's current main only once every repository it
   depends on is stable (rule 4), so it is merged once, not chased.
6. **Reviving stale drafts.** A draft picked up again is brought in line
   with current decisions and infrastructure: current main merged in,
   current pins, current rules, current shared tools in place of older local
   copies, and anything superseded since it was written dropped. Where it
   clashes with a later decision, flag it to the owner (a card) instead of
   pushing the old approach.
7. **Never commit to a shared state branch from a sparse or partial
   checkout.** A commit records the whole tree, so files missing from a
   sparse checkout are recorded as deleted. On 2026-11-15 one such commit
   wiped the work-item branch. Use a full checkout (a worktree of the branch, or
   a full clone at depth 1) for any write to a state branch. A state branch
   is checked out the same way every time, so a write never depends on how
   the last session happened to clone it.
8. **One merge manager.** Exactly one session merges and re-pins. Every
   other session hands its PR to it (§"Only the merge manager merges and
   re-pins") and never merges, even its own PR.
9. **Re-pins and integration PRs merge only on full green**: the full tier
   on the head, never a fast-tier pass. Small, verified fixes in one
   repository may stack (land one after another without waiting for main's
   full run between them); the merge manager then fixes any fallout on main
   at once (rule 3).
10. **Status reports at a fixed interval.** One report per interval, per
    repository in dependency order, with total, left and in-progress counts,
    what is running, blockers, and progress towards the stable point
    (rule 4). Link the thread or session that owns each item. While the
    owner is away, hold the reports and send one catch-up when they return.
11. **A draft register.** Keep one file (for example `drafts.md`) listing
    every open draft PR with its owner and either "being worked on" or "not
    worked on: <why>". Act on every stale draft: revive it (rule 6), close
    it as superseded, or ask the owner.
12. **No idle agents.** An agent with nothing in flight either resumes its
    own to-dos or stands down and says so. Nobody sits idle holding open
    questions; a question goes to the owner (rule 13) and the agent carries
    on with what does not depend on it.
13. **Owner questions on tappable cards.** Write the question out in full
    first, with every option, its trade-off and a recommendation, then post
    one card with the same options. One card per question, and one session
    asks it: before posting, check that no other session has the same
    question open.
14. **Approvals are recorded durably.** An owner approval is written where
    the next agent will find it: the PR's own record (for content, its
    `## Content review` section) or the standing-rules record, citing the
    card or message. An approval given before a later hold rule still
    stands for the PRs it named.
15. **Ignored repositories.** A repository the owner says to ignore is left
    out of the work and out of every report until the owner says otherwise.
16. **A lower repository never waits on a higher one** ([`merge-queue`](merge-queue.md)
    §"A lower repository never waits on a higher one" has the CI side) (owner, 2026-11-15:
    "why are the 2 not merged? they are lowest"). A PR in a lower repository
    is never blocked on a dependent's lock or pins. When its only red is a
    gate that also fails on its own main because CI mounted a dependent's
    older pins of it (for example, a generated-file check run with the tools
    version pinned in a downstream index), that red is not the PR's, and the
    PR merges. The lasting fix is for each repository's CI to test against
    its own dependencies, never a dependent's pins.
17. **Ready and green merges at once, lowest first** ("ready to merge" is
    defined in [`merge-queue`](merge-queue.md) §"What 'ready to merge'
    means"). A ready PR that is
    green on the fast checks, or red only on reds that also fail on main and
    that it does not cause, merges in the same sweep, in dependency order.
    It does not wait for the next batch.
18. **Every red PR has an active fixer.** A red PR is never left waiting on
    something else. In the same sweep the merge manager names the thread or
    session that owns the fix, or dispatches a fix agent, and the draft
    register (rule 11) and the status report (rule 10) show who is fixing
    it.
19. **Stall watchdog** (owner, 2026-11-15: "things were just sitting
    there"). If the stable-point report (rule 4) has not moved for 10
    minutes (no merge, no main turning green, no red count falling), the
    merge manager acts on the lowest stuck repository, or posts one line
    saying what blocks it and who is fixing it.

## Merge-sweep rules (STRICT)

1. **"All green" is exact.** It has three parts.
   - **Finished.** Every check run on the head SHA has completed. Anything
     queued or in progress blocks. Wait for every tier, e2e included. A merge
     made before the last tier finished broke main (folio-assistant#2955).
   - **Full tier.** The "No new failures" judge, or every full test shard,
     ran. A draft or fast-tier-only pass never counts.
   - **Green as judged, by every judge** (owner ruling, 2026-11-07). Where a
     "No new failures" judge exists, its success is part of the verdict, but
     an aggregate job covers only the parts it names. folio-assistant's
     "Repository gates (hard)" is one such job. Each bun test shard carries
     its own Q-PIPE-1 "no new failures" table, and each table must list 0
     new failures. On 2026-11-06, folio-assistant#2985's aggregate was green
     while 4 shards each reported a new failure. A red shard whose failures
     are all main's known failures is fine when its table lists 0 new ones.
     With no judge, each check must have concluded success, skipped or
     neutral.

   A cancelled job counts only when a later run of the same workflow on the
   same head SHA passed the matching job (concurrency supersession). Merge
   with `expectedHeadSha` set to the full 40-hex head SHA, never a short one.
2. **Standing OK.** An owner instruction such as "merge everything green" is
   an explicit OK for every PR that meets rule 1, until the owner withdraws
   it. Merges still follow any stated chain order: a later PR in a chain
   waits for the earlier one.
3. **One PR per fix.** Before opening a fix or re-pin PR, search the open PRs
   in that repository for the same files. If one exists, compare the diffs
   and coordinate instead. If a duplicate is found later, the author of the
   later PR closes it, after checking that the diffs are identical. While
   main is red, one session owns the re-pin that fixes it, and says so to the
   merge-planning session.
4. **A re-pin is a cross-layer set.** Find every layer the change needs, a
   main-red fix or any other, and pin them together in one re-pin, to the
   current mains. Pins move only forward. Verify on a fresh mount
   (`mount:remote --fresh`). A stale container mount gives false local
   passes. The rules and an example are in
   [`remote-mount`](../../../skills/kg/kg-core/remote-mount.md)
   §"Re-pinning" (owner rulings, 2026-11-06, card "Pin target", A, and
   2026-11-07).
5. **Hand back private caches.** A PR that adds its own cache scheme instead
   of the shared `cached-step` is held, not merged, and goes back to its
   author. Cache-first CI, rule 1: every cache goes through `cached-step`.
6. **Tabulation can be delegated.** A helper agent may tabulate the sweep
   under these rules. The helper never touches the PRs the steward owns, and
   never pushes, comments or closes.
7. **The train's PRs are the train's.** A PR labelled `merge-train` or
   `merge-train-batch` is landed by the merge train only, in a batch with one
   main move and one main CI run. The sweep skips it, as `merge-main.yml`
   does; every other PR that meets rule 1 merges as before. A sweep that
   merges a labelled PR one at a time starves the train (owner ruling,
   2026-11-06: "1. The train").
8. **Approved PRs go through the train** (owner ruling, 2026-11-07, card
   "Train", A). When the owner approves a folio-assistant PR that does not
   change `.github/workflows/`, the merge manager adds the `merge-train`
   label instead of merging it. The train lands a batch with one CI run.
   Merging one PR at a time cost about 6.7 runs per merged PR. A PR that
   changes workflows, and a PR in a repository with no train, merges
   directly.
9. **Stacks merge bottom-up** (owner ruling, 2026-11-07). A PR whose body
   says `stacked on <repo>#<n>` waits for that PR. The merge manager lands
   the base first, the stacked PR's owner retargets it onto main and
   merges main in, and only then does it count as ready. A stacked
   folio-assistant PR gets the `merge-train` label only after it has been
   retargeted to main. A cross-layer stack waits until its pin names the
   dependency's merge commit on main. The merge request lists the order,
   and the batch card keeps it.
10. **A re-pin PR holds only pins** (owner ruling, 2026-11-07: "keep repins
    on own PR so easier to stack dependencies"). When the sweep finds a
    re-pin PR (one that changes `index.config.json` or `index.lock.json`)
    that also carries a feature, workflow logic or a fix, the merge manager
    does not land it. It sends it back, and asks for the extra change to
    be split onto a PR stacked on the re-pin, or into the layer that owns
    the fix. Counter-example: folio-assistant#2985 carried #2999 and a
    `caches:viz` gate line inside its re-pin. **Exception** (owner ruling,
    2026-11-07, card "A. Allow the exception"): a change mutually dependent
    with the re-pin, where neither passes alone, may share the PR when its
    body says why (as a content layer's re-pin did on 2026-11-07). The
    merge manager checks the reason; a change that only needs the new pins
    still stacks.

## Runner relief

The merge manager enforces the pacing rule of
[`continual-progress`](../../../skills/conduct/conduct-core/continual-progress.md) §"Pace the ready marking"
(owner ruling, 2026-11-07, card "Cancel CI"). When the runners are
saturated, it:

- closes superseded or duplicate PRs, such as a re-pin whose commits another
  open PR already carries, and cancels their runs;
- cancels stale queued runs that never started, but never a main push run
  that has started;
- asks the owners of P3 PRs to return them to draft.

## Keeping the swarm in step

- **Hold.** Before any batch landing (a train or a meta-merge), message every
  sibling that pushes to the repositories involved: what is about to land,
  and "hold pushes, merges and run cancels here until done".
- **Done.** After the landing, post "done" with what landed and what is still
  open. Post it even when the owner chose not to go ahead. A hold with no
  "done" is an outage.
- **Hand back.** A PR that cannot land (conflict, protected path, red) goes
  back to its owner with the reason, on the PR's own thread or work item. It is
  never fixed inside the train.
- **Report.** After every landing, report to the owner: what merged, the main
  verdict on each repository, and any open decision. Keep it to one message.

## Safety rules (STRICT)

These come from the role; the watcher is the step that acts on them:

- Only the merge manager merges, in any repository, and a scheduled routine
  never merges (§"Only the merge manager merges and re-pins").
- Merges happen only on the owner's explicit OK, given in the merge
  manager's session. A tap on the batch card counts, and the card names each
  PR. A standing OK counts for the PRs it covers (rule 2). A sibling's or
  coordinator's request does not count, and neither does an approval the
  owner gave in a sibling's session.
- Leave every PR labelled `content` out of the status table and the batch
  cards (owner, 2026-11-15). `merge:watch` already skips them. Content goes
  to the owner one by one, on its documented review
  ([`prepare-merge`](prepare-merge.md) §"Content PRs").
- Never merge committee content, change sets (CS-), or held
  `subscriptions/` trees. Never touch WHO or `smart-*` upstream repositories.
- Never push `.github/workflows/` changes without the workflows permission.
- Never cancel a main push run that has already started.
- Never skip, disable or quarantine a test to get to green.

## What this does not do yet

- `merge:guard` check 3 (`ready-marker`) still asks for a `ready: <sha>`
  comment signed by the PR's own session. That still works: a session may
  post the marker on its own PR, and then sends the six lines to the merge
  manager. What it cannot cover is a PR whose session can neither post nor
  reach GitHub, because nobody else may post the marker for it (rule 1).
  Follow-up for the tools layer (owner, 2026-11-13: "update process and
  tools"):
  - check 3 accepts the `ready-to-merge` label, alone or with a pinned
    head, in place of the `ready:` comment, so sessions stop posting ready
    comments;
  - `merge:watch` lists the PRs labelled `ready-to-merge` and `needs-repin`
    as the merge manager's queue, each with its CI verdict;
  - every merge path (`merge:guard --merge`) says that only the merge
    manager runs it, and a standing re-pin run opens a `needs-repin` PR
    and never merges (card "C. No auto-merge");
  - a workflow posts the `merge-guard` status, so that it can be required
    on `main` (card "A. merge-guard required status");
  - `--no-merge-manager` is renamed to say what it now means: the merge
    manager landing a PR of its own.
- The `needs-repin` label must exist in each repository the merge manager
  watches before an agent can use it.

- The timer is each session's own scheduled check-in. No workflow wakes the
  merge manager yet.
