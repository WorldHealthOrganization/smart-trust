Three distinct roles participate in a CRDM cycle. The boundaries between
them matter — collapsing the first two into one person loses the quality
gate that makes the process work.

### Feature Requestor / Business Analyst (BA)

The person who identifies a need and initiates the CRDM cycle. In
folio-assistant this is typically a content author, editor, or programme
lead who encounters a gap in the platform while doing their work.

The BA is also the **coordinator** of the CRDM process:

- **Initiates** — describes the need in a GitHub issue or chat session.
- **Interacts with the agent** — the BA is the agent's primary
  counterpart. They refine needs, review synthesised requirements,
  negotiate scope, and decide what constitutes a viable MVP.
- **Coordinates with stakeholders** — the BA understands the broader
  context: who else is affected, what workflows will change, whose
  sign-off is needed. They bring stakeholders in at the right moments
  (review, testing, approval) rather than expecting them to participate in
  every iteration.
- **Accepts or rejects iterations** — during Phase 6, the BA reviews
  each increment the agent delivers, decides whether it meets the
  requirement, and either accepts it or requests changes.

The BA does not need technical expertise. They need domain expertise — they
know what the feature should *do*, not how it should be *built*. The agent
handles the technical design and implementation.

### Stakeholders

The people affected by the feature who must review and approve it, but who
are **not** in the day-to-day development loop with the agent. Examples:

- A **review committee** that must approve changes to a guideline's
  normative content.
- **Country programme managers** who will use the localisation feature in
  their context.
- **IT teams** who must deploy and maintain the result.
- **End users** who will interact with the new capability.

Stakeholders participate at defined checkpoints, not continuously:

| Checkpoint | What stakeholders do |
|---|---|
| **Needs review** (Phase 1) | Confirm the BA's needs statement reflects their reality |
| **Requirements sign-off** (Phase 5) | Approve that the requirements are correct and complete |
| **MVP testing** (Phase 6) | Test the delivered feature in their context, report findings |
| **Feature sign-off** (Phase 6) | Confirm the feature meets their needs; close the issue |

The BA **bridges** the gap: stakeholders should never need to read a PR,
understand a work item, or interact with the agent directly.

### Agent

The AI assistant that implements the CRDM process and builds the feature.
The agent:

- **Facilitates** — guides the BA through the CRDM phases, synthesises
  inputs, proposes requirements, identifies impacts.
- **Implements** — writes code, creates tests, opens PRs, posts summaries.
- **Iterates** — responds to BA feedback, adjusts implementation, re-runs
  validation.
- **Documents** — maintains the GitHub issue as the single source of truth
  for stakeholders, posts implementation summaries, updates documentation.

The agent interacts with the **BA only**, not with stakeholders directly.
If stakeholders have feedback, it flows through the BA who translates it
into actionable direction for the agent.

```
Stakeholders ──review/approve──▶ BA ──directs──▶ Agent
                                  ◀──delivers────┘
```
