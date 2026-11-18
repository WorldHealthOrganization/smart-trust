---
# folio-assistant-scfh
$schema: bean/1.0.0
title: 'INGEST SLIDES: pptx+odp rung, a11y probe, KG/folio-asst deck into library, methodology gaps, docs (#1614)'
status: completed
type: feature
priority: normal
created_at: 2026-09-30T14:32:51Z
updated_at: 2026-10-24T07:50:00Z
parent: folio-assistant-slw1
---

Issue #1614. Owner supplied KG__folio-asst as .pptx and .odp. Add a slides rung to bun run cat ingest handling both, report accessibility, ingest the preferred (pptx) into library, list missing methodology sources, improve docs across layers.

## Done when
- [x] slides-structure.py rung + ingest-document.ts routing + tests
- [x] library-ingestion skill updated
- [x] deck ingested to a library with a11y sidecar
- [x] methodology gap list on the issue
- [x] docs pages updated


## Follow-up on this branch (owner, 2026-09-30): ingest methodology sources 1–3 from #1614
- [x] Mehl et al. 2021, Lancet Digit Health 3(4):e213–e216 (primary for SMART L1–L5) → smart-base/library/mehl-2021-who-smart-guidelines (CC BY 3.0 IGO)
- [x] OMG BPMN 2.0.2 (ISO/IEC 19510:2013) → cat-harness/library/omg-2013-bpmn-2-0-2, RECORDED not held (licence forbids posting copies; owner chose record-don't-copy)
- [x] OMG DMN 1.5 (formal/24-01-01, verified) → cat-harness/library/omg-2024-dmn-1-5, recorded not held; now evidence on methodologies/dmn.md

Was waiting on network access (resolved: owner supplied the PDFs, commit 3dab256): the environment's proxy returns 403 for www.omg.org, doi.org, www.thelancet.com, europepmc.org and ncbi.nlm.nih.gov (measured 2026-09-30). Unblocks when the owner allows those hosts or uploads the PDFs.

_2026-10-24T07:50:00Z_ — Closed: every box above is ticked and nothing in the body is still open. The deck now also has 13 draft block summaries (bean x80s, `litlfred/cat-harness#493`). Drain session https://claude.ai/code/session_01TkFVzHu3LN6P5Nj2psquPU.
