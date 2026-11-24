---
name: task-authorization
description: >
  The check every BPMN task execution runs before anything is recorded:
  is the actor authenticated, assigned to the role the lane binds, authorized
  by an ODRL policy to perform the task, and allowed access to the content it
  acts on? One generic check in the engine rather than a step drawn in some
  diagrams; strict, with GitHub as the authenticator. Also how the HTTP
  routes ask the same policies. Triggers on: may this actor, who may perform,
  authorization, authentication, access rights, permission check, RBAC,
  rbac.ts, workflow_complete refused, not eligible for role.
allowed-tools: Read Grep Glob Bash
---

# Task authorization — four questions before every task

> **Before an actor performs a task or answers a decision, the BPMN executor
> asks: who is this, may they act in this lane, does a policy let them do it,
> and may they touch this content?**

## The four checks, in order

| # | question | answered from | a "no" |
|---|---|---|---|
| 1 | **Authenticated** — who is the actor, and how do we know? | the executor's `Principal` (`src/core/access.ts`) | recorded as a finding |
| 2 | **Assigned** — may this actor take the role the lane binds? | `ActorDef.roles` in `cat-harness/scenarios/actors/`; the lane's `roleRef` | **refuses** |
| 3 | **Authorized** — may they `perform-task` in this process, for this task, as this role? | ODRL policies in `policies/*.jsonld` | `deny` **refuses**; `unknown` is a finding |
| 4 | **Access** — the same, on the content (`target`) the task acts on | the same policies, rule `target` | `deny` **refuses**; `unknown` is a finding |

It is **one function**, `authorizeTask` in `src/workflow/authorize.ts`, run by
the interpreter's `complete()` and by `workflow_gate`. **It is not drawn as a
task in any diagram.** A check drawn into some processes is a check missing
from the others.

The verdict is written into the instance history (`HistoryEntry.authz`) and the
`task-end` log line, so the record of a step says who did it and on what
authority, not only that it happened.

### Why checks 2 and 3 stay separate

A role is what the actor is acting **as**; a permission is what the actor may
**do** ([`role-model`](role-model.md) §"Three questions about an actor"). An actor permitted to
`perform-task` everywhere still cannot sit in a lane its `roles` do not
include. So the role check does not wait on the policy and cannot be overridden
by it.

## One action for every task

A task always asks for `perform-task`, scoped by
`cat-harness:process`, `cat-harness:task` and `cat-harness:role` constraints
and by `target`. A step needing a narrower right gets it as a **constrained
rule in a policy**, never as a new attribute on the diagram:

```json
{ "assignee": "content-reviewer", "action": "perform-task",
  "constraint": [{ "leftOperand": "cat-harness:role", "operator": "odrl:eq", "rightOperand": "reviewer" }] }
```

Remember the direction of `includedIn`: a grant of a **broader** action covers
a narrower one. `perform-task` sits under `odrl:execute`, so granting
`adjudication` (which is included in `perform-task`) does **not** grant
`perform-task`. It is the other way round.

## Authentication is the executor's job, and GitHub is today's authenticator

Whoever executes a process (the MCP workflow tools, a script, a swarm
orchestrator) must say **how** it knows who the actor is. A `Principal` carries
`authenticatedBy`:

| value | meaning | today |
|---|---|---|
| `github` | GitHub authenticated the caller | a GitHub Actions run (`GITHUB_ACTOR`, set by the runner) |
| `http-gateway` | the auth-gateway's OAuth session, as headers | the HTTP routes, once deployed ([`deployment-auth`](../../tools/folio-core/deployment-auth.md)) |
| `asserted` | an actor id the caller typed | **every local agent session** |
| `none` | nobody named | a step recorded with no `actor` |

The second half of GitHub as access control needs no code: the KG data store
is a git repository on GitHub. An instance file, a work item or a content change
becomes durable **only through a push GitHub has authorised**. The in-process
check decides whether the step may be recorded; branch protection and push
rights decide whether the record lands.

**Do not treat `asserted` as authenticated.** Report it as asserted.
`policies/` never holds identity.

