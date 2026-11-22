/**
 * Constructors for {@link PropertySpec}. One per FHIR type, so a property's
 * Zod schema and its FHIR element type cannot be chosen independently and
 * disagree.
 */
import { z } from "zod";

import type { PropertySpec, ValueSet } from "./ontology.ts";

const text = (fhir: "string" | "markdown") => (short: string, definition: string): PropertySpec => ({
  schema: z.string().min(1),
  fhir,
  short,
  definition,
});

const list = (item: PropertySpec): PropertySpec => ({ ...item, schema: z.array(item.schema).min(1), max: "*" });

export const p = {
  string: text("string"),
  markdown: text("markdown"),
  uri: (short: string, definition: string): PropertySpec => ({
    // Any absolute IRI, `urn:` included — FHIR `uri` admits both.
    schema: z.string().regex(/^[A-Za-z][A-Za-z0-9+.-]*:\S+$/, "an absolute IRI"),
    fhir: "uri",
    short,
    definition,
  }),
  /** FHIR `date`: YYYY, YYYY-MM or YYYY-MM-DD — WHO often dates a publication by year alone. */
  date: (short: string, definition: string): PropertySpec => ({
    schema: z.string().regex(/^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/, "a FHIR date: YYYY, YYYY-MM or YYYY-MM-DD"),
    fhir: "date",
    short,
    definition,
  }),
  sha256: (short: string, definition: string): PropertySpec => ({
    schema: z.string().regex(/^[0-9a-f]{64}$/, "64 lower-case hex digits"),
    fhir: "string",
    short,
    definition,
  }),
  integer: (short: string, definition: string): PropertySpec => ({ schema: z.number().int(), fhir: "integer", short, definition }),
  unsignedInt: (short: string, definition: string): PropertySpec => ({ schema: z.number().int().nonnegative(), fhir: "unsignedInt", short, definition }),
  boolean: (short: string, definition: string): PropertySpec => ({ schema: z.boolean(), fhir: "boolean", short, definition }),
  /**
   * Verbatim printed text, one per position, where an empty string is itself
   * what was printed — a table's blank top-left header cell. Measured: WHO
   * smart-kg's own fixture has `columns: ["", "Recommendation", …]`.
   */
  verbatimList: (short: string, definition: string): PropertySpec => ({
    schema: z.array(z.string()).min(1),
    fhir: "string",
    max: "*",
    short,
    definition,
  }),
  /** A repeating element (FHIR `0..*`): a non-empty JSON array of the item. */
  list,
  /**
   * A table row's cells, by column. `null` is meaningful — "this column is
   * filled from a content node through columnMap" — so it is admitted, and the
   * FHIR element (which cannot hold a null in a list) documents the convention.
   */
  cells: (short: string, definition: string): PropertySpec => ({
    schema: z.array(z.string().nullable()).min(1),
    fhir: "string",
    max: "*",
    short,
    definition,
  }),
  /** A JSON object keyed by free text; FHIR has no map, so the element is a list of key/value pairs. */
  map: (short: string, definition: string, key: string, value: string): PropertySpec => ({
    schema: z.record(z.string(), z.string().min(1)),
    fhir: "BackboneElement",
    max: "*",
    children: {
      [key]: { schema: z.string(), fhir: "string", short: key, definition: `The ${key}.` },
      [value]: { schema: z.string(), fhir: "string", short: value, definition: `The ${value}.` },
    },
    short,
    definition,
  }),
  /** A repeating structured element: a JSON array of objects with these children. */
  backbone: (short: string, definition: string, children: Record<string, PropertySpec>): PropertySpec => ({
    schema: z
      .array(z.object(Object.fromEntries(Object.entries(children).map(([k, c]) => [k, c.schema.optional()]))).strict())
      .min(1),
    fhir: "BackboneElement",
    max: "*",
    children,
    short,
    definition,
  }),
  /**
   * Bound to a value set of the layer. An error-severity binding is an enum
   * over the set's codes; a warning-severity one admits any string, because
   * the validator reports an unknown code as a warning rather than refusing it.
   */
  code: (set: ValueSet, severity: "error" | "warning", short: string, definition: string): PropertySpec => ({
    schema:
      severity === "error"
        ? z.enum(set.codes.map((c) => c.code) as [string, ...string[]])
        : z.string().min(1),
    fhir: "code",
    binding: set.id,
    short,
    definition,
  }),
  /** Mark a spec as defined by the class's parent model. */
  inherited: (spec: PropertySpec): PropertySpec => ({ ...spec, inherited: true }),
};
