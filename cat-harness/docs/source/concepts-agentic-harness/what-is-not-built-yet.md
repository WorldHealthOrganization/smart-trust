- **Suspended-workflow stack** — workflow instances are persisted in the
  `beans/` graph, but the suspend-and-resume stack described above is not;
  work items and issue comments stand in for it.

- **Automated request classification** — the classification table is a
  reference for agents to read; there is no classifier tool that routes
  automatically.

- **BPMN for work items lifecycle** — the work items work-plan has a lifecycle (create →
  claim → in-progress → resolve) described in the todo-manager skill but has
  no BPMN diagram.

- **BPMN for the agentic harness itself** — a top-level BPMN diagram showing
  the idle/workflow state machine and the classification routing is not yet
  authored.

- **Session handoff protocol** — the rules for what to commit before a session
  ends are in the `continual-progress` skill, but there is no structured handoff artefact that a
  new session can read to resume exactly where the previous one left off.
