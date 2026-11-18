---
name: bpmn-processes
description: >
  Every process here is BPMN, the diagrams are executable, and the base
  processes are strict. How to author one, how to run it, how a package relaxes
  a step and what it may never relax, and which gateways are computed rather
  than chosen.
adapters: [document, paper, dak]
profiles: [document, paper]
consulted: true
graph-typologies:
  - processes
---

# Processes are BPMN, and the diagrams are executable

**The `.bpmn` file is the source of truth.** The rendered SVGs are generated —
regenerate after editing one, and the staleness check fails the build if you
forget. Never hand-edit a rendered diagram.

**Do not quote a count of diagrams from prose.** Count the directory.

## Authoring: if it has actors, activities and a control flow, it is a process

Author it as **BPMN**, not as a diagram-in-a-fence. Fenced diagrams stay for the
things that are *not* processes — component maps, an inheritance lattice, a
navigation graph.

Every activity carries **`<bootstrap.processes:skill ref="…">`** naming the skill that
implements it, and **`<cat-harness.processes:bean …>`** where it touches the work plan. Add both
when you add an activity; the audit reports an activity that names no skill, and
the exemptions for the legitimate cases are *declarations*, not silence — see
[`role-model`](../process-core/role-model.md).

Lanes bind roles, not people. A lane is the role; an actor **takes it on** for
the duration. [`role-model`](../process-core/role-model.md) carries that model.

### There is no `tool` element, and that is a decision

An activity names a **skill**. A Tool declares `satisfies: ["<skill>"]`. So the
activity→Tool join **already exists and is derivable** — `activity → skill →
Tool` — and a `<…:tool ref>` on an activity would be a second, independent edge
answering the same question, free to disagree with the first.

It would also put the edge on the wrong side. `satisfies` is owned by the Tool,
which knows what it implements and is versioned with it; a `tool` ref would be
owned by the diagram author, who would have to track Tools across every
layer: Tools are discovered from the `tools/` graphs of several layers,
so a diagram in one layer would be asserting facts about others.

**The join is not fully populated**, and that is reported rather than gated:
`activity-skill-has-tool` (`minor`) locates each activity whose skill no Tool
satisfies, and `check:tools` carries the corpus-wide count. A skill with no
Tool is **not** an error, since plenty of skills are pure judgement. Read
counts from a run of `tools/discover.ts` (never a grep); `check:tools` and the
per-activity criterion count different sets, so their totals differ. Both are
needed: a corpus total cannot say *which* activity hands a performer a skill
whose mechanism is still inlined in its prose.

### A Tool's OWN procedure is the Tool's subprocess, not the skill's prose

A Tool may describe its own specific subprocess, so the general skill and
process stay general. The direction of the edge stays the one above — the Tool owns it. A Tool
whose way of exercising a skill has steps of its own (a retry loop, a staging
directory, a two-pass mode) names that diagram in **`subprocesses`**, a list
of process ids on its Tool node; `check:tools` refuses one no `.bpmn` in the
checkout has as its stem. The general process stays general and reaches the
detail by `calledElement` only where it has chosen that Tool. By convention
the diagram sits in the declaring layer's `processes/tools/` concern
group, beside other tools' procedures rather than among the general
processes.

### Processes are grouped by concern, from within

`processes/processes.json` (`"$schema": "concern-groups/v1"`) names the
groups — codes of `code-lists/concern-group.json` — and each is
`processes/<group>/`, a DMN under `processes/<group>/decisions/`. A higher
layer's same-named `processes/<group>/` is a member of the harness's group
and declares none of its own. `workflowFiles` walks recursively, so grouping
moves no diagram out of reach; the rules are in
[`directory-conventions`](../../kg/kg-core/directory-conventions.md) §"Concern
groups", checked by `check:concern-groups`.

### A process binds only skills its layer can reach (STRICT)

A process may bind only skills (and, through them, Tools) from **its own
layer or one it `needs`**, transitively. A `<bootstrap.processes:skill ref>` to a skill that only
a HIGHER layer holds is a wrong-direction edge, the same as an upward
import: the diagram cannot be lifted into its own repository without the layer
above it.

`bun run cat check:process-bindings` gates it, with the same `allowedFromNeeds`
direction as `check:import-direction` and `check:reference-direction`.
**`skill-ref-resolves` does not catch this:** it resolves against
`knownSkills(root)`, which in a multi-layer checkout is checkout-scoped, so
"resolves" means "exists somewhere". `skill-ref-resolves` is existence only,
and its own summary names this gate as the answer on direction, so there is
one implementation of "may this process bind this skill", not two free to
disagree. Existing
wrong-direction bindings are held in a ratchet baseline.

When it fires there are two fixes, and choosing between them is a placement
decision, not a mechanical one:

- **move the process up** to the layer that holds the skill, when the
  process is about that layer's concern;
- **move the skill down**, when the skill is generic and only happens to live
  too high.

Never widen the baseline to admit a new binding.

### Binding the extension namespaces

