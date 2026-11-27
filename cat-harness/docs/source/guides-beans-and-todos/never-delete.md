`beans delete` exists in the CLI. **Do not use it.**

Work that turns out not to be wanted is **scrapped** — `status: scrapped`,
with a section saying why. That is what "disable" means here; the CLI has no
disabled state, and its vocabulary is `draft`, `todo`, `in-progress`,
`completed`, `scrapped`.

A scrapped work item records that something was considered and rejected, and on
what grounds, which stops the next agent re-entering the same dead end. A deleted work item leaves a sibling session unable
to tell abandonment from accident, and leaves the next agent free to start
over on the thing you already ruled out.

The rule is stated here, and in the diagram's own documentation, because the
CLI offers the operation.
