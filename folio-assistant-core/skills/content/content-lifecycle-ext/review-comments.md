---
name: review-comments
description: >-
  Reviewer comments on a folio's edit-set, from a tagged pull-request comment
  to a structured todo on the review page. Covers the tag a reviewer types, how
  the comments are ingested into `review-comment/1.0.0` todos, where the
  published `review-comments.json` comes from and when it refreshes, how a
  comment follows a renamed block and survives a removed one, who may change a
  comment's status, and how to change this process. Use when a reviewer asks
  how to comment on a block, when the review page shows no comments or a wrong
  one, when editing the ingestion, or when a folio's staging workflow is set up.
user_invocable: true
allowed-tools: Bash(bun run folio-assistant-core/scripts/review-comments.ts*) Read Grep Glob mcp__github__pull_request_read
---

# Review comments — from a PR comment to a structured todo

> Skill id: `review-comments` · Package: `content-lifecycle-ext`
> Tools: `folio-review-comments` (ingest), `folio-review-comment-move` (record a decision)

A reviewer comments on **one block** of a folio by writing an ordinary comment
on the edit-set's pull request, starting with a tag that names the block. The
review process turns each tagged comment into a **todo of a special kind**,
`review-comment/1.0.0`. The review page lists those todos beside the
blocks they are about.

## Design

| rule | why |
|---|---|
| The channel is a **PR conversation comment tagged with the block label** | Needs nothing installed, sits beside the approve, and is anchored by LABEL, so it survives a block moving. A line review comment is anchored to a file line and is lost when the block moves. |
| The record is a **todo subtype declared by core, in the dynamic KG** | A board, heat map or reader that understands todos reads a review comment without knowing about review. |
| The preview gets comments from a **file the workflow writes** | Works for private and public repositories, and no token ever reaches a browser. |
| A status change is **committed to the folio's `todos/` on the edit-set's feature branch** | Reviewed with the edit it is about, lands on `main` only when that branch merges, and is part of the KG. |

The PR comment is the **write channel**; the todo is the **canonical record**.

## Writing a comment: the tag

Start a conversation comment on the pull request with header lines, then a
blank line, then what you want to say:

```
block: prose:overview
kind: defect
role: clinical-sme

The dose in the second sentence contradicts table 3.
```

| header | required | values | default |
|---|---|---|---|
| `block:` | yes | the block's label, exactly as the review page shows it | — |
| `kind:` | no | `question`, `defect`, `suggestion`, `editorial` | `question`, which asserts least |
| `role:` | no | the lane you are reviewing in, a role id from `roles.json` | `reviewer` |

- **The headers must be the very first lines.** The first line that is not
  `key: value` ends the header.
- **`block:` takes the rest of the line**, because labels contain colons
  (`prose:overview`). It must be ONE label.
- **A comment without `block:` is conversation**, not a review comment, and is
  left alone. A PR thread is also where people talk.
- **A malformed tag is reported, never dropped.** An unknown `kind`, or two
  words after `block:`, appears in `malformed` with the comment's link, so
  the reviewer can fix it.

The review page shows the exact `block: <label>` line for every changed
block, ready to copy, and links to the pull request. GitHub cannot pre-fill a
comment box, so copying the line is the one manual step.

## What a review comment IS

`review-comment/1.0.0`, in
`folio-assistant-core/schemas/review-comment.ts`. It is declared with
`nodeKind` and its one parent is the harness todo, which itself
is `carried-note` + `themed`. So it IS a todo:

- **`targetLabel` is required.** A general todo may float free; a review
  comment is always about one block.
- **`status` is closed**: `open`, `addressed`, `resolved`, `adjudicated`,
  `withdrawn`.
- **Everything review-specific sits under one field, `review`**: the
  repository, PR, comment id and URL, reviewer, role, kind, the block's
  content hash and the commit when ingested, `orphaned`, `anchoredFrom`, and
  the `decision` that closed it.

Keeping the review fields under one key means no field here can collide with
one a parent adds later, which is the collision `nodeKind` refuses at load.

## Who may change a status: only the process

A status moves only through `transition(comment, to, {process, task})`, and
only along a row of `REVIEW_TRANSITIONS`. Anything else throws.

