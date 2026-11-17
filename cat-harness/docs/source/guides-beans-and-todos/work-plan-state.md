The rest of this page says what a work item **is**. This section says what the
store currently **holds** — read live from
[`/assets/beans/index.json`]({{ '/assets/beans/index.json' | relative_url }}), the projection
`gen-docs-pages.ts` writes from `beans/defs/` on every build, beside the todo
index it has published for longer. It exists because a work plan nobody can
look at is one nobody checks.

**What the dashboard shows.** The counts, as numbers, because they are a
headline. The work plan as a tree, goal → epic → feature → story, because the
question a reader brings is "where does this sit"; the type filter and the search prune that tree
to what matches and open it down to them. The store's `task` type is shown as
**story**, since a Task here is a BPMN task. The findings, as a list with an
icon and a label on every row, because a status colour never carries meaning
alone.

**The findings are computed from committed data only, and one of them is
missing on purpose.** A stale `in-progress` detector would have to read the
clock, and the projection is gated on exact content — anything computed
against the clock changes the file on every build and the staleness gate then
fires forever. So the projection publishes each work item's `updated_at` as a fact
and the page computes age when you open it. Age therefore moves without the
file moving, which is the right way round.

**There is a fuller view, and it is browsable.** Every declared state graph
gets its own visualiser at the path this layer already uses for that graph —
`/beans/`, `/todos/`, and one for each of the others. A rendered asset is
addressed by its layer's **name** with the **declared graph as a path
segment**; this layer elides its own name because its `docs/` is what the
site serves. The `harness-requirements` skill names that URL as the
obligation. There is no index above them,
because `/` is the documentation site's, so each page lists its siblings.

**A graph with no projection says so.** `qa`, `health`, `issue-marks` and
`uploads` are declared state graphs that nothing publishes a projection for
yet. Their dashboards say exactly that, rather than rendering zeros for a
store nobody read, because a dashboard that opens at zero cannot be told from
a store with nothing in it.

**Every identifier on those pages is a link.** A work item id resolves to the work item's
file, an issue or pull-request number to the forge, and each finding carries a
pencil to where writing actually happens. A reference that cannot be resolved
stays as plain text, which is the visible difference between *"follow this"*
and *"this points somewhere I could not reach"*.

**What is not here.** Where a work item sits in a BPMN process. That join needs `beans/workflows/`, the declared
`workflow-state` graph, and it is empty — so a position view would report
"nowhere" for every work item in the store. It waits for instance state to exist.

<div class="fa-workplan" data-fa-workplan>
  <p class="fa-workplan-fallback">
    The live work-plan dashboard needs JavaScript. The projection it reads is
    <a href="{{ '/assets/beans/index.json' | relative_url }}">a plain JSON file</a> and can be read
    directly.
  </p>
</div>
