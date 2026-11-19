---
# folio-assistant-xffc
$schema: bean/1.0.0
title: 'TOOLS THEME: the second theme from 0301fbd2 becomes a KG node, and tools in the KG use it'
status: scrapped
type: feature
priority: normal
created_at: 2026-09-20T06:05:13Z
updated_at: 2026-09-23T10:30:00Z
parent: folio-assistant-o3xy
---

## The ask, owner 2026-09-20 (verbatim)

> there are exssting 3 layouts for grumpy cat. that is defailt cat-harness
> theme. there are now new theme when talking abuot tools in the KG
> https://github.com/litlfred/folio-assistant/commit/0301fbd24c107d1987d1a15d148fb50242c96217.
> these need to moved into KG appropraitely as a theme. and in on tools in kg
> use this theme.

## What this says, as I read it

Three claims and one instruction:

1. **`grumpy-cat` is the DEFAULT cat-harness theme.** Today
   `schemas/themes.ts` sets `DEFAULT_THEME_ID = "pale-sage"`, described in its
   own docs as *"Provisional against the staging bar … which sage is a question
   only the deployed staging site can settle."* This ruling looks like it
   settles that question differently — grumpy-cat, not a sage. **To confirm
   before changing**, because `iurf` chose a sage deliberately to match the
   staging bar and the owner's earlier ask said *"default is one of the sages
   (to match the staging bar)"*. Two owner statements point opposite ways; the
   later one normally wins, but a default is cheap to get wrong quietly.
2. **The three layouts already exist for grumpy-cat** — confirmed:
   `schemas/themes.ts` gives every shipped theme the shared `LAYOUTS` constant
   (laptop / mobile / card), and `theme.ts` enforces all three or invalid.
3. **A second theme exists in commit `0301fbd2`** and is not yet a KG node.
4. **Tools in the KG should use that second theme** — so a theme becomes
   selectable per *node kind* (or per graph kind), which is new.

## What this bean must NOT assume

Whether the commit's assets are colours, images, CSS, or all three — and
whether anything already lets a node kind pick a theme. `avatars` may be the
existing precedent for "a per-kind visual" (`schemas/avatars.ts`,
`scripts/gen-avatars-css.ts`, `scripts/check-avatar-coverage.ts`), and `5oai`'s
closing note left *"avatars on content nodes reusing `images[].role`"* open as
its other deferred half. If a per-kind visual mechanism exists, this rides it
rather than minting a second vocabulary.

A read-only investigation of the commit was launched 2026-09-20 to answer
exactly those questions before anything is designed.

## Relation to `mggs`

`mggs` (the landing sticky) gave `Theme` a **backdrop** field, named by image
`role` and resolved against the instance's own `images[]`, with a required
`scrim` because ink over art has no computable contrast. If the tools theme
carries imagery, that field is probably the hook it needs and this bean should
not add a second one. `mggs` is in PR #465.

Queued rather than pivoted to, per the owner's standing preference: *"in chats
if I discuss a new task I want you to queue/run in parallel, do not pivot unless
explicitly told so."*

## Done when

- [ ] the commit's contents are reported, with exact paths and colour values
- [ ] the `grumpy-cat`-as-default reading is confirmed or corrected against
      `iurf`'s deliberate sage
- [ ] the second theme exists as a KG node, validated by `ThemeSchema` with all
      three layouts
- [ ] tools in the KG render with it, through whatever per-kind mechanism
      already exists rather than a new one
- [ ] `themes.css` regenerated; `themes:css:check` not left stale
- [ ] contrast measured rather than asserted, as `mggs` did for the scrim


_2026-09-20_ — COMMIT `0301fbd2` INVESTIGATED, and the headline is that it contains **no theme code at all**. It is three raw PNGs uploaded through the GitHub web UI, at the **repository root**, with spaces and commas in their names:

| file | pixels | nearest declared `landing` layout |
|---|---|---|
| `ChatGPT Image Sep 20, 2026, 07_59_54 AM.png` | 1254x1254 | `landing-card` (1254x1254) — exact |
| `ChatGPT Image Sep 20, 2026, 08_00_03 AM.png` | 1672x941 | `landing-laptop` (declared **1671**x941) — 1px wider |
| `ChatGPT Image Sep 20, 2026, 08_00_13 AM.png` | 942x1670 | `landing-mobile` (declared **941**x1670) — 1px wider |

So: three layouts, matching the card/laptop/mobile set, as PNG where the instance declares `.webp`.

