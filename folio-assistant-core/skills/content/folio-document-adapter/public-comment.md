---
input: schemas/skills/public-comment/input.schema.json
output: schemas/skills/public-comment/output.schema.json
---

# public-comment

> Skill id: `public-comment` · Package: `folio-document-adapter` · Process:
> `folio-assistant-core/collab/processes/content/public-comment.bpmn`
> (`Process_PublicComment`), which calls its change phase
> `public-comment-change.bpmn` (`Process_PublicCommentChange`) · Tool: `folio-assistant-core/scripts/public-comment.ts`
> · Schema: `folio-assistant-core/schemas/public-comment.ts`.

Run a **public review** of a document folio. A frozen, line-numbered draft goes
out. Comments come back as spreadsheets, form exports, letters and GitHub
comments. Each comment is placed on the block it is about, triaged, weighed by
a review committee and decided by an editor. Where a decision changes the
document, the change lands on a feature branch whose staging preview shows the
text before and after.

## The one fact everything rests on: a comment cites the REVIEW VERSION

A reviewer writes "§3.4.5, p.22, l.618–624". Those numbers exist only in the
PDF the reviewer read. Word computes pages and lines at layout time and stores
neither. Once an editor changes the folio, the numbers no longer describe the
current text.

So the review version is frozen in the library, and the folio is extracted from
it in two halves:

1. `docx-structure.py` reads the **structure** from the .docx: headings, lists,
   tables, figures, footnotes, call-out boxes.
2. `pdf-line-map.py` reads the **page and line** of every item from the
   line-numbered PDF, by matching letters only. A miss is reported, never
   guessed.
3. `docx-to-folio.ts` writes the editable folio. Every block's `meta.source`
   records its page, printed page and lines. `review-anchors.json` is the same
   index in one file, which is what the importer reads.

**Never regenerate the folio over editors' work.** `docx-to-folio.ts` refuses
a non-empty folio without `--force`. The anchors keep resolving after edits,
because they point at the frozen version, not at the current text.

Read the alignment stats (`pdf-line-map.json` → `stats`) before trusting a
comment's anchor. The `unaligned` items are listed by method, not hidden.

## Intake: one store, four routes, nothing dropped

The channels a release goes out on (an offline Excel sheet, a Google Form, a
GitHub issue form), each limited to the release's fixed references, and the
path each one takes back to these routes, are the
[`public-comment-channels`](public-comment-channels.md) skill's.

| route | command | anchor comes from |
|---|---|---|
| comment matrix (.xlsx) | `import <file>` | section, page, line or Table/Figure columns |
| online-form export (.csv) | `import <file> --channel online-form` | the same columns, per row |
| narrative letter or email | `import-narrative <file> --reviewer …` | section, page/line, table or quotation in each paragraph |
| committee or editor on GitHub | the `github` job, from an issue or PR comment | the `pc:` reference |

### A consolidated review log

A secretariat often keeps one workbook for the whole review: a master log, a
tab per large submission, and a contributors sheet. `import` reads **every**
sheet that holds a comment table, records the sheet on each comment, and
passes over a blank template tab. Pass `--series <id>` naming the log. A copy
re-sent later is a different file holding the same rows, and each comment
carries the log's own row number ("No."), so a re-import adds only the rows
it has not seen.

What the log already says is carried, not re-done:

- **Status.** "Accepted", "Partially accepted", "Not accepted", "Noted" and
  "Deferred" arrive *decided*, with the log's disposition as the reason and
  `review-log` as who recorded it. "Reviewed" arrives *triaged*. A refusal
  with no rationale arrives triaged and is listed as held, because the
  commenter is owed a reason.
- **Categorisations.** Theme, stakeholder type, committee routing, a review
  question or priority ("Q9 - Conformance and testing", "P1") are kept in
  `labels`, verbatim and keyed by the column header. The three comment types
  stay `type`.
- **Consent.** Read from the contributors sheet by name, and only the name
  and consent columns are read. "NAIR, Tapas" and "Tapas Nair" are one
  person.

Rules that are not negotiable:

- **A row that resolves to nothing is `unplaced`, not dropped.** Triage places
  it (`triage <ref> --to <label>`) or leaves it as a general comment.
- **A narrative is split only where it cites something.** Paragraphs that cite
  nothing stay together as ONE general comment. Inventing an anchor for them
  would put a reviewer's words on a paragraph they never mentioned.
