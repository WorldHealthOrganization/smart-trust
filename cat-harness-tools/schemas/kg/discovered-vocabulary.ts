/**
 * An enum whose members are DISCOVERED from the layers mounted beside this
 * layer, rather than written in code — marked, so a reader that publishes the
 * schema knows its members are the composition's and not the schema's.
 *
 * @module schemas/kg/discovered-vocabulary
 * @graphNode none — a marker registry over Zod schemas; it defines no node shape
 *
 * ## Why a mark is needed
 *
 * `BLOCK_KINDS` is read at import from every mounted layer's `block-kinds/`
 * graph, so `z.enum(BLOCK_KINDS)` is a different enum in each composition. A
 * JSON Schema written from it would record which repositories were mounted
 * (with the harness alone, `{ "not": {} }`, rejecting every value; in a full
 * mount, kinds a harness file may not name).
 *
 * The vocabulary is OPEN by design — a higher layer adds a kind by adding a
 * node — so the only schema a lower layer can publish for it is the open type.
 * `gen-kind-json-schemas.ts` reads this registry and writes `{ "type":
 * "string" }` for every schema in it. The Zod stays the closed enum, because at
 * runtime the composition IS known.
 */
import { z } from "zod";

/** What a discovered enum's members are read from. */
export interface DiscoveredVocabulary {
  /** The node graph its members are declared in, by graph typology (`block-kinds`). */
  graph: string;
}

/** Every Zod schema whose members are discovered from the mounted layers. */
export const DISCOVERED_VOCABULARIES = z.registry<DiscoveredVocabulary>();

/** `z.enum(values)`, marked as a vocabulary the `graph` graphs of the composition declare. */
export function discoveredEnum<const T extends readonly [string, ...string[]]>(values: T, graph: string) {
  const schema = z.enum(values);
  DISCOVERED_VOCABULARIES.add(schema, { graph });
  return schema;
}