| move | from | to | by (BPMN task) | needs a Decision |
|---|---|---|---|---|
| ingest | — | open | `Process_ContentChangeReviewCommittee#Task_IngestComments` | |
| address | open | addressed | `Process_Review#Task_EditorDecides` | |
| send back | addressed | open | `Process_Review#Task_EditorDecides` | |
| resolve | addressed | resolved | `Process_Review#Task_EditorDecides` | yes |
| adjudicate | open, addressed | adjudicated | `Process_Adjudication#A_RecordEntry` | yes |
| withdraw | open, addressed | withdrawn | `Process_ContentChangeReviewCommittee#Task_WithdrawComment` | |

A comment's status is what the coverage gate counts, so a comment closed
outside the process would count as reviewed when nobody decided anything. A
test holds every row to a task that exists in its `.bpmn`. Ingestion is the
review coordinator's first step in `content-change-review.bpmn`'s committee
phase, `content-change-review-committee.bpmn`; withdrawal is the reviewer's
step there after the slices come back.

## Ingestion: the Tool

```sh
bun run folio-assistant-core/scripts/review-comments.ts \
  --repo owner/name --pr 7 --out _site/review-comments.json \
  --folio folio --blocks-out _site/blocks.json \
  --existing <previous review-comments.json>
```

Declared as the Tool `folio-review-comments` in
`folio-assistant-core/tools/folio-review-comments/`, whose `satisfies` names
this skill.

1. **Read the comments.** All pages of the PR's conversation comments, with
   `GITHUB_TOKEN` when set. `--comments <file>` reads them from a file
   instead, for offline runs and tests.
2. **Know the blocks.** Either `--folio <dir>`, which reads the manifests as
   text and executes nothing, or `--blocks <blocks.json>` from an earlier
   run.
3. **Keep everything already ingested.** Every comment in `--existing` is
   kept, status included. A comment's id is `review-pr<N>-c<commentId>`, so a
   re-run finds it rather than adding a second one.
4. **Add the new ones.** Each tagged comment not yet ingested becomes an
   `open` todo. A `defect` gets priority `high`; the others get `medium`.
5. **Re-anchor every comment** against the head's blocks
   (`reanchorToBlocks`):
   - the label is present: anchored;
   - a block lists the label in its `renamedFrom`: the comment moves to
     that block, and the old label goes into `review.anchoredFrom`;
   - neither: `orphaned: true`. **Kept and shown, never dropped.**
6. **Write `review-comments.json`**, `folio-review-comments/v1`. Its
   `comments` ARE the todo kind, each validated as one. The envelope adds
   only what one node cannot: provenance (`repo`, `pr`, `commit`,
   `generatedAt`), the `malformed` list, and the `untagged` count. So "no
   comments" and "comments nobody could parse" can be told apart.

**Why re-anchor against `renamedFrom` and not the ChangeSet.** A ChangeSet
compares against `main`. A block ADDED in the pull request and then renamed
inside it is "added" both times, so the comment made on its first label
would be orphaned. The block's own `renamedFrom` (guarded by
`id-stable`) says where it came from whatever the base. `reanchor()` over a
ChangeSet also exists, for a caller that has only that.

## Recording a decision: commit to the feature branch

When an editor or adjudicator decides what happens to a comment, the
decision is committed to the **feature branch that carries the edit-set**,
the same branch the edits are on:

```sh
bun run folio-assistant-core/scripts/review-comment-move.ts \
  --id review-pr7-c1 --to addressed \
  --process Process_Review --task Task_EditorDecides \
  --published _site/review-comments.json --commit
```

- **The move goes through `transition()`**, so `--process` and `--task` must
  be a task allowed to make it, and `resolved` / `adjudicated` need
  `--decision`. The command is not a back door around the table above.
- **A new folio already has the directory.** `init-folio` writes
  `todos/todos.json` declaring `items` and `feedback` (`todo-feedback`), and
  creates both. An older folio that lacks it gets an error naming the remedy.