- **Re-importing a file is a no-op.** Batches are keyed by sha256.
- **Privacy.** The reviewer's email is never written, and an address typed
  into a comment's text is removed too. Their name is written
  only when they answered the acknowledgement question "Yes". Keep the
  original spreadsheets OUT of the folio's repository, because they hold
  emails. Record the batch, and keep the file in the review owner's private
  store.

### The live review sheet: public comments, change-sets and feedback

A secretariat may keep working in the log after the import, as a shared Google
Sheet. The master log is then split into tabs,
joined by the log's own row number, **No.** Exactly one tab is written by the
agent. Every other agent-facing column is a formula over it, so the views stay
current without anyone, person or agent, refreshing them.

**The model.** There are two things to review:
**public comments (PCs)** and **change-sets (CSs)**. A PC brings its own
`Comment / issue` and `Suggested revision`, which are the commenter's words.
Reviewers give feedback on either one, in **Committee Feedback (initials)**
columns: on a PC in Review Public Comments, and on a CS in Review Change Sets.
A reviewer may also change which working group (TWG) a CS goes to. "Ready for
agent" and "Ready for merge" belong to a CS, so they are only on Review Change
Sets.

Columns are named here by header, never by letter: people move them.

| tab | who writes it | holds |
|---|---|---|
| **Public Comment Source** | intake, copied from what each channel returned (locked) | Every column Grey, header and cells: it is the external source, copied mechanically, and nobody edits it. No., date received, channel, reviewer name, organisation, country / region, stakeholder type. Reviewers' names and emails stay here and never enter the repository |
| **Review Public Comments** | people, plus formulas and the Apps Script | one row per PC. Grey, mechanical: No. (a link to the comment's page), Sections, Page, Line no(s) / Table / Figure (each linked to the draft page), Comment / issue, the PC's own Suggested revision. Green, derived: Change Set (a link to its Review Change Sets row: the agent's suggestion, or the person's Change Set (human)) and TWG (agent). Blue, people: **Change Set (human)** (another change set's id, several ids, or `new`; wins over the agent's, like TWG (human)), TWG (human) (a multi-select dropdown), Comment type, any number of `Committee Feedback (<initials>)` columns, Disposition, Status. Green, from Agent by the Apps Script (derived agentic content): **Agentic status**, one line per pull request of the PC's change-sets, `<repo>#n (status, completed) · what it changed` (the repository in the link text, because Sheets' link popup cuts the URL short) with the PR linked and the status and completion time bold, or the status alone when there is no PR. Green, from Agent: Staging review page (by the PC's change-set) |
| **Agent - Comments** | **the agent, and only the agent** | one row per No.: No., Comment ref (the PC id), Agentic status, Agentic action taken, Agentic applied in, Agentic handled by, Agentic date actioned (a UTC time, `YYYY-MM-DD HH:MMZ`, when the agent last finished work on the PC; the four Agentic columns after the status are the agent's log of what it did on that PC; no view reads them), Change-sets (the change set or sets this comment belongs to) |
| **Agent - Change Sets** | **the agent, and only the agent** | one row per change-set: Change-set, Title, **Pull request (change set)** (any number of PR URLs, one per line), **Staging review page (change set)**, **What the PRs changed (change set)** (one line per PR, in the same order: what that PR changes in the document), **Agent completed (UTC, change set)** (one line per PR, in the same order: when the agent last finished work on it, `YYYY-MM-DD HH:MMZ`), Feedback basis (change set), Staging built (UTC, change set), **PR head (change set)**, **Staging built from (change set)**, **Staging deploy (change set)** (what the agent found on GitHub, so the script can flag a stale preview; skill `review-sheet-script`, "Checked by commit"). A change-set may have several PRs, and a PC in several change-sets shows all of theirs. A PR belongs to a change-set, not to a PC. A sheet with one `Agent` tab (comments in A–H, change sets from I) is read when the Config sets `AGENT_CS` empty |
| **Review Change Sets** | people, plus formulas and the Apps Script | one row per CS. Blue, people: **Title**: making a change set is human-controlled. A person makes a change set by typing a Title on an empty row, and the script gives it the next id; the agent's title is only the first value of a row it adds. Grey: Change-set, and the Apps Script's Sections and Pages (each linked) and joins: Public Comments (`No. n (Status) · comment`, status in bold), Suggested Revisions, PC Committee Feedback and Dispositions (`No. n · text`), each `No. n` linking to its row. Green: TWG (PCs), the PCs' TWG (human), else TWG (agent) marked "(AI)". Blue, people: TWG (CS) (multi-select), `Committee Feedback (<initials>)` on the CS. Orange: **Ready for agent** and **Ready for merge** (Yes/No, editors). Green, from Agent by the Apps Script (derived agentic content): **Agentic status**, as on Review Public Comments: one line per PR of the change-set, `<repo>#n (status, completed) · what it changed`, the status being the change-set's PCs' agentic statuses. Green, from Agent: Staging review page |
| **RCS joins (live)** | formulas (hidden) | live joins over Review Public Comments and Agent, kept for checking the Apps Script's output |

**Splitting an older sheet's one Agent tab.** Duplicate it, delete A–H on the
copy and the change-set columns on the original, rename them, set `AGENT` and
`AGENT_CS` in the Config, and give each an Instructions row. Then, in the same
step, repoint every formula that read the old tab's change-set columns: they
become `#REF!` when those columns are deleted. They are Review Change Sets A3 (`FILTER('Agent - Change Sets'!A3:B, ...)`, the
Change-set and Title), the Staging review column of Review Public Comments
(its lookup range becomes `'Agent - Change Sets'!A:D`), and A2 of the hidden
`RCS joins (live)` tab. Also unmerge row 1 on the copy: the Instructions cell
was merged across B1 to the last column, so deleting A–H shifts that merge
onto A1 and hides B1 (a write to B1 then lands in the hidden part and seems to
vanish). Merge B1 across the new width again. Read row 3 of each tab for
`#REF!` before saying it is done.

**Colour key.** Blue: people decide. Orange: a release
an editor gives (Ready for agent, Ready for merge). Grey: fixed, mechanical,
or from the knowledge graph. Green: derived or written by the agent. Every
green header is the same green; a header does not say "from Agent".

**Locks.** Grey and green columns, and every header, are
protected; only the owner's account (which the agent's connector and the
Apps Script run as) may edit them. Editors may change the blue and orange
cells. Ready for merge is open to editors, so an
editor's Yes makes the agent merge.

**Why the CS inputs stay with their rows.** Review Change Sets' Change-set
and Title are plain values, so people can type a Title and start rows (where
they are still a spill of `FILTER('Agent - Change Sets'!A3:B, ...)`, the script
turns it into values once). The script keeps the rows: a Title-only row gets
the next id, never reused across both tabs, and a change set the agent records
that is not on the tab yet is added at the end. Rows are never reordered or
deleted, so the typed cells beside them stay put. Once per sheet, the script
also turns Title and Change Set (human) Blue and takes them out of the locks
on the agent's columns. A sorted or filtered view of PCs cannot hold inputs.

**Feedback columns are found by header.** The agent and the views read
**every** Review Public Comments column whose header starts with `Suggested
revision` or `Committee Feedback`, and every Review Change Sets column whose
header starts with `Committee Feedback`. A board adds its column beside the
others and puts its own initials in the header. Never write a fixed column
letter into a view. People may reorder the Review Public Comments tab, because
Review Change Sets finds columns by name (`MATCH` on the first row). A renamed
header that is looked up by name (No., Sections, Page, Comment / issue,
Suggested revision, Status, Disposition, TWG (agent), TWG (human)) does break
the view, and its formula, or the Apps Script's `sheet-sync.json`, must be
updated with the new name.

**How the views update.** The formula columns are `FILTER`, `VLOOKUP`,
`BYROW` and `MAKEARRAY` over Review Public Comments and Agent. Setting Ready for
agent, adding feedback, or the agent writing an Agent row shows at once.
Nothing is run to refresh them. Two things are not automatic:

- **A new or retitled change-set** reaches the sheet only when the agent
  rewrites Agent - Change Sets' Change-set and Title from
  `review/public-comment/changesets/`.
- **A PC's change-set** (Agent - Comments' Change-sets) is the change-set
  whose `refs` hold the comment. The agent rewrites it when a comment is moved between change-sets.

