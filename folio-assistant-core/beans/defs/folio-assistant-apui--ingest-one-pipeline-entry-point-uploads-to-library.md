---
# folio-assistant-apui
$schema: bean/1.0.0
title: 'INGEST: one pipeline entry point — uploads/ to library/ through a single documented path'
status: completed
type: task
priority: normal
created_at: 2026-09-16T06:43:50Z
updated_at: 2026-10-07T17:18:00Z
parent: folio-assistant-slw1
---

## What

`uploads/` and `library/` are two stages of ONE pipeline, but there is no single
entry point that takes a file across. Today the move is done by
`scripts/migrate-uploads-to-library.py` plus whatever the ingesting agent
remembers to run.

## Why it matters more than it looks

**The corpus-grep checklist searches `library/` only.** Anything still in
`uploads/` is invisible to every "has the corpus already got this?" check — so
an un-ingested paper does not merely sit unread, it makes a *clean grep* mean
"nobody has done this" when the source is right there. That is exactly how a
held result gets re-derived.

## Done when

One documented command takes a file from `uploads/` to `library/<bib-slug>/`
with structure, derived content, the Dublin Core record and the manifest, and
every other path is a wrapper around it or is deleted.

Diagram: `processes/document-ingestion.bpmn` (`Process_Ingestion`).

_2026-09-19T12:23:13Z_ — Claimed by claude/ecstatic-goldberg-eroyaz — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

_2026-09-19T12:12:22Z_ — Re-measured 2026-09-19 before starting. The bean's description of TODAY is stale in three ways, and the third changes the size of the job.

1. It names scripts/migrate-uploads-to-library.py as the current path. That file DOES NOT EXIST.

2. It says the move is done by that script 'plus whatever the ingesting agent remembers to run'. Measured: NOTHING in the repo writes library/ at all. A grep for writeFile/mkdir/copy/move targeting library/ across scripts/, content/ and src/ returns zero. The files that mention library/ are readers — harness-dirs, repo-partition, scan-repo-content, check-declared-paths — plus two PDF helpers. git log on library/milnorlink/structure.json shows it was created by an ordinary content commit ('The Milnor voice is derived from Milnor...'), i.e. hand-authored.

3. Its motivating harm is not currently live. All four files in uploads/ already have matching library/ slugs (9789241548960_eng.pdf -> 9789241548960-eng, WHO_PUB_TPS_93.1.pdf -> who-pub-tps-931, WPR-RDO-2020-003-eng.pdf -> wpr-rdo-2020-003-eng, milnorlink.pdf -> milnorlink). So there is no un-ingested source making a clean corpus-grep lie right now. The RISK the bean describes is real; the instance is not.

So this is not 'consolidate several scattered paths into one entry point'. It is 'write the pipeline, which does not exist' — with PDF extraction, sectioning, derived content, a Dublin Core record and a manifest all to be designed, and it is the spine nine sibling beans in the INGEST epic hang off. Left unclaimed rather than started, because that is a materially bigger and more design-heavy job than the bean advertises and the owner should price it before I build it.

_2026-09-19T12:14:45Z_ — CORRECTION to the note above, same day. Point 2 of that re-measurement is WRONG and I am retracting it.

I wrote 'NOTHING in the repo writes library/ at all'. False. scripts/pdf-pages.py and scripts/pdf-structure.py both ingest into library/, and milnorlink/structure.json says so in its own structure_note: 'Ingested at PAGE granularity by scripts/pdf-pages.py'. I had that file in front of me in the grep output and dismissed it as a PDF helper.

Why the grep could not have found it, because the method is the lesson: I searched for (writeFile|mkdir|open..w|copy|move|rename) and library/ ON THE SAME LINE. pdf-pages.py writes via secdir.mkdir(...) and (secdir / f'{id}.md').write_text(...), where secdir descends from the -o library argument. The literal 'library' never appears on a write line, so a same-line pattern structurally could not match. I asserted a strong negative from a pattern that could not have produced the positive.

What is actually there — four rungs, each with a stated reason to exist:
  pdf-structure.py  primary; reads an EMBEDDED outline into real sections (--ocr, --no-sections, --json)
  pdf-pages.py      fallback when there is no outline: PAGE granularity, refusing to infer a chapter tree (bean 6xaz records two measured cases where inference was confidently wrong)
  pdf-ocr.py        recovers text where extraction fails entirely (scanned, image-only)
  pdf-tables.py     tables and figures, which pdf-structure/v1's Section does not carry at all

