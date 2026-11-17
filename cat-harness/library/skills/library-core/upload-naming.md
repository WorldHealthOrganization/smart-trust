---
name: upload-naming
description: What an ingested file may be CALLED. Read before adding anything to an `uploads` or `library` graph, before writing a generator that links to one, and before "fixing" a broken link in a generated README. Covers which characters break what, why the name is normalised as well as the link escaped, how a sidecar stays paired with its source, and the one case the fixer refuses.
---

# Upload naming — the name is normalised, not the link escaped

**A file in an `uploads` or `library` graph is named by whoever uploaded it, and
that name reaches a generated Markdown link.** So the name is an interface, not
a label. It is a `library-core` skill, beside `uploads-watch` and
`library-ingestion`, because what an ingested file may be called is a question
about acquiring and ingesting sources.

`bun run cat check:upload-names` reports; `check:upload-names:check` gates;
`check:upload-names:fix` renames with `git mv`.

## The rule

A name may not contain any of

```
space , ( ) [ ] { } # ? & % ' " ` < > |
```

Everything else is left **exactly** as uploaded. The fixer replaces a run of
those with a single `-`, trims, and preserves the extension and any sidecar
suffix.

**A name with no unsafe character is returned untouched.** Collapsing and
trimming happen only to names that were going to change anyway; a double dash,
a leading dash or a trailing dash is not this check's business. Case is not a
defect either: `README.md` stays `README.md`, because renaming it breaks every
link to it and every generator that writes one. Rewriting a name that was
already safe breaks whatever looks it up by that name, such as a generator that
lists a section file. Both are pinned by tests.

## What each character breaks

| character | what it breaks |
|---|---|
| space, `(`, `)` | a Markdown link target **ends at the first `)`** |
| `[` `]` | the label half of the link |
| `<` `>` `\|` | the angle-bracket link form, and tables |
| `#` `?` | a fragment and a query to every URL parser |
| `&` `%` quotes backtick | escaping in a shell, an href, or both |
| `,` | nothing — included for the stub convention |

## Why the NAME as well as the link

`uploads/X (2).pdf` produces the link target `X (2).pdf`, which resolves to
`X (2`. Two layers answer this, and neither subsumes the other:

| layer | reaches | fails when |
|---|---|---|
| `linkTarget` (in `subgraph-readmes.ts`) / `decodeLinkTarget` (in `check-subgraphs.ts`) | **every** generated README link, in every graph typology, including directory names | never — it percent-encodes every segment of what the generator writes (parentheses included, because an unbalanced one ends a CommonMark destination as surely as a space), and the check decodes before asking the filesystem |
| this check | `uploads` and `library` **names**, before anything links them | a name reaches something that is not that generator |

The encoder keeps generated READMEs valid. This check keeps a filename usable in
a shell, an `href`, a CI log line, a `curl`, and any later generator. Escaping
is per-generator; a name is per-file, so a name that is safe everywhere is safe
once.

A rename churns downstream references, and that is accepted: they are
**repaired**, not abandoned. After a rename, repoint the hand-maintained path
fields (`files[].path` in `intake.json`; `container` and `assets[].path` in
`*.extraction.json`; `provenance.source` in catalogue records; `file` and
`source_file` in `structure.json` and `manifest.jsonld`; hardcoded paths in
tests and scripts). Leave a hand-authored wireframe alone: what it depicts is a
design decision, not a consequence of the rename. Then regenerate **in dependency order**: `library:graph` →
`library:viz` → `library:readmes` → `readme:subgraphs`, then `skill:register`.
Out of order, a later writer stales an earlier one's output, which reads exactly
like a real failure.

Build the old-name list for a reference sweep from
`git diff --name-status -M` split on tabs (`awk -F'\t'`), not on whitespace:
the filenames being renamed contain spaces. A sweep that finds nothing must be
shown to have had something to look for.

## A sidecar suffix is not an extension

`X.pdf` pairs with `X.pdf.extraction.json`. Two ways to break that:

- rename the source and not the sidecar → the extraction is orphaned
- normalise the sidecar by a different rule than its source → same

So the fixer **strips the sidecar suffix first, normalises the remaining name by
the one rule, and restores the suffix.** The pair moves together by
construction. The stem is normalised and the extension left alone, because a
whole-filename slug destroys the extension (`…(2).pdf` → `…-2-pdf`).

## Findings are not the size of a rename

The check reports only what is *still* unnormalised, so once part of the corpus
has been renamed its count is the tail of the work, not its size. Measure a
rename from `git diff --name-status -M`.

## The one case it refuses

**Two files that normalise to one name.** The fixer reports the collision and
renames neither: picking a winner silently destroys an upload, and an upload is
somebody's source material. Rename one by hand.

That is
[`deletion-requires-confirmation`](../../../skills/conduct/conduct-core/deletion-requires-confirmation.md) applied to
a rename — a `git mv` that overwrites is a deletion with a friendlier name.

## What this does NOT cover

- **Directory names.** The check reads files; a directory with a space in it is
  not graded.
- **Content.** It reads names and never opens a file, which is why it is
  harness-layer rather than folio-layer in the repo partition.
- **Whether a file should be there at all.** That is ingestion's question, not
  naming's.
