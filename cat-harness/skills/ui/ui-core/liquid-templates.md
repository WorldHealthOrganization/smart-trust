---
name: liquid-templates
description: >
  Authoring a Liquid template in this repository — a README template the
  `subgraph-readmes` Tool renders with liquidjs, or a Jekyll include on the
  just-the-docs site. Where templates live (inside a declared directory,
  reached through its id), what a template may read (only what the Knowledge Graph hands it), the
  leading comment the generator reads as the file's description, includes,
  whitespace control, escaping, and regenerate-then-commit with the `--check`
  gate. Read it before adding or changing any `.liquid` file or anything under
  `docs/_includes/`.
---

# Liquid templates — layout only, every fact from the graph

Two engines run Liquid here, and they produce different kinds of output. Know
which one you are writing for before you write a line:

| | README templates | site templates |
|---|---|---|
| engine | liquidjs, run by bootstrap-tools' `subgraph-readmes` (`jekyllInclude: true`, `strictFilters: true`) | Jekyll, run by `docs-site.yml` with the pinned just-the-docs `remote_theme` |
| lives in | `templates/readme/` beside the writer, in the tools repository (`bootstrap-tools/scripts/templates/readme/`) | `cat-harness/docs/_includes/` — just-the-docs' extension points (`head_custom.html`, `footer_custom.html`, `nav_footer_custom.html`) plus our own |
| output | `<directory>/README.md`, **committed**, read on GitHub where no Liquid runs | `_site/`, **never committed**, published to Pages |
| data | only what the generator passes: `subgraph`, `instance`, `kg`, `files`, `subdirs`, `summary` | `site`, `page`, `include`, and `_data/*.json` written by the pipeline |
| verified by | `bun run cat readme:subgraphs:check` — the diff is the output | building the site: [`rendered-verification`](rendered-verification.md), `bun run cat preview:site` |

## Where a template lives

**Beside the writer that renders it, in the tools repository.** The README
templates are part of bootstrap-tools' `scripts/` subgraph, at
`bootstrap-tools/scripts/templates/readme/`, and the writer finds them with
`TEMPLATES`, a path relative to its own file. A template is part of the
toolset: somebody who wants different READMEs uses a different toolset over
the same content, and a harness that wants its own layout passes its own
templates directory to `plan()`. They are files OF the `scripts/` subgraph, not a directory of their
own: a declared directory nested inside another is refused by
`check:layout-norms`. Never an inline template string in a `.ts` file and
never a `.liquid` file outside a declared directory: a template nobody
declared is one no checker looks at, and its README row cannot say what it is.

## What a template may read — and what it must not compose

**A template arranges facts; it never states one.** Every word that is not
layout comes from a variable the generator read from the Knowledge Graph: the
directory's declared `title` and `description`, each file's own account of
itself, a relation a diagram records. No count, URL, name or claim typed into
a template — each is a second answer free to drift from the first, which is
[`readme-sections`](readme-sections.md) §"Resolve links; never compose them"
one level down.

- **Computation belongs in the generator**, where it is tested: counting,
  grouping, choosing a link target, collapsing a long list. The template sees
  results (`subdirs[].count`, `summary`), not inputs to derive them from.
- **A missing value is shown as missing**, never papered over:
  `{{ subgraph.title | default: subgraph.id }}` and
  "_No description is declared for …_" are the pattern. The generator records
  the gap as a QA finding in `test/results/subgraph-readmes.qa-results.json`
  (a derived result, stored on the `qa-reports` branch by `qa-publish`);
  the template must not make it look filled.
- **A new variable is a generator change first.** Add it to the object passed
  to `renderFile`, list it in the template's comment, then use it.

## Versions are variables, never numbers

A version typed into a template is stale on the next bump. Read it:

- **README templates** get `release`: `version` (every layer declares one),
  and — for a layer declaring an `iriBase` — `major`, `agent` (for
  identifiers) and `human` (for pages), both `<iriBase>v<major>/`. Empty strings where not declared: test with
  `!= ""`, and show nothing rather than a guess.
- **Site templates** read `site.data.harness.releases.<instance>` — the same
  four fields for every layer, written by `sync-docs-harness` into
  `_data/harness.json` under the `docs:harness:check` gate.

Link a person to `human` and name an identifier with `agent`. They are one
address today — every address carries the major only, and the pin, not the
address, fixes the exact release ([`instance-publication`](../../kg/kg-core/instance-publication.md)
§"Release IRIs") — but the field still says which audience a link is for.

## The leading comment IS the file's description

