---
# folio-assistant-u9lb
$schema: bean/1.0.0
title: 'TOC benchmark: score Nougat on the 13 outline PDFs (needs huggingface.co) (#2302)'
status: completed
type: task
priority: normal
tags:
    - rehomed
created_at: 2026-10-06T18:05:01Z
updated_at: 2026-10-16T06:30:00Z
parent: folio-assistant-cp3v
---

Follow-up to bean cp3v / PR #2303 (issue #2302). Needs an agent with network access to huggingface.co (Nougat weights); the cp3v session's container is denied it.

Branch from claude/compassionate-johnson-rzv00r and open a PR INTO that branch (or into main once #2303 has merged). Do not edit _pdf_headings.py.

## Steps
- [ ] pip install nougat-ocr (weights: facebook/nougat-small; nougat-base if a GPU is available)
- [ ] List the PDFs: python3 -c "import glob,pymupdf;[print(p) for p in glob.glob('**/*.pdf',recursive=True) if 'node_modules' not in p and len(pymupdf.open(p).get_toc())>=5]" (13 files on 2026-10-06)
- [ ] Run: nougat <pdf> -o /tmp/nougat-mmd -m 0.1.0-small (one <stem>.mmd per PDF). Skip the 534-page iHRIS handbook on CPU and say so.
- [ ] Score: python3 cat-harness/scripts/toc-benchmark.py --methods regex,font,layout,nougat --nougat-mmd /tmp/nougat-mmd --json /tmp/nougat.json
- [ ] Add a nougat row and per-document column to cat-harness/docs/research-and-analysis/toc-extraction.md; note link F1 is not measurable (Nougat marks no page boundaries), and record model, device and wall time
- [ ] python3 cat-harness/scripts/tests/pdf-toc-layout.test.py stays green; commit, push, PR

## Done when
The report carries measured Nougat numbers next to layout's 0.86 title F1, with the run conditions stated, or says exactly what prevented the run.


## Owner decision

Asked 2026-10-10 by the bean-backlog drain (lane C). The benchmark is `scripts/toc-benchmark.py` in cat-harness-tools, and running it needs huggingface.co on the network allowlist. None of it lives in
folio-assistant-core, and AGENTS.md's one rule ("core owns content vocabulary;
the harness owns the harness") puts it outside this store's reach.

1. **(Recommended) Rehome to `litlfred/cat-harness-tools`'s bean store.** The bean is re-created
   there with this body, and this copy is scrapped with a pointer to the new id.
2. Keep it here as a pointer, and do the work from this store against `litlfred/cat-harness-tools`.
3. Scrap it. The finding no longer matters after the separation.

**Default if no answer:** option 1.


## Rehomed 2026-10-10: this copy is now a pointer

By the owner's ruling of 2026-10-10 (move to the code's repo, and keep a
pointer here), this bean is re-filed in the store of the repository whose code
it changes: **`litlfred/cat-harness-tools` bean `cat-tools-e8vg`** (cat-harness-tools
PR #68). Work it there. This copy stays open as a pointer, and closes when
`cat-tools-e8vg` does.

## Summary of Changes

Rehomed: the work moved to litlfred/cat-harness-tools as cat-tools-e8vg, which is completed there. This copy closes as a pointer to it, so the two stores agree (bean drain, 2026-10-14, session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs).


## Completed 2026-10-12 (mirror of cat-tools-e8vg, lane B)
cat-harness#168 (merged) reports Nougat-small, measured on CPU over 10 of the 13 outline PDFs: title F1 is 0.81, against layout's 0.87. The weights came from GitHub releases, so huggingface.co was not needed.


_2026-10-16T06:30:00Z_ — Store reconciliation: status `todo` → `completed` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: completed, cat-harness: todo). Evidence: closed in the folio-assistant store copy (2026-10-12); cat-harness#168 merged 2026-10-12. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.
