- **Tool repos** may implement a skill through coordinated tools (scripts,
  retrieved software, local or remote services, containers). They may make tools
  available to agents over MCP or for local execution, configure tools for the
  test harness (the ITB), and define more than one tool for a skill.
- **Content repos** may define schemas for the content types of KG nodes and
  instantiate them. They may define the skills needed to publish and consume
  that content, and designate each skill agentic, mechanical or human. They
  **must** constrain skill inputs and outputs with schemas (JSON, `.ts`).
- **Test repos** may hold test data, test-data generation templates and
  configuration, FHIR test plans and test-language dialects (Gherkin), and may
  make test data available to the ITB and to SME review.
- **Consumer apps** may use KG schemas and instance data from content repos,
  execute their decision logic or indicator calculations, and use test and tool
  repos to develop, prepare for a connectathon or test compliance.

**How the slide relates them.** Slide 10 draws named repositories joined by
labelled lines. The lines carry no arrowheads, so the direction below is read
from each label, not from the drawing:

| from | relation | to |
|---|---|---|
| `who/smart-kg` | depends on | `who/<dak-layer>` |
| `who/smart-immz` | depends on | `who/<dak-layer>` |
| `who/smart-kg` | references | `who/smart-kg-tools` |
| `who/<dak-layer>` | references | `who/smart-base-tools` |
| `who/smart-immz` | references | `who/smart-imz-test` |
| `who/smart-kg-tools` | utilizes | `who/smart-base-tools` |
| `who/smart-imz-test` | utilizes | `who/smart-base-tools` |
| consumer apps | utilize | `who/smart-immz`, `who/smart-imz-test` |

Read as a rule: **depends on** runs content to content, **references** runs from
content to its own tools and tests, and **utilizes** runs from a tool, a test or
an app to what it uses.

**Source:** [Repo taxonomy](architecture/repo-taxonomy.html).

> **Aligned:** slide 10's `who/smart-kg` is a real, separate repository, which
> is the repo taxonomy's worked example of splitting content from tools.
