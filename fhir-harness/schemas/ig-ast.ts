/**
 * ig-ast.ts — the IG AST's file formats, declared once (bean `l0lq`).
 *
 * ## Why this exists
 *
 * Owner, 2026-10-01: *"is ast export XML? any utility for downstream use to
 * have it export json(ld)+schema?"*. The AST is JSON — `ig-ast/v1`,
 * `ig-ast-dependencies/v1`, `ig-ast-plan/v1` — written by the Java
 * `ast-export` library on top of the IG Publisher
 * (`litlfred/fhir-ig-publisher@claude/ast-export`) and read by
 * `fhir-harness/scripts/ig-ast.ts`. Until now the formats lived only as
 * TypeScript interfaces in the reader, so nothing checked that writer and
 * reader agree, and a downstream consumer had no schema to validate against.
 *
 * This module is the one declaration:
 * - **Zod**, which `readAst` validates through;
 * - **JSON Schema** generated from it (`bun run cat ig-ast:schema`), committed
 *   beside this file, for the Java side and any other consumer;
 * - a **JSON-LD context**, which `ig-ast.ts jsonld` uses to export an AST as
 *   linked data: each resource identified by its canonical URL, each edge a
 *   link.
 *
 * ## Open to what the writer adds
 *
 * Every object is `.passthrough()`: the Java side may add a field before this
 * side knows it, and refusing a newer AST over an unknown key would make the
 * reader the thing that breaks. What IS checked is every field the reader
 * uses — its presence and its type.
 *
 * ## An AST is a cache, never an authority
 *
 * `authority` is the literal `"cache"`: a manifest claiming anything else is
 * refused, because every consumer is built on the AST being provisional until
 * a full Publisher run (`ig-publisher-reduction` P3).
 *
 * @graphNode schema
 */
import { z } from "zod";
import { ownNamespace } from "@litlfred/cat-harness-tools/schemas/kg/namespaces.js";

export const IG_AST_TAG = "ig-ast/v1" as const;
export const IG_AST_DEPENDENCIES_TAG = "ig-ast-dependencies/v1" as const;
export const IG_AST_PLAN_TAG = "ig-ast-plan/v1" as const;

/** One resource the AST holds. `key` is `canonical|version`, or `Type/id` when there is no canonical. */
export const AstResourceSchema = z
  .object({
    key: z.string().min(1),
    canonical: z.string().nullable(),
    version: z.string().nullable(),
    resourceType: z.string().min(1),
    id: z.string().min(1),
    name: z.string().nullish(),
    /** The resource's JSON file, relative to the AST directory. */
    file: z.string().min(1),
    /** The IG source file it was built from, where known. */
    source: z.string().nullable(),
    /** On a merged (mixed-provenance) AST: the revision that built this resource. */
    builtAt: z.string().optional(),
  })
  .passthrough();

/** `manifest.json`. */
export const AstManifestSchema = z
  .object({
    $schema: z.literal(IG_AST_TAG),
    authority: z.literal("cache"),
    /** What stays provisional until a full Publisher run. */
    provisional: z.array(z.string()),
    provisionalUntil: z.string().optional(),
    mixed: z.boolean().optional(),
    incremental: z
      .object({ base: z.string(), head: z.string(), rebuilt: z.number(), kept: z.number(), removed: z.number() })
      .passthrough()
      .optional(),
    generatedAt: z.string().optional(),
    toolchain: z.record(z.string(), z.string().nullable()).optional(),
    /** What the AST is valid for, in `CompiledInputsSchema`'s shape. */
    inputs: z.object({ toolchain: z.string(), sourceRevision: z.string().optional(), inputDigest: z.string().optional() }).passthrough().optional(),
    inputsUnknown: z.record(z.string(), z.string()).optional(),
    resources: z.array(AstResourceSchema),
  })
  .passthrough();

/** One dependency edge. `resolved` is the key of the target in this IG, or `null` when it is elsewhere. */
export const AstEdgeSchema = z
  .object({
    source: z.string().min(1),
    kind: z.string().min(1),
    target: z.string().min(1),
    targetVersion: z.string().nullable(),
    resolved: z.string().nullable(),
    path: z.string().nullish(),
    origin: z.string().min(1),
  })
  .passthrough();

/** `dependencies.json`. */
export const AstDependenciesSchema = z
  .object({ $schema: z.literal(IG_AST_DEPENDENCIES_TAG), dependencies: z.array(AstEdgeSchema) })
  .passthrough();

