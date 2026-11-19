/**
 * FHIR ConceptMap ⇄ vocabulary mapping tables: ι (represent) and π (produce).
 *
 * @module fhir-harness/schemas/vocab-mapping-fhir
 * @graphNode schema
 *
 * Owner, 2026-10-02 (bean `k74z`; all three statements verbatim in the
 * proposal's Decision section): *"we still want to able to produce FHIR
 * ConceptMaps, just we dont need to assume injective map onto FHIR
 * conceptmaps... may be lossy. but should be injective on the inverse image
 * of FHIR ConceptMaps into mapping stadard."*
 *
 * With C = FHIR ConceptMaps (R5 and R4) and M = `folio-vocab-mapping/v1`
 * tables:
 *
 * - **ι = {@link fromConceptMap} : C → M** represents any ConceptMap. Nothing
 *   is dropped: a key the table does not interpret goes to an `extra` bag at
 *   its level, or to `metadata` at the map level.
 * - **π = {@link toConceptMap} : M → C** produces a ConceptMap. It MAY lose
 *   what a ConceptMap cannot say (a derived target, a transform, a JSON key),
 *   and it RETURNS every loss as a {@link Loss}. It never drops anything
 *   silently.
 * - **π ∘ ι = id_C**, release for release. A map read and then produced comes
 *   back field for field. That is what `vocab-mapping-fhir.test.ts` asserts on
 *   published HL7 examples.
 *
 * Producing in the OTHER release (an R4 map as R5, or the reverse) is a
 * conversion. Where it is not exact, that is reported as a loss of kind
 * `converted`.
 *
 * Structure read from `hl7.fhir.r5.core@5.0.0`'s `StructureDefinition-ConceptMap`
 * and from R4 4.0.1 examples, not recalled.
 *
 * @conformsTo hl7-fhir
 */
import {
  R4_TO_R5_RELATIONSHIP,
  R5_TO_R4_EQUIVALENCE,
  VOCAB_MAPPING_SCHEMA,
  VocabMappingSchema,
  type Dependency,
  type Element,
  type Group,
  type R4Equivalence,
  type Target,
  type TypedValue,
  type VocabMapping,
} from "@litlfred/cat-harness-tools/schemas/content/vocab-mapping.js";

export type FhirRelease = "R4" | "R5";
type Json = Record<string, unknown>;

/** Something π could not carry into the ConceptMap, or carried only approximately. */
export interface Loss {
  /** Where in the table, e.g. `group[0].element[2].target[1]`. */
  readonly path: string;
  readonly field: string;
  readonly kind: "dropped" | "converted";
  readonly detail: string;
}

/**
 * Which release a ConceptMap is written in, from the fields only one release
 * has. `undefined` when it uses none of them. Such a map reads the same in
 * either release, so the caller's choice is not a guess.
 */
export function detectRelease(cm: Json): FhirRelease | undefined {
  const s = JSON.stringify(cm);
  if (/"(relationship|noMap|sourceScope(Uri|Canonical)|targetScope(Uri|Canonical)|additionalAttribute|otherMap|attribute)"\s*:/.test(s)) return "R5";
  if (/"(equivalence|sourceVersion|targetVersion|sourceUri|sourceCanonical|targetUri|targetCanonical)"\s*:/.test(s)) return "R4";
  return undefined;
}

// ── helpers ────────────────────────────────────────────────────────────

/**
 * Split an object into the keys this level interprets and the rest.
 * `valueX`: this level reads a FHIR `value[x]` (dependsOn, product, property),
 * so a `value<Type>` key is interpreted rather than extra.
 */
function split(o: Json, interpreted: readonly string[], valueX = false): { rest?: Json } {
  const rest: Json = {};
  for (const [k, v] of Object.entries(o)) {
    if (interpreted.includes(k)) continue;
    if (valueX && /^value[A-Z]/.test(k) && k !== "valueSet") continue;
    rest[k] = v;
  }
  return Object.keys(rest).length > 0 ? { rest } : {};
}

/** A FHIR `value[x]` on an object, as `{type, value}`; at most one may be present. */
function readValueX(o: Json, where: string): TypedValue | undefined {
  const keys = Object.keys(o).filter((k) => /^value[A-Z]/.test(k) && k !== "valueSet");
  if (keys.length > 1) throw new Error(`${where}: more than one value[x] (${keys.join(", ")})`);
  const k = keys[0];
  return k === undefined ? undefined : { type: k.slice("value".length), value: o[k] };
}

