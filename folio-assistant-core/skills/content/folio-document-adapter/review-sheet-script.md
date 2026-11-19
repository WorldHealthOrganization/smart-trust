---
name: review-sheet-script
description: >
  Build, install and reuse the Google Apps Script that keeps a review sheet's
  links and joined columns current (Tool `review-sheet-sync`). Public-comment
  mode: comment numbers, sections, pages and lines link into the frozen review
  draft, and Review Change Sets joins its comments. Drafting mode: one
  Contributor Feedback tab where each row is a change set with its own GitHub
  issue, and Sections pick from the document's table of contents. Use when
  setting up either sheet for a document, when its links are missing or stale,
  or after a tab, header, anchor or draft link changes.
---

# The review sheet's Apps Script

The sheet itself, its tabs and who writes each column are the
[`public-comment`](public-comment.md) skill's (§"The live review sheet").
This skill is the script that keeps that sheet's links current, and the Tool
`review-sheet-sync` that builds it.

Links inside a cell's text (a section, a page, a "No. n" in a joined column)
cannot come from a formula, which makes at most one link per cell. They are
rich text, which goes stale when the sheet changes, so a Google Apps Script
bound to the sheet keeps them. Never paste them by hand from an agent: the
next edit undoes it.

## Inputs and outputs

Every actor on a review sheet reads and writes only what this table says.
Columns are named by header, never by letter. "People's tab" is Contributor
Feedback (drafting) or Review Public Comments and Review Change Sets (public
comment).

| actor | reads | writes | never writes |
|---|---|---|---|
| People (Authoring Committee, Feedback Review Committee) | the whole sheet | Blue columns on the people's tabs; cell comments | Green, Grey, Orange, Agent tabs, Config |
| Editor (the Config EDITORS list) | the whole sheet | Orange `Ready for agent`, `Ready for merge` | Green, Grey, Agent tabs, Config |
| Owner | the whole sheet | Config `EDITORS` | anything the agent or script writes |
| Apps Script (`review-sheet.gs`, built by Tool `review-sheet-sync`) | Config (CFG, COLS, DATA, EDITORS); the people's tabs; the Agent tab(s) | Grey columns (ids, links, joins); Green columns copied from the Agent tab(s); the STALE mark on the agent column; `Ready for agent` back to No once, on the turn to stale; the Watch tab; protections on the Ready columns; the QC problems at the top of `Disposition (agent)` | Blue columns' contents; Orange except the stale reset; the Agent tab(s) |
| Agent (sync or watcher) | the whole sheet, and above all the people's Blue `Disposition` of each comment, which its dispositions start from; the folio's repository | the Agent tab(s) (one row per change set, and in public comment one row per comment on Agent - Comments), including `Disposition (change set)` in the format below; the agent column, `Feedback (agent)` (drafting) or `Change Set Feedback (agent)` (public comment); Config rows other than EDITORS | Blue, Orange, Grey; the Title (on both kinds of sheet); Change Set (human) |
| QA reviewer (independent: an agent session that did not write the PR, or a person) | the change set's `Disposition (change set)`, the people's Blue `Disposition` and feedback, the PR's diff at its head commit, the staging QA report | `QA gate (change set)` and `QA report (change set)` on the Agent tab, nothing else | everything else, and never a change set whose PR it wrote |
| Tool `review-sheet-sync` | the folio's `review/*/sheet-sync.json`, anchors, line map | `Code.gs` (generic); the Config rows for one sheet (`--config ... --out rows`); a drafting sheet's TOC rows (`--toc-out rows`) | the sheet itself |
| Script `review-anchors-from-folio.ts` | the folio's document manifests and block prose; optionally the library file it was seeded from | `folio/<doc>/review-anchors.json` (`--check` compares) | the sheet |

**A question to people goes in the sheet, not only in chat.** **The agent's
feedback cell has a fixed layout.** The agent writes, in this order and
nothing else:

```
Decision needed: <one question, in plain words, naming what it is about>
  A. <option> (recommended)
  B. <option>
Answer in your feedback column, then an Editor sets Ready for agent to Yes.

Proposed direction: <what the agent proposes or did, in one to three lines>
Next: <what happens next, and who does it>
```

- The ask comes first. Leave the Decision needed block out when nothing is
  asked; the cell then opens with `Proposed direction:`, and the script puts
  a "Please review: do you agree with the proposed direction below?" ask on
  its status line.
- One option says `(recommended)`; options are lettered so people answer
  with one letter.
- Tags (`Decision needed:`, `Proposed direction:`, `Next:` and other
  line-start labels) are the only bold text, in black. The script bolds
  them; never write Markdown `**`.
- Say only what stands now. History ("Step 2", "Already done", "Decided
  (Q1 ...)") goes to Disposition (agent), never here. Pull request state
  comes from the script's ⏳ line, so the agent does not restate it.
- At most 10 lines, so the row shows it whole.
- Name pull requests and issues as `repo#n` (e.g. `dth-hrh#82`). The script
  links each one, and under its ⏳ line adds `↳ Where to review:`, one link
  per Selected Section to that section on the change set's preview (or on
  the published draft while there is no preview). The agent writes no URLs
  of its own for these.

**Selected Sections bound the work.** The agent reads the row's Selected
Sections before it proposes anything, and its proposal, its edits and its PR
stay inside them. A row with no section picked gets a `Decision needed:`
question asking which sections (with the agent's guess as the recommended
option), or, for a row from an issue that names its block, the agent fills
them in from the issue. When an edit must reach outside them (a glossary
term, a figure in another chapter), the cell says so on its own line:
`Outside the selected sections: <which, and why>`.

The watcher checks every row against this layout on each poll
(`tools/review-log-watch/lint.ts`, skill `review-log-watch`) and fixes any
cell it flags. The lint also fails a row with feedback and no section picked,
and a row whose PR changes a chapter none of its sections are in without the
`Outside the selected sections:` line.

When the agent needs a person to decide something about a change set, it
writes the Decision needed block into that row's agent column and sets the
row's Agentic status to `Needs human` on the Agent tab. The sheet never shows
those words: Agentic status opens with **Needs you: answer the agent's
question**, and Agentic status (filter) reads `Needs you: answer the agent's
question`, so the "Needs you" filter view finds it. The ⏳ line says "Needs
you" only when the cell holds a Decision needed block; with none it says the
question is missing. A card in the agent's chat may carry the same question,
but the sheet is the record people see. When the question is answered, the
agent removes the block from the feedback and adds the decision, with who
made it, to Disposition (agent).

**Disposition (agent): the change set's decisions and dispositions.** The
agent keeps one record per change set in the Agent tab's **Disposition
(change set)**, and the script shows it, read-only, in the Green
**Disposition (agent)** column, just right of Ready for merge, on Review
Change Sets or Contributor Feedback. An empty one reads, in bold,
`⚠ No disposition yet for Nos. 127 to 131 and 134` when the change set has
comments. It holds:

1. **The decision history**, oldest first, one line per decision, never
   removed or rewritten: `Decided (Q1, 2026-10-31): A, by the Editor; <what
   it means>`. Change Set Feedback (agent) holds only the current proposal
   and any open question.
