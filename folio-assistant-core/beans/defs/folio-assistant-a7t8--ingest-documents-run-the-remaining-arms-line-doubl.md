---
# folio-assistant-a7t8
$schema: bean/1.0.0
title: ingest-document's 'run the remaining arms' line double-nests the pdf-images output
status: completed
type: bug
priority: normal
created_at: 2026-09-22T20:13:04Z
updated_at: 2026-09-30T00:28:36Z
parent: folio-assistant-slw1
---

Hit while ingesting the SWOT paper, 2026-09-22.

## What happened

`bun run cat ingest <pdf>` stages, then prints:

> Next: run the remaining arms with `-o ingest-staging/<slug>`, then: ... --promote

Following that literally:

```
python3 cat-harness/scripts/pdf-images.py -o cat-harness/ingest-staging/gurel-tat-2017-swot-analysis <pdf>
  wrote cat-harness/ingest-staging/gurel-tat-2017-swot-analysis/gurel-tat-2017-swot-analysis/images.json
```

**The slug appears twice.** `pdf-images.py` composes `<out>/<slug>/` itself, exactly as `pdf-pages.py` does, which is why the staging step used `-o ingest-staging` and landed correctly. The guidance line names the deeper path, so the two arms disagree about what `-o` means.

## Why it is worse than a wrong path

It fails SILENTLY in the direction that reads as success. `pdf-images.py` exits 0 and prints the file it wrote, so the arm looks done. The next `--promote` then reports `image-descriptions: no images.json` -- a requirement failure pointing at the arm you just ran, with no indication the output went one directory too deep. Working it out means reading the arm's source.

Same class as the three `'scripts/<name>.py'` CWD-relative paths that module's own docstring describes as "the least visible place a path can hide".

## Two candidate fixes, not chosen here

1. **Fix the message** -- print `-o <staging-root>`, matching what the arms do. One line, and it makes the printed recipe copy-pasteable.
2. **Fix the arms** -- have `-o` mean the entry directory everywhere, and have `ingest-document` pass the parent. Bigger, and it changes a published CLI.

(1) unless somebody wants (2). Either way `l1-blocks.ts` takes `-o <staged-entry-dir>`, the DEEP path, so today three arms use two conventions and nothing says which is which. That is the finding, more than the wrong line.

## Done when

- [ ] the printed recipe works when copy-pasted, for every arm it names
- [ ] the two `-o` conventions are reconciled, or each arm's `--help` says which it takes
- [ ] a test pins it, since this failure mode exits 0


_2026-09-29_ — **Re-parented `ahvw` → `slw1`** by subject, per todo-manager §"WHICH parent" (owner choice '1 2 3' on the LSI epic-filing proposal, bean ansc). A defect in ingest-document's printed next step belongs with the ingest pipeline.


## Closed on evidence (2026-09-30) — the work had already landed
Re-derived against HEAD, not taken from a commit message:
- [x] printed recipe — the 'run the remaining arms' line no longer exists; withDerivedArms (cat-harness/scripts/ingest-document.ts) runs every arm in code, handing each the directory it wants (comment at the stage-mode report explains the deletion). Nothing left to copy-paste wrong.
- [x] conventions stated — pdf-images.py --help: '-o OUT library root; the sidecar lands in <out>/<doc-id>/'; l1-blocks.ts usage: '-o <staged-entry-dir>'. Not reconciled, but each --help says which it takes, and the only caller passes the right one.
- [x] a test pins it — cat-harness/scripts/tests/ingest-and-l1.test.ts:614-626 asserts pdf-images and pdf-vector-labels get the staging ROOT and l1-blocks the ENTRY dir.

_2026-09-30T00:27:58Z_ — Claimed by claude/brave-hawking-511rrx — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).
