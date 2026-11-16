Every **process** in the docs is BPMN. The diagrams that remain Mermaid are not
processes, and BPMN would be the wrong notation for them — a pool with lanes
implies actors performing activities over time, which none of these have:

| Diagram | Notation | Why |
|---------|----------|-----|
| `README.md`, [home]({{ site.baseurl }}/index.html) — "What it does" | Mermaid | Component / data-flow map of the platform, not a sequence of activities |
| [Architecture]({{ '/docs/cat-harness/concepts/architecture.html' | relative_url }}) — server and adapters | Mermaid | Deployment and module structure |
| [Skills & roles]({{ '/docs/cat-harness/concepts/skills.html' | relative_url }}) — how the five concepts compose | Mermaid | Conceptual composition, no time axis |
| [Skills & roles]({{ '/docs/cat-harness/concepts/skills.html' | relative_url }}) — `viewer → reviewer → author → admin` | Mermaid | An inheritance lattice, not a flow |
| [Home]({{ site.baseurl }}/index.html) — documentation map | Mermaid | Navigation graph |
| [Adding a content type]({{ '/docs/cat-harness/guides/new-content-type.html' | relative_url }}) — "What you provide" | Mermaid | What you hand over, not what you do |
| [Writing a paper](https://litlfred.github.io/folio-assistant/folio-assistant-sci/guides/writing-a-paper.html) — the Lean session | Mermaid `sequenceDiagram` | An interaction transcript between you, the assistant and the MCP server. BPMN's equivalent — a collaboration with message flows — would add ceremony without adding meaning |

If you add a diagram that *does* have actors, activities and a control flow,
it belongs in `processes/` as BPMN, not in a Mermaid fence.

---