/** `plan.json`: what a set of changed files means — rebuild, keep, remove, or a full build and why. */
export const AstPlanSchema = z
  .object({
    $schema: z.literal(IG_AST_PLAN_TAG).optional(),
    decision: z.string().min(1),
    coneFraction: z.number().optional(),
    rebuild: z.array(z.unknown()).optional(),
    fullBuildBecause: z.array(z.string()).optional(),
  })
  .passthrough();

export type AstResource = z.infer<typeof AstResourceSchema>;
export type AstManifest = z.infer<typeof AstManifestSchema>;
export type AstEdge = z.infer<typeof AstEdgeSchema>;
export type AstPlan = z.infer<typeof AstPlanSchema>;

/** The vocabulary the JSON-LD export uses for what FHIR does not name — an own namespace (`code-lists/own-namespaces.json`). */
export const IG_AST_VOCAB = ownNamespace("fhir-harness-ig-ast");

/**
 * The `$id` base of the generated JSON Schemas: this release's `schemas/`,
 * where the files are committed beside this module and so where publishing
 * serves them. Resolved against the vocabulary's own address (`…/v0/ns/ig-ast/`,
 * a slash namespace since cat-harness-tools#1378, so two levels up), so it
 * stays ours by the same record.
 *
 * It was the vocabulary's address itself (`…/ns/ig-ast/`) until this layer
 * declared an `iriBase`; from then `check:node-iris` requires a node's own
 * identifier to name the path its file sits at, and no file sits under
 * `ns/ig-ast/` (bean folio-assistant-63q4).
 */
export const IG_AST_SCHEMA_BASE = new URL("../../schemas/", IG_AST_VOCAB).href;

/**
 * The JSON Schemas, by file name, generated from the Zod above — as
 * **draft-07**, the version the widest range of validators read (the Java
 * side's included, and the `ajv` 6 this repository's tests use).
 */
export function igAstJsonSchemas(): Record<string, unknown> {
  const gen = (file: string, title: string, schema: z.ZodType) => ({
    ...(z.toJSONSchema(schema, { target: "draft-7", unrepresentable: "any" }) as Record<string, unknown>),
    $id: `${IG_AST_SCHEMA_BASE}${file}`,
    title,
  });
  return {
    "ig-ast.schema.json": gen("ig-ast.schema.json", "IG AST manifest (ig-ast/v1)", AstManifestSchema),
    "ig-ast-dependencies.schema.json": gen("ig-ast-dependencies.schema.json", "IG AST dependencies (ig-ast-dependencies/v1)", AstDependenciesSchema),
    "ig-ast-plan.schema.json": gen("ig-ast-plan.schema.json", "IG AST rebuild plan (ig-ast-plan/v1)", AstPlanSchema),
  };
}


/**
 * The JSON-LD context `ig-ast.ts jsonld` writes against. A resource node's
 * `@id` is its canonical URL (or `urn:fhir:<Type>/<id>` when it has none) and
 * its `@type` the FHIR resource type; an edge points at its target by `@id`.
 */
export const IG_AST_CONTEXT = {
  "@context": {
    "@version": 1.1,
    "@vocab": IG_AST_VOCAB,
    fhir: "http://hl7.org/fhir/",
    resourceType: { "@id": "@type", "@type": "@vocab" },
    key: { "@id": `${IG_AST_VOCAB}key` },
    version: { "@id": `${IG_AST_VOCAB}version` },
    file: { "@id": `${IG_AST_VOCAB}file` },
    source: { "@id": `${IG_AST_VOCAB}source` },
    dependsOn: { "@id": `${IG_AST_VOCAB}dependsOn`, "@container": "@set" },
    target: { "@id": `${IG_AST_VOCAB}target`, "@type": "@id" },
    kind: { "@id": `${IG_AST_VOCAB}kind` },
    path: { "@id": `${IG_AST_VOCAB}path` },
    origin: { "@id": `${IG_AST_VOCAB}origin` },
    resolved: { "@id": `${IG_AST_VOCAB}resolved`, "@type": "@id" },
    authority: { "@id": `${IG_AST_VOCAB}authority` },
    provisional: { "@id": `${IG_AST_VOCAB}provisional`, "@container": "@set" },
  },
} as const;

/** The IRI a resource is identified by in the JSON-LD export. */
export function resourceIri(r: Pick<AstResource, "canonical" | "resourceType" | "id">): string {
  return r.canonical ?? `urn:fhir:${r.resourceType}/${r.id}`;
}
