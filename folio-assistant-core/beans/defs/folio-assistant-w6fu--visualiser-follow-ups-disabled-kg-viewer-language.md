---
# folio-assistant-w6fu
$schema: bean/1.0.0
title: 'Visualiser follow-ups: disabled kg-viewer language switcher, library title extraction'
status: completed
type: task
priority: normal
tags:
    - wireframe-findings
    - ui
created_at: 2026-10-02T09:01:57Z
updated_at: 2026-10-02T12:05:57Z
parent: folio-assistant-4ccr
---

Follow-up to beans `gnqa` (library) and `yhcq` (kg-viewer), stacked on PR #1839. Owner rulings 2026-10-02 on issue #1838:

1. Library cover size stays 34×46 — no work.
2. **kg-viewer language switcher: shown, DISABLED**, so readers see translations are planned while every catalogue is empty. Accessible: visible reason, `aria-disabled`, an explanation reachable by keyboard and tap (not hover-only), ≥24px targets. A catalogue that gains content enables its locale with no code change.
3. **Library titles of entries with no catalogue record: both, in order** — (a) improve PDF title extraction in the ingest path (PDF `Title` metadata, first-page largest-font heading, the document outline, before raw text; never guess — no trustworthy source keeps the raw title, marked unverified), measured before/after over every library entry; (b) whatever is still wrong is fixed as data in that entry's own metadata, as a recorded editorial correction with its basis.

Claimed by claude/visualiser-followups (session https://claude.ai/code/session_01CVVoavPoCHMLA7AASxG8cH) — issue #1838.

## Done when
- [x] kg-viewer draws a disabled switcher listing the planned languages, with a visible, keyboard- and tap-reachable reason; e2e covers it and the enable-on-content path
- [x] the ingest path resolves titles from corroborated sources and marks the rest unverified; before/after counted over every entry
- [x] remaining bad titles corrected as data, one entry at a time, each with its basis
- [x] before/after screenshots at 1280×800 and 390×844 committed and shown in the PR

## Summary of Changes

- kg-viewer (2bc9e808e): every locale with a .po is drawn; an empty catalogue's locale is an aria-disabled, focusable button with a visible 'Translations coming' disclosure (tap/Enter/Space), 32px targets; a catalogue's first string enables it with no code change. Unit + e2e (35 pass).
- Library titles (a) (792757c15): scripts/_pdf_title.py, shared by pdf-structure.py, pdf-pages.py and ingest-document.ts --refresh-title. Metadata Title, page-1 heading and outline before the text walk; a candidate is taken only when an independent source corroborates it, else the raw title stays with title_verified false and every candidate in title_evidence. Over 57 entries: 19 shown titles changed, 29 verified, slug-only entries 25 -> 18; idempotent. Test: scripts/tests/pdf-title.test.py.
- Library titles (b) (89eb6c2fa): 19 editorial corrections as metadata.title_correction {title, basis, corrected_on, bean} in each entry's structure.json; the manifest says title_source editorial and keeps the extracted title.
- Screenshots: wireframes/kg-viewer/rendered-2026-10-02/switcher-*.png and wireframes/library/rendered-2026-10-02/titles-*.png (1280x800, 390x844).
- Left open (owner question on #1849): kg-folio-asst-2026-09-30 (pptx) and codata-2022 (tabular) are non-PDF entries with no title source.