**A CORRECTION I AM RECORDING RATHER THAN QUIETLY FIXING, because acting on the wrong version would have been destructive.** An automated pass over these images — a 16x16 average-colour grid — concluded they were *"a regeneration of the existing `landing`-role art"*, matching `harness.json`'s own prose about *"a grumpy cat in a sage hoodie"*. **That is wrong, and I only found out by opening the image.** The cat is wearing a **hi-vis engineering work vest** — orange and yellow reflective stripes, rust-stained, with the c@t mark as a chest patch — not a sage hoodie. A coarse colour grid cannot tell a costume from a costume; both are cat-plus-cloud-plus-green at 16x16.

The consequence had it gone unchecked: *"replacements for `landing-{card,laptop,mobile}.webp`"* was the recommendation, and `grumpy-cat` is the only theme with a backdrop and it names the role `landing`. Dropping these in place would have **silently re-skinned the default theme and the landing sticky**, with no theme edit anywhere to show why — and falsified two `images[].width` values by 1px on the way.

**These are NEW ART FOR A NEW THEME.** They must be declared as their own `images[]` entries under their own `role`, never as `landing`.

## What does NOT exist, and both this bean and its sibling need it

**There is no per-kind or per-context theme selection anywhere.** Measured across `schemas/theme.ts`, `schemas/themes.ts`, `schemas/kg-node.ts` and `scripts/gen-themes-css.ts`:

- `ThemeSchema` is keyed by `id` alone. No `kind`, `graphKind` or `nodeKind` field.
- The only selector is `ThemedTodoFieldsSchema` — an optional `theme` id on a **todo** — plus the required `theme` on the landing sticky. Both are per-NODE, chosen by whoever built the node.
- The generated CSS emits `[data-fa-sticky-theme="<id>"]` only, and `docs-ui.js` sets `data-fa-kind` on avatars while never setting `data-fa-sticky-theme`. The two vocabularies do not meet.

**Avatars ARE the existing precedent for a per-kind visual**, and `tools` already has one: `schemas/avatars.ts` declares `tools: { glyph: <a spanner>, tone: 250, reads: "a spanner — a Tool definition, the thing that does the work" }`, rendered to `avatars.css` at `hsl(250 46% 34%)` light / `hsl(250 42% 72%)` dark. But it is a hue and a glyph mask in a separate registry and stylesheet; nothing bridges `AVATARS[kind].tone` to a `Theme`, and no theme names a kind.

So *"use this theme on tools in the KG"* needs a **bridge that does not exist**. Whichever of this bean and `d3yq` is built first should introduce it, and the other should use it rather than minting a second.

**Also worth knowing: there is no rendered tools page.** `docs/reference/` holds `skills/` and `skill-instructions/` only; Tools appear as prose. Every consumer of `tools/index.js` is non-visual (`check-tools`, `kg-export`, `harness-schema-export`, `tool-coverage`, the MCP projection). So "tools use this theme" may need a surface to exist before it can have a theme.

## A gap the assets themselves expose

The three PNGs are **undeclared, at a path no gate scans.** `check-declared-assets.ts` walks declared→disk only, and its `DECLARED_INSTANCES` is `["cat-harness", "bootstrap"]` — the repository root is deliberately not an instance since the move. There is no reverse "a file on disk that nothing declares" check for images. So these three are invisible to every declaration gate, and would have stayed invisible indefinitely. Worth its own bean.


_2026-09-20_ — OWNER RULING, verbatim: **"no formal role/theme mapping per se. that is authoring (human/agentic) decision/judgement."**

This **removes the central premise of this bean as I framed it**, and the framing was mine rather than the owner's. I wrote, here and in `d3yq` and again in the `analyst` commit message, that *"no per-role, per-process or per-kind theme SELECTION exists"* and treated that as the gap to fill — that a mechanism was needed to bind a theme to a role, a process, a kind or a skill.

**There is no such mechanism to build.** A theme is chosen by whoever authors the note. `ThemedTodoFields.theme` and the landing sticky's required `theme` are the entire selection surface: an id, set by an author, arguable per note.

**The absence was the design, and I read it as an omission.** The evidence was already in `theme.ts`, which says a todo with no theme is *"one nobody has chosen for"* — a sentence that presupposes a chooser. I read past it three times.

Three reasons the mapping would have been wrong rather than merely unnecessary, now recorded in `schemas/theme.ts`:

1. **A role is a swimlane, not a property of a thing.** `role-model.md`: nothing *is* a reviewer; somebody *acts as* one for the duration of a lane, and the same actor is a different role in another diagram. A theme keyed on role would make one note's appearance depend on which process happened to be reading it.
2. **It makes the choice unarguable and invisible.** With a table, "this one should look different" means editing something that governs everything else. With a field, the argument is local to the note.
3. **It is the conflation this repository already refuses twice** — themes live in the harness layer while their todos stay in `todos/`, and the owner's *"beans no anchor"* rule keeps a rendering position out of the work plan. A role→theme table would put presentation into the role graph.

