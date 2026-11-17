---
# folio-assistant-uphx
$schema: bean/1.0.0
title: 'PUBLIC COMMENT round 2 CRD: requirements from the 2026-10-06 chief-editor walkthrough (categories, committee roll-up, incremental ingest, dedup, editor-only change sets, human/agent adjudication, QA thresholds)'
status: completed
type: task
priority: high
created_at: 2026-10-06T12:31:42Z
updated_at: 2026-10-07T17:32:00Z
parent: folio-assistant-q4jm
---

Source: litlfred/smart-ra@9eb6ad3 (Teams transcript .docx + .vtt of the 2026-10-06 walkthrough with the DPI-H RA chief editor). CRD: cat-harness/docs/proposals/public-comment-round-2-crd-2026-10-06.md. Issue #197. Status: drafted for owner review BEFORE approval; no implementation until approved.

## Done when
- [x] CRD drafted with REQ-### entries, each traced to a transcript timestamp
- [x] the two transcripts compared and the result recorded
- [x] screenshots from the video at the moments the speakers refer to the screen
- [ ] owner approves, amends or rejects each requirement


_2026-10-06T14:20Z_ — Owner: no merging; the chief editor (Chinemerem Eyetan) signs off first. REQ-12 ruled: out of scope = existing `not-accepted` decision with a reason, committee reviews first, no new state. PR #2282 back to draft, ready marker withdrawn.


_2026-10-06T14:40Z_ — Video arrived (smart-ra@5a3d655). Done on this branch: independent Vosk transcript compared (0.802 vs Teams; corrects Leitner, filters; requirement passages agree), 9 screenshots cut and cropped (webp, 476 KB), CRD updated. Defects D-1, D-2, D-2b (owner: filters change nothing visible), D-3 reproduced and fixed in public-comment-site.ts / public-comment-changesets.ts, browser-verified on a rebuilt dashboard, test added. New tool cat-harness/scripts/meeting-recording.py and skill crdm-recorded-walkthrough; public-comment skill updated. Owner: wait to merge main into the branch until the chief editor signs off.


_2026-10-06T15:15Z_ — Added the TWG Coordinator's categorisation-skill specification (smart-ra@bcd7e92, owner on #197: 'please add to requirements') to the CRD as CAT-01..30, mapped to REQ-xx and to what the platform does today. It settles the committee names (8 categories); new open decision: master log vs comment store as the system of record.


_2026-10-06T20:00Z_ — REQ-17 built as common folio-assistant-core functionality (owner): block-actions.ts + Tool block-actions + skill block-actions (folio-document-adapter) + StartEvent_BlockFeedback in public-comment.bpmn. Feature Staging now also previews a conflicted PR (push trigger + conflict-gate).

## Completed on landed evidence
Landed on main in PR #2282 (Public comment round 2: CRD, dashboard fixes, shared edit/feedback links, lazy document pages).
