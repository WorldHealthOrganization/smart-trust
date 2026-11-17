#!/usr/bin/env bun
/**
 * The IG API sidecars, generated from an IG's AST: per ValueSet a JSON Schema,
 * a displays file and a JSON-LD vocabulary; per logical model a JSON Schema;
 * an OpenAPI 3.1 wrapper for each schema; the two enumeration schemas with
 * their OpenAPI wrappers; and a Swagger UI page over them (bean `h7ap`, phase 2).
 *
 *   bun run fhir-harness/scripts/ig-api-gen.ts --ast <output-ast> --out <sidecars dir> [--site <dir>]
 *     [--label <name>] [--vocab-base <iri>] [--canonical-base <url>]
 *
 * ## Why it is here
 *
 * Owner, 2026-10-23: the API an IG publishes over its terminology and logical
 * models should be "something like fhir-api", not one overlay's, and live in
 * this layer; on the phase-2 card the owner chose to port the generators. They
 * were four Python scripts an overlay ran after the Publisher. Turning a
 * ValueSet expansion or a logical model into JSON Schema, JSON-LD and OpenAPI
 * is generic FHIR, so it is here, read straight from the AST.
 *
 * ## A port, measured against the scripts it replaces
 *
 * Every file is built as the scripts built it, key order included, and
 * `ig-api-gen.test.ts` holds the shapes. The port was checked against the
 * scripts' own output on three IGs. What differs is deliberate:
 *
 * - **Nothing names an overlay.** The JSON-LD `fhir` prefix is `--vocab-base`
 *   (default `http://hl7.org/fhir/`); a vocabulary or schema with no canonical
 *   URL falls back to a relative IRI, not to one overlay's site.
 * - **A logical model's schema `$id` is under the IG's own canonical base**
 *   (`--canonical-base`, default: the IG's canonical, from its
 *   ImplementationGuide resource). The scripts used one fixed base for every IG.
 * - **Order is the AST's, or sorted**, never a directory listing's or a hash
 *   set's, so two runs write the same bytes.
 * - **The Swagger page is titled by `--label`**, not one IG's name.
 * - **No QA files**, and no Binary instance pass: on the AST route that pass
 *   looked for `Binary-*.json` in the sidecars directory, where there are none.
 *
 * Nothing here may know about WHO (fhir-harness/AGENTS.md).
 *
 * @module fhir-harness/scripts/ig-api-gen
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

// ── JSON as the scripts wrote it ────────────────────────────────────────

/**
 * An object whose keys keep the order they were set in, numeric-looking keys
 * included (a plain object puts `"1"` before `"a"`, which a Python dict does
 * not). A code-keyed map is one of these.
 */
export class Ordered {
  readonly entries: [string, unknown][] = [];
  private readonly at = new Map<string, number>();
  set(k: string, v: unknown): this {
    const i = this.at.get(k);
    if (i === undefined) {
      this.at.set(k, this.entries.length);
      this.entries.push([k, v]);
    } else this.entries[i] = [k, v];
    return this;
  }
  get size(): number {
    return this.entries.length;
  }
}

/** `json.dump(x, indent=2, ensure_ascii=False)`, byte for byte. */
export function pyJson(v: unknown, level = 0): string {
  const pad = (n: number) => "  ".repeat(n);
  if (v === null || v === undefined) return "null";
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "number" || typeof v === "boolean") return JSON.stringify(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return "[]";
    return `[\n${v.map((x) => `${pad(level + 1)}${pyJson(x, level + 1)}`).join(",\n")}\n${pad(level)}]`;
  }
  const entries = v instanceof Ordered ? v.entries : Object.entries(v as Record<string, unknown>);
  if (entries.length === 0) return "{}";
  return `{\n${entries.map(([k, x]) => `${pad(level + 1)}${JSON.stringify(k)}: ${pyJson(x, level + 1)}`).join(",\n")}\n${pad(level)}}`;
}

/** A plain JSON value, with every {@link Ordered} turned into an object (for reading back, comparing, embedding). */
export function plain(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(plain);
  if (v instanceof Ordered) return Object.fromEntries(v.entries.map(([k, x]) => [k, plain(x)]));
  if (v !== null && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]));
  return v;
}

type Json = Record<string, unknown>;
const has = (o: Json, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);
/** Python's `d.get(k, fallback)`: the value when the key is there, whatever it is. */
const get = <T>(o: Json, k: string, fallback: T): unknown => (has(o, k) ? o[k] : fallback);
const str = (v: unknown): string => (v === null || v === undefined ? "None" : String(v));
const lastSegment = (u: string): string => u.split("/").slice(-1)[0]!;

// ── ValueSets: schema, displays, JSON-LD ────────────────────────────────

export interface Coded {
  code: string;
  display: string;
  system?: string;
}

