---
name: voice-who-digital-transformation-handbook
description: >
  Write and review digital transformation handbook prose in the DTHs' own register — 10 rules, each citing the handbook section it was read from.
allowed-tools: Read Grep Glob
---

# WHO Digital Transformation Handbook

The register of WHO's Digital Transformation Handbooks (DTHs): the guidance
publications that take one area of a health system from paper to digital within
the DIIG process. Every rule is read from, and cites, one of the three DTHs
(ingested in who-iris's `library/`) or the draft DPI-H Reference Architecture
(in smart-ra's).

## What this file is, against the rules beside it

`voice.json` in this directory carries the RULES, each with the publication,
section and verbatim quote it was read from. This file does not restate them;
it says how to use them. To see the rules, read `voice.json` or run
`bun run cat check:voices`.

## Why this voice exists beside `who-digital-health`

`who-digital-health` is the vocabulary of the **classification** — what a
digital health intervention is, and how CDISAH names itself. This voice is the
vocabulary of the **handbooks** that apply it to one area of a health system:
the sequence a digitalisation goes through, the systems and data it builds, and
the architecture it should sit in. Where the two would disagree, the conflict
is recorded, not resolved (below).

The `dth` document kind is the STRUCTURE of a DTH; this voice is its LANGUAGE.
A section can follow the kind and still read wrong.

## Authoring

**Read the `counterintuitive` rules in `voice.json` before you draft.** Each
carries a `commonError` naming the instinct it corrects.

## Two rules rest on a DRAFT

The DPI-H Reference Architecture in the library is **DRAFT V1.0, for public
comment**, and is internally inconsistent in places (it expands DPI-H two
ways). The two rules read from it say so in their description. When the
published edition is ingested, re-check them against it before upholding a
finding on them.

## Review and QC

**A finding against this voice is upheld by opening the cited section, never by
trusting the rule's wording.** Every rule names `{ libraryId, sectionId, pages,
quote }` and resolves into the cited layer's `library/`, and
`check:voices` refuses a
rule whose citation does not resolve.

## What this voice does not do

**It does not settle what to call the people a health system serves.** The
primary health care DTH says *health service user*, the draft Reference
Architecture says *client*, and `who-digital-health` upholds CDISAH's *Persons*.
There is no rule for it: one group under three labels across three WHO texts
is the owner's call, not a voice's.

**It does not police ordinary English.** Each terminology rule is scoped by its
`context`; do not apply a handbook term outside the handbook's subject.
