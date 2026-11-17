---
# folio-assistant-yg4c
$schema: bean/1.0.0
title: 'INGEST: WHO Editorial Style Manual OCR errors (''nome'', ''Manval'', ''opproved'') are strong enough to shape an LSI dimension'
status: completed
type: bug
priority: normal
created_at: 2026-09-29T21:51:12Z
updated_at: 2026-09-29T23:26:00Z
parent: folio-assistant-slw1
---

who-pub-tps-931 went through the OCR rung; recurring misreads are frequent enough to load LSI dimension 2 of the per-document index. Done when: the misreads are counted, and either corrected at ingestion or re-OCR'd, with the count going to zero.

Found 2026-09-29 by the LSI/CA analysis of who-iris (bean ansc, report cat-harness/docs/proposals/lsi-who-iris-2026-09-29.md); lsi:near found no existing bean >= 0.7.


## Summary of Changes (2026-09-29)
- Measured: of 5,574 word types in who-pub-tps-931, 1,077 are in neither an English dictionary (pyspellchecker) nor the other two WHO documents; 206 of those are edit-distance-1 from a word this manual itself uses >= 3 times (356 tokens). MOST ARE NOT ERRORS — the manual lists local place names (Kenia, Kuweit, Lisboa, Mauritanie, Belau/Belew), French terms (ligne, titre, signe), abbreviations (ILO, IgG, CTT), author names (Cahn) and suffixes (-ise, -ize, -tion) as its subject matter. A spell-checker would 'correct' the style guide's content, so nothing was corrected automatically.
- Corrected (each VERIFIED against the rendered page image, applied in context, to the OCR cache AND the sections so a re-derivation from the cache keeps them): Style Manval->Manual 21, Treland->Ireland 3, opproved->approved 2, (approved|other) nome->name 6, en tule->en rule 2, 'Tris a great secret'->'It is a great secret' 1, isoleucine Tle->Ile 1, Tle Maurice->Ile Maurice 2, Mogambique->Moçambique 2. 40 tokens, 30 pages. structure.json counts updated (1 section changed length).
- Verified NOT errors: Belau, Belew (printed so, p115); tris (prefix, p61); Cahn (author); Er Riad; CTT.
- Not done: the remaining ~197 candidate types are unverified. A fresh OCR run (none available here: no tesseract) would re-introduce these misreads unless re-corrected — the correction list above is the record to re-apply.
