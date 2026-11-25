Before changing the platform, understand **how the work is done today**. The
agent maps the current workflow — manually if needed — and identifies where the
gap actually sits.

**What the agent does in this phase:**

1. **Map the current workflow** — use the existing BPMN diagrams under
   `processes/` as a starting point. If the affected workflow is already
   diagrammed (e.g. the content lifecycle, the publication pipeline, the
   document ingestion flow), read it and identify the specific activity or
   decision point where the gap appears.

2. **Identify bottlenecks and pain points** — the request "import Word
   documents" might mask a deeper problem: "the public consultation feedback
   arrives as an Excel spreadsheet and a Word document, and there is no way to
   triage 200 comments without manually reading each one." The agent should
   probe for the real bottleneck.

3. **Check existing capabilities** — before proposing new tooling, verify what
   already exists. folio-assistant's ingestion pipeline already handles PDFs,
   images, and structured text. Does the request require a new capability or an
   extension of an existing one?

4. **Document the current state** — write up the as-is workflow, either as
   prose in the issue or as a BPMN fragment. This becomes the baseline against
   which the redesign is measured.

**Deliverable:** a current-state workflow description attached to the issue,
identifying exactly where the capability gap sits.
