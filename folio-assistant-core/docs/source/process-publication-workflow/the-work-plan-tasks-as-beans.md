Every diagram has a **Work plan** lane, and it is not decoration. Editing work
is tracked as **beans** ([hmans/beans](https://github.com/hmans/beans)) in a
committed `beans/` directory, which makes it the one place where a human and
an agent see the same answer to *what is done, and what is next*.

| Where in the workflow | What happens to the work plan |
|-----------------------|-------------------------------|
| Plan is agreed | The plan is seeded as beans |
| An edit starts | The bean is **claimed** (`--status in-progress`) before any drafting |
| Validation reports | Findings are appended to the bean |
| The change is committed | The bean is resolved — or left open with what is still outstanding |
| Review requests changes | Each request is opened as its own bean |
| A release ships | Shipped work is closed; what slipped stays open into the next cycle |

Why it is modelled as a lane rather than a note:

- **It is shared state, not session state.** `beans/` is committed, so the plan
  survives a resumed session and is visible to sibling agents working other
  branches. An agent's ephemeral in-memory to-do list is not.
- **Claiming is how two workers avoid the same item.** Claim before you work,
  and never resolve someone else's bean.
- **`beans create` is not idempotent.** Check for an existing bean by exact
  title before creating one; the guard is in
  [`todo-manager`]({{ '/reference/skill-instructions/todo-manager.html' | relative_url }}).
- **Beans are not sidecars.** Machine-generated queues (QA `*.qa.json`, witness
  files, watcher queues) stay bulk JSON; they never become beans.

---
