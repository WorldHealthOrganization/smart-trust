/**
 * Where a field's TYPE is defined, as a link — so every type name in a class
 * diagram goes back to its definition, whatever source drew it.
 *
 * @module scripts/type-links
 * @graphNode none — a lookup over published specifications, not a schema
 *
 * A type that is a declaration of the schema graph links to that declaration
 * (the viewer does that from the edge). This is the rest: the built-in types
 * each source language names without declaring, linked to the specification
 * that defines them. One table, read by the schemas viewer and by the skill and
 * Tool pages, so a `string` links to the same place on all of them.
 *
 * Not knowing a type is an answer: {@link typeLink} returns `undefined`, and the
 * name is shown unlinked rather than linked somewhere plausible.
 */

/** The source a declaration was read from, as the diagram labels it. */
export type ClassSource = "zod" | "typescript" | "json-schema" | "fhir" | "fhir:profile" | "skill" | "owl" | "rdfs" | "rdf" | "moddle";

const FHIR_DATATYPES = "https://hl7.org/fhir/datatypes.html";
const FHIR_CORE_SD = "http://hl7.org/fhir/StructureDefinition/";
const JSON_SCHEMA_TYPE = "https://json-schema.org/understanding-json-schema/reference/";
const XSD = "https://www.w3.org/TR/xmlschema-2/";

/** JSON Schema's own types, each to its page of the reference. */
const JSON_TYPES: Record<string, string> = {
  string: `${JSON_SCHEMA_TYPE}string`,
  number: `${JSON_SCHEMA_TYPE}numeric`,
  integer: `${JSON_SCHEMA_TYPE}numeric#integer`,
  boolean: `${JSON_SCHEMA_TYPE}boolean`,
  null: `${JSON_SCHEMA_TYPE}null`,
  array: `${JSON_SCHEMA_TYPE}array`,
  object: `${JSON_SCHEMA_TYPE}object`,
  // `format` values a field type may carry, to the XML Schema type they mean.
  date: `${XSD}#date`,
  "date-time": `${XSD}#dateTime`,
  datetime: `${XSD}#dateTime`,
  time: `${XSD}#time`,
  duration: `${XSD}#duration`,
  uri: `${XSD}#anyURI`,
};

/** Zod's built-ins, to the Zod API reference. */
const ZOD_API = "https://zod.dev/api";
const ZOD_TYPES: Record<string, string> = {
  string: `${ZOD_API}#strings`,
  number: `${ZOD_API}#numbers`,
  bigint: `${ZOD_API}#bigints`,
  boolean: `${ZOD_API}#booleans`,
  date: `${ZOD_API}#dates`,
  enum: `${ZOD_API}#enums`,
  literal: `${ZOD_API}#literals`,
  array: `${ZOD_API}#arrays`,
  record: `${ZOD_API}#records`,
  union: `${ZOD_API}#unions`,
  object: `${ZOD_API}#objects`,
  unknown: `${ZOD_API}#unknown`,
  any: `${ZOD_API}#any`,
  datetime: `${ZOD_API}#iso-datetimes`,
  url: `${ZOD_API}#urls`,
  email: `${ZOD_API}#emails`,
  uuid: `${ZOD_API}#uuids`,
};

/**
 * The definition of the type `name` as written by `source`, or `undefined`.
 *
 * FHIR: a primitive (a lower-case code — `string`, `dateTime`, `code`) is on
 * the datatypes page at its anchor; anything else is its canonical
 * StructureDefinition URL, which resolves to its page on hl7.org. Pass the
 * reader's own `typeLinks` first: it knows the canonical a type was written as.
 */
