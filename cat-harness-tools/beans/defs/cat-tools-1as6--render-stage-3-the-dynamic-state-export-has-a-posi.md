---
# cat-tools-1as6
$schema: bean/1.0.0
title: 'RENDER STAGE 3: the dynamic-state export has a position but no filename — the owner left it open on purpose'
status: completed
type: task
tags:
    - rehomed-from-core
created_at: 2026-10-10T16:33:42Z
updated_at: 2026-10-29T12:10:00Z
parent: folio-assistant-yj32
---

**Rehomed 2026-10-10 from `litlfred/folio-assistant-core` bean `folio-assistant-6h47`** by the owner's ruling (the code this bean changes lives in cat-harness-tools; the core copy stays as a pointer). Body copied verbatim below; history and rulings recorded there remain authoritative up to this date.



Owner, 2026-09-20, settling where the README render sits in the pipeline:

> dynamic content then hets get json/jsonld export avaiable under
> cat-harness/state.jsonld or so (whatever matches the dyanmic state
> vsualizesrs)

**"or so (whatever matches …)" is an explicit uncertainty, and it was not
closed by guessing.** `scripts/render-pipeline.ts` declares the step
(`kg-dynamic`), fixes its POSITION — after every stage-2 renderer has
contributed, fatal on failure — and re-exports the graph as its body. What it
should actually write is open.

## What settles it

The dynamic-state visualisers saying what they read. Until one exists and
names its input, any filename minted here is a published artefact name nobody
chose, and a consumer fetching it would be relying on a guess.

## Done when

[x] A dynamic-state visualiser names the document it reads
[x] `kg-dynamic` writes that, at the path that visualiser resolves
[x] It is distinguishable from the stage-1 current-state export — two
    documents, two names, and a reader can tell which is which

Related: `render-order` skill §"What stage 3 writes is not settled", issue
#592, PR #593.

## Re-measured 2026-10-03 — still blocked on its first box

- `kg-viewer` reads the stage-1 current-state export (`../<stub>.jsonld`), not a dynamic-state document.
- PR #1918 (the newest viewer work open at the time) reads no `.jsonld` at all.
- `kg-dynamic` still writes `state.jsonld` to scratch only; nothing published, nothing consumes it.

So no dynamic-state visualiser yet names an input, and the rule above stands:
no filename is minted here by guess. Left `todo`; re-measure when a viewer
that reads dynamic state opens a PR.


## Owner decision

Asked 2026-10-10 by the bean-backlog drain (lane C). The dynamic-state export is `render-pipeline.ts` in cat-harness-tools. It also waits on a visualiser that names an input. None of it lives in
folio-assistant-core, and AGENTS.md's one rule ("core owns content vocabulary;
the harness owns the harness") puts it outside this store's reach.

1. **(Recommended) Rehome to `litlfred/cat-harness-tools`'s bean store.** The bean is re-created
   there with this body, and this copy is scrapped with a pointer to the new id.
2. Keep it here as a pointer, and do the work from this store against `litlfred/cat-harness-tools`.
3. Scrap it. The finding no longer matters after the separation.

**Default if no answer:** option 1.


## Owner decision above — resolved

The rehome question (option 1) was settled by the owner's ruling of 2026-10-10: this bean IS the rehomed copy, so the question above is closed and must not be re-asked. Kept for history.

## Re-measured 2026-10-20 — still blocked on its first box

At cat-harness-tools `3420b76`, `state.jsonld` and `kg-dynamic` occur only in
`scripts/render-pipeline.ts` (the step, writing to scratch). No viewer, script
or test reads a dynamic-state document, so no filename is minted. Left `todo`;
re-measure when a dynamic-state visualiser opens a PR.

Session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr (cat-harness-tools drain lane, 2026-10-20).

*2026-10-24T14:25:00Z* — Re-measured at cat-harness-tools `46c1625` (session https://claude.ai/code/session_01RzLVMhhApyXYiw4bb9RwG8). `state.jsonld` and `kg-dynamic` still occur only in `scripts/render-pipeline.ts`. No open PR adds a dynamic-state visualiser. Still blocked on box 1, so it is left `todo`.

## Owner decision, 2026-10-29: settled

Lane B cards Q1 (10:19Z–11:34Z): **"A. Publish `<harness>/state.jsonld`"** and **"A. Publish state.jsonld, pages read it"**. The workflow instance pages (bean `v49e`) are the dynamic-state visualiser, and they name `<site>/<harness>/state.jsonld` as their input. `kg-dynamic` runs `scripts/dynamic-state-export.ts`, which writes that document typed `cat-harness:DynamicState` (`$schema: cat-harness-dynamic-state/v1`), separate from the stage-1 export. A store that could not be read is named in `unreadStores`. All three boxes are ticked by litlfred/cat-harness-tools#838's PR. The bean closes when it merges. Session https://claude.ai/code/session_01Qmmkt7rXCDPexdBbNqeJqU

*2026-10-29T12:10:00Z* — **Completed.** The owner chose option A on 2026-10-29 (Lane B card Q1) and OK'd the merge at 12:04Z. Render stage 3 (`kg-dynamic`) publishes `<site>/<harness>/state.jsonld`, typed `cat-harness:DynamicState`, and the workflow instance pages read it: litlfred/cat-harness-tools#839 (53d4497) and litlfred/cat-harness#688 (e134b39). All three boxes are met. Session https://claude.ai/code/session_01Qmmkt7rXCDPexdBbNqeJqU
