/**
 * The `dak` and `sushi` content types — registered by the WHO layer, not by core.
 *
 * @module schemas/dak-content-type
 * @graphNode schema
 *
 * ## Why this file exists at all
 *
 * These two were written into `content-types-base.ts` first, under a comment
 * arguing that recognising a type is not claiming it and that the entries could
 * move to a WHO adapter later. `check:partition:edges` refused that within
 * minutes:
 *
 * ```
 * schemas/content-types-base.ts [folio-assist-core] -> schemas/dak.ts [smart-base]
 * A repo may not import one that depends on it.
 * ```
 *
 * The comment was right about where they belong and wrong that it could wait.
 * `smart-base` depends on core; core recognising a DAK means core importing
 * downstream, and it is not avoidable by intent — recognising a DAK
 * requires `DAK_TYPE`, and reaching for it *is* the edge. A boundary argued in
 * prose is a boundary that does not hold; this one is held by the import graph.
 *
 * Same shape as `folio-graph-typology.ts`, and for the same reason: the layer that
 * owns the model registers the entry at load time, and the layer that cannot
 * serve it does not name it.
 *
 * ## Registering is still not claiming
 *
 * `dak`'s `type` is WHO's own logical model IRI, not ours. `sushi`'s is minted
 * in our namespace and the constant says why: SUSHI publishes no logical model
 * for its config, so a WHO or HL7 IRI would imply an authority we do not have,
 * while our own is at least honest about who is speaking.
 */
import { DAK_INDEX_SECTION, DAK_TYPE } from "./dak";
import { defaultContentTypes, type ContentTypeRegistry } from "../platform/schema.js";
import { termIri } from "../platform/schema.js";

/**
 * The `@type` a SUSHI project projects to.
 *
 * Minted in OUR namespace on purpose. SUSHI has no published logical model for
 * `sushi-config.yaml`, so this is this layer's name for "a repository SUSHI
 * will build" rather than a claim to define SUSHI. A consumer dereferencing it
 * reaches our vocabulary, which is honest; an HL7 IRI would not be.
 */
export const SUSHI_TYPE = termIri("SushiProject");

export function registerDakContentTypes(registry: ContentTypeRegistry = defaultContentTypes): void {
  registry.register("dak", {
    // A section of the root `index.config.json`, not a file of its own
    // (owner, 2026-10-24, bean `cz17`).
    filename: { indexSection: DAK_INDEX_SECTION },
    type: DAK_TYPE,
    summary: "A WHO SMART Guidelines Digital Adaptation Kit, per `smart-base`'s own model.",
    facts: (d) => {
      const doc = d as { canonicalUrl?: unknown; canonical?: unknown; name?: unknown };
      return {
        // BOTH spellings read, because a disagreement is only findable if both
        // sides are actually read. `smart-base` uses `canonicalUrl`; the SUSHI
        // config beside it spells the same fact `canonical`, and cross-checking
        // them is the point of `facts` rather than an incidental convenience.
        canonicalUrl:
          typeof doc.canonicalUrl === "string"
            ? doc.canonicalUrl
            : typeof doc.canonical === "string"
              ? doc.canonical
              : undefined,
        name: typeof doc.name === "string" ? doc.name : undefined,
      };
    },
  });

  registry.register("sushi", {
    filename: "sushi-config.yaml",
    type: SUSHI_TYPE,
    summary: "A SUSHI project — FSH compiled to a FHIR implementation guide.",
    // No `facts`: this file is YAML, and `describeRepository` parses JSON. The
    // MEMBERSHIP is still reported, because the file's presence is the
    // assertion and that is readable without a parser; it comes back with
    // `parsed: false`, which is the third state saying so out loud rather than
    // a marker quietly contributing nothing. Giving it facts needs a YAML
    // parser in this module's import closure, which is a real cost and a
    // separate decision.
  });
}

registerDakContentTypes();
