**It begins by calling the basic flow.** The first step is a call into
`document-ingestion.bpmn`, the basic ingestion flow every asset takes: the
upload is accepted, its metadata goes into the knowledge graph, and the asset is
catalogued in `library/`. That flow makes no content-type decision; everything
after the call is the document-specific refinement.

**The Ingestion Engine is an actor, not a script.** It runs unattended. A drop
during an editing session triggers ingestion in the background — the
contributor does not wait for it, and nothing about the editing flow blocks on
it.

**The failure edge is a bean, not a log line.** When the completeness gate finds
a missing derived artefact, the engine opens a bean and the document **stays in
`uploads/`**. It does not land half-ingested in `library/` looking finished.

**Each subprocess is its own file**, called with `bpmn:callActivity` and
declared with `bpmn:import`, so each opens on its own in bpmn.io.

**The end is where authoring begins.** "Available to cite as an L1 source" is
the hand-off into [the publication workflow](../process/publication-workflow.html) — the
same corpus an author edits and a reviewer reviews.
