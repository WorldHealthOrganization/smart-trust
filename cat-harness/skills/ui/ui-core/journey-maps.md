---
name: journey-maps
description: >
  Journeys and workshops as knowledge-graph content: a DAK user scenario told
  as a journey map (`user-scenario` kind: ordered steps, per person what they
  do and feel, pain points, enablers, the record's trust state, and edges to
  stories, BPMN tasks, requirements, FHIR examples, building blocks and the
  DAK's data sets, decision tables and indicators), the
  `building-blocks` catalogue its steps use, a workshop that teaches from it
  (`workshop` kind: modules, objectives, questions for the room on each step,
  reference tables, sheets, job aids), the `journeys-viewer` visualiser that
  draws them for a layer and the layers it mounts, and the
  `check:journey-refs` gate that every reference they name resolves. Read
  before writing a journey or a workshop, before declaring the viewer, and
  before building a journey walkthrough app of your own.
---

# Journey maps — journeys and workshops as nodes

> Skill id: `journey-maps` · Package: `ui-core` · Kinds: `user-scenario`,
> `building-blocks`, `workshop`, `device-screen` · Tools: `journeys-viewer` (`bun run cat
> journeys:viz`), `journey-refs` (`bun run cat check:journey-refs`)

## The rule

**A journey is content, a workshop is content, and the walkthrough is a
viewer of both.** Write the journey once, as a `user-scenario` node; teach
from it with a `workshop` node that points at its step ids; declare the
`journeys-viewer` visualiser. Do not hand-write the journey again in an app,
in TypeScript, or in a page: each copy drifts from the BPMN and the stories
the node already links.

## Journeys with systems get an ArchiMate model

The `journeys-viewer` draws the story; it does not draw the architecture.
When a layer's journeys name **system** actors (`actorKinds: ["system"]` in
`roles.json`), declare an ArchiMate model too, so the systems and who uses
them in each moment are drawn as architecture:

- a directory of graph typology `archimate` with its `cat-archimate.config.json`,
  and the `archimate` visualiser (`renderedBy: "archimate-pages"`) beside the
  `journeys` one in the layer's declaration. Declaring them is what turns the
  ArchiMate subgraph on; nothing infers it from the journeys;
- the model generated from the same nodes, never typed again: the roles as
  business roles and application components, each journey a business
  process with the people assigned and the systems serving it (see
  smart-trust-demo `tools/archimate/` and smart-ips-pilgrimage
  `archimate/build.py`);
- a landing page that shows one card per journey moment, linking the
  walkthrough, the story and the moment's ArchiMate view, generated from the
  `user-scenario` nodes (smart-trust-demo's "Four moments that matter").

Failure this prevents (smart-ips-pilgrimage, 2026-11-10): the IG had
journeys with four system actors and a journeys viewer, but no ArchiMate
model. The owner expected the journeys to show through ArchiMate, as
smart-trust-demo's do, and found the ArchiMate subgraph off. If a layer's
overview figure draws those systems, rebuild it as a view of that model
in the figure's own layout (`figure-rebuild`).

## The `user-scenario` kind

One file per journey (`user-scenario/0.4.0`; `0.3.0`, `0.2.0` and the draft
`0.1.0` are read unchanged), in a directory the layer declares with that
kind (conventionally `scenarios/user-scenarios/`).

**A journey IS a DAK user scenario.** The kind `specialises` the DAK
vocabulary's `user-scenario` block kind (its registry entry says so, and
`check:journey-refs` reads it). It keeps the DAK `UserScenario` fields —
`id`, `title`, `description`, `personas` — and everything else is optional
journey metadata: a file with only those four is a plain DAK user scenario,
listed by the viewer with no journey map. The two `personas` mean different
things and are one list: here an entry is an ACTOR (one fictional person)
or, from 0.4.0, a ROLE (which stands for the actors who play it); the DAK's
personas are ROLES, the BPMN swimlanes. So the DAK's are **derived**, never
written: each actor's `roles`, a role as it is (`dakUserScenario`,
`cat-harness-tools/scripts/journeys/derive.ts`). The check fails when a
journey's derived roles are empty or name a role no `roles.json` declares.

The journey metadata is the ordered `steps`:

| a step holds | what |
|---|---|
| `lead`, `experiences[]` | per person present: `doing`, `feeling` in their words, `emotion` −2..2. From 0.4.0 optional: absent, they are the persona actors who play the lanes of the step's `realisedBy` tasks, doing those tasks, the first leading. Authored, they are the narrative |
| `painPoint`, `enabler`, `policy` | what goes wrong without it, what makes it work, the policy point in one sentence |
| `record` | a code of the scenario's `trustLadder` code list, what it means here, where it is held |
| `handoff` | what passes on: `carrier`, `payload`, `offline` |
| `whatIf[]`, `gaps[]` | alternative paths; what the specification does not cover yet |
| `stories` | user story ids (`scenarios/stories.json`): role-level stories, persona-level steps |
| `realisedBy` | a BPMN file and the flow-node ids that carry the step out |
| `requirements`, `examples` | `req:` node ids; FHIR examples as `Type/id` |
| `uses[]` | a block of a `building-blocks/0.1.0` catalogue, and the ROLE it plays in this step |
| `illustration` | the step's picture (`src`, layer-relative), its `alt`, and the `prompt` to draw it when there is none yet (0.2.0) |
| `includes` | the journey this step IS, as a BPMN call activity is a process (0.4.0) |
| `dak[]` | the DAK assets the step uses, each `{ key, rel? }`: `key` is the asset's artefact-index key (`StructureDefinition/<logical model>`, `PlanDefinition/<decision table>`, `Measure/<indicator>`), `rel` what it is to the step: `data` a data set it records or exchanges, `decides` a decision table that decides something in it, `measures` an indicator that counts it (0.3.0) |

