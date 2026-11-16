---
# folio-assistant-aazi
$schema: bean/1.0.0
title: 'WORKFLOW-STATEMGMT RENDERING: a status dashboard atop the root README, and beans/todos mapped to their BPMNs'
status: completed
type: task
created_at: 2026-09-20T17:11:46Z
updated_at: 2026-10-07T19:30:00Z
parent: folio-assistant-yj32
---

Owner, 2026-09-20, verbatim:

> if a harness is working/active KG repo (not static read only)repo root READM
> should show at top a  current status of all intiated/partially iniated/etc.
> quick dashboard (#todos, #beans) for each initiated harness.  todo on render
> of active KG, beans and todos mapped to thier bpamns rendered nicely as well
> for project managemtn / visualizaitons.   available at
> <base-url>/workflows-statmtget or something to match whatever is in cat
> harness.... that is the workflow-statemgmt kinds rendering requirement...

## Three asks, and they are different sizes

1. **The root README opens with a status dashboard** — but only when the
   harness is an ACTIVE KG repo rather than a static read-only one. Per
   initiated harness: its initiation state (initiated / partially / not) and
   counts of `#todos` and `#beans`.
2. **Render the active KG**: beans and todos **mapped to their BPMNs**, drawn
   for project management and visualisation.
3. **Published at `<base-url>/workflow-statemgmt`** (name to match whatever
   cat-harness settles on) — *"that is the workflow-statemgmt kind's rendering
   requirement"*. So this is the RENDERING REQUIREMENT OF A GRAPH KIND, not a
   one-off page.

## Measured 2026-09-20

| | count |
|---|---|
| beans | **232** |
| todos | **3** |
| workflow instances in `beans/workflows/` | **0** |

And: `beans`, `todos` and `workflow-state` are all `holds: "state"` with
`renderable: false`.

## The blocker, and this is the THIRD time this session

**Nothing maps a bean to a BPMN.** A bean's front matter carries `id`,
`title`, `status`, `type`, `parent` — and no process, activity or instance
reference. `beans/workflows/` is the declared `workflow-state` graph, one JSON
per running instance, and it is **empty**. So "beans and todos mapped to their
BPMNs" is not a rendering problem; the mapping does not exist as data.

Ask 1 has the same shape: "initiated / partially initiated" is a fact about
where an instance reached in `initialize-harness.bpmn`, and **no instance
state is recorded** — which is exactly the blocker already written on `supn`.

**This is a pattern worth naming rather than re-discovering.** Three asks this
session have been a widget over a relation nobody has written down:

| ask | the widget | the missing relation |
|---|---|---|
| `v1hw` | uningested badge | which upload became which library entry |
| `supn` | harness init status | where an instance reached in its process |
| this | beans mapped to BPMNs | which process an item belongs to |

In each case the widget is a day's work and the relation is the design. A
dashboard computed from absent data would be a confident number about nothing
— and a dashboard is worse than a badge here, because it is the FIRST THING a
reader sees at the top of the README.

## What is genuinely buildable today, without the mapping

The counts. `#beans` and `#todos` per instance are a directory count, and the
existing `health` checks already report `bean-store` and `todo-store`
statistics. A dashboard limited to counts plus "declared / materialised" would
be honest and useful, and would not pretend to know process position.

**Recommended split**: ship the counts, leave the process mapping to whatever
settles `supn`, and do not let the dashboard imply a precision the data has
not got.

## `active` vs `static` needs a definition, and `ie9l` needs it too

"if a harness is working/active KG repo (not static read only)" is the same
distinction `ie9l` records from the earlier instruction — *"tell them to
determine if active KG (beans/tods) or static"*. It appears in two asks and is
defined in neither. The obvious reading is **an instance is active if it
declares a `state` graph** (`beans`, `todos`, `workflow-state`), which is
already a declared, checkable property rather than a new flag. **Confirm
before building on it.**

## Depends on / overlaps

- `supn` — harness cards with init status and health badges. Ask 1 is the same
  data on a different surface; they must not compute it twice.
- `v49e` — the specialised workflow visualiser "to see where process is
  breaking down", which the owner explicitly beaned rather than started. Ask 2
  is close enough that they should be designed together.
- `ie9l` — the root README. This is its top section.
- `2krx` — `beans`, `todos` and `workflows` are declared subgraphs with no
  visualiser. This bean IS that finding for those three.
- `6lb8` — the board. A PM visualisation and a Miro-like board on the same
  data should not be two renderers.

## Done when

- [x] `active` vs `static` is defined and checkable
- [x] The root README opens with a per-instance dashboard on active repos only
- [x] Beans and todos carry a process reference, or one is derivable
- [x] The `workflow-statemgmt` rendering is published at a stable base-url path
      and satisfies the kind's rendering requirement

---

## STALE 2026-09-21 — the blocker has partly lifted, and one claim was wrong in shape

Re-measured, because a blocker recorded as current is a blocker the next agent
believes.

**`beans/workflows/` is no longer empty.** Two committed instances:

| instance | process | status | `bean` |
|---|---|---|---|
| `crdm--folio-assistant-6lb8` | `Process_CRDM` | running | `folio-assistant-6lb8` |
| `crdm--issue-607-kg-to-cdn-portal` | `Process_CRDM` | running | `folio-assistant-xies` |

Both carry `$schema: "folio-workflow-instance/v1"`, plus `tokens`, `history`,
`arrivals`, `children`, `subject` and `source`. So the table above — *"workflow
instances: 0"* — is a day out of date.

### And the sharper claim needs correcting too

This bean says **"Nothing maps a bean to a BPMN… the mapping does not exist as
data."** That is now false in one direction and was stated more broadly than
the evidence supported even then. An instance carries `bean:` as a first-class
field, so **instance → bean exists and is committed**.

What does *not* exist is the inverse: a bean's front matter carries `id`,
`title`, `status`, `type`, `parent` and no process reference. But that is a
join to compute, not data to invent — invert the instance set and every bean
named by one has its process, its token position and its history.

**So ask 2 is no longer blocked on data.** It is blocked on nothing but the
work, over a set of 2. The honest caveat is COVERAGE, not existence: 2 of 232
beans are named by an instance, so a view must render "no instance recorded"
as a **third state** rather than drawing an empty diagram — which is this
repository's usual rule and the one `vlhk` was opened about.

**Ask 1 is still blocked**, and for a narrower reason than this bean gives:
both instances are `Process_CRDM`. Neither is `initialize-harness.bpmn`, so
*"where a harness got to in its initialisation"* still has no answer. See the
same correction on `supn`.

## DECIDED 2026-09-25 — the status bar is THREADED, not stacked on top

The owner gave this on 2026-09-20 as an answer to `ie9l`'s "who owns the root
README" question, and it **was lost before it reached either bean** — this
session was compacted and PR #542 merged without it. `ie9l` closed on the half
it could see; this half belongs here, because it changes what this bean builds.

Verbatim, and the two sentences are one design:

> human voice is in an included KG asset that user is pointed to to edit. then
> come the list of initaited harnesses etc. eac asset is associated to a harness
> instances and placed there. bootstrap at top. work down.
>
> it is just the status bar is threaded with each harness listing.

**This is not the dashboard this bean assumed.** The title says *"a status
dashboard atop the root README"*, and the second sentence says it is not atop
anything. Read together:

| | what this bean assumed | what the owner decided |
|---|---|---|
| where the numbers go | one dashboard block at the top of the README | **interleaved** — each harness's listing carries its own status |
| what the reader sees first | aggregate counts across all instances | the **human voice**, from an editable KG asset |
| ordering | unspecified | **bootstrap at top, then work down** the dependency order |
| who owns the prose | the generator | a **person**, in an asset they are pointed at |

**Four consequences, and the third is the one that bites.**

1. **The human voice is an asset, not a generated section.** So the README is
   composed of assets rather than written by a generator with holes in it — and
   the asset is the thing a person is *pointed at*, which means the README has
   to say where it is. That is `ie9l`'s `agent-instructions` / `instance-readme`
   asset roles doing a second job.
2. **Each asset is associated to a harness instance and placed there.** Not
   collected centrally. An instance's voice lives with the instance, so adding an
   instance adds its section without editing anything shared.
3. **Threading means there is no aggregate to render.** A stacked dashboard is
   one generated region with one marker pair; a threaded one is **N regions,
   one per instance, each interleaved with authored prose**. `readme-sections.ts`
   writes a section only where its marker pair already exists — so threading
   needs a marker pair per instance, and the instance list is exactly what is
   not known until the root is scanned. That is the real design question this
   decision opens, and it is not answered here.
4. **Bootstrap at top, work down** is the dependency order, which
   `instanceRootsIn` returns sorted alphabetically. So the ordering is a new
   requirement on that function's consumers, not a property they already have.

**What does NOT change.** `active` vs `static` still needs its definition, and
the owner's answer on that was separate and also 2026-09-20: option 1, **plus**
"need to ask user before making active state intiation (part of install for that
harness) skill + process" — i.e. initiation is a gated step a person approves,
not something a scan infers. Both Done-when boxes 1 and 3 are untouched by this
decision.

**Done-when box 2 is superseded** — "The root README opens with a per-instance
dashboard on active repos only" describes the stacked design. Rewritten below.

- [x] Each initiated harness's README listing carries its own status inline
      (threaded), ordered bootstrap-first, with the human voice coming from an
      instance-associated KG asset the README points the reader at

## Evidence of completion (2026-10-07)
- Landed in PR #1347 (merge commit `5891ada72908`): Workflow state management status dashboard rendered in READMEs.
- Re-derived independently on 2026-10-07: README sync and workflow dashboard checks passing.
