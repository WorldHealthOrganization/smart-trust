---
# folio-assistant-7w1a
$schema: bean/1.0.0
title: 'METHODOLOGIES TABLE MISRENDERS: a truncated cell cuts a code span open and the whole table prints as text'
status: completed
type: bug
parent: folio-assistant-o3xy
created_at: 2026-09-24T18:58:58Z
updated_at: 2026-09-24T18:58:58Z
---

Owner 2026-09-24, with a screenshot: "bean: table misrenders https://litlfred.github.io/folio-assistant/methodologies/ — need QA audit report".

## Cause
gen-methodologies-viz.ts short() cuts applies-when at 150 chars. The madr row is cut inside a code span, (see `kepner-tregoe…, and the unmatched backtick pairs with a later one on the line, swallowing the cell pipes. kramdown then renders the whole table as a paragraph. methodologies-viz.test.ts pins column counts by counting pipes, so it never saw this: it ignores code spans.

## Plan
- [x] short() never leaves a code span or bold run open
- [x] a test over the REAL page: every row has balanced backticks, and short() on a fixture that cuts inside a span
- [x] check-escaped-markup also reports a LEAKED markdown table (a delimiter row printed as text outside code), so the docs-site build fails on the next one
- [x] QA audit: run it over a full site build and report every page


## Summary of Changes — and the QA audit

**Audit of the LIVE site** (gh-pages, every page outside `STAGING/`, 3,234 pages),
with the new leaked-table scan: **12 tables printed as text, on 6 pages, from 2 causes.**

| page | tables | cause |
|---|---|---|
| `methodologies/` | 1 | a truncated `applies-when` cut a code span open (the report) |
| `smart-trust/` | 7 | tables inside `<details>`: kramdown does not parse Markdown in an HTML block without `markdown="1"` |
| `reference/skill-instructions/graph-detanglement` | 1 | a code span wrapped so a line began `<file.json>`: kramdown opened an HTML block and the REST OF THE PAGE stayed raw |
| `…/dispatch-agent` | 1 | same, `<agentId>` |
| `…/retry-backoff` | 1 | same, `<branch>` |
| `…/domain-fencing` | 1 | same, `<name>.config.json` |

Fixed: `short()` backs out of an open code span or bold run; the smart-trust generator emits
`<details markdown="1">`; the four skill sources reflowed so no line begins with `<word`.

**After the fix:** a full local build, 1,309 pages, is clean. Tables render (methodologies 11
rows; smart-trust 8 tables), and the four skill pages carry no raw `##`.

**The gate:** `check:escaped-markup` (already run by docs-site.yml on the built site) now also
fails on a markdown delimiter row printed as text, outside code/pre. Tested against the page
that shipped, the other spellings, a rendered table, a table's source in a code block, and prose
pipes. `methodologies-viz.test.ts` gains a balanced-backtick test over the real page, which the
old pipe-counting column test could not see — mutation-checked: removing the fix fails 2 tests.

**Not covered:** the live pages the local build does not produce (the mounted who-iris and
smart-trust replicas under other paths) were scanned LIVE only; none was flagged.