/** The id a ValueSet's files are named by: `id`, else the last segment of `url`, of `fullUrl`, else `name`, else the title squeezed. */
export function valueSetFileId(entry: Json): string {
  const r = (entry["resource"] ?? {}) as Json;
  if (has(r, "id") && r["id"] !== "unknown") return str(r["id"]);
  if (has(r, "url") && String(r["url"]).includes("/")) return lastSegment(String(r["url"]));
  if (has(entry, "fullUrl") && String(entry["fullUrl"]).includes("/")) return lastSegment(String(entry["fullUrl"]));
  return valueSetIdTail(r);
}

/** The id a ValueSet's documents state: as {@link valueSetFileId}, without the entry's `fullUrl`. */
export function valueSetId(r: Json): string {
  if (has(r, "id") && r["id"] !== "unknown") return str(r["id"]);
  if (has(r, "url") && String(r["url"]).includes("/")) return lastSegment(String(r["url"]));
  return valueSetIdTail(r);
}

function valueSetIdTail(r: Json): string {
  if (has(r, "name") && r["name"]) return str(r["name"]);
  if (has(r, "title")) {
    const w = String(r["title"]).replace(/ /g, "").replace(/-/g, "").replace(/_/g, "");
    if (w && !w.toLowerCase().startsWith("unknown")) return w;
  }
  return "unknown";
}

/** The expansion's codes, each with its display (the code when it has none) and system. */
export function codesOf(r: Json): Coded[] {
  const contains = ((r["expansion"] as Json | undefined)?.["contains"] ?? undefined) as Json[] | undefined;
  if (!contains) return [];
  const out: Coded[] = [];
  for (const item of contains) {
    if (!has(item, "code")) continue;
    const code = str(item["code"]);
    const d = has(item, "display") ? String(item["display"]) : "";
    out.push({ code, display: d.trim() ? d : code, ...(has(item, "system") ? { system: str(item["system"]) } : {}) });
  }
  return out;
}

const titleOf = (r: Json): string => str(get(r, "title", get(r, "name", "Unknown ValueSet")));
const baseOf = (url: string): string | undefined => (url.includes("/ValueSet/") ? url.split("/ValueSet/")[0] : undefined);
const timestampOf = (r: Json): unknown => ((r["expansion"] as Json | undefined) && has(r["expansion"] as Json, "timestamp") ? (r["expansion"] as Json)["timestamp"] : undefined);

/** The ValueSet's JSON Schema: a Coding-shaped object, the system pinned and the codes enumerated. */
export function valueSetSchema(r: Json, codes: readonly Coded[]): Json {
  const id = valueSetId(r);
  const title = titleOf(r);
  const url = str(get(r, "url", ""));
  const base = url ? baseOf(url) : undefined;
  const schemaId = url ? (base !== undefined ? `${base}/ValueSet-${id}.schema.json` : `${url}-${id}.schema.json`) : `#ValueSet-${id}-schema`;
  const displays = url && base !== undefined ? `${base}/ValueSet-${id}.displays.json` : `ValueSet-${id}.displays.json`;
  const systems = new Map<string, string[]>();
  for (const c of codes) {
    const s = c.system ?? "";
    if (!systems.has(s)) systems.set(s, []);
    systems.get(s)!.push(c.code);
  }
  const properties: Json = { system: { type: "string" }, code: { type: "string" } };
  const schema: Json = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: schemaId,
    title: `${title} Schema`,
    description: `JSON Schema for ${title} ValueSet codes. Values are represented as Coding objects with 'system' and 'code' properties.`,
    type: "object",
    required: ["system", "code"],
    additionalProperties: false,
    properties,
  };
  if (systems.size === 1) {
    const [system, list] = [...systems.entries()][0]!;
    properties["system"] = { type: "string", const: system };
    properties["code"] = { type: "string", enum: list };
  } else if (systems.size > 1) {
    schema["oneOf"] = [...systems.entries()].map(([system, list]) => ({ properties: { system: { const: system }, code: { enum: list } } }));
  }
  schema["narrative"] =
    `This schema validates Coding-shaped objects for the ${title} ValueSet. ` +
    `Each value must be an object with 'system' (CodeSystem URI) and 'code' (fragment after '#') properties. ` +
    `Display values are available at ${displays}. ` +
    `The canonical IRI for a code can be reconstructed as system + '#' + code. ` +
    `For a complete listing of all ValueSets, see artifacts.html#terminology-value-sets.`;
  schema["fhir:displays"] = displays;
  if (url) schema["fhir:valueSet"] = url;
  if (has(r, "version")) schema["fhir:version"] = r["version"];
  const ts = timestampOf(r);
  if (ts !== undefined) schema["fhir:expansionTimestamp"] = ts;
  return schema;
}

