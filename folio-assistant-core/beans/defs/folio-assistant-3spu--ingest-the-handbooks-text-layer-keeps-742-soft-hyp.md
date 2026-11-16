---
# folio-assistant-3spu
$schema: bean/1.0.0
title: 'INGEST: the Handbook''s text layer keeps 742 soft hyphens (U+00AD) that split words in library sections'
status: completed
type: bug
priority: normal
created_at: 2026-09-29T21:51:12Z
updated_at: 2026-09-29T23:21:35Z
parent: folio-assistant-slw1
---

9789241548960-eng carries 742 U+00AD in 186 section files ('recommenda­tions', 'organi­zation'); the two style guides carry none; 21 sections in other libraries do too. The LSI tokenizer now joins them (tokenizer v2), but the section TEXT still carries them, so summaries, translation extraction and any lexical grep see fragments. Done when: the PDF rungs normalise U+00AD (join across the line break) and a check reports any section still carrying one.

Found 2026-09-29 by the LSI/CA analysis of who-iris (bean ansc, report cat-harness/docs/proposals/lsi-who-iris-2026-09-29.md); lsi:near found no existing bean >= 0.7.


## Summary of Changes (2026-09-29)
- scripts/_pdf_text.py: join_soft_hyphens, one function both rungs import (pdf-structure after the OCR swap, pdf-pages after page_texts), so they cannot disagree. Real hyphens (U+002D, U+2010) untouched. Test: scripts/tests/pdf-soft-hyphen.test.py (8/8, incl. both rungs wired).
- Existing library text corrected with the SAME function: 790 soft hyphens joined in 207 section files across 5 documents (Handbook 186; smart-base 9789240010567-eng 9, 9789240093362-eng 4, 9789240120747-eng 6, 9789241511766-eng 2). structure.json n_chars/n_words updated for exactly those sections, in each file's original JSON format (counts verified to reproduce on untouched text first, 696/696).
- Gate: check:soft-hyphens (CI step) fails on any U+00AD in declared libraries' section text.
- Not changed: three vector-labels.json labels ending in U+00AD — positioned figure labels whose other half is a separate box; joining needs geometry, not a text rule.
