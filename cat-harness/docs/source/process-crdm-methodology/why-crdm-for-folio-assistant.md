folio-assistant is a **platform**, not an application with a fixed feature set.
Authors, editors, and reviewers working in folio repositories regularly discover
needs that are not content — they are **capability gaps** in the platform itself:
a missing block kind, a QA criterion that does not exist, a rendering mode that
does not handle their document structure, a workflow step that has no tooling.

Without a methodology, agents improvise: a feature request arrives as a chat
message, the agent
builds something that addresses the immediate symptom, and the result does not
compose with the rest of the platform — because nobody mapped the current
workflow, identified who else is affected, or wrote the requirements down before
coding started.

CRDM solves this by inserting a **structured requirements phase** between "I need
this" and "here is the code". The methodology is a natural fit because
folio-assistant already has the primitives it needs:

| CRDM concept | folio-assistant primitive |
|---|---|
| Stakeholder identification | `<name>.config.json` roles, GitHub CODEOWNERS |
| Business process documentation | BPMN workflow diagrams under `processes/` |
| Requirements artefact | GitHub issue with structured fields |
| Work-plan items | `beans` — the single todo mechanism |
| Impact analysis | Content graph (`content-graph.ts`), schema constraints, QA registry |
| Iterative review | PR-based feedback, `content_validate`, `qa_sweep` |

The goal is not to add ceremony. It is to make the agent **recognise** when a
request is a feature rather than content, and shift into a requirements-gathering
mode rather than jumping straight to implementation.
