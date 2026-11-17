---
name: review-sheet-agent-columns
description: >
  Whenever an agent works on a change set of a folio whose review sheet is
  kept by the Tool `review-sheet-sync`, it writes the Agent tabs' columns for
  that change set and its comments as it goes: status, step, what it did,
  the PR, the staging page and its build, what the PR changed and when it
  finished. Use on every change-set edit, draft, PR, push, merge or close,
  in a sheet sync or not.
---

# Keep the review sheet's Agent columns current

When an agent works on a change set of a sheet that has the Tool enabled,
it updates the Agent columns as part of the process. The sheet's views
(Agentic status, Staging review and the ⏳ line on Review Public Comments and
Review Change Sets, or on Contributor Feedback in a drafting sheet) are built
from the Agent tabs, so a change set worked without writing them shows
reviewers nothing, or something old as current.

The tabs, their columns and who writes each are the
[`public-comment`](public-comment.md) skill's (§"The live review sheet")
and, for a drafting sheet, [`review-sheet-script`](review-sheet-script.md)
§"Drafting mode". How the script reads them, and the tool that makes the
cells, are `review-sheet-script`'s ("Stale staging previews", "Checked by
commit", "Writing the Agent tab with the tool", "Where the agent is"). This
skill says **when** the agent writes and **what**.

## When it applies

The folio has the Tool enabled: it carries the Tool's config,
`review/public-comment/sheet-sync.json` (a drafting sheet:
`review/drafting/sheet-sync.json`), and the session can reach the sheet
through a Google Sheets connector. The sheet's id is not in the repository;
it is given by the project (its scheduled sheet-sync task, or the owner).

It applies to **any** work on a change set, however it started: a sheet
sync, a card, a thread message, an issue or a review comment on the PR. If
the Tool is enabled but the sheet cannot be reached, do the work, and say in
the reply that the sheet was not updated and why.

## The tabs

- **Agent - Comments** (public comment only): one row per comment (No.),
  with Agentic status, Agentic action taken, Agentic applied in, Agentic
  handled by, Agentic date actioned and Change-sets.
- **Agent - Change Sets** (a drafting sheet: **Agent**): one row per change
  set, with Pull request, Staging review page, What the PRs changed, Agent
  completed, Feedback basis, Staging built, PR head, Staging built from,
  Staging deploy and Agent step (each header ends "(change set)").

