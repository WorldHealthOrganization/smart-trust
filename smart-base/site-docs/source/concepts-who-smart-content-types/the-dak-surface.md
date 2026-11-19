A WHO SMART Guidelines IG publishes an extra layer on top of standard IG
output — the **DAK API** — produced by scripts that run *after* the Publisher
exits:

- `<stem>.schema.json` — a JSON Schema per logical model and per ValueSet
- `<stem>.displays.json` — display labels
- `<stem>.openapi.json` — an OpenAPI description
- `<stem>.jsonld` — a JSON-LD vocabulary, built from ValueSet **expansions**
- `dak-api.html` — the hub a reader enters through

Its size varies by two orders of magnitude between IGs; a figure describes one
IG at one version.

**None of this is the Publisher's work**: a missing schema is a question about
a post-processing script, not the build. The JSON-LD vocabularies inherit the
terminology server's availability, so a thin vocabulary may mean a thin
ValueSet or one nobody could expand, and the artefact alone does not say
which.
