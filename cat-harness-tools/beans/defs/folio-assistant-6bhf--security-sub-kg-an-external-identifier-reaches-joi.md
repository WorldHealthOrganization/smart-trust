---
# folio-assistant-6bhf
$schema: bean/1.0.0
title: 'SECURITY SUB-KG: an external identifier reaches join() unvalidated in three HTTP handlers, and the containment helper that fixes it already exists in one script'
status: completed
type: bug
priority: high
created_at: 2026-09-25T16:38:20Z
updated_at: 2026-09-26T14:31:39Z
parent: folio-assistant-1xhc
---

Owner, 2026-09-25, verbatim:

> add lots of precautions/double checking/fails safe on rm -fr... is variable
> there? injection hazard. that is needed on ALL I/O. bean as ceybeesquity sub
> KG in tools. first is injection et. related skills already man y in folio and
> smart-base. consolidate.

Owner chose scope **2 + 3**: consolidate the scattered pieces **and** audit every
I/O site. This bean is the audit; the consolidation is its sibling work.

## `rm -rf` first, because that is what was asked — and it is NOT where the hole is

Every `rm -r*` line carrying an expansion, all 42 of them, read rather than
grepped. **The staging workflow is well defended**, and that is the finding
rather than a disappointment: `fuzm`, `plj1` and `85im` each produced a real
guard with measured reasoning behind it.

| site | guard | verdict |
|---|---|---|
| `feature-staging.yml:1083` | `case "$STAGING_SLUG" in ""\|.\|..\|*/*)` re-checked BY VALUE after a job boundary | safe |
| `feature-staging.yml:1296` | value-checked at its producer (line 1237) in the SAME job | safe |
| `feature-staging.yml:1582` | a dedicated guard job: value check, character class, and a confirmation that repeats the slug | safe |
| `folio-staging.yml:461` | same `case` guard | safe |

14 of 16 shell files carrying such a line run `set -u`. The two that do not are
`scripts/lib/docker-tex.sh` and `templates/document/github/workflows/qa-sweep-nightly.yml`,
and both use `rm -f` on a temp file rather than `rm -rf` on a directory.

**Two residues, both minor.** `feature-staging.yml:1296` is the one of the four
that neither runs `set -eu` nor says which earlier guard it relies on — its
safety is real but undocumented, which is how the next edit removes it.
`lake-cache-fetch.sh:112` writes `trap "rm -rf ${TMP}"` **unquoted** where its
siblings in `lake-cache.sh` write `'$tmp'`; `TMP` comes from `mktemp -d` so it
cannot carry a space today.

## The hole is in the TypeScript I/O layer, and it is a WRITE primitive

`paperId` is an externally supplied identifier used directly as a **path
segment**, with no validation, in three independent code paths. All three read
first-hand from `adapters/mcp-server/server.ts`.

| # | route | sink | primitive |
|---|---|---|---|
| 1 | `POST /api/import/arxiv` `{paperId}` | `uploadDir = join(UPLOADS_DIR(), id)` then `mkdirSync(recursive)` + `writeFileSync(join(uploadDir,"source.tar.gz"))` | **arbitrary directory creation and file write** |
| 2 | `GET /api/feedback?paperId=` | `readFeedback` → `feedbackPath` → `join(base, paperId, rootName + ".ts")` | **read outside the store** (`.ts` suffix constrains it) |
| 3 | `POST /api/feedback` | `writeFeedback` → `mkdirSync(join(FEEDBACK_DIR, paperId))` + `writeFileSync` | **write outside the store** (`.ts` suffix) |

`id = body.paperId || \`arxiv-${...}\`` — the fallback is sanitised, the supplied
value is not. `grep` for any validation of `paperId` across the file returns
nothing but its own uses.

**A fourth, different class at the same site.** `execSync("tar xzf source.tar.gz",
{cwd: uploadDir})` extracts a remote archive fetched from `arxiv.org/e-print/`
with no member filtering, no `--no-same-owner` and no post-extraction
containment check. GNU tar refuses `..` members, so the spelling attack is
covered by tar itself; a symlink member followed by a regular file of the same
name is not.

## The fix already exists in this repository, used by one file

