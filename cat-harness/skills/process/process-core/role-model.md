---
name: role-model
description: >
  Actors, roles and skills — who performs a BPMN task, under which swimlane,
  with which skills. How a role's skill set is resolved through `inherits` and
  through a subprocess call chain, how a lane binds to a declared role, and how
  `kg:audit` finds a dangling skill, lane, role or decision.
allowed-tools: Read Grep Glob Bash
satisfies:
  - "req:agent-workflow#acts-as-a-role"
  - "req:session-start#detect-role"
graph-typologies:
  - policies
---

# Roles are swimlanes

One sentence carries the whole model:

> **An actor performs a task in a process as a role, using that role's skills.**

Six objects, each with a home:

| object | what it is | declared in |
|---|---|---|
| **Actor** | a concrete participant. Human, agentic or mechanical. Persists across every process. | `scenarios/actors/*.json` (the declared `scenarios` graph, beside the roles) |
| **Role** | **the swimlane** — a persona an actor *takes on* because of the lane it is acting in. Carries a collection of Skills. | `scenarios/roles.json` |
| **Skill** | an instruction body: what the actor needs to know to perform the task it was handed. | `skills/<pkg>/*.md` (naming its `input:`/`output:` contracts, usually under `schemas/skills/<name>/`); JSON `SkillDefinition`s in each owning layer's `skills/skill-definitions/` |
| **Process / Decision** | BPMN and DMN. Lanes bind roles; activities name skills; gateways may compute their branch from a table. | `processes/**/*.bpmn`, `processes/**/decisions/*.dmn` |
| **Requirement** | a conformance obligation, **pointed at** by what discharges it: a skill or capability names the statement in `satisfies: req:<id>#<key>`. The requirement points at `actors` (who is bound) and `derivedFrom` (the broader requirement it specialises). | `skills/requirements/*.json` |
| **Permission** | what an actor is **allowed to do**. Cross-cuts roles. A W3C ODRL 2.2 rule, scoped by Process, Task or Role when it needs to be. | actions: `skills/permissions/permissions.json`; who holds them: `policies/*.jsonld` |

**WHO's "actor" is this model's Role.** An actor in the WHO DPI-H Reference
Architecture's conformance model (§3.7.2, an abstract information-processing
role) and a DAK generic persona each map to a folio-assistant **Role**, never
to an Actor. The RA's system *realising* an actor maps to a mechanical Actor
taking on that role. The comparison is on the DAK layer's
`findings/dth-terms.md`.

