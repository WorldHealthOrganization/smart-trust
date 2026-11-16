Every process here is a real BPMN 2.0 document with diagram interchange — open
it in [bpmn.io](https://demo.bpmn.io/), Camunda Modeler, or any BPMN tool. The
SVGs are generated from those files by `bun run cat render:bpmn`; never hand-edit
an SVG.

**The table below is not written on this page.** It is read from the
published knowledge graph — the [named-subgraph JSON-LD]({{ '/subgraph/index.jsonld' | relative_url }})
that `bun run cat subgraph:jsonld` frames from `kg-export` — by walking each
layer's `processes` subgraph. Each row's text is the first sentence of that
diagram's own `bpmn:documentation`, carried on its `Process` node as
`summary`. To change what a row says, change the diagram. The
[derived process index]({{ '/cat-harness/auto-docs/index/processes/' | relative_url }}) lists this
layer's corpus of diagrams with their lanes and skills.

**Bootstrap's diagrams are in the table, read from bootstrap's own graph.**
`bootstrap` and `bootstrap-tools` sit below this layer and publish their own
named subgraphs at their own sites; the repository index here links each with
`seeAlso`, and the table follows those links. If that site cannot be read, the
page says so beside the table rather than drawing a shorter one.

Which of two neighbouring processes you are in:

- **Before anything else.** `initialize-harness` is the one bootstrap process
  an actor starts; every other bootstrap diagram is a sub-process reached from it.
  Once a harness exists, `getting-started` is where a request to "create a
  folio" begins.
- **Content-agnostic, nested.** `content-lifecycle` is one cycle of a folio; it
  calls `draft-to-publication`, which calls `editing-hci-validation` for one
  proposed change to one block. The content-type processes —
  `authoring-a-document`, `authoring-a-paper`, `l2-dak-authoring`,
  `l3-fhir-pipeline` — describe how that change is drafted for a given kind of
  folio.
- **Content or platform.** `content-change-review` takes a change to a folio's
  content; `code-change-review` takes a change to the platform, and calls
  `merge-base` to bring the base branch in.
- **Review.** `review-task` is the generic entry. It descends into
  `review-narrative`, `review-code` or `narrative-code-review` as separate
  processes rather than as extra skills on one reviewer, because a called
  process's lane is scoped to that call path.
- **A disagreement.** `criterion-adjudication` is for two reviewer entries on
  one QA criterion; every other judgement that no mechanism can settle goes to
  `adjudication`.
- **Remote content.** `materialize-remote` decides whether a local copy may be
  held; `refresh-materialized` keeps one current; `copy-out-materialized` is
  how somebody edits content held as a read-only copy; `sample-import` and
  `subscribe-kg` call the first two rather than restating them.
- **Upstream releases.** `upstream-pin-watch` notices a pinned dependency has
  fallen behind; `upstream-version-adoption` is the reusable sub-process that
  decides whether to take the release.
- **Translation.** `translation-workflow` is the machine half;
  `human-translation-workflow` is the same cycle with a human translator and a
  subject-matter reviewer in it.
- **CI workflows.** A `.github/workflows/*.yml` names the diagram it
  implements with a `# bpmn:` line, and each job names its node with
  `# bpmn-node:`; `bun run cat check:workflow-coverage` compares the two.

<div class="fa-process-index" data-fa-process-index>
<noscript>
<p>The process table is drawn by JavaScript from the published
<a href="{{ '/subgraph/index.jsonld' | relative_url }}">named-subgraph JSON-LD</a>, which can be read
directly: each layer's <code>processes/index.hydrated.jsonld</code> holds
every one of its processes. The same diagrams are listed, without scripts, in the
<a href="{{ '/cat-harness/auto-docs/index/processes/' | relative_url }}">derived process index</a>, apart from
bootstrap's, which are in its own <code>processes/</code> directory.</p>
</noscript>
</div>
