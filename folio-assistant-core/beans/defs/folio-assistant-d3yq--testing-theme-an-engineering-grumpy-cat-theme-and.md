---
# folio-assistant-d3yq
$schema: bean/1.0.0
title: 'TESTING THEME: an engineering grumpy-cat theme and an avatar for testing surfaces'
status: scrapped
type: feature
priority: normal
created_at: 2026-09-20T06:09:59Z
updated_at: 2026-09-23T10:30:00Z
parent: folio-assistant-o3xy
blocked_by:
    - folio-assistant-xffc
---

## The ask, owner 2026-09-20 (verbatim)

> also when talking about testing specifically, we need avatar and then cats =
> computable adjudication and agentic test harness.       caaat-harness
>     ca&at-harness
>  _c&t-harness
>  c@t-harness
> cat-harness
> cat-harness
>
> this time grumpy cat will be engineering themed.  i will provide 3 layouts in
> a moment

## What it asks for

1. An **avatar** for the testing context, plus the derivation chain.
2. A **third grumpy-cat theme, engineering-themed**, distinct from the default
   `grumpy-cat` and from the tools theme (`xffc`).
3. Applied **when talking about testing specifically** — so theme selection by
   subject/context, the same new capability `xffc` needs for tools.

**BLOCKED, and the block is clean**: the owner says *"i will provide 3 layouts
in a moment."* A theme is invalid without all three (`theme.ts` enforces it and
refuses rather than degrading), so there is nothing to build until the art
arrives. Waiting on: the three layouts. No expiry set — the owner is supplying
them in this session.

## A DIFFERENCE worth resolving before anything is written

The chain in this ask is **not** the chain committed in `cat-harness/harness.json`.

| rung | committed today | in this ask |
|---|---|---|
| 1 | `computable adjudication and agentic test harness` | same, with a trailing `.` |
| 2 | `caaat-harness` | `caaat-harness` |
| 3 | `ca&at-harness` | `ca&at-harness` |
| 4 | **`.c&at-harness`** | **`_c&t-harness`** |
| 5 | ` c@t-harness` (leading NO-BREAK SPACE) | ` c@t-harness` |
| 6 | — | `cat-harness` |
| 7 | — | `cat-harness` |

So rung 4 changes `.c&at-` to `_c&t-` (a different leading character AND a
dropped `a`), and two `cat-harness` rungs are added at the end.

**Not applied, deliberately.** The committed chain is load-bearing in ways a
retype would not show: `kg-node.test.ts` has a test named *"the last rung's
leading character is U+00A0, not a space"*, so the NO-BREAK SPACE is asserted,
and another requires the rungs be separated by BLANK lines rather than single
newlines because that is what survives Jekyll's markdown renderer. A chain typed
into a chat message loses exactly those two properties, and the ask is about a
THEME rather than about editing the description.

**Question for the owner** (asked rather than assumed): is the derivation chain
being revised to the seven-rung form, or was it retyped from memory as context
for the theme? If revised, `harness.json`'s `description` changes and the two
tests above need updating with it — and the landing sticky picks it up for free,
since it reads the description rather than restating it (`mggs`).

## Depends on

- **`mggs`** (PR #465) — gave `Theme` a `backdrop` named by image `role` with a
  required `scrim`. Three layouts of engineering art declared as `images[]` with
  a shared role is exactly that field's shape, so this should need no new one.
- **`xffc`** — the tools theme. Both this and that need *theme selection by
  context*, which does not exist yet. Whichever is built first should introduce
  the mechanism and the other should use it, not a second one.
- **Avatars** — `schemas/avatars.ts`, `scripts/gen-avatars-css.ts`,
  `scripts/check-avatar-coverage.ts` exist. "we need avatar" probably rides
  those rather than being new; `5oai` left *"avatars on content nodes reusing
  `images[].role`"* open as its other deferred half.

## Done when

- [ ] the three layouts have arrived
- [ ] the derivation-chain question is answered
- [ ] an `engineering` grumpy-cat theme exists as a KG node, all three layouts,
      contrast measured rather than asserted (as `mggs` did for the scrim)
- [ ] an avatar for the testing context, through the existing avatar mechanism
- [ ] testing surfaces select it, through the same mechanism `xffc` uses
- [ ] `themes.css` and the avatars CSS regenerated; neither `:check` left stale


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

Same ruling as `xffc`: the withdrawn premise does not scrap the bean, it
re-points it at the theme model `j66n` landed the same day.

### Why this one survives more easily than `xffc`

The avatar half is still wanted independently. `tfo1` names *"avatar for
testing, engineering, architecture"* and cites the owner's own commit
`1b62b57773dafaeaa05f9c7247ac65db00af92d1`, so there IS a supplied artefact
here — which is exactly what `xffc` lacks and is blocked on.

That makes this bean the easier of the two to start: the source exists.

### The new scope

A testing/engineering theme with `Theme.kind` chosen deliberately, every
palette role read off the supplied art rather than eyedroppered by judgement,
and a test that re-reads the art. `who-iris/themes/themes.test.ts` is the
pattern — it unzips the captured stylesheet at test time and asserts the theme
agrees with it, which makes the tests a freshness check as well as a
correctness one.

Note the constraint the existing node already states and a new theme must not
break: *a theme sets the stripe's hue; it never sets its width to zero.* Colour
alone carrying a whole signal fails WCAG SC 1.4.1. A "grumpy" theme that
signalled failure by hue alone would break it in the most tempting way.

### Done when
- The three layouts are complete for the chosen kind, or the theme is INVALID —
  never degraded.
- Every value cites the supplied art, and a test re-reads it.
- The non-colour-signal rule is checked, not assumed.
- It goes through `resolveTheme` like every other theme, not a shortcut.

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
