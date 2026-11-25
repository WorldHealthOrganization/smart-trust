#!/usr/bin/env bun
/**
 * gen-vocabulary.ts — bootstrap's vocabulary, `bootstrap/ns.jsonld`: every term
 * bootstrap defines and every Graph Typology it defines, as RDF/SKOS, at the
 * address its IRIs already name.
 *
 * @module bootstrap-tools/scripts/gen-vocabulary
 * @covers code
 *
 * ## Why this exists
 *
 * Every IRI bootstrap's files mint in its namespace (`<iriBase>v<major>/ns/…`)
 * must dereference to a definition. The vocabulary is exactly bootstrap's
 * terms, and bootstrap-tools generates it, so a content repository's
 * vocabulary never waits on, or says what, a harness says.
 *
 * ## What it holds
 *
 * RDFS and SKOS both, as published vocabularies do: `rdfs:label`/`rdfs:comment`
 * for a reader arriving by RDFS, `skos:prefLabel`/`skos:definition` for one
 * arriving by SKOS — the same text at both.
 *
 * - Each of `BOOTSTRAP_TERMS`, in order, as `rdfs:Class` + `skos:Concept`:
 *   its definition, what it uses (`dcterms:requires`, from
 *   `BOOTSTRAP_TERM_USES`), and the schema that defines it
 *   (`rdfs:isDefinedBy`, from `BOOTSTRAP_TERM_DEFINED_BY`).
 * - Each of `BOOTSTRAP_GRAPH_TYPOLOGIES` as a named `bootstrap:GraphTypology`,
 *   `bootstrap:graphTypology/<kind>` — the individual a Subgraph's `holdsGraph`
 *   points at.
 *
 * It names nothing above bootstrap: no harness prefix in its context, no
 * `seeAlso` out. `@id` is the file's own path under the release address, so
 * `check:node-iris` holds and publishing the file serves the namespace.
 *
 * ```sh
 * bun run bootstrap-tools/scripts/gen-vocabulary.ts [--check]
 * ```
 */
import { TOOLS_REPOSITORY, generatedNote } from "./generated-by.ts";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { BOOTSTRAP_GRAPH_TYPOLOGIES, BOOTSTRAP_TERM_DEFINED_BY, BOOTSTRAP_TERM_USES, BOOTSTRAP_TERMS } from "../schemas/graph.ts";
import { type ReleaseIris, releaseIri, bootstrapRelease } from "../schemas/release-iri.ts";

const W3 = {
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  owl: "http://www.w3.org/2002/07/owl#",
  skos: "http://www.w3.org/2004/02/skos/core#",
  dcterms: "http://purl.org/dc/terms/",
  prov: "http://www.w3.org/ns/prov#",
};

/** `NodeSchema` → `Node Schema`: the label a person reads. */
export function termLabel(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2");
}

/** The vocabulary document for a release. */
export function vocabulary(r: ReleaseIris): Record<string, unknown> {
  const docIri = releaseIri(r, "ns/", "agent");
  const ns = docIri;
  const graphSchema = releaseIri(r, "schemas/graph.schema.json", "agent");
  const definedBy = (ref: string) => (ref.startsWith("#") ? `${graphSchema}${ref}` : ref);
  const terms = (Object.entries(BOOTSTRAP_TERMS) as [keyof typeof BOOTSTRAP_TERMS, string][]).map(([key, definition]) => ({
    "@id": `bootstrap:${key}`,
    "@type": ["rdfs:Class", "skos:Concept"],
    label: termLabel(key),
    comment: definition,
    prefLabel: termLabel(key),
    definition,
    notation: `bootstrap:${key}`,
    inScheme: docIri,
    isDefinedBy: definedBy(BOOTSTRAP_TERM_DEFINED_BY[key]),
    ...(BOOTSTRAP_TERM_USES[key].length > 0 ? { requires: BOOTSTRAP_TERM_USES[key].map((u) => `bootstrap:${u}`) } : {}),
  }));
  const kinds = (Object.entries(BOOTSTRAP_GRAPH_TYPOLOGIES) as [string, string][]).map(([kind, definition]) => ({
    "@id": `bootstrap:graphTypology/${kind}`,
    "@type": ["bootstrap:GraphTypology", "skos:Concept"],
    label: kind,
    comment: definition,
    prefLabel: kind,
    definition,
    notation: kind,
    inScheme: docIri,
    isDefinedBy: `${graphSchema}#/$defs/GraphTypology`,
  }));
  return {
    "@context": {
      ...W3,
      bootstrap: ns,
      label: "rdfs:label",
      comment: "rdfs:comment",
      prefLabel: "skos:prefLabel",
      definition: "skos:definition",
      notation: "skos:notation",
      inScheme: { "@id": "skos:inScheme", "@type": "@id" },
      isDefinedBy: { "@id": "rdfs:isDefinedBy", "@type": "@id" },
      requires: { "@id": "dcterms:requires", "@type": "@id" },
      versionInfo: "owl:versionInfo",
      wasAttributedTo: { "@id": "prov:wasAttributedTo", "@type": "@id" },
    },
    "@id": docIri,
    "@type": ["owl:Ontology", "skos:ConceptScheme"],
    label: "bootstrap vocabulary",
    definition:
      "Every term bootstrap defines, in the order they are defined — each uses only terms above it — and every Graph Typology it defines.",
    versionInfo: r.version,
    comment: generatedNote("scripts/gen-vocabulary.ts", "bootstrap's own terms", "change the terms in the toolset's schemas/graph.ts"),
    wasAttributedTo: TOOLS_REPOSITORY,
    "@graph": [...terms, ...kinds],
  };
}

if (import.meta.main) {
  const check = process.argv.includes("--check");
  const rootAt = process.argv.indexOf("--root");
  const bootstrap = rootAt >= 0 && process.argv[rootAt + 1] ? process.argv[rootAt + 1]! : join(import.meta.dir, "..", "..", "bootstrap");
  let r: ReleaseIris;
  try {
    r = bootstrapRelease(bootstrap);
  } catch (e) {
    console.error(`✗ ${bootstrap}: ${e instanceof Error ? e.message : String(e)} — there is no address to write the vocabulary for.`);
    process.exit(2);
  }
  const out = join(bootstrap, "ns.jsonld");
  const text = `${JSON.stringify(vocabulary(r), null, 2)}\n`;
  const prev = existsSync(out) ? readFileSync(out, "utf-8") : undefined;
  const n = Object.keys(BOOTSTRAP_TERMS).length;
  const k = Object.keys(BOOTSTRAP_GRAPH_TYPOLOGIES).length;
  if (check) {
    if (prev !== text) {
      console.error(`✗ ${out} is stale — run bun run bootstrap-tools/scripts/gen-vocabulary.ts`);
      process.exit(1);
    }
    console.log(`✓ bootstrap/ns.jsonld is current: ${n} terms, ${k} graph typologies, at ${releaseIri(r, "ns/", "agent")}`);
  } else {
    writeFileSync(out, text);
    console.log(`${prev === text ? "=" : "✓"} bootstrap/ns.jsonld — ${n} terms, ${k} graph typologies`);
  }
}
