---
name: bib-qa
description: >
  Bibliography quality-assurance agent — validates every reference in
  content/schema/references.ts against several QA checks: URL availability,
  URL resolution, metadata completeness, citation coverage, and
  screenshot/image evidence.  Generates bib-qa.json consumed by the
  standalone bib-qa.html dashboard.
allowed-tools: Read Write Edit Bash Grep Glob WebFetch Agent
---

# Bibliography QA Skill

## Purpose

Ensure every entry in the bibliography (`content/schema/references.ts`)
is well-formed, reachable, accurately cited, and backed by evidence.
The skill operates at two levels:

1. **Automated pipeline** — `bun run pipeline/bib-qa.ts` evaluates the
   machine-checkable tags per reference.
2. **Agent-assisted review** — when invoked by a collaborator or during
   QC, the agent performs deeper checks that require network access or
   content understanding.

The per-reference QA tag vocabulary, the verification status model and the
intake tooling are in [`bib-qa/qa-tags.md`](bib-qa/qa-tags.md); consult a row
when tagging.

## When to Invoke

- User says "validate bibliography", "check references", "bib QA"
- During QC review of a chapter or the full paper
- When authoring: adding a new `ref()` entry to `references.ts`
- Before submission / publication readiness checks

## Workflow

### 1. Generate the QA report

```bash
cd content && bun run pipeline/bib-qa.ts
# → writes content/bib-qa.json

# With URL checking (slower, needs network):
cd content && bun run pipeline/bib-qa.ts --check-urls
```

### 2. Review the dashboard

Open `ui/bib-qa.html` in a browser (served at `/folio/bib-qa.html`
when the folio server is running).  The page loads `bib-qa.json` and
displays:

- Summary cards (total, clean, warning, failing)
- Filterable/searchable reference list
- Per-reference detail panel with QA tags, metadata, citations, and images
- Lightbox for screenshot viewing

### 3. Fix issues (agent workflow)

For each failing reference, the agent should:

1. **Missing URL**: Search for the article DOI or URL.  Use `WebFetch`
   to verify the URL loads.  Update `references.ts` with the URL/DOI.

2. **URL does not resolve**: Check if the DOI has changed.  Try
   `https://doi.org/<DOI>` and common publisher patterns.  Update if
   the canonical URL has moved.

3. **Incomplete metadata**: Fill in missing fields (authors, year,
   journal, publisher) from the article page or CrossRef API:
   `https://api.crossref.org/works/<DOI>`

4. **Uncited reference**: Determine if the reference is used somewhere
   not yet scanned (e.g., a comment, a proof sketch).  If genuinely
   orphaned, flag for author review — do NOT delete without consent.

5. **Missing screenshot**: For references where the cited result
   (theorem, figure, table) is critical to the project's argument,
   capture a screenshot of the relevant page/result and save it to
   `content/bib-qa-images/<refid>.png` (or `.jpg`, `.pdf`).
   Multiple images: `<refid>-1.png`, `<refid>-2.png`.

### 4. Re-run and verify

```bash
cd content && bun run pipeline/bib-qa.ts --check-urls
```

Screenshots are optional for non-critical references.

## File Layout

```
content/
  schema/references.ts        ← Bibliography source of truth (CSL-JSON)
  pipeline/bib-qa.ts          ← QA pipeline script (pass/fail per tag)
  pipeline/validate-bib.ts    ← Comprehensive correctness audit
                                (--doi / --cross-check / --crossref /
                                --arxiv / --pandoc)
  pipeline/validate-references.ts  ← Key-resolution + citation cross-check
  bib-qa.json                 ← Generated QA report (gitignored)
  bib-qa-images/              ← Screenshot evidence
    <refid>.png               ← Named by reference id
    <refid>-1.png             ← Multiple images per reference
uploads/                      ← Full-paper PDFs / data tables for
                                offline citation verification.
  <id>.pdf                    ← One file per cited paper (where
                                publicly downloadable)
scripts/
  gen-bib-papers-list.py      ← Scan references.ts → bib-papers-list.txt
  bib-papers-list.txt         ← Generated batch-intake list
  upload-bib-papers.sh        ← Batch download → commit-per-paper →
                                SSH push → optional gh pr create
  upload-to-uploads.sh        ← Single-file intake (ad-hoc additions)
ui/bib-qa.html                ← Standalone QA dashboard
```

## Integration with Other Skills

| Skill | Integration |
|-------|-------------|
| `editor` | When adding `\cite{}` to content, verify the reference exists and passes QA |
| `content-validation` | The `uses-resolve` constraint validates `\cite{}` keys; bib-qa adds deeper checks |
| `todo-review` | Low-scoring references can generate TodoItems for the author |
| `bib-human-review` | Human-validated review status drives the verification model |