Open every template with a `{%- comment -%}` block. Its **first sentence** is
what the directory README's "what it is" column shows for the file
(`describe()` in `bootstrap-tools/scripts/readme-graph-sections.ts`), so write it for
a reader of that table — "The file table: files directly in the directory,
then its subdirectories." — and put the variables it reads in the lines after.
No comment and the row says only "a template".

## Includes

`jekyllInclude: true` gives Jekyll's syntax: `{% include files.liquid %}`, the
file name unquoted and with its extension. An include with no parameters sees
the including template's variables (`files.liquid` reads `files` directly); a
parameter passed as `{% include x.liquid key=value %}` is read as
`include.key`, as in Jekyll. Split a template when a part is reusable or when
a reader would want its own row for it — not to hide logic.

## Whitespace — check the output, not the template

`{%-` and `-%}` strip the whitespace on that side of the tag, and that is how a
template emits clean Markdown. It is also how a separator the output needs
disappears — a stripped space between two HTML attributes makes the page print
its own markup as text, past every gate
(`continual-progress`
§"A template is not a page"). Strip freely inside a tag's own lines; think before stripping
next to a table row's newline, the blank line before a heading or table, or
an attribute boundary. `subgraph-readmes` also collapses three or more
newlines to two, so do not fight blank lines with stripping.

## Escaping

- **`strictFilters: true`** — an unknown filter is an error, not a silent
  pass-through. No custom filter is registered.
- **A value bound for a table cell is escaped before it reaches the
  template** — the generator's `cell()` turns `|` into `\|` and folds
  newlines. A new cell-bound field goes through it; a raw `|` from a file's
  description splits the row.
- **Liquid syntax in prose that Jekyll will build** must sit inside a `raw`
  block. `gen-skill-docs` wraps every skill page in one, so a skill may quote
  `{{ }}` and `{% %}` freely — but never the closing `endraw` tag itself,
  which ends the block early. A generated README
  that sits under a site source (`cat-harness/docs/`, root `docs/`) may be
  read by the site build too; if a KG value there can carry Liquid, build the
  site and look before assuming either way.

## An undefined variable is a message, not silence

Jekyll renders an undefined variable as the empty string and says nothing;
`strict_variables` says something by FAILING the build and by changing what
renders (the exception aborts the whole tag, `else` branch included).
`docs/_plugins/liquid-undefined-warn.rb` does neither: every lookup runs as
Liquid runs it, and at the end of the build each path that was ABSENT is
printed as a warning with its count and pages, `site.data.*` first.
A lookup inside a condition or under `| default` is not reported — there the
template asked — nor an include's own parameter (`include.x`, optional by
convention), a field of a variable that is there and nil (its cause is reported
once, where it went undefined), or a path `liquid_undefined_ignore` in
`_config.yml` lists: a THEME's optional settings, which `site-chrome/_config.yml`
names for just-the-docs. Without those exclusions the report is mostly noise
over a few real gaps. `FOLIO_LIQUID_UNDEFINED_REPORT=<file>` writes the same record
as JSON; `liquid_undefined: off` in `_config.yml` turns it off. It runs only
where plugins do (`bundle exec jekyll`, as an IG repository's own site and
`preview:site` build); the github-pages build is safe mode and loads none.

## Markers — the platform owns the region, the folio owns the file

`subgraph-readmes` writes only between `<!-- kg:subgraph:begin -->` and
`<!-- kg:subgraph:end -->`, creates a README holding just that region when
there is none, and leaves an unmarked README alone and reported. The rules are
in [`readme-sections`](readme-sections.md); do not restate them in a template.

## Regenerate, commit, and the gate

```sh
bun run cat readme:subgraphs          # render every declared directory's README + the QA sidecar
bun run cat readme:subgraphs:check    # fail on a stale README or sidecar — CI and the pre-commit hook
```

Changing a template changes every README it renders; commit them with the
template, in one commit. So does adding or removing a file in any declared
directory — that directory's table changed. `readme:subgraphs:check` runs in
`code-quality-gates.yml` and in `cat-harness-tools/scripts/git-hooks/pre-commit`; it
is part of `bun run cat gates`.

## On the site specifically

- Pages need front matter to be pages — `title`, and `parent` / `nav_order`
  for just-the-docs' sidebar, which it builds from front matter at build time.
- `baseurl` is `/folio-assistant`; a link or asset path goes through
  `relative_url`, never a literal `/…`.
- Override just-the-docs through its extension-point includes, not by copying
  a theme layout — a copied layout silently stops tracking the pinned version
  (`upstream-version-adoption`).
- A generated reference directory (`reference/skill-instructions/`,
  `reference/skills/`, `auto-docs/`) is never hand-edited; change its generator.