export function typeLink(source: ClassSource, name: string, known?: Readonly<Record<string, string>>): string | undefined {
  const bare = name.replace(/\[\]$/, "").replace(/^z\./, "").replace(/\(.*$/, "");
  if (known?.[bare]) return fhirPage(known[bare]!);
  switch (source) {
    case "fhir":
    case "fhir:profile":
      if (!/^[A-Za-z][A-Za-z0-9]*$/.test(bare)) return undefined;
      return /^[a-z]/.test(bare) ? `${FHIR_DATATYPES}#${bare}` : `${FHIR_CORE_SD}${bare}`;
    case "json-schema":
      return JSON_TYPES[bare];
    case "zod":
    case "typescript": {
      const head = /^([a-z]+)/.exec(bare)?.[1];
      return head ? ZOD_TYPES[head] : undefined;
    }
    default:
      return undefined;
  }
}

/** A FHIR core primitive's canonical goes to its datatypes anchor; anything else is linked as given. */
function fhirPage(url: string): string {
  if (url.startsWith(FHIR_CORE_SD)) {
    const code = url.slice(FHIR_CORE_SD.length);
    if (/^[a-z]/.test(code)) return `${FHIR_DATATYPES}#${code}`;
  }
  return url;
}

/** The source label a declaration kind is drawn with, upper right of its box. */
export function sourceOfKind(kind: string): ClassSource {
  if (kind === "json-schema") return "json-schema";
  if (kind === "fhir-logical") return "fhir";
  if (kind === "fhir-profile") return "fhir:profile";
  if (kind === "owl-class") return "owl";
  if (kind === "rdfs-class") return "rdfs";
  if (kind === "rdf-property-set") return "rdf";
  if (kind === "moddle-class" || kind === "moddle-enum") return "moddle";
  if (kind === "interface" || kind === "type-alias") return "typescript";
  return "zod";
}

/** Zod modifiers that change a value's constraints, not its type: dropped from the UML type. */
const ZOD_MODIFIER =
  /\.(optional|nullable|nullish|default|min|max|int|positive|negative|nonnegative|nonpositive|nonempty|regex|describe|refine|superRefine|transform|length|url|email|uuid|datetime|date|time|trim|toLowerCase|toUpperCase|catch|brand|readonly|strict|strip|passthrough|finite|safe|gte|lte|gt|lt|multipleOf|startsWith|endsWith|includes|pipe|meta)\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)$/;

/**
 * The type a class diagram shows for a field, as UML writes it: `string`,
 * `Foo[]`, `enum` — the same words whichever source a field came from.
 *
 * A JSON Schema or FHIR type is already that. A Zod field's type is the
 * expression as written (`z.array(z.string().min(1)).optional()`), which the
 * field table keeps; the diagram shows what it IS (`string[]`), since its
 * optionality and bounds are the cardinality beside it. An expression this
 * does not recognise is shown as written rather than guessed at.
 */
export function umlType(source: ClassSource, type: string): string {
  if (source !== "zod" && source !== "typescript") return type;
  let t = type.trim().replace(/\bz\./g, "");
  for (let i = 0; i < 24 && ZOD_MODIFIER.test(t); i++) t = t.replace(ZOD_MODIFIER, "").trim();
  let m: RegExpExecArray | null;
  if ((m = /^array\(([\s\S]*)\)$/.exec(t))) return `${umlType(source, m[1]!)}[]`;
  if ((m = /^(string|number|boolean|bigint|date|unknown|any|null|undefined|never|void|symbol)\(\)$/.exec(t))) return m[1]!;
  if (/^(enum|nativeEnum)\(/.test(t)) return "enum";
  if ((m = /^literal\(([\s\S]*)\)$/.exec(t))) return m[1]!;
  if (/^record\(/.test(t)) return "record";
  if (/^(object|strictObject|looseObject)\(/.test(t)) return "object";
  if (/^(union|discriminatedUnion)\(/.test(t)) return "union";
  if (/^lazy\(/.test(t)) return "lazy";
  if (/^tuple\(/.test(t)) return "tuple";
  if ((m = /^([A-Za-z_$][\w$]*)$/.exec(t))) return m[1]!;
  return t;
}
