---
# folio-assistant-bf5l
$schema: bean/1.0.0
title: 'WRONG DIRECTION on main: cat-harness/schemas/intake.ts imports folio-assistant-core, and two of three checks cannot see it'
status: completed
type: task
priority: high
created_at: 2026-09-26T04:01:42Z
updated_at: 2026-09-26T13:50:15Z
parent: folio-assistant-1xhc
---

`cat-harness/schemas/intake.ts:28`:

```ts
import { ProvenanceSchema } from "../../folio-assistant-core/schemas/materialization.js";
```

`cat-harness` declares `needs: ['bootstrap']`. `folio-assistant-core` declares
`needs: ['cat-harness']`. So the code adds a **harness → core** edge against a
declared **core → harness** dependency. The declarations alone have no cycle;
the declarations plus the code do.

## Three checks look at this. One sees it.

| check | what it reads | verdict |
|---|---|---|
| `check:instance-graph` | the declarations only | ✓ 16 instances, no cycle |
| `check:partition` | modules bucketed by PATH RULE into 5 packages | 0 wrong-direction |
| `kg:detangle` | a node's layer is its INSTANCE | **1 wrong-direction** |

`kg:detangle` is the one that is right, and it says why:

> `wrong-direction — 'cat-harness' does not declare 'folio-assistant-core'
> among what it may reach`

The other two are not broken. They answer different questions, and neither
question is "does this file's directory agree with what it imports". That is
worth keeping in view: **three green checks did not mean the layering held.**

## Why this is not an import swap

There are TWO `ProvenanceSchema` exports:

| where | shape |
|---|---|
| `cat-harness/schemas/attribution.ts:115` | `z.union([z.literal(INGESTED), AttributionSchema])` |
| `folio-assistant-core/schemas/materialization.ts:272` | the `upstream` / `local` shape |

`intake.ts`'s own docblock says it wants *"where the capture came from |
`ProvenanceSchema` (`upstream` / `local`)"* — core's shape, not the harness's.
So pointing the import at the local one compiles and means something else.
Two different concepts under one name is arguably the deeper defect here.

## The options, none of them taken

1. **Move the `upstream`/`local` provenance down** into `cat-harness` (or
   `bootstrap`) and have core import it. Fixes the direction. Cost: core's
   `materialization.ts` is 27 KB and the schema may not travel alone.
2. **Move `intake.ts` up into `folio-assistant-core`.** An intake record is
   arguably core content, not harness plumbing. Cost: `intake.ts` imports
   `./archive-contents.js`, which would then also have to move or be reached
   downward.
3. **Declare `cat-harness` needs `folio-assistant-core`.** Cheapest edit,
   and it creates a declared cycle — `check:instance-graph` would then fail,
   correctly.
4. **Rename one of the two `ProvenanceSchema`s first**, then decide. The
   collision is what made option 1 look free when it is not.

## Done when

- [x] The owner ruled 2026-09-26: **combine 1 + 2**, asking whether cat-harness
      is a subgraph on core. Measurement answered the conditional the OTHER way
      and excluded 3 — see below.
- [x] `kg:detangle` reports 0 wrong-direction, and the sidecar records it.
      Falsified: restoring the cross-instance import puts it back to 1.
- [x] The two are deliberately distinguished by name:
      `attribution.ts` keeps `ProvenanceSchema` (*who wrote this*),
      the one that moved is `SourceProvenanceSchema` (*where the bytes came from*).

## Not claimed

Found while answering *"where are we in code separation"* (2026-09-26). The
same session shipped the gate that makes this visible — `wrongDirection` is
now pinned in the detangle sidecar, so the count cannot change again without
failing `kg:detangle:check`. **That gate is the fix for the blindness; this
bean is the fix for the edge, and it is a layering decision, which `j79e`
records as the owner's.**

---

## Options

Recorded as a `DecisionRequest` and rendered with `renderDecision`, per bean
`hajp` — not hand-written. The four options were in this bean's prose from
2026-09-26 and that was NOT enough: `hajp` requires anything with more than two
options to exist as a record, so the prose table and the selection come from one
object that cannot disagree with itself. Omitting it was my defect, named by the
owner the same day.

