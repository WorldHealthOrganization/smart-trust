---
name: voice-who-digital-health
description: >
  Write and review digital health implementation prose in WHO's own vocabulary — 8 rules, each citing the publication it was read from.
allowed-tools: Read Grep Glob
---

# WHO digital health terminology

The controlled vocabulary WHO uses to describe digital health implementations:
what a digital health intervention is against the software that delivers it,
what separates a bottleneck from a health system challenge, and how the two
editions of the classification name themselves — including the first edition's
title, which WHO says was wrong. Every rule is read from, and cites, a
publication ingested in who-iris's `library/`.

## What this file is, against the rules beside it

`voice.json` in this directory carries the RULES, each with the publication,
section and verbatim quote it was read from. This file does not restate them;
it says how to use them. To see the rules, read `voice.json` or run
`bun run cat check:voices`.

The classification's stated purpose is to be *"an accessible and bridging
language"* for planners and stakeholders; WHO's publications name the same
things differently, and two editions of it are in the library under one title.

## Authoring

**Read the `counterintuitive` rules before you draft, not at review.** Each
carries a `commonError` naming the wrong instinct:

- the classification's current abbreviation is not the one in wide circulation,
  and the publication itself uses two forms of it
- an intervention is a capability, and naming a product there collapses the
  distinction the classification rests on
- *bottleneck* and *health system challenge* are not synonyms, and DIIG Chapter
  3 is the step that maps one onto the other
- the first edition's title is not merely out of date; WHO calls it incorrect
  and is reissuing under another

A term changed late ripples into every sentence built around it and the
classification codes it implies.

## Review and QC

**A finding against this voice is upheld by opening the cited section, never by
trusting the rule's wording.** Every rule names `{ libraryId, sectionId, pages,
quote }` and resolves into who-iris's `library/`; `check:voices` refuses a rule
whose citation does not resolve (for example, a quote spanning a mid-word line
break in the source).

If the passage is a stated exception, or the edition has moved on, fix the rule,
not the prose under review.

## Two things this voice does not do

**It does not police ordinary English.** Rules that prefer one term over
another are scoped to the classification's own groupings, each in its
`context`; do not apply a classification term outside the classification.

**It does not adjudicate between the two editions.** Both are in the library
and both are cited. Where they differ the rule says which edition says what,
and the writer chooses. Likewise, where a publication disagrees with WHO's own
implementation artefacts, the rule records both and names which is which.
