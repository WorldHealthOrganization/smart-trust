---
# folio-core-2mb0
$schema: bean/1.0.0
title: Adjudicate the 68 round-trip findings on who-iris's catalogues (66 warn, 2 fail)
status: completed
type: task
created_at: 2026-10-10T17:25:53Z
updated_at: 2026-10-20T18:55:00Z
parent: folio-assistant-slw1
---

Follow-up of `ktt2`. The untainted round trip (who-iris PR #35, `test/results/translation-roundtrip/iris-catalogues.qa-results.json`) flagged 68 of 600 strings. Each entry carries the msgid, msgstr, back-translation and the adjudicator's findings, tagged terminology or semantic. Deciding which reading is right is a reviewer's step (`Task_FlagDrift`, outcomes real / spurious / source-wrong), not an agent's.

## Patterns to rule on first (each covers many entries)
- ~~**'bean' → 'task'** in all five locales (indexes 15, 17).~~ **Ruled 2026-10-11, see below.**
- **'CDN edge' → 'CDN node'** (es, fr, ru): 'node' already means a catalogue node on these pages.
- **ru: DSpace 'item' → 'record'**, which collides with 'metadata record'. This is most of ru's 28 warnings.
- **'ingested' → 'imported' (ru) / 'included' (zh)**: ingest is a term of art.
- **'Bundle' → 'Package'** (ru fail, fr major): a different DSpace term.
- **ru #12 (fail)**: the banner attributes 'its own catalogue' to WHO IRIS, undermining the provenance disclaimer.
- **zh 'size' → 'capacity'** (indexes 5, 6, 7, 100).

## Done when
- [ ] each flagged entry has a recorded outcome (real / spurious / source-wrong)
- [ ] the 'real' ones are fixed in the PO files, and the round trip is re-run on the changed strings only, so the report goes current again
- [ ] lffo's 580/580 is annotated as superseded by this independent run

## Owner ruling 2026-10-11: 'bean' is never 'task'

> "bean becoming task NO.... there is already a Task. a bean is a note/rmk on
> work needed of an agent (its state) for a Task for particular instance of a
> Process flow. translate it as bean or kernel for now"

**Applied in who-iris#39 (merged).**
- **Outcome for these 10 entries (indexes 15 and 17 × ar, es, fr, ru, zh):**
  `real`. The term was mistranslated.
- **Fix:** "bean" is kept as an untranslated Latin-script loanword. The
  translator note in `gen-iris-pages.ts` used to say "a 'bean' is a work
  item", which caused the error. It now carries the owner's definition and
  the rule. `.pot`, `.po` and the 10 replica pages are regenerated.
- **Round trip, re-run on those 10 strings only, same protocol:**
  - index 15: pass ×5;
  - index 17: "bean" is right, but it now **warns ×5 on a different term**:
    "held copies" comes back as saved, preserved or stored, and "held" is
    the project term for copies actually present.
- **Totals:** 532/66/2 → **537/61/2** of 600. 61 warn and 2 fail still await a
  ruling.

**Pattern to add to the list above:** 'held' (copies actually present)
rendered generically, index 17 in all five locales.

For the record, the owner allowed "kernel" as an alternative. The loanword
was chosen because the strings name a bean by its ID (`jbx2`, `yl5w`), and
the tracker's own word keeps that link.

## Owner ruling 2026-10-11: 'held' rendered generically is acceptable

"Held --> ok." Index 17's five warnings ('held copies' coming back as
saved, preserved or stored) are **spurious**: no change to the PO files. 5
more entries ruled, so 56 warn and 2 fail remain.

## Owner rulings 2026-10-11, second round (who-iris#42, merged)

**Correction to the first ruling.** "I didn't mean to say leave bean
untranslated. I meant to use the translation of bean or kernel that makes
sense." who-iris#39 had kept the English word. It is now each language's
ordinary word for a bean or kernel, as in a coffee bean: ar «حبة»,
es «grano», fr «grain», ru «зерно», zh «豆».

| pattern | ruling | outcome |
|---|---|---|
| DSpace 'Bundle' → 'Package' (ru fail, fr major) | **"File Set"**, all five locales | real, fixed |
| ru DSpace 'item' → «запись» (collides with «запись метаданных») | **«единица хранения»** | real, fixed in 15 strings |
| 'CDN edge' → 'CDN node' (es, fr, ru) | **the CDN's edge server** (the owner asked about "CDN arrow"; that would read as a graph edge) | real, fixed |
| ru #12: banner attributes the catalogue to WHO IRIS | apply the fix | real, fixed: the catalogue is folio-assistant's own, describing IRIS |
| zh 'size' → 'capacity' (容量) | apply the fix: 大小 | real, fixed in 4 strings, plus 推算 → 插值 (interpolated) |
| 'held' rendered generically | "ok" | spurious |

