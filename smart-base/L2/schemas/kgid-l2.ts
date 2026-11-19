/**
 * DAK-namespace identity — the half of WHO smart-kg `tools/kgid.mjs` (main
 * 3f5e477) that `../../L1/schemas/kgid.ts` does not hold, because L1 never
 * mints a DAK's IRIs. L2 is the lowest layer that does, so it lives here and
 * every extractor above (L2-BPMN, L2-DMN, L3) imports it from here.
 *
 * The rule that matters, from smart-kg: AN ARTEFACT HAS ONE ADDRESS ACROSS
 * LAYERS. The citation extractor emits an `external-artifact` node for a DMN
 * table and the L2-DMN extractor emits a `dmn-definitions` node for the same
 * file; both call {@link artifactId} and get the same IRI, so loading the two
 * documents into one store yields one node described at two layers.
 */
import { slug } from "../../L1/schemas/kgid.ts";

export { citationId, sha256, shortHash, slug } from "../../L1/schemas/kgid.ts";

/**
 * The DAK namespace a file belongs to.
 *
 * BPMN carries targetNamespace="http://smart.who.int/base/bpmn" and DMN carries
 * namespace="http://smart.who.int/immunizations". The trailing format segment
 * is a serialisation detail, not a different DAK, so it is dropped; and
 * `http://smart.who.int` is normalised to https, because an IRI is an identity
 * key and two schemes for one authority split every node in two.
 * {@link normalisedScheme} reports that the rewrite happened.
 */
export const dakNamespace = (raw: string | null | undefined): string => {
  const ns = String(raw ?? "urn:unknown")
    .replace(/\/$/, "")
    .replace(/\/(bpmn|dmn|cql|fsh)$/i, "");
  return ns.replace(/^http:\/\/(smart\.who\.int\b)/, "https://$1");
};

/** True when {@link dakNamespace} had to rewrite the scheme — worth reporting, not worth failing on. */
export const normalisedScheme = (raw: string | null | undefined): boolean => /^http:\/\/smart\.who\.int\b/.test(String(raw ?? ""));

/** A file a DAK ships. Shared by l2:external-artifact and its interior elaborations. */
export const artifactId = (ns: string, fileId: string): string => `${ns}/artifact/${fileId}`;

/** An element inside a file. BPMN and DMN ids are file-scoped, so the file IRI is the scope. */
export const elementId = (ns: string, fileId: string, id: string): string => `${artifactId(ns, fileId)}#${id}`;

/** A role, defined once and referenced by name from every process that involves it. */
export const personaId = (ns: string, name: string): string => `${ns}/persona/${slug(name)}`;

/** A named item of information a decision reads. */
export const dataElementId = (ns: string, name: string): string => `${ns}/data-element/${slug(name)}`;

// ---- StructureDefinition references in FSH ------------------------------------------------------
// Not in smart-kg, which recorded `InstanceOf:` and `Parent:` verbatim. The migrated layers type
// `profile` and `baseDefinition` as FHIR `uri`, so a bare FSH name is turned into the canonical
// SUSHI would give it, by a stated rule rather than left as a string no IRI parser accepts.

const ABSOLUTE = /^[A-Za-z][A-Za-z0-9+.-]*:\S+$/;

/** StructureDefinitions an IG defines itself: FSH name (and `Id:`) -> id. */
export function localStructureDefinitions(fsh: string[], json: unknown[] = []): Map<string, string> {
  const out = new Map<string, string>();
  for (const text of fsh) {
    for (const blk of text.split(/^(?=(?:Profile|Logical|Extension|Resource):\s*\S)/m)) {
      const m = /^(?:Profile|Logical|Extension|Resource):\s*(\S+)/.exec(blk);
      if (!m) continue;
      const id = /^Id:\s*(\S+)/m.exec(blk)?.[1] ?? m[1]!;
      out.set(m[1]!, id);
      out.set(id, id);
    }
  }
  for (const j of json) {
    if (!j || typeof j !== "object") continue;
    const r = j as { resourceType?: unknown; id?: unknown; name?: unknown };
    if (r.resourceType !== "StructureDefinition" || typeof r.id !== "string") continue;
    out.set(r.id, r.id);
    if (typeof r.name === "string") out.set(r.name, r.id);
  }
  return out;
}

/**
 * The canonical of a StructureDefinition named in FSH (`InstanceOf:`, `Parent:`):
 * an absolute IRI as written; an `$alias` as the alias resolves; a name the IG
 * defines under the IG's canonical; anything else as FHIR core names it.
 */
export function structureDefinitionCanonical(
  ref: string,
  ctx: { canonical: string; aliases?: Record<string, string>; local?: Map<string, string> },
): string {
  const r = (ctx.aliases?.[ref] ?? ref).trim();
  if (ABSOLUTE.test(r)) return r;
  const local = ctx.local?.get(r);
  if (local) return `${ctx.canonical}/StructureDefinition/${local}`;
  return `http://hl7.org/fhir/StructureDefinition/${r}`;
}
