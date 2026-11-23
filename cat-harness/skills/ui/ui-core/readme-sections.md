---
name: readme-sections
description: >
  A folio's README is the author's file; the platform owns only the marked
  regions it generates. How the sync/audit split works, why the platform never
  generates a folio's prose, and the third state both tools must report.
adapters: [document, paper, dak]
profiles: [document, paper]
consulted: true
---

# A folio's README — the folio owns the file, the platform owns the markers

Two tools divide the file between them, and **between them no link in a folio
README is unaccounted for**: **sync** owns the marked regions, **audit** checks
everything else. Neither ever rewrites the author's prose.

| | what it does | writes? |
|---|---|---|
| `readme_sync` · `readme:sync` | refresh each generated section | only between markers |
| `readme_audit` · `readme:audit` | verify every Markdown link resolves | never |

`readme:sync:check` is the CI form; `readme:sections` lists what a README can
opt into. Registered among the **generic** tools — a document folio has
chapters, simulators and workflows for the same reason a paper folio does, and
simply never carries the Lean markers.

## Opt-in is per section, and absence means "not opted in"

A section is written **only where the README already carries its
`<!-- marker:begin -->` / `<!-- marker:end -->` pair**. Nothing outside a marked
region is ever touched, and a README with no markers is a README this tool
leaves entirely alone. Adding a section is one registry entry: a marker, a
one-line summary, and a renderer returning Markdown plus operator notes — the
CLI, the MCP tool and the staleness check all read the registry.

## "Could not determine" is a third state, everywhere

A section that cannot establish its answer returns **skip**, and the region is
left exactly as it was:

- A directory configured under a submodule that is not checked out is
  *absent*, not *empty* — it must not render as "this folio has no
  simulators".
- A shallow clone cannot read the publish ref. "Could not read it" must not
  blank a table.

**An empty directory is still a determined empty.** Absent and empty are
different answers, and only one of them is safe to render.

## Resolve links; never compose them

Every link cell is looked up in a real listing of the publish ref, never built
by a path convention, and a chapter with no published PDF renders `—`.

The audit reports three states, never two:
an external host, an in-page anchor, and a ref this checkout cannot read are all
**NOT CHECKED**, so a shallow clone does not produce a wall of false findings.

## On link style — `raw` is not the private-repo answer

A private folio whose README links to a Pages URL is unreachable for exactly the
people who have repository access, and a raw-content host does not fix it: it
404s on a private repo without a token, and a browser session cookie does not
authenticate it.

**The default is `blob`** — the forge's own file view — which follows the
viewer's session, works whether the repo is public or private, and renders PDFs
inline. The other styles remain configurable, and each prints a note under the
table saying who can follow its links.

## Why the platform does not generate the rest

**Prose about a folio belongs to that folio.** A platform generator that
writes a whole README carries one folio's title, badges and structure into
every other folio, and the author there loses their README. Do not hardcode in a section renderer: a namespace prefix
(read it from the build file, and leave it **unprefixed** when none names one —
a wrong namespace is what a reader pastes into an import); a map of one folio's
filenames consulted before the artefact's own declared name; or a fixed
directory.

**The authored half is audited, not generated.** Its labels are prose a
generator would have to invent; what goes wrong there is targets that do not
resolve, which the audit catches.

## `cat-harness:instances` — the root README indexes every layer

One row per layer declaring a declaration, with **two entries because two
readers arrive**: an agent entry (`AGENTS.md`, memories) and a human one
(README, docs). Both halves are resolved from that layer's own declaration —
declared assets for the file links, declared `graphs` for the directory links.

**Never composed from a convention.** `join(root, "AGENTS.md")` would link a
file that may not be declared, and the criterion in `check:subgraph-coverage`
rests on an undeclared file being one no checker has a reason to look at.
Scope is honoured too: a directory declared `scope: "repository"` is linked at
the repository root. **A dead link in a generated table is worse than a
missing row — the row asserts the entry exists.**

**A gap is rendered AS a gap**: an em dash plus a counted note under the table,
naming the check that lists them. Never a blank cell, never a guessed path: a
table that quietly omitted the gaps would read as though the work were done.

### Which README, and the `--dir` flag