**What the agent watches.** Feedback arrives two ways, and the agent reads
both on Review Public Comments and Review Change Sets:

- the Committee Feedback cells and Review Change Sets' TWG categorisation;
- **cell comments** (Google's Insert > Comment) anywhere on those two tabs,
  read with the spreadsheet's comments included. A cell comment on a PC row is
  feedback on that PC. One on a CS row is feedback on that CS.

A changed TWG categorisation on a CS is a re-routing, not an edit. The agent
records it in the change-set's record through the tool, and says so in the
CS's agentic status.

**When the agent runs.** A *sheet sync* runs three ways:

- **Scheduled.** A scheduled task in the project runs it (for example,
  every 2 hours on weekdays). Each run is a fresh thread with no memory of
  earlier ones, so everything it needs is in the sheet, the records and this section.
- **Manual.** Anyone asks for it ("sync the sheet", "work the ready rows") in
  a project thread, or presses *Run now* on the scheduled task. A thread may
  also fire the scheduled task itself.
- **Active mode.** On demand only, and it lasts **two hours**. The
  owner asks for it in a project thread ("active mode on"). That thread then checks the sheet about every ten minutes, waking itself
  with reminders rather than a loop. It compares Review Change Sets' Ready
  for agent, the feedback columns and the cell comments with what it saw last,
  and runs a sheet sync, or fires the scheduled task, when something changed.
  Two hours after it was switched on, it stops and says so in one line. The
  regular schedule keeps running throughout. A sheet edit cannot wake an
  agent by itself, so active mode is frequent checking, not a push.

Each sync does the steps below, in this order.

1. **Reconcile.** For every change-set with a pull request (Agent - Change
   Sets' Pull request), read each PR's state from GitHub. Open: *PR open*, with its staging review page. Merged:
   *Change merged*, and clear the staging link, because a merged branch's
   preview is gone and its link 404s. Closed unmerged: back to *Not
   started*, and say so in "agentic action taken". Write the status on every
   PC row of the change-set. Rewrite the change-set columns from the
   change-set records as above, keeping each change-set's row and the PR
   columns beside it.
2. **Work the ready change-sets.** For each Review Change Sets row with **Ready
   for agent = Yes** whose PCs' agentic status is *Not started* or *Needs
   human*, or that has new feedback since its PR was opened:
   1. Find each PC by No.: the record whose `public.source` names the
      log's sheet and that `entry`. A row with no record is set to *Not in
      comment record*, and the agent goes no further with it.
   2. **Review all of it before drafting**: every PC in
      the change-set, with its Comment / issue and its own Suggested revision;
      every Committee Feedback cell and cell comment on those PCs; and every
      Committee Feedback cell, cell comment and the TWG categorisation on the
      CS itself. Feedback on the CS weighs on the whole change; feedback on a
      PC weighs on that PC's part of it.
   3. Propose the change the way every change is proposed: in its change-set
      (see **Change-sets** below), on a branch, with a PR. A PR already open
      for the change-set is updated rather than replaced. "Ready for agent"
      says the change-set is ready to draft. It is not the editor's decision,
      and a comment's status still moves only through this tool. Where the
      suggestions and feedback conflict, or one asks for something the
      document cannot say without a decision, set *Needs human* and write
      what is needed in "agentic action taken".
   4. Publish the branch's staging preview (`branches/<slug>/`).
   5. Write the Agent rows (skill
      [`review-sheet-agent-columns`](review-sheet-agent-columns.md), which
      applies to any work on a change set, in a sync or not), and nothing
      anywhere else in the sheet: status
      (*Working*, *PR open*, *Ready for review*, *Change merged*), what was
      done, the blocks or sections changed, who acted (the agent and its
      session) and the completion time (UTC, `YYYY-MM-DD HH:MMZ`) on each
      PC's row; and on the change-set's row the PR and
      `branches/<slug>/en/review/` (Pull request, Staging review page), one
      line saying what the PR changes in the document (What the PRs changed)
      and the completion time (Agent completed), each on the same line as its
      PR's URL. The PR body names the feedback it answered by tab, row and column header,
      never by a reviewer's name.

3. **Merge the released PRs.** For each change-set with an open PR whose
   Review Change Sets row has **Ready for merge = Yes** (any editor may set
   it), and whose **QA gate** has passed for the PR's head commit, merge it.
   The gate is run by a reviewer that did not write the PR
   (`review-sheet-script`, "The QA gate"); without a pass for the current
   head, the agent does not merge and its ⏳ line says why. Nor does it merge
   while any comment's committee Disposition is still Pending
   (`review-sheet-script`, "Unconfirmed dispositions block the merge"). Only
   a PR in the folio's own repository is merged, never one on a WHO
   repository. After the merge, set every PC row of the change-set to *Change
   merged*, clear its staging link, and comment on the PR's issue. If the merge is refused (a session safety check, a conflict, a
   required review), set the rows to *Merge blocked*, write why in "agentic
   action taken", and say so in the run's summary. Do not route around a
   refusal.

**Which PR counts.** Only a PR that edits the document for the change-set. A
change-set record's `pr` can name the PR that *proposed* the change-set, long
merged. That is not a change PR. Read the PR's diff or body before writing it to a row. The
dashboard draws a staging link only for a PR that is open now, for the same
reason (`openPullRequests` in `scripts/public-comment-site.ts`).

**Page links.** Every page, section and line reference in the sheet opens the
frozen review version at that page. The log cites printed page numbers; the
PDF page is the printed page plus the front matter, read from the library
entry's `pdf-line-map.json` (`pages.<pdf page>.printed`). Use a short link: the folio's site publishes a
`draft/` redirect to its library viewer, so a link is `<site>/draft/#page=<n>`
rather than the full `assets/vendor/pdfjs/web/viewer.html?src=…` address, and
a cell with many links stays small.

### The review sheet's Apps Script

Links inside a cell's text (sections, pages, lines, each `No. n` in a joined
column) are kept by a Google Apps Script bound to the sheet, built by the Tool
`review-sheet-sync`. How to build it, install it, check it works, and reuse it
for another document's public comment is the
[`review-sheet-script`](review-sheet-script.md) skill.

