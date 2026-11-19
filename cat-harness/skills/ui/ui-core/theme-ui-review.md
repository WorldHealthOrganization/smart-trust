---
name: theme-ui-review
description: >
  Review graphical assets AS THEY ARE INGESTED, in the context of the website
  or app design they are for — accessibility, branding, languages — to
  determine what the assets and the UI will be. At ingestion only; called from
  ingest-theme. Measures rather than asserts, and raises
  findings rather than fixing them.
---

# At ingestion, and only at ingestion

This skill runs in exactly one place: `theme-ui-review.bpmn`, called from
`ingest-theme.bpmn` `Task_Review`, whose agent lane is `ingestion-agent`. It is
not part of a post-MVP SDLC step and is not called from `crdm-deliver.bpmn`.

## What it reviews

It looks at the arriving graphical assets laid out in the design they are for,
so a finding is a decision about what the assets **will be**, taken while it is
still cheap. The questions: accessibility measured rather than asserted,
branding against the layer's own declaration, and every declared locale.

**Theme choice is an authoring judgement.** There is no
role-to-theme mapping ([`theme.ts`](https://github.com/litlfred/cat-harness-tools/blob/main/schemas/ui/theme.ts) records why), so
nothing here checks a binding. What gets reviewed is the ingested art in its
design context.

## What this gives up — accepted

An ingestion review answers *"what will this turn into?"* only as far as the
assets can be laid out in their design before the site exists — not how a crop
reads in the finished page. That gap is accepted; do not add a post-MVP review
call on your own initiative.

## A person is in the loop, inside ingestion

`R_Judge` is a human step: a person looks at the assets laid out at a web and a
mobile width, so **ingesting a theme source is attended at that step.** Ingesting anything else
stays unattended — `Gateway_ThemeSource` in `document-ingestion.bpmn` routes
non-theme documents past `ingest-theme.bpmn` entirely.

## Measure; do not assert

**Contrast is computed, against the real ground.** A theme with a backdrop has
no single ratio — ink over a photograph varies pixel to pixel — so the number
that matters is the worst case the art can present. Every shipped scrim in this
repository is measured over **pure black** for that reason, and the check is
written so it *can fail*: without a case that fails at a thin scrim, passing
assertions prove nothing about the value.

**Colour is never the sole carrier** (SC 1.4.1). Where it carries meaning, look
for the second channel — the priority stripe is a *width* as well as a hue
precisely so a monochrome reader still sees it.

**An automated pass is necessary and not sufficient:**

- axe accepts a **non-empty placeholder** as an accessible name, so a label
  removed from the accessibility tree can pass the automated check.
- A CSS selector that matches **nothing** raises no error in any tool, and can
  leave a backdrop at its intrinsic size across the viewport with every gate
  green.

So a person looks at the assets laid out in their design (`R_Judge`). That is a
step in the diagram, not an optional extra, because no automated check catches
either case above.

## Branding is a question about the LAYER, not about taste

Marks, palettes and art are checked against the layer's own declaration
rather than a remembered style. The sharpest form of the question comes from
downstream: **would a folio depending on this platform inherit something it did
not choose?** `landing.html` states it as a rule — *"a downstream folio should
not inherit a grumpy cat it did not choose"* — and it is why a theme names an
image **role** rather than a path.

## Languages: new UI is where untranslated strings enter

Check that every user-facing string reaches the `.pot`, that each declared locale
renders without clipping, and that right-to-left is **laid out** rather than
mirrored by accident.

The distinction worth keeping: a **name** is translatable and a **value** is
not. A theme's display name goes through the pipeline; its palette does not,
because a colour is not language-dependent and translating one invites a locale
to diverge on a value the CSS must agree on.

## Raise findings; do not fix them

A finding goes back to whoever authored the choice, **because the choice was
theirs**. There is no mapping to correct instead, and a reviewer who quietly
re-themes a note has substituted their judgement for the author's without saying
so — which is the same objection [`decision-audit`](../../process/process-core/decision-audit.md) makes to
editing a finding rather than overruling it with a note.

The one exception is the one this repository already allows everywhere: a defect
that is not a judgement call at all — a selector matching nothing, a string
missing from the `.pot`, a contrast ratio below the floor — is a bug, and bugs
get fixed.

## What this does NOT cover

Not the choice itself. Whether a sticky should be `engineer` or `library` is an
authoring decision, and this review does not second-guess it; it asks whether
what was ingested **will render legibly, consistently and in every declared
language** in the design it is for.

## Both viewports, always

- Every surface is inventoried and judged at a **web** width and at a **mobile** width.
- A review done at one width is **incomplete**, not passed.
- The surface's wireframe, in [`wireframe-design-review`](wireframe-design-review.md), states what each layout was meant to be, so the review compares the build against an intent rather than against memory.