## Asking who you are: the `auth_whoami` Tool

The `user-auth` Tool node (MCP `auth_whoami`, `src/tools/auth.ts`) answers three
questions in one call:

1. **Who am I?** It asks GitHub (`src/core/github-auth.ts`). With a person's
   own token, `GET /user` gives the login and the `permissions` block of
   `GET /repos/{o}/{r}` gives their role. In an Actions job the token is the
   workflow's, not the person's, so it asks
   `GET …/collaborators/{GITHUB_ACTOR}/permission` instead.
2. **What does GitHub let me do?** That role, mapped onto the gateway actors
   `policies/http-gateway.jsonld` already grants: `admin` → `owner`;
   `maintain` and `write` → `collaborator`; `triage` and `read` → `viewer`;
   `none` → nobody. A GitHub caller and an HTTP-gateway caller therefore get
   the same answer from the same policy, and no login is written into the
   repository.
3. **What does policy let me do here?** The ODRL answer for an action, or the
   full four-check verdict for a BPMN step when `process` and `task` are given.

It answers in three states: `authenticated`, `unauthenticated`, and `unknown`
(GitHub could not be asked). `unknown` is never shown as a pass. A role that
cannot be read stays unknown and maps to nobody; it is never guessed. An actor
you name is reported as **claimed**, because GitHub vouched for the login, not
for the BPMN actor.

**One resolver for preferences and permissions, two thresholds.** The same
identities feed both, through `resolveIdentities`
(`cat-harness-tools/src/core/identity.ts`): GitHub's answer is
the one `auth_whoami` gives, and the other providers — GitLab CI, the agent
host's account, the user-level store, the git author — are listed beside it,
each marked vouched or self-asserted. A preference may follow a self-asserted
identity
([`interaction-modality`](../../conduct/conduct-core/interaction-modality.md)
§3.1). **A permission never does**: only an identity GitHub vouched for maps
to an actor, and a self-asserted one maps to nobody.

**There is no login-to-actor table.** A personal-account repository has
exactly three GitHub permission levels, and they are the whole mapping (`PERSONAL_ACCOUNT_LEVELS` in `src/core/github-auth.ts`):

| GitHub level | GitHub role | actor |
|---|---|---|
| owner | `admin` | `owner` |
| collaborator | `write` | `collaborator` |
| anyone else, public repository | `read` | `viewer` |
| anyone else, private repository | `none` | nobody |

The consequence is stated in every `auth_whoami` answer: there is no
read-only or triage collaborator on a personal-account repository, so **every
collaborator can write the whole graph**. Telling an author from a reviewer is
left to the per-lane ODRL rules.

**The actors are `owner`, `collaborator` and `viewer`**, and nothing finer is
mapped from a login. At the GitHub level author, reviewer, adjudicator and
release manager are all `collaborator`; sign-off stays with `owner` by the
merge, as the CRDM process has it. **Access granularity is a property of the
tool that holds the data, not of the actor**: a GitHub-backed write is all or
nothing for the whole repository, and a different tool, such as a future data
store in front of the graph, may give the same actor finer grain.

## GitHub as the auth layer: what it is good at, and where it stops

The knowledge graph's data store is a git repository on GitHub, so GitHub is
the authenticator and the outermost access control. That choice has real
strengths and one structural weakness, and every answer `auth_whoami` gives
ends by restating the weakness.

**Strengths**

- **Real identity at no extra cost.** Accounts with two-factor
  authentication, organisation SSO where it is configured, per-repository
  fine-grained tokens, and a runner-set `GITHUB_ACTOR` in Actions. There is no
  second identity system to run.
- **Access to the graph is access to the repository.** One place to grant,
  and revoking a collaborator takes effect on the next request.
- **Every write is attributable.** A change lands as a commit with an author,
  and PR reviews and merges are recorded. That is the durable half of the
  audit trail that the PROV-O report (below) reads.
- **Write governance exists.** Branch protection and rulesets can require
  reviews and passing checks before a merge, and `CODEOWNERS` makes review
  requirements **path-scoped**.