A change-set that already has an agent PR has **Ready for agent = Yes**, so
the sheet never shows agent work nobody released.

The agent never writes the Review Public Comments, Public Comment Source or
Review Change Sets tabs except on the owner's explicit instruction (such as
releasing a change-set as above). It never sets "Ready for agent" or "Ready
for merge" on its own, and it never copies a reviewer's name or email from
Public Comment Source, a feedback header or a cell comment's author into the
repository. The sheet is reached through the session's Google Sheets
connector. No credential for it is
committed. Google cannot stop the owner's own account editing any tab, so the
one-writer rule is kept by the agent, not enforced by the sheet.

Two exceptions are the review log's own tools (skill
[`review-sheet-script`](review-sheet-script.md)):
- **Archiving the log.** Every night the log is copied to
  `review/public-comment/logs/<log-id>.xlsx` beside its `review-log/1.0.0`
  node. The workbook is overwritten, git keeps the history, and no contact
  details are copied.
- **Importing offline feedback.** An offline copy, or the feedback template
  returned with the line-numbered PDF, is imported only after it is checked
  against the template and a person picks the rows. Then only those rows'
  human cells are written. The person's pick is the owner's instruction for
  those cells. Imported comment and change-set numbers are hints, never keys.

### Editorial change-sets may be drafted without waiting

