---
# folio-assistant-3srh
$schema: bean/1.0.0
title: TEN GATES HAVE NOT DECLARED @covers, so every audit-coverage verdict is an upper bound
status: completed
type: task
priority: normal
created_at: 2026-09-24T05:44:18Z
updated_at: 2026-09-24T13:08:48Z
parent: folio-assistant-1swy
---

`bun run cat audit:coverage` (bean `xutg`) reports coverage per declared graph kind
from `@covers` lines gates carry in their own module docblocks. 118 scripts
declare; **10 gates have not said**, measured 2026-09-24:

- `check:agents-claims`
- `check:context-emission`
- `check:image-roles`
- `check:avatar-instances`
- `check:asset-roles`
- `check:retired-front-matter`
- `check:wireframes`
- `check:partition`
- `avatars:css:check`
- `navbar:geometry:check`

They were left undeclared **on purpose**: each one's docblock did not settle
which declared kind its subject is, and a fabricated `@covers` is worse than
none — it credits a kind with coverage nobody checked. Under-claiming is
recoverable; the report counts the gap and states every "unaudited" verdict as
an upper bound while any remain.

## What each one needs is a reading, not a guess

Several are about the visual layer — avatars, wireframes, image and asset roles
— whose nodes are declared in code (`schemas/avatars.ts`) rather than in a
graph directory. If that is right, `@covers none` is the honest answer and the
reason belongs on the line. `check:retired-front-matter` and
`check:agents-claims` span several kinds and need their scan set read, not
inferred from their titles.

## Done when

Every gate CI runs has declared, and `bun run cat audit:coverage:strict` can be
wired — at which point `--require-all` becomes meaningful and the
`kinds-unaudited` family stops being an upper bound.

## Summary of Changes

Resolved 2026-09-24. All eleven declared, by reading each one's **scan set**
rather than its title — which changed two answers:

- `check:retired-front-matter` is **`computed`**, not a list: its set is
  `kgRoots(instance)` plus the `.claude/skills/` convention, which is not a
  declared graph at all.
- `check:agents-claims` covers **`code`**, not `docs`: it grades the symbols and
  paths a prose claim names, and `AGENTS.md` itself is a node of no declared
  graph.

Two are `none` on one ground — `gen-avatars-css` and `gen-navbar-geometry-css`
generate a stylesheet from a MODULE rather than from a graph directory.

Final: 126 declare a kind, 11 `none`, 3 `computed`, 5 no script, **0 have not
said**. CI enforces it with `audit:coverage:require-all`, wired on the reasoning
`check:skills` uses: green on this tree, so it locks in a property the repo HAS.

**The finding did not move.** The same four kinds, now a verdict rather than an
upper bound — which is what closing a denominator is for. Bean `3oqj` took them.
