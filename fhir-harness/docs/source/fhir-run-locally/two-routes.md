| | **Harnessed** (this layer) | **Bare** (the IG Publisher alone) |
|---|---|---|
| When it is taken | the IG repository has an `index.config.json` naming its landing layer, `"site": { "landing": "<layer>" }` | the repository has no `index.config.json`, or you pass `--bare-ig` |
| What runs the Publisher | `AstExportCli`, an entry point added to a fork of the Publisher ([litlfred/fhir-ig-publisher](https://github.com/litlfred/fhir-ig-publisher)), pinned by commit | the repository's own `ghbuild.yml` steps (stock `publisher.jar`, latest release) |
| What the site is built from | the AST (`output-ast/`, or the cache branch) | the Publisher's `output/` as it lays it out |
| What you get | thin just-the-docs pages, a JSON-LD node per artefact, the artefact index, search, a language picker | the Publisher's HTML |
| Version pinned? | yes: SUSHI, Java and Node in `scripts/ig-toolchain.env`; the Publisher by the `ast-export` commit | no: the version floats (see [the IG Publisher](ig-publisher.html#the-version-floats)) |

Both routes start with one command, `stage-local.ts`. It takes the harnessed
route whenever it can. Do not pass `--bare-ig` to a harnessed IG unless you
want the Publisher's own pages.
