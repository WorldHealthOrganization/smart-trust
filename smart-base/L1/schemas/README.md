# smart-base/L1/schemas — knowledge-graph layer L1 (3.0) and the schema engine

`L1/` is a named subgraph of smart-base, declared from within by `../graph.json`. The layers above it are its siblings, `../../L2/`, `../../L2-bpmn/`, `../../L2-dmn/` and `../../L3/`. Each imports this package's engine from `../../L1/schemas/`; nothing here imports from them.

The L1 layer of the SMART Guidelines knowledge graph as **Zod**, with the FHIR
artefacts generated from it:
- **layout:** publication, section, element;
- **content:** recommendation, remark, key question, outcome, evidence, catalogued intervention, indicator;
- **references a DAK uses to point at them:** citation, reference entry, terminology code.

Migrated from [WorldHealthOrganization/smart-kg](https://github.com/WorldHealthOrganization/smart-kg)
`ontology/l1/l1.json` and `shapes/recommendation-graph.schema.json` at main
(`3f5e477`, L1 **3.0**). Every class, value set, predicate, edge and note is
carried verbatim. What's new is a **type** for every property: smart-kg names
its properties and binds some to value sets, but doesn't type the rest.

**smart-kg is deprecated (owner, 2026-10-16).** `l1.ts` is the source of
truth; nothing here is held equal to smart-kg's files any more, and no test or
workflow needs a smart-kg checkout.

## One source, every format

| file | what | generated? |
|---|---|---|
| `l1.ts` | L1 3.0: 13 classes with typed properties, 18 value sets, 21 predicates, 68 licensed edges | source (migrated) |
| `l1-library.ts` | the **library extension**: the layering rule, the specialisation of L1's layout classes, the upstream `library-node` class, and `implementation-practice` (owner ruling 1b, 2026-10-12) | source |
| `graph.ts` | a graph document's form (tier 1) | source |
| `validate.ts` | tier 1 + tier 2: a port of smart-kg `validate.mjs` 3.0, plus a check on typed values | source |
| `kgid.ts` | L1 IRIs and content hashes: a port of `tools/kgid.mjs` | source |
| `generated/l1.json` | L1 3.0 in smart-kg's format | generated |
| `generated/l1-library.json`, `l1-library.jsonld` | the extension layer, and its `rdfs:subClassOf` statements | generated |
| `generated/recommendation-graph.schema.json` | the document JSON Schema | generated |
| `generated/l1.context.jsonld` | the L1 JSON-LD context, built the way smart-kg built it | generated |
| `generated/l1-library.context.jsonld` | the context an `l1-library` graph names (`context.ts`) | generated |
| `loader.ts` | a jsonld.js document loader serving both contexts offline | source |
| `../../input/fsh/models/KGL1.fsh`, `KGL1Library.fsh` | logical models | generated |
| `../../input/fsh/codesystems/KG*.fsh`, `../../input/fsh/valuesets/KG*VS.fsh` | one CodeSystem + ValueSet per value set | generated |

SUSHI compiles the FSH. smart-base's own `generate_logical_model_schemas.py`
and `generate_valueset_schemas.py` turn it into JSON Schema, as they do for
every other logical model here.

## The library extension (owner rulings, 2026-10-07)

1. **Layering:** every layer points only upstream: L3 → L2 → L1 → **library**
   (the ingested source, its sections and blocks). L1 may point at the library,
   never down.
2. **L1's layout classes specialise the library's:**
   - `publication` ⊂ `cat-harness:SourceDocument`;
   - `publication-section` ⊂ `doco:Section`;
   - `publication-element` ⊂ `cat-harness:Block`, narrowed to `doco:Table`, `doco:Figure`, `doco:Footnote`, `doco:List` or `doco:TextBox` by element type.

   At instance level, each L1 layout node is `specializationOf` (PROV) the
   library node it is read from. L1 inherits whatever sectioning the library
   produces.
3. A source the library holds that **isn't L1** is still a resolution target:
   `reference-entry resolvesTo library-node`.

**Implementation guidance (owner ruling 1b, 2026-10-12).** A publication whose
`publicationType` is `implementation-guidance` (or `methodology`) makes no
recommendations of its own (handbook §1.9). What it prints is an
`implementation-practice` node — a class of its own, declared here rather than
in `l1.ts` so the migrated 3.0 layer stays unextended. It carries `identifier`,
`statement` and `contentHash` and no grading; L1 3.0's `remark` cannot attach to
it (its IRI is minted under a recommendation). `validate.ts` refuses a
`recommendation` defined in such a publication.

It is kept as its own layer (`l1-library`, which imports `l1`), so the 3.0
layer stays as migrated and the extension stays separable. A document using it names `l1-library.context.jsonld`.

## JSON-LD: graphs that survive as RDF

A graph names its context by URL (`http://smart.who.int/kg/<layer>.context.jsonld`).
That URL is the layer's identity, and it is never fetched at run time:
`loader.ts` maps each URL to the context generated here.

```ts
import jsonld from "jsonld";
import { documentLoader } from "./loader.ts";
const nquads = await jsonld.toRDF(graph, { format: "application/n-quads", documentLoader });
```

**`l1.context.jsonld` is smart-kg's L1 context as migrated.** Under it, an L1
graph loses most of its meaning as RDF. Measured on the Leave-no-one-behind
graph with jsonld.js (1,400 triples):
- **No node keeps its class.** Types are class ids (`publication-section`),
  the context maps class names, and it sets no `@vocab`.
- **Every property collapses into `sgkg:properties`.** It is an `@index`
  container, so `pageRange: "11-12"` becomes `sgkg:properties "11-12"`.
- **An unknown predicate disappears.** That includes `specializationOf`.

**`l1-library.context.jsonld` adds three fixes:**
- `@vocab` is the smart-kg namespace;
- `properties` is `@nest`, with Dublin-Core-inherited properties as
  `dcterms:` terms and `uri` properties as IRIs;
- predicates map to their declared IRIs.

The same graph then gives 1,508 triples with every class, every named
property and 37 `prov:specializationOf` edges (`test/context.test.ts`). The
three are kept in the extension's context, not in the L1 one.

## Reuse before invention

| L1 element | reuses |
|---|---|
| `publication` | **`Parent: DublinCore`**; title, creator, publisher, language and rights are Dublin Core's |
| `terminology-code` | **`Parent: Coding`** |
| `indicator`, `health-intervention` | `ProgramIndicator`'s and `HealthInterventions`' element names and types (not parents: those make fields required) |
| GRADE value sets | the same codes as folio-assistant's `grade-*` code lists; 3.0's handbook-sourced definitions are emitted |

## Commands

```sh
cd smart-base/L1/schemas && npm ci
npm run build                            # regenerate everything; removes orphaned generated FSH
npm run check                            # fail if any generated file is stale or orphaned
npm test                                 # layers, generated files, contexts, RDF
npm run validate -- path/to/graph.json   # check a graph document
```

## Known limits

- smart-base's `generate_logical_model_schemas.py` flattens a BackboneElement's
  children into top-level properties (`identifiers.value` appears as `value`).
  That's an existing behaviour of the generator: `DAK.publisher` is nested the
  same way.