`user-scenario/0.4.0` accepts every `0.3.0`, `0.2.0` and `0.1.0` file as it
is, each by its own rules. 0.2.0 added `partOf`, `views`, `references`,
`illustrationStyle` and, on a step, `gaps`, `references` and `illustration`;
0.3.0 a step's `dak`; 0.4.0 `parts`, a step's `includes`, role personas, and
leaves out what can be derived (`personas` of a journey with parts, `steps`,
a step's `lead` and `experiences`). 0.4.0 refuses `partOf`.

**Derive `dak`, do not type it.** A DAK already says which BPMN tasks each of
its data sets and decision tables serves, and which journeys each indicator
measures; a step's `realisedBy` names its process and tasks. So the step's
`dak` list is a join of the two, written by the layer's own script from
its DAK sources and checked against them, never kept by hand beside them.
When `rel` is absent, the viewer goes by the key's resource type
(`StructureDefinition` data, `PlanDefinition` or `Library` decision logic,
`Measure` indicators).

**A picture carries no text.** The step's title and its caption are
translatable page text: the viewer renders the step's `title` above the image
and the illustration's `alt` below it, and neither is ever baked into the
image. A prompt asks for no readable text, signs or logos. The scenario's
`illustrationStyle` holds what every step's picture shares — the style
`prompt`, the `cast` (per actor, how they are drawn, so they stay the same
across steps) and `notes` (cultural notes, what never to draw) — so a step's
`prompt` says only its scene. Without a picture, the journey page shows a
collapsible *Illustration brief* (title, caption, scene, style, cast, notes)
for whoever draws it.

### Composition: the parent lists its parts

Journeys are narrative, so composition is **authored, never inferred from
the BPMN**: a process with sub-processes or call activities gets no journey
unless somebody writes one. One direction is written:

- **`parts`**, on the parent, in story order: `[{ scenario, optional?,
  repeats? }]`, `optional: true` when the story may skip the part, `repeats:
  true` when it may happen more than once. A journey may be a part of more
  than one parent. Whose part a journey is, and which part it follows, are
  derived from the list. A parent's `personas` may be left out: they are its
  parts'.
- **`includes`**, on a step: the step IS that journey. When the step's
  `realisedBy` names a call activity, the check holds them together: the
  call's `calledElement` must be a process the included journey is realised
  by. A call activity with no `includes` is fine and silent.
- **`follows`** still chains journeys no parent lists (J2 follows J1).

`partOf` (0.2.0) said grouping from the child, one parent only. Older files
keep it; a 0.4.0 file may not carry it, so a checkout has one way to group.
One journey is one BPMN process, usually.

**Nothing is said twice.** What is derived is not also written:
`check:journey-refs` reports a `follows` or `partOf` on a journey a parent
lists, `personas` that are exactly the parts', and a `lead` that is the
lanes' first actor as *redundant: remove it*.

| field | source | authored or derived |
|---|---|---|
| DAK `personas` (roles) | the persona actors' `roles` | derived |
| a role persona's actors | the actors whose `roles` name it | derived |
| `personas` of a journey with parts | its parts' personas | derived (authored only when it adds people) |
| a step's `lead`, `experiences` | the lanes of its `realisedBy` tasks | derived by default; authored as the narrative |
| a part's parent, and what it follows | the parent's `parts` | derived |
| `parts`, `includes`, `follows` between top-level journeys, step order | the story | authored |
| `dak` | the DAK's own trace of which tasks each asset serves | authored, generated and checked by the layer (no generic trace yet) |
| `requirements`, `examples`, `fhirChanges` | the step | authored (no story or index field links them to a step yet) |

Every person is fictional. A persona's name, role, goal, needs and
frustrations live on the actor (`meta.persona`), never on the journey. Two
presentation fields are **optional** there too: `initials` (up to three
letters for the avatar) and `color` (`#rrggbb` for the persona's lane and
feeling curve), and `avatar`, a square picture of the person (an image path
from the layer root, `scenarios/avatars/<actor>.webp`). Kept on the actor
when a demonstrator wants a fixed avatar; absent, the viewer derives the
initials from `name` and assigns colours in order. The picture, when there is
one, is drawn wherever the persona appears (cast, map, persona lens,
walkthrough, hand-offs, beside a device screen), the initials on the colour
otherwise. Nothing else reads them.

## The `building-blocks` kind

One `building-blocks/0.1.0` file per catalogue: its `layers` (each with the
question it answers) and `blocks` (a `tool`, `system`, `standard` or
`network`, its layer, jurisdiction, owner, what it is, why it matters, the
ArchiMate element keys that deploy it, links). A step's `uses[].block` names
a block by id, looked up in the journey's own layer first, then in every
layer the checkout mounts.

It is a kind of its own, not a family of `user-scenario`, because the
catalogue describes the architecture: it lives beside the layer's
ArchiMate model, where the overlay that draws those blocks reads it. Readers
find it **by declared kind, never by folder**, so declare the directory that
holds it:

```json
{ "id": "archimate", "path": "archimate/", "graphTypologies": ["archimate"] },
{ "id": "building-blocks", "path": "archimate/building-blocks/", "graphTypologies": ["building-blocks"] }
```

Declare it nested, not as a second kind of `archimate/` itself: every kind of
a directory claims every typed node in it, so `check:kind-validators` would
report the catalogue unmapped under `archimate` and the ArchiMate config
unmapped under `building-blocks`. A catalogue in an undeclared folder, or in
a journeys directory, is not read.

## The `workshop` kind

One `workshop/0.1.0` file per workshop, in a directory declared `workshop`.
It names the `scenarios` it teaches from and, per step it uses
(`{ scenario, step }`): the question for the whole room, a facilitator cue,
the module questions (each tagged with its module), the capabilities the
step needs, and which rows of which `tables` it touches. Tables are generic
(decision rights, legal bases, substitution patterns, cost drivers are rows a
workshop names, not fields of the kind). `assessment` gives the scales a table
rates a capability on; `sheets` the printable canvases; `resources` the job
aids, handouts and readings, each tied to modules or steps. **A question is a
question:** a module asks a room to name, not to decide.

The journey never names the workshop. One journey can be taught by several
workshops to several audiences without changing.

## The `device-screen` kind

What one person sees on their own device at one or more steps: one
`device-screen/0.1.0` file per screen, in a directory declared
`device-screen` (conventionally `scenarios/device-screens/` or
`device-screens/`). It names its `device` (`phone`, `tablet`, `scanner`,
`desktop`, `kiosk`), its `owner` (the actor whose device it is), the `steps`
it shows (`{ scenario, step }`), what to `try` on it in the room, and its
`blocks`, top to bottom:

| block | shows |
|---|---|
| `header` | the app's name, a line under it, a brand colour, a status chip |
| `personCard` | an actor (name and avatar from its persona), with fields and chips; `banner` for a patient bar |
| `qr` | a QR code of `payload`, shown or being scanned; may name the FHIR example it carries |
| `passcode` | digits shown, hidden, or being entered |
| `statusBadge` | verified, unverified, failed, emergency or info, with fields and a verdict |
| `recordList` | rows of icon, label, code, detail and status (`struck` for an allergy); may take its rows from a FHIR example |
| `fields` | labelled values, as a form shows them |
| `consent` | who may see what until when, and whether it is granted |
| `alert` | a message at a severity |
| `actions` | buttons, labels only |
| `note` | small print |

**Data, never markup.** There is no free HTML, and an icon is a name from
a closed glyph list: the screen says what is shown, the viewer how. A block
with `column: "side"` goes in a second column on a wide device. **Do not
build a device-demo app of your own:** a screen is content, like the journey
it shows. A workshop's `presentation.deviceDemo` (an app framed in an
iframe) is only a fallback for when no screen is declared.

## The viewer

Declare it in the layer that publishes the site:

```json
{ "id": "journeys", "renderedBy": "journeys-viewer", "coversKinds": ["user-scenario", "workshop", "device-screen"], "subgraphs": "instance" }
```

