---
# folio-assistant-ftu0
$schema: bean/1.0.0
title: 'GLOSSARY: WHO guideline terms — ''quality of the evidence'' (77) vs ''certainty of the evidence'' (1) as prefLabel/altLabel, and who owns the glossary'
status: completed
type: task
priority: normal
created_at: 2026-09-29T21:51:12Z
updated_at: 2026-09-30T00:27:36Z
parent: folio-assistant-lqo9
---

The Handbook itself names the alternatives (sec-153: quality of the evidence / certainty / confidence in the estimates of effect) — the evidence for the altLabel is that sentence, not a cosine. Other checked pairs: health care / health-care / healthcare (6/14/2); peer vs external review (24/25 — possibly different concepts, do not merge). No -isation drift (all 9 are proper names). Neither who-iris.json nor who-style-guide.json declares a glossary: decide which owns it (proposal: who-style-guide, seeded from the HQ manual's own spelling lists, pp. ~100-102), then write candidates with source = the section stating the equivalence. LSI term neighbours may only be SHOWN as suggested related links, never written.

Found 2026-09-29 by the LSI/CA analysis of who-iris (bean ansc, report cat-harness/docs/proposals/lsi-who-iris-2026-09-29.md); lsi:near found no existing bean >= 0.7.


## Summary of changes (2026-09-30)
Owner chose: who-style-guide owns the WHO glossary. Declared who-style-guide/glossary/ (graph kind glossary) and authored who-style-guide.glossary.json: term quality-of-the-evidence, prefLabel 'quality of the evidence', altLabels 'certainty of the evidence' and 'confidence in the estimates of effect', source = handbook sec-153 (§9.1, p. 122), whose own sentence states the equivalence. Scheme source is the who-guideline-development voice, so the term is minted in who-style-guide's namespace (schemeOwner verified). Rendered on glossary/ by glossary:page. health care/healthcare NOT recorded: no publication states it as an equivalence (the who-editorial voice's capitalization rule already fixes 'primary health care'). Seeding from Annex 1 spellings split to x5o1 — it carries a schema question (rejected spelling is not an altLabel).
