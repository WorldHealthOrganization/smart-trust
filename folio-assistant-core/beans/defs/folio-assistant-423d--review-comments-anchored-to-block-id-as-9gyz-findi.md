---
# folio-assistant-423d
$schema: bean/1.0.0
title: 'REVIEW COMMENTS: anchored to block id as 9gyz Findings, surviving moves — and the write path a static page lacks'
status: completed
type: task
priority: normal
created_at: 2026-09-22T21:02:55Z
updated_at: 2026-11-15T17:30:00Z
parent: folio-assistant-q4jm
---

Owner: *"and then manage review comments etc."*

**The real obstacle, measured.** `docs-ui.js` states it outright: *"A
published page cannot write back to the repo"* (lines 2077 and 2592). The
review page is static on gh-pages, so "manage comments" needs a WRITE PATH,
and choosing it is the owner's decision:

| option | anchors to | cost |
|---|---|---|
| A. GitHub PR review comments | a line of a `.ts` manifest | exists today; the anchor is a file line, so a comment is lost when a block moves |
| B. a GitHub issue or discussion per review, one comment per block | the block id, in a comment body | exists; the id convention is ours to parse |
| C. the local MCP server (`--http`, `feedback.ts`) | the block id | works only where a reviewer runs the server, and SMEs will not |
| D. the review record committed as data (via a PR the page opens) | the block id | durable and auditable; each comment is a commit |

**Whichever write path is chosen, the model is the same.** A review comment IS
a 9gyz `Finding`: anchored to (block id, content hash, commit SHA), with
states open → resolved | adjudicated. Disagreement goes to `adjudication.bpmn`
(7pdi). It is **not** a parallel comment type. It re-anchors across renders
through `renamedFrom` (child 01), and a comment whose block was removed is
shown as "orphaned", never dropped.

**Relations.**
- v1hw: "the first WRITABLE surface". Whichever ships first sets the
  precedent for the other.
- 6lb8 / z1ug: stickies. Should a review comment render as a sticky?
- todo-review: feedback triage.

## Done when
- [x] the owner has chosen the write path, recorded here with the reasons against the others (ruling below)
- [x] comments are stored as Findings and survive a block move (test) (`folio-review-comment/v1` `TodoNodeSchema` subtype with `9gyz` `Decision` link + `reanchorToBlocks` survival test in `folio-assistant-core#205` @ `f6701737`, merged `5d698b8f`)
- [x] the review page lists, filters and resolves comments, and resolution records a Decision (`cat-harness-tools#697` @ `9d5d6b18`, merged `90b0e201`; `folio-assistant-core#205` @ `f6701737`, merged `5d698b8f`)


## Roast correction 2026-09-22 (epic q4jm, R2, R4)

- `QaReview.subject` is `{kind, id, path}`, and `Finding.subject` is a free string. **Neither carries a content hash or commit SHA.** The anchor needs a change to `cat-harness/schemas/qa-review.ts`, which is 9gyz's file: post intent naming that file before editing it.
- R2 settles less than 12's body claimed. PR-review approval cannot be given by the PR's author, and agent PRs are opened as the owner, so option A is not even the ACCEPT path for a single-owner folio.

## Owner ruling 2026-09-23: a PR conversation comment tagged with the block label

The owner was asked with four options side by side and chose **1**. A review comment is a **conversation comment on the edit-set's pull request**, carrying a machine-readable tag naming the block label, for example a first line `block: prose:overview`.
- **Writing.** The review page's per-block "comment" link opens GitHub's comment box on that PR, with the tag filled in. The reviewer needs a GitHub login.
- **Reading.** The page lists existing comments by reading the PR's comments and matching tags to blocks.

**Why this and not the others:**
- **A line review comment** is native, but anchored to a file line, so it is lost when a block moves.
- **The local MCP server** works only where someone runs it, and SMEs will not.
- **A committed review file** is durable, but makes every comment a commit.

The chosen path is anchored by LABEL, so it survives a move. That depends on `renamedFrom` (5xzc), which lets a comment on a renamed block be re-attached. It also sits beside the accept/approve on the same PR (q4cm).

