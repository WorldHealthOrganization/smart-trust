---
# folio-assistant-x5o1
$schema: bean/1.0.0
title: 'GLOSSARY: seed the who-style-guide glossary from the WHO Editorial Style Manual Annex 1 (preferred spellings)'
status: completed
type: task
priority: normal
created_at: 2026-09-30T00:27:28Z
updated_at: 2026-09-30T09:03:42Z
parent: folio-assistant-lqo9
---

Follow-up of ftu0 (owner chose 2026-09-30: who-style-guide owns the WHO glossary, seeded from the HQ manual's spelling lists).

Annex 1 of the WHO Editorial Style Manual (who-iris/library/who-pub-tps-931, OCR pages ~86-102) lists preferred spellings, most with a REJECTED variant in brackets: 'immunological (not immunologic)', 'inflection (not inflexion)', plus sense-split pairs 'indexes (of texts)' / 'indices (mathematical)'. Roughly 400-600 entries.

OPEN DESIGN QUESTION (blocking, for the owner): a rejected spelling is not an equivalent name. SKOS altLabel means 'also acceptable'; SKOS hiddenLabel means 'findable but not shown' — the closer fit for a spelling to avoid — but folio-glossary/v1 has no hiddenLabel field. Options: (a) add hiddenLabel to the glossary schema and record rejected forms there; (b) record spellings as rules in the who-editorial voice (9 rules today, none on spelling) and keep the glossary for stated equivalences only; (c) both.

Extraction is OCR: every entry must be checked against the page image (yg4c found OCR errors on these pages). Status of each term: candidate until inspected.


## Summary of changes (2026-09-30)
Owner chose: **rules in the who-editorial voice** (not glossary hiddenLabels).
- 16 rules added to who-style-guide/skills/voices/who-editorial/voice.json: who-ed-spelling-general (the Annex's own general rule: The concise Oxford dictionary's first spelling; quoted from p. 88) and who-ed-spelling-annex-p088 … p102, one per page, each citing its section and quoting its page's entries as printed.
- 122 entries → 135 terminology pairs. Every entry was read from the PAGE IMAGE (PDF rendered at 110 dpi), not the OCR text layer, which drops entries: p. 93's text layer has 1 '(not …)', the page has 4.
- Recorded: italic *not*, *prefer*, *avoid*, *use*, *deprecated*. NOT recorded: a roman 'not' is a gloss ('impractical (not practical)' defines the word); entries that only state a spelling are covered by the general rule.
- Worth knowing, now in the rules' context fields: International Labour Organisation keeps -ise (proper name) against who-ed-ize-preferred; sulfur (not sulphur) against the British default; geographical (not geographic) but bibliographic (not bibliographical); case-only pairs (gonococcus/Gonococcus, vitamin A/Vitamin A, X-ray/x-ray) are marked case-sensitive.
- check:voices and check:voice-skills pass.
- Found in passing, NOT fixed: section page-102 reads 'wage-eamer' where the page image reads 'wage-earner' (rn→m, the yg4c class).