A change-set is **editorial** when it changes only wording, numbering,
cross-references, typos or house style, and no meaning: nothing a TWG or
committee has to judge. The agent may draft an editorial change-set as a
**draft PR with a staging preview** without waiting for Ready for agent.
It records each step in the Agent tab as usual
(`review-sheet-agent-columns`), with "editorial draft" in its status.

- It still never sets **Ready for merge**, and nothing merges without it.
- A change-set that mixes editorial and substantive asks is split: the agent
  drafts the editorial part, and the substantive part (a new definition, new
  guidance, a rewrite) goes to *Needs human*.
- A house-style choice the document has not made yet (a spelling convention,
  say) is asked once with options, then followed; it is not guessed.
- When unsure whether a change is editorial, it is not: wait for Ready for agent.

## Placing a comment: how much to trust the anchor

`anchor.method` says how the place was found, and `confidence` says how far to
trust it:

- `caption` (high): "Table 3.1" named a captioned block.
- `page` (medium or low): a page with no usable line. A lines cell such as
  "Requirement 5" or "A14.01" names an item, not a line, so it is not read
  as one. Lands on the page's first block in the cited section.
- `page-line` (high, when the cited section agrees): the page is read as the
  **printed** page first, then as the PDF page index. Printed numbering restarts
  in the front matter, so the cited section breaks ties. "Section does NOT
  agree" in `anchor.note` is a triage signal. Check the comment.
- `quote` (medium or low): a quotation found in the text. Low means it occurs
  more than once. The other places are in `candidates`.
- `section` (medium): only the section resolved, by its number or by its
  title or acronym ("PHSP" is the Public Health Surveillance Platform). The
  anchor is the section label.
- `manual`: a person placed it with `reassign`.

## The lifecycle, and who moves it