**An element's prefix names the Subgraph that declares it.** A diagram binds one address per vocabulary it uses:

```xml
xmlns:bootstrap.processes="https://litlfred.github.io/bootstrap/v0/processes/ns/"
xmlns:cat-harness.processes="https://litlfred.github.io/cat-harness/v0/processes/ns/"
```

- `bootstrap.processes:` for `skill`, `role` and `precondition`, which bootstrap
  declares in `bootstrap/processes/ns.jsonld`.
- `cat-harness.processes:` for every other element (`bean`, `policy`,
  `adjudication`, `raci`, …), declared in `cat-harness/processes/ns.jsonld`.

Readers match **the address, never the prefix text**, so a diagram that binds a
different prefix to the same address reads identically, and `folio:` bound to
anyone else's address is not ours. The address `…/folio-assistant/bpmn` is
**retired**: an element under it is not read, and `external-schemas` reports a
diagram that still binds it as drift. A test fails if an element is written under an address whose
vocabulary does not define it.

## Edge routing: rectilinear, and never over a task

**Rectilinear.** A sequence flow turns at right angles. A diagonal reads as a
different kind of edge, and the notation has no such kind, so a reader spends
attention deciding whether the difference means something.

**Never over a task, a lane label or another edge.**

A loop-back belongs in the **channel below the lane's tasks** — out of the row,
back along it, and up into its target. That is where a reader already looks for
one, and it crosses nothing.

**A flow in and a flow out never share a point.** Where one flow ends on a
shape, no flow leaves from that same point, and where one leaves, none ends.
Two arrowheads on one spot, or a line that both arrives and departs there,
reads as one edge passing through, and the reader cannot tell which way the
work goes. Give the outgoing flow another side: a loop-back that enters a
task on its right leaves that task's next flow from its top or bottom, and a
gateway that is entered on its left leaves on its other three sides (owner,
2026-11-08). Flows that only arrive may share a point, as a join does.

**Rows sit evenly in their lane.** A lane holds its steps in rows, and its
height follows the row count: n rows make a lane n times one row's height,
so lanes with the same number of rows are the same height. Row k of n has
its centre at k/(n+1) of the lane: one row in the middle, two rows at one
third and two thirds, and so on. A step is never pushed to the top or
bottom of its lane (owner, 2026-11-08).

**This is about the DIAGRAM, not the process.** `BPMNDiagram` carries where a
thing was drawn and the process carries what is true, so a routing fix changes
no semantics and needs no re-validation of the flow — the same split
`board-diagram-interchange` draws one level up. What it changes is whether
somebody can read the diagram.

**Check it by looking at the rendered SVG, not the XML.** Waypoints that look
orderly in source can still emit a diagonal, and `render:bpmn` is what a reader
sees; `preview:site` shows the rendered page, which is the artefact under
review, and a green gate set does not show it.

## Rendering: what a reader can click, and what must not collide

`render:bpmn`
(`cat-harness-tools/src/workflow/diagram-links.ts`) draws the links; the
layout rules are checked by `bpmn:detangle`
([`bpmn-detangle`](bpmn-detangle.md)).

**Links.**

- A step's **title** links to the step's own page (`process/P/node/T`), or,
  on a site that publishes no step pages, to its process's page in the
  processes viewer. The link wraps the title's text only, never the box, so
  a badge or the ⓘ drawn on the box is a target of its own.
- A call activity's **[+]** links to the process it calls. The link is the
  marker and a 24 × 24 hit area around it, never the box.
- Every link is focusable, shows a focus ring the size of the link, and has
  an accessible name: "Open step: …" or "Open subprocess: …".
