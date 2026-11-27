| Tool | Needed for | Notes |
|---|---|---|
| `bun` | every step | the harness's runtime; use the version in `cat-harness/.bun-version` |
| `git`, `bash`, `curl` | every step | |
| Java 17, `mvn` | building the AST | on your machine Maven compiles `AstExportCli` from the Publisher fork; CI downloads the precompiled bundle instead |
| Node 20, `npm` | building the AST | for SUSHI `3.21.0`, which the build script installs if missing |
| Ruby 3.3, `gem` | building the AST and rendering | for Jekyll `4.4.1`, which the build script installs if missing |
| a browser (Playwright's Chromium) | rendering, optional | for the page scan; without one the scan records why and the build goes on |
| `python3` with `venv` | rendering | checked by `stage-local.ts` before it starts |
| Docker | bare route only | when the IG's own workflow runs the Publisher in a container image |

Building the AST also needs network access to `packages.fhir.org`, the
terminology server (default `http://tx.fhir.org`) and Maven Central. If
`packages.fhir.org` is refused, see the `fhir-validation` skill, §"When a
package host refuses you".

The versions are pinned in `fhir-harness/scripts/ig-toolchain.env` (Java,
Node, SUSHI, Ruby, Jekyll). **FHIR packages** can be pinned too: when the IG
has a `fhir-packages.lock.json` at its root, `ig-ast-build.sh` installs every
package it lists from the URL it names and checks each hash first, so neither
SUSHI nor the Publisher fetches a package. A hash that does not match stops
the build. `--package-lock FILE` names another lock.

The layers come from the IG's `index.lock.json`, and you do not mount them by
hand. The IG's `cat` script is `bun .github/cat.ts`: on a fresh clone, the
first `bun run cat …` mounts every layer the lock pins, then runs the command.
It fetches the mounter at the commit the lock pins and checks each layer's
hash before keeping it. Later runs find the layers on disk and go straight to
the command.

After a re-pin, or to mount without running anything, run
`bash .github/mount-from-lock.sh` from the IG's root. It replaces a stale
mount and reports an intact one as `current`.

An IG set up before this has `"cat": "bun cat-harness-tools/scripts/run-script.ts"`
and no `.github/cat.ts`. Copy `cat.ts` and `mount-from-lock.sh` from
[`cat-harness-tools/templates/root-bootstrap/`](https://github.com/litlfred/cat-harness-tools/tree/main/templates/root-bootstrap)
into its `.github/` and set `"cat": "bun .github/cat.ts"`.