2. **One disposition per comment**, after an optional overall statement for
   the whole change set:

   ```
   Overall: <a statement for the whole change set>
   No. 136: Accepted. DPI-F defined at first use, with a glossary entry.
   Nos. 127 to 135, 138 and 139: Not accepted. Already addressed.
   No. 326: Partially accepted. <what was done, and what was not>
   ```

   A disposition is one of Accepted, Partially accepted, Not accepted,
   Noted, Deferred, Duplicate, Out of scope or Withdrawn, first after the
   colon. Every comment of the change set gets exactly one. The script checks
   this (`dispositionProblems`) and puts any problem, in bold, at the top of
   Disposition (agent): `⚠ No disposition yet for No. 140, 141`, `⚠ No. 9
   is not in this change set`, `⚠ No. 136 has two dispositions`, or a line
   whose word is not a disposition. It never edits the Agent tab.

   **Drawn from the people's dispositions.** Before writing a comment's
   line, the agent reads that comment's Blue `Disposition` on Review Public
   Comments (drafting: the row's Blue `Disposition`). Where a person has set
   one, the line uses the same word; where it is empty or Pending, the agent
   proposes one. A word that differs from the people's is flagged (`⚠ No.
   136: Accepted here, Noted in the people's Disposition`) for the committee
   to settle, and never corrected by the agent or the script. The record is
   written before the staging preview is made, and kept current with each
   push.

Once an Editor sets Ready for merge to Yes, the record as it stands is the
summary: the agent puts it in the merge commit and posts it as the closing
comment on the change set's issue.

**From a sibling agent.** An agent that is not the one talking with the
owner, such as a project thread or a subagent, also writes its question here
when the sheet governs the work. It is the `review-sheet` channel of the
harness skill `hand-back-to-discussion` (cat-harness
`schemas/skills/hand-back-to-discussion/input.schema.json`):

| channel field | on the sheet |
|---|---|
| `spreadsheetId` | the sheet, as the folio's `review/*/sheet-sync.json` names it |
| `tab` | Review Change Sets, or Contributor Feedback on a drafting sheet |
| `row` | the change set id or comment number, never a row index |
| `column` | `Change Set Feedback (agent)` or `Feedback (agent)`, by header |

The block, the Agentic status and the replacement on answer are the same as
above. The sheet is an extra copy, never the only one: the sibling still hands
the question back to the discussion agent, which asks the owner. A
Blue-column answer counts as the answer in either place. The agent that takes
it routes it to the other copy and marks that copy answered (the chat copy is
struck through, with `[Edit: …]` added).

**What it keeps current.** Columns are found by header text, so people may
move them.

| tab | column | becomes |
|---|---|---|
| Review Public Comments | No. | a link to the comment's page (`commentUrl` + its ref from Agent's *Comment ref*) |
| Review Public Comments | Sections | each section number, appendix, named section or chapter links to its first page in the draft |
| Review Public Comments | Page | each printed page or range links to that page |
| Review Public Comments | Agentic status | one line per pull request of the PC's change-sets (Agent's *Pull request (change set)*), `<repo>#n (status, completed) · what it changed` (the repository in the link text, because Sheets' link popup cuts the URL short): the PR linked; the PC's Agentic status and the matching line of *Agent completed (UTC, change set)* in bold; then the matching line of *What the PRs changed (change set)*. A PC in several change-sets lists all of their PRs, each once. With no PR, the status alone |
| Review Public Comments | Line no(s) / Table / Figure | each `p.N` and each `line(s) N–M` / `L N` links to its page. Draft line numbers restart, so a line is placed on the page, near the row's own pages, whose numbered lines hold it |
| Review Change Sets | Sections, Pages | the union over the change-set's comments, sorted by page, each linked |
| Review Change Sets | Agentic status | the same, per change-set; the status is its PCs' Agentic statuses, each once |
| Review Change Sets | Agentic status (filter) | one plain value per change set, for a filter view: "Needs you: answer the agent's question" if any of its comments needs a person, else the least advanced of its comments' Agentic statuses (Not started, Working, PR open, Ready for review, Change merged); "Not in comment record" only when all are |
| Review Change Sets | Public Comments | `No. n (Status) · comment`, status in bold, joined by a blank line |
| Review Change Sets | Suggested Revisions, PC Committee Feedback, Dispositions | `No. n · text`, one per comment |

**Change Set Feedback (agent)** (Review Change Sets, green, right of Ready for
merge). The agent writes its proposed direction for resolving the change set
here, and any question for people (§"Inputs and outputs"). The script only
marks it stale. It is a proposal, never a person's feedback: a tool that
collects the people's `Committee Feedback (…)` columns by header must leave
it out, or show it apart, and it decides nothing.

Column names live in Config COLS (`rcs.agentFeedback`,
`draft.agentFeedback`). The script finds each column under any of its names
(`aliasOf`, `SAME_COLUMN`), including the earlier `Architect Feedback …`,
`Architect Feedback (agent)` and `Contributor Feedback (agent)`, and a
feedback basis written under those still matches.

Every `No. n` in Review Change Sets links to `#gid=<Review Public Comments>&range=A<row>`.
Do not link to a named range by `#rangeid=`: Sheets shows "Invalid range"
for a named range whose id was set through the API.

**One script, one Config tab per sheet.** `Code.gs` is the same file for
every document: `review-sheet.gs`, stamped with its commit and made plain
ASCII. Nothing about a document is in it. What differs per document lives in
the sheet's **Config** tab: visible, locked to the sheet's owner, columns Key
and Value, rows `CFG`, `COLS` and `DATA`, each JSON with a leading `|` (so
Sheets never reads it as a number or formula), a long value continued on the
next rows under the same key. `DATA` explains itself in its `ABOUT` entry.
In public-comment mode it holds `SECTIONS` (each section the comments can
name: key → [name shown, PDF page]), `ABBREVIATIONS` (short names such as
HWR → a section key), `PAGE_LINES` ([PDF page, first line, last line]),
`PAGE_OFFSET` (PDF page = printed page + this) and `LAST_PAGE`. In drafting
mode it holds `TOC` (the dropdown: [name shown, anchor]). The script also
reads the short names `K`, `ABBR`, `LP`, `OFFSET` and `MAX`.

```sh
# the script, once per platform version
bun run folio-assistant-core/tools/review-sheet-sync/build-review-sheet-script.ts --script Code.gs
```

<!-- command-path-ok: run IN A PUBLIC-COMMENT FOLIO — review/public-comment/sheet-sync.json is the file `--link` writes (§"Linking a sheet to a repository", step 2), so a folio with no public-comment sheet has none -->
```sh
# one document's Config rows, from the folio's repository root
bun run folio-assistant-core/tools/review-sheet-sync/build-review-sheet-script.ts \
  --repo . --config review/public-comment/sheet-sync.json --out config-rows.json
```

A drafting sheet also gets its TOC tab (the Selected Sections dropdown):

<!-- command-path-ok: run IN A DRAFTING FOLIO — review/drafting/sheet-sync.json is the file `--link` writes (§"Linking a sheet to a repository", step 2), so a folio with no drafting sheet has none -->
```sh
bun run folio-assistant-core/tools/review-sheet-sync/build-review-sheet-script.ts \
  --repo . --config review/drafting/sheet-sync.json --out config-rows.json --toc-out toc-rows.json
```

The agent writes `config-rows.json` into the Config tab (A1 down, columns A
and B, clearing rows below) with the Sheets connector, which runs as the
owner, and keeps the tab protected so only the owner can edit it. CFG and
COLS, which a person might edit by hand, are indented JSON cut into cells
between lines, and column B wraps; DATA, generated from the folio, stays
compact. The script joins a key's cells and parses them. Neither file is
committed: both are rebuilt.

**Install it, once per sheet,** from the sheet owner's account, because
Google asks the owner to authorise the script: §"Installing the script, step
by step" below.

`installTriggers` runs a full refresh, then installs two triggers: every edit
of the three tabs marks the sheet dirty, and every minute a dirty sheet is
rebuilt. The agent writes the Agent tab through the API, which fires no edit,
so the timer also rebuilds after an Agent change:

- **Drafting sheets rebuild incrementally.** An edit rebuilds only the rows
  it touched, at once, so a pick shows its link and a new row its Change-set
  within seconds. The timer rebuilds only the rows whose change set's Agent
  row changed (the script keeps a short hash per change set). A new table of
  contents in Config, an edit of the header row, or Refresh now rebuilds
  everything.
- **Public-comment sheets rebuild whole**, since a comment feeds its change
  sets: at once while a rebuild takes under 5 s, otherwise gathered for the
  timer, which also rebuilds when the Agent tab changed since the last
  rebuild. On a sheet too slow to rebuild per edit, an edit of Review Change
  Sets still flags a stale proposal at once (`staleNow`, reading only that
  tab and the agent's change-set tab).

**Folio Assistant → Refresh now** rebuilds at once.

**Stale staging previews.** The agent records when it built a change set's
preview in the Agent tab's **Staging built (UTC, change set)**, beside
**Agent completed (UTC, change set)**. When a PR of the change set was
completed after the build, the script writes the Staging review cell as
`review ⚠ stale: built <time>, PR changed since`, in both modes (Review
Change Sets takes the link from the Agent tab's Staging review page (change
set) where it names one). Without a build time it claims nothing. The
preview page shows its own live banner too (the site's staging build,
cat-harness-tools).

**Checked by commit.** Times can agree while the preview is still wrong, so
the agent also records, on each pass over a change set with an open PR:

| Agent tab column | what the agent writes | where it reads it |
|---|---|---|
| **PR head (change set)** | each PR's latest commit, one per line, in the PR order | the PR (`gh pr view --json headRefOid`) |
| **Staging built from (change set)** | the commit the preview was built from | the newest gh-pages commit touching `branches/<slug>/`. Its message is `staging(<slug>): from <sha>` when an agent staged it (`stage-local.ts`), or `Publish <site> <sha8> preview of <branch>` when the site-publish workflow did; both forms are accepted |
| **Staging deploy (change set)** | the restage's stage, updated as it moves: `building` (the site is being built), `pushed` (on gh-pages, waiting for Pages), `deploying` (Pages is deploying it; `pending` reads the same), `deployed`, or `failed` | the Pages deployment of that gh-pages commit: `gh api repos/<o>/<r>/pages/builds/latest`, or, where that endpoint is blocked, the conclusion of the "pages build and deployment" run in `actions/runs?head_sha=<gh-pages commit>` |

**On every push, in the same pass:** write the new **PR head**, set
**Staging deploy** to `building`, set each comment's status, and stamp
**Agent completed** with the clock (`date -u '+%Y-%m-%d %H:%MZ'`), never an
estimate. A push recorded only in prose leaves the sheet saying the old
preview is current and the row is "Not started". Then, as the restage moves:
on the gh-pages push, write **Staging built from** and **Staging built** and
set `pushed`; when the Pages run starts, `deploying`; when it succeeds,
`deployed`. The sheet shows each stage in Staging review and the ⏳ line.
With each stage before `deployed` the agent adds when it expects the preview
live, from the clock and recent runs of the same site (`gh run list
--workflow pages-build-deployment` and the build's own duration): `building,
expected 2026-10-31 15:20Z`. The sheet shows "expected live <time>" after
the stage.

### Writing the Agent tab with the tool

The agent does not type numbers or times into the Agent tab: a tool makes
the cells, and the agent runs the sheet's own check before writing.

- **Dispositions.** Read Agent - Comments (`No.`, `Change-sets`) and Review
  Public Comments (`No.`, `Disposition`) with their header rows, and the
  change set's current Disposition (change set) cell. Put them in an input
  file with the items (which numbers, which word, why; `rest` for "every
  other comment of the change set"), and run
  `bun run folio-assistant-core/tools/review-sheet-sync/agent-record.ts dispositions <input.json>`.
  The tool takes the change set's numbers from the sheet, groups them
  (`Nos. 127 to 131, 134, 135, 138 and 139`), uses the people's Blue word
  where an item names none, keeps every earlier `Decided` line, and runs
  `dispositionProblems` from the same review-sheet.gs the sheet runs. If
  anything would show a ⚠, it prints the problems, exits 1 and writes
  nothing: fix the input and run it again. Write its output, unchanged, to
  Disposition (change set).
- **On every push.** `agent-record.ts push --head <full sha> --expect <minutes>`
  prints PR head, Staging deploy (`building, expected <time>`) and Agent
  completed, the times from the clock. Write all three in one update.
- **After acting on Ready for agent with no new commit** (the PR already
  held the change), run `agent-record.ts done` and write the Agent
  completed it prints, so it is later than the Ready time and the ⏳ line
  moves on. Not `push`: nothing is restaged, so Staging deploy stays as it is.
- **When the QA gate passes**, run
  `agent-record.ts qa-pass --cs <CS-nnn> --head <sha> --summary "<one line>" --report <url>`
  (or pass `--qa-gate "Passed <sha>: <one line>"` and optional `--blocks <b1,b2>` / `--since <ref>`).
  It checks the gate string with the sheet's own `qaGate` and writes one
  `editing-hci-validation` workflow instance (`beans/workflows/editing--<block>.json`)
  per changed block, advancing through `Task_Commit` with the change-set id,
  the `Passed <sha>` QA review and the editor's review-sheet decision, so
  `check:corpus-gate` goes green.
- **The PR's review brief.** `agent-record.ts brief <input.json> --look
  "<where to look>"` prints the same Overall and per-comment lines as
  Markdown between `<!-- review-brief -->` and `<!-- /review-brief -->`. Put
  it in the PR body: the staging review page's "What to expect in this
  review" pane shows only that section. Add `--pcs <public-comment dashboard
  url>` (on smart-ra,
  `https://litlfred.github.io/smart-ra/en/folio-assistant-core/public-comments/folio/dpi-h-ra/`)
  and every comment number links to its row there. The link target is the
  comment's own id from the Agent - Comments "Comment ref" column (pass those
  rows as `comments`): the sheet's No. is not the id (on DPI-H, No. 136 is
  PC-0137). A run such as "127 to 131" is spelled out, so no comment hides
  behind a range.
