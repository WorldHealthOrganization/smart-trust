---
name: methodology-adoption
description: >
  How a named external methodology enters the knowledge graph, and how an agent
  picks which one applies. Read before following a judgement method, before
  adopting a new one, and before writing a house method instead of adopting one.
graph-typologies:
  - methodology
---

# Adopting a methodology, and choosing between them

**A methodology is somebody else's work, adopted whole.** It is not a house
process with a citation bolted on. The graph carries them as a distinct kind so
that adopting one, replacing one and removing one are all ordinary operations.
Methodologies are parallel ways of achieving the same process, chosen by
context; each is formalised on its own and kept independent, so that other
skills can incorporate it as a sub-graph.

## Parallel, not composable

Two or more methodologies may answer the same question. **Do not blend them.** A
composite — this one's vocabulary, that one's record, a third one's filter — is a
house method that cites nobody, and it inherits none of their authority while
claiming all of it.

So: **pick one per decision, name it, and follow it.**

## Choosing which applies

### First: is this a judgement, or a process?

**Ask before the ladder.** The ladder below is about how to *decide* something;
a request for a change is not yet a decision but work needing agreed
requirements before anything is built. Sent down the ladder, it lands on the
catch-all rung and produces an options analysis for a question nobody has
framed yet.

> **Is somebody asking for a change, such that requirements have to be agreed
> before it is built?**

If yes, the question is **who is asking, and does the answer depend on what a
folio says?**

- **A change to the platform's own capability — a tool, a schema, a pipeline, a
  skill, a gate — raised by somebody building the tooling, whose answer does not
  depend on any folio's subject matter** → the software-development process
  methodology.
- **Requirements that come from stakeholders who must sign them off, tied to a
  folio's domain** → the stakeholder requirements methodology.

Both answer *request → agreed requirements*, so **they are parallel and must not
be blended** — the refusal below applies to this pair first and hardest. Which is
which is stated in each one's `applies-when`, not here, for the reason in
§"Why this skill does not name them".

If no — the change is agreed and the question is how to decide something within
it — continue to the ladder.

### Then the ladder

Ask in this order. The first yes decides.

1. **Do the criteria recur, with the same inputs having to produce the same
   answer?** → the computable methodology. A one-off tabled as if it recurs
   asserts a repeatability it does not have.
2. **Is the question the certainty of a body of evidence behind a
   recommendation?** → the evidence-grading methodology. Note this is about
   *evidence*, not about a design choice that happens to be uncertain.
3. **Is the context a work item recording a decision?** → the decision-record
   methodology. It constrains the record, not the method, so it composes with (1)
   or (4) rather than competing.
4. **Otherwise — a one-off choice among candidate options** → the
   decision-analysis methodology.

**If none fits, that is a finding, not a licence.** Say which question the
decision is and that no adopted methodology covers it. Do not improvise one and do
not stretch the nearest fit: either is how a house method gets in.

### Why this skill does not name them

Naming each methodology here would couple this skill to the set, and the set is
meant to be extractable: a methodology can be lifted out, or replaced, without a
prose edit here.

So the declared set is **the contents of the `methodology` graph**, read from the
layer's declaration. Ask for it; do not remember it.

## Node, skill, or both?

An adopted methodology can produce up to two artefacts:

| you are writing | it is a **node** in the `methodology` graph | it is a **skill** |
|---|---|---|
| what the method IS — its vocabulary, its constraints, what it refuses | ✅ | ❌ |
| how to PERFORM it here — the extension element, the gate, the procedure | ❌ | ✅ |
| a house process with no external origin | ❌ | ✅ — and do not dress it as an adoption |

**Most adoptions produce both, and the split is the same every time:** the node
is the method, the skill is this platform's application of it. The skill names
the node and does not restate it, because two files carrying one definition is
two copies free to drift.

Three worked cases:

- **`raci`** — both. The four letters and the one-Accountable rule are the
  method (node); reading R from the BPMN lane, the `cat-harness.processes:raci` element and
  `check:raci` are this platform's application (skill).
- **`crdm`** — both ([`methodologies/crdm.md`](../../../methodologies/crdm.md)).
  PHII's three concentration areas (Business Process Analysis, Business Process
  Redesign, Requirements Definition), the Business Process Matrix, swimlane
  Task Flow Diagrams, and PATH's activity-linked requirement structure are the
  external method (node, backed by `library/phii-2023-crdm`,
  `library/phii-2021-defining-and-validating-requirements-guide`, and
  `library/path-2012-common-requirements-mhis-crdm`); agentic facilitation,
  7-dimension code impact analysis, work-item decomposition, and pull-request
  merge sign-off are this platform's adaptation (`crdm-requirements-workflow`
  and `crdm-requirements-template`).
- **`swot`** — both.

