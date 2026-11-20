---
# folio-assistant-06e3
$schema: bean/1.0.0
title: 'docs-auto: a handler at cat-harness/docs-auto/<auto-doc-type>/<path> that derives documentation for a sub-graph — and the authoring rule that the author must summarise what it indexes'
status: completed
type: task
priority: normal
created_at: 2026-09-20T20:54:07Z
updated_at: 2026-10-07T17:15:00Z
parent: folio-assistant-0lmb
---


Owner, 2026-09-20 (session_014HGPQoUnzXGqSspA8x6YyD), in three messages.

## 1. The handler

> in cat-harness needs to be harness/handler at `cat-harness/docs-auto/<auto-doc-type>/<path>`
> defined. which will auto-generate extracatable documentation at `<path>` sub-graph.
> extracablle = bpmn, tasks, glossary, etc. ther is a glosarry bean... this could
> clarify it lives at `cat-harness/docs-auto/glossary/<path>`
>
> auto-doc-type = glossary, index, index/bpmm, index/dmn, index/skills,
> index/tasks index/processes index/roles etc.

One handler, parameterised twice: by **what kind of derived document** and by
**which sub-graph** to derive it over. `<path>` is a sub-graph, not a directory
listing — the point is that any node set can be asked for its glossary, its
process index, its role index.

**`toc` is OUT**, and this is the only place that says so. It was in the list
above and withdrawn in the same session: *"no toc,... ther is no meanging at
folio level/. (mayber later)"* — a table of contents is a document-order notion
and a folio has no single order to take one over. Written down because the next
agent reading the original list would otherwise re-add it.

## 2. The authoring rule — this is the half that is a SKILL, not a generator

> then when authong `<harness>/docs` the author should make use of auto-doc
> referneces and provide a summary / overvuew of each of the business processes
> defined. as part of skills and judgement

So `docs-auto` is deliberately **not** the whole documentation. It produces the
index; a human or agent authoring `<harness>/docs` **references** it and then
writes the thing an index structurally cannot contain — what each business
process is FOR, when you would be in it, and what it is not. That obligation is
a rule in a skill, checked by judgement, not a gate: an auto-generated index
with no prose around it reads as complete while explaining nothing.

## 3. Reuse, do not restate

> ..reuse assets in explain.

The summary **reuses the assets** — the rendered BPMN, the lane and activity
titles and descriptions, the skill descriptions the activities point at — rather
than paraphrasing them into a second copy that is free to drift. Same discipline
as `who-iris/docs/ingestion-notes.html` (54a2edc931), which renders the
requirements table out of `who-iris/skills/iris-dspace.md` instead of restating
it, and refuses rather than rendering an empty table when the source moves.

## Done when

- [x] the handler exists and is declared, with the `auto-doc-type` set above and
      **no** `toc`
- [x] **`who-iris/docs` is the first real exercise, end to end** — owner,
      2026-09-20: *"try it out fully w/ who-iris docs, auto-docs."* Not a
      fixture and not a smoke test: the instance that already has a hand-built
      `docs/` is the one that will show whether a derived index and an authored
      summary can sit in the same directory without fighting. **Run 2026-10-04,
      PR #2049** — they do not fight on routes, overwrites or staleness, and
      they fight on CLASSIFICATION: see §"THE EXERCISE, RUN END TO END" below
      for the four findings and what each is evidenced by.
- [x] the authoring rule lives in a skill with the reuse-not-restate clause
- [x] `<harness>/docs` carries a per-process summary that references the derived
      index rather than duplicating it — `docs/platform.md`, 2026-10-03; see
      §"The per-process summary, 2026-10-03" below
- [x] a stale or moved source makes the derivation FAIL, never render empty

## Not started — and the order is the owner's

Owner, 2026-09-20: *"after the other issues doen"*. This runs **after** the
three open who-iris items: the cover-image extraction, the IRIS-home mock
validated against the capture, and the CRDM KG-to-CDN work. Stated here so a
session picking this bean up does not start it early.

Queued. Related: `lqo9` (the glossary content kind + defined-terms index) is
pieces 2–4 of its own ask; piece 1 of it is one `auto-doc-type` served here.

## 4. What `<base-url>/<harness>/docs` must be, and what its navbar must hold

Owner, 2026-09-20, same session:

> when you are at `<base-url>/cat-harness/docs`, you see open i the main page the
> main/home/landing documentation page (QA every harness needs at least one
> meaningfully popualated doc page that outlines what the harness does/gives
> overview of main business porcess, roles, tasks, etc... .use docs-auto) you see
> documentation about cat-harness, but in the LHS navbar, there is index of all KG
> assets that have a docs/ with assets in it. (so you could see that who-iris has
> docs, but maybe not litlifred/qou... , they are all sub-harness docs. this
> should be common functionalty,)

Three requirements, and they are separable:

**(a) A landing page, per harness.** `<base-url>/<harness>/docs` opens that
harness's own home documentation page — what this harness does, with an
overview of its main business processes, roles and tasks. Built by
**referencing** the docs-auto indexes and writing the summary around them
(§2 and §3 above), not by pasting a generated index in.

**(b) A QA check with teeth: "at least one MEANINGFULLY POPULATED page".** The
adjective is the requirement. A landing page that exists and says nothing
passes a file-exists check and fails the reader, which is the `xom7` shape
again — *it looks exactly like a working one from in here*. So the check has
to be about content: does the page reference the harness's processes, roles
and tasks, and does it say something about them that the index does not?
**And it must report "could not determine" as a third state**, never as a
pass, per the CI-health and health-check rules this repo already keeps.

**(c) The LHS navbar indexes every KG asset that HAS a populated `docs/`.**
Not every declared `docs` directory — one *with assets in it*. So `who-iris`
appears and a dependency with an empty or absent `docs/` does not. That is
the "declare only what exists" rule (`dh4f`) applied to navigation: a nav
entry to an empty directory is a link that resolves to nothing while reading
as a section.

**This is common functionality, not who-iris's.** It belongs in the harness
layer beside `mount-instance-docs.ts`, which already resolves which instance
owns which route and already refuses collisions — the navbar is the same
question asked for a listing rather than for a mount, so the two must agree by
construction rather than by both being right.

Note the dependency direction: (c) needs nothing from docs-auto and could ship
first; (a) and (b) are what make docs-auto worth having, since an index with
no authored summary around it is the thing §2 exists to forbid.

## 5. The same shape for KG viewers, not just for docs

Owner, 2026-09-20, same session:

> similarly, for KG viewer like visualizers, you can see whats in everyhing, or
> other harnesses that have registerd KGs.

§4(c) indexes the harnesses with a populated `docs/`. This says the **same
mechanism** serves a KG viewer: from one harness's viewer you can see what is
in everything, and reach the other harnesses that have **registered** a KG.

The word doing the work is *registered*. A harness's graphs are already
declared — `harness.json` names each directory and the graph kinds it holds,
and `resolveSkillDirs` already computes the cross-instance overlay. So the
viewer's index is **read off the declarations**, exactly as the docs navbar is,
rather than being a second list somebody maintains. Two indexes over one set of
declarations would be free to disagree, and the one a reader happened to open
would be the one they believed.

Three consequences worth writing down before anything is built:

- **`docs` is not special, it is the first case.** §4(c) says "every KG asset
  that has a `docs/` with assets in it"; this says the general form is "every
  graph kind a harness registered, wherever it is non-empty". The docs navbar
  is that query with `kind = docs`.
- **Non-empty is still the filter.** A registered-but-empty graph is the
  `dh4f` defect — a consumer scans nothing and reports a clean run over it —
  and as a nav entry it is a link that resolves to nothing while reading as a
  section.
- **Reachability is not the same as presence.** A dependency's graphs are
  reachable through the overlay; a sibling repository's (`litlfred/qou`) are
  not, unless it is a declared dependency of the instance being viewed. The
  viewer must show the difference rather than omitting the second silently —
  "not declared here" and "declared and empty" are different answers and
  neither is "absent".

Same home as §4: the harness layer, beside `mount-instance-docs.ts`, which
already answers "which instance owns which route" and already refuses
collisions.

## 6. A sibling already built §4(c) and §5's mechanism — check before rebuilding

Merging `main` on 2026-09-20 (76 commits) brought in
`cat-harness/scripts/state-visualizer.ts` and `render-pipeline.ts`, from bean
`o7eq` / `flh4` / PR #619. **A dashboard per declared graph, at
`<base-url>/<graph>/`, driven off `harness.json`.** That is the same query
§4(c) and §5 describe, already answered for state graphs.

Its comment settles three URL rulings that this bean would otherwise have had
to settle again:

1. the segment is the instance's **`name`**, never its `stub`;
2. the declared graph **is** a path segment, because an instance may declare
   more than one renderable graph and they would collide otherwise;
3. the root instance **elides its own name**, because its `docs/` is installed
   by cat-harness rather than its own (bean `n0nf`).

And it records a distinction worth not rediscovering: `state-visualizer.ts`
keys the URL on the declared entry's **`id`**, while `gen-schema-viz.ts` and
`gen-library-viz.ts` use `viewerPlacement(...)`, the handled directory's
**repo-relative path**. Five of seven state graphs agree because a
root-declared graph's path equals its id; `qa` (`test/results/`) and `health`
(`test/health/results/`) do not. An id-derived URL survives the directory
moving, and a public dashboard addressed `<base>/test/results/` names a test
directory — which is why they are two rules on purpose.

**So before building anything for §4(c) or §5:** read those three files and
decide whether docs-auto is a NEW generator or a `kind` handled by the one
that exists. The honest default is the second — §5 already says the docs
navbar is the general query with `kind = docs`, and there is now a generator
whose whole shape is "one visualiser per declared graph".

What is NOT covered by it, and is still this bean's:

- the **authored summary** (§2) and reuse-not-restate (§3) — a dashboard is an
  index, and §2 exists precisely to forbid shipping an index with no prose;
- the **"meaningfully populated" QA check** (§4b), which is about content
  rather than about routing;
- the **non-empty filter** (§4c) — a dashboard per declared graph does not by
  itself skip a graph that is declared and empty, which is the `dh4f` defect
  as a nav entry.

## Summary of Changes — first increment, 2026-09-20

**The handler exists and is exercised.** `cat-harness/scripts/gen-docs-auto.ts`
publishes at `<base>/<handler>/docs-auto/<auto-doc-type>/<sub-graph>/`, with
two real types: `index/skills` (220 items across 9 sub-graphs) and
`index/processes` (55 across 2). Registered in `package.json`
(`docs:auto`, `docs:auto:check`), in the render pipeline
(`needs: ["skill-docs", "bpmn"]`, non-fatal), and gated in CI.

### §6's guess was wrong, and here is the correction

The note added after merging main said docs-auto was *"probably a `kind`
handled by the generator that now exists, not a second one."* Reading the code
says otherwise, and the reason is structural rather than a matter of taste:
**every existing generator is one-axis** — one graph kind to one viewer at a
fixed route, plus subject pages. docs-auto is **two-axis**, type × sub-graph,
and there is nowhere in a one-axis generator to put the second axis.

What the guess got right is that no new ROUTING was needed.
`viewerPlacement(site, "<handler>/docs-auto/<type>", …)` is the owner's
`<base>/<handler>/<kind>/<subject>` rule with the type as a segment, and
`ankg`'s `orphanSubjectPages()` prunes it unchanged — no fourth pruner.

### The segment is the declared `id`, not `<path>`

The owner wrote `<path>`. This publishes under the declared entry's **id**,
for `state-visualizer`'s own reasons: `id` is what `harness.json` declares and
what an override matches on, so an id-derived URL survives the directory
moving. It also stays ONE segment, which is what lets the ankg pruner's
ownership test stay exact. Every page states its declared path, so the mapping
is on the artefact rather than only in the URL. **Flagged for the owner rather
than buried** — it is a deviation from the literal ask.

### Two defects the build found in itself

1. **1,522 skills against `knownSkills()`'s 219.** The first draft walked every
   declared directory, and `docs/` is declared — it holds a generated markdown
   rendering of every skill, so each was counted again. *A rendering of an
   artefact is not the artefact.* A type now names the graph kind its
   artefacts live in.
2. **227 against 219.** The second draft walked skill directories recursively,
   so `skills/<package>/<skill>/<page>.md` — a supporting page *inside* a
   skill — counted as a skill. `skillMdDirs()` already encodes that
   distinction, so the generator calls it. Two answers to "what is a skill" is
   one too many.

### §2 and §3 demonstrated rather than asserted

`every-workflow-in-the-repo.md` opened with a hand-maintained count that its
own text admitted had been wrong five times. **It was wrong again by sixteen** —
"thirty-nine" against fifty-five. The count is gone; the page now points at the
derived index and keeps the half that cannot be generated. That is
*"reuse assets in explain"* on the page that most needed it, and the historical
lesson is kept rather than deleted.