**Choice: made 2026-09-26 by the owner — combine options 1 and 2. Option 3 was
excluded by measurement after the ruling; see §"The ruling, and what measurement
changed about it".**

Which side of a harness→core import inversion moves. Today `cat-harness/schemas/intake.ts:28` imports `folio-assistant-core/schemas/materialization.js`, while `folio-assistant-core` declares that it depends on `cat-harness`. So the code points one way and the declarations point the other. Your answer decides whether a schema moves down into the harness, a file moves up into core, the declared layering changes, or a name collision is settled first — and until it is answered `kg:detangle` records `wrongDirection: 1` on main forever.

- **`bf5l`** — the bean holding this — the wrong-direction edge found 2026-09-26 while assessing code separation
- **`cat-harness`** — the platform instance: skills, schemas, MCP server. Declares `needs: ['bootstrap']`
- **`folio-assistant-core`** — the content-model instance: document/paper schemas, authoring, render. Declares `needs: ['cat-harness']`
- **`intake.ts`** — cat-harness/schemas/intake.ts — an intake record, `folio-intake/v1`: what one capture put into uploads/
- **`ProvenanceSchema`** — a name that exists TWICE with different shapes: `attribution.ts:115` is `INGESTED | Attribution`; `materialization.ts:272` is the `upstream`/`local` shape. `intake.ts` wants the second
- **wrong-direction** — an import that points up the declared dependency order; `kg:detangle` counts them and, since #1375, pins the count in a committed sidecar
- **`#223`** — the issue proposing the five-repo split; the partition's target names come from it

| | **Rename one ProvenanceSchema first, then decide** *(recommended)* | Move the upstream/local provenance down into cat-harness | Move intake.ts up into folio-assistant-core | Declare that cat-harness needs folio-assistant-core |
|---|---|---|---|---|
| **What it does** | Give the two same-named schemas distinct names, then re-ask which side moves with the collision out of the way. | Relocate the `upstream`/`local` shape out of core's `materialization.ts` into a cat-harness schema, and have core import it from there. | Relocate `intake.ts` from cat-harness to core, where the schema it wants already lives. | Add `folio-assistant-core` to cat-harness's `needs`, making the existing import legal by declaration. |
| **Pro** | Removes the thing that made option 1 look free. Two different concepts under one name is arguably the deeper defect, and it is independent of the layering question. | Fixes the direction without moving any intake logic, and puts a genuinely generic provenance shape where both layers can reach it. | An intake record is arguably core content rather than harness plumbing, so this fixes the layering and the filing in one move. | One line, no code moves, and `kg:detangle`'s count goes to zero immediately. |
| **Con** | Does not fix the wrong-direction edge, so `wrongDirection: 1` stays on main and this decision returns. | `materialization.ts` is 27 KB and the schema may not travel alone — it likely references sibling types in the same file, so the move could pull more than intended. | `intake.ts` imports `./archive-contents.js`, which would then also have to move or be reached downward — so this is two moves, not one, and the second may cascade. | It creates a DECLARED cycle — core needs cat-harness and cat-harness needs core — which `check:instance-graph` would then fail, correctly. It trades a code-level inversion for a declaration-level one. |
| **Downstream** | Every importer of whichever name changes. Afterwards options 1 and 2 are both cheaper to judge, because the reader can see which shape each site actually wanted. | Every current importer of core's `ProvenanceSchema` changes its import path. The name collision with `attribution.ts` REMAINS, so the next reader still meets two `ProvenanceSchema`s and may pick the wrong one. | Shrinks cat-harness's schema surface and grows core's, which shifts where `#223` cuts. Anything importing `intake.ts` from the harness side inverts and becomes a NEW wrong-direction edge. | Makes the two instances mutually dependent, so #223 cannot cut them into separate repositories at all without undoing this first. It converts a local defect into a structural one. |
| **Reversibility** | A rename is mechanical and reversible; nothing structural is committed. | Cheap to undo while both repos are one checkout; expensive after #223 cuts them, because the schema would then live in the other repository. | Same as above while pre-split; a file's home is the thing #223 hardest to change afterwards. | The edit is trivial to revert, but anything written against the widened reach in the meantime is not. |

