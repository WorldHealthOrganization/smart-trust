/**
 * The shape of an ontology LAYER — what `ontology/<layer>/<layer>.json` holds
 * in WHO smart-kg — and the typed property declaration a class carries here.
 *
 * ## What the migration adds, and what it keeps
 *
 * smart-kg declares a class's properties as a list of NAMES, binds some of them
 * to value sets, and says nothing about the type of the rest. Here each property
 * is a {@link PropertySpec}: a Zod schema for its value and the FHIR type its
 * logical-model element takes. A property bound to a value set takes its codes
 * from that set, so the binding is declared once, in smart-kg's own terms.
 *
 * The emitted ontology JSON ({@link toOntologyJson}) is smart-kg's format,
 * field for field, so tools written against smart-kg — `validate.mjs`,
 * `build-exports.mjs` — read it unchanged. It is no longer held equal to WHO's
 * `ontology/l1/l1.json`: smart-kg is deprecated (owner, 2026-10-16).
 */
import { z } from "zod";

/** FHIR types an L1 property maps to. */
export type FhirType =
  | "string"
  | "markdown"
  | "uri"
  | "date"
  | "code"
  | "integer"
  | "unsignedInt"
  | "boolean"
  | "BackboneElement";

export interface PropertySpec {
  /** The value's schema. Every L1 property is optional on an instance. */
  schema: z.ZodType;
  fhir: FhirType;
  /** `"*"` when the element repeats (FHIR `0..*`). */
  max?: "*";
  /** A value set id from the layer, for `fhir: "code"`. */
  binding?: string;
  /** For `fhir: "BackboneElement"`: its child elements. */
  children?: Record<string, PropertySpec>;
  /** Set when the class's {@link ClassSpec.parent} already defines this element. */
  inherited?: true;
  short: string;
  definition: string;
}

/**
 * An existing FHIR model a class's logical model derives from — reuse in the
 * FHIR projection. The FSH emits `Parent:` and leaves out the elements the
 * parent already defines.
 */
export interface ParentModel {
  /** FSH name or FHIR type: `DublinCore` (smart-base), `Coding` (FHIR core). */
  name: string;
  where: string;
}

/** A value-set binding as smart-kg writes it: an id, or `{set, severity}`. */
export const BindingSchema = z.union([
  z.string(),
  z.object({ set: z.string(), severity: z.enum(["error", "warning"]).optional() }).strict(),
]);
export type Binding = z.infer<typeof BindingSchema>;
export const bindingOf = (b: Binding): { set: string; severity: "error" | "warning" } =>
  typeof b === "string" ? { set: b, severity: "error" } : { set: b.set, severity: b.severity ?? "error" };

const DerivationLevel = z.enum(["derived", "inferred", "decided"]);

export const ValueSetSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    note: z.string().min(1),
    source: z.string().min(1),
    codes: z.array(z.object({ code: z.string().min(1), definition: z.string().min(1) }).strict()).min(1),
  })
  .strict();

export const PredicateSchema = z
  .object({
    predicate: z.string().regex(/^[a-z][A-Za-z0-9]*$/),
    iri: z.string().url(),
    note: z.string().min(1),
    openQualifier: z.boolean().optional(),
  })
  .strict();

export const EdgeRuleSchema = z
  .object({
    predicate: z.string(),
    source: z.string(),
    target: z.string(),
    qualifier: z.string().optional(),
    minDerivation: DerivationLevel.optional(),
    note: z.string().optional(),
  })
  .strict();

export const GroundingSchema = z.object({ what: z.string(), where: z.string(), detail: z.string() }).strict();
export const OmissionSchema = z.object({ what: z.string(), why: z.string() }).strict();

/**
 * What kind of thing a class is, per layer: L1's Source, Concept and Reference;
 * L2's Kit, Component and Element; L2-BPMN's and L2-DMN's Artefact and
 * Structure; L3's Conformance and Knowledge (smart-kg 3.0).
 */
export const CLASS_KINDS = ["Source", "Concept", "Reference", "Kit", "Component", "Element", "Artefact", "Structure", "Conformance", "Knowledge"] as const;
export const ClassKindSchema = z.enum(CLASS_KINDS);

/** A class as the ontology JSON states it: properties by NAME. */
export const OntologyClassSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    name: z.string().min(1),
    kind: ClassKindSchema,
    iri: z.string().url(),
    note: z.string().min(1),
    properties: z.array(z.string()),
    valueSets: z.record(z.string(), BindingSchema).optional(),
    iriPattern: z.string().optional(),
    minDerivation: DerivationLevel.optional(),
    propertyNote: z.string().optional(),
    contentFields: z.array(z.string()).optional(),
    elaborates: z.string().optional(),
  })
  .strict();