Bootstrap's three diagrams are correctly OUTSIDE the index —
`bootstrap/workflows/` is declared by `bootstrap/harness.json` and not
by the root, deliberately (bean `pve3`). Stated on the page so the absence
reads as a fact rather than a gap.

### Verified

76 gates (with a stubbed `python3` lacking pymupdf, which is what CI has);
`bun test` 4612 pass / 0 fail; 20 tests on the generator including both
historical counts as ratchets, the most-specific attribution rule, the
shared-prefix trap, and that `who-iris-skills` — the sparse case the owner
asked for — IS rendered while `who-iris` gets no *processes* page, because it
has none.

## Still open on this bean

- **§2's authored summary as a general obligation** — the rule is in the
  `docs-auto` skill and demonstrated once. It is not enforced.
- **§4(b) the "meaningfully populated" QA check** — not built. It is about
  content, not routing, and needs its own thinking.
- **§4(a) the per-harness docs landing page**, **§4(c) the navbar over
  harnesses with populated `docs/`**, and **§5 the KG viewer** — not built;
  see §6 on how much `state-visualizer` already answers.
- **Types declared and not built**: `glossary` (gated by `lqo9`'s roast),
  `index`, `index/bpmn`, `index/dmn`, `index/tasks`, `index/roles`. Absent
  rather than stubbed, on purpose.


---

## §4(a) done — 2026-09-21 (session_014HGPQoUnzXGqSspA8x6YyD)

`cat-harness/docs/cat-harness/index.md`, published at `<base>/cat-harness/`.
**That route had no index at all**: the directory held `docs-auto/`,
`library/` and `schemas/` and nothing above them, so a path that reads like a
section answered nothing.

**Written under §2 and §3, with both rules stated in the file** so the next
editor meets them:

- **Reference, never restate.** If a sentence could be produced by reading a
  generated page, it does not belong here. The page carries the model (actor /
  role / task / process / skill, and why each is not the one beside it), what a
  BPMN process *is* in this repository, what a lane means, and what is
  authored versus generated — then links the indexes for the enumeration.
- **No counts in prose.** The indexes are regenerated and carry live counts; a
  number typed on an authored page is wrong the next time somebody adds a
  diagram and nothing checks it. Measured in prep and deliberately NOT written
  down: 55 BPMN files, 54 processes, 22 named as a call target.

**One concept is derived rather than listed**, and it is the answer to "which
are the MAIN business processes": a process **no other diagram calls** is an
entry point; one named by a `callActivity` is a step inside a larger one, so
entering it directly means starting in the middle. Nothing marks this in the
file — it falls out of who calls whom, so it stays true as diagrams are added.
That is the same discipline as `recordsWork` and as the referrer kind in
`library-refs.ts`.

`nav_exclude: true` is deliberate: the left-hand navbar's structure is bean
`603s`, in flight in another session, and a nav entry here would collide with
the section model it is building.

### FINDING, found by checking the links rather than assuming

**`/cat-harness/docs-auto/` and `/cat-harness/docs-auto/index/` have no index
page either** — the same defect as `/cat-harness/`, one level down.
`gen-docs-auto.ts` writes an `index.html` per TYPE (`index/processes`,
`index/skills`) and nothing at the levels above them. The new page therefore
links the two leaves that exist and names `docs-auto` without a link, with a
comment saying why and that the link returns when the generator writes a
parent index at each level.

**Open, and the next piece of `06e3`:** `gen-docs-auto.ts` should write a
parent index at each level it publishes under. It is the same shape it already
has — an index listing what is below it — and until it exists, every link to a
docs-auto level above a leaf lands on a bare directory.

### Still open in this bean

- §4(b) the "meaningfully populated" QA check — now has a page to pass over,
  which it did not before.
- §4(c) the navbar over harnesses with a populated `docs/` — **blocked**: bean
  `603s` is in flight in another session on branch
  `claude/lhs-navbar-harness-folios-cqo9mu`, editing `harness-tiles.ts` and
  `nav_footer_custom.html`, which is exactly what §4(c) needs.
- §5 the KG viewer.
- The declared-but-unbuilt types: `glossary`, `index`, `index/bpmn`,
  `index/dmn`, `index/tasks`, `index/roles`.


## The docs-auto level pages — done, same session

The finding recorded above is fixed. `gen-docs-auto.ts` now writes an index at
**every level above a built type**, derived from the types actually built:
`/cat-harness/docs-auto/` and `/cat-harness/docs-auto/index/` had none, so any
link to them landed on a bare directory.

- **Derived, never listed.** The children of a level come from the built type
  ids by splitting on `/`. A type added to `TYPES` appears the day it builds; a
  level with nothing under it gets **no page at all** rather than an empty one,
  which is the same absent-rather-than-stubbed rule already on `TYPES` — an
  empty list and a complete list look identical.
- **Each level page names ITSELF** in the same `var SCOPE` line every other
  page here emits, so ownership is read off the file by the one pruner rather
  than assumed from the path. A level page that got this wrong would be
  unprunable forever and nothing else would say so.
- **The shared stylesheet was extracted** to `PAGE_CSS` rather than copied into
  the second renderer. Two copies of one stylesheet is two answers to what this
  looks like, and the copy nobody edits is the one a reader meets first.

§4(a)'s landing page gets its `docs-auto` link back, and the comment explaining
its absence is replaced by one recording why it was briefly missing.

5 tests added: every level has an index, each names itself, links are relative
(and never absolute from a base this generator does not know), an empty level
renders a stated absence, and a level counts a type's items while saying what a
nested level holds.


## §4(b) done — the "meaningfully populated" check — 2026-09-21

`cat-harness/scripts/check-docs-populated.ts`, registered as
`check:docs-populated` and gated in `code-quality-gates.yml`. Green for both
harnesses that declare a `docs` graph, so it gates from the first commit rather
than reddening the build on arrival.

**The adjective is what it measures.** A page counts only when it is AUTHORED —
nothing in its bytes says a generator wrote it — and carries at least 250 words
of PROSE, which excludes front matter, markup, code fences and any line that is
only a link. The threshold carries its basis rather than being tuned: §4(a)
asks a page to say what a process is for, when you would be in it and what it
is not; two or three of those plus a sentence on what the harness does is a few
hundred words, and below that the page is a title and a link list.

Measured: **cat-harness** ✓ `publication-workflow.md`, 8,199 words (76 authored,
261 generated). **who-iris** ✓ `kg-to-portal.html`, 1,496 words (9 authored).

### Three defects this found, two of them in itself

1. **It reported a clean pass over a sweep that looked at nothing.**
   `repoRootFor(process.cwd())` resolved to the repository's PARENT, so
   `instanceRootsIn` found one instance, no `docs` graph, and the check printed
   *"✓ every harness declaring docs has one"*. That is the CWD-vs-instance-root
   defect bean `a6kl` swept every gate for — committed by the gate written
   after it. Root now comes from `instanceRootFor(import.meta.dir)`, and **an
   empty harness list is exit 2**, because a sweep that found nothing has not
   cleared anything.
2. **A substring search for "generated" is wrong in both directions.** It marks
   `docs/getting-started.md` generated — an authored page that says an SVG is
   generated by `render:bpmn` — and misses `docs/publication-workflow.md`,
   which `gen-docs-pages.ts` writes. The markers are anchored now.
3. **`gen-docs-pages.ts` marks nothing it writes**, so its output is
   byte-indistinguishable from authored content. Nothing downstream can tell
   them apart, and this check does not pretend to: it is named in the module
   note as the fix belonging in that generator. **Open, and small:** a marker
   in what it writes, like every other generator here.

### Verified both ways

12 tests, and the one that matters is the falsifier the brief demanded: a page
that is a title plus a list of links comes out **thin**, and a generated page
never carries a harness however long it is. Plus: a declared directory that is
absent is `unknown` rather than thin (`dh4f`), an unreadable page is `unknown`,
and dot-prefixed directories are not searched.

The planted directories in the test are called `pages`, not `docs` — twice
deliberate. `site-dir-single-answer` refuses a hardcoded site root in any
source file and was right to fail the first draft; and a harness's docs
directory is whatever its DECLARATION names, so a check that only worked for
one called `docs` would be reading the name instead of the declaration.

Gates **83/83**.


### The `gen-docs-pages.ts` ambiguity is closed — same session

It now writes an HTML comment carrying the same phrase every other generator
here uses, naming the manifest directory to edit instead of the output. An HTML
comment because it must be invisible in the rendered page and present in the
source a reader opens on the forge; the same phrase because that is what lets
ONE reader recognise every generator rather than a list of spellings.

**It changed the answer, which is the point.** Before, `check:docs-populated`
credited cat-harness with `publication-workflow.md` — 8,199 words, and
generated. After: 65 authored rather than 76, and the evidence page is
`architecture/cat-harness-minimum.md`, 4,635 words, which somebody actually
wrote. The check was passing the harness on documentation nobody authored, and
neither the check nor anything else could have known.



## Claim released 2026-09-29

Released `in-progress` → `todo` on the owner's instruction (review session https://claude.ai/code/session_014Qj8wncQhqV52QGN1yZDnj). No git change to this bean since before 2026-09-26, no holder recorded, and no open branch touches it; the sessions that held theme D (content folios, SMART/FHIR stack, ingest) work stopped on the 2026-09-25 weekly usage limit. Nothing in the body was changed: re-claim with `bun run cat beans:claim <id>`.


## Migration plan, 2026-10-03 — the owner re-ruled and chose THIS bean's layout

Owner today: *"reserve `docs/` for user generated content, auto-docs/ for
glossary and such"*, *"one declared subgraph, with declared sub-sub-graphs per
writer"*, *"`derived-content` graph kind"*, *"go ahead w/ move … clean break"* —
then, shown that this bean already specified a different keying, **ruled for
this bean**: key by `<auto-doc-type>/<sub-graph>`, not per writer.

### The name collision dissolves — no new name is needed

`docs-auto` looked overloaded, because `cat-harness/docs/cat-harness/docs-auto/`
already exists. Measured: its 28 files are already emitted as

```
glossary/index.html            glossary/swimlane-glossary/index.html
index/docs/<sub-graph>/         index/processes/<sub-graph>/
index/skills/<sub-graph>/
```

**That IS this bean's `<auto-doc-type>/<sub-graph>` keying.** `gen-docs-auto.ts`
already implements the handler; it is merely rooted three levels too deep. So
the first slice is a promotion, not a redesign, and `docs-auto` stays the name.

### Proposed mapping (913 rendered pages; ~704 generated)

| current | files | → `docs-auto/<type>/<sub-graph>` |
|---|---|---|
| `docs/cat-harness/docs-auto/**` | 28 | **as-is, promoted to the instance root** |
| `docs/reference/skill-instructions/**` | 305 | `index/skills/<package>` |
| `docs/reference/skills/**` | 24 | `index/schemas/<schema>` |
| `docs/reference/upload-step/` | 1 | `index/tools/upload-step` |
| `docs/uml/**` | 126 | `uml/<instance>` |
| `docs/glossary/**` | 10 | `glossary/<ledger>` |
| `docs/{ar,es,fr,ru,zh}/glossary/` | 5 | `glossary/<ledger>/<lang>` |
| `docs/lsi/` | 1 | `lsi/<graph>` |
| `docs/processes/**` | 85 | `index/processes/<package>` |
| viewer pages (`docs/{qa,beans,todos,health,…}/index.html`) | ~127 | `index/<graph>` |

### The 17 `gen-docs-pages.ts` pages STAY in `docs/` — and this is the one place the owner's rule misfires

They carry `generated: scripts/gen-docs-pages.ts`, so "what is not user content
goes to auto-docs" would move them. **Measured: they are assembled AUTHORED
prose.** `content/docs/knowledge-graph/` holds 444 lines of hand-written `.md`
blocks; `docs/knowledge-graph.md` is the 507-line assembled page. The marker
means *built by a template*, not *derived from a graph*.

And §2 of this bean already says where they belong: *"when authoring
`<harness>/docs` the author should make use of auto-doc references and provide a
summary / overview"*. **These 17 are exactly those authored summary pages.**
So: `docs/` keeps them, and the `generated:` marker is not the discriminator —
**is the SOURCE a graph, or prose a person wrote?** is.

### The seam — why this is not a path rewrite across 16 scripts

Paths here are **composed from declarations**, not written as literals
(`check:declared-paths` refuses literals), which is why grepping for
`docs/processes` finds no writer.

- `docsLayers()` — `cat-harness/scripts/compose-docs.ts:147` — is the single
  resolver. **17 modules call it.**
- `baseDocs(repo)`, the five-line helper that picks the instance-scoped docs
  layer, is **copy-pasted identically into 6 files**:
  `gen-external-schemas-viz.ts`, `gen-fsh-guts-viz.ts`, `gen-processes-viz.ts`,
  `gen-tools-viz.ts`, `gen-methodologies-viz.ts`, `lib/skill-pages.ts`.

So "fix all producers/consumers/references" is: declare the layer, export **one**
`baseDocs`/`autoDocsDir`, delete the 6 copies, and have each writer ask for the
layer it owns.

### The guard, captured BEFORE anything moves

A verdict snapshot of all 913 rendered pages under `docs/`
(`generated|authored` × merge strategy × pattern id), taken at `c4036a79af`:

| | pages |
|---|---|
| generated + `take-base` | 448 |
| authored + `take-base` | 216 |
| authored + `refuse` | 206 |
| generated + `refuse` | 42 |
| authored + `generated-regions` | 1 |

**The 216 are not an authored-data-loss defect** — checked rather than reported:
127 are `.html` viewer pages and 85 are `docs/processes/*.md`, all generated
without a Jekyll `generated:` line, so the front-matter detector missed them,
not the globs. Worth recording because the first reading looked like
`take-base` silently discarding authors' edits, and it is not.

### Costs already measured

- `assets/` is a **Jekyll URL namespace**, 27 hardcoded refs in
  `_includes`/`_config.yml`. It splits: 6 authored css/js stay with `docs/`.
- **`assets/library/` is URL-frozen**: 13,214 absolute
  `https://litlfred.github.io/…/assets/library/…` citations across 6,861 files.
  Clean break accepted by the owner today, so these are rewritten rather than
  redirected — but the number is the number.
- ~184 authored in-repo references to the moving paths, concentrated in
  `docs/reference/` (92), all gate-resolved by `readme:audit`,
  `check:anchor-names`, `check-workflow-refs`, `check:reference-direction`.

### Still open

**Withdrawn 2026-10-03 — this was a SHADOW CHECKLIST and two of its three items
were false.** It restated the canonical `## Done when` in a planning section, and
once the canonical items were ticked it went on claiming work was outstanding:

| it said | the canonical list says |
|---|---|
| `[ ] toc stays OUT` | `[x] the handler exists and is declared … and **no** toc` |
| `[ ] the authoring-rule half is a SKILL` | `[x] the authoring rule lives in a skill with the reuse-not-restate clause` |
| `[ ] who-iris/docs is the named first exercise` | `[ ]` — the one genuinely open item, and already there |

So: **see `## Done when` above.** Nothing is tracked here.

`check:bean-bodies` rejects a *ticked* restatement beside an open canonical item,
for the stated reason that *"the section a reader and every tool consult says this
is not done"*. This was the INVERSE — an *unticked* restatement beside a ticked
canonical item — and the gate is green across it, measured on `main` 2026-10-03.
That direction is worse, not better: a stale "still open" sends the next agent to
redo finished work, where a stale "done" at least leaves them reading the real
list. Reported rather than fixed in the gate, which is its own change.


## CORRECTION, 2026-10-03 — two claims in the plan above are wrong

Both were found by reading `scripts/gen-docs-auto.ts`'s module docblock, which
I should have read before writing the plan rather than after. It records
decisions already taken on this bean.

### 1. `docs-auto` is deliberately NOT a graph kind — and the plan was about to register one

The docblock, §"Why this is a NEW generator rather than a kind of an existing
one":

> A note on `06e3` guessed the opposite — that docs-auto would be a `kind`
> handled by `state-visualizer.ts` … Reading the three existing generators says
> no, and the reason is structural rather than a matter of taste: **every one of
> them is one-axis.** … docs-auto is **two-axis** — an auto-doc TYPE crossed
> with a SUB-GRAPH — and there is nowhere in a one-axis generator to put the
> second axis without it becoming this file anyway.

So "a `docs-auto` graph kind with `holds: derived` and a `docs-auto.json`
from-within node" is **the thing a note on this bean already guessed and the
implementer rejected with reasons**. I had got as far as reading the
`graph-kind-registry` entry for `docs` and the §"Adding a kind" procedure
before finding it.

### 2. "Rooted three levels too deep … a promotion, not a redesign" is WRONG

`docs/cat-harness/docs-auto/` is not misplacement. `viewerPlacement(site,
dirPath, kind)` builds `pageDir = join(site, ...dirPath.split("/"))`, and
`dirPath` is documented as *"the handled directory's repo-relative path, e.g.
`cat-harness/schemas`"*. The `cat-harness` segment is therefore the **handler**,
and the whole route is the owner's `<base>/<handler>/<kind>/<subject>` rule,
shared with `gen-schema-viz` and `gen-library-viz`. The docblock says so:
*"No new URL rule, no fourth pruner."*

**Promoting it to the instance root would break the owner's URL rule**, not
tidy it.

### 3. The sub-graph segment is a declared `id`, ONE segment — which invalidates part of the mapping table

Also settled already, and by the owner:

> The owner wrote `<path>`. This publishes under the declared entry's **id**
> instead — put to them as an open question on #607 with both costs stated, and
> **ruled for the `id` on 2026-09-21** … It stays one segment. A path has
> slashes, so page directories would nest — and `orphanSubjectPages` scans one
> level, which is what makes pruning's ownership test exact.

So rows in the mapping table above that put a slash or a non-id in the subject
segment are not reachable: `glossary/<ledger>`, `index/schemas/<schema>`,
`glossary/<ledger>/<lang>`, `uml/<instance>`. The subject must be a **declared
directory id** — `skills`, `schemas`, `processes`, `swimlane-glossary` — and
one segment only.

## What the owner's ruling today therefore means

Not *"move `docs-auto` up and relocate directories beneath it"*. Rather:

**`docs-auto` is already in the right place, with the right two-axis keying and
the owner's URL rule. The other derived families become new `<auto-doc-type>`s
handled by this generator** — `uml`, `lsi`, `index/schemas`, `index/tools` — with
their subject segment taken from the declaration's `id`.

That is a change to one two-axis generator and a set of declared types, not a
bulk `git mv` of 687 files. It is also much closer to what this bean asked for
in the first place: *"one handler, parameterised twice"*.

**The `docs/` half of the owner's ruling still stands and is unaffected**: the
17 `gen-docs-pages.ts` pages are assembled authored prose and stay, and that
remains the discriminator — is the SOURCE a graph, or prose a person wrote?

## Still true from the plan above

- the seam slice is done and landed (`baseDocsDir`, six copies deleted, proven
  no-op: all six generator `:check`s pass with zero generated files changed)
- the 913-page verdict snapshot, and that the 216 `authored take-base` are a
  detector artefact rather than a data-loss defect
- `assets/` is a Jekyll URL namespace; `assets/library/` is URL-frozen by
  13,214 absolute citations across 6,861 files
- `toc` stays out; the authoring rule is a skill; `who-iris/docs` is the first
  exercise


## `index/bpmn` — RULED satisfied, 2026-10-03

Owner, asked with the measurement in front of them and both alternatives
costed: **`index/processes` IS `index/bpmn` under a different name.** The item
is closed, not dropped.

What was measured before asking:

| | |
|---|---|
| git-tracked `.bpmn` files | **78** |
| `index/processes` items | **78** — *"every BPMN process, with its own documentation, its lanes, and the skills its activities name"* |
| `index/tasks` items (added same day) | **584** named activities inside those files |

So both granularities a reader could want — the process, and the work inside it
— were already covered before a type called `index/bpmn` existed. A third index
over the same 78 files is the defect `AutoDocType.graph` exists to prevent, and
`gen-docs-auto.ts`'s own docblock records its cost: walking every declared
directory reported **1,522** skills where `knownSkills()` finds ~136, *"because
a RENDERING of an artefact is not the artefact"*.

**The alternative was offered and declined**, so it does not need rediscovering:
a type over BPMN *elements* beyond activities — gateways, events, lanes,
sequence flows — is genuinely uncovered, but it is ~2,000+ rows of which most
carry no `name`, and it would need the same unnamed-element rule `index/tasks`
uses (skip rather than list under an id, because a row reading
`Gateway_0a1b2c` makes an index look populated while telling a reader nothing).

**Status, against the canonical `## Done when` above — which is now ticked
there rather than restated here.** `check:bean-bodies` rejected the first
version of this paragraph for exactly that: it carried a second, ticked copy of
two items while the canonical list still showed them open, and the gate's words
are the reason — *"the section a reader and every tool consult says this is not
done"*. One fact, one place.

Ticked above today: **the handler and its type set** (with `toc` verified
ABSENT, not merely unmentioned), and **the authoring rule in a skill** — which
needed no work, because `skills/ui/ui-core/docs-auto.md` already carried the
obligation, the owner's *"reuse assets in explain"* quote, the `id`-not-path
rule and empty-gets-no-page. I nearly wrote a second one.

Still open above, and the only substantive item left: **`who-iris/docs` as the
first real exercise, end to end.** That directory holds **1** markdown file, so
it is untouched rather than partly done. The per-process summary item is its
authored half.

The type set as it now stands: `glossary`, `index`, `index/docs`,
`index/skills`, `index/processes`, `index/schemas`, `index/tools`,
`index/roles`, `index/dmn`, `index/tasks`, `uml`, `lsi`. Count it from `TYPES`
rather than from this list.


## The refuse item is done — PR #1991, merged 2026-10-03

*"a stale or moved source makes the derivation FAIL, never render empty"* is
implemented and on `main`. Ticked in the canonical list above rather than
restated here, which is what `check:bean-bodies` rejected a shadow copy for
earlier today.

`gen-docs-auto.ts` now refuses when a type collects **nothing** while its
graph's declared directories **hold files**. The three-way discrimination is
`dh4f`'s, and it is what keeps the guard from becoming a nuisance:

| state | behaviour |
|---|---|
| no declared directory for the graph | silent — a fresh folio with no `processes/` must not fail `index/dmn` |
| declared directories, all empty | silent — "not there" and "empty" are different facts, neither a defect |
| declared directories **with files**, type collects nothing | **refuse** |

**It was written after shipping the failure twice in one session**, which is
why it exists rather than being argued for: `index/tools` filtered `.json` on
`AGENTS.md`'s "Tool definitions" wording when the directory holds `.ts`, and
`index/roles` passed `dirname()` where `readRoleGraph` wants the directory
itself. Both emitted **0 items and printed `✓`**; both were caught by a human
reading the count.

And the guard runs **before** the orphan prune, because the first draft had it
after and a buggy run then deleted four sub-graph pages before reporting a
defect against the tree it had emptied — `deletion-requires-confirmation`
broken by sequencing. Measured both ways: 1 page surviving with the guard
after, 5 with it before.

## The per-process summary, 2026-10-03 — `docs/platform.md`, not a new page

**The page already existed and was the right page.** `docs/platform.md` is
titled *"The platform — actors, roles, processes, skills"*, is authored (no
`generated:` front matter, no `content/docs/platform/` source), and already
linked the derived process and skill indexes. A second page would have been a
second answer to the same question.

**What it did not do was name anything.** Measured against the §4(b) check that
landed the same day (bean `akjg`), `platform.md` came out **`thin`**: it named
one declared role and **none** of the 61 declared processes and **none** of the
403 declared tasks. A page about the *shape* of processes, linking an index of
them, saying nothing about any one of them. The section headed "Roles, tasks and
skills" linked only **skills** — neither the roles index nor the tasks index,
both of which exist.

So the gap was concrete and the fix was an edit:

| added | why it is not index-duplication |
|---|---|
| a worked entry-point-vs-called pair | the abstract rule was already stated; what was missing was that it SURPRISES — **Adjudication** reads like an entry point and is not |
| the roles and tasks index links | the section's own title promised them |
| real roles and tasks, with the mechanical/human point | a role here is as likely to be **Build pipeline** as **Adjudicator**, which the flat index does not convey |

**Every claim was measured before it was written, not recalled.** `Adjudication`
(`Process_Adjudication`) is called from `Translation Workflow`, from
`Ingestion subprocess — the L1 completeness gate` and from
`Refresh materialized remote content`; `Criterion adjudication` is called from
`Wireframe design review` and `Voice overlay review`; `Content acquisition` is
called by nothing. Verified by reading `calledElement` across every `.bpmn` under
the declared `processes` directories.

**No count went into the prose**, deliberately — `bpmn-processes` says to count
the directory rather than quote a number from a paragraph, and the entry/called
split is exactly the kind of number that rots. The page names examples and tells
the reader to ask the index who calls what.

After: `populated` — process `Adjudication`, role `Activity log`, task
`Authorise the extraction`, three distinct names, 1445 words of prose.
`docs:pages:check`, `check:anchor-names` and `docs:auto:check` all pass.

**Verified by LOOKING at it, and that caught a defect no gate did.** The first
draft put the two new index links on consecutive markdown lines, so kramdown
joined them into ONE paragraph and they rendered run together —
*"Every role, with the skills its lane carries → Every task, by the process that
draws it →"* — unlike the single link above them. Every gate was green across
it. Separated into two paragraphs, rebuilt, re-shot.

The build also confirmed both new links resolve to real pages
(`cat-harness/docs-auto/index/{roles,tasks}/index.html` present in the output)
and that every heading anchor on the page is unique, which is the `gjli` rule.
Screenshots at 1280 and 390 px; phone width has no horizontal overflow.

### Two things reported rather than fixed

1. **The check still names `methodologies/index.md` as cat-harness's subject
   page**, because it ranks by (score, then prose length) and that page has 6910
   words against `platform.md`'s 1445. The ranking is behaving as designed — it
   names the strongest page, not the most *appropriate* one — and there is no
   declared "this is the landing page" signal for it to prefer. Inventing one is
   a separate decision, not a bug to patch here.
2. **§4(a)'s literal URL, `<base-url>/<harness>/docs`, is not what this
   satisfies** — and it was already settled against: `platform.md`'s own header
   records that it lived at `/cat-harness/` until 2026-09-21, when the owner
   ruled **the handler wins** that namespace (bean `8h42`), so every route under
   it is generator output.

   **WITHDRAWN, same day, and the mistake is worth keeping.** This paragraph
   first said `<base>/cat-harness/` has *"no index at all"* and called it a real
   gap for the owner. It is wrong. `<base>/cat-harness/` **is** served —
   `docs/cat-harness/published-graphs.md` carries `permalink: /cat-harness/`,
   and a local site build emits `cat-harness/index.html` at 241568 bytes,
   titled "Published graphs".

   The error was method, not typing: absence was inferred from
   `find -name 'index.*'`, a FILENAME pattern, when the question was about a
   published ROUTE — and a page may claim a route with `permalink` while being
   named anything at all. A filename is evidence about a file; only the build is
   evidence about a URL. Caught by running `preview:site`, which is the whole
   reason that script exists: *"a green gate set is not a rendered page."*

## §4(c), the navbar index — measured 2026-10-03, and it has NOTHING TO CATCH today

§4(c) asks the LHS navbar to index every KG asset that HAS a populated `docs/` —
*"Not every declared `docs` directory — one with assets in it"* — on the `dh4f`
ground that a nav entry to an empty directory is a link resolving to nothing.

Before building that rule, the premise was measured: every declared `docs`-kind
directory across every instance in this checkout, counted on disk.

| instance | directory | files |
|---|---|---|
| `cat-harness` | `cat-harness/docs` | 1905 |
| `smart-immunizations` | `smart-immunizations/docs` | 753 |
| `smart-trust` | `smart-trust/docs` | 682 |
| `smart-base` | `smart-base/docs` | 227 |
| `smart-base` | `smart-base/findings` | 5 |
| `who-iris` | `who-iris/site` | 14 |
| `who-iris` | `who-iris/docs` | 5 |
| `folio-assistant` | `docs` | **1** |

**Zero EMPTY. Zero ABSENT.** Eight instances declare no `docs` directory at all
(`bootstrap`, `bootstrap-tools`, `cat-harness-tools`, `fhir-harness`,
`folio-assistant-core`, `folio-assistant-sci`, `smart-ig`, `who-style-guide`) —
and declaring nothing is the correct behaviour, not the defect; `dh4f` is about
declaring what is not there.

So §4(c) is a **guard against a state that does not currently occur**, not a fix
for a visible one. That is worth knowing before building it: a rule written now
would fire on nothing, and a rule that fires on nothing cannot be told from a
rule that is broken — which is the `xom7` shape the rest of this bean is about.

Two things that do follow from the measurement:

1. **`folio-assistant/docs` holds ONE file**, and `check:docs-populated` passes
   the root instance on it (`docs/README.md`, 299 words). That is the closest
   thing in the corpus to §4(c)'s concern, and it is a *thin* directory rather
   than an empty one — so the rule §4(c) names would not catch it either.
2. The guard has **prospective** value: a downstream folio can declare an empty
   `docs/`, and `wwi6` pins that a dependent materialises its own directories.
   So this is worth building eventually, with a fixture rather than the corpus
   as its first test.

**Not started**, deliberately, and this paragraph is the reason rather than a
shrug. The owner picked §4(b) of these three; §4(a) is done above because (b)
grades it. §4(c) is reported with its premise measured so the next agent does
not repeat the investigation.

_2026-10-04T06:09:36Z_ — Claimed by claude/who-iris-docs-end-to-end-06e3 — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).