**Recommendation: Rename one ProvenanceSchema first, then decide** — The collision is why I could not judge options 1 and 2 when I found this. `intake.ts` wants core's `upstream`/`local` shape while its own instance already exports a DIFFERENT `ProvenanceSchema` under the same name — so a reader checking whether the import could just point locally gets a compiling, wrong answer. Options 1 and 2 both move something across a boundary, which is the expensive and least reversible class of change here, and both are easier to judge once each call site's intent is legible. Option 3 I would not take at all: it converts a one-file defect into a declared cycle that blocks #223, and `check:instance-graph` would fail it.

**If you say nothing:** Nothing. The edge stays, `wrongDirection: 1` stays pinned in the committed sidecar where #1375 put it, and it is visible rather than silent — which is what that PR was for. I will not pick a layering myself.

4 other decisions are waiting; I will put each properly when it is next.

Which of the four? Or if the rename is obviously right and you want it done without a second round, say so and I will rename and then re-ask the layering with the collision gone.

### Source

The object is built and rendered rather than pasted, so it cannot drift from
what was asked. To re-render or amend, rebuild the `DecisionRequest` against
`cat-harness/schemas/decision-request.ts` — the schema has no optionals, so an
option missing its `downstream` or `reversibility` will not parse.



## The ruling, and what measurement changed about it — 2026-09-26

The owner answered: *"combine 1 2 3 if cat-harness subgraph on core?"* — a
conditional, so it was measured rather than assumed.

**The conditional is false, in the useful direction.** `folio-assistant-core`
declares `needs: ['cat-harness']`; `cat-harness` declares `needs: ['bootstrap']`.
So cat-harness is the BASE and core is the subgraph sitting on it — not the
reverse. Under that reading options 1 and 2 reinforce each other (a generic
source pointer belongs in the base layer), and option 3 inverts.

**Option 3 is excluded by measurement, not by taste.** `cat-harness` itself
consumes the file option 3 would move out:

| site | what it does |
|---|---|
| `cat-harness/adapters/document/intake-records.ts:26` | imports `../../schemas/intake.js` |
| `cat-harness/schemas/graph-kind-registry.ts:1253` | registers `"folio-intake/v1"` against `schemas/intake.ts#IntakeSchema` |

Moving `intake.ts` up would turn both into harness→core imports and point a
validator path out of its instance — one wrong-direction edge traded for another.

**I had overstated option 2's cost, and the correction is why it was the right
pick.** The `## Options` table above says *"materialization.ts is 27 KB and the
schema may not travel alone."* Measured: `ProvenanceSchema` there is a
**3-field object**, its only dependency is `SignatureSchema` (same file, sole
consumer itself), and it had exactly **two** consumers — `intake.ts` (the
defect) and `MaterializationSchema.provenance`. ~50 lines moved, two call sites
touched. The table's con was a guess dressed as a constraint, and it is left
standing above rather than edited so the next reader can see that a cost in a
decision record is a claim like any other.

**The rename stopped being optional.** While the two `ProvenanceSchema`s sat in
different instances the clash was survivable. Moving this one into `cat-harness`
puts both in ONE instance, so one had to change — which is the argument for
combining 1 and 2 that the owner's question reached independently.

**Verified, both directions.** `kg:detangle`: `wrongDirection` **1 → 0**, and
restoring the cross-instance import puts it back to **1**. `check:partition`
reports `Wrong-direction edges: 0` **with the sabotage in place** — this bean's
own title already said two of three checks cannot see it, and that is now
re-confirmed independently rather than taken from the title. Making the blind
checks see it is NOT done here and is not this bean's remaining scope; it wants
its own bean.