- An overlay drawn over the picture (the process page's `.pt-go`) follows
  the same rule: it covers the [+] only.

**One way to show a drawing, on any page.** A process page, a guide's
business-processes page and a journey's step show the same drawing through
the same parts: `render:bpmn`'s SVG at `assets/img/workflows/<stem>.svg`,
inlined and framed by the site's `docs-ui.js`, and the ⓘ task panel. A page
other than a process page writes

    <figure class="bpmn-figure pt-diagram" data-panel="<processes route>/<stem>.tasks.json">
      <img src="assets/img/workflows/<stem>.svg" alt="BPMN diagram: …"></figure>

and loads `task-panel.js` and `task-panel.css` from the processes route. The
panel draws its markers from the sidecar and resolves its links against it.
`data-pt-highlight="Task_A Task_B"` picks out steps. Do not embed a drawing
as a data URI or a copy of the SVG: its links stay inert and it drifts from
the site's.

**Skills in the panel are the site's switch.** `site.taskSkills` in the
checkout's `index.config.json`: absent or `true` shows the skills a task
requires and its role has; `false` hides them, for a site whose processes
are not modelled with skills (an implementation guide's business
processes). The rest of the panel (the step, its lane and role, the
process, a called process) is shown either way, so a site that later models
skills turns them on with that one line.

**Layout.** The picture is the `BPMNDiagram` as written: bpmn-js lays
nothing out, so every rule below is fixed in the DI.

- **No flow through a box**: not a box it skips, and not its own source or
  target. A flow starts on the side of the box it leaves and ends on the side
  of the box it enters. When a box is resized (every task is 120 × 120), move
  the waypoints with it: a flow laid for the old size runs through the new
  box (`edge-through-own-end`).
- **No two labels on each other, and no label on a flow, a box or a lane
  line**, a pool's right edge included. A word wider than its `BPMNLabel`
  width breaks mid-word, so give the label the width of its longest word.
- **Every step inside its pool** (`shape-outside-pool`). Only data stores,
  data objects, annotations and groups may sit outside.
- **Labels inside the picture.** The SVG's `viewBox` is bpmn-js's bounding
  box of everything drawn, labels included, so a label never falls outside
  it. A label that looks cut off at the edge is cut off by the page, not by
  the SVG.

## Running one: the engine refuses work claimed out of order

The list / start / next / complete calls run a process from its diagram.
**"What is enabled now"** is the useful one: it reports the enabled step, the
lane that owns it, **and the skill that implements it** — so the answer is
something to act on rather than a bare step name.

**Completion refuses a step that is not enabled.** That is what makes the
diagram a control rather than a picture.

**Completion also checks WHO.** Before any task or decision is recorded, the
engine asks four questions: is the actor authenticated, eligible for the role
the lane binds (`roleRef`), permitted by an ODRL policy to `perform-task` in
this process and task, and allowed to touch the target content? This is
generic engine behaviour, so **do not draw an authorization task into a
diagram**: a check drawn into some processes is a check missing from the rest.
What a diagram owes the check is a lane bound to a declared role. See
[`task-authorization`](../process-core/task-authorization.md).

**Instance state is committed**, alongside the work plan, so a sibling session
sees the same position. Do not hand-roll a second tracker: a second answer to
*where are we* is free to disagree with the first.

## Strict by default, and what a package may never relax

Base processes carry **`<cat-harness.processes:policy enforcement="strict"/>`** — the gate
refuses a step that is not enabled. Per-content-type processes are **advisory**:
their package owns what *adequate* means in that domain. **Absent policy means
strict.**

To relax a base step, a package **declares** it with a **reason**. No reason, no
load — silencing a gate must cost more than satisfying it.

**Some steps are marked unrelaxable and no package may touch them**: the editor
*seeing* the findings, the decision itself, the write, and release
authorisation. Those four are the gate; everything else is procedure around it.

A validator checks every declared relaxation and runs in CI, so a relaxation
naming a step that no longer exists fails rather than sitting in the file
looking like policy while permitting nothing.

## The commit boundary enforces what the diagram decided

A corpus gate, run from a pre-commit hook or CI in a folio, **refuses a changed
block that no instance records the editor having authorised** — no instance, not
past the decision, or discarded.

**It refuses when it cannot tell, too.** A file that reads as a manifest but
will not import is refused rather than waved through: *could not determine* is
never rendered as a pass. Sweep-written sidecars are excluded, and a warn-only
mode exists for gradual adoption.

## Some gateways are computed, not chosen

A gateway carrying **`<cat-harness.processes:decision/>`** is backed by a decision table. Pass
the facts — the counts a QA sweep already produced — and the table returns the
branch.

**Completion refuses a hand-supplied outcome there**, and that refusal is the
point: asserting the answer would defeat having a table. Adding one means adding
the table and the reference and nothing else; the loader checks that every
outcome the table can return names a real branch.

## A bean-marked step performs the operation, not a note about it

An activity carrying a work item operation **does it** when you complete the step:

| op | what happens |
|---|---|
| `claim` | sets in-progress, idempotent |
| `note` | appends what you pass |
| `resolve` | completes the work item **only once the instance itself has completed** (or has nothing left but archive steps) |
| `archive` | moves a completed or scrapped work item into the archive, **only once the instance has completed** |

**The `resolve` row is a judgement guard.** A still-running
process gets a note instead, because whether work is done is a judgement and a
work item is never closed on someone else's say-so — the same rule that stops you
resolving a sibling's.

**You do not draw `claim`, `resolve` or `archive` yourself.** They live in two
called processes and nowhere else: `Process_BeanOpen` (`sdlc/processes/bean-open.bpmn`: check,
create, whose work item, claim or leave alone) and `Process_BeanClose`
(`sdlc/processes/bean-close.bpmn`: complete or scrap, then one shared archive
step; or record the blocker and hand back). A process that works on a work item
calls OPEN where the work item becomes its own, follows it with a `claimed` /
`not yours` gateway, and calls CLOSE straight before each end it reaches from
there. `note` stays on the steps where the work happens. `check:bean-calls`
(run inside `check:workflow-refs`) refuses the three ops anywhere else, and a
process that calls one of the pair without the other, because claim and close
drawn ad hoc leave work items resolved and never archived, and processes that claim
and never close. See
`todo-manager` (opt-in `cat-harness.work-plan`) §"Archiving — two dispositions".

Work-plan priming reports every instance's position next to its work item, so the
plan and the process are one answer rather than two.
