---
# cat-tools-e8vg
$schema: bean/1.0.0
title: 'TOC benchmark: score Nougat on the 13 outline PDFs (needs huggingface.co) (#2302)'
status: completed
type: task
priority: normal
tags:
    - rehomed-from-core
created_at: 2026-10-10T16:33:42Z
updated_at: 2026-10-12T12:26:34Z
---

**Rehomed 2026-10-10 from `litlfred/folio-assistant-core` bean `folio-assistant-u9lb`** by the owner's ruling (the code this bean changes lives in cat-harness-tools; the core copy stays as a pointer). Body copied verbatim below; history and rulings recorded there remain authoritative up to this date.


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



## Summary of Changes
- Measured, not assessed. cat-harness#168 (merged `e86fdf9`) adds §"Nougat, measured" to `docs/research-and-analysis/toc-extraction.md`. Nougat-small (`0.1.0-small`, nougat-ocr 0.1.17) ran on CPU only (4 cores) over **10 of the 13** outline PDFs, 3.3 h wall time. The 179-, 254- and 534-page documents were not run, and the section says so.
- **Title F1 0.81 against layout's 0.87** on the same 10. Link and full F1 are not measurable, because Nougat marks no page boundaries. It wins on the two papers layout over-predicts and fails on the long WHO guideline (0.43, repeated headings).
- **Correction:** the weights come from nougat's GitHub release assets, not huggingface.co, so the premise of this bean ("needs huggingface.co") was wrong. Also, pypdfium2 must be pinned at 4.20.0, because 5.x dropped `render`.
- `pdf-toc-layout.test.py` is untouched (doc-only change).
