| In the diagrams | Actor | What it does — and what it cannot do |
|-----------------|-------|--------------------------------------|
| **Authoring agent** | `authoring-agent` | Drafts and revises a **proposed** change. Has `content-authoring`; **does not commit** — its output goes to the editor through the validation gate. |
| **Review agent** | `review-agent` | Non-mechanical validation: accuracy, voice, exposition. Has `review-comments` only — it reports findings, it does not approve. |
| **Mechanical validation** | `lean-mcp` | Lean 4 proof checking and diagnostics over MCP. |
| | `ig-publisher-service` | FHIR IG Publisher build and QA reporting. |

The distinction the diagrams enforce: **an agent can propose and can report, but
approval and commit are a person's.** A review agent's finding and an SME's
finding arrive at the same place in the pipeline — but neither of them decides;
the editor does, and the release is authorised by the programme manager.

For the full role list, their capabilities, and how a user is mapped to a role,
see [Skills & roles]({{ '/docs/cat-harness/concepts/skills.html#roles-actors' | relative_url }}).

---
