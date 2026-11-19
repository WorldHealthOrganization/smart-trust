| output | notes |
|---|---|
| `output/` | the rendered site: HTML per resource and per page (`input/pagecontent/`, `sushi-config.yaml` `pages:`) |
| `{ResourceType}-{id}.json` | the structured surface everything downstream reads |
| `.xml`, `.ttl` | the same resource in two more serialisations; this platform reads only the JSON |
| `package.tgz` → `package/.index.json` | filename, `resourceType`, `id` (index version 2) |
| `canonicals.json`, `package.manifest.json` | partial views of the artefact set |
| `artifacts.html` | the **only** source of an artefact's category |
| `qa.json` | the validation record |
| POT files | translatable strings |

The list changes between releases and the version is not pinned (below), so
any count needs a date and a version.

**It emits no artefact index.** `ValueSets.schema.json` is a schema whose
`example` happens to hold a list; it is not an index. An index must be
**reconstructed** from the four partial views above, and provenance records
all four because which one matters differs per IG.
