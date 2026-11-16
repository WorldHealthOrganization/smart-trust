---
# folio-assistant-vsv4
$schema: bean/1.0.0
title: 'voices visualiser: 7 wireframe findings'
status: completed
type: task
priority: normal
tags:
    - wireframe-findings
    - ui
    - visualiser-voices
created_at: 2026-09-23T10:36:15Z
updated_at: 2026-10-07T17:30:00Z
parent: folio-assistant-4ccr
---

Findings from the as-is wireframe `cat-harness/docs/wireframes/voices/` (intent.md, as-is.html, checks/), observed at 1280×800 and 390×844. Verbatim from its `## Findings`; a finding tagged → is also covered by that cross-cutting bug.

1. **The citations cannot be opened.** The page tells the reader to "uphold a finding by opening the citation", but a citation such as `who-pub-tps-931#page-014, p14` is plain text in a `<span class="cite">`. The page has **no links at all** (checked on `voices/` and `voices/who-style-guide/`). `who-pub-tps-931` is the slug of an entry on the library page, and nothing here leads to it. (→ `folio-assistant-qgjh`)
2. **The summary counts do not follow the filter.** On `voices/who-style-guide/` (preset to that instance, 3 voices showing), and after choosing an instance on `voices/`, the chips still read "7 voice(s) · 66 rule(s) · …". A per-instance page opens by reporting the whole repository's totals.
3. **No rule is visible until a card is opened, and on a phone the first card starts below the first screen.** All 7 cards start closed. At 390×844 the first card starts at y = 851. Opened, its first rule is at y ≈ 1437, about 1.7 screens down. Closed cards are 357 to 683 px tall at 390 px (169 to 232 px at 1280), because each summary carries the full description paragraph and the metadata line.
4. **Headings sit inside the disclosure control.** Each voice's `h2` is inside its `<summary>` (7 of 7), which assistive technology exposes as a button. Heading navigation and the button's name both then carry the whole summary text, including the description and the metadata line.
5. **The ▸/▾ marker is detached from the title.** It sits alone on a line above the heading, at the card's top-left, and is small, so on a phone it does not read as the thing to tap. The whole summary is in fact the target.
6. **Markdown shows through as raw text.** Descriptions show literal backticks ("an override under \`vendors/\`, declaring this voice in its \`extends\` field"). (→ `folio-assistant-mylx`)
7. **The directory table breaks words at 390 px.** "agent- / skills", "folio- / assistant- / core", and the monospace directory paths wrap mid-segment ("folio-assistant- / core/skills/voices").

When fixed, re-draw `cat-harness/docs/wireframes/voices/` and re-run `bun run cat wireframe:check` and `bun run cat check:wireframes`.

## Re-verified 2026-09-29 on `main` 35402147f

Each finding re-measured on a local build of that commit, at 1280×800 and 390×844, both colour schemes where contrast is involved. 7 still present, 0 fixed, 0 could not be determined. FIXED means observed on the built page, not read from code.

- **STILL-PRESENT** — Citations cannot be opened; no links: 102 span.cite, 0 contain or sit in an <a>; 0 links outside the nav on voices/ and voices/who-style-guide/ (e.g. 'who-pub-tps-931#page-014, p14'). A nav.fa-nav now exists, but it does not reach citations.
- **STILL-PRESENT** — Summary counts do not follow the filter: #inst preset 'who-style-guide', 3 voice cards shown, chips still read '43 voice(s) 102 rule(s) 63 citing an ingested source 39 citing a KG node …' (whole-repo totals).
- **STILL-PRESENT** — No rule visible until a card is opened; first card below first screen on phone: 43 cards, 0 open at rest. At 390x844 first card y=1020 (was 851), first rule when opened y=1470; closed cards 430–812px tall at 390, 169–232px at 1280.
- **STILL-PRESENT** — Headings sit inside the disclosure control: 43 of 43 cards have h2 inside <summary>; summary text length 564 chars for the first card.
- **STILL-PRESENT** — ▸/▾ marker detached from the title: summary::before content '▸' 15px inline-block on its own line; h2 starts 35px below the summary top (screenshot confirms marker alone above heading).
- **STILL-PRESENT** — Markdown shows through as raw text: Descriptions contain literal backticks, e.g. "moved out of the role's own `voice` field", "derived from Role `adjudicator`" (div.vmeta).
- **STILL-PRESENT** — Directory table breaks words at 390: At 390x844 8 cells wrap mid-segment: 'folio-assistant-core' 3 lines, 'folio-assistant-core/skills/voices' 4 lines, 'agent-skills/skills/voices' 3 lines, etc.

## Re-verified 2026-09-30 on `main` 3779d5d27

Each finding re-measured on a local build of that commit (`preview-site.sh`, served at `/folio-assistant/`), at 1280×800 and 390×844, both colour schemes where contrast is involved. 6 still present, 1 fixed, 0 could not be determined. FIXED means observed on the built page, not read from code.

- **FIXED** — Citations cannot be opened; no links: Changed since 2026-09-29. 102 of 102 span.cite on /cat-harness/voices/ contain an <a>: library citations go to the viewer deep link and the item page, and KG-node citations to the file's 'source'. On /voices/who-style-guide/ it is 25 of 25 (e.g. 'who-pub-tps-931#page-014' → ../../../cat-harness/library/who-iris/#who-iris%2F…). The local targets resolve. — #1592 (qgjh.mjs, D/p_vo3.js, linkcheck.mjs)
- **STILL-PRESENT** — Summary counts do not follow the filter: On /voices/who-style-guide/ #inst is preset to 'who-style-guide', and the chips still read '43 voice(s) 102 rule(s) 63 citing an ingested source 39 citing a KG node …', which are whole-repo totals. (D/p_vo3.js)
- **STILL-PRESENT** — No rule visible until a card is opened; first card below first screen on phone: 43 cards, 0 open at rest. At 390×844 the first card is at y=1020 and the first rule when opened at y=1470. Closed cards are 430–812px tall at 390 and 169–232px at 1280. (D/p_vo4.js)
- **STILL-PRESENT** — Headings sit inside the disclosure control: 43 of 43 cards have their h2 inside <summary>. (D/p_vo4.js)
- **STILL-PRESENT** — ▸/▾ marker detached from the title: summary::before is inline-block 15px on its own line. The h2 starts 35px below the summary top. (D/p_vo4.js)
- **STILL-PRESENT** — Markdown shows through as raw text: The descriptions (div.vmeta) still contain literal backticks, e.g. "moved out of the role's own `voice` field (#1168)". (D/p_vo2.js)
- **STILL-PRESENT** — Directory table breaks words at 390: At 390×844, 8 cells wrap mid-segment: 'folio-assistant-core' 3 lines, 'folio-assistant-core/skills/voices' 4 lines, 'agent-skills/skills/voices' 3 lines, etc. (D/p_vo3.js)

## Completed on landed evidence
Landed on main in PR #1592 (References become links; replica band; dark-theme tag contrast).
