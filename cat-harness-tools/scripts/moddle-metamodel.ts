/**
 * Read an OMG metamodel — BPMN 2.0, DMN 1.3, and the Diagram Definition
 * (DC, DI) packages both use — into the schema graph's class model, from the
 * moddle descriptors the `bpmn-moddle` and `dmn-moddle` packages ship, so the
 * schemas viewer draws `bpmn:Process` with the same boxes as every other
 * source.
 *
 * @module scripts/moddle-metamodel
 * @graphNode none — a reader over published metamodel descriptors, not a schema itself
 *
 * ## Why the moddle descriptors
 *
 * BPMN and DMN are XML Schema and CMOF specifications, not RDF vocabularies,
 * so no `@vocabulary/*` package holds them. The libraries this layer already
 * depends on to parse BPMN and DMN carry each package of the metamodel as one
 * JSON descriptor (`resources/…/json/*.json`: `name`, `uri`, `prefix`,
 * `types`, `enumerations`) — the very model the parser reads a diagram with.
 * Which packages are read is what a layer's `package.json` depends on (a
 * dependency named `*-moddle`), never a list kept here.
 *
 * ## What becomes what
 *
 * | descriptor | class model |
 * |---|---|
 * | a type | one box, `«moddle»`, named `prefix:Name`, `canonical` = `<uri>#Name` |
 * | `superClass` | generalisation |
 * | a property typed by a type | a `field` edge (containment) |
 * | a property with `isReference` | an `id-ref` edge: an association by id, not containment |
 * | an enumeration | a box whose values are its literals |
 *
 * ## Cardinality, as far as the descriptor says
 *
 * A descriptor states `isMany` and nothing about a lower bound: the BPMN
 * specification's own multiplicities are not in it. So the upper bound is
 * read (`*` for `isMany`, else 1) and the lower one is drawn `?` — `?..1`,
 * `?..*` — never a guessed 0 or 1.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import type { ClassModelRef, SchemaDecl, SchemaEdge, SchemaField, SchemaGraphModule } from "./schema-graph.ts";
import type { VocabularyRead } from "./rdf-vocabulary.ts";

/** moddle's built-in types: values, not classes. */
const BUILTINS = new Set(["String", "Boolean", "Integer", "Real", "Element"]);

interface Descriptor {
  name: string;
  uri: string;
  prefix: string;
  types?: { name: string; superClass?: string[]; isAbstract?: boolean; properties?: Prop[]; meta?: unknown }[];
  enumerations?: { name: string; literalValues?: { name: string }[] }[];
}
interface Prop {
  name: string;
  type?: string;
  isMany?: boolean;
  isAttr?: boolean;
  isReference?: boolean;
  isId?: boolean;
  default?: unknown;
  redefines?: string;
  replaces?: string;
}

const isDescriptor = (v: unknown): v is Descriptor => {
  const d = v as Partial<Descriptor> | null;
  return !!d && typeof d === "object" && typeof d.name === "string" && typeof d.uri === "string" && typeof d.prefix === "string" && Array.isArray(d.types);
};

/** The `*-moddle` packages `packageJson` depends on. */
export function declaredMetamodels(packageJson: string): { pkg: string; version: string }[] {
  if (!existsSync(packageJson)) return [];
  try {
    const pj = JSON.parse(readFileSync(packageJson, "utf-8")) as { dependencies?: Record<string, string> };
    return Object.entries(pj.dependencies ?? {})
      .filter(([n]) => /(^|[/-])moddle$/.test(n) && n !== "moddle")
      .map(([pkg, version]) => ({ pkg, version }))
      .sort((a, b) => a.pkg.localeCompare(b.pkg));
  } catch {
    return [];
  }
}

/** Every descriptor JSON under `dir`, sorted. */
function descriptorFiles(dir: string, depth = 0): string[] {
  if (depth > 4 || !existsSync(dir)) return [];
  const out: string[] = [];
  for (const f of readdirSync(dir).sort()) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) out.push(...descriptorFiles(p, depth + 1));
    else if (f.endsWith(".json")) out.push(p);
  }
  return out;
}

/** The canonical of a type: `<uri>#Name`, one `#` whatever the uri ends with. */
const canonicalOf = (uri: string, name: string): string => `${uri.replace(/[#/]$/, "")}#${name}`;

/**
 * Read the metamodels a layer declares, from each package's `resources/`.
 */
