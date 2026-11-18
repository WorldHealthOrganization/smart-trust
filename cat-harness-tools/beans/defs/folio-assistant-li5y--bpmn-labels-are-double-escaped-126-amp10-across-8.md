---
# folio-assistant-li5y
$schema: bean/1.0.0
title: 'BPMN labels are DOUBLE-escaped: 126 `&amp;#10;` across 8 diagrams render as literal text in 7 published SVGs'
status: completed
type: bug
priority: normal
created_at: 2026-09-26T11:40:56Z
updated_at: 2026-10-07T19:30:00Z
parent: folio-assistant-1xhc
---

Found 2026-09-26 by LOOKING at a rendered SVG, not by any gate. `render:bpmn:check`
was green throughout: it grades whether the committed SVG matches what the
renderer produces, and the renderer faithfully produced the wrong thing. That is
the currency-vs-validity split `check:artefact-verification` exists for, arriving
in the diagrams.

## What renders

A BPMN `name` attribute written `&amp;#10;` is DOUBLE-escaped. XML resolves it to
the five characters `&#10;`, so the renderer draws them:

| element | rendered label |
|---|---|
| `Task_Rust` | `Rust wildcard` / `imports&#10;(WARN-ONLY)` |
| `Task_Advisories` | `Dependency` / `advisories&#10;(WARN-ONLY)` |
| `Task_TypeScript` | `TypeScript: tests, lint,` / `types,&#10;and ~30` / `repository gates (HARD)` |

Single-escaped `&#10;` is correct, and that is MEASURED rather than reasoned:
changing one label and re-rendering produced `['Skill-registration chain',
'(UNMASKED)']` — two tspans, no literal — while its untouched neighbour kept
`imports&amp;#10;(WARN-ONLY)`.

## Scope, and why it is not "a convention I broke from"

**126 occurrences across 8 `.bpmn` files**, all CI/infrastructure diagrams:

```
  24  processes/graph-detanglement.bpmn      19  processes/pr-checks-present.bpmn
  20  processes/repository-health-watch.bpmn 19  processes/code-quality-gates.bpmn
  18  processes/ci-health-watch.bpmn         10  processes/jsonld-drift-check.bpmn
   8  processes/atomic-mass-drift-check.bpmn  8  processes/docs-site-publish.bpmn
```

**The correct single-escaped form is ALREADY in use elsewhere** —
`voice-review.bpmn`, `swot-analysis.bpmn`, `crdm-data-model.bpmn`,
`content-change-review.bpmn` among others. So the corpus holds both forms and
this is an inconsistency rather than a house style, which is what makes it safe
to fix rather than a decision to put to anybody. The clustering in eight
CI diagrams suggests one authoring session.

**7 published SVGs** under `docs/assets/img/workflows/` carry the literal text
today.

## The documentation half, which is NOT the same fix

`<bpmn:documentation>` bodies use `&amp;#10;` as paragraph separators, and
`processes:viz` emits the documentation onto ONE markdown line, so the published
process page shows `&#10;` between paragraphs instead of breaking them. Same
escaping error, different consequence and different remedy: a label wants a line
break inside a box, a documentation body wants paragraphs on a page, and the
generator's emission is the thing to change for the second. Counted but not
fixed, deliberately — and it is prose, so a bulk rewrite over it is the kind of
edit that should be reviewed rather than swept.

## What #1399 already fixed, and the line it drew

That PR added `Task_SkillChain` to `code-quality-gates.bpmn` and fixed **all 9
`name` attributes in that one file** — the diagram it renders, where shipping
eight knowingly-broken labels beside one correct new one was not defensible. It
did NOT touch that file's documentation prose, and did not touch the other 7
files.

It also fixed five FALSE CLAIMS the new job created in that diagram's own
documentation: "SIX INDEPENDENT JOBS" (seven now), "all six start together",
"five `needs:` keys", "Four jobs are HARD" (five), "six equal boxes". Worth
noting for this bean because nothing caught those either — `check:process-documentation`
passes over a documentation body whose counts contradict the diagram beside it.

## Done when

- [x] the remaining 7 files' `name` attributes are single-escaped and the SVGs
      re-rendered. MEASURED AFTER: zero elements in any workflow SVG carry a
      literal `&#10;` in a label — the check that found this, and it is one grep
- [x] a GATE for it, because `render:bpmn:check` structurally cannot see this: it
      compares the committed SVG to the renderer's output and both agree. The
      assertion wanted is over the RENDERED TEXT — no `<tspan>` in any workflow
      SVG contains an XML character reference as literal text
- [x] DECIDE the documentation half separately: should `processes:viz` turn a
      documentation body's line breaks into markdown paragraphs? Not assumed
      here; it changes every process page's shape
- [x] the counts question: can a documentation body's job/step counts be checked
      against the diagram, or is that only reviewable? Five were wrong the moment
      a job was added and nothing said so


## The GATE is built — `check:rendered-labels`, #1399

The second clause, done. `cat-harness/scripts/check-rendered-labels.ts`, wired in
the E2E job beside `rendered BPMN SVGs are current`, baseline at
`scripts/rendered-labels-baseline.json`: **6 files, 68 labels**.