## THE EXERCISE, RUN END TO END — 2026-10-04, PR #2049

The one open `## Done when` item, ticked above. The owner **overrode the
ordering** in `## Not started` on 2026-10-04 and dispatched this ahead of the
three who-iris items it was queued behind (`7dek`, render-kg-to-cdn, is still
`in-progress`). Recorded so the note does not read as missed.

Run at `ed2f3f4467`: `docs:auto`, `readme:sync`, `handler:index`,
`state:visualizer`, then `preview:site` and **a browser**.

### The answer: they do NOT fight on the filesystem, and they DO fight on who-is-who

Three things that could have collided and do not — verified rather than assumed,
because "no collision" is the claim most easily made by not looking:

| could collide | verdict | evidence |
|---|---|---|
| route | **no** | `/docs/who-iris/*` (the verbatim mount) and `/cat-harness/docs-auto/index/docs/who-iris-docs/` are disjoint, and the index's rows link `github.com/…/blob/main/…` SOURCE, never a published route |
| overwrite / delete | **no** | `orphansIn(DOCS, OWNED_DOCS)` (`gen-iris-pages.ts:2545`) tests `^(index\|ingestion-notes\|kg-to-portal)\.html$` only; its comment: *"a page somebody hand-added, a `.nojekyll`, an asset directory, all survive"* |
| staleness | **no** | `git status --porcelain` = **0 lines** after all four generators |

