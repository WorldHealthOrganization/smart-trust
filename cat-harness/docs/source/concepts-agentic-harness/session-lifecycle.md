Every agent session follows the same lifecycle:

1. **Start** — run the session-start sweep (`beans prime`, `beans list`,
   `scripts/session-start-coord-sweep.sh`). This surfaces the current
   work-plan, how far the default branch has moved, and recent sibling branch
   activity. See the `todo-manager` skill.

2. **Classify** — each user request is classified (see next section) and
   routed to the appropriate workflow.

3. **Execute** — the agent works within the active workflow, following its
   BPMN process. Each turn reports the work item being worked on and what is next.

4. **Commit** — every meaningful unit of work gets its own commit and push.
   PRs are opened at the first commit, not the end. See the
   `continual-progress` skill.

5. **Handoff** — when the session ends (user leaves, context limit, token
   exhaustion), the agent's durable state is:
   - Committed and pushed code
   - Work items updated with status and notes
   - Issue comments with summaries of what was accomplished
   - The chat is ephemeral; everything else survives