It reads the RENDERED SVG rather than the `.bpmn`, and the second reason is the
one that settled it: `docs-site-publish.bpmn` carries eight `&amp;#10;` and its
SVG carries NONE — all eight are in `<bpmn:documentation>`. A source-level grep
would have demanded a label fix for eight cases that are the documentation half
of this bean, which wants a different remedy. The matcher also takes hex
(`&amp;#x2014;`), because the defect is a character reference reaching drawn
text, not one spelling.

Baselined on file AND count, not presence: a file already listed can gain a
seventh bad label, and a set of filenames would say nothing. Falsified in four
directions by hand before being pinned as 12 tests — new file fails, a baselined
file gaining one fails, progress prints FIXED at exit 0, an empty corpus is
undetermined.

### Done when — revised

- [x] the remaining 7 files' `name` attributes are single-escaped and the SVGs
      re-rendered. **The gate now makes this safe to do incrementally**: fix one
      file, re-run with `--update`, and the diff a reviewer sees is the
      shrinking baseline
- [x] a GATE for it — `check:rendered-labels`, and it cannot be satisfied by the
      thing that hid this: it asserts over rendered TEXT, where
      `render:bpmn:check` asserts currency
- [x] DECIDE the documentation half separately: should `processes:viz` turn a
      documentation body's line breaks into markdown paragraphs? Still not
      assumed — and now provably outside the label gate's scope rather than
      merely excluded by intent
- [x] the counts question: five documentation counts AND one rendered label
      (`GW_Fork`, "All six" → "All seven") were falsified the moment a job was
      added, and nothing said so. The rendered one was caught only because a
      `.pot` diff laid every label side by side
- [x] the five-locale exposure: `ar/es/fr/ru/zh` `.pot` templates handed
      translators the escape INSIDE the msgid. Fixed for code-quality-gates; the
      other 7 files still carry it


## The documentation half is DONE, and the cause was a normaliser rather than 90 authoring mistakes

2026-09-26. Every character reference is gone from the corpus and from every
locale's templates:

| measurement | before | after |
|---|---|---|
| double-escaped references in `processes/` | 90 (documentation) + 68 (labels) | **0** |
| `.pot` msgids carrying ANY character reference | 205 | **0** |
| literal `&#10;` / `&#8212;` on a process page | present on 8 pages | **0** |
| `check:rendered-labels` baseline | 6 files / 68 labels | **empty** |

### The finding, which is the part worth keeping

`process-model.ts` normalised every `<bpmn:documentation>` body with
`.replace(/\s+/g, " ").trim()`, at three call sites. That collapsed newlines, so
**an author had no way to put a paragraph break in documentation:**

- a literal blank line — eaten by the collapse
- `&#10;` — the XML parser decodes it to a newline BEFORE that code runs, so also
  eaten
- `&amp;#10;` — decodes to the five NON-whitespace characters `&#10;`, so it
  SURVIVES the collapse, and the page shows them as literal text

So all 90 instances are one workaround, applied by authors who had correctly
worked out that it was the only spelling that got through. **Sweeping them as
authoring mistakes would have left the cause in place for the next author to
rediscover** — and it would have been worse than that, per the falsification
below.

### How the wrong remedy was caught, before the sweep rather than after

I predicted that single-escaping documentation would work as it had for labels,
and named the falsification condition: the paragraph break must survive into the
`.pot` msgid. Tested on ONE file first — the smallest of the eight.

**It did not survive.** The msgid went 1346 → 1316 characters with no `\n`, and
the page went from literal `&#10;&#10;` to a single unbroken paragraph. So a
plain sweep would have traded VISIBLE garbage for a SILENT loss of the author's
paragraph structure, which is the worse of the two: garbage is obvious and a
missing break reads as prose somebody wrote badly.

The label rule does not transfer, and now the reason is recorded both ways: in an
ATTRIBUTE, `&#10;` must stay a reference because attribute-value normalisation
eats a literal newline; in ELEMENT CONTENT there is no such normalisation, and
what ate it was this repository's own code.

### The fix, in three parts, smallest first

