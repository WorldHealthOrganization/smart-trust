---
input: schemas/skills/bpmn-authoring/input.schema.json
output: schemas/skills/bpmn-authoring/output.schema.json
conformsTo:
  - omg-bpmn-2.0
  - omg-dd-1.0
  - bpmn-io-di
---

# bpmn-authoring

> Skill id: `bpmn-authoring` · Package: `workflow` ·
> Named by `l2-dak-authoring.bpmn` (**Business processes · BPMN 2.0**,
> `Business analyst` lane) and `crdm-requirements.bpmn` (**Phase 2: Map current
> workflow (BPA)**, `Agent` lane).

Author BPMN 2.0 business process diagrams — both a DAK's L2 business processes
and this repository's own `processes/**/*.bpmn`.

## Inputs and outputs

`schemas/skills/bpmn-authoring/`:

- **in** — `processName` (required), `sourceWorkflow`, `existingBpmn`,
  `participants`
- **out** — `bpmnFile`, `diagramFile`, `taskCount`, `gatewayCount`,
  `participantCount`

`graphviz` is a declared capability with `degradation: skip` — layout help
degrades, authoring does not stop.

## Diagram Interchange is not optional

A `.bpmn` with no DI section — no explicit `x`/`y` on its shapes — parses and
renders **blank**, although the XML looks complete.

`bun run cat render:bpmn` renders every diagram to `docs/assets/img/workflows/`
with bpmn-js in headless Chromium; `bun run cat render:bpmn:check` fails when an
SVG is stale. Run the renderer and look at the SVG before you call a diagram
done.

## Readable at 100%: check it before and after (author check)

Every diagram you write or touch must, when you are done:

- **fit 1400 × 900** in diagram units, so its 16px text reads at about
  14px in a 1200px band without zooming; **every task a fixed 120 × 120
  square**: boxes never grow to fit their names, and a name that does not
  fit is shortened (`TASK_SIZE` in the tools layer);
- have **no label on another label, on a flow (its own included), on a box
  or across a lane line**: a gateway's question above the diamond, its answers beside
  their flows, every label inside one lane;
- have **right-angled flows** and **every name inside its box**, pool and
  lane names inside their strips;
- have **no crossing flows**, and the **lane order that keeps flows between
  lanes shortest**: each lane sits next to the lanes it exchanges flows
  with, so **no flow crosses a lane it does not stop in**. A lane that talks
  to only one other lane, such as an owner who only approves the merge
  steward's card, goes on the outside, next to that lane (owner,
  2026-11-07: *"swap owner lane down to reduce arrows across non
  interacting actor lanes"*).

`bun run cat bpmn:detangle <file>` reports all of it, and `--write` fixes
what it can (lane order, right angles, box and lane sizes, label places).
Run it before and after, and put both counts in the PR.

