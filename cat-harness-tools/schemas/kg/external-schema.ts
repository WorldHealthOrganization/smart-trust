/**
 * A specification this repository DEPENDS ON and does not hold.
 *
 * An imported schema (DC, OMG DMN, BPMN, …) is `referenced`, in the sense
 * `materialization.ts` means it: we know it exists and WHICH VERSION we
 * conform to, and hold none of its bytes.
 *
 * A transcription with no cited edition cannot be checked, cannot be updated
 * deliberately, and cannot tell a reader whether a field it lacks is missing
 * or simply not in that edition — e.g. `dublin-core.ts` carries the prefix
 * `dc` but no namespace URI or DCMI version.
 *
 * ## A version is part of the IDENTITY
 *
 * `{authority, id, version}` together, never `{authority, id}`. BPMN 1.2 and
 * BPMN 2.0 are different specifications that share a name.
 *
 * @graphNode schema
 * ## Why this lives in cat-harness and not in core
 *
 * Its subject is the specifications the platform itself conforms to — BPMN,
 * DMN, DCMI — not any folio's content, and its importers are platform
 * tooling.
 *
 * @module cat-harness/schemas/external-schema
 */
import { z } from "zod";

/** The tag every external-schema record declares. */
export const EXTERNAL_SCHEMA_TAG = "folio-external-schema/v1";

/**
 * Who publishes it.
 *
 * A short controlled list rather than free text: an authority is the thing a
 * reader looks up, and `OMG` / `Object Management Group` / `omg.org` as three
 * spellings of one publisher is how a registry stops being queryable.
 */
export const SPEC_AUTHORITIES = ["OMG", "DCMI", "W3C", "IETF", "ISO", "HL7", "other"] as const;
export type SpecAuthority = (typeof SPEC_AUTHORITIES)[number];

/**
 * How this repository depends on the specification.
 *
 * The distinction is what a reader needs in order to judge a version bump:
 * `conforms` means our artefacts claim to BE instances of it, so a bump is a
 * migration; `reads` means we parse someone else's layers, so a bump is a
 * compatibility question; `cites` means we quote it and nothing breaks.
 */
export const SPEC_USES = ["conforms", "reads", "cites"] as const;
export type SpecUse = (typeof SPEC_USES)[number];

export const ExternalSchemaSchema = z
  .object({
    $schema: z.literal(EXTERNAL_SCHEMA_TAG),
    /** Stable local id, e.g. `omg-bpmn-2.0`. */
    id: z.string().regex(/^[a-z][a-z0-9.-]*$/, "an external-schema id is lowercase kebab-case"),
    authority: z.enum(SPEC_AUTHORITIES),
    /** The specification's own title, as the authority writes it. */
    title: z.string().min(1),
    /**
     * The edition being conformed to.
     *
     * REQUIRED, and it is the reason this record exists. Owner: *"should
     * reference specific version being used"*.
     */
    version: z.string().min(1),
    /**
     * Where the specification is published.
     *
     * A URL, not a local path: the state is `referenced`, so there is nothing
     * local to point at. Egress is blocked in this environment, so this is
     * deliberately NOT fetched or validated at check time — an unreachable URL
     * is a fact about the network, not about the record.
     */
    specUrl: z.string().url(),
    /**
     * The XML namespaces or URI stems this edition defines, as WE consume them.
     *
     * Many per specification: BPMN 2.0 defines the MODEL and DI namespaces and
     * this repository uses both. The check reconciles these against what the
     * corpus actually declares, which is the only way the record can go stale
     * loudly instead of quietly.
     */
    namespaces: z.array(z.string().min(1)).default([]),
    use: z.enum(SPEC_USES),
    // No `usedBy`: the blast radius of a bump is read from the USERS, each of
    // which declares the spec it conforms to (`scripts/spec-users.ts`, bean
    // `u63y`). A hand-written list here was the spec naming its dependents.
    /**
     * The OPERATIVE vocabulary — the terms this repository actually acts on.
     *
     * Owner, 2026-09-20: *"tooling can help materialize schema, but some
     * schema that is operational should be in KG."* That is the line this
     * field draws, and it is not the same as the reference/materialize one:
     *
     * - the SPECIFICATION stays `referenced` — a PDF at omg.org we do not hold;
     * - the TERMS WE BRANCH ON are in the knowledge graph, because a consumer
     *   that dispatches on `bpmn:exclusiveGateway` needs that term to be a
     *   node it can resolve, not a string in somebody's parser.
     *
     * Deliberately a SUBSET and never the whole edition. BPMN 2.0 defines
     * well over a hundred elements; this repository's engine branches on a
     * dozen. Listing the rest would be transcribing the spec — the thing the
     * `referenced` state exists to avoid — and would put terms in the graph
     * that nothing can be said about.
     *
     * A term absent here is not "unsupported": it is UNDECLARED, and the
     * difference is the same one `materialization.ts` draws between `unknown`
     * and a finding.
     */
    terms: z
      .array(
        z
          .object({
            /** The term as the corpus spells it, e.g. `bpmn:exclusiveGateway`. */
            term: z.string().min(1),
            /** What this repository DOES with it — the reason it is operative. */
            operative: z.string().min(1),
          })
          .strict(),
      )
      .default([]),
    /**
     * Why this edition, where the choice was not forced.
     *
     * Absent means "the only one" or "inherited from a tool"; present means
     * somebody chose, and the next person deserves the reason.
     */
    note: z.string().min(1).optional(),
  })
  .strict();
export type ExternalSchema = z.infer<typeof ExternalSchemaSchema>;

/** Every operative term across the declared specifications. */
export function operativeTerms(
  specs: readonly ExternalSchema[],
): Array<{ term: string; operative: string; spec: ExternalSchema }> {
  return specs.flatMap((s) => s.terms.map((t) => ({ ...t, spec: s })));
}

/** Every namespace any declared specification claims, for reconciliation. */
export function declaredNamespaces(specs: readonly ExternalSchema[]): Map<string, ExternalSchema> {
  const out = new Map<string, ExternalSchema>();
  for (const s of specs) for (const ns of s.namespaces) out.set(ns, s);
  return out;
}

/**
 * Namespaces the corpus uses that no record declares.
 *
 * The finding that matters, and the direction matters too: an UNDECLARED
 * namespace means we are conforming to something nobody named, which is the
 * pre-`j66n` state for BPMN. A declared namespace nobody uses is reported
 * separately, because it is a different problem — a record that has outlived
 * its dependency — and folding them loses which one you have.
 */
export function undeclaredNamespaces(
  inUse: readonly string[],
  specs: readonly ExternalSchema[],
): string[] {
  const known = declaredNamespaces(specs);
  return [...new Set(inUse)].filter((ns) => !known.has(ns)).sort();
}

/** Declared namespaces nothing in the corpus uses. */
export function unusedNamespaces(
  inUse: readonly string[],
  specs: readonly ExternalSchema[],
): string[] {
  const used = new Set(inUse);
  return [...declaredNamespaces(specs).keys()].filter((ns) => !used.has(ns)).sort();
}
