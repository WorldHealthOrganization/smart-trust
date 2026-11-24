/**
 * The JSON-LD nodes a library entry holds: its `manifest.jsonld` (a
 * SourceDocument), its sections and sheets (`doco:Section`) and its blocks.
 * `cat-harness-tools/pipeline/gen-library-jsonld.ts` and `tabular-nodes.ts`
 * write them.
 *
 * ## How a node is routed here
 *
 * JSON-LD nodes carry no `$schema`, so the family is the content-model class
 * the node instantiates ({@link libraryNodeClass}): a `SourceDocument` by its
 * `@type`; a `Block` by the block `kind` it carries, since its own `@type` is
 * the instance's class for that kind (`folio-assistant-core:Prose`) and this
 * layer cannot read the block-kind nodes that name it; and a section by
 * `@type` exactly `doco:Section`, which a prose block also carries as its
 * second type.
 *
 * Whether a block's types are the ones its block-kind node names is checked
 * where those nodes are read: `gen-library-jsonld.ts --check` regenerates each
 * block from its block-kind node and reports any that differ.
 *
 * ## Strict, except the manifest's licence keys
 *
 * Each shape lists every key an emitter writes, so a key nobody declared is a
 * finding. The manifest's licence properties are named by each instance's own
 * vocabulary mapping (`licence-naming`), so the manifest admits keys beyond
 * its core.
 *
 * @module schemas/library-nodes
 * @graphNode schema
 */
import { z } from "zod";

import { termCurie } from "../kg/namespaces";

const Context = z.union([z.string(), z.record(z.string(), z.unknown()), z.array(z.unknown())]);
const Iri = z.string().min(1);
const Page = z.number().int().nonnegative();

/** The fields every node an entry derives from its source carries. */
const derived = {
  "@context": Context,
  "@id": Iri,
  derivedFrom: Iri,
  sourceDocument: Iri,
  provenance: z.literal("ingested"),
};

/** `manifest.jsonld` (and a LaTeX source's `source/manifest.jsonld`): the source itself. */
export const LibrarySourceDocumentSchema = z
  .object({
    "@context": Context,
    "@id": Iri,
    "@type": z.array(z.string()).refine((t) => t.includes(termCurie("SourceDocument")), {
      message: `@type must include ${termCurie("SourceDocument")}`,
    }),
    title: z.string().min(1),
    // Absent only on a LaTeX source's manifest, which is `partOf` the entry's.
    contains: z.array(Iri).optional(),
    partOf: Iri.optional(),
    provenance: z.literal("ingested"),
    inSubgraph: Iri.optional(),
    meta: z.record(z.string(), z.unknown()),
  })
  .passthrough();

/** A section (`sections/*.jsonld`) or a workbook's sheet (`sheets/*.jsonld`). */
export const LibrarySectionSchema = z
  .object({
    ...derived,
    "@type": z.tuple([z.literal("doco:Section")]),
    title: z.string(),
    pageStart: Page.optional(),
    pageEnd: Page.optional(),
    // Ordered: the document's reading order.
    contains: z.array(Iri),
  })
  .strict();

/**
 * A block (`blocks/*.jsonld`): prose, a typed candidate, a figure or a table.
 * Its `@type` is the pair its block-kind node names, the instance's class for
 * the kind and its DoCO type.
 */
export const LibraryBlockSchema = z
  .object({
    ...derived,
    // The DoCO co-type is absent for a kind that has none (core's
    // `recommendation`, and a higher layer's `indicator` and requirement kinds).
    "@type": z.union([
      z.tuple([z.string().regex(/^[\w.-]+:\w+$/), z.string().regex(/^doco:\w+$/)]),
      z.tuple([z.string().regex(/^[\w.-]+:\w+$/)]),
    ]),
    kind: z.string().min(1),
    title: z.string().optional(),
    label: z.string().optional(),
    pageStart: Page.optional(),
    pageEnd: Page.optional(),
    // Relative to the block: the prose or statement it carries.
    text: z.string().optional(),
    // A figure's image, and the state of its description.
    file: z.string().optional(),
    narrative: z.unknown().optional(),
    // A table's column headers.
    headers: z.array(z.string()).optional(),
    // A Stage B candidate's own facts: the source's number, what the source
    // calls it, its strength, the aspect that proposed it (cat-harness-tools#1356).
    meta: z.record(z.string(), z.string()).optional(),
  })
  .strict();

/** The family tag of each node class above, as the `library` typology lists them. */
export const LIBRARY_NODE_FAMILIES = {
  sourceDocument: termCurie("SourceDocument"),
  section: "doco:Section",
  block: termCurie("Block"),
} as const;

/**
 * The library node class a JSON-LD node instantiates, or `undefined` for a
 * node that is not JSON-LD or is none of them. See the module comment for
 * why a block is known by its `kind` rather than its `@type`.
 */
export function libraryNodeClass(node: unknown): string | undefined {
  if (node === null || typeof node !== "object" || Array.isArray(node) || !("@context" in node)) return undefined;
  const n = node as { "@type"?: unknown; kind?: unknown };
  const types = Array.isArray(n["@type"]) ? n["@type"] : n["@type"] === undefined ? [] : [n["@type"]];
  if (types.includes(LIBRARY_NODE_FAMILIES.sourceDocument)) return LIBRARY_NODE_FAMILIES.sourceDocument;
  if (typeof n.kind === "string") return LIBRARY_NODE_FAMILIES.block;
  if (types.length === 1 && types[0] === LIBRARY_NODE_FAMILIES.section) return LIBRARY_NODE_FAMILIES.section;
  return undefined;
}
