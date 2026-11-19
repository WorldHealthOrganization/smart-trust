- **A lane is a role.** Every lane maps to an actor in
  [`cat-harness/scenarios/actors/`](https://github.com/litlfred/folio-assistant/tree/main/cat-harness/scenarios/actors) —
  see [Who is who](#who-is-who).
- **`[skill-name]` under an activity** is the folio-assistant skill that
  implements it. The same reference is carried machine-readably as a
  `<bootstrap.processes:skill ref="…"/>` extension element on the BPMN activity.
- **The "Work plan — beans" lane** is the shared to-do store. Steps in that
  lane read and write `beans/`, and are marked `<cat-harness.processes:bean store="beans/"/>`
  in the source.
- **A thick-bordered box is a call activity** — it expands into another diagram
  on this page.

---