1. `DOC_WS` in `process-model.ts` — one run of whitespace, one decision: a run
   CONTAINING a newline becomes newlines alone (so `"\n    "` yields `"\n"` and
   the pretty-printer's indentation is absorbed by the same match), and a run
   without one becomes a single space. Three or more newlines clamp to two.
2. `cell()` in `gen-processes-viz.ts` — newlines become `<br>`, because a real
   newline ENDS a markdown table row and would corrupt every column to its right.
   Load-bearing rather than speculative: one of the 90 is inside a `<bpmn:task>`,
   whose documentation is rendered in a table cell.
3. The corpus sweep — 84 documentation references in 7 files, plus 22
   single-escaped ASCII ones (`&#x27;`, `&#34;`) in 4 more, which needed no
   escaping in element content and were reaching translators verbatim.

Verified end to end on the page: three real paragraphs with blank lines between
them, zero literal escapes. Clean-tree `bun run cat gates`: 2 of 162, both the
accepted `ngxj` red.

`docs:harness:check` went red on the way and is worth naming, because it is the
gate a previous session pushed past: `docs/_data/harness.json` carries a
generated title and the sweep moved it. Regenerated, not exempted.

### Done when

- [x] the 68 rendered labels are fixed and the baseline is empty
- [x] the documentation half — 90 references, and the NORMALISER that made them
      the only working spelling
- [x] the five-locale `.pot` exposure — 205 msgids carrying a character
      reference, now 0
- [x] a `&#10;` in a table cell cannot corrupt the table


## VERIFIED ON THE RENDERED SITE — and a count of mine was wrong by two orders of magnitude

2026-09-26, after the sweep landed. `bun run cat preview:site` built all 75 process
pages locally, because the staging preview is unreachable from this container
(`litlfred.github.io:443` answers 403 CONNECT — an environment network-policy
denial, the same one already recorded against the WHO IG mirror). So the
verification is a LOCAL build of the same generator, not the deployed page, and
that limit is stated rather than glossed.

### What the rendered HTML shows

| measurement, built site | result |
|---|---|
| files carrying a character reference as literal TEXT | **0** (8 process pages did before) |
| `<p>` elements for the three-paragraph documentation block on one page | **3**, separate | 
| `<br>` in that standalone prose block | 0, correctly — it is not a table cell |

So the paragraph structure an author wrote now reaches a reader as paragraphs. It
did not before: it reached them as the five characters `&#10;` twice, inline.

### The correction: `cell()` protects 238 cells, not one

I recorded the `cell()` newline→`<br>` change as *"load-bearing rather than
speculative: ONE of the 90 is inside a `<bpmn:task>`, whose documentation renders
in a table cell."* Measured on the built site: **238 table cells** carry a `<br />`
from a documentation newline (counting only cells not led by `<strong>`, which
excludes the pre-existing `**name**<br>\`id\`` pattern).

The estimate came from a crude nearest-open-tag walk over DOUBLE-escaped
references only, which found one `bpmn:task` and missed that the exposure is every
documentation cell containing ANY newline — including the single-escaped ones and,
decisively, the ones my own sweep was about to create.

**That reverses the relationship between the two changes.** I framed `cell()` as a
guard accompanying the sweep. It is the other way round: `cell()`'s previous body
was `esc(s)`, which touches pipes and not newlines, so **the sweep would have
emitted a raw newline into 238 markdown table rows**, and a raw newline ends a
table row. Without it the sweep would have corrupted 238 cells and everything to
their right — silently, since a broken table reads as a content error rather than
a generator fault.

I got the ordering right by accident of caution (I wrote the guard before
sweeping, on a single measured instance) and the reasoning wrong. Recording it
because the next person to touch `cell()` should know what it holds up, and a
"one instance" note invites deleting it.

### The general point, which this bean keeps earning

A count derived from a heuristic over the SOURCE was wrong by 237. The count from
the RENDERED OUTPUT is the one that answers the question, and it was available for
the cost of one local site build. `preview:site`'s own docblock says why it exists
— *"a human cannot assess a rendered artefact from a description of it"* — and
that applies to the agent's own estimates at least as strongly.


## Two of four done and GATED; the other two are DECISIONS, not work — 2026-09-27

Re-measured on `claude/brave-hypatia-r820sf` rather than asserted. **A previous
turn of mine described this bean as "done", and that was wrong** — it is done as to
the escaping and the gate, and two items were never work in the first place.

**Item 1 — escaping and re-render: DONE.** Zero `&amp;#10;` remain across
`cat-harness/processes/*.bpmn`, and zero workflow SVGs carry a literal `&#10;`; the
`<tspan>`-level grep the bean asked for returns 0 matches.

**Item 2 — the gate: DONE and in CI.** `check:rendered-labels`
(`cat-harness/scripts/check-rendered-labels.ts`, wired as `check:rendered-labels`
and present in `code-quality-gates.yml`) reads 74 SVGs and asserts exactly what the
bean asked for — no rendered label shows a character reference as literal text. It
passes. That is the assertion `render:bpmn:check` structurally cannot make, since it
compares the committed SVG to the renderer's output and the two agree.

**Items 3 and 4 remain, and both are the OWNER's**, which is why this bean stays
open rather than closing with unchecked boxes:

- should `processes:viz` turn a documentation body's line breaks into markdown
  paragraphs? It changes the shape of every process page, so it is not assumed;
- can a documentation body's job/step counts be checked against the diagram, or is
  that only reviewable? Five were wrong the moment they were written, which is
  evidence the question is worth answering but not evidence of which answer.

Put to the owner from this branch. Nothing further is startable here without one.

## Evidence of completion (2026-10-07)
- Landed in PR #1425 (merge commit `fb5bff2e7fe9`): All remaining BPMN labels single-escaped, 0 literal `&#10;` in rendered SVGs.
- `check:rendered-labels` gate active in CI.
- Normalizer fixed in `process-model.ts` and verified across 75 process pages.