- **Each move.** `agent-record.ts step <name>` (§"Where the agent is: Agent
  step").

Drafting sheets have no comment numbers: pass `"nos": []`; the tool then only
keeps the history.

The script compares only; it stays `@OnlyCurrentDoc` with no internet
access. Short and full shas both work: it compares the common prefix, at
least 7 characters. It reads the active PR as the last one listed (one
branch, one active PR per row) and writes, in this order of precedence:
`⚠ deploy failed`; `⚠ stale: built from <sha>, PR now at <sha>` (with
`; restaging: <stage>` while one runs); `⚠ restaging: building the preview |
on gh-pages, waiting for Pages to deploy | Pages is deploying it`. A change
set with a recorded PR head but no preview link shows `⚠ no preview yet: not
ready for merge`. A change set is never ready for merge without a preview to
review: the agent stages a preview for every PR it opens, and the "Merge
decision due" filter view leaves out rows whose Staging review starts with
⚠. Without these columns the script falls back to the time check above. It
finds them by header, so on a sheet that lacks them the agent adds them at
the right of the Agent (change sets) tab.

**Ready for agent after the preview.** The PR has not changed yet when an
Editor sends a row back, so the commit check above passes. The script
records, as a document property `ready:<CS>`, the time it first sees a row's
Ready for agent at Yes (cleared on No). A Yes it first sees on a row the
agent has already completed counts from that completion instead, since the
script cannot know when it was set. When that time is later than **Staging
built**, after the deploy checks, it writes
`⚠ missing feedback from <time>`: the preview still shows the PR, but not the
feedback an Editor has
just sent to the agent. Only the sheet says so; the review page cannot know
the sheet. The same time makes **Agentic status** open with **Waiting on the
agent since <time> (Ready for agent set)**, until the agent records a later
completion or sets the status to Working.

**Stale agent proposals.** `Feedback (agent)` (drafting) and
`Change Set Feedback (agent)` (Review Change Sets) carry the agent's proposal.
The agent records what it wrote against in the Agent tab's **Feedback basis
(change set)**: `feedbackBasis()` in `tools/review-sheet-sync/feedback-issue.ts`,
a hash of the row's blue cells (drafting: Title, Selected Sections, people's
Contributor Feedback; public comment: Title, TWG (CS), people's Committee
Feedback). The script computes the same hash; while they differ it puts
"⚠ Stale: the row changed since this proposal; the agent will propose
again." on the proposal's first line, and takes it off if the row changes
back. The agent's next sync replaces the proposal and the basis.

In a public-comment sheet the agent writes a **`2:` basis**:
`feedbackBasis(header, row, ["Title", "TWG (CS)"], "Committee Feedback",
PC_BASIS_GREY)`. It also covers the grey content Review Change Sets joins from
the change set's comments (Sections, Pages, Public Comments, Suggested
Revisions, PC Committee Feedback, Dispositions, TWG (PCs)), so a proposal goes
stale when a comment it rests on changes, not only when a blue cell on its own
row does. The agent's own columns (Agentic status, Staging review page, the
proposal) are never part of it, so the agent's writes never make its own
proposals stale. A stored basis without `2:` is compared with the blue-only
hash, so a sheet moves over one row at a time as the agent rewrites each
basis.

**Where the change set is.** Below any stale mark, the script keeps one bold
line starting with ⏳ at the top of the agent's proposal (`progressLine`,
`withProgress`), and replaces it on every refresh: "Ready for merge set: the
agent will merge dth-hrh#7."; "Ready for agent set `<time>`: the agent will
act on this and rewrite it."; "The agent is working on dth-hrh#7."; or
"dth-hrh#7 open; no preview yet | preview current (built `<time>`) | preview
missing feedback from `<time>`." An open PR's line carries the agent's last
completion time ("smart-ra#185 open, updated 2026-10-31 14:41Z; preview
stale: built from 420acd3, PR now at e7b4094."). No pull request, a merged
one, or an empty proposal gets no line. The agent never writes this line or
any status line of its own, and drops it when it rewrites the proposal; the
next refresh (within a minute) puts it back. The agent records the facts in
the Agent tab (PR head, Staging deploy, Agent completed from `date -u`) and
the sheet says them.

An Editor's Orange change (a Ready column) is not part of the basis, so it
never marks the proposal stale: it shows here as a note, and Ready stays as
the Editor set it. The note appears at once: an edit of a Ready for agent
cell records its time (`noteReady_`) and, on a slow public-comment sheet,
`staleNow` writes that row's line without waiting for the timer.

**How to tell it works.** The first run of `installTriggers` takes about 20
seconds for 800 rows and its execution log ends "Execution completed" (a
one-second run means `onOpen` was picked). Then No. is a blue link, and
hovering a `No. n` on Review Change Sets shows a row such as A327. Failed
runs are listed with their error under **Executions** (the clock icon) in the
Apps Script editor. An agent checks from outside by reading a No. cell's
formula (`=HYPERLINK(…)`) and a joined cell's text-format runs.

**Protected columns.** The script runs as the account that installed it, so
it writes the grey and green columns even when they are protected, as long as
that account is an editor of the protected ranges. Install it from the
owner's account.

**Reuse it for another document's public comment.** Nothing in the template
names a document. Give the new folio:

1. The frozen review version in `library/<slug>/`, with its
   `pdf-line-map.json`, and the folio's `review-anchors.json` (the extraction
   described in `public-comment` §"The one fact everything rests on" makes both).
2. A `draft/` redirect on its site to the library viewer, or use the full
   viewer address as `draftUrl`.
3. `review/public-comment/sheet-sync.json`:

   ```json
   {
     "anchors": "folio/<doc>/review-anchors.json",
     "lineMap": "library/<slug>/pdf-line-map.json",
     "draftUrl": "draft/#page=",
     "commentUrl": "en/folio-assistant-core/public-comments/folio/<doc>/index.html#",
     "namedSections": { "CR": "Client Registry" },
     "aliases": { "how to use the guidance": "How to use this guidance" },
     "tabs": { "RPC": "Review Public Comments" },
     "columns": { "rpc": { "lines": "Line no(s) / Table / Figure" } }
   }
   ```

   `namedSections` lists the unnumbered sections reviewers cite by name, and
   their abbreviations, which are matched only in capitals. `aliases` gives
   other names for front-matter chapters. `tabs` and `columns` override the
   defaults in `build-review-sheet-script.ts` only where the new sheet's
   headers differ. The printed-to-PDF offset and the last printed page are
   read from the line map.
4. A sheet with the tabs above, Agent's *No.*, *Comment ref* and
   *Change-sets* columns filled, then build and install as above.

**Test it without a sheet.** `bun test folio-assistant-core/tools/review-sheet-sync/review-sheet.test.ts`
builds the script for a small fake folio and runs it against a fake of the
Apps Script services over the three tabs. It checks every link and join in
the table above, the Agentic status lines, and the edit-and-timer refresh. It
does not prove a given sheet has the script installed or current: that is
**How to tell it works**. Change the template, the builder or this table only
together with that test.

**Rewrite the Config tab** when the review anchors change, the draft link
moves, or a tab or a header the script reads is renamed. Re-paste Code.gs
only when the script itself changes. Renaming a header the script reads,
without rewriting Config, leaves that column unlinked; it fails nothing.

## Ready for agent: Yes, No, Completed

The script sets Ready for agent from **Yes** to **Completed** once the
agent's last push is later than the time Yes was set and the preview of it
is live and current (no ⚠ in Staging review). An Editor sets **Yes** again to
send the row back to the agent. A row that turns stale goes back to **No**
from Yes or Completed. The agent never writes the Orange columns.

**Every pass ends with a finish stamp after the Ready time:**