**A methodology in use with no node is invisible to the graph**:
`check:methodology-evidence` and every other reader of the `methodology` graph
count nodes, not skills.

## Adopting a new one — the ingestion process

1. **Establish it is external and named.** A methodology has an origin: authors,
   a publication, a standards body. If it has none, it is a house process — write
   it as a skill and do not dress it as an adoption.
2. **Render it faithfully, and say where the rendering stops.** The file carries
   what the method says, not a summary of what we liked. Where this platform
   adopts part of a method and refuses part, **both halves are stated with the
   reason** — a silent omission misrepresents the standard.
3. **Declare its applicability.** `applies-when` in the front matter, phrased so
   the selection question above can reach it, and saying what it is *not* for.
4. **Place it by ownership, not by convenience.** A domain-neutral method belongs
   to the harness; a domain method belongs to the repo that owns the domain. The
   separation plan decides, and the placement must make extraction literal — the
   directory lifts out, its declaration entry goes with it, and nothing else moves.
5. **Declare the directory.** A methodology outside a declared directory is
   invisible to every tool that reads the graph.
6. **State its refusals.** The part of a method a platform must not do is as
   load-bearing as the part it follows, and it is the part a later agent will
   breach first.
7. **Ingest the source and cite it as `evidence`.** `origin` names the work;
   `evidence: library/<bib-slug>` points at a copy a reader can open from this
   checkout. Use [`literature-search`](../../../library/skills/library-core/literature-search.md) to find it and
   [`library-ingestion`](../../../library/skills/library-core/library-ingestion.md) to bring it in. Where the source
   cannot be fetched, that is an outcome to report — a located-but-unreachable
   document, never a missing one — and the node keeps its `origin` with no
   `evidence` until somebody closes the gap.

## Extract the PROCESS, not the paper's tools

**A source that presents a method through an implementation is presenting two
things, and only one of them is the methodology.** Render the method first,
*then* decide which tools — existing or to be added — this platform should use
to perform it. A node that adopted the source's tool stack would be adopting an
implementation and calling it a method, and it could never be falsified: the
tools would work and the method would never be examined.

`hybrid-llm-deterministic` is the worked case. Its source demonstrates the
method in one tool with one model and one expression language; the node renders
the rule/result inversion, the five safeguards and the bounded-truncation
technique, and §"Where this rendering stops" names every tool it declined to
adopt and why. The method survives replacing all of them, which is the test of
whether you extracted a method at all.

**Ask it as: what would still be true if they had built it differently?** What
survives is the methodology. What does not is their engineering, and it belongs
in the skill if anywhere — where this platform's own tool choices already live.

**And say what the source does NOT establish.** A demonstration is not an
evaluation. Where a paper shows an approach working once, with no baseline and
no measurement, the node records that no performance claim rests on it. Doing
otherwise manufactures a finding the authors did not make — the same failure as
§"Never quantify a judgement to make it look measured", arriving through a
citation instead.

## An origin nobody can open is not evidence

A methodology's justification is being somebody else's named, external work,
so its `origin` must resolve to a source a reader can open.

`bun run cat check:methodology-evidence` is the axis that makes this visible, and
`test/results/methodology-evidence.qa-results.json` is where it is recorded. It
**reports and does not gate** on a missing source: whether a methodology whose
source nobody can open may still be used is the owner's call, and a gate
failing on the whole corpus at once would be switched off. It does fail on
front matter that does not validate, and on an `evidence` pointing at a
bib-slug no library holds, because a citation that claims to resolve and does
not is worse than none.

**The evidence is an input to SELECTION, not only to adoption.**
`options-analysis.bpmn`'s `A_CheckEvidence` reads it before the chosen
methodology is applied. Adoption happens once; selection happens at every
decision, and a source can stop being reachable in between.

**A contested origin is recorded as contested.** `methodologies/swot.md` is the
worked example: the usual attribution is repeated everywhere and its own source
says no academic reference supports it, so the node declines to name an
inventor: flattening that into a fact would carry the authority of a citation
while resting on nothing.

## Refusals

- **Never blend two methodologies** into one procedure. Parallel means parallel.
- **Never adopt a methodology by naming it.** A citation with no rendered method
  is an appeal to authority that no reader can check.
- **Never quantify a judgement to make it look measured.** Where a method scores
  and sums, this platform adopts the structure and refuses the arithmetic: a total
  reads as a measurement, and the weights were invented. This is the same rule as
  never quoting a count from prose as though it were evidence.
- **Never let a rejected option go unrecorded.** Whichever methodology was used,
  the alternatives and why they lost are part of the output — the same argument
  `bean-coordination` makes for `scrapped` over deleted.
- **Never write a method from recall and cite a paper nobody fetched.** Read the
  source, or say you read it through another and mark each attribution
  second-hand. See [`literature-search`](../../../library/skills/library-core/literature-search.md) §"Never fill the
  gap with recall".