**The weakness: all of the knowledge graph, or none of it**

- **Read is whole-repository.** Anyone with `read` sees every sub-graph,
  every node and every file. GitHub cannot say "the glossary, but not the
  unpublished chapters".
- **Write is whole-repository too.** `write` lets a person push to any path on
  any unprotected branch. Path scoping exists only for **reviews** (via
  `CODEOWNERS`), and it binds merges into protected branches, not pushes.
- **No query-path control.** GitHub serves files, not queries. It cannot
  authorize a traversal that starts in a sub-graph you may read and reaches a
  node you may not, because it does not know the edge exists.
- **Five roles, no actions.** `admin`, `maintain`, `write`, `triage` and
  `read` are its whole vocabulary. Authoring, adjudicating and releasing are
  all just `write`. The ODRL profile's actions cannot be expressed in it.
- **Once read, it is copied.** A clone or a fork keeps the data after access
  is revoked. Revocation stops the next read, not the last one.
- **A login is not an actor.** GitHub says who pushed, not which lane or role
  they were acting in.

**What follows from that**

1. **Where a boundary must hold against a reader, it is a repository
   boundary.** Sub-graphs with different read audiences belong in different
   repositories.
2. **Everything finer is ODRL, enforced in process.** The engine's
   four-check verdict and the HTTP routes govern callers that go through
   them. **They are not a security boundary against someone who can clone the
   repository.** Do not describe a scoped ODRL rule as protecting data from a
   GitHub reader.
3. **Real per-node or per-query enforcement needs a data store in front of
   the graph** (the auth-gateway, and later a relationship engine such as
   OpenFGA). The policies do not change when it arrives. Only
   the place that evaluates them does.

## The engine is strict

`policies/http-gateway.jsonld` grants `perform-task` to `owner` and
`collaborator` in every lane; `viewer` gets nothing beyond the anyone floor.
The principal is the one **GitHub** vouches for (`githubPrincipalFor`), not an
actor name the caller types. Together these are what make strict mode workable:
without a permit in every lane and an authenticated principal, strict would
stop every process.

`workflow_gate` and `workflow_complete` run in **strict** mode
(`ENGINE_MODE` in `src/tools/workflow.ts`). Strict refuses `deny`, a role
mismatch, `unknown`, an asserted identity, nobody, and an undeclared actor.
The `actor` a caller passes is still written to the history, as what it said
it was acting as; it does not decide anything.

With a GitHub-authenticated principal, every task and gateway in `processes/`
is allowed for `owner` and `collaborator` and refused for `viewer` (`unknown`)
and for nobody. `scripts/tests/task-authorization-strict.test.ts` pins this.

**What strict costs:** if GitHub cannot be asked (no token, no network, rate
limit), no step can be recorded; that is the price of authentication being
real rather than typed. `authorizeTask` itself still defaults to advisory, so
a reader that re-checks history (the PROV-O report below) is not strict by
accident.

## The HTTP routes ask the same policies

`src/core/rbac.ts` asks the ODRL policies:

- a route names the **action** it performs: `allows(req, "content-authoring")`;
- the gateway's three sessions are three declared actors (`viewer`,
  `collaborator`, `owner`), and what each may do is
  `policies/http-gateway.jsonld`;
- **at the HTTP boundary `unknown` refuses.** A route is a door, and a door
  nobody has decided about stays shut. That is the one place the two callers
  differ.

| route | action |
|---|---|
| edit content, revert content, upload documents, save glossary curation | `content-authoring` |
| delete feedback | `review-comments` |
| adjudicate a relevance verdict | `adjudication` |

Every gated route allows `collaborator` or `owner`, and
`task-authorization.test.ts` pins that.

## When a step is refused

1. Read the verdict line: it names which of the four checks said no.
2. **Role mismatch:** you are acting as the wrong actor, or the lane binds a
   role you do not hold. Hand the step to an actor who may take the role
   ([`process-state`](../workflow/process-state.md)). Do not edit your actor's
   `roles` to get past it; that is `actor-role-administration.bpmn`, and it
   belongs to the administrator lane.