- The agent ends EVERY pass with a stamp from the tool: `push --head <sha>`
  when it committed, else `done`, which writes Agent completed and the step
  `idle` together. A proposal that waits for the Editor ends with
  `step proposed`. The script counts a later `idle` or `proposed` step as
  the end of the pass, the same as Agent completed.
- Before stopping, the agent re-reads Ready for agent: if it was set after
  the pass began, the pass is not over; act on it (or `done` if there is
  nothing new).
- A Ready for agent with no step recorded after it for 20 minutes shows
  "⚠ no agent has picked this up for N min: ask in the project chat" on the
  ⏳ line and in Agentic status, so a row with no agent never looks like
  quiet work.
- Every log needs a watcher: the setup is not complete until an agent
  thread is watching the sheet. A thread acts only when something wakes it,
  so the watcher needs a scheduled wake: an hourly scheduled task, plus a
  chain of 3-minute delayed wakes (`send_later`) that each pass renews. Each
  wake runs the mechanical check of skill
  [`review-log-watch`](review-log-watch.md) first, and does agent work only
  when it reports a change. For that check the script writes, in a drafting
  sheet, a hash of every cell people set on Contributor Feedback to the
  hidden Watch tab (`F1:I1`: `Cells hash`, the hash, `Checked (UTC)`, the
  time), on every refresh and timer tick. In a public-comment sheet it covers
  Review Change Sets (Title, TWG (CS), every Committee Feedback column,
  Ready for agent, Dispositions confirmed, Ready for merge, Change Set
  (human)) and Review Public Comments (every Committee Feedback column,
  Disposition, Change Set (human), TWG (human)), keyed by Change-set id and
  comment No., so an inserted row changes nothing; it is written on every
  refresh, which the timer runs only when an edit or the Agent tab changed.
  Without a watcher, a Ready for
  agent waits until somebody happens to ask.

## One agent column, status on top

A sheet without an **Agentic status** column gets the status on top of the
agent column (`Change Set Feedback (agent)` or `Feedback (agent)`) instead:

```
⏳ smart-ra#185 open, updated 2026-10-31 15:26Z; preview current (built 15:19Z).
↳ smart-ra#185 (PR open, 2026-10-31 15:26Z) · DPI-F at first use
<the agent's proposal and any Decision needed question>
```

The ⏳ line and each `↳` line (one per pull request, linked; and the ask
when people must answer) are the script's; it replaces them on every
refresh and never stacks them. The agent writes only what is below them and
never starts its own text with ⏳ or ↳. **Agentic status (filter)** stays,
for the filter views. A sheet that keeps its Agentic status column keeps
the status there; delete that column to switch.

## The QA gate, before Ready for merge

**Who.** A reviewer that did not write the change: another agent session, or
a person. The authoring agent never gates its own pull request.

**What it checks**, against the PR's head commit:

1. every comment (drafting: every feedback item) of the change set has one
   disposition (the script's `dispositionProblems` already flags gaps);
2. each disposition agrees with the people's Blue `Disposition`, where one
   is set;
3. each **Accepted** or **Partially accepted** item has its change in the
   PR's diff, and the change does what the line says;
4. a **Not accepted**, **Noted**, **Deferred**, **Duplicate** or **Out of
   scope** item has no change in the diff that contradicts it;
5. the diff changes nothing that no disposition accounts for;
6. the staging QA report for that commit has no failing gate.

**What it writes**, on the Agent tab's change-set row and nowhere else:

- `QA gate (change set)`: first line `Passed <head sha>: <one line>` or
  `Failed <head sha>: <the first problem>`, then one line per problem;
- `QA report (change set)`: the link to the QA report for the staged
  commit: the tree `pr/<n>/<sha>` on the folio's QA reports branch (in
  smart-ra, `cat/cat-harness/qa-reports`; check the branch name, it varies).

