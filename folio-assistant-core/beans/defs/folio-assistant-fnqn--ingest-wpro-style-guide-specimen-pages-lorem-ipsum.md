---
# folio-assistant-fnqn
$schema: bean/1.0.0
title: 'INGEST: WPRO style guide specimen pages (Lorem ipsum, font, table and graph samples) read as prose'
status: completed
type: task
priority: normal
created_at: 2026-09-29T21:51:12Z
updated_at: 2026-09-29T23:40:09Z
parent: folio-assistant-slw1
---

wpr-rdo-2020-003-eng pp. 29-31 (Lorem-ipsum cover samples, cosine ~1.0), pp. 14-15 (font specimens), pp. 20-22 (table/graph samples), p. 28 (Latin filler) are the source's own specimens, not prose — yet they feed summaries (x80s), translation and every index as ordinary text. Done when: a section/block can be marked specimen/non-prose (the way image roles mark decorative images) and these pages carry it.

Found 2026-09-29 by the LSI/CA analysis of who-iris (bean ansc, report cat-harness/docs/proposals/lsi-who-iris-2026-09-29.md); lsi:near found no existing bean >= 0.7.


## Summary of Changes (2026-09-29)
- Mechanism: schemas/section-verdicts.ts (folio-section-verdicts/v1, registered on the library kind) — the section analogue of image-verdicts.json: a library-root judgement file, role 'specimen', each verdict with what was SEEN. Absent file = empty; invalid file THROWS. Tests: schemas/section-verdicts.test.ts.
- Marked by MEASUREMENT (>= 90 words, >= 40% not English): WPRO pp. 14, 15, 28, 29, 30, 31 (42-68%; next real page 18%). pp. 20-22 REJECTED though the LSI analysis proposed them: their samples sit beside real guidance ('Avoid combining red and green'), and p22's table is real framework text.
- Consumers: scripts/lsi.ts unitsOf skips specimen sections (who-iris index: narrow dimensions 2 -> 0, near-duplicate pairs 12 -> 9). scripts/summaries.ts keeps them IN the backlog but carries role 'specimen' and gives summaries:next an instruction to describe what the page exhibits and keep its guidance line — dropping them would lose lines like 'Spine must be minimum 3/8" W'.
- Not done: translation extraction — the library is not translated today, so there is no consumer to honour the role; the enum is closed so a role arrives with its consumer.
