**No FHIR IG publishes an index of its own artefacts.** Four files each carry
part of one:

| view | carries |
|---|---|
| `package.tgz` → `package/.index.json` | filename, `resourceType`, `id` for every file |
| `canonicals.json` | id, type, url, version, name — canonical resources only |
| `artifacts.html` | the only source of an artefact's **category** |
| `package.manifest.json` | package-level metadata |

The index is **reconstructed**, and each field records its source file,
because coverage varies: `canonicals.json` covers about a tenth of one
published IG's artefacts and all of another's.

Two files look like indexes and are not:

- **`ValueSets.schema.json` at the published root is a schema, not an index.**
  It describes an enumeration endpoint's response and carries an `example`
  that holds the list.
- **`openapi/openapi.json` is not the IG's API sidecar set.** In at least one
  published IG it is an unrelated domain API, so an ingest that globs for
  OpenAPI-shaped files mis-files it.