So the bean's ORIGINAL description was closer to right than my correction: the script name it gives is wrong, but 'scripts plus whatever the ingesting agent remembers to run' is exactly the situation — the agent must choose between pdf-structure and pdf-pages on whether an outline exists, decide whether OCR is needed first, and remember pdf-tables separately.

That makes apui tractable and small after all: ONE entry point that sequences these four with the decision rules made mechanical, and the rules written down as a skill rather than carried in an agent's head. Point 3 of the previous note stands (all four uploads have library slugs; the risk is real, the instance is not).

_2026-09-19T12:31:11Z_ — DONE (first cut). One entry point: bun run cat ingest uploads/FILE.pdf [--dry-run].

It CHOOSES a rung and runs it; it re-implements nothing. The rule is read off the four entries already in library/, not invented:
  toc_source: outline                       -> pdf-structure
  toc_source: none, text_source: text-layer -> pdf-pages
  toc_source: none, text_source: ocr        -> pdf-ocr, then pdf-pages --from-ocr
Verified: all four uploads resolve to the slug their existing library entry already has.

Third state: a PDF that cannot be probed is 'undetermined', exit 2, ingests NOTHING. Never 'no outline' -- a document filed under the wrong rung reads as ingested while its structure is wrong, which is 6xaz's failure mode. This container has no PyMuPDF, so all four currently report undetermined, which is the behaviour working rather than a gap.

