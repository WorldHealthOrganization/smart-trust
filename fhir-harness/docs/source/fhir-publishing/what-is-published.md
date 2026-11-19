This layer itself publishes:

- **These pages**, on the platform's documentation site:
  <https://litlfred.github.io/folio-assistant/fhir-harness/>.
- **Its JSON-LD context**, which every node it writes points at:
  <https://litlfred.github.io/fhir-harness/ns/context/v1.jsonld>.
- **The reusable workflow and the templates**, from the repository:
  [`.github/workflows/`](https://github.com/litlfred/fhir-harness/tree/main/.github/workflows)
  and [`templates/ig-repo-site/`](https://github.com/litlfred/fhir-harness/tree/main/templates/ig-repo-site).

An IG built on this layer publishes at its own repository's Pages address,
`https://<owner>.github.io/<repo>/`. Every such site has the same shape:

| Path | What it is |
|---|---|
| `/` | the IG's home page |
| `/artifacts.html`, `/toc.html` | the artefact list and the table of contents |
| `/fhir-artifact-index/index.json` | the artefact index, machine-readable |
| `/artifact/<Type>-<id>.jsonld` | one JSON-LD node per artefact |
| `/folio-build.json` | the build stamp |
| `/branches/<branch>/` | branch previews |

The layers that build particular guides link their live sites from their own
pages.
