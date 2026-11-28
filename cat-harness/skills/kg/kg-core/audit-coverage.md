---
name: audit-coverage
description: >
  Which audits reach which KIND of node, measured rather than inferred. Read
  before concluding that a corpus is unaudited, before writing a criterion for
  one, and before building any coverage report — the gate half must be declared,
  an undeclared declarer is counted, and the stored record holds the relation
  rather than the census.
user_invocable: true
---

# Audit coverage — measured, with denominators

**A sidecar count is a fine measurement of sidecars and says nothing about
gates.** That sentence is the whole skill.

Run `bun run cat audit:coverage` before saying a corpus is unaudited, before writing
a criterion for a kind, and before building any coverage report of your own.
It measures **audits**; `node-views:report` measures **views** (an IRI, a `.jsonld`, a page and a row per node).

---

## A zero sidecar count is not "unaudited"

`kg-qa` sidecars measure `kg-audit`'s criteria exactly, and `KG_SUBJECT_KINDS`
has no `bean` — so zero sidecars over the work item store is the right answer to
*"how many criteria reach this kind"* and no answer at all to *"is this kind
audited"*: the `check:bean-*` gates, `check:ready-to-close`,
`check:stale-paths` and `check:harness-dirs` audit work items. This is
[`covered-is-not-reachable`](../../tools/folio-core/covered-is-not-reachable.md)
one level out: **coverage is a relation between an instrument and the question
it was built for**, and the signal in reach is rarely the signal you need.

**It is not a second answer to `check:kind-validators`.** That asks whether a
kind can be *typed* — does it have a validator that loads. This asks who
*judges* it. A kind can be perfectly typed and audited by nothing, and a
validator sweep reports it as covered.

---

## The gate half is DECLARED, never inferred

A gate names the kinds it covers in its own module docblock:

```
 * @covers bean-defs, beans
 * @covers none — .github/workflows/ is not a declared graph typology
 * @covers computed — it sweeps whichever kinds declare `nodeSchemas`
```

The tempting alternative is to infer it: grep each gate's source for a kind's
name or its declared directory. **It fails in both directions at once.** A gate
that mentions `beans/defs/` in passing scores as auditing work items; a gate that
resolves its directory through `directoriesForGraph` names no path and scores as
auditing nothing. Both answers wrong, neither *looking* wrong:
could-not-determine rendered as clean
([`directory-conventions`](directory-conventions.md)).

### Five states, because three real gates cannot use a static list

| state | what it means |
|---|---|
| `declared` | names its kinds |
| `none` | has **decided** it audits no declared graph — `check:workflows` reads `.github/workflows/` |
| `computed` | derives its set at run time — `check:kind-validators` sweeps whatever declares `nodeSchemas`, so a literal would go stale silently |
| `no-script` | `bun test`, `eslint`, `tsc` — nothing here to annotate |
| `undeclared` | **has not said** |

`none` and `undeclared` are different facts and collapsing them would leave a
gate that genuinely audits no graph with silence as its only honest answer.
`computed` exists because writing today's answer as a literal is the snapshot
`BASE_GRAPH_TYPOLOGIES`' own doc refuses for counts in prose.

**An undeclared gate is counted and printed, never zero**, and every "unaudited"
verdict is stated as an **upper bound** while any remain. That is
`check:kind-validators`' state 2, for its reasons.

All gates declare, so `audit:coverage:require-all` is wired in CI and the
findings are verdicts rather than bounds. The flag is what keeps it closed: a
new gate arriving undeclared turns them back into an upper bound, silently,
unless something fails. The output still states the caveat whenever the count
is non-zero, because the day it reopens is the day a reader needs to be told.

### When you cannot tell, do not annotate — and then go and read it

**A fabricated `@covers` credits a kind with coverage nobody checked.**
Under-claiming is recoverable — the count says so out loud. Over-claiming looks
like coverage. To resolve an undeclared gate, read its **scan set**, not its
title: `check:retired-front-matter` is `computed`, because its set is
`kgRoots(instance)` plus the undeclared `.claude/skills/` convention; and
`check:agents-claims` covers `code`, not `docs`, because it grades the symbols a
prose claim names while `AGENTS.md` itself is a node of no declared graph.

---

## Four states per kind, and a single zero cannot tell them apart

| state | what it means | the case that earns the name |
|---|---|---|
| `no-directory` | no layer declares one of this kind | `bean-defs`, declared inside `beans/beans.json`, reached through its parent — and carrying gates |
| `empty` | a directory exists and holds nothing | a determined empty |
| `typed-only` | a declared validator TYPES its nodes; nothing judges them | none here |
| `unaudited` | files, and nothing at all — not even a validator | none here |

`bean-defs` is why the first state is not a gap: it has coverage and no
directory of its own. A report that printed `0` for its directory count and left
the reader to infer would have manufactured a finding.

