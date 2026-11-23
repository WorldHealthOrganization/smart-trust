---
name: dublin-core-renderings
description: >
  Render a catalogue's Dublin Core records in the two standard forms an outside
  reader can use: Dublin Core XML, which a harvester reads, and JSON-LD bound
  to DCMI Metadata Terms. Each rendering is published beside the item's page.
  Covers which records get one, which XML form is used and why, how every
  field maps from the record's own data (never composed), what cannot be
  expressed and how that is reported, and the gate. Read this before changing
  the mapping, adding a catalogue layer, or linking a rendering from a page.
---

# Dublin Core renderings

| piece | where |
|---|---|
| the mapping (the code this skill governs) | `folio-assistant-core/schemas/dublin-core-render.ts` |
| the script, with `--check` | `folio-assistant-core/scripts/dc-render.ts <instance-root>` |
| the Tool node | `dublin-core-render` in `folio-assistant-core/tools/index.ts` |
| the gate | `bun run cat dc:render:check` (a step in `code-quality-gates.yml`) |
| the record model it reads | `folio-assistant-core/schemas/dublin-core.ts` (`folio-dublin-core/v1`) |

## Which records get a rendering

**Exactly the records a catalogue ITEM names through `metadataRef`**, the
record the item's page describes. A record no item names gets no rendering. A
`metadataRef` that does not resolve is reported by `check:catalogue`, not here.

## Where they go

`<published root>/dublin-core/<stem>.dc.xml` and `<stem>.dc.jsonld`.

- The **published root** is the directory the layer declares with
  `instanceRoot: true` (for an IRIS mirror, `site/`, served at `/<instance>/`).
  The mount copies it whole, so the renderings publish beside the item pages.
- `<stem>` is the record's own filename without `.dc.json`.
- A layer that declares no published root is **refused**, not given a
  guessed one.

The item page links both files, and only when they exist.

## Two renderings, and why the existing projection is not one of them

`dublinCoreToJsonLd` in `dublin-core.ts` is the **lossless** DSpace graph:

every qualified field goes to a minted `dspace:` predicate and every value sits
in an `@list`. A DCMI-aware consumer would find no `dcterms:issued` there, and
`dcterms:title` would be an RDF list, not a literal. The renderings are a second
projection for outside readers; the first is left unchanged.

### DC XML: qualified DC, per DCMI's XML guidelines

The XML form is **qualified Dublin Core**, following DCMI's *Guidelines for
implementing Dublin Core in XML* (2003-04-02):

- `dc:` and `dcterms:` elements inside one namespaced container (`metadata`,
  in the content layer's DSpace namespace);
- `xml:lang` for a value's language;
- `xsi:type="dcterms:<Scheme>"` for an encoding scheme.

It is **not `oai_dc`**, the simple-DC form an OAI-PMH endpoint serves (that
needs the OAI namespace and an endpoint). An `oai_dc` form would be a third
rendering, not a change to this one.

### JSON-LD: bound to DCMI Terms, following the `linked-data` voice

- The context is **inline**, so nothing is fetched to read the document.
- `@base` sits in that inline context, and only when the item has a Handle.
  The subject `@id` is then the Handle, relative to `https://hdl.handle.net/`.
- A link-valued property is a **term** with `"@type": "@id"` (`memberOf`,
  `authority`), and the document uses the term, never a prefixed key.

## The mapping, and the rule behind each row

One table, `DCTERMS_MAP`, maps the qualified DSpace field name to the DCMI term
it is. Each row records two facts DCMI Metadata Terms (2020-01-20) states about
that term.

**First fact: is the range a literal or a resource?** This comes from reading
the vocabulary, not from the value's shape.

- Agent, Location, LinguisticSystem, and terms DCMI says are "intended to be
  used with non-literal values" are **resources**.
- The record holds a resource's value as text with no IRI. The JSON-LD
  therefore emits a node with the text as `rdf:value`. That is DCMI's own
  "value string" pattern, from *Expressing Dublin Core metadata using RDF*
  (2008).
  A bare string would make the creator a literal; a minted IRI would invent an
  address.
- **For multi-graph static edge search**, those anonymous nodes would become
  colliding blank nodes, so there
  `oxigraph-catalogue-search` (opt-in `folio-assistant-core.library-extras`) governs: compound
  resources are skolemized into content-addressed URIs
  (`https://<domain>/entity/item/{handle}#{prop}_{idx}`).

**Second fact: which encoding scheme, if any.**

- The scheme is asserted only when the **field name** says it:
  - `uri` → `dcterms:URI`
  - `mesh` → `dcam:memberOf dcterms:MESH`
  - `iso` → `dcterms:RFC4646`
- Dates get `dcterms:W3CDTF` only when the value actually matches W3CDTF.
- A typed value cannot also carry a language tag in JSON-LD. The scheme wins,
  because it says what the string IS. The XML keeps both.

Every value is the record's own string, verbatim and in source order. Repeats
are kept. The record's `_comment` annotations are stripped, as
`check:catalogue` strips them: they are notes for a person, not metadata.

**A field with no DCMI term is not forced onto the nearest one.** Each of the
following is deliberately absent from the table:

| field | why it has no row |
|---|---|
| `dc.date.accessioned` | It is when the repository took the item in. That is not `dateAccepted` ("date of acceptance of the resource"), however close the words are. |
| `dc.identifier.isbn`, `dc.identifier.govdoc` | DCMI defines no scheme for either. Collapsing them onto `dcterms:identifier` would lose the three-identifier-systems distinction that `iris-dspace` R1 exists for. |
| `dc.title.release`, `dc.subject.meshqualifier` | DCMI defines no term for either. |

What happens to such a field depends on the form:

- **JSON-LD:** it keeps the minted predicate `dcPredicate` gives it, so both
  projections agree on every field DCMI does not define.
- **XML:** it is reduced to its DCMI element (the DCMI dumb-down principle),
  with the original field name next to it in a comment.
- **A non-`dc` schema** (`who.relation.languageVersion`) has no DCMI element to
  reduce to. It is listed in a header comment as not expressible. It is never
  silently dropped.

## The gate

`bun run cat dc:render:check` fails on three things:

- a rendering that is **missing**;
- a rendering that is **stale**, meaning its bytes differ from a fresh render;
- an **orphan**, meaning a file in the directory that no record produces.

`bun run cat dc:render` regenerates. Renderings are generated files: never edit
one by hand.

## Changing the mapping

Add or change a row in `DCTERMS_MAP` only with the DCMI term's definition open.
The row's `range` is a claim about that definition. Then:

1. `bun run cat dc:render`.
2. Commit the regenerated files.
3. Run the tests in `dublin-core-render.test.ts`. They expand the JSON-LD with
   jsonld.js and assert that a resource-ranged term never expands to a bare
   literal.
