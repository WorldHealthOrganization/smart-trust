---
$schema: folio-methodology/v1
name: odrl-policies
title: ODRL 2.2 — what a party may do, as permission and prohibition rules over actions
origin: >
  W3C, "ODRL Information Model 2.2", W3C Recommendation 15 February 2018,
  edited by Renato Iannella and Serena Villata, produced by the W3C
  Permissions and Obligations Expression Working Group. The held copy is the
  Working Group's own staged REC snapshot (github.com/w3c/poe), not compared
  byte for byte with the w3.org copy and without later errata — see the
  entry's `licence.json`. The companion "ODRL Vocabulary & Expression 2.2",
  which the model defers to for normative serialisation and the Common
  Vocabulary, is NOT held.
evidence:
  - library/w3c-2018-odrl-model-2-2
applies-when: >
  **What an actor may DO — may this party perform this action, here?** Use it
  when a grant or a refusal has to be written down so a machine can evaluate
  it: who holds an action, scoped to a process, a task or a role, and which
  broader action it falls under. It answers *permit*, *deny* or *nobody has
  said*. It does NOT answer who is involved in an activity (`raci`), which
  lane an actor may act in (`role-model`), or how a decision is reached
  (`kepner-tregoe`, `dmn`). It is not used here for source licences, which
  are recorded as SPDX ids in each library entry's `licence.json`.
---

# ODRL 2.2: permissions as rules over a declared action graph

**Adopted 2026-09-23** (issue #1180), on the owner's choice of permission
language: *"W3C ODRL 2.2 and W3C PROV-O for logging"* — quoted from the
docblock of `schemas/content/odrl.ts`. This node was written after the fact, against
the held Recommendation, so the platform's subset could be checked against the
standard rather than against its own description of it.

## Its sources: what is held, what is not

| source | held | what this node takes from it |
|---|---|---|
| ODRL Information Model 2.2 (W3C REC, 2018) | ✅ `library/w3c-2018-odrl-model-2-2` | the model, its classes and every MUST quoted below |
| ODRL Vocabulary & Expression 2.2 | ❌ not held | the Common Vocabulary actions (`display`, `modify`, …) and their `includedIn`; the JSON-LD context. **The `includedIn` values in `ODRL_ACTIONS` are not verified against it here** |
| post-REC errata | ❌ not held | none |

**A caution on section references.** The held sections were split by PDF
page, so a section file's body often begins with the tail of the previous
section. References below use the section numbers printed *in the text*, not
the file names.

## The load-bearing idea, in the standard's words

> "The ODRL Information Model represents Policies that express Permissions,
> Prohibitions and Duties related to the usage of Asset resources. The
> Information Model explicitly expresses what is allowed and what is not
> allowed by the Policy" — §2.

Its terms (§1.3): a **Policy** is *"A group of one or more Rules"*; an
**Action** *"An operation on an Asset"*; a **Permission** *"The ability to
exercise an Action over an Asset"*; a **Prohibition** *"The inability to
exercise an Action over an Asset"*; a **Duty** *"The obligation to exercise an
agreed Action"*; a **Party** *"An entity or a collection of entities that
undertake Roles in a Rule"*; a **Constraint** *"A boolean/logical expression
that refines an Action and Party/Asset collection or the conditions applicable
to a Rule"*.

Three mechanisms carry the method, and the platform uses all three:

- **Actions inherit through `includedIn`.** *"a Permission or Prohibition of an
  encompassing Action is inherited by all Actions with an includedIn
  relationship"*, and every action other than `use` and `transfer` *"MUST have
  one includedIn property value"* (§2.4).
- **Constraints conjoin.** *"When multiple Constraints apply to the same Rule
  ... they are interpreted as conjunction and all MUST be satisfied"* (§2.5).
- **Conflicts are resolved by a declared strategy:** *"perm: the Permissions
  MUST override the Prohibitions; prohibit: the Prohibitions MUST override the
  Permissions; invalid: the entire Policy MUST be void"* (§2.10).

And one that makes extension legitimate: a policy may *"Use an ODRL Profile
that declares the supported vocabulary"* (§2.1), and new actions are made by
creating *"an instance of an Action and define its includedIn parent Action"*
(§3.3).

## What this platform adopts — class by class

| ODRL | here | where |
|---|---|---|
| **Policy** (`Set`, `Offer`, `Agreement`), `uid`, `profile`, `inheritFrom`, `conflict` | adopted; both live policies are `Set`s with `conflict: odrl:prohibit` | `OdrlPolicySchema`, `policies/*.jsonld` |
| **Permission** | adopted: one rule per (actor, action), migrated from the old per-actor lists | `policies/folio-defaults.jsonld`, `policies/http-gateway.jsonld` |
| **Prohibition** | adopted in the schema and the evaluator; **no live policy states one** — both files' `prohibition` is `[]` or absent | `permits()` in `schemas/content/odrl.ts` |
| **Action** + `includedIn` | adopted: the folio profile's actions each name a broader action, ending at ODRL's `odrl:display`/`modify`/`annotate`/`derive`/`translate`/`execute` under `odrl:use` | `skills/permissions/permissions.json`, `ODRL_ACTIONS`, `broaderOrSelf()` |
| **Party** — `assignee`, `assigner` | adopted as the `assignee` of each rule, an actor id from `scenarios/actors/`, plus the profile party `cat-harness:anyone` for an unauthenticated reader | `OdrlRuleSchema`, `ANYONE` |
| **Asset** — `target` | adopted as an optional `target` string | `ruleApplies()` |
| **Constraint** | adopted for three profile `leftOperand`s — `cat-harness:process`, `cat-harness:task`, `cat-harness:role` — and four operators `eq`, `neq`, `isAnyOf`, `isNoneOf`, conjoined | `OdrlConstraintSchema`, `constraintHolds()` |
| **Profile** | `profile` is required; the action half of the profile is `permissions.json` | `OdrlPolicySchema` |

The evaluator is the question every caller asks — the BPMN task gate
(`src/workflow/authorize.ts`, action `perform-task`), the HTTP routes
(`src/core/rbac.ts`), and the `auth_whoami` tool (`src/tools/auth.ts`) — all
through `decide()`, over policies loaded by `src/core/access.ts`.

## What it refuses or departs from, with reasons

Each item is a place where the code differs from the held text. **They are
stated so nobody reads `@conformsTo w3c-odrl` as full conformance.**

1. **Duty, obligation, consequence, remedy — refused.** No reader exists, and
   `.strict()` rejects the keys *"because a rule that silently means less than
   it says is exactly the failure a permission file must not have"*
   (`schemas/content/odrl.ts`). A Permission carrying an unfulfilled duty would be read
   as unconditional, which is worse than refusing it.
2. **Refinements, AssetCollection, PartyCollection, LogicalConstraint,
   `rightOperandReference`, `dataType`, `unit`, `status`, `implies`, `partOf`,
   `hasPolicy`, `transfer` — refused**, for the same reason: no reader.
3. **`target` is optional; ODRL requires it.** §2.6.1: *"A Permission MUST
   have one target property value of type Asset"* (Prohibition likewise,
   §2.6.2). Here an absent target means the layer's whole graph. Every live
   rule omits it.