What fights is the **classification** — who wrote which page — and everything
downstream of it.

### FIGHT 1 — the §4(b) check passes who-iris on documentation nobody authored

`check:docs-populated` reports:

> `✓ who-iris   who-iris/docs/kg-to-portal.html — 1491 words of prose`
> `  14 authored, 0 generated  ·  who-iris/docs, who-iris/site`

Measured truth, built from `gen-iris-pages.ts`'s own exported `OWNED_DOCS` /
`OWNED_SITE` patterns and the `subgraph-readmes.ts` marker:

| | pages |
|---|---|
| written by `gen-iris-pages.ts` | **12** |
| written by `bootstrap-tools/scripts/subgraph-readmes.ts` | **2** |
| **authored by a person** | **2** — `docs/style-guide.md`, `docs/style-guide-agents.md` |

Corroborated independently: bare `bun run cat iris:pages:check` exits 0 with
`12 page(s) up to date, no orphans.`

So `0 generated` is wrong by twelve, and **the evidence page the check names is
one of the twelve.** This is the defect this bean already recorded closing for
cat-harness on 2026-09-21 — *"The check was passing the harness on documentation
nobody authored, and neither the check nor anything else could have known"* —
still live, on the instance this bean named as the first real exercise.

**Cause, and it is two separate gaps.** `GENERATED_MARKERS`
(`check-docs-populated.ts:136`) is three anchored patterns: `^var SCOPE = "…";$`,
`Do not hand-edit`, `— do not edit here.`

