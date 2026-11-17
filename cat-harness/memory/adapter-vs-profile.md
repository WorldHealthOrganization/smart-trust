---
$schema: folio-memory/v1
id: adapter-vs-profile
label: stable
summary: "adapter vs profile: a different axis, and conflating them is costly"
createdAt: 2026-09-19
archived: true
roles:
  - code-reviewer
references:
  - kind: agent
    id: platform-boundary-guard
---
- **Adapters** (`paper`, `dak`) partition block kinds into **disjoint**
  namespaces. `adapterForKind` is what QA-criterion scoping reads, and it
  must stay **total and unambiguous**.
- **Profiles** (`document`, `paper`) **nest**: every document kind is also a
  paper kind.

Making `document` a third adapter would have made `adapterForKind` ambiguous
on all **eight** shared kinds. When adding a content type, ask whether it
needs different **code** (adapter) or only different **rules** (profile plus
a subclass).

**Archived 2026-09-19** (work item `folio-assistant-4kiw`). Superseded by
`skills/kg/kg-core/placement.md` Step 3, which carries every operative
claim here — disjoint vs nesting, `adapterForKind` staying *total and
unambiguous*, the **eight** shared kinds, and the separating question
(different **code** -> adapter; only different **rules** -> profile plus a
subclass) — as a row of a decision procedure rather than as prose. The
derived-complement fact in the detail below is still reachable: the
surviving "re-measure, do not quote" entry carries
`read schemas/content/block-kinds.ts; DOCUMENT_BLOCK_KINDS must stay derived`, and
`AGENTS.md` §"Content types" states it in full. Retained as a node;
injected into no prompt.

<!-- detail -->

`PaperContentAdapter` extends `DocumentContentAdapter`; `MATH_BLOCK_KINDS` is
written out in `schemas/content/block-kinds.ts` and `DOCUMENT_BLOCK_KINDS` is its
**derived** complement, so a kind added to `BLOCK_KINDS` cannot go
unclassified. Keep that derivation — do not hand-maintain both lists.
