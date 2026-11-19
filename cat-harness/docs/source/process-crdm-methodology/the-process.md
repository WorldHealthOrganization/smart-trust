The diagram above shows the full CRDM workflow as a BPMN 2.0 collaboration
with three swim lanes:

- **BA / Feature Requestor** — initiates the request, reviews needs and
  requirements, signs off, reviews each increment the agent delivers,
  decides when to share an MVP with stakeholders, translates stakeholder
  feedback into agent-actionable direction, and confirms final delivery.

- **Agent** — detects the feature request, scans for matching issues, runs
  through the six CRDM phases, creates work items, implements on feature
  branches, posts summaries to the issue.

- **Stakeholders** — confirm needs, approve requirements, test the MVP in
  their own context, and do final feature sign-off on the issue.

Three feedback loops are visible:

1. **Needs loop** (Phase 1) — the agent synthesises needs, the BA reviews,
   stakeholders confirm. If revisions are needed, the agent re-synthesises.

2. **Requirements loop** (Phases 3–4) — the agent defines requirements and
   impact analysis; the BA reviews, stakeholders approve; iterate until
   approved.

3. **Dual development loop** (Phase 6):
   - **Inner loop** (BA ↔ Agent) — the agent implements an increment, the
     BA tests it against acceptance criteria. Fast — multiple iterations
     per session.
   - **Outer loop** (BA → Stakeholders) — when the BA judges enough
     increments constitute a testable MVP, stakeholders test it. Findings
     flow back through the BA to the agent. Slower — stakeholder cadence.

The BA is the **bridge**: they keep the agent productive in the inner loop
while waiting for stakeholder availability in the outer loop.

See the [agentic harness](../concepts/agentic-harness.html) page for how this
workflow fits into the broader agent–user interaction model.
