Publishing is the [command-line render](run-locally.html), run on a GitHub
runner and pushed to the IG repository's `gh-pages` branch. There is no
separate recipe: the workflow runs the same `stage-local.ts` command that
you run by hand.

**A merged pull request publishes.** In an IG repository set up from the
templates, a push to `main` that changes the IG's inputs refreshes its AST,
and every push to `main` republishes the site once that refresh has
finished. Previews of other branches, and re-runs, are started by hand
(`workflow_dispatch`). A **release** is cut from a version tag and is
published by a person.