When the gate passes, run `agent-record.ts qa-pass` (§"Writing the Agent tab
with the tool").

**What the sheet shows.** Staging review reads `review · QA report` (both
links), then the gate: `✓ QA gate passed (b20534f)`, or in bold
`⚠ QA gate: no independent review yet: not ready for merge`,
`⚠ QA gate failed: <why>`, or `⚠ QA gate stale: reviewed 1234567, PR now at
b20534f: not ready for merge` once the PR moves on (`qaGate`). If Ready for
merge is set before the gate passes, the agent's ⏳ line says it will not
merge until it does, and the agent does not merge. A failed gate sends the
change set back to the author, who updates the PR and its dispositions; the
gate then runs again on the new head.

## Unconfirmed dispositions block the merge

The agent's disposition for a comment is a proposal until the committee
records its own word in the people's Disposition column. While any comment
of a change set is still Pending (or empty) there, Disposition (agent) shows
"⚠ Not confirmed by the committee (Disposition still Pending): Nos. …".
Staging review shows "⚠ dispositions not complete or not confirmed: not
ready for merge", and the ⏳ line says the agent will not merge until every
disposition is complete and confirmed. The agent never merges such a change
set, even with Ready for merge = Yes. `agent-record.ts dispositions` does not
stop on this line, because confirming is the committee's step, not a fault
in the agent's record.

An Editor confirms in the Orange **Dispositions confirmed** column, left of
Ready for merge. There are only three ways to confirm, and no per-comment
checkbox:

- **Yes** confirms every agent disposition in the change set;
- comment numbers typed in the cell ("No. 327") confirm just those; a number
  outside the change set is flagged;
- to differ on one comment, the committee sets that comment's own
  Disposition on Review Public Comments, and a mismatch is flagged.

The script adds the column itself, inside its locked run (so no other
refresh writes by a shifted position), and keeps its Yes/No dropdown.

## Where the agent is: Agent step

At every move the agent writes **Agent step (change set)** on its change-set
tab, with `agent-record.ts step <name>` so the time comes from the clock.
The script shows it on the ⏳ line for as long as it holds, e.g. "⏳ Agent:
editing the document (since today 17:20Z)" (or "yesterday …", or "3 days
ago, 2026-10-28 …"), and adds "⚠ no update for N min" after 30 minutes. A
question for a person ("Needs you: answer the Decision needed below, then
set Ready for agent to Yes") always comes first. The script adds the column,
at the end of the tab, inside its locked run.

| step | when the agent writes it | BPMN task |
|---|---|---|
| `reading` | it starts on new feedback or a Ready for agent | (start of `Task_Propose` / `Task_EditInPullRequest`; public comment: `Task_AuthorEdits`) |
| `proposing` | it writes or rewrites its proposal | `Task_Propose` (public comment: `Task_ProposeChangeSets`) |
| `editing` | it edits the document on the branch | `Task_EditInPullRequest` (`Task_AuthorEdits`) |
| `pushing` | it commits and pushes | end of the edit task, with `push` |
| `staging` | the preview is building | the staging step of the edit task |
| `deploying` | Pages is publishing the preview | as above |
| `qa-review` | it waits for the independent reviewer | `Task_QaGate` |
| `merging` | it merges after Ready for merge | `Task_Merge` (`Task_Incorporate`) |
| `proposed` | it has written a proposal and waits for Ready for agent = Yes; the ⏳ line says "Proposal ready: set Ready for agent to Yes" | end of `Task_Propose` |
| `idle` | it stops: done, or waiting on a person | — |

The agent writes its proposal straight into the feedback cell, which drops
the ⏳ line; the timer watches that column (without the script's own lines),
so the status comes back on the next tick without anyone pressing Refresh.

Write `idle` (or the next step) before leaving a change set; a step left
behind turns into the "no update" warning.

## Rows at most 10 lines high

Sheets cannot scroll inside a cell, so on the people's tabs (Review Public
Comments, Review Change Sets, Contributor Feedback) a row whose text would
run past about 10 lines is fixed at that height and the rest is clipped.
Clicking the cell shows the whole text in the formula bar, and
double-clicking opens it scrollable. Rows that fit size themselves, and a row
that shrinks back under the cap is released. The script estimates lines from
column widths (`capRows`), so it needs no layout access.

## Structured cells and column hover text

A list is never run together with semicolons. Agents write "What changed"
and "What the PRs changed (change set)" one item per line, as `• <item> (No.
n)`, under a label line ending in a colon. The script splits any remaining
`a; b; c` into bullet lines, and bolds line-start labels (`What changed:`,
`Proposed direction:`) and comment references (`No. 326`, `Nos. 1, 2 and
5`).

Every column head carries a hover note saying what the column holds and who
fills it in, without naming its colour. The notes are `HEADER_NOTES` in the
script, keyed by header (or `<tab kind>|<header>` where one header means
different things on different tabs); a head named `Name (initials)` uses its
`Name (*)` entry. The script owns the note on every head it knows and writes
only notes that changed; a head it does not know keeps its own. A new column
gets its note in the same change that adds its header; `review-sheet.test.ts`
checks that every known head has one and that none names a colour.

The QA report link opens the viewer, the preview review page's per-section
QA table (`<review page>#heat`), with the raw qa-reports entry beside it as
"files". Text in a cell that is not a link is written plain, so it never
inherits a link's blue underline.

## Sheet conventions (any agent-written Google Sheet)

These hold for every Google Sheet an agent writes or keeps current, not only
the review sheets:

| colour | who controls it | lock |
|---|---|---|
| grey | mechanical: ids, headers, copied source text | owner only |
| blue | people: the human-controlled columns | open to the sheet's editors |
| orange | editor gates (Ready for agent, Ready for merge) | its own lock, owner plus the named editors |
| green | agent-derived: links, joins, status | owner only |

- **Templates** are locked to the owner except the blue columns; the orange
  gates carry their own lock that starts with the owner alone.
- **The Config tab** is visible, never hidden, and locked to the owner: the
  agent writes it, people can read what the sheet is set up for.
- **Instructions name no colour.** The key on the first line reads "Column
  colours:" then one phrase per colour ("your input, by ...", "written by
  the agent", ...), each shown in its colour, and the steps name columns
  ("Reviewers update Contributor Feedback", "an Editor sets Ready for
  agent"), never a colour. The script's `colourInstructions` shows each
  column name bold in a darker shade of that column's header fill, on every
  refresh, so text the agent rewrites through the API, which drops the
  colours, gets them back within a minute.
- **Which template** depends on the document's authoring stage: the
  Contributor template while it is being drafted and authored, the Public
  Comment Review template once public comment opens.

## Archiving the log

Every review log keeps a copy in its document's knowledge graph, beside the
comments and change-sets it reviews (issue #682; owner, 2026-11-08):

| File | What |
|---|---|
| `review/public-comment/logs/<log-id>.json` | the log's `review-log/1.0.0` node: sheet id and link, document, role (master or contributor), each tab's header row and the role of each column, read from its header colour (blue = human, orange = editor, green = agent, grey = script), the workbook's SHA-256 |
| `review/public-comment/logs/<log-id>.xlsx` | the log as a workbook: values and their types, hyperlinks, notes, fills, a frozen header row |

The workbook is .xlsx, so a person opens it in Excel, Google Sheets, Numbers
or LibreOffice. It is never a custom JSON. There is one workbook per log, and
it is **overwritten**, never added to as a dated copy. Git history is the
history, and each commit message lists the cells that changed. An unchanged
log builds the same bytes, so it makes no commit.

The log's watcher runs it once a night, after its normal poll:

1. Read the log a tab or two at a time (one read of a whole log is too large):
   `get_spreadsheet` with `includeGridData` and the fields in `ARCHIVE_FIELDS`,
   one range per tab. Each read is saved to a file.
2. `bun run folio-assistant-core/tools/review-sheet-sync/review-log-archive.ts --sheets <read1> --sheets <read2> … --sheet-id <id> --repo <document repo> --log-id <id> --document <doc> --role master|contributor --title "<log name>"`.
   It prints the commit message, or `unchanged`.
3. If it changed, commit the two files on the document repository's main,
   with that message, as an agent change that is not content.

Never archived:
- hidden helper tabs (Watch, RCS joins);
- the Public Comment Source tab, and any tab of submitters or contributors;
- contact columns: a header naming an email, phone, address or contact is
  blanked;
- any email address left in another cell, which is removed.

The node records what was left out.

## Importing offline feedback

One process for feedback written outside the master log (issue #683): an
offline copy of the log, the feedback template returned with the
line-numbered review PDF, or an archived workbook to restore. Run the
archive first, so the master workbook is current.

1. **Check.** `bun run folio-assistant-core/tools/review-sheet-sync/review-log-import.ts check <returned.xlsx> --log review/public-comment/logs/<id>.json [--base <xlsx>] [--line-map library/<review version>/pdf-line-map.json] [--tab-map "Comments=Review Public Comments"] --out report.json`.
   The returned workbook is first validated against the template. Each tab
   must be a tab of the log, and its headers must be the template's. A
   renamed or missing column stops the import. An extra column is reported
   and ignored. A dropdown value outside the master's values, or a page or
   line that is not in the frozen review version, rejects the row.
2. **Sort.** Every row with feedback is put in a group. Imported CS# and PC#
   numbers are hints, never keys.

   | Group | When |
   |---|---|
   | Add to existing | same number and same title: the changed human cells |
   | Conflict | same number, another title (the number is wrong or reused); or a cell changed both offline and in the master since the copy was taken |
   | Possible duplicate | no such number, but the same words as another row |
   | New | none of these: the master gives it a number |
   | Rejected | it failed validation |

   `--base` is the archived workbook the copy was taken from (`git show <commit>:<file>`). With it, a cell changed only in the master is kept. Without it, a filled master cell may only be extended offline, and any other change to it is a conflict.
3. **A person selects.** Post the review list the check printed and ask which rows to import. Give the lettered or numbered choices, with a recommendation: usually every Add and New, no Conflict.
4. **Plan.** `review-log-import.ts plan report.json --log <node> --select <numbers> [--accept-conflicts] --out plan.json` gives the cell writes: A1 range and value, human columns only. A new row goes below the last row, and the sheet's script numbers it. A new comment from the PDF feedback template has only the script's columns (page, line, comment). It is not typed into the sheet. It goes to `--intake-out <csv>` for `public-comment.ts import --channel comment-matrix`, which numbers and places it. That CSV may hold names, so it stays out of the repository.
5. **Write** the planned cells to the master log, and nothing else. Editor (orange), agent (green) and script (grey) cells are never written. The watcher then picks the new feedback up as usual.

## Published with the document's site

`scripts/review-sheet-site.ts --out <site>` (package script
`site:review-sheet` in a folio, a `sourceSteps` entry of its site build)
writes `<site>/review-sheet/`: the generic `Code.gs`,
each `review/<mode>/sheet-sync.json` as `<mode>.config-rows.json`,
`review-sheet.jsonld` (the script as `schema:SoftwareSourceCode` with its
SHA-256 and commit; each document's settings as a `schema:Dataset` linked
to its sheet and to the Tool), and an `index.html` with the setup steps and
the SHA-256 to check a pasted copy against. Point people there rather than
sending the file.

## Trusting the script

A copy of a sheet carries its Apps Script, so anyone starting from a
template should know what they are running.

- **Nothing runs until the sheet's owner allows it.** The owner runs
  `installTriggers`; Google then shows the scopes, and the triggers run as
  the owner, whoever's edit fires them. So an editor's edit makes owner
  code read what they typed: the script therefore never writes typed text
  as a formula (`asText`, `q`), and touches only this sheet.
- **Security review.** [`tools/review-sheet-sync/security-review.md`](../../../tools/review-sheet-sync/security-review.md)
  records the threat model and findings F1 to F10, each fixed with a test or
  accepted with its reason. Re-review on any new write sink, service, or
  editor-writable tab.
- **The agent caps new issues** (finding F6): it opens a change set's
  issue only for a row with a Title or feedback text, and asks a person
  before opening more than 20 in one sync.
- **This sheet only.** The template starts with `@OnlyCurrentDoc`, so the
  consent screen asks for "this spreadsheet", not all of the owner's
  spreadsheets. The script uses only SpreadsheetApp, PropertiesService,
  LockService and ScriptApp: no UrlFetchApp, mail or Drive, so it sends
  nothing out. `review-sheet-security.test.ts` fails if one of those, or
  `eval`/`new Function`, appears.
- **Three permissions, one file.** Google works out a script's permissions
  from its code, and `@OnlyCurrentDoc` narrows the spreadsheet one to this
  sheet. So the consent screen asks for exactly three: this spreadsheet, the
  script's own triggers, and its menu. `tools/review-sheet-sync/appsscript.json`
  records those three for the security test, which fails if the code would
  need more. It is a record, not a file to paste.
- **Plain ASCII.** The built script escapes every non-ASCII character, so a
  paste cannot mangle it. The build prints its SHA-256; compare it with the
  pasted copy.
- **Wrong sheet.** Pasted into a sheet it was not built for, it stops with a
  message naming the config and tab it expected, before installing triggers.
- **Check a copy against its source.** The script is the same for every
  document, so one review covers all copies. Its header names the
  folio-assistant-core commit it was built from. Build again at that
  commit with the folio's config and compare; or ignore the copied script
  and paste one you built yourself.
- **"Google hasn't verified this app."** Bound scripts are unverified, so
  the owner clicks Advanced to continue. Publishing as a verified Workspace
  add-on would remove the warning.

## Drafting mode: editors' and contributors' feedback

Before a document goes to public comment, editors and contributors give
feedback on the working draft. That needs a simpler sheet: no Public Comment
Source, no Review Public Comments, no TWGs. Each row of feedback *is* a
change set (CS: a list of related comments on one topic), and each change
set gets a GitHub issue.

**Tabs.**

| tab | who writes | columns |
|---|---|---|
| **Contributor Feedback** | people, plus the Apps Script | one row per change set. Grey, mechanical: **Change-set** (the script gives a used row the next `CS-nnn` once; it stays with the row). Blue, people: **Title**; **Selected Sections** (a multi-select dropdown of the document's table of contents, each section indented under its chapter by three U+2800 blanks per level, since a dropdown cannot nest; not real spaces, because Sheets trims a multi-select cell and the first chip would lose them and read as Invalid; plain, because a dropdown chip cannot carry a link); any number of **Contributor Feedback (…)** columns, one per contributor, with their initials or name in the brackets (e.g. `Contributor Feedback (CL)`; the script reads every column whose header is `Contributor Feedback` or starts `Contributor Feedback (`); **Disposition** (a dropdown: Pending, Accepted, Partially accepted, Not accepted, Noted, Duplicate, Out of scope), the committee's verdict on the row. Orange, editors: **Ready for agent** (Yes, No, Completed), **Ready for merge** (Yes/No). Grey, by the script: **Section links** (each selected section on its own line, linked to its place on the document page, like the Sections column of the public-comment log). Green, by the agent: **Feedback (agent)**, right of Ready for merge, the agent's proposed direction (not a person's feedback: the script leaves it out of the Contributor Feedback columns, and it decides nothing). Green, by the script from Agent: **Issue** (`<repo>#n`, linked), **Agentic status** (as in public-comment mode: one line per PR, `<repo>#n (status, completed) · what it changed`), **Staging review** (a "review" link to the change set's review page on its staging preview, `branches/<branch>/en/review/`, while its PR is open), **Agentic status (filter)** (the change set's status as one plain value, for the "By agentic status" filter view) |
| **Agent** | the agent only | one row per change set: Change-set, Issue (URL), Agentic status, Pull request (change set), What the PRs changed (change set), Agent completed (UTC, change set), Staging review page (change set), Feedback basis (change set). The agent writes it as each step completes, by the steps of the `review-sheet-agent-columns` skill; a drafting sheet has no per-comment rows, so only its change-set columns apply |
| **TOC** (hidden) | the script | the Sections dropdown's list and each entry's link. Rewritten on every refresh, so it follows the document |

Colours as in public-comment mode: grey mechanical, blue human, orange
editor gates, green agent-derived.

**Table of contents.** Built from the folio's `review-anchors.json`: each
chapter (`Ch 3 Digital Transformation Approach`), each numbered section
(`3.1 DIIG alignment`) and each unnumbered section, prefixed by its chapter
(`Ch 3 · Objectives and key messages`). A multi-select cell joins its choices
with `, `, so commas in titles become `;`. Each links to
`sectionUrl` + the anchor (`sec:3-1`, `chap:<dir>`), which the document page
carries as element ids.

**Config**, `review/drafting/sheet-sync.json`:

```json
{
  "mode": "drafting",
  "anchors": "folio/<doc>/review-anchors.json",
  "sectionUrl": "en/<doc>/#"
}
```

Write the URLs **relative to the folio's site**: the build resolves them
against `iriBase` in the folio's `<instance>.json` (e.g.
`https://litlfred.github.io/dth-hrh/`), so no organisation name is written
in sheet-sync.json and a folio that moves changes one `iriBase` and rewrites
its Config. An absolute `https://` URL is taken as written.

`tabs` and `columns` (`draft`, `draftAgent`) override the headers as in
public-comment mode. Write its Config with `--config review/drafting/sheet-sync.json`
and install as above. The Sections dropdown is a data validation "dropdown
from a range" on `TOC!A2:A` with **Allow multiple selections** ticked (step
6 below). Without the tick, a cell with two or more sections shows "Invalid:
Input must fall within specified range".

**The agent's part: every change set has an issue.** On each sync, for every
Contributor Feedback row with a Change-set:

1. If the Agent tab has no row for it, add one (Change-set, Agentic status
   `Not started`).
2. If that row has no Issue, open a GitHub issue in the folio's repository:
   title `CS-nnn: <Title>` (or the first feedback line while Title is
   empty), body the linked sections, every Contributor Feedback (…) cell
   verbatim, and a link back to the sheet row. Write its URL into Issue.
3. When feedback is added to a row later, comment the new text on its issue.
4. Propose a direction in **Feedback (agent)** for every new row (from an
   issue, a person or a TWG workbook) and whenever the row changes, whoever
   changed it. The watcher does this on its next wake (skill
   `review-log-watch`, step 5). A question for people goes there too, as a
   `Decision needed:` block (§"Inputs and outputs"). On each sync compute
   `feedbackBasis(header, row)` (`tools/review-sheet-sync/feedback-issue.ts`:
   a short hash of Title, Selected Sections and the people's Contributor
   Feedback columns). Where it differs from the Agent tab's **Feedback
   basis (change set)**, or the proposal cell is empty (a person clears it
   to ask for a fresh one), write a new proposal and the new basis. The
   script's own writes (ids, links, tree marks) do not change the basis.
5. Work a change set only when **Ready for agent** is Yes; its PRs say
   `Closes #n` for the change set's issue, and go to Agent's PR columns.
6. When you pick a row up, say so first: set its Agent status to `Working`
   and put the URL of your conversation (the session, thread or PR
   discussion) in **Agent conversation (change set)**. Agentic status then
   opens with **An agent is working on it: conversation**, linked. The
   script finds that column by header; on a sheet that lacks it, the agent
   adds it at the right of the Agent (change sets) tab.

Title is the people's on both kinds of sheet: the agent never writes it. In
public-comment mode a Title-only row on Review Change Sets is a new change
set, and the agent's title is only the first value of a row it adds (skill
`review-log-watch`, "Change sets people make").

**Feedback from the site.** A folio with
`.github/ISSUE_TEMPLATE/block-feedback.yml` (copy the shared
`templates/issue-forms/block-feedback.yml`) gets 📣 feedback links that open
that form with Content, Section, Block, page and Source prefilled; the
contributor picks a Type and writes Comment and Proposed change. On each
sync the agent lists open issues labelled `feedback` that no Agent row
names, and for each appends a Contributor Feedback row from
`tools/review-sheet-sync/feedback-issue.ts` (`feedbackRow`): Sections the
block's TOC entry, Title a draft (`<section>: <first sentence>`, which
people may rewrite), Contributor Feedback `@login (Type): comment` plus
`Proposed: …`. The script then gives it a CS id, and the agent writes the
issue's URL into that change set's Agent row: the feedback issue *is* the
change set's issue, so step 2 above opens none. A comment added to the
issue later is added to the row's next empty Contributor Feedback cell.

**Linked templates.** Each mode keeps one template sheet in the
informatics.avengers Drive, laid out as above, script installed, no rows.
A new document starts from its "make a copy" link (table at the end); then
the agent writes the new document's Config tab, and the owner runs
installTriggers. The script in the template needs no change.

**Locks in a template and its copies:** every cell is locked to the owner
except the blue, human-controlled columns, and the heads of the Contributor
Feedback (or Committee Feedback) columns, where each contributor writes their
initials. The lock covers the other headers, the grey mechanical and green
agent-derived columns, the Config tab, the Agent tab and the hidden TOC. The
orange Ready-for-agent and Ready-for-merge columns have a lock of their own,
**"Ready columns: editors"**, which starts with only the owner; the owner
adds each document editor to it in each copy (step 4 below).

### Setting up a sheet for a new document

The owner (informatics.avengers) does steps 1 to 6; the agent does step 3.

1. **Copy the template.** Open the "make a copy" link for the mode (table
   at the end), name the copy "<document> Contributor Log" or "<document>
   Public Comment Log", and keep it in the informatics.avengers Drive. A file
   copy keeps tabs, colours, dropdowns, locks and the script. **Always copy
   the file** (File, then Make a copy); never build a log by copying tabs
   into a blank spreadsheet, which leaves the script behind. The owner keeps
   the latest `dist/Code.gs` pasted into both templates, so a copy starts
   current.
2. **Share it.** Share > add contributors or reviewers as **Editor**. The
   locks still keep them to the blue columns.
3. **Link it to the repository (agent).** Give the agent the copy's URL and
   the document's repository. The agent follows "Linking a sheet to a
   repository" below. Until it does, Config holds only its Instructions,
   Key and EDITORS rows and the Selected Sections dropdown is empty.
   The sheet says what to do next: the first line of each tab's Instructions
   starts with ⚠ and names the next step, "Not set up yet. Step 1 of 2: ask
   the agent to link this sheet …" (the templates carry it, so a copy starts
   with it), then, once linked, "Almost set up. Step 2 of 2: choose Folio
   Assistant, then Install". A short toast says the same when the sheet
   opens, and every run of an unlinked sheet stops with "Ask the agent to
   link this sheet to its document: give it this sheet's link (ID …)". Once
   installed (the `timerMinutes` document property installTriggers sets),
   the ⚠ line goes and each tab's Instructions ends with a
   `Document: <site>   Repository: <repo>` line; Config has an
   `Instructions - Links` row with the site, the repository and the
   sheet's settings file.