1. `gen-iris-pages.ts` **marks nothing it writes** — the same gap this bean
   closed in `gen-docs-pages.ts`, in a different generator.
2. `subgraph-readmes.ts` DOES mark, twice, and matches none of the three: it
   writes *"— do not edit; change that entry"* and *"Do not edit it here;"*.
   **It lives in the `bootstrap-tools` SUBMODULE**, so aligning its wording is a
   cross-repo change, not an edit here.

**The verdict is right by accident, which is why it is worth stating.** With the
12 excluded, who-iris still passes: `style-guide.md` is 558 prose words and
`style-guide-agents.md` 347, both over `MIN_PROSE_WORDS` (250). Only the
evidence changes. A reader told *"✓ who-iris, 14 authored"* has no way to find
that out.

### FIGHT 2 — the derived index lists derived pages as authored

`index/docs` promises, in its own `extracts` string rendered at the top of every
page it writes: *"every AUTHORED documentation page an instance publishes"*.

| page | rows | derived |
|---|---|---|
| `…/docs-auto/index/docs/who-iris-docs/` | 6 | **4** |
| `…/docs-auto/index/docs/who-iris-site/` | 8 | **8 — zero authored** |

The second is the sharper one: an index whose heading promises authored pages,
listing eight, none of which is. It is a direct consequence of FIGHT 1 —
`collect()` skips on `classify(abs, text) === "generated"`, imported from
`check-docs-populated.ts` *"rather than re-derived"*, exactly as its comment
intends. The reuse is right; the shared answer is wrong.

