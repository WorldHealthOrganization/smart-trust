/**
 * Read a FHIR logical model — a `StructureDefinition` with `kind: "logical"` —
 * into the schema graph's class model, so the schemas viewer draws it with the
 * same boxes, fields, cardinalities and edges as a Zod module or a JSON Schema.
 *
 * @module scripts/fhir-logical-model
 * @graphNode none — a reader over FHIR StructureDefinitions, not a schema itself
 *
 * ## Why it lives here, beside `schema-graph.ts`
 *
 * A StructureDefinition is a published standard's document, like a JSON
 * Schema; nothing here names an IG, a folio or a canonical base other than
 * FHIR core's own. Different CODE from the JSON Schema reader, the same RULES
 * for what a class is — so a reader, not a profile (`platform-boundary-guard`).
 * Which files are read is decided by the caller from declared directories.
 *
 * ## What becomes what
 *
 * | StructureDefinition | class model |
 * |---|---|
 * | the root element | one class, named `name` (else `id`), `canonical` = `url` |
 * | an element with children (`BackboneElement` / `Element`) | a nested class named by its path, `Model.part`, joined by a composition edge |
 * | a child element | a field: name, type, `min..max` |
 * | a type whose code is a canonical URL | a `field` edge to that model |
 * | `Reference(…)` / `canonical(…)` with `targetProfile` | an `id-ref` edge per target: an association by id, not containment |
 * | `contentReference: #Path` | a field typed by the class at that path |
 * | `baseDefinition` | generalisation (FHIR core bases are recorded, not drawn) |
 *
 * Elements come from the `differential` when there is one — a logical model's
 * own fields — and a value the differential leaves out (type, cardinality) is
 * read from the `snapshot` element with the same id.
 *
 * ## Could not determine
 *
 * A StructureDefinition with neither a differential nor a snapshot is one
 * `undetermined` declaration with the reason in `note` — never an empty class.
 * An element whose cardinality neither list states keeps `min`/`max` unset,
 * and the field reads `?..?` rather than a guessed `0..*`.
 */
import type { ClassModelRead, ClassModelRef, SchemaDecl, SchemaEdge, SchemaField } from "./schema-graph.ts";

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

/** FHIR core's StructureDefinition base: a type there is a FHIR datatype, outside the graph. */
export const FHIR_CORE_SD = "http://hl7.org/fhir/StructureDefinition/";

/** Element types that hold children rather than a value. */
const CONTAINER_TYPES = new Set(["BackboneElement", "Element"]);

/** The StructureDefinition kinds that define a class (a profile constrains one; it is not one). */
const CLASS_KINDS = new Set(["logical", "resource", "complex-type"]);

/**
 * True when `doc` is a StructureDefinition this reader models: a logical
 * model, or a resource or complex datatype that SPECIALISES its base — FHIR
 * core's own definitions, once a layer holds them. A `constraint` (a profile)
 * narrows an existing class rather than defining one, and is not read here.
 */
export function isFhirLogicalModel(doc: unknown): doc is Json {
  return (
    isObj(doc) &&
    doc.resourceType === "StructureDefinition" &&
    typeof doc.kind === "string" &&
    CLASS_KINDS.has(doc.kind) &&
    (doc.kind === "logical" || doc.derivation !== "constraint")
  );
}

/**
 * True when `doc` is a FHIR profile: a `constraint` StructureDefinition, which
 * narrows a base class rather than defining one (bean `cat-tools-t6fz`).
 */
export function isFhirProfile(doc: unknown): doc is Json {
  return isObj(doc) && doc.resourceType === "StructureDefinition" && doc.derivation === "constraint" && typeof doc.baseDefinition === "string";
}

/** True for any StructureDefinition this module reads: a class, or a profile over one. */
export function isFhirStructureDefinition(doc: unknown): doc is Json {
  return isFhirLogicalModel(doc) || isFhirProfile(doc);
}

/** Where a type's definition is read, for a link: its canonical URL, which resolves on the web. */
export function fhirTypeCanonical(code: string): string {
  return /^https?:\/\//.test(code) ? code : `${FHIR_CORE_SD}${code}`;
}