4. **Name the editors (owner).** Type their emails in Config's orange
   `EDITORS` row, or leave it empty so only the owner can set the Ready
   columns (below).
5. **Install the script**: §"Installing the script, step by step" below. A
   copy of the template already holds the script, so the paste is needed
   only when the script changes; **installTriggers is needed in every
   copy**, because triggers and the owner's permission do not copy. A copy
   keeps the version it was made with: when Code.gs changes, paste it again
   into each sheet in use, and into the template.
6. **Drafting only: finish the Selected Sections dropdown.** installTriggers
   adds the rule (a dropdown from `TOC!A2:A`) when the column has none, and
   leaves an existing one alone (a rewrite would clear its tick). One setting
   is a person's, once per sheet:
   - click the column letter above "Selected Sections" to select the column;
   - choose Data, then Data validation;
   - open the rule for that column (the sidebar lists it by its range, such
     as `'Contributor Feedback'!E2:E1000`, as "Dropdown (from a range)");
   - under Advanced options, check that Display style is **Chip**;
   - tick **Allow multiple selections**;
   - press Done.

   **The tick is greyed out unless the style is Chip.** A rule that Apps
   Script writes (`requireValueInRange`) gets the **Arrow** style, which Apps
   Script cannot change. The agent therefore sets the style through the
   Sheets API at setup, and whenever a log's rule reads `customUiMode:
   ARROW`: `setDataValidation` with the same `ONE_OF_RANGE` condition and
   `"showCustomUi": true, "customUiMode": "CHIP", "strict": false`. The API
   reads the tick (`condition.allowMultipleSelections`) but sets it only for
   `ONE_OF_LIST` rules, so ticking it on the range rule stays the person's
   step. installTriggers cannot check either directly. It shows the steps in
   a 30-second toast unless it has evidence they are done: a cell already
   holding two sections from the list (or `dropdownDone`). It is a toast,
   never a dialog: a dialog waits for an answer in the sheet, and an Install
   run from the Apps Script editor then hangs until Apps Script stops it at
   6 minutes ("Exceeded maximum execution time"). Only the menu's "Which
   version is this?" opens a dialog. Copies made after the template has them
   keep them. The same steps are in the Config tab's `Instructions -
   Dropdown` row; the script ignores that row.

### Installing the script, step by step

For the sheet's owner, once per sheet. The Config tab's `Instructions -
Install script` row carries the same steps and links here.

1. **Get the latest Code.gs.** Open
   [`dist/Code.gs` on GitHub](https://github.com/litlfred/folio-assistant-core/blob/main/tools/review-sheet-sync/dist/Code.gs)
   and press **Copy raw file** (the two-squares button at the top right of
   the code), or open the
   [raw file](https://raw.githubusercontent.com/litlfred/folio-assistant-core/main/tools/review-sheet-sync/dist/Code.gs),
   select all and copy. It is the build of `review-sheet.gs` on core's main,
   rewritten by `build-review-sheet-script.ts --dist`; a test fails when it
   is stale.
2. **Open the editor.** In the sheet: **Extensions**, then **Apps Script**.
   It opens in a new tab. "Sorry, unable to open the file at this time" (in
   German, "Datei kann derzeit nicht geöffnet werden") means the browser is
   signed in to several Google accounts and Apps Script opened under the
   default one (`/u/0/`), which cannot see the sheet: use a private window
   with only the owner's account, or change `/u/0/` in the failing address
   to `/u/1/`, `/u/2/`, and so on.
3. **Name the project after the sheet.** Click **Untitled project** at the
   top left, type the spreadsheet's own name (e.g. "DTH-PC Contributor
   Log"), and press **Rename**, so it is found by name in
   script.google.com, where bound projects are listed apart from their
   sheets.
4. **Paste.** Click **Code.gs** in the Files list on the left. Select all
   (Ctrl+A, or Cmd+A on a Mac), delete, paste, and save (Ctrl+S or Cmd+S,
   or the disk icon). Code.gs is the only file to paste: leave the
   project's manifest as it is.
5. **Run installTriggers.** Reload the sheet and choose **Folio Assistant**,
   then **Install**. Or, in the editor, the function list next to **Run**
   and **Debug** shows **installTriggers** (it is the first function, so the
   default; not `onOpen`, which only adds the menu); press **Run**.
6. **Allow it.** **Review permissions**, pick the owner's account. Google
   shows "Google hasn't verified this app. The app is requesting access to
   sensitive info in your Google Account." That is expected for a sheet's
   own script, which Google never verifies: press **Advanced**, then **Go to
   <project name> (unsafe)**, then **Allow**
   ([why](https://support.google.com/cloud/answer/7454865)).
7. **Check it.** The log shows "Execution completed". Back in the sheet tab,
   reload: a **Folio Assistant** menu appears; **Folio Assistant**, then
   **Refresh now**, checks it.
8. **Drafting sheets only:** tick **Allow multiple selections** on the
   Selected Sections dropdown (step 6 of "Setting up a sheet for a new
   document").

**Updating later:** steps 1, 2 and 4, then Folio Assistant, then Refresh now;
the automatic refresh stays installed. Sheets may run older builds:
**Folio Assistant, then Which version is this?** shows the build the sheet
runs (`SCRIPT_VERSION`, the stamp on the script's header line), the Code.gs
copy page, and "✓ Up to date" or "New build available" by comparing with the
Config tab's `CFG.LATEST_BUILD`. The agent writes `LATEST_BUILD` (the content
stamp of the build it publishes, `latestBuild()`) with the Config rows, so
rewrite each sheet's Config when a new build goes out. The script never
fetches.

**The menu** is named **Folio Assistant** and ends with **About Folio
Assistant**, which points to https://litlfred.github.io/folio-assistant/; the
same link is the last line of each tab's Instructions. The library builds
the menu (`addMenu`) and the stub asks it, so every sheet shows the same menu
and a rename needs no new stub. A stub that builds its own "Review links"
menu is out of date: paste `dist/Stub.gs` over it once.

**A copy of the template needs none of this:** the script came with the
file. Reload the copy, choose **Folio Assistant**, then **Install**, and
allow it as in step 6. The menu runs installTriggers, so the editor is never
opened. Renaming the bound project (step 3) is optional: a copied project is
named "Copy of ..." by Google.

### One library, a stub in each sheet

The code lives once, in a standalone Apps Script project, **Folio Review
Library**, owned by the sheets' owner, and every sheet runs its latest code
(HEAD). Each sheet keeps only
[`dist/Stub.gs`](../../../tools/review-sheet-sync/dist/Stub.gs), which never
changes.

Setting the library up, once:

1. At script.google.com, **New project**; name it `Folio Review Library`.
2. Replace its code with [`dist/Code.gs`](../../../tools/review-sheet-sync/dist/Code.gs); save.
3. **Project settings** (the gear): copy the **Script ID**. The library is
   [`1us7_ApIq_XvDG-V1XtqdcyHucF0hSlST0qracv1Tw9KTb4-lAFvK1bMQ`](https://script.google.com/home/projects/1us7_ApIq_XvDG-V1XtqdcyHucF0hSlST0qracv1Tw9KTb4-lAFvK1bMQ/edit);
   the Config tab's install steps and the stub name it.

Each sheet, once (templates first, so copies inherit it):

1. Extensions, then Apps Script. Replace Code.gs with `dist/Stub.gs`; save.
2. **Libraries +**: paste the Script ID, **Look up**, Version **HEAD
   (Development mode)**, Identifier `Review`, **Add**.
3. In the sheet, **Folio Assistant > Install**.

An update needs no paste. The library also holds
[`dist/Updater.gs`](../../../tools/review-sheet-sync/dist/Updater.gs);
**`updateFromGitHub`**, run from the library's editor, fetches `dist/Code.gs`
from `main` and writes it over the library's Code.gs through the Apps Script
API, leaving the library's other files alone. It refuses anything that is not
the review-sheet script (an error page, the stub) and logs "Updated to
`<version>`" or "Already current". There is no timer: an update runs when the
owner runs it. Every sheet runs the new code from its next open, edit or timer.

Adding the updater, once:

1. Turn on the Apps Script API at <https://script.google.com/home/usersettings>.
2. In the library, **Files +**, Script, name it `Updater`; paste `dist/Updater.gs`; save.
3. **Project settings**: tick "Show appsscript.json manifest file in editor",
   then replace `appsscript.json` with
   [`dist/library-appsscript.json`](../../../tools/review-sheet-sync/dist/library-appsscript.json)
   (it adds the `script.projects` and `script.external_request` scopes); save.
4. Pick `updateFromGitHub` in the function list, **Run**, and allow it.

After that an update is step 4 alone. Without the updater, an update is one
paste of the new `dist/Code.gs` into the library. "Which version is this?"
reports the library's stamp.

The stub hands its services over (`Review.init`) because a library has no
spreadsheet of its own, so its document properties, document lock and
triggers would not be the sheet's. The stub passes its own
`PropertiesService`, `LockService` and `ScriptApp`, and the triggers it
installs name the stub's functions. Pasted straight into a sheet, Code.gs
still works alone: without `init` it uses the sheet's services.

HEAD runs only for people with edit access to the library. The triggers run as
the owner who installed them, so that is the owner alone; an editor who uses
**Refresh now** by hand needs the library shared with them as an editor.

### Linking a sheet to a repository

A copied sheet knows nothing about its document until the agent links it.
Linking is repository work first and sheet work second, in this order:

1. **The folio has a section list.** A drafting sheet's dropdown is the
   document's chapters and sections, read from
   `folio/<doc>/review-anchors.json`. The folio's `package.json` declares
   `review:anchors` and `check:review-anchors`, both running
   `folio-assistant-core/scripts/review-anchors-from-folio.ts --document <doc>`.
   A document seeded from a library file adds `--library <entry> --source
   <file> --source-label <text>`; one authored from scratch (dth-pc, dth-sc)
   leaves all three out. Run `review:anchors` and commit the file. A new
   document folio declares both scripts from its first commit.
2. **The folio names the sheet, and the rows are built: one command.**
   From the folio's root, with the link the person pasted:
   `bun run folio-assistant-core/tools/review-sheet-sync/build-review-sheet-script.ts --link <sheet link or id> --document <doc> --out config-rows.json --toc-out toc-rows.json`.
   It writes `review/drafting/sheet-sync.json`
   (`{"mode":"drafting","anchors":"folio/<doc>/review-anchors.json","sectionUrl":"en/<doc>/#","sheet":"<spreadsheet id>"}`;
   an existing file keeps its settings and only gets the new `sheet`), then
   the rows. The site and repository links come from the folio's `iriBase`
   (`https://<owner>.github.io/<repo>/` is `https://github.com/<owner>/<repo>`);
   a folio on another host sets `"repository"` in sheet-sync.json.
   Public comment, or to rebuild after a structural change: `--config review/<mode>/sheet-sync.json` instead of `--link`.
