---
# folio-assistant-p67i
$schema: bean/1.0.0
title: 'INGEST: CSV and spreadsheet — sheet names, headers, shape, narrative'
status: completed
type: task
priority: normal
created_at: 2026-09-16T06:43:50Z
updated_at: 2026-10-07T17:24:00Z
parent: folio-assistant-slw1
---

## What

For a CSV or spreadsheet, extract what makes a dataset findable rather than
merely stored: sheet/tab names, column and row headers, the shape (rows ×
columns per sheet), and a narrative description of what the data is about.

## Done when

`manifest.jsonld` carries a tabular record per sheet, the narrative carries its
provenance stamp, and a grep for a column header finds the dataset that has it.

Diagram: `processes/ingest-derive-content.bpmn`, `Task_Tabular`.

_2026-09-19T15:46:59Z_ — Claimed by claude/ecstatic-goldberg-eroyaz — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

## 2026-09-19 — headers as the findable surface, and the narrative nobody wrote

Done. `scripts/tabular-records.py` + `schemas/tabular-records.ts`;
`tabular-records` leaves `NOT_DERIVABLE` (3 → 2: `d5f1`, `1r0p`).

**A defect in `twqe`, found by measuring before building.** An `.xlsx` routed
to the **archive** rung — it sniffs as `application/zip` because it *is* one —
so a spreadsheet would have been listed as a bag of XML parts instead of read
as a workbook. Same for `.docx`, `.odt`, `.epub`. Caught in the same PR that
introduced it.

The magic bytes cannot separate them: all are genuinely `PK\x03\x04`. The
container declares itself one level in — OOXML by `[Content_Types].xml` plus
the part names, ODF by its `mimetype` member, which the format requires stored
first and uncompressed *precisely so it can be read this way*. Same principle
as the byte sniff, not an exception to it.

**And they disagreed for one commit.** `planFor` called the magic-bytes-only
`sniff_mimetype` while `tech_meta` applied the refinement, so an `.xlsx` routed
as an archive while its own `source` block correctly called it a workbook.
`sniff_effective_mimetype` is now the one answer both ask. Found by testing all
five file types, not just the new one.

**Stdlib only** — `zipfile` + `xml.etree`, `csv`. This repo declares no Python
dependencies and CI installs only `ruff`, so an openpyxl dependency would pass
locally and fail there. I installed openpyxl to *build* a realistic fixture,
then **uninstalled it and read the file back** — same discipline as the empty
`PLAYWRIGHT_BROWSERS_PATH`.

**The bug that looked plausible.** The first reader prefixed `xl/` to every
relationship Target, but a real writer emits worksheets as
`/xl/worksheets/sheet1.xml` (package-root-absolute) and styles as `styles.xml`
(relative) **in the same file**. Result: `xl/xl/...`, every read raised, every
shape `undetermined`, every header list empty — and **the sheet names were
still right**, so the output read as a workbook that simply had no headers.
That is the worst shape a bug can take here, and it is the `6xaz` failure mode
in a new format.

**A CSV has no magic bytes**, so routing one cannot be a sniff and must not
become an extension guess. `is_tabular_text` asks the only content question
there is: do the first rows split into the same number of fields, more than
one? Prose, a single column and anything ragged all answer no — a one-column
"table" is indistinguishable from a list of lines.

**The narrative is where I deliberately stopped.** The bean asks for "a
narrative description of what the data is about". That cannot be produced
mechanically — it is somebody's account and needs an author. `narrative: null`
with `narrative_state: "not-authored"` records the slot as empty, and the
schema refuses a record that says both things at once. The headers are right
there and a plausible summary could be assembled from them; that is exactly why
it is not. When one is written it carries an `Attribution` (`iqim`).

**This bean is therefore not fully closed by its own "Done when"**, which asks
for the narrative too. The mechanical half is done and gated; the authored half
waits on an arm that actually writes narratives — `d5f1` is the first.

Tests: 20 in `scripts/tests/tabular-records.test.ts`; all five branches
mutation-checked (1, 4, 3, 3, 1 named failures). 2 850 pass / 0 fail; tsc,
eslint, 35/35 gates determined-pass.

*2026-09-20* — Measured by running a real CSV through the LIVE pipeline, and
it found a regression one PR old.

