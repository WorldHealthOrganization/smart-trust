Feature work must be linked to a GitHub issue. Content work uses work items. The
two are related but not synonymous.

### Issues vs beans

| | GitHub issue | Work item |
|---|---|---|
| **Scope** | A feature, requirement set, or user story | A single PR-sized unit of work |
| **Audience** | Stakeholders, requestor, BA | Agent, developer |
| **Lifecycle** | Open → requirements → sign-off → implementation → close | Created → in-progress → resolved |
| **Relation** | One issue has many work items | Each work item references its parent issue |

### Rules for agents

1. **Feature work → issue first.** Before implementing, check:
   - Is there an existing open issue? Search by keywords.
   - If no open match, check recently closed issues.
   - If no match at all, ask the user to create one. **Do not create an issue
     without user permission.**

2. **Always feature branch + PR.** No exceptions for feature work. The branch
   name should reference the issue number (e.g. `feat/197-word-import`).

3. **Always ask before merging to main.** The user must explicitly confirm.
   Feature changes affect the platform.

4. **Post round summaries to the issue.** After each round of implementation
   (one or more work items resolved), post a comment on the linked issue containing:
   - What was accomplished in this round
   - What remains to be accomplished (open work items)
   - Links to updated content for review (staging URLs, docs pages)
   - Before/after comparison table for changed pages

5. **Never close an issue without explicit authorization.** The BA or
   stakeholder closes it. The agent closes it only when the BA explicitly
   says to. An agent must never assume completion.

6. **Requirements may span multiple issues.** The agent should link to all
   relevant issues and note the relationships.

7. **Work items are not issues.** `beans create` is for work-plan items. Issues are
   for stakeholder-facing requirements. Do not conflate them.