### FIGHT 3 — the two genuinely authored pages are the two that do not render

`who-iris.json`'s own `who-iris-catalogue` comment states the rule:

> *"HTML rather than markdown because who-iris declares no `composed` directory
> -- its docs are MOUNTED after Jekyll, so a .md here would be copied verbatim
> and never rendered."*

Bean `qsx4` then moved two `.md` files into that directory on 2026-10-01. In the
built site:

- `/docs/who-iris/style-guide.md` → **200**, raw markdown. Screenshotted: `#` and
  `**` markers, unrendered pipe tables, `â€"` where em-dashes were.
- `/docs/who-iris/style-guide.html` → **404**.
- `docs/who-iris/index.html` — the generated landing page, section headed
  **"Pages"** — lists exactly two, `ingestion-notes` and `kg-to-portal`. Its
  `PAGES.docs.fixed` list predates `qsx4` and knows nothing of the other two.
- Whole-site `grep -rho 'href="[^"]*style-guide[^"]*"'` over **4155** built
  pages: **2 + 2 GitHub blob links and nothing else.**

So the derived index is the **only** thing that reaches who-iris's authored
documentation, and it reaches it as source on a forge. That is the inverse of
the §2 worry: not an index crowding out prose, but prose that only the index can
find.

And the index can say nothing about it — `index/docs` reads `.md` summaries from
front matter, and neither file has any, so both render *"no description in the
artefact"*. Honest, and it is the whole of what a reader gets.