**Round trip, re-run on the 39 changed strings.** The adjudicator was given
these rulings as a glossary. 37 pass and 2 warn. The two warnings are fr 16
and 41, where DSpace 'item' is «document»; that rendering predates this round
and no ruling covers it.

**Totals: 566 pass / 34 warn / 0 fail of 600** (from 532/66/2 at the start).

**Still to rule:**
- 'ingested' → 'imported' (ru) / 'included' (zh), and ru #12's
  'INGESTED' → 'IMPORTED';
- fr 'item' → «document»;
- the remaining minor warnings, which are listed per entry in the report.

## The 34 still open, grouped (measured 2026-10-20, who-iris @ eff3ac8)

Read from `test/results/translation-roundtrip/iris-catalogues.qa-results.json`:
33 minor and 1 major, 0 fail. The "ru #12 'INGESTED'" line above is out of date. The
report has no ru #12 now. The INGESTED banner that still warns is zh #12.

| group | entries | what came back |
|---|---|---|
| A. 'ingested' | ru 9, 13, 20, 54, 80; zh 9, 12, 13, 20, 54, 80 (11) | ru 'imported', zh 'included' |
| B. fr DSpace 'item' | fr 16, 19, 41 (3) | «document» |
| C. zh 'directory' | zh 22 (1, **major**) | 'catalogue', which is a distinct defined object here |
| D. 'kind' | fr 22, ru 22 (2) | 'type', which loses the graph-typology term in the addressing rule |
| E. fixed state names | ru 92, zh 92 ('referenced'); es 102 ('State') (3) | a phrase, or 'Status', instead of the fixed name |
| F. 'captured' | zh 70, 78 (2) | 'harvested', which is the OAI-PMH term of art |
| G. small sense drifts | ar 11, 39, 76, 80, 91; es 23, 95; fr 100; ru 25, 26, 76, 101 (12) | a near-synonym, or a change of mood |

C, D, E and F collide with a term this product or DSpace defines. That is the same
shape as 'CDN node' and ru «запись», which were both ruled real. A, B and G
keep the meaning a reader needs, which is the same shape as 'held', ruled spurious.

## Owner decision

1. **(Recommended) Fix C, D, E and F (8 entries). Rule A, B and G spurious (26).**
   The 8 fixes give each locale's translator note the defined term: zh
   'directory' is not 'catalogue', 'kind' is not 'type', state names are
   rendered as names, and 'captured' is not 'harvested'. The round trip is then
   re-run on those 8 strings only, as before. If they pass, 2mb0 closes at
   600/600 adjudicated, and lffo's 580/580 is annotated as superseded.
2. **As 1, and also fix A.** 'ingest' becomes a glossary term with one fixed
   rendering per locale (the translator proposes it, the owner accepts or
   changes it). 19 strings change.
3. **Fix all 34.** B and G change as well. This is the most churn, and it
   mostly swaps one near-synonym for another.
4. **Rule all 34 spurious and close 2mb0.** No PO change. C stays wrong in zh.

**Default if no answer:** option 1. The 8 strings it changes are in who-iris's
PO files, and the change is reversible.

## Owner ruling 2026-10-20: fix all 34 (option 3), applied in who-iris#77

The owner answered "1", then "2", then "3". Asked which one stood, they chose
"3: fix all 34".

- **Fixes:** all 34 `msgstr` values in the five site PO files. The renderings
  are listed in who-iris#77, and the adjudicator was given them as a glossary.
- **Round trip, re-run on those 34 strings only, same two-agent protocol:**
  33 passed the first time. ar 80 warned ("none recorded" came back as
  "unregistered"); it was corrected, re-run, and passed.
- **Totals: 600 pass / 0 warn / 0 fail** (from 532/66/2 at the start).

Done when, re-measured:
- [x] each flagged entry has a recorded outcome
- [x] the real ones are fixed and re-run on the changed strings only
- [x] lffo's 580/580 is annotated as superseded (`supersedes_note` in the report)

Closes when who-iris#77 merges.

## Completed 2026-10-20

who-iris#77 merged (2301d83): all 34 fixed, 600/600 pass.