Schema: [`schemas/process/role-graph.ts`](https://github.com/litlfred/cat-harness-tools/blob/main/schemas/process/role-graph.ts). Audit:
`scripts/kg-audit.ts`, sidecar schema
[`schemas/sdlc/kg-qa.ts`](https://github.com/litlfred/cat-harness-tools/blob/main/schemas/sdlc/kg-qa.ts).

### Not every skill is PERFORMED — `consulted: true`

**Reference material belongs in no lane, by its nature.** `build-pdf` and
`proof-triage` are tasks somebody carries out; `directory-conventions`,
`untrusted-input` and `turn-reporting` are what the performer READS. Both
kinds are skills; only the first can sit in a swimlane.

A skill that is reference material declares `consulted: true` in its front
matter. Absent means performed: the exception is annotated, not the rule,
because an axis whose default costs an edit in every skill file does not get
adopted. No mechanical signal (a sibling
`SkillDefinition`, an `allowed-tools:` line) tells the two kinds apart, so it
must be declared.

**It is checked in BOTH directions**, which is what stops it being an
opt-out. `skill-in-role-or-process` skips a consulted skill; the separate
`consulted-skill-not-performed` reports one that a role carries or an
activity names, because a skill cannot be reference material *and* a step
somebody performs. Which of the two declarations is wrong takes a person,
so the criterion reports both rather than choosing.

### A skill does not carry `roles:` front matter

Do not write `roles:` in a skill's front matter.
`bun run cat check:retired-front-matter` fails if it appears, because copying an
adjacent skill's front matter brings the field back. To learn who
performs a skill, read `scenarios/roles.json`; the registry is the only answer
that resolves. A role→skill edge for a skill above the harness is an
`extensions` entry in that layer's role graph (§"A higher layer EXTENDS
a role by id").

**`roles:` in a `folio-memory/v1` entry is a DIFFERENT field and stays.**
`memoryForRoles` filters on `tags.roles`, and an untagged entry would be seen
by every lane. Sharing a key name across graph
typologies is not sharing a field, and `check:retired-front-matter` keys its
exemption on `$schema`, never on the directory.

Whether a skill should declare its performer is undecided; if it ever does,
the field is **declared in the schema before it is written**.

## Why a lane names a role, and the role is not the person

A lane is not itself a role: **a lane names the Role its tasks are performed
in**, not an Actor. The same actor is a different thing in two diagrams, and
two different actors are the same thing in one.

In `crdm-requirements.bpmn` the session agent acts in `Lane_Agent`. In
`bean-lifecycle.bpmn` that very same session agent is, from the other diagram's
point of view, the **sibling session** — the lane that exists precisely to mark
what is *not yours to close*. The skills differ because the **lane** differs,
not because the actor did.

So nothing is "a reviewer". Somebody **acts as** reviewer, inside a process,
for the duration of a lane.

> **An actor carries `roles[]`, never `inherits`.** "Can review" and "can
> push" are properties of a position, not of a person, so the `inherits`
> lattice lives in the role graph. An actor lists the roles it may take on.
>
> `roles: []` and an **absent** `roles` mean different things. `[]` says the
> actor takes on no role, which is the honest value for a read-only identity
> that never appears in a swimlane; absent says nothing has been asserted.
>
> The `actor-is-not-a-role` criterion reports an actor that carries `inherits`,
> because a registry written by hand reaches for `inherits` again.

> **Roles played by mechanical actors are real roles**, because the diagrams
> hand them tasks.
> `Work plan (beans)`, `Corpus`, `Publish target`, a build pipeline and the
> external registries are roles a machine or an outside party plays. Their
> skills are their **contract**: the responsibilities they must perform, which
> a test can hold them to — a contract skill names its tests in front matter as
> `tested-by:`. The QA report lists a mechanical role whose skills name no test
> as `mechanical-role-untested`, and `role-has-actor` asks what actor plays
> each such role.

> **A store is a mechanical role with a `store` block, and is drawn as a data
> store, not a lane.**
> `work-plan`, `corpus`, `log` and `session-record` keep things rather than
> do them. Each stays a Role, so its skills are still its contract, and adds
> `store`: what it `holds` (typology ids), its `api` (one entry per
> transport, in that transport's own format: `openapi`, `fhir-capability`,
> `graphql`, `cli` tools, `json-schema-files`, `git`), what it is
> `realisedBy`, and whether it is `published`. Only a role played by `system`
> or `external` actors may declare one. The role id is the store id: each
> layer declares `<bpmn:dataStore id="<role id>">` once in
> `processes/global-tasks.bpmn`, and a process draws a `dataStoreReference`
> pointing at it, with `dataInputAssociation` for a read and
> `dataOutputAssociation` for a write. A system that does its own step
> (validates, decides, returns a result) keeps a lane; one that only keeps
> what others write is a data store. The same store is an ArchiMate
> application component (its interfaces, data objects and services hang off
> it) and, in a FHIR layer, an `ActorDefinition` of type system whose
> `capabilities` or `reference` points at its API.

> **Some roles perform, but by judgement.** `stakeholder` carries
> `judgementOnly: true`: somebody really does sign off, deliberates and is
> accountable — they simply cannot be handed a procedure that produces the
> answer. That is a different thing from a mechanical role, which has no
> judgement to exercise and whose skills are a contract it can be tested
> against.
>
> Do not give such a role a skill. The flag exists because a decision recorded
> only in a role's summary is one the next agent re-litigates.
> `activity-names-skill` records **n/a** for activities in its lane, which lets
> that criterion gate on the undeclared ones.

## An actor is one of three kinds — human, agentic, mechanical

```jsonc
{ "id": "ci-pipeline", "title": "CI pipeline", "kind": "system", … }
```

`kind` takes one of four values, and three of them are the classification that
matters. `external` is the fourth: a participant outside this layer, which is
not ours to task at all.

| `kind` | the kind it names | what it can be handed |
|---|---|---|
| `person` | **human** | a skill to read, and a judgement to make |
| `agent` | **agentic** | a skill to read, and a judgement to make |
| `system` | **mechanical** | a program to run, and nothing to decide |
| `external` | outside this layer | nothing |

**The line is judgement.** An agent and a person can both be handed an
instruction body and asked to decide something; a mechanical system executes a
procedure and decides nothing. That says whether a given step may be given to a
given participant, so one value covering an LLM agent and a CI runner alike
would leave "which tasks can this actor perform" unanswerable.

The vocabulary is declared once, in `schemas/kg/skill-package.ts` (the
zod-only base both the registry schema and the role graph import), and
re-exported from `schemas/process/role-graph.ts`, where it is `ACTOR_KINDS`.

**A legacy `type` still loads, and is never read as `agent`.** An unmigrated
downstream registry has not said whether its non-person actors exercise
judgement, so they read as `system` — the reading that refuses a judgement task
rather than granting one on a guess. Guessing from an id ending in `-agent`
would put an unreviewed claim into the graph wearing the appearance of data.
An unrecognised `kind` **throws**: coercing a typo to `system` would silently
disqualify an actor from every task it exists to perform.

## A task declares which actor kinds may fulfil it — mostly without saying so

> **Tasks can be fulfilled by only certain actor types.**

`activity-fulfilment-kind` checks that against the lane's role, and almost no
diagram has to declare anything, because **BPMN already answers it and nothing
was reading the answer**:

| task type | who may perform it | from |
|---|---|---|
| `bpmn:userTask` | `person` | the spec: "performed by a human being with the assistance of a software application" |
| `bpmn:serviceTask` | `agent`, `system` | the spec: "uses some sort of service … a Web service or an automated application" — no human in the loop |
| `bpmn:task` | **nothing asserted** | the abstract task says nothing, so neither does the check |
| `bpmn:callActivity` | **nothing asserted** | the constraint belongs to the called process's own steps |

`fulfilmentKindsForBpmnType` returns `undefined` for the last two, never `[]`.
An empty list would read as *"no kind may perform this"* and fail every
activity drawn as a plain task — the third state, in the place it is easiest
to lose.

**Scoped like `activity-names-skill`.** An
activity whose lane is unbound or absent is already reported by
`lane-binds-role` and `activity-in-lane`, so it is not reported twice here.

**Override it only when the derived answer is genuinely wrong:**

```xml
<bpmn:extensionElements>
  <cat-harness.processes:fulfilment kinds="person agent"
                    reason="a person or an agent drafts this; a pipeline cannot." />
</bpmn:extensionElements>
```

The **reason is required at load time** and a reasonless declaration does not
parse — the same rule `<cat-harness.processes:no-skill reason>` follows, and for the same
reason. Widening `kinds` is the cheapest way to make this criterion pass, so
silencing it has to cost a sentence somebody reads in the diff.

**Read a failure as a question with three answers, not one.** The task type may
be wrong, the lane may be wrong, or the step may really admit that kind — and
only the third is a `<cat-harness.processes:fulfilment/>`. Reaching for the
exemption first turns it into a rubber stamp.

## Three questions about an actor, and only two are answered on the actor

```jsonc
// cat-harness/scenarios/actors/admin.json
{ "id": "admin",
  "roles":        ["programme-manager", "publication-manager", "editor", "author", "reviewer"],
  "capabilities": ["git-push"] }

// policies/folio-defaults.jsonld: a W3C ODRL 2.2 Set
{ "permission": [ { "assignee": "admin", "action": "role-management" }, … ] }
```

| question | answered by | scope |
|---|---|---|
| what may it act **AS**? | `roles` on the actor | per lane |
| what may it **DO**? | ODRL rules in `policies/` naming it as `assignee` | everywhere, or as narrow as a rule's `cat-harness:process`, `cat-harness:task` and `cat-harness:role` constraints |
| what does its **machine have**? | `capabilities` on the actor | the environment |

**What an actor may DO is not on the actor.** It is a W3C ODRL 2.2 rule per
action in `policies/`:

- **Inheritance.** Each action in `permissions.json` says which broader actions
  it is `includedIn`, ending at ODRL's own (`odrl:display`, `odrl:modify`,
  `odrl:execute`, …). A grant of a broader action permits everything included
  in it. The graph need not be a tree and may have cycles.
- **Scope.** A rule may be limited to a Process, a Task or a Role. No
  constraint means everywhere.
- **One question, three answers.** `permits()` in `schemas/content/odrl.ts` returns
  `permit`, `deny` or `unknown`, and `unknown` is never permit. Performing a
  task in a lane needs the permission **and** the lane's role, so eligibility
  (`roles`) and permission stay separate, as below.
- **Anyone.** `cat-harness:anyone` is an unauthenticated reader: a person with
  no login, whoever they are. It may `visualize` and `render`, and nothing
  else.

**Identity is not here.** Which login is which actor is the data store's to
know. No actor file and no policy carries a login, and workflow history names
the **actor**, never the login: the repository owner's steps are recorded as
`owner`, and the data store maps the login to `owner`.

**Who reads all three before a task runs:** the BPMN executor. Before any task
or decision is recorded, `authorizeTask` asks whether the actor is
authenticated, eligible for the lane's role (`roles`), and permitted by policy
to `perform-task` here and on this content. A role mismatch or a `deny`
refuses, and so does `unknown`, because the engine runs strict. The HTTP routes
ask the same policies through `src/core/rbac.ts`. See
[`task-authorization`](task-authorization.md).

**Adding a permission:** declare the action in `permissions.json` with its
`includedIn`, then add a rule to a policy in `policies/`. Never add a
`permissions` list to an actor file: the audit reads it (an unmigrated
downstream registry still works), but a list there is invisible to every
scoped decision.

**Permissions do not belong on Role either.** A permission **cross-cuts**: one
action is held by actors taking on several different roles, and not by every
actor sharing a role.

The line that does hold: **a skill answers what the performer of this task needs
to KNOW, and belongs to the lane. A permission answers what this participant may
DO, and travels with the participant through every lane it enters.**

Both are audited and both are `critical` — `actor-permissions-resolve` (which
also checks that every policy rule names a declared action and a declared actor
or `cat-harness:anyone`) and `actor-capabilities-resolve`.

## Requirements are the fifth node kind, and they only point

A requirement is not a skill and not a role. It is an obligation *about* them,
kept in the `kg` graph so that every agent reads it and its joins are audited:

```jsonc
{ "id": "req:commit-hygiene",
  "derivedFrom": ["req:agent-workflow"],
  "actors": ["author", "admin"],
  "statements": [
    { "key": "no-secrets", "conformance": "SHALL",
      "requirement": "Commits SHALL NOT include secrets, API keys, tokens…" } ] }
```

and a skill that discharges a statement says so in its own front matter:

```yaml
satisfies:
  - "req:commit-hygiene#no-secrets"
```

The statement names no satisfier: a requirement is written once, and
what discharges it arrives later, so the pointer lives on the arrival.

The references are audited. `satisfies-resolves`, `requirement-actors-resolve`
and `requirement-derived-from-resolves` are `critical`, because a reader
following a broken one gets nothing — the same test as a dangling
`<bootstrap.processes:skill ref>`. `requirement-statement-satisfied` is `minor` coverage: a
statement nothing claims is visible only from the requirement's side. `requirement-statements-graded` is `major`: an
ungraded statement is readable, it just cannot be conformance-tested, and
SHALL-vs-SHOULD is the whole reason to write a requirement rather than a note.

**Do not fold a requirement into the skill that satisfies it.** The grading, the
`derivedFrom` lattice, the actor binding and the many-to-many `satisfies` are
the only machine-checkable things about it, and prose in a skill doc carries
none of them. `satisfies` is many-to-many in both directions — one skill
discharges statements in several requirements — so inlining duplicates rather
than relocates.

## Two compositions, and they are not the same

**`inherits` — a role IS-A role.** `qc-reviewer` inherits `reviewer` and gets
its skills everywhere, in every process, forever. Static. `resolveRoleSkills`
closes over it breadth-first, so a skill's reported `via` is the *nearest*
ancestor that supplies it.

**The subprocess stack — a role acting INSIDE another role's task.** A process
calls a subprocess and the actor keeps acting: it does not stop being the outer
role, it *additionally* takes on the inner lane's role. The skills available at
that task are the union along the whole call path. `resolveRoleStack` takes the
path outermost-first and keeps each skill's provenance, because a reader needs
to know not only that a skill was available but which level supplied it.

```ts
resolveRoleSkills(graph, "qc-reviewer")       // static: + everything reviewer has
resolveRoleStack(graph, ["editor", "viewer"]) // scoped: the union for this call only
```

**Do not merge them.** A flat union would make `reviewer` permanently hold every
skill any caller ever had, and a closure that broad cannot fail an audit, which
is the same as not having one.

## A higher layer EXTENDS a role by id — it never edits it

A third relation, across layers rather than within one graph. When a skill
belongs above the harness (a core cataloguing skill, a sci Lean skill), the
role→skill edge naming it must not stay in `cat-harness/scenarios/roles.json`
— that is an upward reference. So the **dependent holds the pointer**, the
way a voice points at the role it addresses and a story at the role it is
told as:

```jsonc
// <content-core>/scenarios/roles.json
{ "name": "<content-core>", "roles": [],
  "extensions": [{ "role": "librarian", "skills": ["filing-dublin-core"] }] }
```

| a dependent's `scenarios/` may | it may NOT |
|---|---|
| add skills to a lower role (`extensions`) | change its title, description, `inherits`, `actorKinds` or persona |
| add a NEW role, which may `inherits` a lower one | redeclare a lower id — refused, "extend it instead" (one exception, below) |
| extend a lower actor: `actors/<f>.json` with `"extends": "<id>"`, adding `roles` / `capabilities` | carry any other field on an extension |
| extend a capability: `"extends"` adding `requires`; or add a new probe | point an extension UP or sideways — only at an id declared below it |

**The one exception — a move in flight.** Moving a role, actor, capability or policy up a layer is two pull
requests: the higher layer adds it, then the lower layer removes it, and in
between both declare the id. A redeclaration that **only adds** — every field
the lower declaration carries is there unchanged (the same scalar, every
member of an array, a nested object by the same rule), and it may carry more,
such as the skills it used to add by extension — is accepted with a warning
that names the id and both layers, and the higher declaration is used. The
warning is the move's to-do: remove the lower copy. A redeclaration that
changes or drops anything the lower one said is still refused.

`schemas/process/scenario-overlay.ts` applies it (`checkoutRoleGraph`,
`checkoutActors`, `checkoutCapabilities`, `checkoutPolicies`; the
exception is `onlyAdds`); the layers are the checkout's
layers that depend on the role's owner, deepest first. Resolved alone, the
harness sees only its own roles. `kg:audit`, `check:raci`,
`check:fallback-roles`, `check:actor-reach`, `kg-export` and the
stakeholder map read the checkout's view on the platform's own run.

The edge stays on a role graph — the graph of the layer that owns the
skill — never in skill front matter.

## A lane binds its role with `partitionElementRef`

Lane names are free text, and several spellings name one position, so a name
alone joins a lane to nothing and an undefined lane is a silence rather than a
finding. So **a lane
binds its role itself, with BPMN's own `partitionElementRef`**: the role is
declared once per diagram as a top-level `<bpmn:resource>` whose `id` is the
role id verbatim and whose `name` is its title, before the collaboration and
the process. The role lists no lanes: a role is the general node and a lane the
dependent one, and a general node never names its users (`data-modelling`
step 8).

```xml
<bpmn:resource id="reviewer" name="Reviewer"/>
...
<bpmn:lane id="Lane_Reviewer" name="Reviewer" partitionElementRef="reviewer">
  ...
</bpmn:lane>
```

A `<bootstrap.processes:role ref="reviewer"/>` in the lane's
`extensionElements` is read, with a warning, only when
`partitionElementRef` is absent (`laneRoleRef` in `schemas/process/role-graph.ts`); the
QA report lists it as `lane-role-legacy-binding`. `<bootstrap.processes:role
variable="true"/>` stays: it declares a performer who is whoever invoked the
process. An explicit binding **wins** over name matching: a diagram that has
said which role it means must not be second-guessed by a string table. A ref
naming no declared role is a `critical` finding — it is *not* quietly
name-matched instead.

## The audit — `bun run cat kg:audit`

One criterion per join in the sentence at the top. The list below is the
actor→role→skill→task core; **`KG_CRITERIA` in `schemas/sdlc/kg-qa.ts` is the
registry**, and it is longer — it also covers requirements, skill bodies and
the graph as a whole.

```
activity ──names────▶ skill      skill-ref-resolves             critical
gateway  ──computes─▶ decision   decision-ref-resolves          critical
lane     ──is───────▶ role       role-ref-resolves              critical
activity ──sits in──▶ lane       activity-in-lane               major
task type─can be done by▶ kind   activity-fulfilment-kind       major
lane     ──is───────▶ role       lane-binds-role                major
role     ──carries──▶ skill      role-carries-activity-skill    major
decision ──is used──▶ gateway    decision-outcomes-used         major
role     ──carries──▶ skill      role-skills-resolve            critical
role     ──is-a─────▶ role       role-inherits-resolves         critical
activity ──names────▶ skill      activity-names-skill           minor
role     ──is used──▶ lane       role-binds-a-lane              minor
actor    ──takes on─▶ role       role-has-actor                 minor
skill    ──any way in▶ anything  skill-has-entry-point          minor
skill    ──modelled?▶ role/task  skill-in-role-or-process       minor
actor    ──is not a─▶ role       actor-is-not-a-role            minor
```

| command | does |
|---|---|
| `bun run cat kg:audit` | write the sidecars, print the summary |
| `bun run cat kg:audit:check` | fail on a `critical` finding, or on a stale sidecar |
| `bun run cat kg:audit:strict` | ...and on `major` too |
| `bun run scripts/kg-audit.ts --json` | the full report set, for a tool |

### Why sidecars rather than a console report

`check-workflow-refs.ts` prints and exits, so its **previous** answer is gone.
That makes *"this lane has been unbound since the day it was drawn"* and
*"this lane broke in the commit under review"* indistinguishable, and a
reviewer cannot separate a new defect from inherited debt. The sidecars are
committed, under `kg-qa/` beside whatever they audit, so the diff says exactly
which findings a change introduced. Same argument and same file shape as the
block sweep's `*.qa.json` and the script sweep's `*.script-qa.json`.

### Where the sidecars for another layer go — hosted, not written into it

A layer that declares no `qa` directory does not receive sidecars inside
its own tree: `kgQaHomeFor` (`schemas/kg/cat-harness.ts`) puts them in the
auditing harness's `qa` directory under the layer's stub —
`cat-harness/test/results/bootstrap/` for bootstrap (a working copy, stored
on the `qa-reports` branch with the rest of that `qa` directory; a JUDGEMENT
about it is hosted the same way, under `test/attestations/`). A verdict ABOUT an
layer is the auditor's output, and bootstrap is the layer that must read
cleanly with no harness present. The same holds once bootstrap is its own repository: the verdicts stay
with the harness that computed them, against the pinned bootstrap
([`kg-separation`](../../kg/graph-management/kg-separation.md) §"The pair").

### Three states, and what `unknown` costs

A criterion returns `pass`, `fail`, `n/a` (does not apply to this subject) or
`unknown` (could not be evaluated — the file would not parse, a dependency was
absent). **`unknown` is never written as a pass.** It counts as a failure at
its criterion's own severity.

It is not *promoted* to `major` either: a diagram that will not load records
`unknown` against its `critical` criteria too, so it still fails the gate,
while an unevaluable `minor` criterion does not gate the build: a gate that
fires on something nobody agreed was blocking gets switched off.

### Severity, and why coverage is only `minor`

`critical` is a **broken reference** — something names a thing that does not
exist, and a consumer following it gets nothing. `major` is a **missing join** —
the graph is intact but a question has no answer, e.g. a lane bound to no role.
`minor` is **coverage**: a real gap with legitimate instances. A human signing
something off is not implemented by a markdown file, so failing on
`activity-names-skill` would force a fake ref onto a real step, which is worse
than the gap.

### Never quote a count from prose — run the audit

**A number written in a document is a claim; only a run is evidence.** Two
criteria ask **different reachability questions**, and only one of them is
about the role model:

- **`skill-has-entry-point`** — is there ANY way in: servable, in the harness,
  carried by a role, or named by an activity? The servable clause alone covers
  nearly the whole corpus, so this passes near-trivially; its green is not an
  answer to the coverage question.
- **`skill-in-role-or-process`** — what does the actor → role → task model
  actually reach? This is the real coverage question, and **it must never
  gate.** A skill invoked directly by name is doing its job without appearing
  in any diagram, and driving the number to zero would mean inventing roles and
  activities to absorb tools that do not want them. Watch it move; do not read
  it as a defect list.

## What counts as a skill

`scripts/known-skills.ts` is the single answer, shared by `kg-audit` and
`check-workflow-refs` so the two cannot disagree.

**Not every group under a skills directory holds skills**: `actors/` holds
participants, `capabilities/` holds environment probes (`docker`, `pandoc`,
`python3`), `roles/` holds an assignment table and `hooks/` holds a shell
script. `NON_SKILL_GROUPS` excludes them, so
`<bootstrap.processes:skill ref="viewer"/>` does not resolve.

It is a **deny-list of groups known not to hold skills**, not an allow-list of
`local/`, so a new group of real skills is picked up automatically and a new
group of something else is a one-line addition.

## Administration IS a swimlane

The role graph is the substrate every diagram's lanes bind to. Changing it —
adding an actor, opening a role, granting a permission, retiring a
participant — is therefore a process like any other, and it is drawn:
[`actor-role-administration.bpmn`](../../../processes/process/actor-role-administration.bpmn),
in the `administrator` lane.

**Do not invent a role to make a diagram drawable.** A role minted for a
picture is a role no audit can fail, because nothing was ever true of it — the
closure-widening failure of §"Two compositions", from the other end.

What follows from administration being a lane:

| | |
|---|---|
| administration is a lane | so `role-management` is exercised somewhere a reader can find |
| the lane is `person`-only | a permission grant is a standing decision, not a task; the agentic/mechanical line is judgement, and this one is **authority** |
| the mechanics are NOT re-drawn | the diagram **calls** `code-change-review`; a second description of branch-gates-review is a second thing free to disagree with the first |
| the audit runs **after** | every criterion is a join, so what an administrative edit breaks is never in the file it edited |

## Adding a role

1. Add it to `scenarios/roles.json` with a **`description`** that says what
   the **position** is, not what it is called. **`actorKinds` is a SET** drawn
   from `person`, `agent`, `system` and `external` — human, agentic,
   mechanical, or outside this layer. It is what `activity-fulfilment-kind`
   checks the lane's steps against, so it is a claim about who can actually
   stand there, not a label.

   Use `title`/`description` (the two labels every knowledge-graph node
   carries), never `summary`, and `actorKinds`, never `actorKind`: **Zod strips
   an unknown key**, so a misnamed field type-checks, parses, and is silently
   lost.
2. Bind its lanes: each diagram declares `<bpmn:resource id="<role id>"
   name="<title>"/>` once, and each lane that names this role carries
   `partitionElementRef="<role id>"`. The role lists no lanes, since a role is the
   general node and a lane the dependent one (`data-modelling` step 8).
   A lane with no ref is unbound, whatever its name.
3. Give it the skills its lane's activities name. `role-carries-activity-skill`
   fails if an activity demands something its performer was never given.
4. `bun run cat kg:audit`. The kg-qa sidecars it writes are derived results whose
   record the CI job `qa-publish` stores on the `qa-reports` branch.

A role that binds no lane in any diagram is reported by `role-binds-a-lane`:
either a lane name has drifted, or the role is dead.

## Renaming a role, and a role's other names

**Never let a name go silently.** A role carries every name it goes by:

- **`otherNames`** — names in use today: synonyms, a local title, an example.
  The same field, and meaning, as `otherNames` on WHO SMART Base's Generic
  Persona. Published as `skos:altLabel`, beside the names the role's lanes are
  drawn with.
- **`formerNames`** — `{ "name", "retiredOn" }` for each name it no longer
  goes by. Published as `skos:hiddenLabel` on the role, and the old name's
  concept is `owl:deprecated` and `dcterms:isReplacedBy` the role, so a reader
  holding the old name from older text is sent to the current one.

To rename: change `title`, and add the old one to `formerNames` with today's
date, in the same commit. `readRoleGraph` refuses a name — title, other or
former — that two roles share, so a retired name cannot be quietly given to a
new role. The glossary ledger still records, from the harness's side, every
name a swimlane has derived; the role's own lists are the authored record a
README can show (`kg:roles`, written by bootstrap-tools).