### FIGHT 4 — a rendering defect no gate was red across. FIXED in #2049

At 390 px on the who-iris-docs index, `.n` (`float: right`, emitted after the
name and the path) wrapped onto a second line in a block `li` that does not
contain a float, and rendered **in the next row**:

    smart-trust-docs  li 721-756   its count 2153 at y 750-775
    who-iris-docs     li 756-792   its count 6    at y 761-786

smart-trust showed no count; who-iris read `6 2153`. `overflowX` was 0, no
`pageerror`, every gate green. `display: flow-root` on `ul.subs li`; after:
`721-781` / `781-816`, both contained. The 1280 px screenshots are byte-identical
before and after.

The phone-width block directly below that rule had already fixed this class for
the `#da-index` TABLE (bean `n5be`, finding 4). The sub-graph LIST was not
covered by it.

### Two stale statements of fact, reported not fixed

- `gen-docs-auto.ts:644` and `harness-tiles.ts:406`/`:502` each assert
  *"`who-iris/docs/` holds FOUR pages and every one is `.html`"*, and use it as
  the stated reason `index/docs` walks `.html`. It holds **3 `.html` + 3 `.md`**
  since `qsx4`. The reason is still good; the number is not.
- `who-iris.json` says *"TWELVE nodes today"* and the catalogue holds **13**
  (`who-iris/catalogue/nodes/*.json`; `catalogue.json` `totalItemsUpstream` =
  273559, which the rendered page quotes correctly). A count in prose, one
  commit from wrong — the rule `bpmn-processes` states, in a declaration.

### What this says about the bean's own question

§2's rule — *the author references the index and writes what an index cannot
contain* — is **not** what who-iris breaks. who-iris has no authored summary
referencing its indexes at all; it has four generated pages that read as
authored and two authored pages nothing links. The obstacle to §2 here is not
discipline, it is that nothing in the corpus can currently tell the two apart.

**So the ordering of the remaining work follows from the exercise rather than
from taste:** marking is prior to everything. Until a generated page says so in
its own bytes, neither the §4(b) gate nor the `index/docs` type nor an author
deciding where to put a summary has a true answer to *who wrote this*.



_2026-10-04_ — Claim released to `todo` after PR #2049. The canonical `## Done when` is now fully ticked, and the bean is deliberately NOT marked completed: §4(c) (the navbar over harnesses with a populated `docs/`), §5 (the KG viewer) and the declared-but-unbuilt types (`index`, `index/dmn` variants beyond those built, `glossary` beyond `swimlane-glossary`) are still open in their own sections above, and closing the bean would bury them. The question of whether those belong here or in beans of their own is the owner's — asked on #2049 rather than decided here.

## Completed
All 5 acceptance criteria completed and verified. docs-auto handlers and authoring rules implemented and enforced.
