Each ingested document is one folder, `library/<doc>/`, named by its
bibliography slug. This is every file and folder it can hold, the schema that
checks it, and what writes it. **Required** means the
[L1 completeness gate](#the-l1-completeness-gate) fails without it; the others
are written when the document has that kind of content.

| file | what it is | schema | written by | required |
|---|---|---|---|---|
| `manifest.jsonld` | the entry's own node: a `SourceDocument` with its title, provenance, licence keys and the list of its sections | [`library-nodes`]({{ '/cat-harness/schema/library-nodes.html' | relative_url }}) | `gen-library-jsonld` | yes |
| `structure.json` | the document's table of contents: its sections, their pages and whether the outline was read or inferred | [`document-structure`]({{ '/cat-harness/schema/document-structure.html' | relative_url }}), [`pdf-structure`]({{ '/cat-harness/schema/pdf-structure.html' | relative_url }}) | the structure arm (`pdf-structure`, or the slides, notebook or text arm) | yes |
| `sections/` | one `.md` (the verbatim text) and one `.jsonld` (a `doco:Section`) per section | [`library-nodes`]({{ '/cat-harness/schema/library-nodes.html' | relative_url }}) | `gen-library-jsonld` | yes |
| `blocks/` | the typed statements extracted from sections, such as a recommendation or a requirement, each `derivedFrom` its section | [`library-nodes`]({{ '/cat-harness/schema/library-nodes.html' | relative_url }}), [`block-kinds`]({{ '/cat-harness/schema/block-kinds.html' | relative_url }}) | `gen-library-jsonld`, from `candidates.json` | yes |
| `candidates.json` | the proposals the blocks are made from, before they become blocks | [`ingest-candidates`]({{ '/cat-harness/schema/ingest-candidates.html' | relative_url }}) | `extract-candidates` | when requirements or recommendations are extracted |
| `licence.json` | the source's licence, as one record | [`source-licence`]({{ '/cat-harness/schema/source-licence.html' | relative_url }}) | `ingest-document` | yes |
| `summaries.json` | an agent's draft summary of each prose block, kept beside the block and never replacing its text | [`block-summary`]({{ '/cat-harness/schema/block-summary.html' | relative_url }}) | `cat summaries` | advisory |
| `images.json` and `images/` | the images placed in the document, with their descriptions | [`document-image`]({{ '/cat-harness/schema/document-image.html' | relative_url }}) | the image arm (`pdf-images`) | when the document has images |
| `vector-figures.json`, `vector-labels.json` and `figures/` | figures drawn as vectors, and the labels positioned on them | [`vector-figure`]({{ '/cat-harness/schema/vector-figure.html' | relative_url }}), [`vector-labels`]({{ '/cat-harness/schema/vector-labels.html' | relative_url }}) | the vector arm (`pdf-vector-figures`, `pdf-vector-labels`) | when the document has vector figures |
| `keywords.json` | the entry's keywords. Being retired: keywords are extracted content, so they are now built when the site is published, on the [Keywords]({{ '/en/cat-harness/lsi/keywords/' | relative_url }}) page | [`library-keywords`]({{ '/cat-harness/schema/library-keywords.html' | relative_url }}) | `library-keywords` | no |
| `referenced.json` | for a source the library records but does not hold: where it is and how to get it | [`referenced-source`]({{ '/cat-harness/schema/referenced-source.html' | relative_url }}) | `referenced-source` | instead of the text, for a referenced source |
| `README.md` | a generated summary of the entry for someone browsing the repository | none | `subgraph-readmes` | no |

Tables, archives and recordings add their own records
([`tabular-csvw`]({{ '/cat-harness/schema/tabular-csvw.html' | relative_url }}),
[`archive-contents`]({{ '/cat-harness/schema/archive-contents.html' | relative_url }}),
[`recording`]({{ '/cat-harness/schema/recording.html' | relative_url }})).
A layer above may add its own files too, such as the DAK layer's L1 library
graph.

**Two records live outside the folder.** The intake record for the original
upload stays with it in `uploads/`
([`intake`]({{ '/cat-harness/schema/intake.html' | relative_url }})). A
catalogue's Dublin Core record is kept in the catalogue, not in the entry
([`dublin-core`]({{ '/folio-assistant-core/schema/dublin-core.html' | relative_url }}),
[`catalogue`]({{ '/folio-assistant-core/schema/catalogue.html' | relative_url }})).

**The entry's address.** The entry is named by
`assets/library/jsonld/<instance>/source/<doc>` on the site: its manifest is
published at that address plus `.jsonld`, and a small page at the address
itself points to the entry's library page. The library page for the entry is a rendering of it, with its own
address ([`library-iri`]({{ '/cat-harness/schema/library-iri.html' | relative_url }})).

To see whether a given folder is complete, run
`bun run cat check:l1-complete library/<doc>`: it reports each requirement
above as met, unmet or not yet derivable.
