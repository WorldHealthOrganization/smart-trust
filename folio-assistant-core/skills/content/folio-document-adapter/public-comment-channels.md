---
name: public-comment-channels
description: >
  Set up the channels a public-comment release goes out on (an offline Excel
  sheet, a Google Form, a GitHub issue form, and the review sheet), each
  limited to the release's fixed references, with the editor's instructions
  and the announcement, and bring every channel back in through one intake
  path that ends in agent triage into thematic change-sets. Use when a draft
  is released for public comment, when a channel is added to a running
  review, or when returned comments arrive from any channel.
---

# Public comment channels and intake

> Process: `folio-assistant-core/collab/processes/content/public-comment-release.bpmn`
> (`Process_PublicCommentRelease`): Task_SetUpChannels and
> Task_WriteAnnouncement. Intake lands in `public-comment.bpmn`
> (`Process_PublicComment`): StartEvent_CommentsReturned, then Task_Ingest,
> Task_Triage and Task_ProposeChangeSets. Tool:
> `folio-assistant-core/scripts/public-comment-channels.ts`. The comment
> store, the importer and change-sets are the [`public-comment`](public-comment.md)
> skill's. The review sheet's script is [`review-sheet-script`](review-sheet-script.md).

A public-comment release is a frozen, line-numbered draft with an id, for
example "Draft for Public Comment Release v0.9" (`dpi-h-pc-v0.9`). Every
comment cites that draft, and nothing else, so **every channel offers only the
release's own references**: its numbered sections, its printed pages, and its
captioned tables and figures. A channel that lets a reviewer type any section
number brings back comments that cannot be placed.

## 1. The release's fixed references

Once the release is built (Task_BuildPcRelease), make the one list every
channel is generated from:

```sh
bun run folio-assistant-core/scripts/public-comment-channels.ts refs folio/<document>/review-anchors.json \
  --release <release id> --title "<release title>" --draft-url <the release's draft link> \
  --out review/public-comment/release-references.json
```

`release-references.json` holds the release id and title, the sha256 of the
frozen PDF and .docx, and three lists: sections as a reader cites them
("3.4.5 Governance", "Appendix C: Glossary"), printed pages in reading order,
and table and figure captions. Commit it beside the comment store. It does
not change while the release is open. A new release gets a new file and new
channels.

## 2. The editor sets up the channels, before anything is announced

The editor chooses which channels the review uses, and sets every one of them
up **before** the announcement goes out, so the instructions can link to each
one. Each is generated from `release-references.json`. Nobody edits a list by
hand.

| channel | make it | what the reviewer sees | limited to the release by |
|---|---|---|---|
| **Offline Excel sheet** | `… xlsx release-references.json --out <release id>-comments.xlsx` | Instructions, a Comments tab (their details at the top, one row per comment), a locked References tab | drop-down lists on Section, Page and Comment type that refuse anything else; the Release row |
| **Google Form** | `… google-form release-references.json --out CreatePublicCommentForm.gs`, paste into Apps Script, run `createPublicCommentForm` | "About you", then one comment per response, with *Submit another response* | list questions for Section and Page; the release in the title |
| **GitHub issue form** | `… issue-form release-references.json --out .github/ISSUE_TEMPLATE/public-comment.yml` in the folio's repository | one issue per comment, titled `[<release id>] …`, labelled `public-comment` | drop-downs for Section, Page and Comment type; the title prefix |
| **Review sheet** (committee, not the public) | the [`review-sheet-script`](review-sheet-script.md) skill, from the release's template | Review Public Comments and Review Change Sets | the script's Sections, Pages and Lines links, built from the same review anchors |

Line numbers stay free text in every channel: a line range or "Table 3.1" is
one field, and a list of every line would be useless. The importer resolves
them against the frozen draft and reports a miss.

**The editor's set-up checklist.** Done in this order, and every link is
recorded for the announcement:

1. The release is published: the line-numbered PDF and the comment-period
   site (its address says it is the public comment release, not `branches/`, and
   it is kept, not deleted on merge to `main`). Record both links.
2. `release-references.json` is made and committed.
3. Each chosen channel is made from it, as above. Record each channel's link:
   the Excel sheet's download link, the Form's published link, the issue form's
   `…/issues/new?template=public-comment.yml` link.
4. The review sheet is copied from its template, its Config set for this
   release, and an agent is asked to watch it (skill `review-sheet-script`).
5. Each channel is tried once by someone other than the editor: one comment
   in, then the `check` below run on what came back. Delete the trial comment.
6. The submitter records are ready (§4). The announcement is written last.

## 3. The announcement (Task_WriteAnnouncement)

A short communication for the public. It names the release, says what is
asked and by when, and links to everything. Keep the process description to
a few sentences and link to the published process for the rest.

```text
Subject: Public comment: <document title>, <release title>

<Organisation> invites comments on <document title>, <release title>, from
<open date> to <close date>.

Read the draft (line-numbered PDF): <PDF link>
Read it online: <comment-period site link>

Comment in whichever way suits you:
- Online form: <Google Form link>
- Offline: download <Excel sheet link>, fill in the Comments tab, and email it to <address>
- On GitHub: <issue form link> (comments there are public)

Please cite the section, page and line numbers of this draft. Your email is
used only to contact you about your comments. Your name is published in the
acknowledgements only if you say yes.

What happens next: each comment is placed on the text it is about, grouped
with related comments into proposed changes, and reviewed by <committee>. The
editor decides each one, with a reason. How the review works: <link to the
published public-comment process>.
```