A public-comment sheet may instead have one `Agent` tab (comments left,
change sets right, the Config's `AGENT_CS` empty). Write it the same way, by
header.

## When to write

**One move, one Record agent step.** Every move in the table below
is the subprocess `processes/content/record-agent-step.bpmn`, in this order:

1. Write the change set's Agent row: Agentic status, Pull request, Staging
   review page, the build columns, and Agent step.
2. Write Feedback (agent) from that row, linking the same pull request and
   preview.
3. Read back Agentic status, Agentic status (filter) and Staging review after
   the script's next run. If they disagree with Feedback (agent), fix the
   Agent row, never the copied columns.

**A preview link goes in only when it is live**, so a reader never gets a
404. Live means the
GitHub Pages deploy of a gh-pages commit at or after the preview's publish
succeeded (`pages-build-deployment` run, conclusion success), and an HTTP GET
of each link answers 200 where the agent can reach the site. A publish that is
only on the gh-pages branch is not live: deploys queue, and the next push
cancels a queued one. Until then leave Staging review page empty, set Staging
deploy to `deploying`, and write "Preview deploying" in Feedback (agent) with
no preview link. Link the pull request instead.

How to tell it is live, from where the agent runs (agents can be firewalled
from github.io): `gh api repos/<owner>/<repo>/actions/workflows/pages-build-deployment/runs`
and take the newest run whose gh-pages commit is at or after the preview's
publish; `completed` with `success` is live, `queued`, `in_progress` or
`cancelled` is not. Then write `deployed` in Staging deploy. The sheet script
does not fetch pages (it has no network permission, by its security review);
it shows the link only when Staging deploy says `deployed`.

Never write Feedback (agent) alone. The script builds Agentic status and
Staging review only from the Agent tab, so a preview link written only in
Feedback (agent) leaves Staging review empty and Agentic status naming the
old pull request (CS-007, 2026-11-01). Agent step must be exactly
`<step> <YYYY-MM-DD HH:MMZ>` with a step from the fixed list; prose there is
not read, and the row then warns "no agent has picked this up" however much
work was done. A row waiting for people is `idle <time>`.

Write as each step completes, not once at the end. Times, heads and steps
come from `bun run folio-assistant-core/tools/review-sheet-sync/agent-record.ts`,
never typed.

| step | per comment (Agent - Comments) | per change set (Agent - Change Sets) |
|---|---|---|
| work starts | Agentic status *Working* | Agent step `reading` (`agent-record.ts step reading`) |
| proposing, editing | | Agent step `proposing` or `editing` |
| PR opened, or a push to it | *PR open*; action taken, applied in, handled by, date actioned | Pull request, Staging review page, What the PRs changed; PR head, Staging deploy and Agent completed from `agent-record.ts push`; Agent step `pushing` |
| preview on gh-pages, then live | | Staging built from, Staging built; Staging deploy `pushed`, `deploying`, `deployed`; Agent step `staging`, `deploying` |
| Ready for agent acted on, no new commit | date actioned | Agent completed from `agent-record.ts done` |
| blocked on a decision | *Needs human*, and what is needed in action taken | Agent step `idle` |
| ready for review | *Ready for review* | Agent completed; Agent step `qa-review` or `idle` |
| merged | *Change merged* | clear the Staging review page (a merged branch's preview 404s); Agent step `idle`; then close the change set (below) |
| closed unmerged | *Not started*, and say so in action taken | remove that PR's line from Pull request, What the PRs changed, Agent completed and PR head; Agent step `idle` |

**Adding change sets: write the Agent tab only** (2026-11-01). On a
public-comment log, Review Change Sets columns A:B (Change-set, Title) are a
spill, `=FILTER('Agent - Change Sets'!A3:B, ...)` in A3, so a new change set
is a new row at the end of Agent - Change Sets and nothing else. A value typed
into Review Change Sets A:B blocks the spill: every id shows #REF! and the
tab looks empty (the 82 DPI-H rows written to A210:B291 did this until they
were cleared). Before writing any cell, read its formula; never write over or
below a formula's spill range.

**Closing a change set is one step with two tools**, GitHub and the review
sheet. Task `Task_CloseChangeSet` of
`processes/content/contributor-feedback.bpmn`: close the GitHub issue (with
the merge, or the reason it closed unmerged), then set the Agent row's
Agentic status to *Closed* (or *Change merged*) through Record agent step.
The sheet script hides that row and strikes the whole row through; reopening
the issue and writing a new status shows it again. Never hide, strike or
delete a row by hand.

A disposition for the change set is written only from
`agent-record.ts dispositions` (`review-sheet-script`, "Writing the Agent
tab with the tool").

**New feedback while you work, and stalls.**
The log watcher (skill [`review-log-watch`](review-log-watch.md), "Every
poll") sends new Blue feedback on your row to you, verbatim. Answer it in the
same turn: record the Agent step (`reading` at least), and tell the watcher
your step and links, so the row shows who has it. Record a step at least
every time you finish one: a row with no new step 10 minutes after its
feedback changed, or none for 2 hours, counts as stalled, and the watcher
restarts it or takes it over. Name your thread in the row's Feedback (agent)
so the watcher knows whom to ask.

## What to write

- **Re-read the headers first.** People move columns. Find each column by its
  header, never by a letter remembered from an earlier run.
- **Write only the Agent tabs.** Every other tab is people's, or formulas, or
  the Apps Script's. The exceptions are the agent's own Green feedback
  column (`review-sheet-script`) and an explicit instruction from the owner
  for a named cell.
- **Per comment** (every PC in the change set): Agentic status; Agentic
  action taken (what was done, in a sentence); Agentic applied in (the
  sections or blocks changed); Agentic handled by (the agent and its
  session); Agentic date actioned (`YYYY-MM-DD HH:MMZ`, UTC, from the clock).
- **Per change set:** Pull request (one PR URL per line); Staging review
  page (`branches/<slug>/en/review/` while the PR is open); What the PRs
  changed (one line per PR, in the same order as the URLs: what that PR
  changes in the document, in a reader's words); Agent completed and PR
  head (one line per PR, same order). A change set may have several PRs, and
  a line in any per-PR column always matches the line of its URL in Pull
  request.
- **Staging built** and **Staging built from**: when, and from which commit,
  the preview was last built, read from the newest gh-pages commit under
  `branches/<slug>/`. Write them on every rebuild. The script compares them
  with Agent completed and PR head and flags a preview built before the last
  push as stale.
- **Agent step**: write `idle` (or the next step) before leaving a change
  set. A step left behind shows "no update for N min" on the sheet.
- **Append, never reorder.** A change set new to the tab goes at the end.
  Review Change Sets' typed columns sit beside rows derived from it, so
  moving a row moves people's inputs onto the wrong change set.
- **No reviewer names or emails** anywhere the agent writes, in the sheet or
  in the repository. Name feedback by tab, row and column header.
- **Only a PR that edits the document** for the change set goes in Pull
  request (public-comment §"Which PR counts").

## Checking it

After writing, read the change set's row on Review Change Sets (or
Contributor Feedback) back. Once the Apps Script has refreshed (its timer
runs every minute), its Agentic status shows
`<repo>#n (status, completed) · what it changed` for each PR, and Staging
review shows no ⚠ unless the preview really is behind. A missing or wrong
line there means an Agent cell is missing or out of step.