/** The ValueSet's display file: each code's display, by language. */
export function valueSetDisplays(r: Json, codes: readonly Coded[]): Json {
  const id = valueSetId(r);
  const title = titleOf(r);
  const url = str(get(r, "url", ""));
  const base = url ? baseOf(url) : undefined;
  const displayId = url ? (base !== undefined ? `${base}/ValueSet-${id}.displays.json` : `${url}-${id}.displays.json`) : `#ValueSet-${id}-displays`;
  const displays = new Ordered();
  for (const c of codes) displays.set(c.code, { en: c.display });
  const file: Json = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: displayId,
    title: `${title} Display Values`,
    description:
      `Display values for ${title} ValueSet codes. Generated from FHIR expansions. ` +
      `Keys are code fragments (the part after '#' in the canonical IRI). ` +
      `The full IRI can be reconstructed as system + '#' + code.`,
    type: "object",
    properties: {
      "fhir:displays": {
        type: "object",
        description: "Multilingual display values for ValueSet codes keyed by code fragment",
        patternProperties: {
          "^.+$": {
            type: "object",
            description: "Display values for a specific code fragment by language",
            properties: { en: { type: "string", description: "English display value" } },
            patternProperties: { "^[a-z]{2}(-[A-Z]{2})?$": { type: "string", description: "Display value in the specified language (ISO 639-1 code)" } },
            additionalProperties: false,
          },
        },
        additionalProperties: false,
      },
    },
    required: ["fhir:displays"],
    additionalProperties: true,
    "fhir:displays": displays,
  };
  if (url) file["fhir:valueSet"] = url;
  if (has(r, "version")) file["fhir:version"] = r["version"];
  const ts = timestampOf(r);
  if (ts !== undefined) file["fhir:expansionTimestamp"] = ts;
  return file;
}

/** A CodeSystem URL as the vocabularies alias it: `/CodeSystem/<id>` becomes `/CodeSystem-<id>`. */
export function codeSystemIri(system: string): string {
  if (!system || !system.includes("/CodeSystem/")) return system;
  const parts = system.split("/CodeSystem/");
  return parts.length === 2 ? `${parts[0]}/CodeSystem-${parts[1]}` : system;
}

/** The ValueSet's JSON-LD vocabulary: each code a node of the file, its CodeSystem aliased. */
export function valueSetVocabulary(r: Json, codes: readonly Coded[], o: { vocabBase: string; now: string }): Json {
  const id = valueSetId(r);
  const url = str(get(r, "url", ""));
  const base = url ? baseOf(url) : undefined;
  const fileUrl = url ? (base !== undefined ? `${base}/ValueSet-${id}.jsonld` : `${url}/ValueSet-${id}.jsonld`) : `ValueSet-${id}.jsonld`;
  const unique = [...new Set(codes.map((c) => c.system).filter((s): s is string => Boolean(s)))];
  const single = unique.length === 1;
  const context = new Ordered()
    .set("@version", 1.1)
    .set("@base", fileUrl)
    .set("name", "http://www.w3.org/2000/01/rdf-schema#label")
    .set("fhir", o.vocabBase)
    .set("id", "@id")
    .set("generatedAt", { "@id": "http://www.w3.org/ns/prov#generatedAtTime", "@type": "http://www.w3.org/2001/XMLSchema#dateTime" });
  const alias = new Map<string, string>();
  if (unique.length) {
    context.set("fhir:CodeSystem", { "@type": "@id" });
    if (single) {
      context.set("cs", codeSystemIri(unique[0]!));
      alias.set(unique[0]!, "cs");
    } else
      unique.forEach((s, i) => {
        context.set(`cs${i}`, codeSystemIri(s));
        alias.set(s, `cs${i}`);
      });
  }
  const graph = codes.map((c) => ({ id: `#${c.code}`, name: c.display, ...(!single && c.system && alias.has(c.system) ? { "fhir:CodeSystem": alias.get(c.system) } : {}) }));
  const vocab: Json = { "@context": context, "@id": fileUrl, "@type": "http://www.w3.org/ns/prov#Entity", generatedAt: o.now, "@graph": graph };
  if (single && unique.length) vocab["fhir:CodeSystem"] = "cs";
  return vocab;
}

/** Every ValueSet the expansions bundle holds with codes, as its three files. */
export function valueSetFiles(expansions: Json, o: { vocabBase: string; now: string }): Map<string, Json> {
  const out = new Map<string, Json>();
  if (expansions["resourceType"] !== "Bundle" || !Array.isArray(expansions["entry"])) return out;
  for (const entry of expansions["entry"] as Json[]) {
    const r = entry["resource"] as Json | undefined;
    if (!r || r["resourceType"] !== "ValueSet") continue;
    const codes = codesOf(r);
    if (!codes.length) continue;
    const id = valueSetFileId(entry);
    out.set(`ValueSet-${id}.schema.json`, valueSetSchema(r, codes));
    out.set(`ValueSet-${id}.displays.json`, valueSetDisplays(r, codes));
    out.set(`ValueSet-${id}.jsonld`, valueSetVocabulary(r, codes, o));
  }
  return out;
}

