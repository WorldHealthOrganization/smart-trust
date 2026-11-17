---
$schema: folio-methodology/v1
name: prov-o-provenance
title: PROV-O — the record of who did what, in which role, under which plan
origin: >
  W3C, "PROV-O: The PROV Ontology", W3C Recommendation 30 April 2013
  (http://www.w3.org/TR/2013/REC-prov-o-20130430/), editors Timothy Lebo,
  Satya Sahoo and Deborah McGuinness, for the Provenance Working Group. It is
  the OWL2 encoding of the PROV Data Model (PROV-DM), which is cited by it and
  not held here.
evidence:
  - library/w3c-2013-prov-o
  - library/w3c-2024-prov-jsonld
applies-when: >
  **Recording, after or as it happens, what was done — which activity ran, which
  agent was responsible for it, in which role, following which plan, and what
  it read and wrote — in a form another system can read without knowing this
  one.** Here that is the log of every BPMN task run, which the QA/QC
  after-check grades against policy, and the derivation and alternate-of links
  on the published knowledge graph. It answers *what happened and who answers
  for it*. It does NOT answer whether the action was permitted (that is the
  ODRL policy the record points at), how to decide anything (`kepner-tregoe`,
  `dmn`), or who should be involved in a task before it runs (`raci`).
---

# PROV-O: provenance as a shared record, not a house log format

**Adopted 2026-09-23** (issue #1180), on the owner's choice of *"W3C ODRL 2.2
and W3C PROV-O for logging"* (quoted in `cat-harness/schemas/content/prov.ts`). This
node was written 2026-10-01, after the Recommendation was ingested, so that the
held source is cited by the node that rests on it.

## Its sources: what is held, what is not

| source | held | what this node takes from it |
|---|---|---|
| PROV-O, W3C REC 2013-04-30 | ✅ `library/w3c-2013-prov-o` | the classes and properties used, read from §2–§4 |
| PROV-DM (the data model PROV-O encodes) | ❌ not held | nothing directly; every term below is read from PROV-O's own definitions |
| PROV-JSONLD, W3C Member Submission 2024-08-25 (Moreau & Huynh) | ✅ `library/w3c-2024-prov-jsonld` | the JSON-LD shape and context PROV is emitted in — adopted by owner decision 2026-10-01, because W3C publishes no JSON-LD context for PROV-O; a Submission is acknowledged, **not endorsed**, by W3C. Held page by page (the print has no outline) |
| ODRL 2.2 (the policy a record points at) | held as `library/w3c-2018-odrl-model-2-2`, **not** this node's source | the permission half; not adopted here |

**Limits of the held copy, from its own `licence.json`:** it is the Working
Group's publication snapshot printed to PDF offline, *"not compared byte for
byte"* with the copy on w3.org, and *"Errata published after the REC are not
included."* The section split is the PDF outline's, and it does not line up
with the spec's numbering everywhere — so citations below give the spec's
section or entry number **and** the held file. The OWL profile (Appendix A) was
not read for this node, so no cardinality claim here rests on it.

## The load-bearing idea, in the Recommendation's words

> "It provides a set of classes, properties, and restrictions that can be used
> to represent and interchange provenance information generated in different
> systems and under different contexts. It can also be specialized to create
> new classes and properties to model provenance information for different
> applications and domains." — Abstract (`sections/sec-002-abstract.md`)

> "The namespace for all PROV-O terms is http://www.w3.org/ns/prov#." — Abstract

The terms come in three tiers. Starting Point terms *"are used to create simple
provenance descriptions that can be elaborated using terms from other
categories"*; Qualified terms restate *"an unqualified influence relation by
using an intermediate class that represents the influence between two
resources"*, which *"can be annotated with additional descriptions"*
(§2 and §3.3; `sections/sec-013-…md`, `sections/sec-015-33-qualified-terms.md`).

The one qualified class this platform depends on, defined:

> "An activity association is an assignment of responsibility to an agent for an
> activity, indicating that the agent had a role in the activity. It further
> allows for a plan to be specified, which is the plan intended by the agent to
> achieve some goals in the context of this activity." — §4.3, entry (51)
> `prov:Association` (`sections/sec-018-43-qualified-terms.md`)

And why a plan belongs in the record at all:

> "Representing the plan explicitly in the provenance can be useful for various
> tasks: for example, to validate the execution as represented in the
> provenance record, to manage expectation failures, or to provide
> explanations." — §4.3, entry (52) `prov:Plan` (same file)

That sentence is the QA/QC after-check, stated by the standard.

## What this platform adopts

| term (tier) | used for | where |
|---|---|---|
| `prov:Activity` (starting point) | one per BPMN task run | `cat-harness/schemas/content/prov.ts` `ProvActivitySchema` |
| `prov:startedAtTime`, `prov:endedAtTime` | the history entry's time; end optional, never before start | same, `.refine` |
| `prov:qualifiedAssociation` → `prov:agent` | the actor that performed the task | same, `ProvAssociationSchema` |
| `prov:hadRole` | the role the BPMN lane binds | same |
| `prov:hadPlan` | the BPMN task, written `<process>#<task id>` (`PLAN_REF`) — a task is *"a set of actions or steps intended by one or more agents"* (entry (52)), so no term is minted | same |
| `prov:used` | the content a step acted on | the tools layer's `src/workflow/prov-record.ts` |
| `prov:Entity`, `prov:wasDerivedFrom` | the exported graph is an Entity derived from its source commit | `cat-harness-tools/scripts/kg-export.ts`; also `derivedFrom` in `cat-harness/schemas/kg/jsonld.ts` |
| `prov:alternateOf` (expanded) | a preview graph → the canonical one: *"Two alternate entities present aspects of the same thing"* (§4.2, entry (20), `sections/sec-017-…md`) | `cat-harness-tools/scripts/kg-export.ts`, chosen over `owl:sameAs` because sameAs would merge their statements |

**One extension, by the route the Abstract allows** ("specialized to create new
classes and properties"): `cat-harness:underPolicy`, the ODRL policy uid(s) a
run was under. `schemas/content/prov.ts` calls it *"the one non-PROV term"*. It is in the
`cat-harness:` namespace, never in `prov:`.

## What it refuses, with reasons

1. **No invented agent or role.** `ProvAssociationSchema` requires both
   `prov:agent` and `prov:hadRole`; a step with no actor, or in a lane binding
   no role, gets **no** activity and a `no-actor` / `no-role` finding instead
   (`cat-harness-tools/scripts/prov-qaqc.ts`, `prov-record.ts`). This is stricter
   than the standard, deliberately — the code records the owner's 2026-09-24
   *"Keep required"*. Filling the field to satisfy the schema is the
   fabrication the report exists to catch.
2. **A refused step is not an activity.** `provActivityFor` returns nothing
   unless the verdict allowed it: *"it did not happen."*
3. **Provenance is not permission.** Whether an activity was allowed is ODRL's
   question; the record only names the policy. The after-check re-runs the
   before-check (`authorizeTask`) rather than encoding a second rule.
4. **Not adopted:** the rest of the qualified pattern (`prov:Usage`,
   `prov:Generation`, `prov:Delegation`, …), `prov:Bundle`, invalidation, and
   the agent subclasses `prov:Person` / `prov:SoftwareAgent` /
   `prov:Organization`. The proposal `cat-harness/docs/proposals/odrl-prov-actor-model.md`
   §2.1 maps actor kinds onto those subclasses; no `.ts` or actor `.json`
   outside the library emits them (searched 2026-10-01), so that half is
   proposed, not adopted.

## Where the platform's rendering departs from the held text — found, not fixed

Recorded so the next reader does not mistake them for adoption decisions:

- **`PROV_CONTEXT` names the wrong namespace.** `schemas/content/prov.ts` exports
  `"http://www.w3.org/ns/prov-o"`; the Abstract says `http://www.w3.org/ns/prov#`.
  Nothing imports it — the emitters use the correct `PROV_NS`
  (`prov-qaqc.ts`, `schemas/kg/jsonld.ts`, `kg-export.ts`) — so it is latent.
- **`prov:actedOnBehalfOf` is allowed on an Activity.** `ProvActivitySchema`
  accepts it there; §4.1 entry (12) gives it *"has domain prov:Agent / has
  range prov:Agent"* (`sections/sec-016-41-starting-point-terms.md`). Neither
  writer emits it today, so no published record is wrong yet.
- **Object properties written as plain strings.** The `.prov.jsonld` context in
  `provDocument` (`prov-qaqc.ts`) maps `prov:` but does not coerce
  `prov:agent`, `prov:hadRole` or `prov:hadPlan` to `@id`, so a JSON-LD
  processor would read their values as literals, where the held text marks all
  three `op` (object property). **Measured 2026-10-01** by expanding a committed
  report with jsonld.js: all three, and `prov:used`, come out as `{"@value": …}`
  in all 100 activities of the 9 reports. Owner decision the same day: emit PROV
  in PROV-JSONLD's shape, whose held context coerces `agent`, `role` and `plan`
  (§5.8, `sections/page-037.md`), with each value at its node's release
  address. The rules this broke are now the `linked-data` voice
  (the content core's `skills/voices/linked-data/voice.json`), which a coding
  agent authoring or reviewing JSON-LD-emitting code is held to.
- The association node carries no `@type: prov:Association` and the unqualified
  `prov:wasAssociatedWith` is not asserted beside it, as the §4.3 entry (51)
  example does. Both are inferable from the range of `prov:qualifiedAssociation`,
  so this is a reading convenience lost, not a meaning.

## Where it runs

- `cat-harness/schemas/content/prov.ts` — the adopted subset, as Zod.
- the tools layer's `src/workflow/prov-record.ts` — the engine writes the activity as
  each step is recorded (`InstanceState` history `prov`, `src/workflow/instance.ts`).
- `cat-harness-tools/scripts/prov-qaqc.ts` — the after-check: derives or reads each
  activity, re-runs `authorizeTask`, writes `docs/assets/prov/<instance>.prov.jsonld`
  and the `/prov-qaqc/` page. `bun run cat check:prov-qaqc`, the CI step
  **"PROV-O QA/QC report"** in `.github/workflows/code-quality-gates.yml`;
  advisory — it fails only on stale output, an invalid activity, or an internal
  error.
- Tests: `cat-harness-tools/scripts/tests/prov-qaqc.test.ts`,
  `cat-harness-tools/scripts/tests/prov-record.test.ts`.