3. **The agent writes the sheet.** With the Sheets connector, it writes the
   rows from step 2: the whole Config tab from A1, keeping the sheet's
   EDITORS value (the `Instructions - Links` row sits above Key, so the CFG,
   COLS and DATA rows land below EDITORS), and for drafting the TOC
   rows into the TOC tab from A1. The connector writes values, not colours,
   so the agent also colours Config: the Key row a Grey header (`#b7b7b7`,
   bold), EDITORS Orange (`#f4b26b`), and CFG, COLS, DATA and their
   continuation rows Grey (`#efefef`), and fits the Instructions rows'
   heights to their text (a Sheets API `autoResizeDimensions`; an inserted
   row otherwise inherits its neighbour's height). Every refresh re-applies
   these (`styleConfig`), so a sheet the script runs in heals on its own.
   The TOC rows are exactly what the script's refresh writes, so the
   dropdown works before anyone pastes the script.
4. **The agent says what is left for a person:** paste Code.gs and run
   installTriggers (step 5 above), and tick Allow multiple selections
   (step 6).

When the branch carrying the folio is not merged yet, the agent may run steps
1 and 3 from that branch without pushing to it, and write the sheet; the
branch's owner commits the anchors and sheet-sync.json. Re-run step 3 after
any structural change to the document (a section added, moved or renamed).

**Who may set the Ready columns: the `EDITORS` row.** Everyone who works in
a log is shared as Editor; protected ranges decide what each can change.
Blue columns are open to all of them. The orange **Ready for agent** and
**Ready for merge** columns are for editors only, and the owner names them
in the Config tab's `EDITORS` row, column B: plain emails, no names, one per
line (Ctrl+Enter or Cmd+Enter starts a line inside a cell), or separated by
commas or semicolons. The format is spelled out, with an example, in the
`Instructions - Editors` row and in a note on the cell itself. Anything that
is not an email is left out, and the refresh names it in a toast.
installTriggers and Folio Assistant > Refresh now lock each `Ready for ...`
column to the owner plus those emails, under a protection the script owns
and rebuilds each time (other protections are left alone). An empty row
locks them to the owner alone, which is how every new sheet starts; a Config
with no `EDITORS` row leaves them as they are. Both templates carry the
Orange `EDITORS` row, empty. `EDITORS` is the one Config row a person keeps:
the agent writes it empty and keeps the sheet's value whenever it rewrites
the tab, and the emails never go into `sheet-sync.json`, which is committed.
To delegate who decides, the owner can add a delegate to the Config tab's
protection, or send the agent the list.

**The Instructions rows.** Every visible tab opens with an `Instructions`
row that says what that tab is for and how it works, in that tab's own
terms; `tabInstructions()` in the builder writes the text for each tab. On a
people's tab (RPC, RCS, Contributor Feedback) the row is frozen with the
header and grey like it, a lighter grey than the header. Its first line is
the colour key: `Column colours:` then one phrase per colour, in the order
Blue, Green, Orange, Grey, worded for the mode by `colourKey()` and naming
no colour (§"Sheet conventions"):

- Blue: input by people, named by their process role: the Feedback Review
  Committee in public-comment mode, the Authoring Committee in drafting mode;
- Green: the agent;
- Orange: an Editor (the `Ready for ...` columns);
- Grey: the script.

Then come the steps for that tab, one per line, naming columns, never
colours. On a change-set tab they are the human-to-agent workflow, worded by
process role: people write their feedback, the agent proposes, an Editor
sets Ready for agent, the agent opens one pull request for the row whose
`Staging review` opens the changes, new feedback marks the proposal stale,
a second reviewer checks the dispositions and the QA report, and an Editor
sets Ready for merge and the agent merges. On Review Public Comments the
steps say that decisions are made per change set. Last come the filter
views, and a link to the harness's page for the process the sheet runs:
`public-comment.html` for public comment and `contributor-feedback.html` for
drafting, under `en/cat-harness/processes/` on the folio-assistant site
(`processPage()`; `CFG.PROCESS` overrides it).

The first cell reads `Instructions`, and the text is one merged cell across
the rest of the row. The script reads any leading rows whose first cell
starts `Instructions` (or `Colour key`) as for people: the header is the row
after them, and every write, lock and edit range starts below the header.
Insert the row only after the sheet runs a Code.gs that knows it; an older
script reads the legend as the header and finds no columns. Filter views and
protections start at the header row, so shift them down by one row when the
row is inserted. A filter view's custom formula does not move when a column
is inserted, so rewrite it.

The Config tab keeps its Instructions short, one subject per row, so no row
is taller than the window: `Instructions` (the tab's purpose: nothing here
needs you unless you install the script), `Instructions - Install script`
(`setupSteps()`: copy Code.gs, Extensions > Apps Script, name the project
after the spreadsheet, paste and save, run installTriggers, allow it,
reload), on a drafting sheet `Instructions - Dropdown` (`dropdownSteps()`),
and `Instructions - Editors` (`editorSteps()`), then the `Key | Value`
header. Its rows are not frozen. The EDITORS row is Orange, like the Ready
columns it controls, because a person keeps it; the rows the agent writes
stay grey. The script reads Config keys by name, so it ignores these rows.

**A stale proposal hands control back to an Editor.** When a row's proposal
turns stale (a blue cell changed since the agent wrote it), the script sets
that row's `Ready for agent` from Yes to No, once, on the turn. The agent
does not act on the row until an Editor sets Yes again, which is the signal
to update the row's pull request. A Yes set while the row is still stale
stays.

**One row, one branch, one active pull request.** A change-set row keeps one
branch for its whole life, and at most one pull request is open on it. Every
later agent run pushes to that branch and updates that PR, so the row's
`Staging review` link stays the same. If the PR is closed and the committee
or contributors want the work back, the agent reopens it, or opens a new PR
on the same branch when it cannot be reopened. It never starts a second
branch for the row. Each earlier PR stays listed in the row's Agentic
status, one line per PR.

**Filter views.** Each template carries saved filter views, which copy with
it. Use Data > Filter views, never a plain filter: a plain filter changes
the view for everyone, a filter view only for whoever opens it. Each view is
named for who uses it and what it shows.

| sheet | view | who | shows |
|---|---|---|---|
| drafting: Contributor Feedback | Open | everyone | rows with a Title, Ready for merge not Yes |
| | Needs contributor feedback | contributors | rows with a Title and every Contributor Feedback column empty |
| | Waiting for editor (Ready for agent not Yes) | editors | rows with a Title, Ready for agent not Yes |
| | Merge decision due (PR open, not merged) | editors | Agentic status (filter) is PR open, Ready for merge not Yes |
| | Needs you (answer the agent's question) | editors, owner | Agentic status (filter) starts with "Needs you" |
| | Stale (agent proposal or staging out of date) | owner | the agent proposal starts with ⚠, or the staging link says stale |
| | Decided (Ready for merge Yes) | everyone | Ready for merge is Yes |
| | By agentic status (pick values) | everyone | every row; pick values in the Agentic status (filter) column's filter (a plain copy of the change set's Agent status) |
| public comment: Review Change Sets | Change sets: the same eight | as above | on its own columns; "Needs architect feedback" checks the three Committee Feedback (initials) columns |
| public comment: Review Public Comments | Comments: Open (no Disposition) | everyone | a No., Disposition empty |
| | Comments: No change set yet | review coordinator | a No., Change Set empty |
| | Comments: Needs architect feedback | the Feedback Review Committee | a No., every Committee Feedback (initials) column empty |
| | Comments: Decided (Disposition set) | everyone | Disposition filled |

The "needs feedback" and "stale" views use a custom formula that names
columns by letter, so a column move breaks them: after moving columns, the
agent checks each view's formula against the headers.

A filter view covers the rows the tab had when the view was made; when rows
are added past that, widen its range (Data > Filter views > the view >
Options > Update range).

**Keeping the section list current (agent).** The dropdown's list is the
hidden TOC tab, and the script writes it from `DATA.TOC` in the Config tab
on every refresh. So when the document's chapters or sections change (any PR
that changes `review-anchors.json`, the same moment `review:anchors` runs),
the agent rebuilds the Config rows (`--config review/drafting/sheet-sync.json
--out config-rows.json`) and writes them into each drafting sheet the folio
names, in the same change. Nobody edits the TOC tab by hand.

