---
name: voice-who-editorial
description: >
  Write and review in the WHO editorial style voice — 9 rules, each citing the publication it was read from.
allowed-tools: Read Grep Glob
---

# WHO editorial style

The house editorial style of the World Health Organization: spelling, capitalization, eponym form, reference layout and non-discriminatory language, as set out in the WHO Editorial Style Manual. Derived rule by rule from the ingested manual; every rule cites the page it was read from.

## What this skill is, against the rules beside it

`voice.json` in this directory carries the RULES — each with the publication,
page and verbatim quote it was read from. **This file does not restate them**:
a rule restated here as prose would be an uncited second copy, and a passing
`check:voice-skills` depends on there being none. For the rules, read
`voice.json` or run `bun run cat check:voices`; this file is how to USE them.

## Authoring

Read the rules flagged `counterintuitive` before you draft, not at review; each
carries a `commonError` naming the wrong instinct. Settle terminology early — a
word changed late ripples into every sentence built around it.

## Review and QC

A finding against this voice is upheld by **opening the cited page**, never by
trusting the rule's wording. Every rule names `{ libraryId, sectionId, pages }`
and quotes its source, and `check:voices` refuses a rule whose citation does
not resolve.

If the passage is a stated exception, or the rule is out of scope for the genre
of that block, say so on the finding rather than rewriting the prose.

## QA

The mechanical half runs from the rules' `patterns` and `terminology`. A rule
marked `judgementOnly` has no lexical check by design: no pattern could work
for it, which is different from nobody having written one yet. The overlay
criterion derived from this voice carries its `overlaySeverity`.