// ── Logical models ──────────────────────────────────────────────────────

export const FHIR_SCHEMA_BASE_NAME = "FHIRSchemaBase";

interface ModelElement {
  name: string;
  path: string;
  cardinality: string;
  type: string;
  valueset: string;
  short: string;
  definition: string;
  choice?: boolean;
}

interface Model {
  name: string;
  id: string;
  title: string;
  description: string;
  url: string;
  parent: string;
  elements: ModelElement[];
}

/** A logical model StructureDefinition as the schema generator reads it; undefined for any other. */
export function logicalModel(sd: Json): Model | undefined {
  if (sd["kind"] !== "logical") return undefined;
  const m: Model = {
    name: str(get(sd, "name", "")),
    id: str(get(sd, "id", "")),
    title: str(get(sd, "title", "")),
    description: str(get(sd, "description", "")),
    url: str(get(sd, "url", "")),
    parent: str(get(sd, "baseDefinition", "")),
    elements: [],
  };
  const snap = sd["snapshot"] as Json | undefined;
  const diff = sd["differential"] as Json | undefined;
  const elements = (snap && has(snap, "element") ? snap["element"] : diff && has(diff, "element") ? diff["element"] : []) as Json[];
  for (const e of elements) {
    const path = str(get(e, "path", ""));
    if (path === m.name) continue;
    const name = path.includes(".") ? path.split(".").slice(-1)[0]! : path;
    if (name.startsWith("extension")) continue;
    const el: ModelElement = { name, path, cardinality: `${str(get(e, "min", 0))}..${str(get(e, "max", "*"))}`, type: "", valueset: "", short: str(get(e, "short", "")), definition: str(get(e, "definition", "")) };
    const types = e["type"] as Json[] | undefined;
    if (types && types.length) {
      el.type = str(get(types[0]!, "code", ""));
      if (types.length > 1) {
        el.choice = true;
        el.type = types.map((t) => str(get(t, "code", ""))).join(" or ");
      } else el.choice = false;
    }
    const binding = e["binding"] as Json | undefined;
    if (binding && has(binding, "valueSet")) {
      const vs = str(binding["valueSet"]);
      if (vs.includes("/")) el.valueset = lastSegment(vs);
    }
    m.elements.push(el);
  }
  return m;
}

const TYPE_MAPPING: Record<string, Json> = {
  string: { type: "string" },
  boolean: { type: "boolean" },
  integer: { type: "integer" },
  decimal: { type: "number" },
  date: { type: "string", format: "date" },
  dateTime: { type: "string", format: "date-time" },
  time: { type: "string", format: "time" },
  instant: { type: "string", format: "date-time" },
  uri: { type: "string", format: "uri" },
  url: { type: "string", format: "uri" },
  canonical: { type: "string", format: "uri" },
  oid: { type: "string" },
  id: { type: "string" },
  code: { type: "string" },
  uuid: { type: "string", format: "uuid" },
  base64Binary: { type: "string" },
  markdown: { type: "string" },
  unsignedInt: { type: "integer", minimum: 0 },
  positiveInt: { type: "integer", minimum: 1 },
  Coding: { type: "object" },
  CodeableConcept: { type: "object" },
  Identifier: { type: "object" },
  Quantity: { type: "object" },
  Range: { type: "object" },
  Period: { type: "object" },
  Attachment: { type: "object" },
  ContactPoint: { type: "object" },
  HumanName: { type: "object" },
  Address: { type: "object" },
};

/**
 * The schema of a type named by a StructureDefinition canonical. A logical
 * model of this IG's own is a sibling file, so a relative `$ref`. One from
 * another package (a dependency's model, say) is not in this IG's sidecars, so
 * a relative `$ref` would dangle: it is referenced by the absolute URL that
 * package's own run of this generator gives it as `$id`
 * (`<its canonical base>/StructureDefinition-<name>.schema.json`, see
 * {@link logicalModelSchema}), and the description names the canonical.
 */
function canonicalTypeSchema(type: string, local: TypeScope): Json {
  const [base, name] = [type.split("/StructureDefinition/")[0]!, type.split("/StructureDefinition/").slice(-1)[0]!];
  const isLocal = local.urls ? local.urls.has(type) : base === local.canonicalBase;
  if (isLocal) return { $ref: `StructureDefinition-${name}.schema.json` };
  return { $ref: `${base}/StructureDefinition-${name}.schema.json`, description: `${name}, defined in another package: ${type}` };
}

