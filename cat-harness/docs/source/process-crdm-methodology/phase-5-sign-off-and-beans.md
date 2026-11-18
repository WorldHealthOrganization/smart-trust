The requirements and impact analysis are presented to the user (and any
identified stakeholders) for review and sign-off. This is the gate between
requirements and implementation.

**The sign-off process:**

1. **Present the consolidated requirements** — the agent produces a summary
   comment on the GitHub issue containing:
   - The need statement (Phase 1)
   - The current-state workflow and gap (Phase 2)
   - The requirements checklist (Phase 3)
   - The impact assessment and migration plan (Phase 4)

2. **Solicit feedback** — ask the user and stakeholders to review. The review
   happens **on the issue**, not in chat — so it is visible, linkable, and
   survives beyond any single session. This is the transparent review process:
   comments, questions, and revisions are all recorded in the issue thread.

3. **Iterate** — if the review surfaces new requirements, missing stakeholders,
   or concerns about the impact, cycle back to the relevant phase. The issue
   thread records each iteration.

4. **Create work items** — once the requirements are agreed, the agent creates
   `beans` for each unit of implementation work. Each work item:
   - References the parent issue
   - Has a clear title describing the deliverable
   - Is scoped to a single PR-sized unit of work
   - Is created using the [check-before-create
     protocol](https://litlfred.github.io/folio-assistant/docs/cat-harness/guides/agent-onboarding.html)
     to avoid duplicates

5. **Record the decision** — the sign-off comment on the issue serves as the
   decision record. It states what was agreed, what was deferred, and links to
   the work items that will implement it.

**Deliverable:** a sign-off comment on the issue, plus work items for each work item.
