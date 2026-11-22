---
# folio-core-ho43
$schema: bean/1.0.0
title: 'MCP document tools take file paths from tool arguments without containment'
status: completed
type: bug
priority: normal
tags:
    - security
    - security-review-2026-10-31
    - red-flag-security
created_at: 2026-10-31T04:01:25Z
updated_at: 2026-10-31T08:30:00Z
---

Found by the 2026-10-31 security and QA review of the folio-assistant layers (SOP: cat-harness `skills/conduct/security/`, the 16 rules of `skills/voices/secure-code-authoring/voice.json`, RED FLAG categories of cat-harness-tools `schemas/sdlc/red-flag.ts`). No fix PR yet: fixes wait for the owner's go-ahead.

**Category:** security · **Severity:** minor

Path-containment SOP; rules `scz-every-input-is-suspect`, `scz-handover-carries-no-authority`. The MCP server is local (stdio), but its arguments are written by a model that may have read injected text, so they are untrusted.

- `adapters/document/tools/bib.ts:61-64` `bib_export.out`: any output path, written by `export-bibtex`.
- `adapters/document/tools/qa.ts:106-112` viewer `out`: any output directory.
- `adapters/document/tools/validate.ts:328-343` `output_dir`: any directory.
- `adapters/document/tools/validate.ts:108-152` `chapter` and `paper`: joined into paths with no segment check (`autoPaper` in `_pipeline.ts:215` returns the supplied value unchecked).
- `adapters/document/tools/render.ts:656,697` `css`: `resolve(REPO_ROOT, css)` with no containment, passed to pandoc as a stylesheet.

By contrast `document` is checked against a list of real folio directories (`resolveDocumentManifest`, render.ts:487), which is the right shape.

Also: `render.ts:385-407` compiles caller-supplied `latex` and `packages` with pdflatex. Restricted shell-escape is the TeX default, but `\input` can still read files the process can read.

## Done when

- [x] Write paths go through `writableWithin`; `paper`/`chapter` through `safeSegment`; `css` through `resolveWithin`
- [x] A test per tool shows `../` refused

## Summary of Changes

Enforced path containment across `adapters/document/tools/{_pipeline,bib,qa,validate,render,audit,transform}.ts`: output paths/directories (`bib_export.out`, `content_export.out`, `content_build.output_dir`) go through `writableWithin`; `paper`/`chapter`/`document`/`target` segments go through `safeSegment`; `css` goes through `resolveWithin` + `realPathWithin`; `formula_render` validates `packages`, refuses file/shell TeX primitives, and passes `-no-shell-escape`. Added `scripts/tests/document-tools-path-containment.test.ts`.
