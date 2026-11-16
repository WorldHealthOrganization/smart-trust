From a checkout of `litlfred/smart-base`. On a fresh clone the first
`bun run cat …` mounts the layers `index.lock.json` pins, then runs the
command (`"cat": "bun .github/cat.ts"`); after a re-pin,
`bash .github/mount-from-lock.sh` remounts them.

```bash
# See what would be built and where
bun run cat stage:local --repo . --plan

# Build the site and compose the publish commit; push nothing
bun run cat stage:local --repo . --dry-run

# Or write a bundle you can open as a page
bun run cat stage:local --repo . --artifact ./_preview
```

The render restores the AST from the cache branch
`cat/fhir-harness/fhir-ast/smart.who.int.base`, which already holds one.

**When the AST is stale** (you changed `input/`, `sushi-config.yaml` or
`ig.ini`), rebuild it with the DAK pre-processing by starting the
repository's **IG AST refresh** workflow (`.github/workflows/ig-ast-refresh.yml`)
on your branch. Running `bun run cat prepare:fhir-harness` on your machine
builds an AST **without** the DAK pre-processing, because that script does not
run a `pre-export` step. Use it only to check that the FSH compiles.

**The content gate.** Before it composes the site, the render checks every
narrative, markdown field and page for injection attempts. It needs an agent
review of exactly that content in `qa/ig-content-qa.json`. When the IG's
content changes, the review goes stale and the publish is refused until it is
recorded again:

```bash
bun run cat ig-content-qa:scan                       # what the reviewer reads
bun run cat ig-content-qa:record --reviewer <who>    # update qa/ig-content-qa.json
```

For a local look only, `IG_CONTENT_QA_ACCEPT_UNREVIEWED=1` skips a missing or
stale review. The steps are the `ig-content-qa` skill.

To run the DAK pre-processing on its own, for example to inspect what it
writes: `bun run cat smart-base:dak-pre-export`. It changes files under
`input/`; restore them with `git checkout -- input sushi-config.yaml` before
you commit.
