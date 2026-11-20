---
# folio-assistant-8iqc
$schema: bean/1.0.0
title: 'Library QA after ingestion: titles, bibliographic metadata, placeholder blocks and summary backlog are never judged'
status: completed
type: feature
priority: normal
created_at: 2026-10-01T16:39:43Z
updated_at: 2026-10-07T17:24:00Z
parent: folio-assistant-slw1
---

Issue [#1794](https://github.com/litlfred/folio-assistant/issues/1794).

A library entry is never judged after ingestion or the KG build. Measured on main (59 entries): 24 titles equal the slug, at least 5 are implausible (who-pub-tps-931 is 'Abies', OCR noise off a scanned cover), 0 of 59 carry author or year, and who-pub-tps-931 shows 121 'Page N (no content carried)' blocks over 25,714 OCR words.

## Done when
- `bun run cat check:library-qa` writes a committed qa-results/v1 sidecar under `cat-harness/test/results/` with one family per criterion of #1794 (title-missing, title-implausible, bibliographic-missing, block-no-content, summary-backlog), each finding naming the entry, its instance and the source field read.
- `check:library-qa:check` is in CI and fails only on a stale sidecar or a could-not-determine entry; findings are advisory.
- The cause of 'Abies' and of the empty blocks is traced to code and reported on the PR.


## 2026-10-01 — withheld rows in the viewer (PR #1818, stacked on #1799)
Owner ruling on #1794, option 1 ("fix the viewer now"): a withheld entry's row shows its summary when it has one, otherwise "Withheld — copyright and restrictions not granted" with a link to the catalogue record. The entry gets a banner (why, which gate, the record link, N of M sections summarised). Other empty blocks keep the neutral "(no content carried)". Withheld is read from withheld.json, which now carries structured gates[] and record{id,page,uri} written by gen-iris-pages. Row and banner code: cat-harness/scripts/lib/library-withheld-view.ts. Tests: library-withheld-view.test.ts and library-withheld-viewer.e2e.ts. Drafting the summaries is folio-assistant-r96p (todo).

## 2026-10-01 — title authority order implemented (PR #1822, stacked on #1799)

The owner ruled, choosing option 2 of 4: catalogue record (DC) → referenced.json → PDF Info /Title → slug, and never the page-1 parse. That is now implemented in one resolver (cat-harness/content/pipeline/library-title.ts), used by gen-library-jsonld and check-library-qa. Manifests record meta.title_source and meta.title_from. pdf-pages.py now writes metadata.docinfo, and --docinfo-into backfilled 23 entries after checking each sha256. 59 entries: dc-record 3, referenced 2, pdf-info 29, text-heading 6, slug 19 (was 25 slug/file-name). who-pub-tps-931: Abies -> WHO editorial style manual. QA: title-missing 25->19, title-implausible 15->1. All 8 mutation runs went red. Open interpretation for the owner: text/notebook sources take their declared heading (text-heading) at the pdf-info rank.

## Completed on landed evidence
Landed on main in PR #1822 (Library titles: catalogue record → referenced.json → PDF /Title → slug (#1794, stacked on #1799)).