/**
 * What counts as this IG's own when a type names a StructureDefinition: the
 * canonical URLs of the logical models being generated, when the caller knows
 * them, else any canonical under the IG's canonical base.
 */
interface TypeScope {
  canonicalBase: string;
  urls?: ReadonlySet<string>;
}

function typeSchema(type: string, valueset: string, local: TypeScope): Json {
  if (type.startsWith("Reference(")) return { type: "object", description: `Reference to ${type}` };
  if (type.startsWith("http") && type.includes("/StructureDefinition/")) return canonicalTypeSchema(type, local);
  if (valueset && ["code", "Coding", "CodeableConcept"].includes(type)) return { $ref: `./ValueSet-${valueset}.schema.json`, description: `Coding-shaped {system, code} object from ValueSet ${valueset}` };
  if (TYPE_MAPPING[type]) return { ...TYPE_MAPPING[type] };
  return { type: "object", description: `FHIR ${type}` };
}

/** A logical model's JSON Schema: the shared base for `FHIRSchemaBase`, else one deriving from it. */
export function logicalModelSchema(m: Model, canonicalBase: string, localModelUrls?: ReadonlySet<string>): Json {
  const scope: TypeScope = localModelUrls ? { canonicalBase, urls: localModelUrls } : { canonicalBase };
  const schemaId = `${canonicalBase}/StructureDefinition-${m.name}.schema.json`;
  if (m.name === FHIR_SCHEMA_BASE_NAME) {
    return {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: schemaId,
      title: m.title,
      description: m.description,
      type: "object",
      properties: {
        resourceType: { type: "string", description: "Identifier for the logical model resource type" },
        resourceDefinition: { type: "string", format: "uri", description: "Canonical URI of the FHIR StructureDefinition that defines this logical model." },
        "fhir:parent": { type: "string", description: "Parent FHIR base type that this logical model is derived from." },
        "jsonld:valuesets": { type: "array", items: { type: "string" }, description: "ValueSet identifiers used in this logical model for JSON-LD context generation." },
        "jsonld:contextTemplate": { type: "object", description: "JSON-LD context template for this logical model." },
      },
      required: ["resourceType"],
    };
  }
  const used = [...new Set(m.elements.map((e) => e.valueset).filter(Boolean))].sort();
  const properties = new Ordered().set("resourceType", { type: "string", const: m.id, description: `Resource type identifier for ${m.name} logical model` });
  const required: string[] = ["resourceType"];
  const schema: Json = { $schema: "https://json-schema.org/draft/2020-12/schema", $id: schemaId, title: m.title, description: m.description, type: "object", properties, required };
  let context: Ordered | undefined;
  if (used.length) {
    context = new Ordered().set("@version", 1.1).set("fhir", "http://hl7.org/fhir/");
    for (const vs of used) context.set(vs, `${canonicalBase}/ValueSet-${vs}.jsonld`);
    properties.set("@context", {
      description: "JSON-LD context for this logical model with ValueSet vocabularies",
      anyOf: [
        { type: "string", format: "uri", description: "URI reference to external JSON-LD context" },
        {
          type: "object",
          description: "Inline JSON-LD context",
          properties: { "@version": { type: "number", const: 1.1 }, fhir: { type: "string", const: "http://hl7.org/fhir/" } },
          additionalProperties: { type: "string", format: "uri" },
        },
        { type: "array", description: "Array of JSON-LD context objects/URIs", items: { anyOf: [{ type: "string", format: "uri" }, { type: "object" }] } },
      ],
    });
    properties.set("@type", { type: "string", description: `JSON-LD type identifier for ${m.name} logical model`, examples: [`LogicalModel-${m.name}`] });
  }
  for (const e of m.elements) {
    if (e.cardinality && e.cardinality.startsWith("1")) required.push(e.name);
    let s: Json;
    if (e.choice) {
      if (e.type.includes(" or ")) {
        const options = e.type.split(" or ").map((t) => typeSchema(t.trim(), e.valueset, scope));
        s = options.length === 1 ? options[0]! : { oneOf: options };
      } else s = typeSchema(e.type, e.valueset, scope);
    } else s = typeSchema(e.type, e.valueset, scope);
    if (e.cardinality && (e.cardinality.includes("*") || e.cardinality.endsWith("..n"))) {
      s = { type: "array", items: s };
      if (e.cardinality.startsWith("1")) s["minItems"] = 1;
    }
    if (e.definition) s["description"] = e.definition;
    else if (e.short) s["description"] = e.short;
    properties.set(e.name, s);
  }
  const specific: Json = { resourceDefinition: { type: "string", format: "uri", const: m.url || `${canonicalBase}/StructureDefinition/${m.name}` } };
  if (m.parent) specific["fhir:parent"] = { type: "string", const: m.parent };
  if (context) {
    specific["jsonld:valuesets"] = { type: "array", items: { type: "string" }, const: used };
    specific["jsonld:contextTemplate"] = { type: "object", const: context };
  }
  schema["allOf"] = [{ $ref: `./StructureDefinition-${FHIR_SCHEMA_BASE_NAME}.schema.json` }, { type: "object", properties: specific }];
  return schema;
}