const lastSegment = (url: string): string => url.split(/[/#]/).filter(Boolean).pop() ?? url;
const firstLine = (v: unknown): string | undefined =>
  typeof v === "string" ? v.split("\n").map((l) => l.trim()).find(Boolean) : undefined;

interface Element {
  id?: string;
  path: string;
  min?: number;
  max?: string;
  type?: { code?: string; targetProfile?: string[]; profile?: string[] }[];
  contentReference?: string;
  short?: string;
  definition?: string;
}

function asElements(v: unknown): Element[] | undefined {
  if (!isObj(v) || !Array.isArray(v.element)) return undefined;
  return (v.element as unknown[]).filter((e): e is Element => isObj(e) && typeof e.path === "string") as Element[];
}

/** Read one logical model. `moduleRel` is the file's repo-relative path. */
export function readFhirLogicalModel(text: string, moduleRel: string): ClassModelRead {
  let sd: unknown;
  try {
    sd = JSON.parse(text);
  } catch (e) {
    return { decls: [undetermined(moduleRel, lastSegment(moduleRel).replace(/\.json$/, ""), `not valid JSON: ${(e as Error).message}`.slice(0, 120))], refs: [], edges: [] };
  }
  if (isFhirProfile(sd)) return withRelease(readFhirProfile(sd, moduleRel), sd);
  if (!isFhirLogicalModel(sd)) return { decls: [], refs: [], edges: [] };
  const name = typeof sd.name === "string" && sd.name ? sd.name : typeof sd.id === "string" ? sd.id : lastSegment(moduleRel);
  const canonical = typeof sd.url === "string" ? sd.url : undefined;
  const summary = firstLine(sd.title) ?? firstLine(sd.description);

  const diff = asElements(sd.differential);
  const snap = asElements(sd.snapshot);
  const own = diff && diff.length > 0 ? diff : snap;
  if (!own || own.length === 0) {
    const d = undetermined(moduleRel, name, "could not determine: no differential or snapshot elements");
    if (canonical) d.canonical = canonical;
    return { decls: [d], refs: [], edges: [], ...(summary ? { summary } : {}) };
  }
  const snapById = new Map<string, Element>();
  for (const e of snap ?? []) snapById.set(e.id ?? e.path, e);
  const filled = (e: Element): Element => {
    const s = snapById.get(e.id ?? e.path);
    if (!s) return e;
    return {
      ...e,
      ...(e.min === undefined && s.min !== undefined ? { min: s.min } : {}),
      ...(e.max === undefined && s.max !== undefined ? { max: s.max } : {}),
      ...(e.type === undefined && s.type !== undefined ? { type: s.type } : {}),
      ...(e.contentReference === undefined && s.contentReference !== undefined ? { contentReference: s.contentReference } : {}),
      ...(e.short === undefined && s.short !== undefined ? { short: s.short } : {}),
    };
  };
  const elements = own.map(filled);
  const rootPath = elements[0]!.path.split(".")[0]!;
  const paths = new Set(elements.map((e) => e.path));
  // A path with children is a class, whether or not the differential lists
  // the element itself (a differential may list only the leaves).
  const classPaths = new Set<string>([rootPath]);
  for (const p of paths) {
    const parts = p.split(".");
    for (let i = 1; i < parts.length; i++) classPaths.add(parts.slice(0, i).join("."));
  }
  const classNameOf = (path: string): string => name + path.slice(rootPath.length);
  const idOf = (path: string): string => `${moduleRel}#${classNameOf(path)}`;

  const decls = new Map<string, SchemaDecl>();
  const refs: ClassModelRef[] = [];
  const edges: SchemaEdge[] = [];
  const declFor = (path: string): SchemaDecl => {
    let d = decls.get(path);
    if (!d) {
      const el = elements.find((e) => e.path === path);
      d = {
        id: idOf(path),
        name: classNameOf(path),
        module: moduleRel,
        kind: "fhir-logical",
        ...(path === rootPath && canonical ? { canonical } : {}),
        ...(path === rootPath ? (summary ? { doc: summary } : {}) : el && (el.short || el.definition) ? { doc: el.short ?? firstLine(el.definition)! } : {}),
        fields: [],
        extendsNames: [],
        values: [],
        refs: [],
        unresolved: [],
        external: [],
        line: 1,
        exported: true,
      };
      decls.set(path, d);
    }
    return d;
  };
  declFor(rootPath);

  // Generalisation. FHIR core's abstract bases (Base, Element, …) say only
  // "this is a FHIR structure": recorded as an external name, not drawn.
  if (typeof sd.baseDefinition === "string") {
    const root = declFor(rootPath);
    root.extendsNames.push(lastSegment(sd.baseDefinition));
    if (sd.baseDefinition.startsWith(FHIR_CORE_SD)) root.external.push(lastSegment(sd.baseDefinition));
    else refs.push({ from: root.id, ref: sd.baseDefinition, module: moduleRel, via: "", kind: "extends", optional: false, array: false, by: "canonical" });
  }

  const externals = new Map<string, Set<string>>();
  const addExternal = (d: SchemaDecl, n: string): void => {
    const s = externals.get(d.id) ?? new Set<string>();
    s.add(n);
    externals.set(d.id, s);
  };

  for (const path of [...paths, ...[...classPaths].filter((p) => !paths.has(p))]) {
    if (path === rootPath) continue;
    const parentPath = path.slice(0, path.lastIndexOf("."));
    const parent = declFor(parentPath);
    const el: Element = elements.find((e) => e.path === path) ?? { path };
    const fname = path.slice(parentPath.length + 1);
    const known = el.min !== undefined || el.max !== undefined;
    const min = el.min;
    const max = el.max === undefined ? undefined : el.max === "*" ? ("*" as const) : Number(el.max);
    const array = max === "*" || (typeof max === "number" && max > 1);
    const optional = min === undefined ? true : min === 0;
    const types = el.type ?? [];
    const shown: string[] = [];
    const names: string[] = [];
    /** Each shown type's definition, by canonical: the link a type name carries. */
    const typeCanonicals: Record<string, string> = {};
    const isContainer = classPaths.has(path) || types.some((t) => t.code !== undefined && CONTAINER_TYPES.has(t.code));

    if (isContainer) {
      const child = declFor(path);
      shown.push(child.name);
      edges.push({ from: parent.id, to: child.id, via: fname, kind: "field", optional, array });
    } else if (el.contentReference) {
      const target = el.contentReference.slice(el.contentReference.indexOf("#") + 1);
      shown.push(classNameOf(target));
      if (classPaths.has(target)) edges.push({ from: parent.id, to: idOf(target), via: fname, kind: "field", optional, array });
      else parent.unresolved.push(el.contentReference);
    }
    for (const t of isContainer || el.contentReference ? [] : types) {
      const code = t.code ?? "";
      const targets = [...(t.targetProfile ?? [])];
      if ((code === "Reference" || code === "canonical" || lastSegment(code) === "Reference") && targets.length > 0) {
        shown.push(`${lastSegment(code)}(${targets.map(lastSegment).join(" | ")})`);
        typeCanonicals[lastSegment(code)] = fhirTypeCanonical(code);
        for (const tp of targets) {
          typeCanonicals[lastSegment(tp)] = tp;
          // FHIR core is resolved when a layer holds it; until then it is external, not a miss.
          if (tp.startsWith(FHIR_CORE_SD)) addExternal(parent, lastSegment(tp));
          refs.push({ from: parent.id, ref: tp, module: moduleRel, via: fname, kind: "id-ref", optional, array, by: "canonical", ...(tp.startsWith(FHIR_CORE_SD) ? { quietMiss: true as const } : {}) });
        }
        continue;
      }
      const n = lastSegment(code);
      if (!n) continue;
      const canon = fhirTypeCanonical(code);
      const core = canon.startsWith(FHIR_CORE_SD);
      shown.push(n);
      typeCanonicals[n] = canon;
      if (core) addExternal(parent, n);
      else names.push(n);
      // A core datatype becomes an edge only once a layer holds FHIR core (the
      // resolver finds its canonical); until then it is a linked type name.
      // Primitives (lower-case codes) are values, never boxes.
      if (!core || /^[A-Z]/.test(n)) {
        refs.push({ from: parent.id, ref: canon, module: moduleRel, via: fname, kind: "field", optional, array, by: "canonical", ...(core ? { quietMiss: true as const } : {}) });
      }
    }
    const field: SchemaField = {
      name: fname,
      type: shown.length ? shown.join(" | ") : "?",
      optional,
      array,
      names,
      ...(min !== undefined ? { min } : {}),
      ...(max !== undefined ? { max } : {}),
      ...(known ? {} : { cardinalityUnknown: true as const }),
      ...(Object.keys(typeCanonicals).length ? { typeLinks: typeCanonicals } : {}),
      ...(el.short || el.definition ? { doc: el.short ?? firstLine(el.definition)! } : {}),
    };
    parent.fields.push(field);
  }
  for (const d of decls.values()) d.external = [...new Set([...d.external, ...(externals.get(d.id) ?? [])])].sort();
  return withRelease({ decls: [...decls.values()], refs, edges, ...(summary ? { summary } : {}) }, sd);
}

/**
 * Stamp each reference with the FHIR version its model is written against
 * (`fhirVersion`), so a core type resolves against THAT release's definition
 * (bean `cat-tools-t6fz`): `Patient` in R4 and in R5 are different classes.
 */
function withRelease(read: ClassModelRead, sd: Json): ClassModelRead {
  if (typeof sd.fhirVersion === "string") for (const r of read.refs) r.fhirVersion = sd.fhirVersion;
  return read;
}

/** The fhir-core release directory a `fhirVersion` belongs to: 4.0.x → r4, 4.3.x → r4b, 5.0.x → r5. */
export function fhirCoreRelease(fhirVersion: string | undefined): "r4" | "r4b" | "r5" | undefined {
  if (!fhirVersion) return undefined;
  if (/^4\.0\./.test(fhirVersion)) return "r4";
  if (/^4\.3\./.test(fhirVersion)) return "r4b";
  if (/^5\.0\./.test(fhirVersion)) return "r5";
  return undefined;
}

function undetermined(moduleRel: string, name: string, note: string): SchemaDecl {
  return {
    id: `${moduleRel}#${name}`, name, module: moduleRel, kind: "undetermined", note,
    fields: [], extendsNames: [], values: [], refs: [], unresolved: [], external: [], line: 1, exported: true,
  };
}

/** The value a `fixed[x]` / `pattern[x]` element pins, written short. */
function pinned(e: Record<string, unknown>): string | undefined {
  for (const [k, v] of Object.entries(e)) {
    const m = /^(fixed|pattern)[A-Z]/.exec(k);
    if (!m) continue;
    const text = typeof v === "string" ? JSON.stringify(v) : JSON.stringify(v);
    return `${m[1] === "fixed" ? "=" : "~"} ${text.length > 64 ? `${text.slice(0, 63)}…` : text}`;
  }
  return undefined;
}

/**
 * Read a profile — a `constraint` StructureDefinition — as ONE class that
 * generalises its base (bean `cat-tools-t6fz`).
 *
 * A profile does not define a structure; it narrows one. So its box holds only
 * what it constrains — the differential's elements — each written as the
 * diagram writes any field, `path : Type [min..max]`, with what the profile
 * says about it as a constraint: `MS` (mustSupport), `= value` (fixed),
 * `~ value` (pattern), `prohibited` (max 0). A slice is named `path:slice`.
 * Everything the profile does not mention is inherited, and the generalisation
 * edge to the base says so; the base is FHIR core's (an external box, linked)
 * or another profile of the graph (resolved by canonical).
 *
 * A value the differential leaves out — a cardinality, a type — is read from
 * the snapshot, as for a logical model; with neither, `?..?`.
 */
function readFhirProfile(sd: Json, moduleRel: string): ClassModelRead {
  const name = typeof sd.name === "string" && sd.name ? sd.name : typeof sd.id === "string" ? sd.id : lastSegment(moduleRel);
  const canonical = typeof sd.url === "string" ? sd.url : undefined;
  const summary = firstLine(sd.title) ?? firstLine(sd.description);
  const base = sd.baseDefinition as string;
  const id = `${moduleRel}#${name}`;
  const refs: ClassModelRef[] = [];
  const diff = asElements(sd.differential);
  const snap = asElements(sd.snapshot);
  if (!diff || diff.length === 0) {
    const d = undetermined(moduleRel, name, "could not determine: a profile with no differential elements");
    if (canonical) d.canonical = canonical;
    return { decls: [d], refs: [], edges: [] };
  }
  const snapById = new Map<string, Element>();
  for (const e of snap ?? []) snapById.set(e.id ?? e.path, e);
  const rootPath = diff[0]!.path.split(".")[0]!;
  const coreBase = base.startsWith(FHIR_CORE_SD);
  const decl: SchemaDecl = {
    id, name, module: moduleRel, kind: "fhir-profile",
    ...(canonical ? { canonical } : {}),
    ...(summary ? { doc: summary } : {}),
    fields: [], extendsNames: [lastSegment(base)], values: [], refs: [], unresolved: [],
    external: coreBase ? [lastSegment(base)] : [], line: 1, exported: true,
  };
  refs.push({ from: id, ref: base, module: moduleRel, via: "", kind: "extends", optional: false, array: false, by: "canonical", ...(coreBase ? { quietMiss: true as const } : {}) });
  const externals = new Set<string>(decl.external);

  for (const raw of diff) {
    const el = raw as Element & Record<string, unknown>;
    if (el.path === rootPath) continue;
    const s = snapById.get(el.id ?? el.path);
    const slice = typeof el.sliceName === "string" ? `:${el.sliceName}` : "";
    const fname = el.path.slice(rootPath.length + 1) + slice;
    const notes: string[] = [];
    if (el.mustSupport === true) notes.push("MS");
    const pin = pinned(el);
    if (pin) notes.push(pin);
    if (el.max === "0") notes.push("prohibited");
    const statesType = Array.isArray(el.type);
    // A bare slicing declaration narrows nothing a box can show.
    if (!slice && el.slicing && !statesType && el.min === undefined && el.max === undefined && notes.length === 0) continue;
    const min = el.min ?? s?.min;
    const maxRaw = el.max ?? s?.max;
    const max = maxRaw === undefined ? undefined : maxRaw === "*" ? ("*" as const) : Number(maxRaw);
    const types = (el.type ?? s?.type ?? []) as NonNullable<Element["type"]>;
    const shown: string[] = [];
    const names: string[] = [];
    const typeLinks: Record<string, string> = {};
    const optional = min === undefined ? true : min === 0;
    const array = max === "*" || (typeof max === "number" && max > 1);
    for (const t of types as { code?: string; profile?: string[]; targetProfile?: string[] }[]) {
      const code = t.code ?? "";
      const n = lastSegment(code);
      if (!n) continue;
      typeLinks[n] = fhirTypeCanonical(code);
      const targets = t.targetProfile ?? [];
      const profiles = t.profile ?? [];
      if (targets.length) {
        shown.push(`${n}(${targets.map(lastSegment).join(" | ")})`);
        for (const tp of targets) {
          typeLinks[lastSegment(tp)] = tp;
          const core = tp.startsWith(FHIR_CORE_SD);
          if (core) externals.add(lastSegment(tp));
          refs.push({ from: id, ref: tp, module: moduleRel, via: fname, kind: "id-ref", optional, array, by: "canonical", ...(core ? { quietMiss: true as const } : {}) });
        }
      } else if (profiles.length) {
        // A type narrowed to a profile (an extension, a datatype profile): an edge to it.
        shown.push(`${n}(${profiles.map(lastSegment).join(" | ")})`);
        for (const p of profiles) {
          typeLinks[lastSegment(p)] = p;
          names.push(lastSegment(p));
          // HL7's own (core, or a cross-version extension under hl7.org/fhir/<v>/) is
          // FHIR's to define: external until a layer holds it, never a miss.
          refs.push({ from: id, ref: p, module: moduleRel, via: fname, kind: "field", optional, array, by: "canonical", ...(p.startsWith("http://hl7.org/fhir/") ? { quietMiss: true as const } : {}) });
        }
      } else {
        shown.push(n);
        if (code.startsWith(FHIR_CORE_SD) || !/^https?:/.test(code)) externals.add(n);
      }
    }
    decl.fields.push({
      name: fname,
      type: shown.length ? shown.join(" | ") : "(inherited)",
      optional,
      array,
      names,
      ...(min !== undefined ? { min } : {}),
      ...(max !== undefined ? { max } : {}),
      ...(min === undefined && max === undefined ? { cardinalityUnknown: true as const } : {}),
      ...(notes.length ? { constraint: notes.join(", ") } : {}),
      ...(Object.keys(typeLinks).length ? { typeLinks } : {}),
      ...(el.short || el.definition ? { doc: el.short ?? firstLine(el.definition)! } : {}),
    });
  }
  decl.external = [...externals].sort();
  return { decls: [decl], refs, edges: [], ...(summary ? { summary } : {}) };
}
