---
$schema: folio-memory/v1
id: who-owns-which-file-the-split-agents-get-wrong
label: stable
summary: "who owns which file (the split agents get wrong)"
createdAt: 2026-09-19
archived: true
---
> **Archived 2026-09-19.** Its only reader, the `content-pipeline-navigator`
> subagent, was retired. Kept rather than deleted: the record of what was
> learned outlives the mechanism that carried it, which is why a work item is
> `scrapped` and not removed. Not injected into any agent's prompt —
> `platform-boundary-guard` was already at 189 of its 200 lines, so there
> was nowhere to put it without pushing an entry past the line the harness
> silently truncates at.

**This repo (the platform)** holds the pipeline that *acts on* content:
`validate.ts`, `render-latex.ts`, `render-markdown.ts`, `build.ts`,
`qa-sweep.ts`, `qa-staleness.ts`, `profile-check.ts`, `export-bibtex.ts`,
`citations.ts`, the `validate-*` family, and every
schema under `schemas/` (`types.ts`, `constraints.ts`, `builders.ts`,
`block-kinds.ts`, `block-qa.ts`, `lean-packages.ts`).

**The CONTENT layer (the harness above this one)** holds the pipeline scripts whose
subject is a folio's content rather than the harness. `build-glossary.ts` and
`codemod-refterm.ts` moved there on 2026-09-30 (work item `yj6r`) and are named here
because this list carried `build-glossary.ts` on the platform side until then.
`cat-harness` declares `needs: ["bootstrap"]` and core sits ABOVE it, so a
harness module importing core's `schemas/glossary.ts` was an import against the
harness's own declaration — and a circular dependency between repositories once
the split lands. They are
still addressed as pipeline scripts by id; `resolvePipelineScript` searches the
folio, then the platform, then the content harness's `scripts/`.

**A folio** holds its own audit scripts — vacuity/axiom, clarity, orphan,
trace-convention, and so on — under its own `content/pipeline/`.

A folio reaches the platform through a clone-plus-symlink (in qou,
`scripts/setup-folio-assistant.sh`), so from inside a folio the platform
paths are prefixed `folio-assistant/`. **Check which side a script is on
before invoking it**; qou's own `AGENTS.md` carries this warning because the
wrong guess is a path that does not exist.

Several convenience aliases were dropped in that migration and not re-wired
(`validate-refs`, `export-bibtex`, `migrate-lean-refs`). Do not assume a
`bun run <shortcut>` exists — check `package.json` on the side you are on.