The decision rules are a SKILL, per the owner: skills/library/library-core/library-ingestion.md, in the HARNESS layer. Not folio-assist-core: uploads and library are both harness-declared graph kinds (folio is core's), so putting ingestion in core would make the harness's own library graph writable only from above it -- a wrong-direction dependency, and after the split a circular one between repos. That is what zlmp exists to drain.

Two things the gates caught in my own work, both the same defect as the bean-store one earlier today: I hardcoded '-o library' four times (check:declared-paths refused it; now read via directoryForGraph from harness.json), and I reimplemented slugify in TypeScript (it got WPR-RDO-2020-003-eng wrong; scripts/_pdf_doc_id.py is the one definition, and bean rlp5 records that three copies already existed and drifted -- mine would have been a fourth).

NOT done: --dry-run cannot be verified end-to-end here without a PDF backend, and no upload was actually re-ingested (all four already have entries). 12 tests cover the decision against fixtures.

---

*2026-09-23* — **VERIFIED END TO END. The bean's own "NOT done" is now done,
and following its output found a defect.**

The note above says *"--dry-run cannot be verified end-to-end here without a
PDF backend"*. That was a fact about **that container**, not a standing one:
`pymupdf` is declared in `requirements.txt` (bean `68dt`, whose comment calls
it *"the single most load-bearing dependency here"*), it installs in one
command, and everything then works.

**The rung decision is right across six real documents**, which is the first
time it has been exercised on anything but fixtures:

| document | rung | evidence the tool gave |
|---|---|---|
| 5 browser prints (Antigravity, Gemini CLI, Anthropic, Claude Docs, OpenAI) | `pdf-pages` | no outline, 1 640–33 036 chars of text layer |
| `2602.12670v4` (arXiv) | `pdf-structure` | **81 of 81** outline entries can carry a chapter |

**The missing-backend path is not a gap either**, and I checked by
uninstalling `pymupdf` rather than by reading the code: it reports `no PDF
backend: No module named 'pymupdf'` and ingests nothing. It does not conflate
that with an unprobeable PDF. My hypothesis that it did was wrong.

## The defect: a fixed code path does not fix the prose beside it

The staged output prints *"Next: run the remaining arms with -o
`<staging>/<slug>`"*. **That is the entry directory, and every arm's `-o` is
the library ROOT** — `pdf-images.py --help` says so outright: *"library root;
the sidecar lands in `<out>/<doc-id>/`"*.

Following it produced `ingest-staging/<slug>/<slug>/images.json` while the
entry's own `images.json` stayed absent. Which is **exactly** the failure the
comment above `stagingRoot` already records from #495:

> `checkEntry` read an empty parent and reported EVERY requirement unmet — a
> refusal that looked exactly like a correct one.

That bug was fixed in the CODE (`planFor(pdf, undefined, stagingRoot)`) and a
test guards it. **The printed instruction was never fixed and never tested**,
so an agent following the tool's own next-step reproduced the defect by hand.
Fixed, with the missing assertion added and proved non-vacuous by reverting
the line and watching the test fail.

## Point 3 of the 2026-09-19 note is now STALE — the harm is live

It recorded *"all four uploads have library slugs… the RISK the bean describes
is real; the instance is not."* Re-measured today with
`derive_doc_id_from_pdf` over all five declared `*/library` directories:
**19 PDFs in `uploads/`, 11 with a library entry, 8 without.** Seven of the
eight are `r8br`'s browser prints. So the corpus-grep harm this bean was
opened for is **no longer hypothetical**.

I got that measurement wrong once first: a bare `python3 _pdf_doc_id.py FILE`
prints nothing (it is a module, and the caller's own comment warns that
`derive_doc_id` is the wrong function), so every row read "NO LIBRARY ENTRY".
An empty slug column made a false negative look like a finding — the same
shape as the retracted note in this bean's own history.

## What is still NOT done

`ingest` sequences **one** rung and then hands off. The done-when asks for one
command that takes a file to `library/<slug>/` *with structure, derived
content, the Dublin Core record and the manifest* — and blocks, manifest and
images are still run by hand before `--promote`. Staging one document leaves
**4 requirements unmet**, named by the tool. So this bean stays open: the
entry point is real and verified, but it is not yet the whole path.

---

*2026-09-23, second session* — **THE PIPELINE TERMINATES.** One document went
`uploads/` → `library/` in two commands, and the done-when above is met.

```
bun run cat ingest "uploads/Skills in OpenAI API.pdf" --library ../agent-skills/library
bun run cat-harness/scripts/ingest-document.ts "uploads/..." --library ... --promote
```

→ `agent-skills/library/skills-in-openai-api/` with `structure.json`,
`sections/`, `blocks/`, `manifest.jsonld`, `images.json`, its `.jsonld`
siblings and a committed QA verdict. `✓ (L1 complete, promoted)`.

## The instruction could never have been made correct

`withDerivedArms` sequences `pdf-images.py` and `l1-blocks.ts` after the rung.
The printed *"run the remaining arms with -o …"* is **deleted**, not corrected,
because the two arms take OPPOSITE conventions — measured by running both:

| arm | `-o` wants | given the other |
|---|---|---|
| `pdf-images.py` | the library ROOT | writes `<slug>/<slug>/images.json`; the entry's own stays absent |
| `l1-blocks.ts` | the ENTRY directory | throws *"no structure.json — this is not a staged entry"* |

**No value of `-o` was right for both.** So the correction shipped in #1035
made that line right for `pdf-images` and wrong for `l1-blocks` in the same
stroke — my own fix, half wrong, and only visible by running the other arm. A
sequence in code has no sentence to get wrong.

## What running it for real found: L1-complete is not corpus-consistent

A promoted entry passed `check:l1-complete` and then **failed
`gen:jsonld:check`** — `manifest.jsonld` and `sections/*.jsonld` had no
`.jsonld` siblings. Promotion checks the L1 requirements; it does not check
the corpus-level generators that read the result.

So the full path today is **three commands, not two**:

```
bun run cat ingest <pdf> --library <lib>          # rung + images + blocks/manifest
… --promote                                   # crosses into library/
bun run cat-harness/content/pipeline/gen-library-jsonld.ts   # the siblings
bun run cat check:l1-complete -- --write          # the committed verdict
```

The last two are **not** folded into `--promote` here, deliberately: both are
CORPUS-WIDE generators, and having a single-document promotion rewrite the
whole corpus is a much larger claim than this bean makes. `gen-library-jsonld`
also reported **81 pre-existing stale nodes** under `arxiv-2508.05192v2` and
offers `--prune`; nothing was pruned —
`deletion-requires-confirmation`, and they are not this change's to remove.

## A fifth thing the path does not do: no licence is recorded

Running the gates after promotion moved `source-licence.qa-results.json`'s
`not-recorded` family from **20 to 21**, the new entry being
`agent-skills/library/skills-in-openai-api` — the document this session
ingested.

So an entry produced by the full pipeline arrives **licence-unknown**. The
family is *"Reported, not gated; the field is new"*, so nothing fails and
nothing is blocked; but "the pipeline ran and the entry is complete" and "we
know what we may do with this content" are different claims, and only the
first is established by promotion.

Not fixed here, and not fixable by a tool alone: a licence is a fact ABOUT a
source, read off the document or its provenance, and an arm that guessed one
would be asserting a legal claim from a heuristic. That is a worse failure
than leaving it unknown, which is presumably why the family reports rather
than gates.

## Still open

- Folding the two corpus generators into promotion, or deciding they stay
  separate on purpose. That is the remaining ambiguity in this bean's
  done-when: *"one documented command"* is now two, plus two corpus steps.
- `archive` and `tabular` rungs get NO derived arms. Stated rather than
  assumed: `PAGED_ONLY` exists because not every requirement applies to every
  kind, and neither was measured. "More arms cannot hurt" is how a gate starts
  reporting a requirement over content it was never about.
- Seven of the eight un-ingested uploads (`r8br`'s browser prints) are still
  un-promoted. The path is proven on one; promoting the rest is a corpus
  addition and is the owner's call, not a side effect of fixing a tool.



## Claim released 2026-09-29

Released `in-progress` → `todo` on the owner's instruction (review session https://claude.ai/code/session_014Qj8wncQhqV52QGN1yZDnj). No git change to this bean since before 2026-09-26, no holder recorded, and no open branch touches it; the sessions that held theme D (content folios, SMART/FHIR stack, ingest) work stopped on the 2026-09-25 weekly usage limit. Nothing in the body was changed: re-claim with `bun run cat beans:claim <id>`.

_2026-10-06T06:00:26Z_ — Claimed by claude/goal5-ingest-spine — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

## 2026-10-06 — the promotion half closed (issue #2253, branch claude/goal5-ingest-spine)

Re-measured by running it: staged + promoted uploads/2609.07340v1.pdf into folio-assistant-sci/library. Two defects, both fixed:
- The printed Next line was `../uploads/X.pdf` (not there from the repo root) with no `--library`. It now echoes the caller's own argv plus `--promote` (`promoteCommand`).
- The promoted entry failed `gen-library-jsonld --check` (37 nodes), with a manifest @id naming cat-harness. The instance and the title catalogue are read off the entry's LOCATION, and staging is not the destination. `buildEntryNodes(docId, dir, locatedAt)` now mints for the destination, and `--promote` builds the nodes before the copy (refusing if they can't be built) and writes them after.

After the fix: the printed Next line, run verbatim, promoted the entry; `--check` reported 37 nodes up to date, and the @id names folio-assistant-sci. Mutation (revert to libraryInstanceOf(dir)) caught by the new test. `check:l1-complete --write` is no longer a step: verdicts live on qa-reports (0dav).

The whole path is two commands. The test entry was removed afterwards; promoting uploads into a library is the owner's call.

Remaining, NOT in this change: l1-blocks.ts and gen-library-jsonld both write manifest.jsonld + blocks/ (two writers, the first a weaker copy). Promotion now overwrites the staging copy, so the defect is masked rather than removed.



## Handover 2026-10-06 — PAUSED until the repo separation lands (Session F, GOAL 5)

Owner ruling, relayed by the coordinating session (session_012qoycyCSGidZqW245vXhze): repo separation is the primary goal, content authoring/review/publication goes to folio-assistant-core while cat-harness keeps the methods, and that 'needs to be done before F'. This bean resumes AFTER the split. **The code it touches may have moved to folio-assistant-core by then — re-locate it before editing, and re-measure.** Open questions on it are being put to the owner by the coordinating session, one at a time; the answer will be recorded here, not assumed.

State at the pause: the promotion half landed on branch claude/goal5-ingest-spine (issue #2253). The path is TWO invocations of one command — stage, then --promote — with JSON-LD minted for the destination. The done-when is met once that PR merges. What is still open is listed in the 2026-09-23 notes (archive/tabular get no derived arms; seven staged browser prints un-promoted — owner's call), plus l1-blocks.ts as a second, weaker writer of manifest.jsonld + blocks/ that promotion now overwrites (masked, not removed).

## Completed on landed evidence
Landed on main in PR #495 (pn6j: refuse to promote — an unmet document never reaches library/).
