The harness runs the Publisher **once per AST**, not once per site build:

- `ig-ast-build.sh` (the checkout script `prepare:fhir-harness`) and the
  reusable `ig-ast-refresh.yml` run `AstExportCli`, an entry point added to a
  fork of the Publisher ([litlfred/fhir-ig-publisher](https://github.com/litlfred/fhir-ig-publisher)).
  The fork is pinned by its `ast-export` commit. The run writes `output-ast/`,
  one JSON dump per resource.
- The site is then rendered **from the AST**, never from the Publisher's
  `output/` HTML. No Publisher runs while a site is published.
- An IG with no `index.config.json`, or a run with `--bare-ig`, takes the
  **bare** route instead: the IG's own `ghbuild.yml` steps run, and the
  Publisher's output is published as it is.

How to run each route: [Render an IG from the command line](run-locally.html).
How the result is deployed: [Publishing an IG](publishing.html).
