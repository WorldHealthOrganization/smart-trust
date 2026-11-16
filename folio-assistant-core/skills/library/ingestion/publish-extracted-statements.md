---
name: publish-extracted-statements
description: >
  The standard step of adding source documents to a folio's working artifact:
  every statement extracted from a library source is published readably in
  the artifact's own pages AND in the shared extraction viewer, each with a
  link to its library entry and to the section it came from, and CI fails
  when the generated pages are stale. Generic across content types; each
  type's adapter says only how its pages look. Executable form:
  `processes/library/publish-extracted-statements.bpmn`.
graph-typologies:
  - library
---

# Publish extracted statements with source links

**A statement nobody can read beside its source is reviewed from memory, or
not at all.** So whenever source documents are added to a folio's working
artifact (a document, a paper, an implementation guide, a guideline), the
statements extracted from them are published where a reader of that artifact
will find them, each one linked back to where it came from.

This is a **standard step**, not a per-folio choice. It is the sub-process
`Process_PublishExtractedStatements`, and every process that brings source
documents into an artifact calls it:

| caller | when |
|---|---|
| [`l1-document-ingestion`](l1-document-ingestion.md) | right after the entry is promoted, which is where it becomes complete |
| `authoring-a-document`, and each content type's authoring process | before the artifact is rendered, so a source taken up since ingestion, or a statement changed since, is published too |

## What is published

A **statement** is a sentence or row captured verbatim from a library entry,
whatever kind the extraction gave it: a recommendation, a requirement, a
candidate a person has still to rule on. It is published **as captured, with
its status**. This step neither promotes nor edits it.

Each statement carries **two links**:

1. **the library entry**: the entry's own page in the library viewer;
2. **the section**: the section of that entry the statement was read from,
   labelled with the section's title and its locator in the source's own unit,
   read off the entry's `structure.json`. For example *"Catch up schedule,
   slide 7"*, *"Annex 2, page 41"*, *"Setup, cells 3–9"*.

The link is a [library reference](../../../schemas/library-ref.ts)
(`instance`, `libraryId`, `sectionId`), so a statement from another
layer's library resolves through that layer's declaration and never
through a relative path. **A statement whose section does not resolve is
reported, never published without a link**: an untraceable statement is the
failure this step exists to prevent.

## Where it is published — both places, from one list

| place | what a reader gets |
|---|---|
| **the artifact's own pages** | the statements of the sources this artifact draws on, inside the artifact, so a reader need not leave it |
| **the shared extraction viewer** | every source and every statement extracted from it, whichever artifact uses them, reached from the site's Sources menu |

Both are generated from **one** collected list, so they cannot disagree about
what was extracted or where it came from. Neither is hand-edited: a person
corrects the extraction or the source, then regenerates.

## What the content type supplies, and nothing more

The step is the same for every content type. What differs is **how the
artifact's pages look**, and that is the content type's adapter's business,
declared in its content profile
([`folio-content-profiles`](../../content/folio-document-adapter/folio-content-profiles.md)):

- a **document** (a handbook, policy guidance): pages of the document;
- a **paper**: an appendix or a section of the paper;
- an **implementation guide** or a guideline built as one: pages of the guide.

The platform layers name no folio, no content type and no level of a
guideline. A folio's own names for its pages (for example "L1
Recommendations" and "Scenario Candidates" in an immunization guideline) are
the folio's, set in its own configuration.

## Run it

```sh
bun run cat statements:pages --page <spec>.json [--page <spec2>.json] [--check]
```

Each page is declared in a committed **page spec** (`folio-statement-page/v1`):
the statement lists it publishes, the page it writes, its title and
introduction, the URL prefixes of the library viewer (`entryBase`) and of the
sources (`sectionBase`), and the content type's table look (`tableAttr`). A
spec rather than flags, because those are free text, and free text is never a
command-line word.

A spec names one or more **statement lists** (`folio-extracted-statements/v1`,
[`schemas/extracted-statement.ts`](../../../schemas/extracted-statement.ts)):
each statement's `id`, its text verbatim, its `kind` and `status` as the
extraction records them, optionally the id of the statement it was
`derivedFrom` (a scenario candidate written from a recommendation names it,
and the page shows a "Derived from" column), and its `source`, a library reference with either a
`sectionId` or the `page` (or slide) it was read from. With only a page, the
section is the one that starts latest at or before it. When several sections
start on that page (a one-page poster), the label names only the page. The front
matter the PDF rung synthesises (`sec-front-matter`) is used only when no
authored section starts at or before the page.

**A collector writes the list, and the collector is not core's.** A folio's
extraction has its own format (a guideline's recommendation rows, a DAK
layer's requirement candidates, a paper's quoted claims), so the content layer
or the folio that owns the format turns it into a statement list. Core resolves,
labels, renders and checks. Declare two specs over the same lists, one for the
artifact's page and one for the shared viewer's, so the two cannot disagree.

## Staleness fails CI

`--check` regenerates in memory and fails on any
difference from the committed pages, and on any link that does not resolve.
CI runs it, so a change to an extraction or a library entry that was not
republished fails the build instead of leaving a page that says something the
extraction no longer does.

## Nothing to publish is a result

A referenced source (its licence forbids a copy), a dataset, or a source with
no normative content yields no statements. The sub-process ends at "Nothing
to publish", which is a determined zero, recorded as such, not a skipped step.

## Related

- [`l1-document-ingestion`](l1-document-ingestion.md): produces the entry and
  its candidates.
- [`l1-coverage`](l1-coverage.md): accounts for every normative sentence.
  Coverage asks whether everything was **captured**; this step makes what was
  captured **readable and traceable**. Neither implies the other.
- [`document-intake`](document-intake.md): the stages an upload goes through.
