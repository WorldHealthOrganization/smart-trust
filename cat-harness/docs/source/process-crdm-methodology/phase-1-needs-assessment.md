The agent helps the user articulate **what they need and why**, before anyone
discusses how to build it. This is where most ad-hoc requests go wrong — the
solution is specified before the problem is understood.

**What the agent does in this phase:**

1. **Identify the requester and stakeholders** — who is asking, who else is
   affected? A Word-document import request
   came from one person but affects anyone doing public consultation review,
   HRH handbook adaptation, or PCMT traceability. The agent should surface
   those connections.

2. **Synthesise the need from multiple sources** — a requirement rarely arrives
   as a clean statement. It comes from a chat message, a GitHub issue, a
   discussion thread, a review comment. The agent gathers these fragments and
   presents a consolidated statement of need back to the user for validation.

3. **Suggest other stakeholders** — if the request touches a workflow that
   others use (e.g. country adaptation, formal review processes), the agent
   should identify who else should weigh in and propose inviting them.

4. **Document the "why"** — every requirement gets a rationale. Not "import
   Word documents" but "enable public consultation comment triage through a
   structured ingestion pipeline, so that SAG members can review and approve
   changes through a formal process."

**Deliverable:** a GitHub issue (or issue comment) with:
- Statement of need
- Identified stakeholders
- Rationale linking the need to a concrete workflow
- References to the conversation or discussion that surfaced the need