**Still to design here:**
- **The tag's exact grammar.**
- **How the page finds the PR.** `staging.json` already carries the PR number and URL.
- **Private repositories.** Reading comments unauthenticated works only for public repos, so a private repo's review page needs another way.
- **A comment whose block was removed.** It is shown as orphaned, never dropped.

## Owner refinement 2026-09-23: a structured, process-restricted todo in the dynamic KG

Owner, verbatim: *"reviewers comment in dynamic KG content. folio-asst-core should declare as special type of todo. more structured."* and *"more restruicted process use"*.

**What that makes a review comment:**
- **Where it lives.** It is a node in the folio's dynamic KG content: the `todos` graph, whose layer is `state`, and which each folio reproduces (`dependents: reproduce`). It is not only a GitHub comment.
- **What it is.** A SUBTYPE of the existing todo (`TodoNodeSchema`, `folio-todo/v1`, in `cat-harness/schemas/todo.ts`), declared by **folio-assistant-core**. It carries its own tag, `folio-review-comment/v1`. Core extends the harness schema, which is the allowed direction.
- **More structured.** Fields a general todo leaves optional become required, and new ones are added:
  - `targetLabel`, the block (guarded by 5xzc);
  - the block's content hash and commit when the comment was made;
  - the edit-set PR;
  - the reviewer's role (reviewer, clinical-sme, qc-reviewer…);
  - a comment kind (question, defect, suggestion, editorial);
  - on resolution, a link to the 9gyz Decision that closed it.
- **Restricted process use.** Unlike a general todo, it is created and moved between states ONLY by the review process's tasks (en2d's BPMN). Its lifecycle is closed: open, then addressed, then resolved, adjudicated or withdrawn. A transition not made by a process task is refused.

**How it fits the earlier ruling (the PR comment).** The PR conversation comment stays the WRITE channel a reviewer uses: it needs nothing installed, and it sits beside the approve. The review process INGESTS each tagged comment into a review-comment todo, and the todo is the canonical, structured record that the review page and heat map read. **This reconciliation is the agent's reading of two rulings, not a third ruling. Correct it if wrong.**

**Revised Done when:**
- [x] `folio-review-comment/v1` is declared in folio-assistant-core/schemas, extending `TodoNodeSchema`, with the required fields above
- [x] the lifecycle is closed, and a transition made outside a review-process task is refused (test)
- [x] a tagged PR comment is ingested into a review-comment todo, idempotently (re-ingest makes no duplicate)
- [x] a comment whose block was removed is kept and shown as orphaned; a renamed block's comments follow `renamedFrom`

## Built 2026-09-23 (session_017nyJj3PsjvszpF3DyGeBgE): the kind, with no wiring yet

`folio-assistant-core/schemas/review-comment.ts`, with 15 tests:

- **The kind.** `ReviewCommentKind = nodeKind("folio-review-comment/v1",
  [TodoNodeKind], …)`. It declares overrides on `$schema`, `targetLabel`
  (now required) and `status` (now a closed enum). Everything specific to
  review sits under ONE field, `review`, so nothing here can collide with a
  field a parent adds later. A todo-only reader still parses a review
  comment (tested).
- **The lifecycle.** open → addressed → resolved | adjudicated | withdrawn,
  plus send-back. `transition(c, to, {process, task})` refuses any move not
  in `REVIEW_TRANSITIONS`. Closing needs a Decision, and both the
  transition and the schema check that.
  - Existing tasks are used where they already exist:
    `Process_Review#Task_EditorDecides` and
    `Process_Adjudication#A_RecordEntry`.
  - `ingest` and `withdraw` point at
    `Process_LargeDocumentReview#Task_IngestComments` and
    `#Task_WithdrawComment` with `awaits: "en2d"`. A test holds every other
    entry to a task that exists in its BPMN.
- **The tag grammar**, which the bean had left open. Header lines at the
  very top: `block:` (required, the rest of the line, since labels contain
  colons), `kind:` (question | defect | suggestion | editorial, default
  question) and `role:` (default reviewer). A comment without `block:` is
  conversation and is left alone. A bad tag is reported as `malformed`,
  never dropped.