So every row prints all four counts and **names its state** rather than leaving
it to be read off a zero.

### `typed-only` is a finding, and that is the whole reason it exists

A kind whose validator `check:kind-validators` parses its nodes against looks
unreached, because that gate declares `@covers computed`, which this report
counts as neither coverage nor gap. Do not call it covered. `--strict` fails on
`typed-only` as its own family, because typing is not judging — a kind can
parse perfectly against its schema while nothing has an opinion about what it
*says*.

What the state buys is telling two different pieces of work apart: *a schema
parses these nodes and no criterion reads them* is not *nothing whatsoever
reaches this kind*.

`check:harness-state` carries one family per kind, and `--strict` is green and
wired in CI. The state stays, because the next kind to arrive will pass through
it — and the flag is what stops it resting there.

### A validator must reach the nodes that are produced

- **A kind's `schema` must point at the module that holds its shape**, not the
  one that holds its path. A pointer to where a fact is **not** written is worse
  than none: a reader who follows it concludes the shape is undeclared on
  purpose.
- **Every writer stamps `$schema`.** Consumers route a node by its tag and skip
  a file that has none, so a writer that omits it leaves only hand-written
  files validated. **A validator over the nodes nobody produces is not
  coverage.**
- **An untyped node read by a shell script degrades rather than fails**: a jq
  failure branch prints a line nobody acts on. That is why `interaction` and
  `issue-marks` declare validators.

---

## Three rules for building any coverage report

### A measurement must not be a term in itself

If the report's own sidecar lives in a graph it counts, writing it changes the
next run's answer, and the gate is satisfied only by running the writer twice.

Exclude your own output, **derive the path from the constants that write it** so
a relocation cannot leave the exclusion pointing elsewhere, and test that one run
converges.

### Store the RELATION, print the census

The record is stored on the `qa-reports` branch keyed by commit. Do not record
`files` and `sidecars` in it: a writer in one graph would turn another graph's
coverage gate red, and a file count that moves whenever anybody adds a page
makes the gate **stale by default** — one people learn to regenerate without
reading.

What belongs in the sidecar is what defines coverage: declared directories,
criteria reaching the kind, gates declaring it, the state. Those move when
coverage moves, which is when a reviewer needs the diff. One bit of the census —
`hasFiles` — is all the states need. Recording a count would make the report
depend on the signal it exists to replace.

### A docblock that documents a tag necessarily contains the tag

`coversIn` read `audit-coverage.ts`' own worked examples of `@covers` as
declarations, crediting the coverage report with auditing the work item store. Any
parser over docblocks has to tell a **use** from a **mention**, and indentation is
the distinction JSDoc already provides: `^ \* @covers `, exactly one space either
side of the star.

---

## What `--check` fails on, and what it does not

`--check` **computes and judges, and writes nothing**. It fails on a finding
that is **NEW** against a baseline — a kind that lost its audit, a gate that
stopped declaring, in the commit under review — and not on its own sidecar
being stale: derived QA results live on the `qa-reports` branch, so nothing
committed is left to be stale. The baseline is read with `--against <ref>` (a
`qa-reports` ref such as `main`). **A baseline that is not there is UNKNOWN** —
printed, never a pass, never a failure, because an unwritten baseline is not
this change's defect.

**A checker that mutates its own subject cannot be falsified** (red once, green
on the rerun, the file still stale), which is the one property
`generalise-the-fix` (opt-in `cat-harness.sdlc`)
Move 3 asks a guard to have.

**A kind whose directory is declared but absent from the checkout reads
`unknown`, not `empty`**: an absent answer is never printed as a determined
zero. A directory that declares `storage` reads `stored` instead: its files are
on the branch, fetch them with `bun run qa:fetch`.

The findings are reported and do not fail. `--strict` fails on an unaudited kind
and `--require-all` on an undeclared gate, for the day each gap is meant to close.
A gate that refused every push until somebody wrote criteria for `interaction/`
is a gate that gets switched off within a week.

## Adding a kind, or a gate

- **A new gate**: add `@covers` in the same change. If you cannot tell which kind
  its subject is, leave it off — the count is the honest answer.
- **A new graph typology**: it appears in the report the moment it is registered,
  because the denominator is the registry. Expect it to read `unaudited` until it
  declares a validator and `typed-only` until something judges it — and say in
  the sidecar why it needs nothing if that is the answer, never by letting the
  row read clean.
- **A relocation**: nothing to update. Directories resolve through
  `directoriesForGraph`.

## Related

[`covered-is-not-reachable`](../../tools/folio-core/covered-is-not-reachable.md)
is about a mechanism; this skill's subject is a **kind of node**, kept separate
because a skill that grows a second subject is split, not quieted.
[`artefact-reachability`](artefact-reachability.md) is about a kind of
artefact.
