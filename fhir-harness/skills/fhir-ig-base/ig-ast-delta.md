---
name: ig-ast-delta
description: >
  List and view what changed between two IG ASTs, check whether an AST is
  still valid for the IG's current inputs, and render the delta as
  just-the-docs pages that carry the provisional mark. Read before trusting a
  cached AST, before reviewing an incremental IG build, and before rendering
  anything from a cache.
---

# ig-ast-delta

> Skill id: `ig-ast-delta` · Package: `fhir-ig-base` · Layer:
> `fhir-harness`
>
> An instance of the general compiled-artefact-cache pattern; the shared
> contract is cat-harness's `compiled-artefact-cache` skill. The AST's cache
> is declared once, as the `cache/1.0.0` node
> [`caches/fhir-ast.cache.json`](../../caches/fhir-ast.cache.json): its
> verify is `validity` below, and its staleness is computed by `caches:viz`
> (see [`ig-build-pipeline`](ig-build-pipeline.md) §"The AST cache lifecycle").

An **IG AST** is a per-resource dump of what one IG Publisher build held in
memory. It is written by the `ast-export` library, which is built **on top
of** the Publisher rather than inside it
([`litlfred/fhir-ig-publisher@claude/ast-export`](https://github.com/litlfred/fhir-ig-publisher/tree/claude/ast-export),
`ast-export/`). This skill is the consumer half: listing an AST, checking it,
diffing two of them, and rendering the result for a reviewer.

## The one rule: a cache, never an authority

Every AST manifest says `"authority": "cache"` and lists what is
`provisional` until a full Publisher run: indices, dependency edges and
versions. **Anything rendered from an AST, or from a delta between two,
shows that mark to the reader**, on the page itself
([`ig-publisher-reduction`](ig-publisher-reduction.md) P3). A mark that
exists only in a log or a JSON field does not count.

## Where the files come from

| file | written by | says |
|---|---|---|
| `manifest.json` (`ig-ast/v1`) | `AstExportCli`, `AstMerger` | every resource with its key, the toolchain, the `inputs` the AST is valid for, and, on an incremental AST, `mixed: true` and `builtAt` per resource |
| `dependencies.json` (`ig-ast-dependencies/v1`) | same | every edge, `resolved` to a resource in this IG or `null` when the target is elsewhere |
| `fsh-index.json` | **SUSHI** (copied by `AstExportCli`) | the authoritative mapping from source `.fsh` file to output resource filename, with source line ranges. SUSHI writes it to `fsh-generated/data/fsh-index.json`; the copy lets a later delta map a file that has since been deleted |
| `plan.json` (`ig-ast-plan/v1`) | `AstPlanCli` | what a delta of changed files means: rebuild, load from cache, remove, or a full build and why |
| `delta.json` (`ig-ast-delta/v1`) | `ig-ast.ts diff` (here) | what changed between two ASTs |

### The formats are declared once, and published as JSON Schema

The three `ig-ast*` formats are declared in Zod in
`fhir-harness/schemas/ig-ast.ts`, and `readAst` validates through it. The
JSON Schemas (draft-07) and a JSON-LD context are **generated** from that
declaration and committed beside it:

- `ig-ast.schema.json`
- `ig-ast-dependencies.schema.json`
- `ig-ast-plan.schema.json`
- `ig-ast.context.jsonld`

`bun run cat ig-ast:schema` regenerates them and `ig-ast:schema:check` is the
CI gate. The Java writer and any downstream consumer validate against these
files. Every object is open to fields the writer adds first; `authority` is
the literal `"cache"`, and a manifest claiming anything else is refused.

A resource's **key** is `canonical|version`, or `Type/id` when it has no
canonical. Two ASTs are compared by key. **An incomplete AST is refused**: a
missing `dependencies.json` or a missing or unparsable resource file stops
the command, because an empty substitute would diff as "no change".

## Commands

All of them live in `fhir-harness/scripts/ig-ast.ts`, and each is declared as
a Tool:

```sh
bun run fhir-harness/scripts/ig-ast.ts list <ast>
bun run fhir-harness/scripts/ig-ast.ts validity <ast> --ig <root> [--toolchain "<ig-publisher X / core Y>"] [--at <rev>]
bun run fhir-harness/scripts/ig-ast.ts digest --ig <root> [--at <rev>]
bun run fhir-harness/scripts/ig-ast.ts diff <base-ast> <head-ast> [--plan plan.json] [--json delta.json] [--site <dir>]
bun run fhir-harness/scripts/ig-ast.ts render <delta.json> --site <dir>
bun run fhir-harness/scripts/ig-ast.ts jsonld <ast> > ast.jsonld
```

### `validity`: is this AST still the IG I have?

It reuses folio-assistant-core's `compiledValidity`, the staleness check the
Lean `.olean` cache uses. The Java side writes `inputs` in exactly
`CompiledInputsSchema`'s shape: `toolchain`, `sourceRevision`, and
`inputDigest` as 64 hex characters. `validity` recomputes the digest and the
revision from the checkout and compares.

- `valid` (exit 0): built from these inputs.
- `stale-inputs` (exit 1): names **which** input differs. A changed `input/`
  file is `inputDigest`; a newer Publisher is `toolchain`.
- `cannot-tell` (exit 2): **never a pass.** A manifest without usable
  `inputs`, or with a digest in the older `sha256:<hex>` form, lands here.

**The digest is computed in two languages**, Java when writing and
TypeScript when checking. A golden vector
(`58871352384745e1d7fd68f7ea918b0e2febbd86cf36a9cb5f0c7ce9d13a82f1`) is
asserted by both test suites. If you change the algorithm, change it and the
vector in both places; a drift makes every AST read as stale, or a stale one
read as valid.

**A later commit that changes no input is the same source.** If the recorded
`sourceRevision` is an ancestor of HEAD and the recomputed `inputDigest`
equals the recorded one, the revision counts as unchanged (`sameSourceAs`),
so a README merge does not make the cache stale. A recorded commit the
checkout cannot see (a shallow clone, another branch) stays stale.

**After a build, check the commit, not the work tree: `--at <rev>`.** The
Publisher writes under `input/` during a build: it renders
`input/images-source/*.plantuml` into `input/images/*.svg`, overwriting
tracked files and adding untracked ones, so a work-tree digest taken after
the build is not the commit's and a freshly built AST fails its own check.
`validity --at HEAD` (and `digest --at HEAD`) hashes the inputs as committed
(`inputDigestAt`); in a clean checkout this equals the work-tree digest and
the exporter's. `ig-ast-refresh.yml` instead restores `input/` with git
before its check.

The toolchain cannot be read from a checkout. Without `--toolchain` it is
**assumed unchanged**, and the result's `current` says so. When the
Publisher you would run is known, pass it.

### `diff`: list what changed

Resources are `added`, `removed`, `changed` or `versionChanged`. A version
move (same canonical, different version) is **paired**, not reported as a
removal plus an addition. Each changed resource carries a **differential**:
JSON paths whose value was added, removed or changed, capped at 200 rows per
resource, with the overflow **counted** rather than dropped. Edges are
listed as added or removed. `--plan` folds the incremental plan's decision
in.

**The differential is structural**, over the dumped JSON, not FHIR-semantic:
reordering a repeating element shows as a change at every index, and a
narrative regenerated with a new timestamp shows as a change. Read it as
"these bytes moved", and judge meaning yourself.

### `render`: view it in the pipeline

`--site <dir>` writes just-the-docs pages: `index.md` (the list, grouped by
resource type, with counts, the plan, and edge changes) and one page per
changed or version-changed resource (path, op, base, head).

- **Every page opens with the provisional mark.** Do not remove it to make a
  page look finished.
- **Liquid in values is neutralised, not merely wrapped.** FHIR narratives
  carry Liquid output and tag delimiters (double braces, brace-percent). A
  raw block around the page is not enough: a value containing the raw
  block's own closing tag would end it. So every value gets a word joiner
  (U+2060) inside each opening and closing delimiter; the text reads the
  same, and Jekyll parses nothing. This skill names those delimiters in
  words because its own reference page is rendered inside a raw block by
  `gen-skill-docs`; do not write the closing tag literally here.
- **One page per key, not per Type/id.** Page names carry a hash of the key,
  as the AST's own files do, so two versions of one resource are two pages.
- Table cells escape `|`, which a key contains (`canonical|version`).

Put the pages under the IG's own just-the-docs site (see
[`ig-render-jekyll`](ig-render-jekyll.md)) as a child section, so the
reviewer keeps the site's navigation.

