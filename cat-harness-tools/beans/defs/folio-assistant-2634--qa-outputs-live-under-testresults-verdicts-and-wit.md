---
# folio-assistant-2634
$schema: bean/1.0.0
title: QA outputs live under test/results/ — verdicts and witnesses both, by provenance
status: completed
type: task
priority: normal
created_at: 2026-09-19T07:11:55Z
updated_at: 2026-10-07T17:32:00Z
parent: folio-assistant-1swy
---

THE RULE, from the owner 2026-09-19: 'if the witnesses were generated as a QA reviewer primarily then it should be under test/results/ as part of a QA process.'

Placement follows PROVENANCE, not file family and not consumption. An artefact that is primarily the output of a QA review belongs under `test/results/`, whatever fetches it afterwards.

## What exists today, measured 2026-09-19 on main

| artefact | count | where | declared? |
|---|---|---|---|
| block verdicts `*.qa.json` | 122 | beside their blocks | no |
| KG verdicts `*.kg-qa.json` | 227, in 10 `kg-qa/` dirs | beside what they audit | no |
| witnesses | 134 | `docs/assets/qa/` | yes — `qa` graph kind |
| `*.script-qa.json` | **0** | — | documented in AGENTS.md; NONE EXIST |

The `qa` graph kind was added by a sibling on 2026-09-19 and covers the WITNESSES only. Its own comment draws the line it stops at: 'a verdict lives beside its subject and is what a checker wrote, while a witness is that verdict flattened for the web.' So 349 verdict files are committed and declared by nothing — the `dh4f` shape the same comment complains about for the witnesses.

## The finding that changes the shape

The kg-export diagnostics are NOT write-only. `scripts/kg-viewer.ts:573` reads `doc.undeclaredTerms` off the published document and renders it; `tests/kg-viewer.e2e.ts` asserts on it. So moving them out of the published graph needs a WITNESS projection, not just a delete. That is the verdict/witness split the `qa` kind already defines, so the direction fits the existing design rather than fighting it.

## Sequence — incremental, each PR revertible alone

Same reasoning bean `x3bd` gives for topical directories: prove the layout on one real case before 349 files commit to it.