// ── The API over the schemas: OpenAPI wrappers, enumerations, Swagger UI ─

type SchemaKind = "valueset" | "logical_model";

/** Which enumeration a schema file belongs to, or none (a CodeSystem's, or an enumeration itself). */
export function schemaKind(file: string): SchemaKind | undefined {
  if (!file.endsWith(".schema.json")) return undefined;
  if (file.startsWith("ValueSet-")) return "valueset";
  if (file === "ValueSets.schema.json" || file === "LogicalModels.schema.json" || file.startsWith("CodeSystem-")) return undefined;
  return "logical_model";
}

/** A schema's OpenAPI 3.1 wrapper, serving it at `/<file>`. */
export function openapiFor(file: string, schema: Json, kind: SchemaKind): Json {
  const name = file.replace(".schema.json", "");
  const what = kind === "valueset" ? "the enumeration" : "the Logical Model";
  return {
    openapi: "3.1.0",
    info: { title: `${str(get(schema, "title", name))} API`, description: get(schema, "description", `API for ${name} schema`), version: "1.0.0" },
    paths: {
      [`/${file}`]: {
        get: {
          summary: `JSON Schema definition for ${what} ${name}`,
          description: `This endpoint serves the JSON Schema definition for ${what} ${name}.`,
          responses: { "200": { description: `The JSON Schema for ${name}`, content: { "application/schema+json": { schema: { $ref: `./${file}` } } } } },
        },
      },
    },
    components: { schemas: { [name]: schema } },
  };
}

/** The enumeration schema listing every schema of one kind, with the list as its example. */
export function enumerationSchema(kind: SchemaKind, schemas: ReadonlyArray<[string, Json]>): Json {
  const list = schemas.map(([file, s]) => {
    const e: Json = { filename: file, id: get(s, "$id", ""), title: get(s, "title", file), description: get(s, "description", ""), url: `./${file}` };
    if (kind === "valueset") {
      if (has(s, "fhir:valueSet")) e["valueSetUrl"] = s["fhir:valueSet"];
      if (has(s, "enum")) e["codeCount"] = (s["enum"] as unknown[]).length;
    } else {
      if (has(s, "fhir:logicalModel")) e["logicalModelUrl"] = s["fhir:logicalModel"];
      if (has(s, "properties")) e["propertyCount"] = (s["properties"] instanceof Ordered ? (s["properties"] as Ordered).size : Object.keys(s["properties"] as Json).length);
    }
    return e;
  });
  const file = kind === "valueset" ? "ValueSets.schema.json" : "LogicalModels.schema.json";
  const itemProps: Json = {
    filename: { type: "string", description: "Schema filename" },
    id: { type: "string", description: "Schema $id" },
    title: { type: "string", description: "Schema title" },
    description: { type: "string", description: "Schema description" },
    url: { type: "string", description: "Relative URL to the schema file" },
  };
  if (kind === "valueset") {
    itemProps["valueSetUrl"] = { type: "string", description: "FHIR canonical URL of the ValueSet" };
    itemProps["codeCount"] = { type: "integer", description: "Number of codes in the ValueSet" };
  } else {
    itemProps["logicalModelUrl"] = { type: "string", description: "FHIR canonical URL of the Logical Model" };
    itemProps["propertyCount"] = { type: "integer", description: "Number of properties in the Logical Model" };
  }
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `#/${file}`,
    title: kind === "valueset" ? "ValueSet Enumeration Schema" : "Logical Model Enumeration Schema",
    description: `JSON Schema defining the structure of the ${kind === "valueset" ? "ValueSet" : "Logical Model"} enumeration endpoint response`,
    type: "object",
    properties: {
      type: { type: "string", const: kind, description: `The type of schemas enumerated (${kind})` },
      count: { type: "integer", description: "Total number of schemas available" },
      schemas: { type: "array", description: "Array of available schemas", items: { type: "object", properties: itemProps, required: ["filename", "title", "url"] } },
    },
    required: ["type", "count", "schemas"],
    example: { type: kind, count: list.length, schemas: list },
  };
}