The routing and extraction are fine: a CSV reaches the tabular rung,
`tabular-records.py` yields 1 sheet and 6 headers. The **L1 gate** then
demanded `structure.json`, `sections/`, `blocks/` and an `images.json` of it,
with `image-descriptions` advising a reader to *"run scripts/pdf-images.py"*
on a spreadsheet.

Cosmetic until `pn6j` gated promotion on it. After that it was a PERMANENT
BLOCKER: a CSV cannot have a chapter tree, so it could never be promoted, and
the gate merged an hour earlier made every non-paged document un-ingestable.

Three fixes, all in that class:

1. **`entryKind`** derives the shape from the sidecar the entry HAS —
   `structure.json` paged, `tabular.jsonld` tabular, `contents.jsonld`
   archive — and `undetermined` when none, which keeps EVERY requirement
   rather than assuming paged. The mimetype route cannot work here: a CSV has
   no magic bytes, so its source honestly records `mimetype_sniffed: null`.

2. **A staging bug I shipped in #495.** `planFor`'s third argument is the
   LIBRARY ROOT, under which each arm creates `<slug>/`. I passed the entry
   directory, so output landed at `ingest-staging/<slug>/<slug>/` and
   `checkEntry` read an empty parent — reporting every requirement unmet, a
   refusal indistinguishable from a correct one. The milnorlink checks passed
   over it because the incomplete case refuses either way and the complete
   case was staged by hand straight into the entry directory.

3. **Three copies of the source reader**, in `tabular-records`,
   `archive-contents` and `technical-metadata`, all reading `structure.json`
   only. Teaching one to look further left the others reporting `no source
   block — re-run the ingest rung` for a CSV whose `tabular.jsonld` carries a
   complete one. Collapsed into `sourceBlockOf`.

A CSV now reports **1** unmet requirement instead of 7, and the 1 is real:
`manifest.jsonld`. That is this bean's own Done-when — "manifest.jsonld
carries a tabular record per sheet" — and the tabular arm does not write one.

## Still open on this bean

- **the manifest** (above), which is mechanical and in scope;
- **the narrative**, which is not blocked on effort but on there being a
  dataset: the corpus holds four PDFs and no tabular source at all. `d5f1` has
  since shipped the pattern an authored narrative would follow (agent drafts,
  human confirms through `scripts/narratives.ts`), and `tabular.jsonld` is
  already in `NARRATIVE_BEARING`, so the seam is ready. There is simply
  nothing to describe.

Six mutations, each caught by a named test. The one that at first survived —
dropping the kind filter entirely — was caught only by the sidecar-staleness
test, which fires on any edit to the file and proves nothing; an end-to-end
`checkEntry` assertion on a real tabular fixture was added and it re-run.

No test CSV was left in `uploads/`: a dataset there is CONTENT, and this is
the platform repository.

*2026-09-20* — The manifest emitter, built to `jg8s`'s shape.

`content/pipeline/tabular-nodes.ts`: `tabularShapeOf` + `buildTabularNodes`.
A sheet node appears **iff the source has sheets** — not iff there are two or
more. A one-sheet workbook still has a sheet; a CSV has none however many rows
it holds.

**Verified on real ingested output, not only fixtures.** A real CSV and a real
two-sheet `.xlsx`, both through `tabular-records.py`:

| source | emitted |
|---|---|
| `coverage.csv` | `manifest → blocks/table-001`, `tabular_depth: "table"` |
| `book.xlsx` (Coverage, Notes) | `manifest → sheets/sheet-00{1,2} → blocks/table-00{1,2}`, `tabular_depth: "sheet"` |

The `.xlsx` was built with stdlib `zipfile` — inline strings, two worksheets —
because this repository declares no `openpyxl` and a fixture that needs an
undeclared dependency is a fixture CI cannot build.

## Two readers, and why that is not laziness

There are two tabular records: `folio-tabular-records/v1` (`tabular.jsonld`,
what `tabular-records.py` writes and the only one anything produces) and
`folio-tabular-csvw/v1` (`tabular.csvw.jsonld`, from `eief`, whose extractors
are stubbed on purpose so **nothing writes it yet**).

Reading only CSVW would have made this emitter unable to fire — the vacuity
this repository has spent a day removing. Reading only the old record would
strand it when the extractors land. So `tabularShapeOf` has a named branch for
each, per the owner's "special case of common scenarios ok"; when
`folio-tabular-records/v1` retires, one branch goes.