`received → triaged → assigned → recommended → decided → editing → incorporated`, plus
`duplicate` and `withdrawn`. Every move is a task in `public-comment.bpmn` or,
for `edit` and `incorporate`, in its change phase `public-comment-change.bpmn`.
`transition()` refuses any other move. Do not edit a comment's `status` by
hand: the dashboard counts statuses, and a hand-closed comment reads as
adjudicated when no one decided it.

| who (role) | does | how |
|---|---|---|
| intake agent (`intake`) | propose change-sets as records, with no issue ([below](#the-agent-proposes-nobody-is-notified)) | `public-comment-changesets.ts seed`, `propose` |
| review coordinator (`review-coordinator`) | triage, place, mark duplicates, assign | `triage`, `reassign`, `duplicate`, `assign` |
| committee and editor | agree each change-set's requirements, and change it, on its issue | the issue thread, and `cs-*` commands |
| committee member (`reviewer`) | recommend a decision, with a rationale | a GitHub comment `pc: PC-0042` / `recommend: accepted-modified`, or `recommend` |
| editor (`editor`) | decide, with a reason unless accepted | `decide: …` on GitHub (editors only) or `decide` |
| author (`author`), human or agentic | once a comment is dispensed with a changing decision, make the edit on a feature branch | `edit <ref> --branch … [--to <login>]` |
| pipeline (`build-pipeline`) | build the change set's staging preview, mark it incorporated on merge | staging workflow, `incorporate` |

Who can move a comment from GitHub. Both roles are read from the repository
itself by default, so nobody maintains a list:

- **Editor: the repository's owner.** Only the editor decides.
- **Committee: the repository's collaborators** (owner, member or
  collaborator). Adding someone as a collaborator on GitHub is the whole
  on-boarding.

GitHub marks every comment with the commenter's relationship to the
repository, and that mark is what is checked. An `editors` or `committee` list
in `config.json` replaces that role's default with exactly those logins.
Anyone may *discuss* a comment there, but the record is not open to everyone.

The five decision codes: `accepted`, `accepted-modified`,
`not-accepted`, `noted`, `deferred`. Every code but `accepted` needs a reason,
because the commenter is owed one.

## Change-sets: an issue to agree it, a PR to approve it

One editorial change often answers several comments, and one comment sometimes
needs several changes. So a comment belongs to **zero or more change-sets**, and
a change-set is discussed and made in two GitHub objects with different jobs:

| object | what people do there |
|---|---|
| **the change-set's ISSUE** | discuss and agree the *requirements*: what the document should say, which comments the change answers |
| **the PR that closes it** | preview the change on staging, review it, approve the merge to `main` |

Requirements argued on a PR get lost when it is closed and reopened; a diff
argued on an issue has nothing to point at. Keep each on its own object.

### One record, everything else rendered from it

`review/public-comment/changesets/CS-012.json` is the **only** record of a
change-set: title, requirements, members, status, primary issue, every other
issue that discusses it, its PR, and its history. Nothing else stores any of
that:

- a comment's change-sets are **derived** from the records, never written on
  the comment;
- the change-set section at the top of its issue is **rendered** from the
  record, and a hand-edit to it is put back with a pointer to the commands;
- the dashboard is built from the records. It is published per document at
  `<site>/en/folio-assistant-core/public-comments/<folio>/<slug>/`, the handler
  route every viewer follows (`<base>/<handler>/<kind>/<subject>`, the subject
  being the materialised document's path in the folio) under the page locale,
  with its `comments.json` at the same route without the locale.
  `public-comment-route.ts` is
  the one place that says so: the site, the change-set issues and the
  rendered-impact predictor all ask it.

The folio's `public-comment.yml` workflow is the **only writer**, one run at a
time, never cancelled half-way. People and agents ask; it writes. Two gates
keep it honest: `public-comment-changesets.ts check` fails a PR whose records
contradict each other (no network), and the nightly `reconcile` re-renders every
issue from its record, opens or closes it as its status says, and opens the
issue a change-set decided outside GitHub is owed. It reports and never deletes.

### The agent proposes; nobody is notified

`Task_ProposeChangeSets` (intake agent). An agent may draft **every**
change-set, and drafting one opens nothing: a proposal has no issue, so
2,000 comments do not become 300 notifications nobody asked for.

1. `seed --out seed.json` lists the open or decided comments in no change-set
   yet, bucketed by section. **A bucket is not a change-set.** One section's
   comments usually ask for several different changes, and one change (a term
   used throughout, say) spans sections.
2. Decide the changes. One change-set is **one change a reviewer can approve or
   refuse as a whole**. Good signs: the comments ask for the same edit, or for
   edits that must land together. Bad signs: the title needs "and", or the
   requirements list unrelated edits. Cross-cutting themes (consent, a
   terminology standard, normative keywords) are ONE change-set touching
   several sections, not one per section: when several agents draft in
   parallel by section, run a merge pass over their drafts before recording.
3. Write requirements as what the text must do ("define *actor* once, in 2.1,
   and use it consistently"), not as the new text: the text is the PR's job.
4. `propose --file proposals.json` records them (`[{title, requirements,
   refs, anchor?}]`), or `add` one at a time. Status: *proposed*.

A comment the agent cannot place is left out, not forced in. It shows on the
dashboard's *open, in no change-set* tile.

### The issue appears when somebody engages

`Task_GroupChangeSets`. A change-set gets its **primary issue** the first time
anybody engages with it:

| what somebody does | what the workflow does |
|---|---|
| presses **Discuss** on the dashboard (the `change-set` issue form, prefilled with the id) | adopts that issue as the primary one and renders the record at its top; their text stays below |
| recommends or decides on one of its comments, in any thread | records it, opens the primary issue, and quotes the tag there with a link back |
| mentions it, or one of its comments, in any issue | links that issue, and opens the primary issue (at most five from one mention; past that it replies with Discuss links instead) |
| opens a PR that links it by keyword (`Closes CS-012`, `fixes`/`resolves CS-012`, or a `cs: CS-012` line) or closes one of its issues | records the PR, opens the primary issue if there is none, when the PR's author is on the committee or an editor (judged as for tags; a PR by anyone else links nothing, and a merge counts whoever wrote it). A bare mention of `CS-012` in prose links nothing, and a change-set already *incorporated* or *closed* is never re-linked to another PR: reopen its issue first |
| decides through the CLI | nothing at once; the nightly reconcile opens the issue |

**People are disorganised, and that is fine.** Any number of other issues may
discuss a change-set: each is linked (the record's `issues`), listed under
*Also discussed in* on the primary issue, and told where the primary one is.
Nobody's own issue is rewritten, and a tag recorded in a linked issue counts
exactly as one in the primary. An issue body is judged as its author's: an
edit to it by anyone else records nothing, so tags and commands go in a comment.

### Changing a change-set on its issue

In a comment, from the committee or the editor. Anyone else's command is
answered with why it changed nothing.

| command | effect |
|---|---|
| `cs-add: PC-0311, PC-0312` | add comments |
| `cs-remove: PC-0107` | remove a comment |
| `cs-title: …` | rename |
| `cs-requirements:` then the text on the following lines | replace the requirements |
| `cs-committee: <TWG> — <reason>` | re-route the change-set to another TWG review committee, with a reason (`Task_RerouteChangeSet`, person-only; also `reroute <CS-012> --to <TWG> --why "reason" --by <login>`) |
| `cs-merge: CS-087` | fold CS-087 in; its issue is linked, and closed with a pointer (or adopted, if this one had none) |
| `cs-split: PC-0311, PC-0312 as New title` | move those comments into a new change-set, which gets its own issue |
| `cs-close: reason` | no change is needed |
| `cs-new: Title` with a `pc:` line | a new change-set (the dashboard's *New change-set from the selected comments* opens the form for it) |

A change-set's committee is rolled up from its comments' TWG routing unless a
person in the committee or editor lane re-routes it by hand
(`cs-committee: <TWG> — <reason>` or `public-comment-changesets.ts reroute`). Each move is
recorded on the change-set (`who`, `when`, `from`, `to`, `why`) so re-ingesting
comments never resets it, and the dashboard shows the new committee and the move
history. Agents cannot re-route a change-set on their own (`Task_RerouteChangeSet`
is a `userTask` in `public-comment.bpmn`).

`cs: CS-012` names the change-set where a thread discusses several. In a
change-set's issue a bare `decide: accepted` (or `recommend: …`) applies to all
its comments; `pc: PC-0042` first narrows it.

Closing a primary issue by hand while its comments still need a change reopens
it, with the list. Closing it when every comment is decided without a change
closes the change-set. Reopening a primary issue puts its change-set back to
`discussing`, whether it was `closed` or `incorporated`: a person reopening it
is saying it is not done. `reopen <CS-012> --note "why"` makes the same move
when the reopen event has already been handled.

### The issue forms

`public-comment-changesets.ts install` writes three forms and the two
workflows into the folio's `.github/`, from this layer's `templates/public-comment/`.
A form renders as `### Label` and the value, and the tool reads it as the same
lines a person would type, so there is one parser for both:

| form | for | reads as |
|---|---|---|
| **Discuss a change-set** (`change-set.yml`) | the dashboard's Discuss link | `cs: CS-012` and the discussion |
| **New change-set** (`change-set-new.yml`) | the dashboard's picks | `cs-new: Title`, `pc: …`, `cs-requirements:` |
| **Recommend or decide** (`comment-decision.yml`) | a person who would rather not type a tag | `pc:` / `cs:`, `recommend:` or `decide:`, the reason |

Blank issues stay enabled: a person who ignores the forms is still linked by
what they mention.

### The PR

1. Branch from `main`, named for the change. Open the PR at the first commit
   (`continual-progress` (opt-in `cat-harness.sdlc`)),
   with `Closes #<the primary issue>` (or any of its issues, or
   `Closes CS-012`, or a `cs: CS-012` line) in its body. Only those keywords
   link: a PR that mentions the id in passing, a pin bump say, does not.
   The PR's author must be on the committee or an editor, judged by the
   author's own login and association as tags are; merging it is allowed
   whoever wrote it.
2. Opening it moves the change-set to *editing* and its **accepted** comments
   to *editing*, with the branch and PR. Comments not yet decided, or decided
   `not-accepted`/`noted`/`deferred`, do not move.
3. Edit the folio's blocks. An agent in the `author` role edits only what the
   decisions and the issue's requirements say. Before the preview is staged,
   it writes the change set's **Disposition (change set)** on the review
   sheet's Agent tab, below the change set's decision history (which is only
   ever added to): one blurb describing every disposition in the change
   set, one line per comment (`No. 136: Accepted. <what was done>`, after an
   optional `Overall:` line), starting from each comment's Blue Disposition
   on Review Public Comments; the review sheet checks that every comment
   number in the change set has one (`review-sheet-script`). Before Ready
   for merge, an independent reviewer runs the QA gate: every disposition
   against the people's Blue Disposition and the PR's diff, and the staging
   QA report (`review-sheet-script`, "The QA gate"). Once an Editor sets
   Ready for merge to Yes, that blurb is the summary: in the merge commit and
   as the closing comment on the change set's issue.
4. The staging preview is published to `branches/<branch>/`. The dashboard links
   each comment's anchor on `main` (before) and on the preview (after). See
   `staging-review`.
5. Merging moves the accepted comments to *incorporated*. The change-set is
   *incorporated*, and its primary issue closed, only when **every** comment in
   it is settled (decided, incorporated, duplicate or withdrawn). If any is
   still undecided, the change-set stays open and so does its issue, and the
   workflow log says how many are left. A PR closed without merging
   puts the change-set back to *discussing*.

## The dashboard's filters

Status, Type, Section, Search and the count tiles filter **both** tables: the
comments, and the change-sets above them. A change-set shows when any of its
comments match, and its count then reads "10 of 18".

- **Show its comments** clears every other filter and shows all of that
  change-set's comments. Any later Status, Type, Section or tile choice
  replaces it; the search box narrows within it.
- **Every filter change is a history entry**, with the filters in the query
  string (`?status=open&section=1.1.3`). Back restores the previous view, and
  the URL of a filtered view can be pasted into an issue or a chat.
- **Closed** in the Status box means incorporated, duplicate or withdrawn; the
  page says so above the tiles.

This is the same review loop as any content change
(`content-change-review.bpmn`), with a different intake. Reuse it rather than
building a parallel review.

## Change-sets beyond public comment

The change-set is the Change Set for ANY change to a folio: one that answers no comment has empty `refs`. It applies to
the materialised `folio/`, never to the `library/` source it was materialised
from. Its PR carries `rendered`, one list per renderer of the rendered files
the change alters, and review approves against those lists (skill
`rendered-impact`).

## What not to do

- Do not answer a comment by editing the review version in `library/`. It is
  frozen, and every anchor depends on it.
- Do not re-anchor by renaming a block. Labels are the anchors. A block that
  is split or merged records its old label in `renamedFrom`.
- Do not put a decision in a commit message only. The comment record is the
  record. A commit is evidence.
