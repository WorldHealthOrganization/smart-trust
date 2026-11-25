---
name: glossary-build
---

# Glossary Build Skill

## Role

Maintain the project-wide glossary of defined terms. Builds the
`glossary.json` index from every block's `defines: [...]` field, writes the
same terms as a SKOS scheme for the glossary page, and gates CI with
`--check` mode. A content type that typesets its folio adds its own outputs
(a glossary chapter, typeset markup, a formal synonyms module); the layer
that ships that content type documents them in its refinement of this skill.

## The SKOS scheme

The builder also writes `<glossary dir>/paper-<paper>.glossary.json`, a
`folio-glossary/v1` scheme, into the glossary directory declared by the
layer that holds the paper. Core's glossary page reads it through
`collect()` and shows the paper's terms, in the layer's namespace, beside
every other scheme. The rules (status by provenance,
verbatim definitions, the slug as `notation`) are in
[`glossary-terms`](glossary-terms.md).

The paper's scheme is **unordered**: its terms are shown A–Z. A glossary whose
terms must be read in a logical order declares `ordered: true` and gives each
term `requires`; see [`glossary-terms`](glossary-terms.md) §"Ordered
glossaries" — do not sort one of those.

`--check` also fails when the scheme is stale, when two slugs would mint
one term IRI, or when another document in the directory holds the scheme id.
A scheme not written yet is reported and does not fail.

## When to invoke

- A user mentions: glossary, defined terms, `defterm`, `refterm`,
  `defines[]`, "build glossary", "regenerate glossary".
- After any block's `defines: [...]` field is added, modified, or
  removed.
- As part of `content-validation` whenever a chapter is validated
  end-to-end.

## Tools

| Command | Purpose |
|---------|---------|
| `cd content && bun run pipeline/build-glossary.ts <paper-dir>` | Generate `glossary.json`, the SKOS scheme, and any outputs the content type adds |
| `cd content && bun run pipeline/build-glossary.ts <paper-dir> --check` | CI gate — non-zero exit on duplicates or out-of-date JSON |
| `cd content && bun run pipeline/glossary-candidates.ts <paper-dir>` | Phase C: propose candidate owner blocks per slug → `glossary-candidates.json` (gitignored) |
| `cd content && bun run pipeline/apply-glossary-curation.ts <paper-dir>` | Dry-run: show edits implied by `glossary-curation.json` |
| `cd content && bun run pipeline/apply-glossary-curation.ts <paper-dir> --write` | Apply curated `defines: [...]` insertions to chosen `.ts` files (idempotent) |
| `cd content && bun run pipeline/codemod-refterm.ts <chapter-dir>` | Dry-run: preview `:refterm[…]` backfill in a chapter |
| `cd content && bun run pipeline/codemod-refterm.ts <chapter-dir> --write` | Apply backfill to disk |
| `cd content && bun run validate <paper-dir>` | Includes the five glossary-term validation rules |
| `cd content && bun run validate <paper-dir> --strict` | Adds `term-mention-coverage` (bare-text mentions) |

**`pipeline/…` above is the FOLIO's own path.** `build-glossary.ts` and
`codemod-refterm.ts` live in `folio-assistant-core/scripts/`, beside the
`schemas/glossary.ts` they read. A folio that vendors its own
`content/pipeline/` copy uses it. A folio that does not reaches them through
the `glossary_check` and `codemod` MCP tools, whose resolver searches the folio,
then the platform, then `folio-assistant-core/scripts/`.

### Curator web UI (Phase C)

`/folio/glossary-curator.html?paper=<paper-dir>` is a propose-and-pick
interface served by the folio-assistant HTTP server.

- The page calls `GET /api/glossary/candidates` (which runs
  `proposeCandidates()` and returns the same data as
  `glossary-candidates.json`).
- The author clicks one candidate per slug (or "skip for now"), then
  hits **save** to `POST /api/glossary/curation`, persisting the
  decisions to `<paper>/glossary-curation.json` (committed).
- The agent then runs `apply-glossary-curation.ts --write` to insert
  the chosen `defines: ["…"]` fields into each owner block's `.ts`
  file, followed by `codemod-refterm.ts <chapter> --write` to backfill
  `:refterm[…]` mentions.

Roles: `GET` is open; `POST` requires `collaborator` or higher.

## Authoring contract

Every term registered in any block's `defines: [...]` field **must** be
wrapped at every occurrence:

- **Defining occurrence** (exactly one block): `:defterm[Visible]` /
  `:defterm[Visible]{#slug}` in `.md`.
- **Reference occurrences** (every other mention, anywhere in the
  project): `:refterm[Visible]` / `:refterm[Visible]{#slug}` in `.md`.

A content type with a typeset source format states the same two markers in
that format in its refinement. Plain text and emphasis are not permitted for
a defined term once its slug appears in any `defines[]` list.

## Validation rules (Phase B)

| Rule | Severity | Trigger |
|------|----------|---------|
| `defterm-declared` | error | `:defterm[X]` whose `X` is not in this block's `defines[]` |
| `defterm-marked` | warning | `defines[]` entry with no `:defterm[X]` in the `.md` |
| `refterm-resolves` | error | `:refterm[X]` not declared in any block's `defines[]` |
| `defterm-unique` | warning | Same slug declared by multiple blocks |
| `term-mention-coverage` | warning (`--strict`) | Bare-text mention of a known slug not wrapped in `:refterm[…]` |

Enable the strict-mode validator (`--strict`) in CI only **after** the first
`:refterm` backfill batch lands.

## See also

- `content-validation` — full authoring contract and agent-facing rules
- `pipeline/validate-defterm.ts` — validator implementation
- `folio-assistant-core/scripts/build-glossary.ts` — builder implementation
- `folio-assistant-core/scripts/codemod-refterm.ts` — backfill codemod
- `pipeline/glossary-candidates.ts` — Phase C proposer
- `pipeline/apply-glossary-curation.ts` — Phase C applier
- `ui/glossary-curator.html` — curator web UI
- `src/routes/glossary.ts` — curator API routes