const opt = <T>(k: string, v: T | undefined): Json => (v === undefined ? {} : { [k]: v });
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const arr = (v: unknown): Json[] => (Array.isArray(v) ? (v as Json[]) : []);

/** R5 `canonical|version` → the two parts. Only the LAST `|` separates a version. */
function splitCanonical(c: string | undefined): { system?: string; version?: string } {
  if (c === undefined) return {};
  const i = c.lastIndexOf("|");
  return i === -1 ? { system: c } : { system: c.slice(0, i), version: c.slice(i + 1) };
}

// ── ι : C → M ──────────────────────────────────────────────────────────

function dependencyFrom(d: Json, release: FhirRelease, where: string): Dependency {
  if (release === "R5") {
    const attribute = str(d["attribute"]);
    if (attribute === undefined) throw new Error(`${where}: dependsOn/product.attribute is 1..1`);
    const { rest } = split(d, ["attribute", "valueSet"], true);
    return {
      attribute,
      ...opt("value", readValueX(d, where)),
      ...opt("valueSet", str(d["valueSet"])),
      ...opt("extra", rest),
    };
  }
  const attribute = str(d["property"]);
  if (attribute === undefined) throw new Error(`${where}: dependsOn/product.property is 1..1`);
  const { rest } = split(d, ["property", "system", "value", "display"]);
  return {
    attribute,
    ...(d["value"] === undefined ? {} : { value: { type: "String", value: d["value"] } }),
    ...opt("system", str(d["system"])),
    ...opt("display", str(d["display"])),
    ...opt("extra", rest),
  };
}

function targetFrom(t: Json, release: FhirRelease, where: string): Target {
  let relationship: Target["relationship"];
  let equivalence: R4Equivalence | undefined;
  if (release === "R5") {
    relationship = t["relationship"] as Target["relationship"];
    if (relationship === undefined) throw new Error(`${where}: target.relationship is 1..1 in R5`);
  } else {
    equivalence = t["equivalence"] as R4Equivalence | undefined;
    if (equivalence === undefined) throw new Error(`${where}: target.equivalence is 1..1 in R4`);
    relationship = R4_TO_R5_RELATIONSHIP[equivalence];
    if (relationship === undefined) throw new Error(`${where}: unknown R4 equivalence "${String(equivalence)}"`);
  }
  const interpreted =
    release === "R5"
      ? ["code", "display", "valueSet", "relationship", "comment", "property", "dependsOn", "product"]
      : ["code", "display", "equivalence", "comment", "dependsOn", "product"];
  const { rest } = split(t, interpreted);
  const props = arr(t["property"]).map((p, i) => {
    const v = readValueX(p, `${where}.property[${i}]`);
    if (v === undefined) throw new Error(`${where}.property[${i}]: value[x] is 1..1`);
    const { rest: pr } = split(p, ["code"], true);
    return { code: String(p["code"]), value: v, ...opt("extra", pr) };
  });
  const deps = (k: "dependsOn" | "product") => arr(t[k]).map((d, i) => dependencyFrom(d, release, `${where}.${k}[${i}]`));
  return {
    ...opt("code", str(t["code"])),
    ...opt("display", str(t["display"])),
    ...opt("valueSet", str(t["valueSet"])),
    relationship,
    ...opt("equivalence", equivalence),
    ...opt("comment", str(t["comment"])),
    ...(t["property"] !== undefined ? { property: props } : {}),
    ...(t["dependsOn"] !== undefined ? { dependsOn: deps("dependsOn") } : {}),
    ...(t["product"] !== undefined ? { product: deps("product") } : {}),
    ...opt("extra", rest),
  } as Target;
}

function elementFrom(e: Json, release: FhirRelease, where: string): Element {
  const { rest } = split(e, ["code", "display", "valueSet", "noMap", "target"]);
  return {
    ...opt("code", str(e["code"])),
    ...opt("display", str(e["display"])),
    ...opt("valueSet", str(e["valueSet"])),
    ...(typeof e["noMap"] === "boolean" ? { noMap: e["noMap"] } : {}),
    ...(e["target"] !== undefined
      ? { target: arr(e["target"]).map((t, i) => targetFrom(t, release, `${where}.target[${i}]`)) }
      : {}),
    ...opt("extra", rest),
  };
}