## What is left of this bean

The THEME half stands and is done where the art exists: a theme is a declared node with a measured scrim, and `themes.test.ts` resolves every shipped backdrop against the instance's declaration. What does NOT stand is *"and then tools/testing surfaces select it"* as engineering work. An author picks it, one note at a time.

**Still open and genuinely unanswered**: whether the `tools` graph has a rendered surface at all to carry a sticky on. Measured 2026-09-20: `docs/reference/` holds `skills/` and `skill-instructions/` only, Tools appear as prose, and every consumer of `tools/index.js` is non-visual. A theme cannot be chosen for a surface that does not exist, which is a different question from the one this bean was opened on.

**Recommend the owner scrap or re-scope this bean and `d3yq`** rather than leaving them open against a premise that has been withdrawn. Not doing so unilaterally: `bean-coordination` says unwanted work is scrapped WITH ITS REASONS by whoever owns the call, and a bean quietly emptied of its premise is worse than one that says what happened to it.

## RE-SCOPED, owner 2026-09-20 — not scrapped

The premise this bean was written on was withdrawn, and the choice put to the
owner was scrap or re-scope. **Re-scope**, against the theme model that landed
the same day (`j66n`).

### What changed underneath it

`schemas/theme.ts` now carries `Theme.kind` = `sticky | webpage | publication`,
the palette vocabulary is shared across every kind and only the geometry
varies, and `who-iris/themes/themes.ts` is the worked example: two themes, each
value citing the artefact it was measured from, and tests that re-read those
artefacts rather than a copy of the constants.

### The new scope, and the thing that makes it hard

A tools theme **measured from a stated source**, the way `iris-web` and
`who-wpro-publication` are. That is the whole difficulty and it is worth saying
plainly: the original bean would have INVENTED a palette, and a theme read off
nothing is exactly what `theme.ts` exists to prevent one level down — 106
hardcoded hex colours became 22 named roles, and a theme whose values came from
somebody's judgement reintroduces that with a schema around it.

So this bean is now blocked on a question rather than on work: **what does a
tools theme get measured FROM?** Candidate answers, none chosen:

- the tool-node metadata already in the `tools` graph (a theme derived from
  what tools ARE, rather than from a picture of them);
- an existing palette in this repository with a stated provenance;
- an artefact the owner supplies, as the IRIS capture was supplied.

### Done when
- The source is named, and it is a source somebody can re-read.
- `kind` is chosen deliberately (`sticky` is the default and probably wrong for
  a tools surface).
- Every palette role cites where its value came from, and a test re-reads the
  source rather than the constant.
- Any value that is a CHOICE rather than a measurement is flagged as one, as
  `who-wpro-publication.palette.edge` is.

## Reasons for Scrapping — owner's ruling, 2026-09-23

**Scrapped, not deleted, and not left in limbo.** `bean-coordination` is explicit
that unwanted work is `scrapped` **with its reasons**, because a scrapped bean
stops the next agent re-entering a dead end while a deleted one leaves a sibling
unable to tell abandonment from accident.

### The premise was withdrawn by the owner three days before this

> *"no formal role/theme mapping per se. that is authoring (human/agentic)
> decision/judgement."* — owner, 2026-09-20

Both beans existed to populate a **formal mapping from role to theme**. With that
mapping withdrawn there is nothing left for either to be the second half of.

### Why "RE-SCOPED, not scrapped" was not a resting state

They were marked re-scoped on 2026-09-20 and then sat `todo` for three days with
**no new scope ever stated**. That is the failure mode `bean-blocking` names from
the other side: a bean whose premise is gone reads to the next agent as live work,
and a bean whose re-scope was never written reads as work somebody is mid-way
through. Either way it costs a read and returns nothing.

Put to the owner by stream 3/3 of the #956 consolidation as a selectable question
with four options — scrap both, keep both as plain theme requests, keep one, or
leave them exactly as they were — and the alternatives were priced rather than
listed. The owner chose **scrap both, with reasons.**

### What is NOT scrapped with them

The `Theme` node, its `kind` discriminator and the two worked themes (`iris-web`,
`who-wpro-publication`) are `j66n`'s and are unaffected — they were never derived
from a role mapping, but read off a served stylesheet and off a style guide's own
stated rules. Nothing here withdraws a theme; it withdraws the **mapping** that
would have said which role gets which one.

If somebody later wants a tools theme or an engineering testing theme as ordinary
authoring work, that is a new bean with a real premise, not a revival of this one.

*Scrapped by stream 3/3 of the #956 consolidation — session_013vZiHGPug7PuHoMxRS82vw.*