- **The file goes where the graph says.** That is the todos graph's
  directory of kind `todo-feedback` ("todos raised against a specific block,
  carrying the submitter's identity"), read from `todos/todos.json`. A graph
  that declares none gets an error naming the remedy.
- **The file IS the node**: `<feedback dir>/<id>.json`, one
  `review-comment/1.0.0`, the same object the published file carries. It
  is JSON, not Markdown, because the todo reader's front matter is flat and a
  review comment has a nested `review` field.
- **`--commit` refuses the base branch** (default `main`, change it with
  `--base`) and a detached HEAD. The check runs before anything is written,
  so a refused commit leaves nothing behind. A status committed straight to
  `main` would record a review outcome that no merge ever accepted.
- **The first move reads the published file**, where a comment first exists
  after ingestion. Every later move reads the committed file, which is the
  reviewed record.

**How it reaches the page.** The commit is a push to the feature branch,
which rebuilds the preview. That build's ingestion reads the committed
comments (`--todos`) and **a committed comment wins over the previously
published copy**. The comment-triggered refresh checks out no branch code, so
it cannot read them and keeps what the last build published. Nothing is lost
between the two.

**What it costs.** One extra commit on the edit-set's branch per decision,
and a PR from a fork cannot be written to by anyone but its author.

## Verdicts: "I read this version"

A comment asks for something. A **verdict** records that a reviewer read a
block, and what they judged. The coverage gate needs verdicts, because
comments cannot say whether a block with none was read.

The channel is **the same tagged PR comment**, with a `verdict:` or `waive:`
line instead of `kind:`.

```
block: prose:dose prose:schedule
verdict: ok
role: clinical-sme
```

| line | means |
|---|---|
| `verdict: ok` | read, no objection |
| `verdict: changes` | read, and it needs changing. The reasons go in review COMMENTS; the verdict only records the reading |
| `waive: <reason>` | the block needs no review (a pure rename, say). The reason is required and kept |

- `block:` may name **several labels**, so one comment can close a slice.
  One verdict is recorded per label.
- **A comment is a verdict or a review comment, never both.** A tag with
  `kind:` as well is refused and shown as malformed, so nothing is counted
  twice under two meanings. The comment parser passes every verdict tag over.
- **A verdict is pinned to the block's hash.** It counts only while the block
  is at that version. An edit after review reopens exactly the blocks it
  touched. The old verdict is kept and shown as "on an earlier version".
- A verdict on a label the head does not carry is malformed, not recorded.

**Pages and inputs no block reaches.** A page changed by a
manifest or media file, the comment pages and every FHIR IG page have no
block to give a verdict on, and an input no renderer could place may have
changed any page. The same tag takes them, beside or instead of `block:`:

```
page: en/dpi-h-ra/index.html
verdict: ok
```

```
input: sushi-config.yaml
waive: only the version string changed
```

`page:` names a path in the preview's `rendered-impact.json`, or a page the
build measured and the prediction missed; `input:` names one of its
undetermined inputs. Each is pinned to that file's `hash` there, so it
reopens when an input that reaches it is edited. A page or input the build
does not list, or a build that published no rendered impact, is reported
malformed with the reason. See `rendered-impact` (opt-in `cat-harness.sdlc`).

The `folio-review-comments` Tool ingests verdicts into the same
`review-comments.json`, as its `verdicts` array
(`folio-review-verdict/v1`, `folio-assistant-core/schemas/review-verdict.ts`).

**Coverage.** The `folio-review-coverage` Tool computes every fact
`GW_Covered` reads (`uncoveredBlocks`, `openDefects`, and, with `--rendered`
and `--measured`, the page counts with their `rendered` and `measured`
statuses) and prints them as JSON on stdout, ready for `workflow_complete`.
Every fact is always printed, because the engine refuses a missing one.
With `--todos <root> --commit` it writes the verdicts into the todos graph's
declared `review-verdicts` directory and commits them to the **feature
branch**, as comment statuses are, and it refuses the base branch and a detached HEAD. `init-folio`
declares that directory (`todos/verdicts/`) for every new folio.

## Publication: where the file comes from, and when

`folio-staging.yml` (the reusable workflow a folio calls) has two jobs:

| job | runs on | blocks from | what it writes |
|---|---|---|---|
| `stage` | the folio's pull request (including a push that records a decision) | `--folio`, the checked-out feature branch; statuses from `--todos` | the site, `changeset.json`, `blocks.json`, `review-comments.json` |
| `comments` | a new or edited PR comment containing `block:` | the published `blocks.json` | `review-comments.json` only |

**The `comments` job never checks out or runs the pull request's code.**
It is started by anyone who can comment, and it holds a token that can write
to the publish branch. Checking out a PR's code in such a job is the
well-known way to hand that token to a stranger. So it checks out only:
- the **platform**, at `platform_ref` (never a copy the PR carries);
- the **publish branch**, which holds only what earlier trusted builds wrote.

A comment body is parsed as data and never reaches a shell. The job also
skips bot comments, so the preview comment the workflow itself posts cannot
start it.

**Freshness.** A new comment appears on the page about a minute later, after
the `comments` job runs. A push rebuilds everything and keeps every comment.
Nothing refreshes on a comment when there is no preview yet (no
`blocks.json`), and the job says so rather than failing.

**The caller must opt in.** A folio's own workflow has to list
`issue_comment` among its triggers for the `comments` job ever to run.
`init-folio` writes that for a document folio.

## The review page

`en/review/index.html` in the preview reads `review-comments.json` beside
`changeset.json`, at the preview's root, when it is opened:

- each changed block lists its comments: kind, status, reviewer and role,
  the first line, a link to the PR comment, the `resolve: <id>` tag for an
  open or addressed comment, and the recorded `decision` for a closed one;
- a comment filter (`Show comments`) filters the listed comments by status
  (`open`, `addressed`, `resolved`, `adjudicated`, `withdrawn`, or `open and
  addressed`) or kind (`defect`, `question`, `suggestion`, `editorial`);
- a comment on a block this PR did not change is listed separately, since
  a review of a whole document comments on unchanged text too;
- **orphaned** comments are listed under their own heading, with the label
  they were made on;
- `malformed` tags are listed with their links, so the reviewer can fix them;
- every changed block shows its `block: <label>` line and a link to the PR,
  for writing a new comment;
- no `review-comments.json` means the page SAYS it has no comment data. An
  empty list would read as "nobody commented".

## Changing this process

The process is a Skill and a Tool rather than YAML steps, so it can be
changed here:

| to change | edit | and |
|---|---|---|
| the tag grammar | `parseReviewTag` in `schemas/review-comment.ts` | this skill's tag table; the tests |
| a status or who may move it | `REVIEW_COMMENT_STATUSES` / `REVIEW_TRANSITIONS` | the BPMN task it names; this skill's table |
| where a decision is recorded | `folio-assistant-core/scripts/review-comment-move.ts` | the `folio-review-comment-move` Tool node |
| a field on the record | `ReviewFieldsSchema` | the page, if it shows it |
| what the ingestion does | `folio-assistant-core/scripts/review-comments.ts` | the Tool node's `io` if a flag changes |
| when it runs | `folio-staging.yml` and `init-folio`'s caller template | the trust notes above |

## Deciding from the review page: a `resolve:` comment

The page decides through the same channel it comments through. Under each
open or addressed comment it shows the tag to post as a
pull-request conversation comment, with the words that comment's status
allows:

```
resolve: review-pr7-c123
decision: resolved

The dose now matches table 3.
```

- **The words** are transitions of the table above: `addressed` (address),
  `reopened` (send-back), `resolved` (resolve), `adjudicated` (adjudicate),
  `withdrawn` (withdraw). Anything the table refuses is refused here too.
- **Who.** A repository owner, member or collaborator (GitHub's
  `author_association`) decides; the comment's own author may withdraw it.
  Anyone else's tag is refused, because a PR conversation is open to every
  GitHub user and a status is what the coverage gate counts.
- **The Decision** that closes a comment is the decision comment's URL.
- **Once.** Each applied decision's comment id is kept in
  `review.decisions`, so a rebuild, or a committed copy that already carries
  it, applies nothing twice.
- **Never dropped.** A tag that cannot be read or applied is listed under
  "Tags that could not be read or applied", with its reason.

The build (`folio-review-comments`, and `stage-local` for a `site.build`
folio) applies the tags after ingestion, so the published file and the page
show the decided status. With `--write-decided` the Tool also writes each
newly decided comment into the todos graph's feedback directory, as
`folio-review-comment-move` writes it; `stage-local` passes it and then runs
`state:push` for a todos graph kept on its own state branch (dth-hrh's
`cat/dth-hrh/todos`), so the decision is recorded without anyone running a
command. A todos graph in the feature branch's tree is left for the editor
to commit.

## Not yet decided

- **Committing a page decision to an in-tree todos graph automatically.**
- **A reviewer who edits a comment after ingest.** The edit is not re-read, so
  a record an editor has already acted on is not silently rewritten. Whether
  an edit should reopen the comment is open.
- **Line review comments** are not read. A reviewer
  who uses one gets no todo.