function groupFrom(g: Json, release: FhirRelease, where: string): Group {
  const interpreted =
    release === "R5"
      ? ["source", "target", "element", "unmapped"]
      : ["source", "sourceVersion", "target", "targetVersion", "element", "unmapped"];
  const { rest } = split(g, interpreted);
  const src = release === "R5" ? splitCanonical(str(g["source"])) : { system: str(g["source"]), version: str(g["sourceVersion"]) };
  const tgt = release === "R5" ? splitCanonical(str(g["target"])) : { system: str(g["target"]), version: str(g["targetVersion"]) };
  const u = g["unmapped"] as Json | undefined;
  let unmapped: Group["unmapped"];
  if (u !== undefined) {
    const { rest: ur } = split(u, release === "R5" ? ["mode", "code", "display", "valueSet", "relationship", "otherMap"] : ["mode", "code", "display", "url"]);
    const mode = release === "R4" && u["mode"] === "provided" ? "use-source-code" : (u["mode"] as "use-source-code" | "fixed" | "other-map");
    unmapped = {
      mode,
      ...opt("code", str(u["code"])),
      ...opt("display", str(u["display"])),
      ...opt("valueSet", str(u["valueSet"])),
      ...opt("relationship", u["relationship"] as Target["relationship"] | undefined),
      ...opt("otherMap", str(release === "R5" ? u["otherMap"] : u["url"])),
      ...opt("extra", ur),
    };
  }
  return {
    ...opt("source", src.system),
    ...opt("sourceVersion", src.version),
    ...opt("target", tgt.system),
    ...opt("targetVersion", tgt.version),
    element: arr(g["element"]).map((e, i) => elementFrom(e, release, `${where}.element[${i}]`)),
    ...opt("unmapped", unmapped),
    ...opt("extra", rest),
  };
}

/** Map-level fields ι interprets, per release. Everything else is `metadata`. */
const MAP_FIELDS: Record<FhirRelease, readonly string[]> = {
  R5: ["resourceType", "url", "version", "name", "title", "status", "experimental", "date", "publisher", "description", "purpose", "copyright",
    "sourceScopeUri", "sourceScopeCanonical", "targetScopeUri", "targetScopeCanonical", "property", "additionalAttribute", "group"],
  R4: ["resourceType", "url", "version", "name", "title", "status", "experimental", "date", "publisher", "description", "purpose", "copyright",
    "sourceUri", "sourceCanonical", "targetUri", "targetCanonical", "group"],
};

function scopeFrom(cm: Json, release: FhirRelease, side: "source" | "target") {
  const stem = release === "R5" ? `${side}Scope` : side;
  for (const type of ["Uri", "Canonical"] as const) {
    const v = str(cm[`${stem}${type}`]);
    if (v !== undefined) return { type, value: v };
  }
  return undefined;
}

/**
 * ι: represent a FHIR ConceptMap as a table. `release` is the one it is
 * written in, defaulting to {@link detectRelease}, and then R5.
 */
export function fromConceptMap(cm: Json, release: FhirRelease = detectRelease(cm) ?? "R5"): VocabMapping {
  if (cm["resourceType"] !== "ConceptMap") throw new Error(`not a ConceptMap: resourceType ${JSON.stringify(cm["resourceType"])}`);
  const status = cm["status"];
  if (typeof status !== "string") throw new Error("ConceptMap.status is 1..1");
  const metadata: Json = {};
  for (const [k, v] of Object.entries(cm)) if (!MAP_FIELDS[release].includes(k)) metadata[k] = v;
  const id = str(cm["id"]) ?? str(cm["name"]) ?? "conceptmap";
  return VocabMappingSchema.parse({
    $schema: VOCAB_MAPPING_SCHEMA,
    id,
    ...opt("url", str(cm["url"])),
    ...opt("version", str(cm["version"])),
    ...opt("name", str(cm["name"])),
    ...opt("title", str(cm["title"])),
    status,
    ...(typeof cm["experimental"] === "boolean" ? { experimental: cm["experimental"] } : {}),
    ...opt("date", str(cm["date"])),
    ...opt("publisher", str(cm["publisher"])),
    ...opt("description", str(cm["description"])),
    ...opt("purpose", str(cm["purpose"])),
    ...opt("copyright", str(cm["copyright"])),
    ...opt("sourceScope", scopeFrom(cm, release, "source")),
    ...opt("targetScope", scopeFrom(cm, release, "target")),
    ...(cm["property"] !== undefined ? { property: arr(cm["property"]) } : {}),
    ...(cm["additionalAttribute"] !== undefined ? { additionalAttribute: arr(cm["additionalAttribute"]) } : {}),
    group: arr(cm["group"]).map((g, i) => groupFrom(g, release, `group[${i}]`)),
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
  });
}

