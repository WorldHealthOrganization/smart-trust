A user–agent interaction is always in exactly one of two states:

### Idle state

The agent has no active workflow. It is waiting for a user request. On receiving
one, it classifies the request (see [Request classification](#request-classification))
and transitions into the appropriate workflow state.

### Workflow state

The agent is executing a named workflow — each represented by a BPMN process
diagram with the agent and user in separate swim lanes. The active workflow
determines what the agent does next and what it expects from the user.

Active workflows in this platform (the authoring, content-lifecycle,
draft-to-publication and evidence-retrieval diagrams ship with the content
layer, not this one):

| Workflow | BPMN source | Entered when |
|---|---|---|
| **Authoring (paper)** | `authoring-a-paper.bpmn` | User requests content authoring in a paper folio |
| **Authoring (document)** | `authoring-a-document.bpmn` | User requests content authoring in a document folio |
| **Content lifecycle** | `content-lifecycle.bpmn` | Content moves through validate → render → publish |
| **Document ingestion** | [`document-ingestion.bpmn`](https://github.com/litlfred/cat-harness/blob/main/processes/library/document-ingestion.bpmn) | User drops a file in `uploads/` |
| **Draft to publication** | `draft-to-publication.bpmn` | Content moves from draft to published |
| **CRDM requirements** | [`crdm-requirements.bpmn`](https://github.com/litlfred/cat-harness/blob/main/processes/process/crdm-requirements.bpmn) | Agent detects a feature request |
| **Evidence retrieval** | `evidence-retrieval.bpmn` | Agent searches for evidence to support a claim |

**State transitions:** a workflow can be **suspended** when the user asks to
switch context. The agent records where it was (the current BPMN activity) and
can resume later. Only one workflow is active at a time, but suspended workflows
form a stack — the most recent is resumed first.

The key rule: **the agent always knows which workflow it is in**. If it does
not, it is in the idle state, and the next request starts a new workflow.
