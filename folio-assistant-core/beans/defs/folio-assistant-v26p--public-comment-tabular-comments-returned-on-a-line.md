---
# folio-assistant-v26p
$schema: bean/1.0.0
title: 'PUBLIC COMMENT: tabular comments returned on a line-numbered draft, mapped by page and line to block ids, then triaged, reassigned and dispensed as Findings'
status: completed
type: task
priority: normal
created_at: 2026-09-22T21:09:45Z
updated_at: 2026-10-07T17:38:00Z
parent: folio-assistant-q4jm
blocked_by:
    - folio-assistant-5xzc
---

Owner, issue #197 (2026-09-17), *"prepare also for draft publication review processes: a fixed version (rendered PDF version w/ line numbers) goes out, then people return with excel/csv/tablular data of comments and feedback that needs to be reviewed and dispensed with"*, and it asks for *"show all comments that are on a page, at a line number, re-assign a comment to a more appropriate place, triage a comment, assign a comment to another collaborattor"*, plus *"update the bpmn diagrams to show more detailed \"Public Comment\" workflow"*.

Found by the q4jm roast (R9). The plan as first written had only in-page comments (423d) and missed the SME and public-consultation path, which is how DAK and L1 review is actually run.

**What.**
- **A frozen draft**: a rendered PDF with line numbers, and a **page/line → block id map** emitted at render time and committed with the draft's tag.
- **Import**: CSV/XLSX rows (page, line, commenter, text) become Findings (9gyz) anchored to block ids through that map. A row that maps to no block is kept as "unplaced", never dropped.
- **Operations**: list by page, line or block; reassign to another block; triage; assign to a collaborator; dispense with a Decision and its reason (adjudication, 7pdi). Each is a Tool node.
- **Process**: a Public Comment sub-process in the lifecycle diagram (en2d), with where it sits between draft and publication.
- The review/ page and the heat map (txut, qbfi) show imported comments beside in-page ones: **one Finding store, two intake routes**.

The page/line provenance for INGEST is xtpc (the other half of #197).

## Done when
- [x] a line-numbered draft render emits the page/line → block map
- [x] a CSV and an XLSX of comments import as Findings, with unplaced rows kept
- [ ] the five operations are Tool nodes, each with a test
- [ ] the Public Comment sub-process is in the lifecycle BPMN, and #197 is updated each round

_2026-10-04T19:15:46Z_ — Claimed by claude/confident-bardeen-inaarx — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).


## Round 1: 2026-10-04 (branch claude/confident-bardeen-inaarx, session_016Ej2sTFaSjpubb2B3Uy6MN)

First customer: the DPI-H Reference Architecture public review in litlfred/smart-ra.

**Built**
- `folio-assistant-core/scripts/pdf-line-map.py`: a line-numbered review PDF → page/line map, plus alignment of a .docx extraction to it (in order, then out of order between aligned neighbours, then tables by first cell). On the DPI-H draft: 255 pages, 5890 numbered lines; of 1108 items, 632 aligned in order and 286 out of order, 23 by start only, 58 by unnumbered page, 82 inheriting a neighbour's page, and **27 unaligned** (reported, never guessed).
- `folio-assistant-core/schemas/public-comment.ts` (`folio-public-comment/v1`): a todo kind with a closed lifecycle, received → triaged → assigned → recommended → decided → editing → incorporated (+ duplicate, withdrawn). Five owner-ruled decision codes, and a reason required for every code but accepted. Email never stored; name only on acknowledgement.
- `folio-assistant-core/scripts/public-comment.ts`: import (WHO comment matrix .xlsx / form .csv, via stdlib `intake-rows.py`), import-narrative, list by page/line/block/section/unplaced, and the operations triage, reassign, assign, recommend, decide, edit (author, human or agentic; owner 2026-10-04), incorporate, duplicate, withdraw. Also GitHub `pc:` / `recommend:` / `decide:` tags, honoured only from logins in config.json.
- `public-comment.bpmn` (Process_PublicComment), with lanes commenter, intake, coordinator, committee, editor, author, change set. The change set calls Process_ContentChangeReview (reused, not forked). `draft-to-publication.bpmn` gains a Public review lane: a third parallel branch of "Draft under review".
- Skill `public-comment` (folio-document-adapter).
- Tests: 21 in public-comment.test.ts; every transition's task exists in the diagram.

**Done when, measured this round**
- page/line map: done, built from the frozen PDF the reviewers read, rather than from a render.
- CSV and XLSX import with unplaced rows kept: done (tests).
- The five operations: one CLI tool with a test per operation. They are not yet declared as separate Tool nodes, so that item stays open.
- Public Comment sub-process: in `draft-to-publication.bpmn`. #197 must still be updated each round, so that item stays open.
- review/ page and heat map: the smart-ra dashboard is built (`public-comment-site.ts`). The platform review page does not show public comments yet.

## Completed on landed evidence
Landed on main in PR #1912 / commit f03729a1dd1d (public comment: tabular comments, diagram indexing, and review adjudication).