## Where this sits in a process

The review is drawn as its own subprocess,
`fhir-harness/collab/processes/content/ig-ast-delta-review.bpmn`. In
`fhir-harness/collab/processes/content/ig-incremental-build.bpmn` it belongs between
**Task_Merge** (restored and rebuilt records merged) and **Task_Qa** (QC
gates on the aggregate), which that diagram does not yet show: it is what
the QC reviewer reads to decide whether the incremental result is what a
full build would have produced. The steps, in order:

1. `validity` on the base AST. **`stale-inputs` or `cannot-tell` means no
   incremental build**; run a full one.
2. `AstPlanCli` for the delta of changed files. The planner uses **two
   maps**:
   - **Forward** (`fsh-index.json`, from SUSHI): which `.fsh` file produces
     which FHIR resource. This is the authoritative answer.
   - **Reverse** (`fsh-file-users/v1`, from `fsh-cone --file-users`): which
     files depend on a given file. This is how a changed RuleSet- or
     Alias-only file (which produces no resource itself) reaches the
     resources it affects.
3. `IncrementalBuildCli` (or a full build, if the plan says so).
4. `diff base head --plan plan.json --site <site>/ast-delta/`.
5. The reviewer reads the rendered delta. **A difference they cannot explain
   is a missed coupling** in the cone rules, not a curiosity: file it as a
   work item and run a full build.

## Which rendered pages a source change reaches

Before any build, `fhir-harness/scripts/ig-rendered-impact.ts` predicts the
rendered files a change to `.fsh`, `.cql` or `input/pagecontent` alters,
through `fsh-cone` and SUSHI's `fsh-index.json`, as a `rendered-impact/v1`
(skill `rendered-impact` in cat-harness). An AST `diff` afterwards confirms
it: a resource the delta reports changed whose page the prediction did not
name is a cone defect.

```sh
bun run fhir-harness/scripts/ig-rendered-impact.ts --ig <root> --base origin/main --head HEAD [--ast <output-ast>] --out impact.json
```

## Do not

- **Do not treat a clean `validity` as a correct AST.** It says the AST was
  built from these inputs, not that the build was right.
- **Do not diff a merged (`mixed: true`) AST against a full build and call
  every difference a bug.** Check `builtAt` first. A resource carried from
  the base was not rebuilt, and the difference may be the change itself.
- **Do not render from an AST whose `validity` you did not check.**
- **Do not re-implement any of this in a CI workflow.** CI calls these same
  scripts and tools, so a CI result and a local result are the same
  measurement. `.github/workflows/ig-ast-refresh.yml` (`ig-build-pipeline`
  §"The AST cache lifecycle") does exactly that: `ig-cache.sh`,
  `ig-ast.ts validity` and `AstExportCli`.