## Adding a New Reference (checklist)

When authoring adds a `ref()` entry:

1. **Required fields**: `id`, `type`, `title`, `author`, `issued`
2. **DOI**: Include if available (validates format automatically;
   `validate-bib --doi` confirms it resolves)
3. **URL**: Include direct link to article page (prefer arxiv,
   numdam, archive.org, or faculty pages — these are the patterns
   `gen-bib-papers-list.py` can auto-extract for intake)
4. **Run QA**: `cd content && bun run pipeline/bib-qa.ts`
5. **Cross-check description**: When adding `-- Ref: [<id>] <desc>`
   to a formal-proof file, include the author surname or a significant
   title word in `<desc>` so `validate-bib --cross-check` confirms the
   description anchors the entry. Bare theorem/section refs
   ("Theorem 3.2") will warn; ideally write
   "Smith, Theorem 3.2 — uniqueness of …".
6. **Run validate-bib**: `cd content && bun run validate-bib --cross-check`
   to confirm no anchor mismatch; pair with `--strict` in CI.
7. **Local PDF intake** (optional but recommended for theorem-citing
   references): add the paper to `scripts/bib-papers-list.txt` or
   place the PDF in `uploads/<id>.pdf` directly via
   `bash scripts/upload-to-uploads.sh <url-or-local-path>`.
8. **Screenshot** (Optional): For theorem/result citations, capture
   the relevant page to `content/bib-qa-images/<id>.png`.
9. **Cross-check citation site**: Ensure `\cite{<id>}` appears in
   the relevant `.md` file or `-- Ref: [<id>]` in the relevant
   formal-proof file.

## Investigating wrong-work resolutions

When `validate-bib --cross-check` or a code reviewer flags an entry's
metadata as not matching the citation comment, the canonical workflow
is:

1. **Confirm by inspecting `uploads/<id>.pdf`** if present:
   `file uploads/<id>.pdf` → real PDFs report "PDF document, version X.X";
   landing pages report "HTML document". HTML files are likely intake
   failures (numdam landing pages, NIST CGI lookups etc.).
2. **For HTML landing pages**: update the URL-pattern logic in
   `scripts/gen-bib-papers-list.py` (e.g. numdam.org/item/<id>/ →
   /item/<id>.pdf), regenerate `bib-papers-list.txt`, delete the
   broken `uploads/<id>.pdf`, re-run `upload-bib-papers.sh`.
3. **For wrong-work resolution** (entry metadata names a different
   paper than the citation comment intends): two options —
     a. Update the entry's `title` / `author` / `DOI` / `issued` to
        match the cited work (the citation comment is canonical), or
     b. Split the key into `<id>a` and `<id>b` and update each
        citation site to use the right variant.
   This is an author-judgement call; the bib QA agent should propose
   a resolution but defer the choice via `AskUserQuestion`.

## Output Format

The `bib-qa.json` schema:

```json
{
  "generated": "2026-04-07T...",
  "totalRefs": 101,
  "summary": { "pass": 380, "warn": 45, "fail": 12, "unchecked": 68 },
  "entries": [
    {
      "id": "einstein1905",
      "type": "article-journal",
      "title": "...",
      "authors": "Albert Einstein",
      "year": "1905",
      "url": "https://doi.org/...",
      "doi": "10.1002/...",
      "journal": "Annalen der Physik",
      "tags": [
        { "key": "has_url", "label": "Has URL", "status": "pass", "detail": "..." }
      ],
      "citedIn": ["content/.../relativity.md"],
      "images": ["bib-qa-images/einstein1905.png"],
      "score": 5
    }
  ]
}
```

## Verification status rendered in PDF/HTML

The `bib-qa-verifications.json` status surfaces in the rendered
bibliography (PDF + HTML) via the `annotation` field in
`references.bib`:

  @book{boyd-vandenberghe-2004,
    author     = {...},
    title      = {{Convex Optimization}},
    annotation = {[Verified+Fixed] 18 fixes by <reviewer> 2026-05-19},
  }

`pipeline/export-bibtex.ts` reads
`content/bib-qa-verifications.json` at export time and injects a
short status marker per entry. Format:

  [<status-symbol>] [<N fixes>] [by <verifier>] [<date>]

Status symbols:
  [Verified]        — verified-clean (every site checked, no fix)
  [Verified+Fixed]  — fixed (misattributions resolved)
  [Partial]         — partial (some sites verified + fixed)
  [Pending]         — pending (not yet examined)
  [Uncited]         — bib orphan (no citations)
  [Paper-Mismatch]  — local PDF ≠ bib metadata
  [Unfetchable]     — not in uploads/