/** One ontology layer document — the smart-kg `<layer>.json` format, 3.0. */
export const OntologyLayerSchema = z
  .object({
    schemaVersion: z.string(),
    layer: z.string(),
    namespace: z.string().url(),
    instanceNamespace: z.string().url().optional(),
    source: z.string(),
    note: z.string(),
    profileNote: z.string().optional(),
    imports: z.array(z.string()).optional(),
    groundedIn: z.array(GroundingSchema),
    valueSets: z.array(ValueSetSchema).optional(),
    predicates: z.array(PredicateSchema),
    classes: z.array(OntologyClassSchema),
    edges: z.array(EdgeRuleSchema),
    deliberatelyOmitted: z.array(OmissionSchema).optional(),
  })
  .strict()
  .superRefine((o, ctx) => {
    // What a reader of the JSON assumes and smart-kg never checks of the
    // ontology itself: every edge names declared classes and a declared
    // predicate, every binding names a declared value set and a declared
    // property, and every content field is a declared property.
    if (o.imports?.length) return;
    const classes = new Set(o.classes.map((c) => c.id));
    const predicates = new Set(o.predicates.map((p) => p.predicate));
    const sets = new Set((o.valueSets ?? []).map((v) => v.id));
    o.edges.forEach((e, i) => {
      for (const end of ["source", "target"] as const) {
        if (!classes.has(e[end])) ctx.addIssue({ code: "custom", path: ["edges", i, end], message: `"${e[end]}" is not a class of this layer` });
      }
      if (!predicates.has(e.predicate)) ctx.addIssue({ code: "custom", path: ["edges", i, "predicate"], message: `"${e.predicate}" is not a predicate of this layer` });
    });
    o.classes.forEach((c, i) => {
      for (const [prop, b] of Object.entries(c.valueSets ?? {})) {
        if (!c.properties.includes(prop)) ctx.addIssue({ code: "custom", path: ["classes", i, "valueSets", prop], message: `binds "${prop}", which ${c.id} does not declare` });
        if (!sets.has(bindingOf(b).set)) ctx.addIssue({ code: "custom", path: ["classes", i, "valueSets", prop], message: `value set "${bindingOf(b).set}" is not declared` });
      }
      for (const f of c.contentFields ?? []) {
        if (!c.properties.includes(f)) ctx.addIssue({ code: "custom", path: ["classes", i, "contentFields"], message: `content field "${f}" is not a property of ${c.id}` });
      }
    });
    const ids = o.classes.map((c) => c.id);
    const dup = ids.find((id, i) => ids.indexOf(id) !== i);
    if (dup) ctx.addIssue({ code: "custom", path: ["classes"], message: `class "${dup}" is declared twice` });
  });

export type OntologyLayer = z.infer<typeof OntologyLayerSchema>;
export type ValueSet = z.infer<typeof ValueSetSchema>;
export type Predicate = z.infer<typeof PredicateSchema>;
export type EdgeRule = z.infer<typeof EdgeRuleSchema>;
export type Grounding = z.infer<typeof GroundingSchema>;
export type Omission = z.infer<typeof OmissionSchema>;

/** A class as authored here: typed property specs plus smart-kg's own fields. */
export interface ClassSpec {
  id: string;
  name: string;
  kind: (typeof CLASS_KINDS)[number];
  iri: string;
  note: string;
  /** Insertion order is the order smart-kg lists them in, and is kept. */
  properties: Record<string, PropertySpec>;
  valueSets?: Record<string, Binding>;
  iriPattern?: string;
  minDerivation?: "derived" | "inferred" | "decided";
  propertyNote?: string;
  contentFields?: string[];
  /** The class of a lower layer this one describes the interior of, at the same IRI (smart-kg `elaborates`). */
  elaborates?: string;
  parent?: ParentModel;
  /** An existing smart-base model this class corresponds to without deriving from it, and why not. */
  correspondsTo?: { name: string; why: string };
}

/** A layer as authored here. */
export interface LayerSpec {
  schemaVersion: string;
  layer: string;
  namespace: string;
  instanceNamespace?: string;
  source: string;
  note: string;
  /** L3's note on profiles (smart-kg l3.json `profileNote`). */
  profileNote?: string;
  imports?: string[];
  groundedIn: Grounding[];
  valueSets: ValueSet[];
  predicates: Predicate[];
  classes: ClassSpec[];
  edges: EdgeRule[];
  deliberatelyOmitted?: Omission[];
}

/** smart-kg's key order for a class, so the projection serialises as WHO's file does. */
const CLASS_KEYS = ["id", "name", "kind", "iri", "note", "properties", "valueSets", "iriPattern", "minDerivation", "propertyNote", "contentFields", "elaborates"] as const;

/** Project a typed layer to the smart-kg JSON format (property names only). */
export function toOntologyJson(l: LayerSpec): OntologyLayer {
  const classes = l.classes.map((c) => {
    const full: Record<string, unknown> = { ...c, properties: Object.keys(c.properties) };
    const out: Record<string, unknown> = {};
    for (const k of CLASS_KEYS) if (full[k] !== undefined) out[k] = full[k];
    return out;
  });
  return OntologyLayerSchema.parse({
    schemaVersion: l.schemaVersion,
    layer: l.layer,
    namespace: l.namespace,
    ...(l.instanceNamespace ? { instanceNamespace: l.instanceNamespace } : {}),
    source: l.source,
    note: l.note,
    ...(l.profileNote ? { profileNote: l.profileNote } : {}),
    ...(l.imports ? { imports: l.imports } : {}),
    groundedIn: l.groundedIn,
    valueSets: l.valueSets,
    predicates: l.predicates,
    classes,
    edges: l.edges,
    ...(l.deliberatelyOmitted ? { deliberatelyOmitted: l.deliberatelyOmitted } : {}),
  });
}

/** The strict Zod object an instance's `properties` must satisfy for a class. */
export function propertiesSchemaFor(c: ClassSpec): z.ZodType {
  const shape: Record<string, z.ZodType> = {};
  for (const [name, p] of Object.entries(c.properties)) shape[name] = p.schema.optional();
  return z.object(shape).strict();
}
