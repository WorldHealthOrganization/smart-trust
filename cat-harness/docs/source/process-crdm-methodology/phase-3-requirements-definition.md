Translate the understood need into **specific, actionable requirements** with
proposed tooling descriptions. All requirements should be developed fully, with
proposed `.ts` skills, software tooling descriptions, and requirements for
folio-assistant SOPs.

**What the agent produces in this phase:**

1. **Functional requirements** — each stated as a testable capability:
   - "The ingestion engine SHALL detect `.docx` files in `uploads/` and extract
     semantic structure (headings, lists, tables) into Markdown."
   - "The review triage tool SHALL present comments grouped by document section
     and allow batch accept/reject/defer decisions."

2. **Proposed skills and tooling** — for each requirement, a concrete
   description of the skill or tool that implements it:
   - Skill name, description, and which adapter it belongs to
   - Input/output contract
   - MCP tool registration (if applicable)
   - QA criteria (if applicable)

3. **Schema changes** — if the requirement needs new types, block kinds,
   constraint rules, or configuration fields, these are specified here with
   their Zod schemas.

4. **Pipeline changes** — if the requirement needs new pipeline scripts under
   `content/pipeline/`, new validators, or new renderers, the file names and
   responsibilities are listed.

5. **Acceptance criteria** — how we know the requirement is met. Each criterion
   should be mechanically testable where possible.

**Deliverable:** a requirements document in the GitHub issue, structured as a
checklist of capabilities with their proposed implementations. Each requirement
links back to the need (Phase 1) and the workflow gap (Phase 2) it addresses.