export function readModdleMetamodels(
  packageJson: string,
  rel: (p: string) => string,
  instance: string,
): { modules: SchemaGraphModule[]; decls: SchemaDecl[]; edges: SchemaEdge[]; refs: ClassModelRef[]; vocabularies: VocabularyRead[]; unread: string[] } {
  const req = createRequire(packageJson);
  const docs: { descriptor: Descriptor; module: string; source: string }[] = [];
  const unread: string[] = [];
  for (const { pkg, version } of declaredMetamodels(packageJson)) {
    let dir: string;
    let actual = version;
    try {
      const pj = req.resolve(`${pkg}/package.json`);
      dir = dirname(pj);
      actual = (JSON.parse(readFileSync(pj, "utf-8")) as { version?: string }).version ?? version;
    } catch {
      unread.push(`${pkg}@${version}: declared and not installed — nothing is read for it`);
      continue;
    }
    const found = descriptorFiles(join(dir, "resources"));
    let n = 0;
    for (const f of found) {
      let d: unknown;
      try {
        d = JSON.parse(readFileSync(f, "utf-8"));
      } catch {
        continue;
      }
      if (!isDescriptor(d)) continue;
      docs.push({ descriptor: d, module: rel(f), source: `${pkg}@${actual}` });
      n++;
    }
    if (n === 0) unread.push(`${pkg}@${actual}: ships no moddle descriptor under resources/`);
  }
  return { ...readModdleDescriptors(docs, instance), unread };
}

/**
 * Read moddle descriptors already in hand. Descriptors from one `source` (one
 * package) resolve each other's prefixes, as moddle does when they are
 * registered together.
 */
export function readModdleDescriptors(
  docs: readonly { descriptor: Descriptor; module: string; source: string }[],
  instance = "test",
): { modules: SchemaGraphModule[]; decls: SchemaDecl[]; edges: SchemaEdge[]; refs: ClassModelRef[]; vocabularies: VocabularyRead[] } {
  const modules: SchemaGraphModule[] = [];
  const decls: SchemaDecl[] = [];
  const refs: ClassModelRef[] = [];
  const vocabularies: VocabularyRead[] = [];
  for (const { descriptor: d, module, source } of docs) {
    const uriOfPrefix = new Map(docs.filter((x) => x.source === source).map((x) => [x.descriptor.prefix, x.descriptor.uri]));
    /** A type reference as written → its `prefix:Name` and canonical, or a built-in. */
    const target = (ref: string): { name: string; canonical?: string } => {
      const [p, local] = ref.includes(":") ? (ref.split(":", 2) as [string, string]) : [d.prefix, ref];
      if (p === d.prefix && BUILTINS.has(local)) return { name: local };
      const uri = uriOfPrefix.get(p);
      return { name: `${p}:${local}`, ...(uri ? { canonical: canonicalOf(uri, local) } : {}) };
    };
    const own: SchemaDecl[] = [];
    const blank = (name: string, kind: SchemaDecl["kind"], extra: Partial<SchemaDecl> = {}): SchemaDecl => ({
      id: `${module}#${d.prefix}:${name}`, name: `${d.prefix}:${name}`, module, kind, canonical: canonicalOf(d.uri, name),
      fields: [], extendsNames: [], values: [], refs: [], unresolved: [], external: [], line: 1, exported: true, ...extra,
    });
    for (const t of d.types ?? []) {
      // moddle's own primitives, re-declared by DC: values, not classes.
      if (BUILTINS.has(t.name) && !(t.properties ?? []).length && !(t.superClass ?? []).length) continue;
      const decl = blank(t.name, "moddle-class", t.isAbstract ? { doc: "abstract" } : {});
      for (const s of t.superClass ?? []) {
        const tgt = target(s);
        decl.extendsNames.push(tgt.name);
        if (tgt.canonical) refs.push({ from: decl.id, ref: tgt.canonical, module, via: "", kind: "extends", optional: false, array: false, by: "canonical" });
      }
      for (const p of t.properties ?? []) {
        const tgt = target(p.type ?? "String");
        const array = !!p.isMany;
        const notes = [p.isId ? "id" : "", p.isAttr ? "attr" : "", p.default !== undefined ? `= ${JSON.stringify(p.default)}` : "", p.redefines ? `redefines ${p.redefines}` : "", p.replaces ? `replaces ${p.replaces}` : ""].filter(Boolean);
        const field: SchemaField = {
          name: p.name,
          type: tgt.name,
          optional: true,
          array,
          names: [],
          max: array ? "*" : 1,
          minUnknown: true,
          ...(notes.length ? { constraint: notes.join(", ") } : {}),
        };
        decl.fields.push(field);
        if (tgt.canonical) {
          refs.push({ from: decl.id, ref: tgt.canonical, module, via: p.name, kind: p.isReference ? "id-ref" : "field", optional: true, array, by: "canonical" });
        }
      }
      own.push(decl);
    }
    for (const e of d.enumerations ?? []) {
      own.push(blank(e.name, "moddle-enum", { values: (e.literalValues ?? []).map((l) => l.name) }));
    }
    own.sort((a, b) => a.id.localeCompare(b.id));
    modules.push({ module, instance, name: d.prefix, graphNode: "schema", summary: `${d.name} metamodel (${source})`, isTest: false, decls: own.map((x) => x.id) });
    decls.push(...own);
    vocabularies.push({ prefix: d.prefix, namespace: d.uri, source, module, classes: own.length, properties: own.reduce((n, x) => n + x.fields.length, 0) });
  }
  return { modules, decls, edges: [], refs, vocabularies };
}