**How picks stay valid.** On each refresh the script repairs Selected
Sections before anything else:

| the pick | what the script does |
|---|---|
| a current section, with or without its indent (or a "└ " mark) | rewrites it to the dropdown's name, indent included |
| a section renamed or renumbered since it was picked | finds it by its anchor (the TOC tab's column C keeps the anchors of the names it offered before) and rewrites it to the new name |
| a section no longer in the document | keeps it, so nothing a person chose is lost, and adds a line in Section links: ⚠ "<name>" is not in the document now: pick its section again |

So "Invalid" after a document change clears by itself at the next refresh,
except for a section that was removed, which a person repicks.

**Change-set ids.** Any row a person has filled in gets the next `CS-nnn`
at the next refresh, whichever column they started in. A cell holding only
"No" (a Yes/No dropdown's default) and the script's own columns do not
count.

**Selected Sections shows "Invalid".** Three causes: a pick of a section
removed from the document (Section links flags it; pick again); a cell with
several sections where the rule does not allow multiple selections (tick it,
step 6); or a cell that carries links. Sections must be plain text, the
links belong in Section links: clear the cell's formatting (Format > Clear
formatting) and the script keeps it plain.

**Check it.** Folio Assistant > Refresh now. In drafting mode a filled-in row
gets a CS id and its picked sections appear, linked, in Section links;
in public-comment mode each No. becomes a link. An error names what is
missing: no Config tab, a Config row, or a tab the Config names.

| mode | template (owned by informatics.avengers) | make a copy |
|---|---|---|
| public-comment | Folio Assistant - Public Comment Review Template, `14PtLd2U_tBQV5OHoEEVRJK1EKfsbZEBPP_MIqo2E3o4` | https://docs.google.com/spreadsheets/d/14PtLd2U_tBQV5OHoEEVRJK1EKfsbZEBPP_MIqo2E3o4/copy |
| drafting | Folio Assistant - Contributor Template, `1PtcNJgLQIA1BjapU51pAQzqQjGylBHYNKlCPzZkwVag` | https://docs.google.com/spreadsheets/d/1PtcNJgLQIA1BjapU51pAQzqQjGylBHYNKlCPzZkwVag/copy |

A copy keeps tabs, colours, dropdowns and formulas. It does not keep
protected ranges (re-add them: Agent whole tab; the grey and green
columns), and its TOC tab is empty until the script's first refresh. A
document's own sheet is named in its `sheet-sync.json` as `sheet` (the
spreadsheet id), so the agent's sync knows where to read and write.
