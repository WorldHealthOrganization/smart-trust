/**
 * L1 identity — the functions of WHO smart-kg `tools/kgid.mjs` (main
 * `3f5e477`, L1 3.0) this layer's extractors mint IRIs with.
 *
 * A copy, and a deliberate one: smart-kg's module lives in another repository,
 * and an L1 IRI that differs from the one smart-kg mints for the same guideline
 * makes two nodes of one. (This layer's Zod package holds a second port of the
 * same functions, `smart-base/L1/schemas/kgid.ts`.) So `l1-kgid.test.ts` pins
 * the outputs `kgid.mjs` gave. It no longer compares against a smart-kg
 * checkout: smart-kg is deprecated (owner, 2026-10-16).
 *
 * The rule, from smart-kg: L1 IRIs live under one WHO-wide namespace and are
 * built from what WHO prints (ISBN, printed number), so two extractions of one
 * guideline yield the same nodes.
 *
 * @module smart-base/L1/scripts/l1-kgid
 */
import { createHash } from "node:crypto";
import { dakNamespace, L1_NAMESPACE, slug } from "../../scripts/l1-scenario-vocabulary.ts";

export const sha256 = (b: string | Buffer): string => createHash("sha256").update(b).digest("hex");
export const shortHash = (s: string): string => sha256(Buffer.from(s)).slice(0, 12);

export { dakNamespace, L1_NAMESPACE, slug };

/** A file a DAK ships. */
export const artifactId = (ns: string, fileId: string): string => `${ns}/artifact/${fileId}`;

const IRI_IDENTIFIERS = ["isbn", "iris-handle", "doi", "issn", "url"] as const;

const idValue = (type: string, value: string): string => {
  const v = String(value).trim();
  if (type === "isbn" || type === "issn") return v.replace(/[^0-9Xx]/g, "").toUpperCase();
  if (type === "url") return slug(v.replace(/^[a-z]+:\/\//i, "").replace(/[?#].*$/, "").replace(/\/+$/, "").replace(/^www\./i, ""));
  return slug(v);
};

export interface Identifier {
  type: string;
  value: string;
}

export const publicationId = (identifiers: Identifier[]): string => {
  for (const type of IRI_IDENTIFIERS) {
    const found = (identifiers ?? []).find((i) => i.type === type && i.value);
    if (found) return `${L1_NAMESPACE}/publication/${type}-${idValue(type, found.value)}`;
  }
  throw new Error("a publication needs an isbn, iris-handle, doi, issn or url to have a stable IRI");
};

const num = (s: unknown): string => String(s).trim().replace(/\s+/g, "-").replace(/[^A-Za-z0-9.\-]/g, "");

export const sectionId = (pub: string, number: string): string => `${pub}/section/${num(number)}`;
export const publicationElementId = (pub: string, label: string, ...parts: string[]): string =>
  [`${pub}/element/${slug(label)}`, ...parts.map((p) => slug(p))].join("/");
export const referenceEntryId = (artifact: string, number: string): string => `${artifact}/reference/${num(number)}`;
export const citationId = (ns: string, text: string): string => `${ns}/citation/${shortHash(text)}`;

/** The L1 layer's JSON-LD context, and the library extension's (litlfred/smart-base `kg/`). */
export const L1_V3_CONTEXT = "http://smart.who.int/kg/l1.context.jsonld";
export const L1_LIBRARY_CONTEXT = "http://smart.who.int/kg/l1-library.context.jsonld";
export const L1_V3_ONTOLOGY_VERSION = "3.0";