- [ ] PR 1: declare `test/results/` as a `qa` directory; kg-export writes its diagnostics there as a verdict instead of into the published document; witness projection keeps the viewer working
- [x] PR 3 (#TBD): witnesses moved to `test/results/witnesses/`; published path unchanged
- [ ] PR 3: the 227 `*.kg-qa.json`
- [ ] PR 4: the 122 `*.qa.json`
- [ ] separately: `*.script-qa.json` is documented and has zero instances — decide whether the family is dead

## Done when

- [ ] every QA-review output resolves under a declared `test/results/` graph directory
- [ ] the kg-viewer still renders undeclared terms, from the witness rather than the document
- [ ] no QA artefact is committed-but-undeclared

---

## PR 1 done, 2026-09-19 — the declared home and its first tenant

**`test/results/` is declared as `qa-results`, holding the `qa` graph.**
Declared in `cat-harness.json` on the day the directory was created —
deliberately, because the 134 witnesses under `docs/assets/qa/` spent their
entire existence undeclared, which is the `dh4f` defect in reverse: committed
files no declaration mentioned, so a consumer scanning the declared directories
reported a clean run over the lot. The remedy is to declare a directory when
you make it, not when somebody notices. A test asserts both halves — declared,
AND present on disk, since `AGENTS.md` is equally clear that a
declared-but-absent directory is the original `dh4f`.

**A RESULT is a third thing, beside verdict and witness.** A verdict
(`*.qa.json`, `kg-qa/*.kg-qa.json`) and a witness (`docs/assets/qa/`) are both
per AUTHORED SUBJECT: one file answers "is this block, this diagram, sound". A
result's subject is a document the build just PRODUCED, and its findings are
whole-corpus — "these property names are undeclared across the graph", not
"this node is wrong". Filing that as a per-subject verdict would mean inventing
a subject that does not exist, so `qa-results/v1` is a new marker rather than a
reuse. Self-declaring, per the `$schema` convention: a directory is a place to
look and may hold more than one kind, so the file says what it is.

**First tenant:** `test/results/kg-export.qa-results.json`, carrying the four
diagnostics `scripts/kg-export.ts` computes — `undeclaredTerms`,
`undeclaredSchemaModules`, `danglingLinks`, `problems` — with the producing
script and its source hash. Measured on `main` at 2026-09-19: **total 2**, both
`undeclaredSchemaModules` (`schemas/carried-note.ts`, `schemas/memory.ts`).

**Written from the same values the document carries, not recomputed.** Two
renderings of one computation cannot disagree; two computations can. Same rule
`feature-staging.yml` follows when it copies the `.json` alias AFTER the
staging stamp, and the reason `stagingStamp` is one function. A test asserts
the committed result equals the export's own fields, so drift between what the
exporter computes and what was last written is caught rather than assumed.

### Why the document still carries the four fields

`scripts/kg-viewer.ts:573` reads `doc.undeclaredTerms` off the PUBLISHED
document and renders it; `tests/kg-viewer.e2e.ts` asserts on it. Removing the
fields now would take the viewer's panel with them. Pointing the viewer at the
published result is PR 2, and it is a browser-side fetch change that deserves
its own verification rather than riding along here.

That also corrects something I told the owner earlier: I described these four
as "a build report nobody reads". One of them has a live consumer on the
published site.

Verified: `bun test` 2171 pass / 0 fail, typecheck, `eslint .`, `kg:audit:check`
(exit 0), `kg:schema:check`, `check:harness-dirs`, `gen-skill-docs --check`,
`check:workflows`. Wrong-direction partition edges unchanged at 4; unassigned
edges back to `main`'s baseline of 15 after triaging the new module.

## Still to come

- PR 2: viewer onto the published result; drop the four fields from the document
- PR 3: witnesses from `docs/assets/qa/` to `test/results/`, docs-site fetch follows
- PR 4: the 227 `*.kg-qa.json`
- PR 5: the 122 `*.qa.json`
- `*.script-qa.json` is documented in `AGENTS.md` and `schemas/script-qa.ts` and
  has **zero instances** — decide whether the family is dead before migrating it

---

## PR 3 done, 2026-09-19 — the 134 witnesses moved

`docs/assets/qa/` is gone. The witnesses are committed under
`test/results/witnesses/` and **published** at `/assets/qa/`, which is the same
URL as before.

**Those are two different questions and only one of them was wrong.** Where a
witness LIVES follows provenance — it is `qa-witness.ts`'s projection of what a
checker found, so it belongs in the declared QA tree. It sat in `docs/` only
because that is where Jekyll could reach it, which is a fact about the build.
Where it is SERVED FROM was never the problem, so `data-qa-src` still says
`/assets/qa/…` and `docs-ui.js` is untouched. Moving the URL too would have
rewritten every badge in every generated page for no gain.

**Jekyll builds only `docs/`, so the publish step is load-bearing.** Both
`docs-site.yml` and `feature-staging.yml` now `cp -rT test/results/witnesses
./_site/assets/qa` after the Jekyll step. A test asserts BOTH carry it: missing
it in one publishes a site where every evidence link 404s, and an empty QA panel
looks exactly like "nothing has been audited" — the false pass the badges exist
to remove. Missing it in only one is worse, because the docs site and the
staging preview would disagree and the preview is where a reviewer looks.

**ONE declaration, not two.** The `qa-results` entry minted earlier today was
removed and the `qa` entry repointed to `test/results/`. Keeping both would
have nested a declaration inside a declaration — #263's own comment names that
defect: "a consumer scanning a declared directory cannot assume it owns what
lies beneath it". The two kinds under that one root are told apart by their
`$schema`, not their location: `qa-results/v1` and `qa-witness/v1`. The `qa`
ID survived the relocation, per the rule that ids are stable and paths are not.

**Found by moving:** `scripts/tests/qa-fixture.test.ts` read the corpus by
hardcoded path and went red — which is exactly what it was written for. Its own
comment: it exists so a broken corpus path says so "in `bun test`, which runs
everywhere, rather than in the browser job". It worked. Four more hardcoded
references followed in `tests/qa-panel.e2e.ts` and `tests/support/qa-fixture.ts`.

Verified: `bun test` 2174 pass / 0 fail, typecheck, `eslint .`,
`kg:audit:check`, `gen-skill-docs --check`, `agent-memory:check`,
`check:harness-dirs`, `check:workflows`.

**Not verified locally:** the Playwright e2e specs cannot run in this container
— it has `chromium_headless_shell-1194` and Playwright wants `-1228`, so
`a11y.e2e.ts`, which this change never touches, fails 24 times with the same
missing-binary error. CI runs them properly.

---

## PR 4 done, 2026-09-19 — the findings left the published graph

`undeclaredTerms`, `undeclaredSchemaModules`, `danglingLinks` and `problems`
are no longer published in `<stub>.jsonld`. They are a QA reviewer's findings
about the graph this run produced, and they now live only in
`test/results/kg-export.qa-results.json`.

**`publishedDocument(data)` is the projection.** `buildExport` still computes
everything — it has to, the result is written from it — and the CLI publishes
the projection. A test asserts the four are absent from the projection and
present in the result, so nothing can leave the document without arriving in
the result.

**What STAYS, and the line is not "everything diagnostic".** `counts` and
`repository` remain: neither is a finding. `counts` is what the graph CONTAINS,
which is how a consumer spots a truncated document; `repository` is provenance
sitting beside `sourceCommit`. `sourceCommitUnavailable` is the sharpest case —
it reads like a problem and is not one, because a tarball exports a complete
graph and simply cannot say which commit it came from. A reviewer's verdict
moves; a fact about the artefact does not.

**The `@context` terms went WITH the fields.** A context describes what its
document carries, so a term for a field nothing emits is a promise to answer a
question the document has stopped answering — worse than an undeclared term,
which at least fails loudly against `undeclaredRootTerms`.

### The viewer, and the state that had to stay distinct

`scripts/kg-viewer.ts` read `doc.undeclaredTerms ?? []` and rendered "Across
the graph: {n} such property names." Defaulting to `[]` would now print
**"Across the graph: 0"** over a document that never said so — a clean bill of
health nobody issued. `undeclared` defaults to `null`, and the cross-graph
sentence is omitted when the document reported no count. Absent and empty are
different answers.

A document from before this change, or from another instance, still carries the
field and still renders the count.

### Caught by the repo's own gates, not by me

- **The viewer's browser JS lives inside a template literal.** My comments used
  backticks and silently terminated it. `tsc` and `eslint` both caught it; I
  also now parse every `<script>` in the generated page with `new Function` as
  a check that the emitted JS is syntactically valid, which neither gate does.
- **A new translatable string must be in the table and in every locale stub.**
  `kg-viewer-strings.test.ts` caught the missing entry, then caught that the
  five `.po` stubs were one msgid short of the `.pot`.

**Tooling gap found:** `scripts/translate-kg-viewer.ts --extract` refreshes
every `.pot` and the manifests but does **not** sync the `.po` stubs, so a new
string leaves all five catalogues short and the failure surfaces only in a
test. Synced by hand here, preserving each header and every existing `msgstr`.
Worth its own bean.

Verified: `bun test` 2175 pass / 0 fail, typecheck, `eslint .`,
`kg:audit:check`, `check:workflows`, `check:harness-dirs`, `check:partition`,
`agent-memory:check`, `gen-skill-docs --check`, `translate-kg-viewer:check`.

---

## PR 5 done, 2026-09-19 — the 227 KG verdicts

All 227 `*.kg-qa.json` moved from `kg-qa/` directories beside their subjects to
`test/results/kg-qa/`, in a tree that **mirrors each subject's path**.

**The mirroring is not tidiness — flat would have destroyed four verdicts.**
`kg-audit.ts` had recorded the risk in a comment ("one shared directory would
collide two packages' skills of the same name") and kept the sidecars beside
their subjects because of it. Measured before moving anything: **four sidecar
basenames already occur twice** — `editor`, `getting-started`, `idle-backlog`,
`l2-dak-authoring`. Flat, four verdicts would have silently overwritten four
others. The move script asserted injectivity (227 sources → 227 distinct
destinations) BEFORE touching a file.

**This is the first PR in the sequence where the AUDITOR changed, not just the
files** — and it turned up the defect worth the most here. The path was
composed in TWO places: `kg-audit.ts` wrote it, and
`content/pipeline/qa-witness.ts` read it, independently. Two spellings of one
concept, agreeing only because neither had changed — and this move is exactly
the change that would have made them disagree. A reader looking where nothing
was written finds nothing and reports the subject as **unaudited**, which is a
false pass, not an error. `kgQaSidecarPath` in `schemas/kg-qa.ts` is now the
one answer, and both call it.

`repoRoot` became a **required** parameter of `sidecarPaths` rather than
defaulted: a default would let a caller that forgot it resolve to a plausible
wrong tree, which is the same false pass by another route. The three families
that do not need it pay one argument, which is the cheaper mistake.

**Proof the writer agrees with the move:** after `git mv`, `bun run cat kg:audit`
produced **zero untracked files**. Had the auditor's computed path differed
from where I put them by even one segment, 227 new files would have appeared
beside 227 orphans.

### Found by the move, exactly as designed

`schemas/kg-qa.test.ts` hardcoded three old roots with `.filter(existsSync)`,
so the move emptied its file list — and its own `there are some` guard fired.
That guard exists precisely to stop the suite reporting a clean run over
nothing. It now walks the results tree recursively from `KG_QA_RESULTS_DIR`,
so the roots cannot drift again.

Four `qa-witness` fixtures built `kg-qa/` siblings by hand; they take the path
from the shared function now, so a fixture cannot drift from what the auditor
writes.

**Docs moved with the wiring**, per this repo's own rule: `cat-harness.json`
(both the `cat-harness` and `qa` entries), `skills/sdlc/sdlc-core/qa-witness.md`
plus its generated mirror and sidecar, and `AGENTS.md`. One `kg-qa/` mention
stays in `AGENTS.md` and is correct — it is past tense, about 25 bogus sidecars
that *were* written beside memory nodes.

Verified: `bun test` 2175 pass / 0 fail, typecheck, `eslint .`,
`kg:audit:check`, `check:workflows`, `check:harness-dirs`, `check:partition`,
`agent-memory:check`, `gen-skill-docs --check`.

## Remaining

- the 122 block verdicts `*.qa.json`, which still sit beside their blocks

---

## The case I made for stopping here — OVERRULED, see below

**I recommended the 122 block verdicts `*.qa.json` stay beside their blocks. The owner said move them.** Investigated
before writing anything, on the owner's instruction; the evidence says moving
them costs more than it buys, and most of the cost lands in other people's
repositories.

### 1. Nine path sites, and they are an IDIOM rather than a lookup

The KG case had exactly two — one writer, one reader — which is why unifying
them on `kgQaSidecarPath` was clean and strictly reduced drift. The block
sidecar path is composed independently in at least nine places:

| site | how |
|---|---|
| `content/pipeline/qa-sweep.ts:379` | `block.root + ".qa.json"` |
| `content/pipeline/qa-merge-findings.ts:174` | `rootAbs + ".qa.json"` |
| `content/pipeline/qa-staleness.ts:108` | `block.root + ".qa.json"` |
| `content/pipeline/qa-utils.ts:1051` | `root + ".qa.json"` |
| `content/pipeline/q-usage-audit.ts:272` | `b.ts.replace(/\.ts$/, ".qa.json")` |
| `content/pipeline/q-usage-audit.ts:423` | same |
| `content/pipeline/proof-narrative-lean-equiv-sweep.ts:501` | `block.root + ".qa.json"` |
| `content/pipeline/qa-witness.ts:276` | `join(dir, stem + ".qa.json")` |
| `content/pipeline/validate.ts:137` | suffix scan + `<base>.ts` adjacency |

They are not nine arbitrary duplications; they are nine expressions of one
rule — **the sidecar IS the manifest's path with the extension swapped**.
Centralising that is possible, but it replaces a convention every reader
already understands with an indirection, in folio-side code.

### 2. Adjacency is LOAD-BEARING, not incidental

`validate.ts`'s `no-orphan-sidecar` asks one question: does `<base>.ts` exist
in this same directory? That catches a specific real failure — a block moving
between chapters picks up a fresh sidecar at its new path while the old one
stays behind, holding verdicts computed against content that has since
changed. The comment records it measured in `qou`: **18 orphans, 5 of them
from moves.**

Move the verdicts into a mirrored tree and that check does not merely need
rewriting — the failure it detects becomes HARDER to see, because the results
tree would hold two entries with no local signal that one is dead. This is the
one place in the whole migration where relocation reduces a safety property
instead of a drift hazard.

### 3. It is folio-side code, and 122 is not the population

All 122 here sit under `content/docs/` — this platform's own documentation
blocks. But `qa-sweep` and `sidecarPaths` are generic: a downstream folio's
committed `*.qa.json` sit beside ITS blocks. Flipping the path in the platform
makes every existing folio's verdicts invisible at once, and every block then
reads "unaudited" — a false pass at corpus scale, in exactly the direction
this repository keeps guarding against.

### The distinction worth keeping

For the KG verdicts, moving REMOVED a drift hazard: two path computations that
agreed only because neither had changed, and were about to. For the block
verdicts, moving would CREATE several and break a check that has already
caught real bugs. "Placement follows provenance" still holds as a rule — this
is where applying it literally costs more than the rule is worth, and the
reasons are measurable rather than aesthetic.

**If this is ever revisited**, the cheapest safe route is a compatibility read
(results tree first, beside-the-block as fallback) rather than a flip — and
that is a dual-path contract the platform then owns indefinitely, which is its
own cost to weigh.

---

## OWNER'S DECISION, 2026-09-19 — move them, and resolve each site properly

> *"move the 122 manually ... dispatch agent swarm ... to resolve each properly"*

The analysis above is kept as the RISK REGISTER, not as a verdict. Every item
in it is still true and is now a thing to get right rather than a reason not to
proceed:

- **nine path sites** — each resolved deliberately, not sed-replaced;
- **`no-orphan-sidecar` depends on `<base>.ts` adjacency** — the check must keep
  catching the block-moved-and-left-a-stale-verdict case it was written for
  (18 found in `qou`, 5 from moves), or the move has removed a safety property;
- **folio-side contract** — a downstream folio's verdicts sit beside its blocks,
  so the platform must not blind them the day this lands.

"Resolve each properly" is the instruction that makes this different from the
227: those moved under one shared path function because there were two sites.
Here each of the nine is read on its own terms and fixed on its own terms.

Status reopened; the bean is not done until the risk register above is
discharged item by item.



## Claim released 2026-09-29

Released `in-progress` → `todo` on the owner's instruction (review session https://claude.ai/code/session_014Qj8wncQhqV52QGN1yZDnj). No git change to this bean since before 2026-09-26, no holder recorded, and no open working branch touches it; the sessions that held theme B (CI reliability, QA instruments, process) work stopped on the 2026-09-25 weekly usage limit. Nothing in the body was changed: re-claim with `bun run cat beans:claim <id>`.

## Completed on landed evidence
Landed on main in PR #263 (Declare the work-plan directories in agent-harness.json, not harness.config.json).