// ── π : M → C ──────────────────────────────────────────────────────────

/** Prefixes a table may write a system with. Callers add a layer's own (`NS_PREFIXES`). */
export const STANDARD_PREFIXES: Readonly<Record<string, string>> = {
  skos: "http://www.w3.org/2004/02/skos/core#",
  dcterms: "http://purl.org/dc/terms/",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  owl: "http://www.w3.org/2002/07/owl#",
  prov: "http://www.w3.org/ns/prov#",
  schema: "https://schema.org/",
};

/** Expand a CURIE whose prefix is known; anything else (an IRI, a URN) is returned as written. */
export function expandCurie(v: string, prefixes: Readonly<Record<string, string>>): string {
  const m = /^([A-Za-z][\w.-]*):(.*)$/.exec(v);
  if (m === null || m[2]!.startsWith("//")) return v;
  const ns = prefixes[m[1]!];
  return ns === undefined ? v : `${ns}${m[2]}`;
}

/**
 * π: produce a FHIR ConceptMap from a table, in `release`, with every loss.
 *
 * `prefixes` expands a CURIE-written group `source`/`target` into the
 * canonical URI a ConceptMap needs. An imported map wrote full URIs, which
 * expansion leaves alone, so this does not disturb π ∘ ι = id.
 */
export function toConceptMap(
  m: VocabMapping,
  opts: { release: FhirRelease; prefixes?: Readonly<Record<string, string>> },
): { conceptMap: Json; losses: Loss[] } {
  const { release } = opts;
  const prefixes = { ...STANDARD_PREFIXES, ...(opts.prefixes ?? {}) };
  const losses: Loss[] = [];
  const lose = (path: string, field: string, kind: Loss["kind"], detail: string) => losses.push({ path, field, kind, detail });
  const r5 = release === "R5";
  const meta = m.metadata ?? {};

  const dependencyTo = (d: Dependency, path: string): Json => {
    if (r5) {
      if (d.system !== undefined) lose(path, "system", "dropped", "R5 dependsOn/product has no system");
      if (d.display !== undefined) lose(path, "display", "dropped", "R5 dependsOn/product has no display");
      return {
        attribute: d.attribute,
        ...(d.value === undefined ? {} : { [`value${d.value.type}`]: d.value.value }),
        ...opt("valueSet", d.valueSet),
        ...(d.extra ?? {}),
      };
    }
    if (d.valueSet !== undefined) lose(path, "valueSet", "dropped", "R4 dependsOn/product has no valueSet");
    let value: unknown;
    if (d.value !== undefined) {
      if (d.value.type === "String" || d.value.type === "Code") value = d.value.value;
      else lose(path, `value${d.value.type}`, "dropped", "R4 dependsOn/product.value is a string");
    }
    return { property: d.attribute, ...opt("system", d.system), ...opt("value", value), ...opt("display", d.display), ...(d.extra ?? {}) };
  };

  const targetTo = (t: Target, path: string): Json => {
    // What a ConceptMap cannot say about applying the row. Reported, never silent.
    if (t.key !== undefined && t.key !== t.code) lose(path, "key", "dropped", `the JSON term "${t.key}" written for ${t.code ?? "(no code)"}`);
    if (t.authority === "derived") lose(path, "authority", "dropped", `a derived copy of "${t.derivedFrom}" — a ConceptMap cannot say one target renders another`);
    if (t.transform !== undefined && t.transform !== "copy") lose(path, "transform", "dropped", `transform "${t.transform}"`);
    let relation: Json;
    if (r5) {
      if (t.equivalence !== undefined && R5_TO_R4_EQUIVALENCE[t.relationship] !== t.equivalence) {
        lose(path, "equivalence", "converted", `R4 "${t.equivalence}" is only "${t.relationship}" in R5`);
      }
      relation = { relationship: t.relationship };
    } else {
      relation = { equivalence: t.equivalence ?? R5_TO_R4_EQUIVALENCE[t.relationship] };
    }
    if (!r5 && t.valueSet !== undefined) lose(path, "valueSet", "dropped", "R4 target has no valueSet");
    if (!r5 && t.property !== undefined) lose(path, "property", "dropped", "R4 target has no property");
    return {
      ...opt("code", t.code),
      ...opt("display", t.display),
      ...(r5 ? opt("valueSet", t.valueSet) : {}),
      ...relation,
      ...opt("comment", t.comment),
      ...(r5 && t.property !== undefined
        ? { property: t.property.map((p) => ({ code: p.code, [`value${p.value.type}`]: p.value.value, ...(p.extra ?? {}) })) }
        : {}),
      ...(t.dependsOn !== undefined ? { dependsOn: t.dependsOn.map((d, i) => dependencyTo(d, `${path}.dependsOn[${i}]`)) } : {}),
      ...(t.product !== undefined ? { product: t.product.map((d, i) => dependencyTo(d, `${path}.product[${i}]`)) } : {}),
      ...(t.extra ?? {}),
    };
  };

  const elementTo = (e: Element, path: string): Json => {
    let target = e.target?.map((t, i) => targetTo(t, `${path}.target[${i}]`));
    let noMap = e.noMap;
    if (!r5 && e.valueSet !== undefined) lose(path, "valueSet", "dropped", "R4 element has no valueSet");
    if (!r5 && noMap === true) {
      // R4 says "no map" as a target with equivalence `unmatched` and no code.
      lose(path, "noMap", "converted", 'R4 has no noMap; written as a target with equivalence "unmatched"');
      target = [...(target ?? []), { equivalence: "unmatched" }];
      noMap = undefined;
    }
    return {
      ...opt("code", e.code),
      ...opt("display", e.display),
      ...(r5 ? opt("valueSet", e.valueSet) : {}),
      ...(r5 && noMap !== undefined ? { noMap } : {}),
      ...opt("target", target),
      ...(e.extra ?? {}),
    };
  };

  const groupTo = (g: Group, path: string): Json => {
    const sys = (s: string | undefined) => (s === undefined ? undefined : expandCurie(s, prefixes));
    const joined = (s: string | undefined, v: string | undefined) => (s === undefined ? undefined : v === undefined ? s : `${s}|${v}`);
    const u = g.unmapped;
    let unmapped: Json | undefined;
    if (u !== undefined) {
      if (r5) {
        unmapped = { mode: u.mode, ...opt("code", u.code), ...opt("display", u.display), ...opt("valueSet", u.valueSet), ...opt("relationship", u.relationship), ...opt("otherMap", u.otherMap), ...(u.extra ?? {}) };
      } else {
        if (u.valueSet !== undefined) lose(`${path}.unmapped`, "valueSet", "dropped", "R4 unmapped has no valueSet");
        if (u.relationship !== undefined) lose(`${path}.unmapped`, "relationship", "dropped", "R4 unmapped has no relationship");
        unmapped = { mode: u.mode === "use-source-code" ? "provided" : u.mode, ...opt("code", u.code), ...opt("display", u.display), ...opt("url", u.otherMap), ...(u.extra ?? {}) };
      }
    }
    return {
      ...(r5
        ? { ...opt("source", joined(sys(g.source), g.sourceVersion)), ...opt("target", joined(sys(g.target), g.targetVersion)) }
        : { ...opt("source", sys(g.source)), ...opt("sourceVersion", g.sourceVersion), ...opt("target", sys(g.target)), ...opt("targetVersion", g.targetVersion) }),
      element: g.element.map((e, i) => elementTo(e, `${path}.element[${i}]`)),
      ...opt("unmapped", unmapped),
      ...(g.extra ?? {}),
    };
  };

  const scope = (side: "source" | "target", s: VocabMapping["sourceScope"]): Json =>
    s === undefined ? {} : { [`${r5 ? `${side}Scope` : side}${s.type}`]: s.value };
  if (!r5 && m.property !== undefined) lose("", "property", "dropped", "R4 ConceptMap has no map-level property");
  if (!r5 && m.additionalAttribute !== undefined) lose("", "additionalAttribute", "dropped", "R4 ConceptMap has no additionalAttribute");

  const conceptMap: Json = {
    resourceType: "ConceptMap",
    ...meta,
    ...opt("url", m.url),
    ...opt("version", m.version),
    ...opt("name", m.name),
    ...opt("title", m.title),
    status: m.status,
    ...opt("experimental", m.experimental),
    ...opt("date", m.date),
    ...opt("publisher", m.publisher),
    ...opt("description", m.description),
    ...opt("purpose", m.purpose),
    ...opt("copyright", m.copyright),
    ...scope("source", m.sourceScope),
    ...scope("target", m.targetScope),
    ...(r5 ? { ...opt("property", m.property), ...opt("additionalAttribute", m.additionalAttribute) } : {}),
    ...(m.group.length > 0 ? { group: m.group.map((g, i) => groupTo(g, `group[${i}]`)) } : {}),
  };
  return { conceptMap, losses };
}