/** The enumeration schema's OpenAPI wrapper. */
export function enumerationOpenapi(kind: SchemaKind, enumSchema: Json): Json {
  const vs = kind === "valueset";
  const noun = vs ? "ValueSet" : "Logical Model";
  return {
    openapi: "3.1.0",
    info: { title: `${vs ? "ValueSets" : "LogicalModels"} Enumeration API`, description: `API endpoint providing an enumeration of all available ${noun} schemas`, version: "1.0.0" },
    paths: {
      [vs ? "/ValueSets.schema.json" : "/LogicalModels.schema.json"]: {
        get: {
          summary: `Get enumeration of all ${noun} schemas`,
          description: `Returns a list of all available ${noun} schemas with metadata`,
          responses: {
            "200": {
              description: `Successfully retrieved ${kind} enumeration`,
              content: { "application/json": { schema: { $ref: "#/components/schemas/EnumerationResponse" }, example: get(enumSchema, "example", {}) } },
            },
          },
        },
      },
    },
    components: { schemas: { EnumerationResponse: enumSchema } },
  };
}

/** The Swagger UI page over the wrappers, at `openapi/index.html`. */
export function swaggerPage(urls: ReadonlyArray<{ url: string; name: string }>, label: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const section = urls.length
    ? `
  <div id="definition-selector-bar">
    <label for="definition-select">Select a definition:</label>
    <select id="definition-select" onchange="switchDefinition(this.value)">
    </select>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
  <script>
  var swaggerUrls = ${JSON.stringify(urls, null, 2).replace(/</g, "\\u003c")};
  var ui;
  window.onload = function() {
    var select = document.getElementById('definition-select');
    swaggerUrls.forEach(function(item, idx) {
      var opt = document.createElement('option');
      opt.value = item.url;
      opt.textContent = item.name;
      select.appendChild(opt);
    });
    ui = SwaggerUIBundle({
      url: ${JSON.stringify(urls[0]!.url)},
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis],
      layout: "BaseLayout"
    });
  };
  function switchDefinition(url) {
    ui.specActions.updateUrl(url);
    ui.specActions.download(url);
  }
  </script>
`
    : `
  <p><em>No API specifications available.</em></p>
`;
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <title>OpenAPI Documentation - ${esc(label)}</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" type="text/css"
          href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css">
    <style>
      body { margin: 0; padding: 0; font-family: var(--fa-font-sans,system-ui,sans-serif); }
      /* Definition selector bar below the header */
      #definition-selector-bar {
        background-color: #0070a1;
        color: #ffffff;
        padding: 0.5rem 1.5rem;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        font-size: 0.9rem;
        flex-wrap: wrap;
      }
      #definition-selector-bar label {
        font-weight: 600;
        white-space: nowrap;
      }
      #definition-select {
        font-size: 0.9rem;
        padding: 0.25rem 0.5rem;
        border-radius: 3px;
        border: 1px solid rgba(255,255,255,0.6);
        background-color: #ffffff;
        color: #00477d;
        min-width: 200px;
        max-width: 100%;
        flex: 1;
      }
      /* Hide Swagger UI topbar entirely */
      .swagger-ui .topbar {
        display: none;
      }
    </style>
  </head>
  <body>
  <!-- No header of its own: the site gives every page the IG's one bar. -->
${section}
  </body>
