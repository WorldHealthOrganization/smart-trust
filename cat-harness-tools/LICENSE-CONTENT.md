# Creative Commons Attribution 3.0 Unported (CC BY 3.0)

Copyright 2026 Carl Leitner

This file covers the **prose** in folio-assistant. The **source code** is
licensed separately under the Apache License, Version 2.0 — see
[`LICENSE`](./LICENSE) and [`NOTICE`](./NOTICE).

## What this licence covers

| Covered by CC BY 3.0 | Covered by Apache-2.0 |
|---|---|
| `docs/` — the published documentation site | everything else in the repository |
| `skills/**/*.md` — skill instruction bodies | including `schemas/`, `src/`, `scripts/`, `content/`, `adapters/`, `tools/`, `ui/`, `viewer/` |
| `.claude/skills/**/*.md` — local skill instruction bodies | including every `.ts`, `.py`, `.sh`, `.json`, `.yml` and `.bpmn` file, wherever it sits |
| `README.md`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md` | |

Where a file is arguably both — a Markdown skill that embeds a code sample, a
documentation page that quotes a schema — **the code sample is Apache-2.0 and
the prose around it is CC BY 3.0**. If you need one licence for the whole file,
take Apache-2.0: it is the more permissive of the two for reuse in software.

Content authored in a *folio* repository is **not** covered by either licence
here. folio-assistant is the platform; a folio carries its own.

**Third-party skills are not covered either.** A skill package that carries a
`materialization.json` is somebody else's text, synced at a pinned commit
(issue #556). It keeps its **upstream licence**, whose text is the `LICENSE`
file beside it, and neither CC BY 3.0 nor Apache-2.0 applies to it. Those
packages are listed in [`NOTICE`](./NOTICE). The `skills/**/*.md` row above
means the skills authored here.

## Summary

This is a human-readable summary of the
[Creative Commons Attribution 3.0 Unported licence](https://creativecommons.org/licenses/by/3.0/).
This summary is not a substitute for the full licence text.

You are free to:

- **Share** — copy and redistribute the material in any medium or format.
- **Adapt** — remix, transform, and build upon the material for any purpose,
  even commercially.

Under the following terms:

- **Attribution** — you must give appropriate credit, provide a link to the
  licence, and indicate if changes were made. You may do so in any reasonable
  manner, but not in any way that suggests the licensor endorses you or your
  use.
- **No additional restrictions** — you may not apply legal terms or
  technological measures that legally restrict others from doing anything the
  licence permits.

## Licence text

This work is licensed under the
[Creative Commons Attribution 3.0 Unported licence](https://creativecommons.org/licenses/by/3.0/).

To view a copy of this licence, visit
<https://creativecommons.org/licenses/by/3.0/legalcode>, or send a letter to
Creative Commons, PO Box 1866, Mountain View, CA 94042, USA.
