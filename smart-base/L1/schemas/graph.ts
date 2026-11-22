/**
 * A knowledge-graph DOCUMENT — tier 1, its form.
 *
 * Migrated from smart-kg `shapes/recommendation-graph.schema.json`. That file
 * was hand-written JSON Schema; this is the Zod it is now generated FROM
 * (`generated/recommendation-graph.schema.json`), so the shape a TypeScript
 * caller parses with and the shape a JSON Schema validator checks are one
 * declaration rather than two that can drift.
 *
 * Tier 1 deliberately does not know the ontology: node types and predicates
 * are patterns here, not enums. Membership, edge licensing and typed property
 * values are tier 2, in `validate.ts`, against `l1.ts`. The reason is the one
 * the original shape gave — the predicate set belongs to the ontology and
 * changes with it, so a copy here would drift.
 */
import { z } from "zod";

import { SHAPE_TEXT as T } from "./shape-text.ts";
import { DERIVATION, enumOf } from "./vocab.ts";

const NOT_DERIVED = (d: string) => d === "inferred" || d === "decided";

export const ClassIdSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).describe(T["/$defs/classId"]);
export const PredicateNameSchema = z.string().regex(/^[a-z][A-Za-z0-9]*$/).describe(T["/$defs/predicate"]);
export const DerivationSchema = enumOf(DERIVATION).describe(T["/$defs/derivation"]);

export const EvidenceSchema = z
  .object({
    location: z.string().describe(T["/$defs/evidence/properties/location"]),
    quote: z.string().describe(T["/$defs/evidence/properties/quote"]).optional(),
    artifact: z.string().describe(T["/$defs/evidence/properties/artifact"]).optional(),
    by: z.string().describe(T["/$defs/evidence/properties/by"]).optional(),
    at: z.iso.date().describe(T["/$defs/evidence/properties/at"]).optional(),
  })
  .strict()
  .describe(T["/$defs/evidence"]);

export const ProvenanceSourceSchema = z
  .object({
    path: z.string(),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    repository: z.string().optional(),
    commit: z.string().optional(),
    note: z.string().describe(T["/$defs/provenanceSource/properties/note"]).optional(),
  })
  .strict();

const PROPERTY_KEY = /^[A-Za-z][A-Za-z0-9_]*(\[x\])?(\.[A-Za-z][A-Za-z0-9_]*(\[x\])?)*$/;
export const NodePropertiesSchema = z
  .record(z.string().regex(PROPERTY_KEY), z.unknown())
  .describe(T["/$defs/nodeProperties"]);

/** Shared by nodes and edges: a claim that was not mechanically derived says why and where. */
function requireWhy(o: { derivation: string; note?: string; evidence?: unknown }, ctx: z.RefinementCtx) {
  if (!NOT_DERIVED(o.derivation)) return;
  for (const k of ["note", "evidence"] as const) {
    if (o[k] === undefined) {
      ctx.addIssue({ code: "custom", path: [k], message: `${o.derivation} and carries no ${k}. ${T["/$defs/node/allOf[0]/then"]}` });
    }
  }
}

export const NodeSchema = z
  .object({
    id: z.string().describe(T["/$defs/node/properties/id"]),
    type: ClassIdSchema,
    label: z.string().min(1).describe(T["/$defs/node/properties/label"]),
    definedBy: z.string().url().describe(T["/$defs/node/properties/definedBy"]).optional(),
    properties: NodePropertiesSchema.optional(),
    derivation: DerivationSchema,
    note: z.string().optional(),
    evidence: EvidenceSchema.optional(),
    flagRef: z.string().describe(T["/$defs/node/properties/flagRef"]).optional(),
    skill: z.string().describe(T["/$defs/node/properties/skill"]).optional(),
  })
  .strict()
  .superRefine(requireWhy);

export const EdgeSchema = z
  .object({
    type: z.literal("Statement"),
    predicate: PredicateNameSchema,
    source: z.string().describe(T["/$defs/edge/properties/source"]),
    target: z.string().describe(T["/$defs/edge/properties/target"]),
    qualifier: z.string().describe(T["/$defs/edge/properties/qualifier"]).optional(),
    derivation: DerivationSchema,
    note: z.string().optional(),
    evidence: EvidenceSchema.optional(),
    flagRef: z.string().optional(),
    skill: z.string().optional(),
    properties: NodePropertiesSchema.describe(T["/$defs/edge/properties/properties"]).optional(),
  })
  .strict()
  .superRefine(requireWhy)
  .describe(T["/$defs/edge"]);

export const GraphDocumentSchema = z
  .object({
    "@context": z.union([z.string().url(), z.record(z.string(), z.unknown()), z.array(z.unknown())]).describe(T["/properties/@context"]),
    id: z.string().describe(T["/properties/id"]),
    type: z.literal("Entity").describe(T["/properties/type"]),
    ontologyVersion: z.string().describe(T["/properties/ontologyVersion"]),
    generatedAt: z.iso.datetime({ offset: true }),
    wasDerivedFrom: z.array(ProvenanceSourceSchema).describe(T["/properties/wasDerivedFrom"]).optional(),
    nodes: z.array(NodeSchema),
    edges: z.array(EdgeSchema),
    dak: NodePropertiesSchema.describe(T["/properties/dak"]).optional(),
  })
  .strict()
  .describe(T["/"]);

export type GraphDocument = z.infer<typeof GraphDocumentSchema>;
export type GraphNode = z.infer<typeof NodeSchema>;
export type GraphEdge = z.infer<typeof EdgeSchema>;