4. **The default conflict strategy is `prohibit`; ODRL's is `invalid`.** §2.10:
   *"If the conflict property is not explicitly set, the default of invalid
   will be used."* The code names this as *"OUR rule rather than claimed as
   ODRL's"*; both live policies set `odrl:prohibit` explicitly, so the
   difference does not fire today. **Kept by owner ruling, 2026-10-01**
   (work item `jcet`): an unstated clash denies rather than voiding the policy —
   a deliberate profile departure, not an oversight; `odrl.test.ts` pins it.
5. **Across policies, any `deny` wins.** `decide()` evaluates each policy and
   lets a prohibition in one beat a permission in another. ODRL's merge rule
   is different — inherited conflict values are replicated and *"If a Policy
   has multiple conflict property values ... then the entire Policy MUST be
   void"* (§2.10). Only the child's `conflict` is read by `permits()`.
6. **A circular `inheritFrom` is tolerated, not refused.** §2.9: *"Inheritance
   MUST NOT be circular."* `effectiveRules()` walks with a visited set, so a
   cycle terminates silently instead of failing. (Cycles *are* deliberately
   allowed in the **action** graph — the owner's *"doensnt necc need to be
   rooted acyclic graph"*. That sits uneasily with §2.4, which calls
   `includedIn` transitive, says *"the Actions form ancestor relationships"*,
   and requires every action to reach `use` or `transfer`; a cycle among
   profile actions is a departure, not a reading.)
7. **No-match answers `unknown`, a third value.** This node found no held text
   that defines the outcome when no rule matches; `unknown` — never permit,
   never deny — is the platform's rule (`Decision` in `schemas/content/odrl.ts`), so
   `task-authorization` can report it as a finding.
8. **Role eligibility is added on top.** `permits()` denies a permitted request
   whose `cat-harness:role` the actor is not eligible for. That is
   `role-model`'s separation of what a lane needs from what an actor may do;
   it is not ODRL.
9. **Cardinalities not enforced:** an empty policy validates (§2.1: *"MUST have
   at least one permission, prohibition, or obligation"*); an `Offer` needs no
   `assigner` and an `Agreement` needs no policy-level `assignee` (§2.1.2,
   §2.1.3); and the profile IRI is never checked, although §3.2 says a
   processor that *"does not recognise the ODRL Profile identifier(s) ... MUST
   stop processing"*.
10. **The profile is not published as RDF.** §3.3 asks that new terms *"must
    also be defined as a skos:Concept"*; `permissions.json` is plain JSON with
    `id`, `title`, `description`, `includedIn`, and the profile IRI
    `https://litlfred.github.io/folio-assistant/ns/folio-odrl` is not shown to
    resolve.

## What ODRL is not used for here

- **Not for source licences.** ODRL's own subject is content usage, and the
  natural reading would be a library entry's licence as an ODRL Offer. That is
  not what happens: `licence.json` records a `status` and an SPDX `id`, checked
  by `bun run cat check:source-licence` (`scripts/check-source-licence.ts`).
- **Not for identity.** Which login is which actor is GitHub's answer
  (`src/core/github-auth.ts`), never a policy's — `policies/README.md`.
- **Not for logging.** That is PROV-O (`schemas/content/prov.ts`), chosen alongside it.

## Where it runs

Schema and evaluator `schemas/content/odrl.ts` (tests `schemas/odrl.test.ts`);
policies `policies/` (graph typology `policies`, validator registered in
`schemas/kg/graph-typology-registry.ts`); the action profile
`skills/permissions/permissions.json`; external-schema entry
`external-schemas/w3c-odrl.json`; the design
`docs/proposals/odrl-prov-actor-model.md`. How it is applied — actors,
permissions and lanes — is in
[`role-model`](../skills/process/process-core/role-model.md) and
[`task-authorization`](../skills/process/process-core/task-authorization.md);
this node is the method, and those skills name it rather than restate it.
