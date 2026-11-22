/**
 * `jsonldPrefixes`: the external vocabularies a layer's JSON-LD speaks, as
 * declared data — prefix → namespace IRI.
 *
 * Each layer declares the namespaces it speaks, and its published context
 * is GENERATED from the prefixes its documents actually use, flattened with
 * the contexts of the layers it `needs`. So a vocabulary belonging to a
 * higher layer is bound there, and a bound-but-unused prefix cannot exist.
 *
 * This module is the declaration and the pure merge. It reads no files and runs
 * no generator: the generator and the gate live in the tools layer, and they
 * read every layer's table as data, so no layer has to import the one above.
 *
 * @graphNode schema
 * @module cat-harness/schemas/jsonld-prefixes
 */
import { z } from "zod";

/**
 * A prefix: an NCName with no `:`, not a JSON-LD keyword, and not a URI scheme a
 * reader would mistake a CURIE for.
 */
const RESERVED = new Set(["_", "http", "https", "urn", "mailto", "file", "data"]);
export const JsonldPrefixSchema = z
  .string()
  .regex(/^[A-Za-z_][A-Za-z0-9._-]*$/, "an NCName: letters, digits, `.`, `_`, `-`, not starting with a digit")
  .refine((p) => !RESERVED.has(p.toLowerCase()), "a URI scheme or the blank-node prefix, which a reader would mis-expand");

/** A namespace IRI: absolute, and ending where a local name is appended (`/` or `#`). */
export const NamespaceIriSchema = z
  .string()
  .regex(/^(https?:\/\/|urn:)[^\s]+$/, "an absolute http(s) or urn IRI")
  .refine((iri) => iri.endsWith("/") || iri.endsWith("#"), "a namespace IRI ends in `/` or `#`, so `prefix:local` expands to a full IRI");

/** The table: prefix → namespace IRI. One IRI per prefix by construction (it is a record). */
export const JsonldPrefixTableSchema = z.record(JsonldPrefixSchema, NamespaceIriSchema).superRefine((table, ctx) => {
  const byIri = new Map<string, string>();
  for (const [prefix, iri] of Object.entries(table)) {
    const other = byIri.get(iri);
    if (other !== undefined) ctx.addIssue({ code: "custom", path: [prefix], message: `${prefix} and ${other} both name ${iri}: one prefix per namespace` });
    else byIri.set(iri, prefix);
  }
});
export type JsonldPrefixTable = z.infer<typeof JsonldPrefixTableSchema>;

/** One layer's table, as the merge sees it. */
export interface DeclaredPrefixes {
  instance: string;
  prefixes: JsonldPrefixTable;
}

/** A prefix two layers bind to different namespaces. */
export interface PrefixConflict {
  prefix: string;
  bindings: { instance: string; iri: string }[];
}

/**
 * Flatten tables in dependency order (a layer's `needs` first, itself last):
 * the merged table, plus every prefix two layers bind differently.
 *
 * A conflict is reported, never resolved by order: the published terms are
 * `@protected`, so a higher layer silently redefining a lower one's prefix is
 * exactly what the flattening must refuse.
 */
export function mergePrefixTables(tables: readonly DeclaredPrefixes[]): { prefixes: JsonldPrefixTable; conflicts: PrefixConflict[] } {
  const prefixes: Record<string, string> = {};
  const owners = new Map<string, { instance: string; iri: string }[]>();
  for (const { instance, prefixes: table } of tables) {
    for (const [prefix, iri] of Object.entries(table)) {
      const seen = owners.get(prefix) ?? [];
      seen.push({ instance, iri });
      owners.set(prefix, seen);
      if (!(prefix in prefixes)) prefixes[prefix] = iri;
    }
  }
  const conflicts: PrefixConflict[] = [];
  for (const [prefix, bindings] of owners) {
    if (new Set(bindings.map((b) => b.iri)).size > 1) conflicts.push({ prefix, bindings });
  }
  return { prefixes, conflicts };
}
