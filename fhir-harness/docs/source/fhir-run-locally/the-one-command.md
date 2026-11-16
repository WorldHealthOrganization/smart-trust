From the IG repository's root. On a fresh clone the first command mounts the
layers before it runs ([what you need installed](#prerequisites) says how):

```bash
# 1. Build the AST (one Publisher run; minutes to tens of minutes)
bun run cat prepare:fhir-harness

# 2. See what would be built and where, and stop
bun run cat stage:local --repo . --plan

# 3. Build the site and compose the publish commit, pushing nothing
bun run cat stage:local --repo . --dry-run
```

`bun run cat <name>` runs a script that any mounted layer declares. The IG's
`cat` script is `bun .github/cat.ts`, which mounts the layers when they are
missing and then hands over to `cat-harness-tools/scripts/run-script.ts`.
`prepare:fhir-harness` is `bash fhir-harness/scripts/ig-ast-build.sh --ig-root .`,
and `stage:local` is `cat-harness-tools/scripts/stage-local.ts`.

Other ways to finish:

| Command | What it does |
|---|---|
| `bun run cat stage:local --repo . --artifact <dir>` | writes a bundle you can open as a page, instead of pushing |
| `bun run cat stage:local --repo .` | publishes. On the default branch it publishes the site root; on any other branch, a preview at `branches/<branch>/` |

You can skip step 1 when the IG's cache branch already holds an AST that is
valid for your commit: the render restores it.