`readme:sync` with no `--dir` resolves to whichever layer carries a `folio/`
— **which is `cat-harness`, not the repository root.** Use the pair:

| | |
|---|---|
| `readme:sync` · `readme:audit` | the cat-harness layer's README |
| `readme:sync:root` · `readme:audit:root` | the REPOSITORY's README |
| `readme:sync:all` | EVERY layer's README, each against its own declaration |

**In an index checkout the root README is not authored at all.** Its root
declares no layer, so nothing could own the file; it and the root
`AGENTS.md` are rendered: `bun run cat index:render` writes both — with the `CLAUDE.md` and `GEMINI.md`
stubs — from `index.config.json`, each layer's declared `agent-instructions`
and `instance-readme` assets, bootstrap's `AGENTS.md`, and the sections above,
and `index:render:check` fails when any of the four is not its current output.
`readme:sync:root` still agrees with it, because the renderer fills the same
marker regions through the same registry.

Both are gated in `code-quality-gates.yml`: the bare `readme:audit` covers only
cat-harness's README, and a gate that stops covering something still reports
green.

## `readme:toc` — every harness README's own table of contents

A nested list of the README's **own** h2/h3 headings, linked by the
anchor GitHub assigns them. Every layer README carries it under a bold
**Contents** line, above its first `##`; the root README too.

**Not `folio:toc`.** The shared word hides two different sections: `folio:toc`
is a folio's *contents* — papers, chapters, verified PDFs — and says nothing
about the file it sits in. `readme:toc` is the file's outline and needs no
folio at all. Both may sit in one README.

**Anchors are GitHub's, not a tidy approximation of them** (`githubSlug`,
github-slugger's rule): lowercase, drop everything but letters, marks, digits,
`_`, `-` and space, then each space becomes `-` — **not collapsed**, so
`Corpus → draft` is `#corpus--draft`. Inline markup is stripped first, as the
renderer does (`` `code` `` → `code`, `[x](y)` → `x`). Duplicates become `-1`,
`-2` counted over **every** heading level, h1 and h4+ included, because GitHub
counts them all; a suffixed anchor colliding with a literal heading is bumped
past it. A TOC link that is almost right is a dead link that reads as live.

**What is not a heading is not in it:** lines inside a code fence (closed only
by a fence of the same character at least as long), inside an HTML comment,
indented four or more spaces, and inside the TOC's own region — so the
section is never an input to itself and a second run is a no-op.

**It is registered LAST, on purpose.** It reads the README as the sections
before it have left it, so a heading another section generates (`folio:toc`'s
`### <paper>`) is outlined on the same run. Registered earlier, every sync
would leave the TOC one run behind and `--check` would fail on a README that
had just been synced.

**Zero h2/h3 is a determined empty** (*"This README has no sections yet."*),
and a README with nothing to outline is better without the marker. A renderer called with no README text
is **undetermined** and leaves the region alone.

**Gated by `readme:sync:all:check`**, over every declared layer; the
single-README checks above name one file each, and a generated region nothing
checks is a hand-kept list, wrong the first time somebody adds a heading.

## `kg:processes` and `kg:files` — a layer's diagrams and files, from its declaration

Two sections any layer's README may carry, both read from the layer's
own declaration and the files it names (`bootstrap-tools/scripts/readme-graph-sections.ts`).

- **`kg:processes`** — every `.bpmn` in the declared directories, the entry
  Process first (the one no other calls), each with its picture. The picture
  is the SVG `render:bpmn` writes **beside** the `.bpmn` for a layer
  exempt from `workflow-visualiser` — one with no site of its own, so its
  README is where its diagrams are seen. This section **reads** the SVG and
  never draws; rendering needs a browser, so `render:bpmn` must run first.
  Each repository generates and checks its own README.
  A diagram with no picture beside it leaves the region untouched — never a
  broken image.
- **`kg:files`** — every file, grouped by declared directory, with "what it
  is" read from the file itself (front-matter `description`, a Process's
  name, a schema's `title`, a JSON file's own `description` or `$comment`)
  and "used by" **only** where a diagram records the relation: a task naming
  a Skill, a call activity naming a Process. Blank otherwise, never guessed.
  A directory whose files all sit in subdirectories collapses to one row.

