---
name: swimlane-glossary
graph-typologies:
  - swimlane-glossary
---

# Swimlane Glossary Skill

## Role

Extract the personas a layer's BPMN diagrams put in swimlanes as a
SKOS concept scheme, and keep the retirement ledger that lets a dropped
term be told from an accident.

**Not the paper glossary.** `glossary-build` walks a
paper's blocks and writes a LaTeX chapter from `defines[]`. This walks a
knowledge graph and writes JSON-LD. Different corpus, different output,
different consumer. Whether they ever converge is undecided, so do not merge
them on your own initiative.

## When to invoke

- A user mentions: swimlane glossary, defined-terms index, SKOS concepts,
  `glossary-export`, the glossary ledger, retiring a term.
- After adding, renaming or removing a role in a layer's
  `scenarios/roles.json`, or a lane in any `.bpmn` under it.
- Before believing any count of "how many terms does this repository
  define" — the generator's report is the answer, never a number in prose.

## Tools

| Command | Purpose |
|---|---|
| `bun run cat glossary:export` | Build cat-harness's glossary → `_kg/`, and refresh its ledger |
| `bun run cat glossary:export:bootstrap` | The same for bootstrap, as a SECOND RUN |
| `bun run cat glossary:check` | CI gate — non-zero if the committed ledger is stale |
| `bun run cat glossary:check:bootstrap` | The same for bootstrap |

## A concept is a ROLE, not a lane name

There are far more lane names than roles, so a concept per lane name would
duplicate `roles.json`. Re-derive any count before quoting it:
`bun run cat check:lane-documentation` for the lane count,
`bun run cat glossary:export` for the rest.

`build-pipeline` is named many ways — *"CI/CD Pipeline"*, *"Scheduled log
sweep"*, *"Graph audit (system)"*, and more. A concept per lane name
would copy one authored definition onto each of them.

Those names are `skos:altLabel`. That is what `altLabel` is for, and it
is what makes *"Reviewer / SME"* findable as the same term as
*"Reviewer"* rather than a rival entry.

## Three predicates, three sources, and each answers a different question

| SKOS | source | answers |
|---|---|---|
| `prefLabel` | the **role's** `title` | what is this called |
| `altLabel` | every distinct lane name binding it | what else is it called |
| `definition` | the **role's** `description` | who is this persona, everywhere |
| `scopeNote` | the lane's `<bpmn:documentation>` | what is this lane accountable for **in this process** |

## `scopeNote` goes on the USAGE, never on the concept

A lane name that appears in several diagrams carries different
documentation in each, and should. Hanging those notes, unattributed, off one
concept asserts apparent contradictions about one word.

So each appearance is a `LaneUsage` node carrying the process, the label
that process gave the lane, and the note.

**The note is stored VERBATIM.** Lane
documentation is extracted to `.pot` as its own msgid, so a note stored
exactly as the diagram wrote it already has a translation slot in every
locale. Wrapping it — `In "<process>": <note>` — reads well in English
and produces a string no catalogue contains.

## Never mint a second name for one thing

A concept's `@id` is the IRI `kg-export` already mints for that role
(`makeIri(docIri, "role", id)`), imported rather than re-spelled. The
graph's `performedBy` links point at exactly those IRIs; a parallel
`cat-harness:reviewer` would leave the glossary unjoinable with the graph it
describes.

## The ledger is the memory, and it is the only durable part

The document is derived and rebuilt every run, so it has no memory:
delete a role and its concept simply stops appearing, which is what
*"never existed"* also looks like. Retirement and accident must not look
alike ([`deletion-requires-confirmation`](../../conduct/conduct-core/deletion-requires-confirmation.md)),
so the one non-derivable fact — **this term was once minted** — is
committed at `<instance>/glossary/glossary-ledger.json`, declared as
graph typology `swimlane-glossary` (`holds: "state"`; `glossary-terms`'
`glossary/` page reads this ledger as one source).

Three rules for it:

1. **Keyed on the IRI's local part**, never the absolute IRI. The
   publication base is a deploy-time variable; a stored absolute IRI
   would rot the day it moved and take every retirement record with it.
2. **An already-retired term keeps its own `retiredOn`.** Re-stamping it
   erases when the term actually went.
3. **A term that comes back is un-retired**, and reported. Leaving the
   flag on reports a live term as gone for ever.

**Usages are not ledgered**: a usage is an occurrence, regenerated
wholesale, while a concept is a term somebody may have cited; ledgering every
occurrence would bury the records that matter.

## Run it once per layer — never widen the scan

`--instance <root>`, the shape `kg-export` and `translate-bpmn` already
use. Widening cat-harness's scan to reach bootstrap's diagrams is the leak
`instance-graph-isolation.test.ts` exists to stop.

## What it reports and never acts on

- **Declared roles no swimlane draws.** They are still concepts —
  omitting them would leave the glossary silently short of the
  vocabulary it claims to index. The report says **which walk** found
  nothing ("no swimlane in `<instance>/` draws") and splits the list:
  a role a lane in ANOTHER layer binds (`partitionElementRef`) is named
  with that diagram (`drawnElsewhere`), apart from roles no diagram in the
  repository draws, because unsplit, a role drawn in another layer reads
  like one drawn nowhere: a fact about the walk phrased as a fact about the
  corpus. Reporting it is not widening the scan: nothing outside
  the layer is bound or emitted.
- **A lane binding naming a lane no diagram contains.** Distinct
  from a role whose lane exists but holds no task, which is not a defect.
- **A lane whose binding is dangling, contradictory or unbound.**

A lane declaring `<bootstrap.processes:role variable="true"/>` is none of these. It
emits a concept with a scope note and **no definition**, which is true —
see [`role-model`](role-model.md). `laneBinding()` is the
only route from a lane to a concept for exactly this reason: `variable`
must never be reachable as `unbound`.

## Related

- `glossary-build` — the paper glossary, a different
  mechanism on a different corpus.
- [`role-model`](role-model.md) — what a role is, and why a lane names a
  role rather than being one.
- [`directory-conventions`](../../kg/kg-core/directory-conventions.md) — why the ledger's
  directory is declared rather than hidden.
- [`deletion-requires-confirmation`](../../conduct/conduct-core/deletion-requires-confirmation.md) —
  the rule retirement implements.
