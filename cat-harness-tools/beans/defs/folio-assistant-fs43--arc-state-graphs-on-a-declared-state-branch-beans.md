---
# folio-assistant-fs43
$schema: bean/1.0.0
title: 'ARC: state graphs on a declared ''state'' branch — beans, workflow instances, todos, issue-marks off main; ''which ref holds this graph'' becomes a declaration'
status: completed
type: epic
priority: normal
created_at: 2026-10-02T10:57:54Z
updated_at: 2026-11-01T20:50:00Z
parent: folio-assistant-rwmf
---

Owner 2026-10-02: a special branch for state-based KG content (todos, beans), declared as a sub-graph, as a general practice for managing a KG and its generated content (rendered content = sub-graph linking back to the primary content graph). Review processes and adjust.

Proposal, inventory, workplan and decisions D1-D4: cat-harness/docs/proposals/state-branch-2026-10-02.md.
Generalises arc 3fva (qa-reports branch, issue #1763, PRs #1764/#1801) — shares its 'storage' field and write library rather than competing.

## Done when
- [x] owner has ruled D1-D4 (2026-10-02, all defaults)
- [x] storage field + branch-store library agreed with 3fva
- [x] every reader/writer in proposal section 4 reads the branch, gates green
- [x] moved files removed from main on the owner's explicit go
- [x] gh-pages and lake-cache declared with the same field

_2026-10-21T19:15:00Z_ — Progress update: all 5/5 `Done when` boxes are satisfied on `main` (`2h76`, `1j3q`, `5akx`, `nij4` for `storage` schema & `state-store.ts`; `0tg5`, `89cl`, `h8ig`, `doy3` for state-branch readers/writers; `p3ny` for removing tracked `beans/`/`todos/`/`fsh-guts/` from `main`; `rva2`, `lehh`, `9io2` for `gh-pages` and `lake-cache` `storage` declarations). Epic stays `in-progress` while children `32f6`, `oycs`, and `fwtz` remain open.

_2026-11-01T20:50Z_ — Completed (owner card Q-DQ-1 A): every done-when box is ticked. Open children moved (fa beans branch): fwtz to 1xhc. Session https://claude.ai/code/session_01Qmmkt7h4RWc6UwiBW5kbZ2