**Why `kg:` and not `cat-harness:`.** The marker is written into the
layer's README, and the floor layer must not name the layer above it
— its leak test fails on the word. `kg` is vocabulary every layer has.

**A blank "used by" is a finding, not decoration** — for example a file a
diagram names that has no front matter, and so is not a Skill. A hand-kept
table would hide that.

## `subgraph-readmes` — one README per declared directory

A large layer cannot list every file on one page, but it declares its
directories, and each declared directory gets its own README
(`bun run cat readme:subgraphs`, the `subgraph-readmes` Tool). The layer
README's `kg:files` then links each directory to it, and above 200 files lists
directories instead of files. The README is part of the graph: the exported
Directory node carries `readmePath`.

**Everything shown is read from the Knowledge Graph**, never composed: the
heading is the directory's declared `title`, the paragraph its `description`,
the kinds its `graphTypologies`, each file row what the file says it is, and "used
by" only a relation a diagram records.

**The layout is Liquid**, in `bootstrap-tools/scripts/templates/readme/`,
beside the writer in the tools repository. cat-harness's
`readme:subgraphs` resolves its own Extensions — a directory's `scope`, an
`absent` directory, the declared README — and calls that writer. Templates may `{% include %}` one another, Jekyll
style, and read any declared field through `kg`. Change a template, run the
command, commit the result. How to write one is
[`liquid-templates`](liquid-templates.md).

**It writes only between `<!-- kg:subgraph:begin -->` and `:end`.** A README
with no markers is left alone and reported: somebody wrote it. A generator
that owns a whole README (bootstrap's schema page) keeps that region intact.

**A missing fact is a QA finding, not a blank.**
`test/results/subgraph-readmes.qa-results.json` records every directory with
no `title`, no `description` or a description over 60 words, every declared
directory absent from disk, and every unmarked README. Findings are reported,
not failed: filling a declaration is its owner's work. `--check` fails on a
stale README — the READMEs are docs, committed — and **judges** the record
rather than comparing it: it fails on a declared directory newly absent or a
process newly unresolved against a baseline, and a missing baseline is
UNKNOWN and not gated. The record itself is a derived QA result whose home is
the `qa-reports` branch, so it is not something to regenerate and commit. A
`qa` or `health` directory absent from the checkout is not an
absent-directory finding: those kinds may live off `main` (`mayLeaveMain`). It runs in CI and in the pre-commit hook
(`scripts/git-hooks/pre-commit`).

### Where the README render sits in the pipeline

Stage 1, **after** the current-state json/jsonld and **before** every other
harness render, and **fatal** on failure — it is the file a reader opens first.
The order and the reasoning are in
[`render-order`](render-order.md); do not restate them here.

## Defined terms are links, everywhere in a README

A capitalized term bootstrap defines links to its row in
`bootstrap/schemas/README.md` wherever it appears in prose — not only at first
use — so a reader who lands mid-page is one click from the definition.

- **Generated READMEs** link them as they are written: `subgraph-readmes` runs
  `linkTerms` (`bootstrap-tools/scripts/term-links.ts`) over each declared
  description and each file's description, with links made relative to the
  README by `bootstrapTermTargets`.
- **Hand-written READMEs** are not rewritten by a generator — the folio owns
  the file. Link the terms as you write, and a guard catches a miss:
  `graph.test.ts` fails on any unlinked term in `bootstrap/README.md`'s prose
  (`unlinkedTerms`).
- **Left alone:** code, headings, table header rows, existing links, and
  **bold** names — a Role's name in a table (`**Knowledge Graph Data Store**`)
  is a name of its own, and a link inside it would split it.

## Maintaining these files is memory work, not documentation work

`README.md` and `AGENTS.md` are **declared assets with a declared purpose**
(`ASSET_ROLES` in `schemas/kg/cat-harness.ts` — one place, per ROLE, not
per asset). Keeping them true is part of
[`agent-memory`](../../conduct/conduct-core/agent-memory.md).

The one distinction that governs how each is written: **a file is read, memory
is injected.** Nothing truncates a file, so `AGENTS.md` carries what an agent
must be able to look up; `MEMORY.md` carries what must arrive unasked and pays
a 200-line budget for it.