Rendering targets:
- **LaTeX/biblatex**: the `annotation` field renders via
  `\printfield[brackets]{annotation}` in custom styles, or
  `\bibliographystyle{plainnat-annote}` for natbib.
- **Pandoc HTML**: CSL templates that include the `annote` field
  display it inline; some styles render it as a separate
  paragraph.
- **bib-qa.html dashboard**: already surfaces the full
  `verification` object from `bib-qa.json` (typed sidecar).

When adding new entries or updating verification status, regen
both:

  cd content
  bun run export-bibtex   # → references.bib with annotations
  bun run pipeline/bib-qa.ts   # → bib-qa.json for dashboard

## Always cross-check arxiv for mirror preprints

When verifying a published-journal paper, check arxiv.org for a free
preprint mirror and use it as the `uploads/` intake target: it is stable and
unpaywalled, its content usually matches the published version (section
numbering may differ), and `gen-bib-papers-list.py` converts
`arxiv.org/abs/<id>` → `arxiv.org/pdf/<id>`.

Workflow when adding/auditing an entry whose primary URL is a
publisher landing page (doi.org, journal site, etc.):

1. Search the paper title on https://arxiv.org for an `arXiv:<id>`
   preprint by the same authors.
2. If found, add `URL: https://arxiv.org/abs/<id>` to the
   `references.ts` entry (alongside, not instead of, the DOI).
3. The batch intake picks up the arxiv URL on the next regen.

## Paper-mismatch class: PDF resolves to wrong content

The `gen-bib-papers-list.py` URL converter can yield a valid PDF with the
WRONG content. Two common cases:

- **numdam volume prelims**: `numdam.org/item/AST_YYYY__VOL__R1_0/`
  resolves to the volume's PRELIMINARY PAGES (front matter), NOT a
  specific chapter. The per-chapter URL pattern is
  `/item/AST_YYYY__VOL__<startpage>_0/` — different starting page per
  chapter.

- **archive.org filename guess**: `archive.org/download/<id>/<id>.pdf`
  works only when the PDF filename inside the item matches the item
  id. For re-digitised scans where the upload was named differently
  (`<id>_bw.pdf`, `<id>_text.pdf`, an arbitrary stem), the guess
  fails with 401/503/404. The reliable fix is to consult
  `archive.org/metadata/<id>` JSON to discover the actual PDF filename.

Detection workflow:

1. `pdftotext -layout -f 1 -l 1 uploads/<id>.pdf` and inspect the
   title page.
2. Compare the title page to the `references.ts` entry's `title` field.
3. If they disagree, mark the entry as `paper-mismatch` in
   `content/bib-qa-verifications.json` with a note explaining the
   downloaded content vs the expected content.
4. The `references.ts` URL itself usually needs the fix (not the
   entry's bib metadata); update the URL and re-run
   `upload-bib-papers.sh` to fetch the correct file.

## Cross-citation-content verification workflow

When verifying a paper against its citation sites, the canonical
procedure:

1. **Extract the PDF** from the upload branch:
   `git show origin/claude/upload-bib-papers-<date>:uploads/<file> > /tmp/<id>.pdf`.
2. **Read the title page** (`pdftotext -layout -f 1 -l 1`) — confirm
   the local PDF matches the `references.ts` entry's `title`.
3. **Read the section list** (`pdftotext -layout` + grep for
   `^[0-9]+\.\s+[A-Z]` or `^Section`) — identify the chapters /
   subsections cited.
4. **For each citation site** (`-- Ref: [<id>]` line in a
   formal-proof file or `\cite{<id>}` in `.md`): read the surrounding
   code/prose to find the specific claim being attributed, then verify
   the paper covers that claim. Common types:
     - **Title/scope match**: paper title or §N heading verbatim
       matches the citation text → verified-clean.
     - **§N misattribution**: paper has §N but it covers a different
       topic than the citation says → fix the § number in the citation.
     - **Wrong work**: paper covers a different topic entirely → flag
       as partial / paper-mismatch; defer to author judgement.
5. **Update both**: `content/bib-qa-verifications.json` status +
   `docs/coordination/<date>-bib-verification-ledger.md` log row.
6. **Commit** per-paper (granular history); the `bib-qa` skill picks
   up the new status on next `bib-qa.ts` run.

Skill outputs:
- `bib-qa.json` (gitignored, regenerated via
  `cd content && bun run pipeline/bib-qa.ts`) carries the
  `verification` field on each entry, including `status`,
  `verified_at`, `verified_by`, `fixes_applied`, `fix_commit`, `note`.
- The `verification_status` QA tag (see
  [`bib-qa/qa-tags.md`](bib-qa/qa-tags.md)).

