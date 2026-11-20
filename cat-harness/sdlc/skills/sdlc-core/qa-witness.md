---
name: qa-witness
description: >
  The QA projections written to `test/results/witnesses/` and stored on the `qa-reports` branch — what a `qa-witness/v1` document
  says, which three families produce one, how to read a verdict and the witness
  behind it, and why "could not determine" is a third state everywhere in them.
consulted: true
graph-typologies:
  - qa
---

# QA witnesses — the published projection of every verdict

A **QA witness** is what a reader sees when they open the QA badge beside a
heading on the docs site. One JSON document per subject, all of them
`"$schema": "qa-witness/v1"`, all of them written under
`test/results/witnesses/`, **stored** on the orphan `qa-reports` branch under
`main/<sha>/` or `pr/<n>/<sha>/`, and **published** at `/assets/qa/`.

Where a witness LIVES and where it is SERVED FROM are different questions. It
is a QA process's output, so it lives in the declared `test/results/` tree —
the run's WORKING COPY; the durable record is the commit-keyed entry the CI job
`qa-publish` writes to `qa-reports` through `qa-store.ts`. Do not regenerate a
witness to "commit the result". It is served from `/assets/qa/`: every
`data-qa-src` in a generated page says `/assets/qa/…`, and the publishing
workflows copy the directory into `_site/assets/qa/` after Jekyll runs.

## It is a projection, not the verdict

Getting this backwards puts a fix in the wrong place.

The **verdict** is produced by a sweep and lives beside its subject —
`*.qa.json` beside a content block, `test/results/kg-qa/**/*.kg-qa.json` for a skill or a
diagram. The **witness** is the same verdict rendered for the web, flattened
into the shape the panel draws and placed where the site can fetch it.

So a wrong verdict is fixed in the checker; a verdict that reads wrongly on the
page is fixed in `pipeline/qa-witness.ts` or in `docs-ui.js`. Editing a
file under `test/results/witnesses/` by hand fixes neither — it is generated, and the
next `gen-docs-pages` run discards the edit.

## The three families

`family` is a field in the document, not only a suffix on the filename.

| family | subject | verdict comes from |
|---|---|---|
| `block` | a content block | the QA sweep's `*.qa.json` |
| `kg` | a process, decision, role or skill | `kg-audit`'s `*.kg-qa.json` |
| `translation` | a page's locale coverage | the translation sweep |

They matter apart because **their witnesses are not equally specific.** A
`block` document's criteria are checked by genuinely different scripts —
`qa-checkers-voice.ts` on one criterion, `qa-checkers-extended.ts` on the next
— so a per-criterion `scriptHash` is real information. A `kg` document's
criteria all come from one auditor, so the same field is the same value
repeated, and the auditor's identity is recorded once in
`skills/kg-qa.manifest.json` rather than in each sidecar.

Read a per-criterion hash as evidence about that criterion only in the `block`
family.

## Reading one

- **`state`** — the roll-up: `pass`, `fail`, `warn`, `unknown`, `unswept`.
- **`counts`** — how many criteria landed in each result. A clean sweep still
  says how much it checked, which is the difference between "nothing wrong" and
  "nothing looked at".
- **`criteria[]`** — one entry per criterion, each with `result`, optional
  `evidence` quoted verbatim from the content, and `witnesses[]`.
- **`witnesses[]`** — who ruled, and on what. `kind` is `script`, `agent` or
  `human`. A script witness carries the checker's id and `scriptHash`; an agent
  witness carries its model and session; `freshness` says whether the inputs
  have moved since.
- **`sidecars[]`** — the repo paths of the verdicts this was projected from.
  Follow these to change anything.

**Worst first.** The panel partitions criteria into loud (`fail`, `warn`,
`unknown`) and quiet (`pass`, `n/a`) and folds the quiet behind one control
that states its own count. A corpus that is passing is the normal case, so the
fold is what keeps the two rows that need reading at the top.

## Three states, everywhere

`unknown` and `unswept` are not `pass`, and neither is an absent field.

- A criterion the sweep could not evaluate is `unknown`, never `pass`.
- A field the producer does not record — `kg-audit` keeps no timestamp — is
  rendered "not recorded", never blank. A blank cell reads as a value the
  reader failed to notice.
- A projection that cannot be fetched says so and names the file. A panel that
  opens empty is indistinguishable from a subject with nothing to report.

## Do not write a spec against a live verdict

**A verdict is not a fixture.** A test of the panel that asserts on a real
sidecar's `fail` goes red when the content is fixed and the finding becomes
`pass`; the corpus is supposed to reach zero failures.

Drive the shape from the real document and put the state under test back in
yourself — and locate the criterion **by id**, never by index, because index
and render order coincide only while nothing sorts above it.

## Where things are

| | |
|---|---|
| projections (working copy) | `test/results/witnesses/**/*.{block,kg,translation}.json` |
| projections (stored) | `qa-reports:main/<sha>/<instance>/test/results/witnesses/…` (or `pr/<n>/<sha>/…`); `bun run cat qa:fetch --ref …` reads them, and a miss is never read as clean |
| projections (published) | `/assets/qa/…`, copied into `_site` by `docs-site.yml` and `feature-staging.yml` |
| schema + builder | `pipeline/qa-witness.ts` |
| written by | `scripts/gen-docs-pages.ts` |
| drawn by | `site-chrome/assets/js/docs-ui.js` (`qaBuildPanel`) |
| block verdicts | `content/**/*.qa.json` |
| kg verdicts | `test/results/kg-qa/<subject-dir>/<stem>.kg-qa.json` — the tree MIRRORS the subject's path, because four basenames already collide across packages. Path from `kgQaSidecarPath` in `schemas/sdlc/kg-qa.ts`, never composed by hand. Auditor in `skills/kg-qa.manifest.json` |
| judgements behind a verdict | `test/attestations/<family>/<mirrored subject path>.attestations.json` (`qa-attestations/v1`, the `attestations` graph): every agent, human and baseline-pair judgement, kept on `main` because regeneration cannot reproduce it. Schema `schemas/sdlc/qa-attestations.ts` |

The schema lives in `pipeline/`, not in the declared `schemas/` graph,
because it is the pipeline's own output shape.
