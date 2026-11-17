An **agent** uses **skills** to execute one or more **tasks** in a **process**.
It works with a knowledge graph of static context (skills, user stories) and
dynamic context. A skill may have zero or more **tools**, used for **test**
execution anywhere on the deterministic-to-agentic spectrum.

- **Role:** played by a human, agentic or mechanical actor; a swimlane in BPMN.
- **Task:** a step in a process; a node in BPMN.
- <img src="{{ '/assets/img/kg-deck/img-p006-4.webp' | relative_url }}" alt="" height="24" style="height:24px;width:auto;display:inline-block;vertical-align:middle" loading="lazy"> **Skill:** a gated capability with schema-defined inputs and outputs.
- **Test:** used to compare models, or for author review.
- <img src="{{ '/assets/img/kg-deck/img-p006-2.webp' | relative_url }}" alt="" height="24" style="height:24px;width:auto;display:inline-block;vertical-align:middle" loading="lazy"> **Agentic state:** *work items*, which agents use to coordinate and track their
  state within a process ("changes to the vaccination schedule ready for review in
  staging").
- <img src="{{ '/assets/img/kg-deck/img-p006-3.webp' | relative_url }}" alt="" height="24" style="height:24px;width:auto;display:inline-block;vertical-align:middle" loading="lazy"> **Human state:** *todos*, attached to process steps or knowledge assets
  ("please review this change in medication").

![Folio lifecycle — one cycle, plan to retire. A BPMN collaboration of five lanes: programme manager, editors and authoring agents, validation and QA, review team and SMEs, publication manager, with the work plan (work items shared by humans and agents) drawn as a data store that the seeding and feedback tasks write to. Tasks in order: plan scope, team and artefacts; seed the work plan; editing and HCI validation; integration test and QA sweep; draft, review and publish; triage published feedback; file feedback as work items; then a gateway, more content, which loops back to editing or ends in retire or archive.]({{ '/assets/img/workflows/content-lifecycle.svg' | relative_url }})

<details markdown="1"><summary>The diagram as it appeared on the slide (2026-09-30)</summary>

<a href="{{ '/assets/img/kg-deck/img-p006-1.webp' | relative_url }}"><img src="{{ '/assets/img/kg-deck/img-p006-1.webp' | relative_url }}" alt="BPMN diagram &quot;Folio lifecycle — one cycle, plan to retire&quot;, in six horizontal lanes. Programme manager: Folio initiative (start), Plan scope, team, artifacts [content-plan]. Work plan — beans (shared by humans and agents): Seed the work plan [todo-manager]. Editors + authoring agents: Editing and HCI validation [content-author], a subprocess. Validation and QA (mechanical + agents): Integration test and QA sweep [content-test], a service task. Publication manager: Draft, review and publish [content-publish], a subprocess. Review team and SMEs: Triage published feedback [content-feedback]. Work plan again: File feedback as beans [todo-manager]. Programme manager: gateway &quot;More content?&quot; — yes loops back to editing; no leads to Retire or archive [content-retire] and the end event Folio retired. Each bracketed name is the skill the task runs." loading="lazy"></a>

</details>

**How the slide labels the diagram.** On the slide the terms sit around the
BPMN picture and lines tie each one to a part of it:

- **Process** points at the whole diagram, captioned *(publication lifecycle)*,
  with *(Context)* beside it.
- **User Story** is tied to **Role**, and **Role** to one lane, the one labelled
  *Editor* (editors and authoring agents).
- **Task** points at one node in that lane, *Edit Doc* (today: editing and HCI
  validation).
- **Skill** hangs off that task, and **Test** hangs off the skill.
- The work items icon sits by agentic state and the sticky note by human state.

So the slide says a user story names a role, a role is a lane, a task is a node
in it, a skill belongs to a task, and a test belongs to a skill.

**Sources:** the content core's `processes/content/content-lifecycle.bpmn` (the picture above is generated
from it); [work items and todos](../guides/beans-and-todos.html).

> **Aligned:** the snapshot's diagram and today's process have the same six
> lanes and the same eight tasks.