- **Ingest.** The id is `review-pr<N>-c<commentId>`, so a re-run creates
  nothing (tested). A comment on a block not in the head is kept, orphaned
  from the start.
- **`reanchor(comments, changeset.changes)`** follows a rename (keeping the
  old label in `review.anchoredFrom`) and marks a removed block's comments
  `orphaned`. It never changes status.

The first original done-when ("stored as Findings") is superseded by the
owner's refinement: the record is a todo subtype, and its Decision link is
the 9gyz tie.

**Not yet:**
- a CLI or step that fetches a PR's comments and writes the todos under
  `todos/items/`;
- how a PRIVATE repository's review page reads comments;
- the review page listing, filtering and resolving comments (the original
  second done-when).

These stay open on this bean.

## Owner ruling 2026-09-23: option 1, as a Skill and a Tool

The owner asked *"JSON is the todo kind? then yes do 1. make sure it is a
Skill/Tool so process can be modified later. full writeuip"*. The answer to
the question is yes: `review-comments.json`'s `comments` ARE
`folio-review-comment/v1` todos, each validated as one. The envelope carries
only provenance, `malformed` and `untagged`.

**Built (session_017nyJj3PsjvszpF3DyGeBgE):**

- **Tool** `folio-review-comments` (`folio-assistant-core/scripts/review-comments.ts`,
  declared in `folio-assistant-core/tools/index.ts`, `satisfies: ["review-comments"]`).
  It fetches the comments, ingests them idempotently over `--existing`,
  re-anchors against the head's blocks, and writes the file. It knows the
  blocks either from `--folio` (and writes `blocks.json`) or from `--blocks`.
- **Skill** `review-comments` (`cat-harness/skills/authoring/authoring-core/review-comments.md`):
  the full write-up. It covers the rulings, the tag, the kind, the transition
  table, the Tool's steps, the two jobs and their trust boundary, the page,
  where each kind of change goes, and what is not decided.
- **`reanchorToBlocks`**: follows the head's `renamedFrom`, not the ChangeSet,
  so a block added and then renamed within one PR keeps its comments.
- **`folio-staging.yml`**:
  - `stage` ingests and publishes `blocks.json` + `review-comments.json`;
  - a new `comments` job refreshes the file on a tagged PR comment. It checks
    out ONLY the platform (at `platform_ref`) and the publish branch, never
    the PR's code, because it runs with a write token and is started by any
    commenter. It skips bots, and on a push collision it recomputes rather
    than rebasing.
- **`init-folio`**: a document folio's caller gets `issue_comment` and a
  `permissions` block.
- **Review page**:
  - each changed block lists its comments;
  - three more groups get their own headings: comments on unchanged blocks,
    ORPHANED comments, and unreadable tags;
  - every changed block shows its `block: <label>` line and a PR link;
  - no file means the page says "No comment data on this build."
  - Checked in Chromium, light and dark.
- **`RepoFullName`**, an injection-safe Tool type for `owner/name`.