The two records disagree about how "has sheets" is known, and both are right
for their model: the old one has `format: csv|xlsx|ods`, and CSVW has no such
notion at all — in CSVW the table IS the file — so it is read from
`fac:anchor.sheet`, which `eief` added for exactly this and sets to a
determined `null` for a CSV.

`tabular_depth` is recorded on the manifest so a consumer need not infer the
depth from the shape it happens to receive; one that guesses breaks on the
first source of the other kind.

Eight mutations, each caught by a named test — including the two that encode
the rule itself: emitting a sheet only at 2+ sheets, and giving a CSV a sheet
node anyway.

## Still open on this bean

- **wiring** `buildTabularNodes` into `gen-library-jsonld.ts`'s entry walk;
- the **narrative**, still blocked on there being a dataset — the corpus holds
  no CSV or workbook, and the two used above were temporary.


## 2026-09-20 — the wiring, and the three defects that hid behind it

`buildTabularNodes` (#520) was tested and **unreachable**. #524 calls it from
`gen-library-jsonld`'s walk, and **all three defects it exposed existed only
because nothing called it**: no `@context` on any node; `orphanedBlocks`
scanning `sections/` alone, so every table block of a tabular entry read as
orphaned and `--prune` would have deleted them plus their `.md` siblings; and
a fully ingested tabular entry reported *"no structure.json — not ingested"*.

`buildEntryNodes` is extracted from the walk so the BRANCH is testable, not
only its callees. Before, the only way to exercise the tabular rung was a
dataset in `library/` — content, in the platform repo — so there was none, so
CI could not reach it. **A tested function nothing calls and an untestable
caller are the same defect from two sides.**

Three outcomes: `built`; a determined `no-input`, which passes; and
`unreadable` — an input that is THERE and did not parse — which exits 1 on the
write run and `--check` alike.

Measured on a real CSV + two-sheet .xlsx, then removed: 4 docs / 426 blocks →
6 / 429; `tabular_depth` `table` and `sheet`; 0 orphans on re-run; and a grep
for `mcv1_pct` finds the dataset, which is this bean's Done-when. Falsifier
held: the 4 existing paged entries came out byte-identical. 13 mutations, each
caught by a named test.

**Remaining:** the narrative, still blocked on there being a dataset. The
manifest does not surface it yet — adding that path with nothing in the corpus
to exercise it would be a second unreached branch, which is the defect above.



## Claim released 2026-09-29

Released `in-progress` → `todo` on the owner's instruction (review session https://claude.ai/code/session_014Qj8wncQhqV52QGN1yZDnj). No git change to this bean since before 2026-09-26, no holder recorded, and no open branch touches it; the sessions that held theme D (content folios, SMART/FHIR stack, ingest) work stopped on the 2026-09-25 weekly usage limit. Nothing in the body was changed: re-claim with `bun run cat beans:claim <id>`.



## Handover 2026-10-06 — PAUSED until the repo separation lands (Session F, GOAL 5)

Owner ruling, relayed by the coordinating session (session_012qoycyCSGidZqW245vXhze): repo separation is the primary goal, content authoring/review/publication goes to folio-assistant-core while cat-harness keeps the methods, and that 'needs to be done before F'. This bean resumes AFTER the split. **The code it touches may have moved to folio-assistant-core by then — re-locate it before editing, and re-measure.** Open questions on it are being put to the owner by the coordinating session, one at a time; the answer will be recorded here, not assumed.

## Owner ruling 2026-10-06: agent drafts the dataset narrative, human confirms

Asked in https://claude.ai/code/session_012qoycyCSGidZqW245vXhze, with three options (recommended first): agent drafts, human confirms; humans write them; structural record only for now. **The owner chose "Agent drafts, human confirms"**, consistent with the ruling on images (`d5f1`).

- An agent drafts each dataset's narrative from its headers and sample rows, stamped with **model version** (`iqim`), and queued for human confirmation.
- **First real data** (owner, 2026-10-06): the DAK Excel workbooks and the litlfred/smart-ra Public Comment sheets.
- Runs after the content split, in folio-assistant-core, together with the `eief` extractors.

## Completed on landed evidence
Landed on main in PR #495 (pn6j: refuse to promote — an unmet document never reaches library/).