Only the channels the editor set up are listed. The links are the ones
recorded in §2. Nothing goes out until every link has been opened once.

## 4. Who submitted: the Public Comment Source tab

Submitters are recorded in the review sheet's **Public Comment Source** tab,
one row per public comment. The columns are No., date received, channel,
reviewer name, organisation, country / region, stakeholder type, email, and
"Acknowledge by name (Yes/No)". Every column is **Grey**: the tab is the
external source, copied in mechanically. The tab is locked, and it is the
only place a submitter's name and email are kept (the `public-comment`
skill, §"The live review sheet").

- Each channel asks for the details **once per submission**: at the top of
  the Excel sheet's Comments tab, on the Form's "About you" page, and from
  the GitHub login on an issue. At intake, the submission's details are
  copied onto every one of its comments' rows in Public Comment Source, with
  the comment's No. and its channel.
- A returning submitter is recognised by the importer's pseudonymous id
  `r-<hash>`, which comes from the email or else the name (`reviewerId` in
  `schemas/public-comment.ts`). Someone who comments through two channels
  with the same email is therefore one reviewer.
- The repository gets only that id, the organisation and the country. It
  gets the name **only** when the submitter answered Yes to "Acknowledge by
  name", and never the email. The importer follows this rule (the
  `public-comment` skill, §"Privacy").
- Submitter details are not configuration, so they never go in the Config
  tab. That tab holds the script's settings and is written by the agent.

## 5. Intake: each channel has one path back

All four channels end in the same importer (`public-comment.ts import`),
because each returns a table whose headers are the importer's own. Before
importing, check that every reference is in the release:

<!-- command-path-ok: run IN A FOLIO after §1 — release-references.json is the file §1's `refs --out` writes and step 2 of the checklist commits, so it does not exist before a release is made -->
```sh
bun run folio-assistant-core/scripts/public-comment-channels.ts check <returned file> --refs review/public-comment/release-references.json
```

`check` lists each row that cites a section or page outside the release, or
whose Release row names another release, and exits non-zero. It changes
nothing. A flagged row is still imported (it arrives *unplaced* and triage
places it); the list tells the triager where to look.

| channel | what comes back | command (from the folio's repository) |
|---|---|---|
| Excel sheet | the reviewer's .xlsx, by email | `public-comment.ts import <file> --channel comment-matrix --batch <release id>-<reviewer org>` |
| Google Form | the response sheet, downloaded as CSV | `public-comment.ts import <responses.csv> --channel online-form --series <release id>-form` |
| GitHub issues | issues titled `[<release id>]` | `gh api 'repos/<owner>/<repo>/issues?labels=public-comment&state=all&per_page=100' --paginate > issues.json`, then `public-comment-channels.ts issues-csv issues.json --release <release id> --out gh.csv`, then `import gh.csv --series <release id>-github` |
| Review sheet | committee feedback, not public comments | the sheet sync (skill `public-comment`, §"The live review sheet") |
| A letter or email that used no channel | prose | `public-comment.ts import-narrative <file> --reviewer …` |

Re-importing is safe: a file already imported is recognised by its sha256, and
a form or issue export re-downloaded later adds only the rows (`No.`) it has
not seen, because each carries a `--series`. Keep the returned files in the
review owner's private store, never in the repository: they hold emails.

## 6. Triage into thematic change-sets

After each intake batch, the intake agent proposes change-sets
(Task_ProposeChangeSets, the `public-comment` skill, §"The agent proposes;
nobody is notified"):

1. `public-comment-changesets.ts seed` lists the comments in no change-set,
   bucketed by section. A bucket is a starting point, not a change-set.
2. The agent groups comments by **theme**: comments that ask for the same
   change, or for changes that must land together, wherever they are in the
   document. A cross-cutting theme (a term, consent, normative keywords) is one
   change-set across sections.
3. Each change-set gets a **title**, **requirements** (what the text must do,
   not the new text), and its **linked public comments** (`refs`). Record them
   with `propose --file proposals.json`. They are *proposed*: no issue is
   opened and nobody is notified.
4. A comment that fits no theme stays out, on the dashboard's *open, in no
   change-set* tile, for a person to place.

The review sheet then shows the new change-sets on its next sync, and the
committee reviews them there or on GitHub.

## 7. Closing

At the agreed close: run `closePublicCommentForm` in the Form's script, and
remove the issue form (`.github/ISSUE_TEMPLATE/public-comment.yml`) from
`main`, so nobody is offered a closed release. The kept release site and PDF
are not touched.
Do a last intake from every channel. A comment that arrives after the close is
imported like any other, and the editor decides whether it is considered.

## What not to do

- Do not type a list of sections into a form by hand, or edit the generated
  questions or headers: they are the importer's column headers, and a renamed
  question is a column the importer cannot read. Regenerate instead.
- Do not reuse one release's channels for the next release. Its references
  are different.
- Do not announce a channel before it has been tried once and `check` passed.
- Do not put an email, or a name without consent, in the repository, an issue
  body the agent writes, or the Config tab.