</html>`;
}

// ── From the AST ────────────────────────────────────────────────────────

interface Manifest {
  resources?: { resourceType: string; id: string; file: string }[];
  /** When the AST was compiled. */
  generatedAt?: string;
}

/**
 * The time the ValueSet vocabularies carry as `generatedAt`: when the AST was
 * compiled, so the same AST gives the same bytes on every run. The wall clock
 * only for an AST whose manifest does not say. A wall-clock stamp rewrote every
 * sidecar on every page build and made every writer that reads them run again
 * (cat-harness-tools#1230).
 */
export function generatedAtOf(ast: string): string | undefined {
  try {
    const m = JSON.parse(readFileSync(join(ast, "manifest.json"), "utf-8")) as Manifest;
    return typeof m.generatedAt === "string" && m.generatedAt !== "" ? m.generatedAt : undefined;
  } catch {
    return undefined;
  }
}

/** The IG's canonical base: its ImplementationGuide's `url` up to `/ImplementationGuide/`. */
export function canonicalBaseOf(ast: string): string | undefined {
  const m = JSON.parse(readFileSync(join(ast, "manifest.json"), "utf-8")) as Manifest;
  const ig = (m.resources ?? []).find((r) => r.resourceType === "ImplementationGuide");
  if (!ig || !existsSync(join(ast, ig.file))) return undefined;
  const url = (JSON.parse(readFileSync(join(ast, ig.file), "utf-8")) as Json)["url"];
  return typeof url === "string" && url.includes("/ImplementationGuide/") ? url.split("/ImplementationGuide/")[0] : undefined;
}

export interface GenResult {
  /** Sidecar files, by name: the per-artefact schemas, displays, JSON-LD and OpenAPI wrappers. */
  sidecars: Map<string, string>;
  /** Files for the site root: the enumeration schemas, their wrappers and `openapi/index.html`. */
  site: Map<string, string>;
  expansions: boolean;
}

/** Generate every IG API file from an AST. Pure but for reading the AST. */
export function generateIgApi(ast: string, o: { label?: string; vocabBase?: string; canonicalBase?: string; now?: string } = {}): GenResult {
  const now = o.now ?? generatedAtOf(ast) ?? new Date().toISOString();
  const vocabBase = o.vocabBase ?? "http://hl7.org/fhir/";
  const canonicalBase = o.canonicalBase ?? canonicalBaseOf(ast) ?? "";
  const docs = new Map<string, Json>();
  const expPath = join(ast, "expansions.json");
  const expansions = existsSync(expPath);
  if (expansions) for (const [k, v] of valueSetFiles(JSON.parse(readFileSync(expPath, "utf-8")) as Json, { vocabBase, now })) docs.set(k, v);
  const m = JSON.parse(readFileSync(join(ast, "manifest.json"), "utf-8")) as Manifest;
  const models: Model[] = [];
  for (const r of m.resources ?? []) {
    if (r.resourceType !== "StructureDefinition" || !existsSync(join(ast, r.file))) continue;
    const model = logicalModel(JSON.parse(readFileSync(join(ast, r.file), "utf-8")) as Json);
    if (model) models.push(model);
  }
  const localModelUrls = new Set(models.map((x) => x.url).filter(Boolean));
  for (const model of models) docs.set(`StructureDefinition-${model.name}.schema.json`, logicalModelSchema(model, canonicalBase, localModelUrls));
  const sidecars = new Map<string, string>();
  const site = new Map<string, string>();
  const byKind: Record<SchemaKind, [string, Json][]> = { valueset: [], logical_model: [] };
  for (const [file, doc] of [...docs.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    sidecars.set(file, pyJson(doc));
    const kind = schemaKind(file);
    if (kind) byKind[kind].push([file, doc]);
  }
  const swagger: { url: string; name: string }[] = [];
  for (const kind of ["valueset", "logical_model"] as const) {
    for (const [file, doc] of byKind[kind]) {
      const wrapper = `${file.replace(".schema.json", "")}.openapi.json`;
      sidecars.set(wrapper, pyJson(openapiFor(file, doc, kind)));
      swagger.push({ url: `../${wrapper}`, name: str(get(doc, "title", `${file.replace(".schema.json", "")} Schema Documentation`)) });
    }
  }
  for (const kind of ["valueset", "logical_model"] as const) {
    if (!byKind[kind].length) continue;
    const e = enumerationSchema(kind, byKind[kind]);
    site.set(kind === "valueset" ? "ValueSets.schema.json" : "LogicalModels.schema.json", pyJson(e));
    site.set(kind === "valueset" ? "ValueSets-enumeration.openapi.json" : "LogicalModels-enumeration.openapi.json", pyJson(enumerationOpenapi(kind, e)));
  }
  site.set("openapi/index.html", swaggerPage(swagger, o.label ?? "IG API"));
  return { sidecars, site, expansions };
}

function writeAll(dir: string, files: Map<string, string>): void {
  for (const [f, text] of files) {
    mkdirSync(join(dir, f, ".."), { recursive: true });
    writeFileSync(join(dir, f), text);
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (k: string) => {
    const i = args.indexOf(k);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const ast = opt("--ast");
  const out = opt("--out");
  if (!ast || !out) {
    console.error("usage: ig-api-gen.ts --ast <output-ast> --out <sidecars dir> [--site <dir>] [--label <name>] [--vocab-base <iri>] [--canonical-base <url>]");
    process.exit(2);
  }
  const r = generateIgApi(resolve(ast), {
    ...(opt("--label") ? { label: opt("--label")! } : {}),
    ...(opt("--vocab-base") ? { vocabBase: opt("--vocab-base")! } : {}),
    ...(opt("--canonical-base") ? { canonicalBase: opt("--canonical-base")! } : {}),
  });
  writeAll(resolve(out), r.sidecars);
  const site = opt("--site");
  if (site) writeAll(resolve(site), r.site);
  const n = (s: string) => [...r.sidecars.keys()].filter((f) => f.endsWith(s)).length;
  console.error(
    `${resolve(out)}: ${n(".schema.json")} JSON Schema, ${n(".jsonld")} JSON-LD, ${n(".displays.json")} displays, ${n(".openapi.json")} OpenAPI` +
      `${r.expansions ? "" : " (no expansions.json beside the AST: no ValueSet files)"}${site ? `; ${r.site.size} file(s) for the site root in ${resolve(site)}` : ""}`,
  );
}
