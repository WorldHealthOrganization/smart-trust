---
# folio-assistant-gyoj
$schema: bean/1.0.0
title: Library viewer omits 3 of folio-assistant-sci's 4 library items
status: scrapped
type: bug
priority: normal
created_at: 2026-09-30T09:08:04Z
updated_at: 2026-09-30T10:22:02Z
parent: folio-assistant-4ccr
---

Measured 2026-09-30 while linking methodology sources (bean qgjh). folio-assistant-sci/library/ holds four complete items — arxiv-2406.01940v2, arxiv-2601.22554v1, arxiv-2602.16554v1, milnorlink — each with manifest.jsonld and structure.json. The library projection (cat-harness/docs/assets/library/index.json, written by gen-library-viz.ts) lists only milnorlink for that instance, and its tile says 1 entry. None of the three is in any withheld.json. So the viewer cannot open them, and the three methodology pages citing them (library/arxiv-2602.16554v1, library/arxiv-2601.22554v1, library/arxiv-2406.01940v2) stay unlinked: the qgjh resolver links only what the projection holds. Find why gen-library-viz skips them; library:viz:check reports current, so the generator itself drops them.


## Scrapped 2026-09-30 — the premise was wrong

Re-measured an hour later: `bun run cat library:viz` over the same checkout lists all four folio-assistant-sci items (arxiv-2406.01940v2, arxiv-2601.22554v1, arxiv-2602.16554v1, milnorlink) — 37 entries in all. The 34-entry projection I measured was a STALE committed artefact, taken from main during a rebase, not something the generator does. So there is no generator bug here; kept scrapped rather than deleted so the next agent who sees 34 entries does not reopen it.