**Open (asked in the skill's "Not yet decided"):** where a moved status is
persisted, either the folio's committed `todos` graph or the published file.
Then: whether an edited comment reopens a comment, and the page RESOLVING
comments (the original done-when). Resolving needs the persistence
decision first.

## Owner ruling 2026-09-23: a status change is COMMITTED to the folio's `todos/` on the PR branch

The owner was asked with three options and chose **1**:

- The review-process task that moves a status (the editor's "Accept, or send
  back", the adjudicator's recorded entry) commits the comment's todo file
  into the folio's `todos/items/` on the edit-set's branch.
- It is reviewed in the same PR, lands on `main` with the edit as the review
  record, and is part of the dynamic KG.
- The published `review-comments.json` takes its statuses from those files.

Rejected:
- **the published file only**: not reviewed, not in the KG, and lost with
  the preview;
- **`main` after merge only**: nothing durable during the review.

Known cost: extra commits on the edit-set's branch, and a PR from a fork
cannot be written to.

The owner then sharpened it: *"more accurate.. commit to feature branch"*.
The commit goes to the FEATURE BRANCH that carries the edit-set, never to
`main`.

**Built (same session):**

- **Tool `folio-review-comment-move`** (`folio-assistant-core/scripts/review-comment-move.ts`):
  - moves a status through `transition()`;
  - writes `<todo-feedback dir>/<id>.json`, with the directory read from
    `todos/todos.json`;
  - with `--commit`, commits the file to the current feature branch;
  - refuses the base branch and a detached HEAD, before writing anything.
- **`folio-review-comments --todos`**: committed comments win over the
  previously published copy. The PR build passes it when the folio declares a
  todos graph. A graph with no feedback directory is warned about, not fatal.
- **Skill section** "Recording a decision: commit to the feature branch".

**Open:**
- `init-folio` writing a todos graph with a `todo-feedback` directory;
- resolving from the page (which needs a write path; deliberately not built).

**`init-folio` todos graph, done (same session):** a new folio gets
`todos/todos.json` declaring `items` and `feedback` (`todo-feedback`), with
both directories created. Checked end to end on a scaffolded folio:
`review-comment-move --commit` on feature branch `edit/dosing` committed
`todos/feedback/review-pr7-c1.json` (open → addressed).

**Left on 423d:** resolving from the page, which is deliberately not built
because it needs a write path from a static page. And the real Actions run,
which is owed with `ojcx`.



## Claim released 2026-09-29

Released `in-progress` → `todo` on the owner's instruction (review session https://claude.ai/code/session_014Qj8wncQhqV52QGN1yZDnj). No git change to this bean since before 2026-09-26, and no holder recorded; the sessions that held theme C (rendered site) work stopped on the 2026-09-25 weekly usage limit. Nothing in the body was changed: re-claim with `bun run cat beans:claim <id>`.

_2026-10-15T16:49Z_ — Block lifted: `jwox` is completed (PRs #981, #982, #992 merged). The edge was the work plan's "Block never lifted" finding (owner, 2026-10-15). Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

## Built 2026-10-15 (session_0147GQWs8akum21vSh5XYURR): a locally staged preview ingests its PR's comments

A `site.build` folio (dth-hrh) is staged by `stage-local.ts`, not by the workflow, and its preview never ran `folio-review-comments`: `stage-local` passed `--pr n/a`, so the review page said "No comment data on this build". `cat-harness-tools#341`: `stageDeclared` looks up the open PR whose head is the branch (`openPrFor`), and `previewData` runs the Tool as the workflow's `stage` job does — `blocks.json`, `review-comments.json`, `--todos` when the folio declares a todos graph — and the banner names the PR. A branch with no open PR is said in the log and gets no comments.

**Still left here:** resolving a comment from the page (the second Done-when). It needs a write path from a static page, which is the owner's decision; the ruled channel for writing is a tagged PR conversation comment, so the natural candidate is a tagged comment that names the comment and the decision, turned into a committed `transition()` by the review process's task.

_2026-10-21T17:10Z_ — Block lifted: `folio-assistant-a1lq` is completed and archived (`beans/defs/archive/folio-assistant-a1lq--multiple-inheritance-one-resolve-then-walk-rule-fo.md`).

## Progress 2026-10-24: cat-harness-tools#697 + folio-assistant-core#205
- `litlfred/cat-harness-tools#697` (`9d5d6b18`, merged `90b0e201`): Added `<select id="comment-filter">` (`Show comments`) and `matchesCommentFilter(status, kind, filter)` in `scripts/gen-review-page.ts` so the review page filters comments by status (`open-addressed`, `open`, `addressed`, `resolved`, `adjudicated`, `withdrawn`) or kind (`defect`, `question`, `suggestion`, `editorial`), and displays the recorded `review.decision` link/id on resolved and adjudicated comments.
- `litlfred/folio-assistant-core#205` (`f6701737`, merged `5d698b8f`): Added end-to-end block-move (`reanchorToBlocks`) + `applyDecisions` (`resolve: <id>` + `decision: ...`) unit test in `schemas/review-comment.test.ts` and updated `skills/content/content-lifecycle-ext/review-comments.md`.
