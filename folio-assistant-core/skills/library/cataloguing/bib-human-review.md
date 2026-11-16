---
name: bib-human-review
description: >-
  Human-validated bibliography workflow. Flag references that have not been
  human-reviewed against their source; drive the acquisition ladder
  (source-in-repo → acquire-legally → physical-library); open one GitHub issue
  per reference needing physical review (full project context + bibliographic
  data + page-photo request, assigned to the repo owner); hand off uploaded
  photos to the bib-photo-ingestion watcher. Use when auditing bib human-review
  status, ingesting an uploaded paper's results, or preparing a physical-review
  issue.
---

# bib-human-review

Status sidecar: `content/schema/references.review.json`.

## What this skill does

Every entry in `content/schema/references.ts` must be **human-reviewed against its
source**. This skill manages that status and drives unreviewed references to
`validated`.

## 1. Audit — find unreviewed references

- Read `references.review.json`. Any `references.ts` id whose effective status is
  not `validated` is **flagged** (absent ⇒ `unreviewed` by default).
- An entry is **stale** when its `entryHash` (12-char SHA-256 *prefix* of the
  canonical-JSON-serialized `references.ts` entry) drifts — treat as `unreviewed`.
- **Automated check**: `cd content && bun run pipeline/validate-references-human-review.ts`
  (`content/` is its own Bun package) computes each `entryHash`, reads the
  sidecar, and flags every non-validated ref.
  Flags: `--strict` (exit 1 — CI gate, warn → strict), `--json` (machine output),
  `--seed` (list refs that would get a physical-review issue). Issue template:
  `.github/ISSUE_TEMPLATE/bib-physical-review.md`.

## 2. Acquisition ladder (per flagged reference)

1. **Source in `uploads/`** → identify the cited page/passage (agent-sourced; no
   human photo) → mark `source-in-repo`; hand to ingestion (§4).
2. **Not in repo** → acquire legally for `uploads/` (open-access / arXiv / author
   copy), with author assistance if needed.
3. **Paywalled / not digital** → open a **physical-review issue** (§3); the author
   photographs the page(s) at a library.

## 3. GitHub issue (one per ref needing physical review)

Create with template `.github/ISSUE_TEMPLATE/bib-physical-review.md`. **Assign the
repo owner.** Include, consistently readable:

- **Bibliographic block:** title, authors, year, journal/volume/pages, DOI, ISBN,
  **library call number**, holding library.
- **Project context:** the citing block(s) (`.md` + label), formal-proof `-- Ref:`
  sites, the `\cite{}`/`uses[]` sites — with blob links.
- **What to verify:** the specific theorem/section/equation relied on.
- **Labels:** `bib-physical-review`, `needs-photo`, + chapter/domain tag.
- **Ask:** author uploads a **photo of the relevant page(s)**.

Set the ref's status to `issue-open` (source = `issue#NNN`).

## 4. Hand-off to ingestion

When a photo is uploaded (or an in-repo passage is identified), the
**bib-photo-ingestion watcher** (companion integration-watcher skill) runs: OCR →
formalise the cited result (if the project has a formal-proof pipeline) → confirm
the project's usage matches the source → machine + agent bib validation → set
status `validated`, record `{ by, date, source, page, entryHash }`, refresh the
sidecar, post back on the issue.

## Guardrails

- Never set `validated` without a human reviewer recorded in `by`.
- The acquisition must be **legal** (open-access / library / author copy).
- One reference per issue; keep GitHub noise low (only genuinely-unvalidated refs
  needing physical access get an issue).