**Zero findings on every diagram you touch, or it does not merge** (owner,
2026-11-02, after 63 of 80 harness diagrams were found with findings: *"improve
bpmn authoring process/skills so doesnt happen again"*). A report nobody
has to act on is how they piled up. Run `bpmn:detangle <file> --check`
last; a finding you leave needs a reason in the PR, and only
`diagram-too-wide` / `lane-order` may be left that way. Then **look at the
render**: the check cannot yet see a box drawn across a lane line or
outside its own lane, two flows drawn on top of each other, or a flow that
wanders through a lane it does not stop in. Those are found only by looking. The same findings
are in `render:bpmn`'s warnings and the process's QA report, so a reviewer
sees what the author left. The procedure, and why the budget is 1400 × 900, is
[`bpmn-detangle`](bpmn-detangle.md).

## In this repository, a diagram is executable

`processes/**/*.bpmn` are not pictures. `workflow_start` / `workflow_next`
/ `workflow_complete` run them, and `workflow_complete` **refuses a step that
is not enabled**. That has consequences for how you author:

- **Every activity carries `<bootstrap.processes:skill ref="…"/>`** naming the skill that
  implements it, and `<cat-harness.processes:bean store="beans/"/>` where it touches the work
  plan. `bun run cat check:workflow-refs` fails on a ref that resolves to nothing,
  and `bun run cat kg:audit` additionally fails when the named skill exists but no
  package can **serve** it.
- **Every lane names a role.** Declare the role once as a top-level
  `<bpmn:resource id="<role id>" name="<title>"/>` (before the collaboration
  and the process), and set `partitionElementRef="<role id>"` on the lane; the
  id is the role's in `scenarios/roles.json`, verbatim. Lane names are free
  text; an explicit ref is the join that does not depend on spelling.
  `<bootstrap.processes:role ref>` is the deprecated form. A diagram using any
  `bootstrap.processes:` element declares the namespace as the first child of
  `<bpmn:definitions>`: `<bpmn:import
  namespace="https://litlfred.github.io/bootstrap/v0/processes/ns/"
  location="https://litlfred.github.io/bootstrap/v0/processes/ns.jsonld"
  importType="http://www.w3.org/ns/json-ld"/>`.
- **A store is not a lane.** Lanes are for people and agents, the roles that
  act. A place where things are kept, such as the work plan (work items), a corpus,
  a session record, an activity log or a published bucket, is a
  `<bpmn:dataStoreReference>`. The tasks that read or write it point at it
  with data associations, and each task sits in the lane of whoever does it.
  A "Work plan — beans" lane holding "Open the
  bean" says the store does the work, when the agent does.
- **The process's own `bpmn:documentation` opens with what it is for.** Its
  first sentence is the diagram's row on the publication-workflow page.
  `kg-export` carries it on the `Process` node as `summary` (the whole text as
  `description`), the page reads it from the published named-subgraph JSON-LD
  (`bun run cat subgraph:jsonld`) rather than from anything written by hand, and
  `check:process-index` fails when a declared diagram's node has none. So that sentence says what the process does or answers
  — not who asked for it, which work item or issue it came from, or where the work
  got to. Those belong later in the documentation, or in the work item.
- **A gateway may be computed rather than chosen** — see `dmn-authoring`.
- **Policy is declared on the process.** `<cat-harness.processes:policy enforcement="strict"/>`
  means `workflow_gate` refuses a step that is not enabled; absent policy means
  strict. Steps marked `relaxable="false"` may never be relaxed by any package.

## Readable diagrams: what the research supports

These rules are what holds up from the BPMN comprehension research, checked
mechanically. `kg:audit` reports each rule below per process
(`src/workflow/diagram-quality.ts` in the tools layer). The
sources, and how strong each rule's evidence is, are in the
[`process-model-quality`](../../../methodologies/process-model-quality.md)
methodology.

- **Separate routing from work.** A task never has two outgoing flows: put an
  exclusive or parallel gateway after it, or a reader must guess fork vs
  choice (`activity-implicit-split`, major). A loop-back INTO a task is fine.
  A gateway either joins or splits, not both (`gateway-mixed`).
  **A question is a gateway, never a task**: a box named "Should it leave
  now?" or "Separate this graph?" is a decision drawn as work. If someone must
  judge first, draw that as a task ("Judge whether it should leave") or a call
  to `Process_AskThePerson`, then the question on the gateway after it.
- **Keep it small.** Split by phase into call activities past 20 flow nodes
  (`process-size`). That 20 is house style. The only threshold with evidence is
  7PMG's 50 (`process-decompose`, major), and it predicts modelling errors
  such as deadlocks, not reading speed.
- **One start event per process level** (`process-single-start`). Several
  named end events are fine, and the work item CLOSE pattern needs them.
- **A decision is a question, its branches are the answers**
  (`decision-label-question`).
- **Label activities verb-object**: imperative verb, then its object (*Review
  the draft*, not *Draft review*) (`activity-label-verb-first`). The evidence
  is one study of how ambiguous labels felt (29 students), so this is reported,
  never gated.
- **A name says the step, nothing else.** No trailing `[skill]` slug: the
  skill is in `<bootstrap.processes:skill ref>`, and the page links it from
  there. No step numbers ("1 ·", "Phase 2:",
  "P1.1"): the flows already give the order, and a number in front breaks
  verb-first. A number that cites a section of a source document goes in the
  task's documentation. A list of numbered steps is a sign the diagram copies
  a document's outline; group the steps into phases instead.

### Split by phase: how

A diagram can be right in every step and still unreadable on its page. When
`process-size` fires, or a diagram has a start event per lane, split it like
this:

- **The top-level process shows the phases.** Each phase is a
  `<bpmn:callActivity calledElement="…">` to its own process. Keep at the top
  only what moves the work between phases: who hands off to whom, and the
  decisions that send it back (rejected → revise). A loop that crosses phases
  is drawn at the top; a loop inside a phase stays in that phase.
- **A phase lives in its own file**, `<parent>-<phase>.bpmn`, next to the
  parent, with its own process id (`Process_<Parent><Phase>`) and a first
  documentation sentence that says what the phase does. It becomes the
  phase's row on the publication-workflow page like any other diagram's.
- **A phase that ends two ways ends in two named end events**, and the
  caller's gateway right after the call reads which one it reached, as
  `GW_BeanYours` reads `Process_BeanOpen`'s.
- **Keep the node ids when you move nodes into a phase.** A test, a schema or
  a skill that points at `Task_X` then changes only its file and process, not
  its id.
- **Open and close the work item at the top, once.** A process that is only ever
  called runs on its caller's work item, so a phase calls neither
  `Process_BeanOpen` nor `Process_BeanClose` (`check:bean-calls`).
  "Once" holds for the top as well: a process with several outcomes routes
  them all into **one** `Process_BeanClose` call, which decides itself whether
  the work item is completed, scrapped or blocked, and only then branches to its
  named end events. One close per outcome repeats the same box and makes the
  diagram wide.
- **A caller's `adjudication accepts` looks one level down.** If the judgement
  moves into a phase, put `accepts` on the call to that phase, and take it off
  any caller further up.
- **Name a call activity for the phase**, verb-object like any activity
  ("Review the change"), not for its file.

A phase that only one parent calls is still worth its own file: the point is
the page a reader opens, not reuse.

### Untangle every diagram you touch

The same discipline as ArchiMate views ([`archimate-models`](../../ui/ui-core/archimate-models.md)
§"Untangle every view you touch"), and the same geometry: a change never adds
a tangle. Run `bun run cat kg:audit` before and after, and compare
`edge-crossing`, `edge-through-node` and `edge-rectilinear` for the diagram,
and check that no shape has a flow in and a flow out on the same point and
that each lane's rows sit at k/(n+1) of its height
([`bpmn-processes`](bpmn-processes.md) §"Edge routing").
Say both counts in the PR. Route loop-backs in the channel below the lane
([`bpmn-processes`](bpmn-processes.md) §"Edge routing"), then look at the
rendered SVG.

### What the evidence does NOT support

Do not import these from style guides or model output; each was checked:

- **Mandatory left-to-right flow.** Figl & Strembeck 2015 (44 people) found
  no significant difference in accuracy or time across four directions.
  Lay out left-to-right for consistency, not because it reads faster.
- **A word cap on labels**, a **gateway fan-out cap of 4**, and **a fixed
  colour palette.** No study behind them. Colouring matching split and join
  gateways made novices more accurate and experts faster, not more accurate
  (Reijers et al. 2011).
- **OR-gateways** need no rule: the process model refuses inclusive gateways
  at load.

## If it has actors, activities and a control flow, it is BPMN

Not a Mermaid fence. Mermaid stays for the things that are *not* processes —
component maps, lattices, navigation graphs. The audit of which is which is on
the [publication workflow](https://litlfred.github.io/folio-assistant/folio-assistant-core/process/publication-workflow.html#which-diagrams-are-bpmn-and-which-are-not)
page, which the content core authors.

## Why this skill is in a platform package

It covers *both* a DAK's L2 business processes **and this repository's own
`processes/**/*.bpmn`**, and platform processes such as
`crdm-requirements.bpmn` name it, so it cannot live in a content-type package:
a platform process depending on a content-type package crosses the boundary
the `platform-boundary-guard` subagent keeps. Its DAK material stays here
rather than in a second skill, because a generic skill naming a domain worked
example is ordinary, and two skills that must be read together to author one
diagram are not.

## When a layer above transforms it

A layer built on this one may transform an authored business process into
another artefact — FHIR Shorthand, for instance — and then the BPMN is a
**source artefact** rather than documentation of one. Author it knowing it
will be transformed: names and ids you choose here appear in what is
generated. That layer's own tooling skill has the mechanics; this one names
no layer above it.