3. **`deny`:** a prohibition was written on purpose. Ask the user; never
   remove it yourself ([`deletion-requires-confirmation`](../../conduct/conduct-core/deletion-requires-confirmation.md)).

## The engine writes its own PROV-O record

`complete()` attaches a `prov:Activity` to
each history entry it records under an authorization context
(`src/workflow/prov-record.ts`, `HistoryEntry.prov`):

- `prov:agent` is the actor GitHub vouched for, not a typed name;
- `prov:hadRole` is the lane's role, and `prov:hadPlan` is
  `<process file stem>#<node id>`;
- `cat-harness:underPolicy` is every policy in force, because `decide`
  evaluated every one;
- `prov:used` is the target, when the step names one.

It is written **at the moment it is true**, which the after-check below
cannot do from a name alone. The same no-invention rule applies: a refused
step, a step with no actor, or a step in a lane that binds no role gets no
activity.

## The after-check: the PROV-O QA/QC report

The engine checks **before** a step. An agent swarm acts first, so the same
policy is checked **after**, from the record
(`docs/source/concepts-agentic-harness/bpmn-execution.md`).
`scripts/prov-qaqc.ts` reads every instance in `beans/workflows/`, including
its subprocesses, and for each history entry on an activity or decision:

- writes one `prov:Activity` (`schemas/content/prov.ts`): `prov:agent` is the entry's
  actor, `prov:hadRole` is the role the lane binds (`laneBinding`),
  `prov:hadPlan` is `<process file stem>#<node id>`, and
  `cat-harness:underPolicy` is every policy evaluated. One log per instance
  goes to `docs/assets/prov/<instance>.prov.jsonld`;
- re-runs `authorizeTask` itself. For an entry recorded under a verdict it
  re-checks **the principal that verdict recorded** (the actor GitHub vouched
  for); for an entry that records just a name, it uses that name, `asserted`;
- emits the engine's own `prov:Activity` when the entry carries one, and
  derives one only for an entry without one.

Findings: `unknown`, `deny`, `not-eligible`, `undeclared-actor`, a recorded
`authz` that disagrees with the recomputed one (`authz-disagrees`), and gaps
in the record itself: `no-actor`, `no-role`, `node-not-in-model`,
`source-moved` and `source-missing`. **An entry with no actor, or in a lane
that binds no role, gets no `prov:Activity`**, because the schema requires
both and a guessed value is fabrication. It gets a finding instead.

```sh
bun run cat prov:qaqc          # write docs/prov-qaqc/index.md and the logs
bun run cat check:prov-qaqc    # CI: fail when they are stale
```

It is **advisory**, unlike the engine: findings are listed on the
`/prov-qaqc/` page and never fail the build. `check:prov-qaqc` fails only on
stale outputs, a `prov:Activity` that does not validate, or an internal
error. Quote the counts from a run, not from the page you remember.

## Code

- `src/workflow/authorize.ts`: `authorizeTask`, `describeVerdict`
- `src/core/access.ts`: `loadAccessContext`, `principalFromEnv`
- `src/core/rbac.ts`: `principalOf`, `authorize`, `allows`, `forbidden`
- `src/core/github-auth.ts`: `githubIdentity`, `principalFromGithub`, `GITHUB_ROLE_ACTOR`
- `src/tools/auth.ts`: `auth_whoami` (Tool node `user-auth`), `whoami`, `grainNote`
- `schemas/content/odrl.ts`: `decide` (every policy; any `deny` wins), `PERFORM_TASK`
- `src/workflow/prov-record.ts`: `provActivityFor` (the engine's record)
- `scripts/prov-qaqc.ts`: `buildReport`, `reportInstance` (the after-check)
- tests: `scripts/tests/task-authorization.test.ts`, `scripts/tests/task-authorization-strict.test.ts`, `scripts/tests/user-auth.test.ts`, `scripts/tests/prov-qaqc.test.ts`, `scripts/tests/prov-record.test.ts`