A site build runs it with the other declared writers. It writes, under the
path `<locale>/<instance>/journeys/`, an index of every journey in the checkout
(the mounted layers' included, each layer a sub-graph page, each parent's
parts nested under it in order, an optional or repeating part marked), a page per
journey (its parts in order, the journeys it is a part of, journey map, then step by step, a step that `includes` a journey linking to it with the step's BPMN flow nodes
highlighted and the workshop layer under each step), and a page per workshop,
per module and for the printable sheets. Everything is static; one small
script adds the stepper, a filter and remembering a table's ticks in the
browser. A workshop's walkthrough has a Device Demo (`demo/`): each device
screen that shows a step it presents, drawn as a static device mock with its
owner beside it; each step links to the screens that show it
("See what `<owner>` sees") and each screen back to its steps. An edge that
resolves to nothing is drawn as unresolved, never dropped.

A step's `dak` assets are drawn as one small **DAK** row, grouped Data,
Decision logic, Indicators, each asset linked to its page in the IG through
the artefact index, as FHIR examples and personas are. An asset the index
does not list is drawn as text, not linked.

## The VaxLink overview: what a guide declares to get it

A workshop's `overview/` is the VaxLink overview, drawn by the shared viewer
(the generic address is `<locale>/<instance>/journeys/<instance>/workshops/<id>/overview/`;
never build or keep a walkthrough app of your own, and point an old app's
address at this one). It is only as complete as the data behind it, and a part
with no data is left out silently, so a guide that wants the full overview
declares all of this:

| on the page | comes from |
|---|---|
| the app bar, the story in one sentence, the lede, the outward links | the workshop's `presentation`: `name`, `tagline`, `story`, `lede`, `links`, `about`, `views`, `closingQuestion`. Without a `story` the hero shows the workshop's `description`, which is the room's question, not the story |
| a picture per moment | each step's `illustration` |
| the icon strip under each moment | the journey's `scene`: three or so `{ icon, label }`, icons from the closed list `check:journey-refs` names |
| "Follow the record" and each step's meter | a `code-list` (conventionally `code-lists/record-trust.code-list.json`) named by every journey's `trustLadder`, each step's `record.state` one of its codes, and `presentation.recordOf` naming whose record it is |
| the people | the journeys' personas, through the actors |
| the Device Demo | `device-screen` nodes for the steps |

**Link it from the guide.** The guide's own journey page and its landing page
lead into the overview (a hero with "Start the walkthrough" and "See the whole
journey map", generated from the same `presentation`), so a reader of the IG
finds it. An overview no page links to is as good as missing: the owner asked
for one that already existed (2026-11-10, smart-ips-pilgrimage).

`check:journey-refs` reports each of these that a workshop's journeys lack as
a warning (`overview-gap`), so a gap is seen at check time, not in review.

## Checks

`check:kind-validators` parses every node of the four kinds against their
Zod (`cat-harness-tools/schemas/process/user-scenario.ts`, `workshop.ts`,
`device-screen.ts`):
step ids unique, every actor a step names among the personas (before 0.4.0;
from 0.4.0 `check:journey-refs` holds it against the derived personas), every module,
table, row and sheet a workshop names declared in it.

`check:journey-refs` (Tool `journey-refs`) checks what crosses files, with
the viewer's own resolver, so a reference the page draws as resolved is
exactly one that passes:

| a journey names | it must resolve to |
|---|---|
| `personas`, `lead`, `experiences[].actor`, `handoff.from`/`to`, `illustrationStyle.cast[].actor` | an actor in a `scenarios` directory |
| `stories` | a story in a `scenarios` directory's `stories.json` |
| `realisedBy[].process`, `.tasks` | a BPMN file relative to the layer root, and element ids in it |
| `uses[].block` | a block of a catalogue in a `building-blocks` directory |
| `requirements`, `preconditions[].requirements` | a `req:` node |
| `examples`, `fhirChanges[].examples`, `dak[].key` | an entry of a `fhir-artifact-index` (could not determine while the index is built at publish) |
| `illustration.src` | a file relative to the layer root |
| `follows`, `partOf`, `parts[].scenario`, `includes` | a journey; parts and includes form no cycle |
| `trustLadder`, `record.state`, `views` | a code list and a code of it; an ArchiMate view the layer's config names |
| a persona (0.4.0) | an actor, or a role in a `roles.json` |
| the journey, as a DAK user scenario | derived roles that are not empty, each a declared role |
| `includes` on a step whose `realisedBy` names a call activity | a journey realised by the called process (could not determine when the call names none) |

and every workshop's `scenarios`, `steps[]` `{scenario, step}`,
`discussion[].steps` and `resources[].steps` (`<scenario>#<step>`) name a
journey and a step of it; every device screen's `owner` and `personCard`
actors are actors, its `steps` are steps of journeys, and the examples its
`qr` and `recordList` blocks name are in a `fhir-artifact-index`; and every
persona's `avatar` is a file of its layer. A file that does not parse is a
finding too. It
runs over the whole checkout, so a workshop teaching from another layer's
journeys is checked whole; the layer pull-request checks run it with every
other `check:` script.