`scripts/serve-rendering.ts` carries **`resolveWithin`** (lexical containment)
and **`resolveFile`** (the `realpath` half that catches a symlink) — with a
comment recording that its own test got **200** from the first version by
pointing a link inside the root at a file outside it. That is precisely the
residual class 4 has.

So this is not a missing idea. It is a **correct helper stranded in one script
while three HTTP handlers hand-roll `join()`**, which is the shape `1wef`
already paid for once: *"somebody had understood this hazard exactly. Nothing
checked it, so the correctness was one edit from gone."*

## What `paperId` needs is NOT `resolveWithin`

Worth stating because reaching for the nearest helper would be wrong.
`resolveWithin` takes a **URL path** and leans on the leading `/` to absorb
traversal. `paperId` is a **single identifier** meant to name one directory, so
the check is narrower and stricter: reject empty, `.`, `..`, anything containing
`/`, `\` or NUL. Two different questions, and collapsing them would make the
identifier check quietly accept `a/b`.

## What is already covered, measured — so consolidation does not re-solve it

- **Workflow expression injection**: `check-workflow-injection.ts` + baseline +
  2 test files (`1wef`). Thorough, with a demonstrated payload rather than an
  asserted one, and a three-band classification.
- **Staging slug sanitising**: `fuzm`, closed, with the guards above.
- **Translation pipeline**: `scripts/translation/translation_security.py`.
- **Render/XSS**: `q2wm`, `in-progress` and quiet 97 h — checked for liveness
  before this bean was written: one open PR names it, and that PR is #1347,
  which is this branch listing it as work still to come. Not a live claim.

**One latent gap in the injection gate's model**, recorded rather than fixed:
it classifies `steps.*.outputs` as **safe and does not report it**, but a step
output can CARRY free text. Measured on this corpus — every `>> $GITHUB_OUTPUT`
write of a reason or title is a literal, so the classification is true of this
repository today and is not a property of the class.

> **That measurement was too narrow and the conclusion it reached was wrong.**
> Re-measured 2026-09-26: it asked about a *reason* and a *title*, two members of
> the free-text band, while the third — a `workflow_dispatch` input — was the one
> being written. The laundering was **live**. See §"The `steps.*.outputs` box".

## Done when

- [x] A shared `safeSegment` / containment module exists, and `resolveWithin` is
      promoted out of `serve-rendering.ts` rather than copied — `src/core/safe-path.ts`,
      25 tests
- [x] All three `paperId` sinks validate before the path is built — **and a FOURTH
      was found unguarded after the first three were fixed**, see below
- [x] The tar extraction is contained, or its residual is written down where the
      call is — the residual was written down; it is now CLOSED instead, by a
      member-type whitelist
- [x] A gate finds an external value reaching a path join, so the property does
      not drift back — `scripts/tests/server-path-sinks.test.ts` (13 tests) plus
      `tar-member-guard.test.ts` (10, against real `tar`); 8 of the 13 fail
      against the pre-fix server, verified by reverting the file. Merged #1396
- [x] A `security` skill package exists and points at all of the above instead of
      the knowledge sitting in four unrelated files — **built by a sibling
      session**, 2026-09-26 10:34; extended here with today's findings
- [x] `steps.*.outputs` laundering is **fixed** on `1wef`'s gate rather than
      recorded — the gap was live, not latent. See below. PR #1408

## Re-measured 2026-09-26: three sinks were fixed and a fourth was missed

The helper landed and `feedbackPath`, `writeFeedback` and `/api/import/arxiv`
all use it. **Two routes were still unguarded**, which is this bean's own thesis
turned on its own fix — *"a correct helper stranded in one script while three
HTTP handlers hand-roll `join()`"*, one layer later.

### `/api/import/scan` — an arbitrary-file READ, two chained traversals

```ts
const uploadDir = join(UPLOADS_DIR(), body.paperId);   // (1) unvalidated
const metaPath  = join(uploadDir, "import-meta.json");
const meta      = JSON.parse(readFileSync(metaPath, "utf-8"));
const texFiles  = meta.files?.length ? meta.files : readdirSync(uploadDir)…;
for (const tf of texFiles) {
  const texPath = join(uploadDir, tf);                 // (2) unvalidated
  const src     = readFileSync(texPath, "utf-8");
```

`(2)` is the one that matters, because it **survives fixing `(1)`**:
`meta.files` is written by `/api/import/upload` from the uploaded file's own
name, so a member can name anything without any traversal in the identifier.
What leaks is constrained — only text matching a theorem-like environment is
returned — but `readFileSync` on an arbitrary path is a hazard in itself.

`(2)` is NOT a `safeSegment` case: a `.tex` may legitimately sit in
`sections/`, so the question is containment. Fixed with
`realPathWithin(uploadDir, …)`, which also subsumes the old `existsSync`.

### `/api/import/upload` — an arbitrary-file WRITE, and the worse of the two

```ts
const id = paperId || file.name.replace(/\.[^.]+$/, "")…;   // supplied value RAW
const filename = ext === ".pdf" ? "original.pdf" : file.name;
writeFileSync(join(uploadDir, filename), buf);              // path AND content attacker-controlled
```

The bean's own sentence — *"the fallback is sanitised, the supplied value is
not"* — was still literally true here after the arxiv route was fixed. And
`file.name` reaching `writeFileSync` is a write primitive with attacker-supplied
content.

**Severity is raised by the route's posture**: no authentication anywhere in
`server.ts`, and `Access-Control-Allow-Origin: *`. A cross-origin `FormData`
POST is a *simple* request, so the write lands whether or not the response can
be read.

Fixed with `safeSegment(rawId)`, `safeSegment(basename(file.name))` — `basename`
first because a browser may send a path, `safeSegment` after because
`basename("..")` is `".."` — and `writableWithin(UPLOADS_DIR(), target)` for the
symlinked-store case that `serve-rendering.ts`'s own test once got a 200 from.

### The gate, narrow form

`scripts/tests/server-path-sinks.test.ts`, 13 tests. **8 of them fail against
`origin/main`'s server and all 13 pass after**, verified by reverting the file
and re-running — so it detects the defect rather than describing the fix.

It is a SOURCE ratchet and says so: it cannot prove a value is checked on every
path to a sink, only that the guard has not been deleted. It asserts its own
non-vacuity (the file is >50 KB and contains the three route strings), because
a renamed server would otherwise make every `not.toContain` pass trivially.

Not done: the `security` skill package, the tar-extraction containment, and the
`steps.*.outputs` note on `1wef` — three separate boxes above, untouched here.

## The tar box, 2026-09-26 — the residual is closed rather than recorded

The extraction had already been hardened: `execFileSync` with an argv, a
`tar tzf` listing before extracting, `--no-same-owner --no-same-permissions`,
and a refusal for an absolute or `..`-bearing member. The comment at the call
named what remained honestly:

> what it does not cover is a symlink member followed by a regular file of the
> same name, which writes through the link

That is now closed, and two defects were found in the code that closed it.

### 1. A member-TYPE whitelist, because a link needs no bad name

Switched `tzf` to **`tvzf`** — the long listing carries the type in the first
character of the mode — and refused anything that is not `-` (regular) or `d`
(directory). Verified against a real archive: a symlink member lists as
`lrwxrwxrwx` and a hardlink as `hrw-r--r--`, and **both pass every name check**,
because the member is called `evil.tex`: not absolute, no `..`. The spelling
checks could never have caught it.

A whitelist and not a blacklist: enumerating the types to refuse admits the next
tar feature nobody thought of, and an arXiv e-print source has no legitimate
device, fifo or link member.

### 2. A refusal was being rendered as a non-event

```ts
} catch { /* tar extract failed — might be single file */ }
```

The `throw` for an unsafe member landed **here**, so an archive refused for
naming a path outside the upload directory fell through to "try as a single
`.tex`" with nothing logged. An operator could not tell a hostile archive from a
file that simply was not a tarball — two states collapsed into one, which is the
`ci-health` rule at a different layer. A distinct `UnsafeArchive` error now
answers **422** and logs; everything else still falls through, but says so.

### 3. My own parse was wrong, and only running `tar` showed it

The member name is everything after the **fifth** field. I wrote six, which ate
the first word of every name: `sub/a b c.tex` became `b c.tex`, so the
containment check would have run on a path that was never in the archive — a
guard reading clean while examining a fabrication. Caught by building a real
tarball with a space in a member name, not by re-reading the regex.

### The tests

`scripts/tests/tar-member-guard.test.ts`, 10 tests, and it **shells out to real
`tar`** rather than asserting source text, because the defect above was invisible
to any amount of source reading. It builds a benign archive, one with a symlink
and one with a hardlink, and asserts the whitelist refuses the latter two while
the name checks alone do not.

Its weakness is stated in its own header: the extraction logic is inline in the
server's `fetch`, so the predicates are restated in the test. It pins the RULES
against real tar; `server-path-sinks.test.ts` pins that the server still applies
them. Neither is sufficient alone.

## The `security` package box — a sibling built it; this extended it

`skills/conduct/security/` existed before I looked: `security.md`, `path-containment.md`,
`injection-boundaries.md`, manifest listing all three, created 2026-09-26 10:34
while I was sweeping stale PRs. **Eleventh near-duplication of the session, and
the first one caught by looking before building rather than after pushing.**

Its axis is better than the one I would have reached for: split on **where a
value crosses a boundary**, not on attack name, because an attack-name split
files one rule in three places — the same value at the same boundary is XSS,
traversal or command injection depending only on the sink.

What it could not contain was work done after it was written, so three of its
statements had gone stale in the hour between:

| it said | now |
|---|---|
| the path boundary is "guarded, not yet gated" | narrowly gated — `server-path-sinks.test.ts` |
| the archive boundary is "guarded at one site" | **closed** at that site by a member-TYPE whitelist |
| `..`-refusal is the residual, listed as open | closed, with the real `tvzf` listing showing why names cannot substitute |

A stale gap notice is worse than none — `AGENTS.md` says so about itself — so
those are corrected rather than appended to.

Added to `path-containment.md`, as the lesson rather than a longer list:

> **A fix aimed at the sinks an audit LISTED leaves the sinks it did not.** The
> bean that found the first three also wrote the helper, and the helper was
> correct, and the routes it did not name stayed broken.

plus the three specifics worth carrying — the sanitised fallback beside the
unchecked supplied value; `basename` AND `safeSegment`, in that order, since
either alone admits something; and a second traversal surviving the fix to the
first, because `meta.files` comes out of a file the upload route writes.

## The derived-artefact chain, again

Editing three skill BODIES staled six generated files. Ran the full chain —
`gen-skill-docs`, `gen-schema-docs`, `glossary:export`, `glossary:page`,
`docs:auto`, `docs:harness`, `gen:jsonld`, `kg:detangle`, `kg:audit` — and
`uml:overview:check` was STILL red. As on #1290, `bun run cat uml:overview` does not
clear it and `bun run cat-harness/scripts/gen-uml-overview.ts` does: 320 files.
**That is twice today the same gotcha cost a round**, and it is the #1348/#1365
shape in miniature — the chain is longer than the file list suggests, and the
`:check` variant is the only thing that says so.

## The `steps.*.outputs` box, 2026-09-26 — the gap was live, not latent

This box asked for a NOTE. Measuring first turned it into a fix.

`release-folio-assistant.yml` bound `github.event.inputs.version` to
`INPUT_VERSION`, read it as `"$INPUT_VERSION"` — correctly — and wrote it to
`$GITHUB_OUTPUT`. A later step then interpolated
`${{ steps.version.outputs.version }}` into

    mv *.tgz "folio-assistant-${{ ... }}.tgz"

so a dispatch of `1.0";id;"` renders `mv *.tgz "folio-assistant-1.0";id;".tgz"`
and runs `id`. `classify()` returned `null`, so the gate reported nothing. **The
step that handled the value correctly is the step that leaked it** — `env:`
protects the step that binds, never the value's onward journey.

### Why the first measurement missed it

It asked whether any `>> $GITHUB_OUTPUT` wrote a **reason or a title**. It did
not, and that was true. The free-text band has a third member, a dispatch input,
and that was the one being written. **A measurement scoped to the instances an
audit happened to name is exactly as narrow as a fix scoped to them** — which is
this bean's other lesson, from `path-containment`, on the same day. Two sinks
missed there, one band member missed here, same shape.

### And it was already written down

`skills/conduct/conduct-core/untrusted-input.md` §"What counts as attacker-controlled" has
listed *"anything derived from them — including a `steps.*.outputs.*` that merely
passed one through"* since 2026-09-18, with a measured example from this corpus.
The gate was written 2026-09-22 classifying `steps.*.outputs` safe
unconditionally. So this is `1wef`'s own lesson one turn further round —
*"somebody had understood this hazard exactly, nothing checked it"* — except that
here the thing that failed to check it **was the check**. When a gate and a skill
disagree, one of them is a claim nobody tested.

### What landed

`resolveProvenance` reads each step that writes `$GITHUB_OUTPUT`, takes the worst
severity among the expressions it binds, and a consumption of that output
inherits it — keyed `job.stepId`, since step outputs are job-scoped and two jobs
may reuse an id. A job's `outputs:` block is followed one more hop, in a second
pass, because `outputs:` conventionally sits above `steps:`. A finding names the
producer, since the failing line's own expression looks harmless.

A value bound ABOVE the step that writes it out — a workflow-level `env:`, in
scope for every step, or a job-level one — is folded in too, in the same post-pass
and for the same ordering reason. **It changes nothing on this corpus**: no such
binding carries free text here, and none carries a constrained value that was not
already counted through the step itself. So it is closed on the strength of four
tests rather than of a finding, which is the point — recording it as "true today"
is the exact mistake the rest of this section is about.

Graded **free text, not constrained**, deliberately: `feature-staging.yml`
reduces its slug to `[A-Za-z0-9._-]` with a `sed`, so that value cannot carry a
payload — and recognising it would mean the gate deciding per site whether
somebody's sanitiser was good enough. Refuse the shape, as the archive guard
whitelists member types. Four sites took the one-line `env:` remedy, three of
them slug consumptions whose own comments called the slug safe **because it was
sanitised — in another step, by a `sed` nothing checked**.

Verified: 4 free-text findings against the pre-fix tree (`git show HEAD:` into a
temp dir), 0 after; **15** producers over the real corpus, 10 carrying free text,
asserted as a test — an empty provenance map would return every step output to
the safe band and the gate would go green **having asked nothing**.

> **That count was 13/9 in the first commit and in #1408's body, and it was
> measured before the job-output ordering fix landed.** `lake-cache-refresh.yml`
> declares `outputs: matrix:` and `packages:` ABOVE its `steps:`, so the
> single-pass resolver read them while `setup.read` was still unknown and
> recorded neither. The failing test caught the bug; the census had already been
> quoted. A number measured against an earlier build of the thing being measured
> is not a smaller number, it is a different question.

Out of scope and written down rather than silently skipped: `actions/github-script`
`script:` blocks are JavaScript and unread, and `feature-staging.yml` has two
`const slug = '${{ steps.slug.outputs.slug }}';`. Both values are
character-class constrained, so neither closes that string today. Split into bean
`j0zs` rather than absorbed here — the question is whether the gate should read a
second language, which is a decision about its scope, not a missed sink.

## Closed 2026-09-26 — merged as 93431bfc6f (PR #1408)

All six boxes, with the last two done in this session:

- the gate (`server-path-sinks.test.ts` 13 tests + `tar-member-guard.test.ts` 10
  against real `tar`; 8 of 13 fail against the pre-fix server)
- `steps.*.outputs` — asked for a NOTE, delivered a FIX, because measuring first
  showed the laundering was live rather than latent

Evidence, not authorship: the merge commit carries `resolveProvenance`, the four
`env:` bindings, the tests and the skill text. Verified before merge: 4 free-text
findings against the pre-fix tree and 0 after, 15 producers over the real corpus
(10 carrying free text) asserted as a test, 22 injection tests green.

Split out rather than absorbed: `j0zs` (should the gate read `script:` blocks —
a scope decision, not a missed sink) and `9x01` (a page claiming a locale with no
file behind it).
