#!/usr/bin/env bun
/**
 * UML for every NAMED SUB-GRAPH a layer declares — PlantUML and Mermaid
 * from one model.
 *
 * Nothing here invents a grouping. The groups are read:
 *
 * - **Section** — one entry of a layer's declaration (`<instance>.json`
 *   `directories[]`), named `<instance>/<entry id>`.
 * - **Node schema kind** — each of the entry's `graphTypologies`, resolved through
 *   {@link resolveKindValidator}: the Zod schema the registry names, turned
 *   into JSON Schema (`toJsonSchema`) and then into classes. A kind
 *   with no validator is drawn as an EMPTY section that says so — *could not
 *   determine*, never an empty-but-valid box.
 * - **Colour** — a CSS class per graph typology (`fa_uml_kind_<kind>`), coloured
 *   in `docs/assets/css/uml.css`. No colour is written into either diagram.
 *
 * ## Renderings, cross-referenced
 *
 * Per section and per layer:
 *
 * ```
 * uml/overview/<instance>.puml|.mmd              every section of the instance
 * uml/overview/<instance>/<section>.puml|.mmd    one section, with attributes
 * docs/uml/overview/…/<same>.md                  the page: renders the Mermaid,
 *                                                links both sources
 * docs/assets/img/uml/overview/…/<same>.dot      the same model as Graphviz DOT,
 *                                                published beside the SVG for the
 *                                                page's Interactive view
 * ```
 *
 * All are written from the same {@link Section} list, so none can say what
 * another does not. The page renders Mermaid because just-the-docs loads it
 * and it puts a real CSS class on a node; the `.puml` is for the PlantUML look
 * and offline use, and names the page. The DOT (skill `kg-subgraph-layout`) is
 * laid out in the browser with Graphviz in WebAssembly
 * (`assets/js/kg-graph.js`), and the reader can drag its nodes.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/gen-uml-overview.ts           # write
 *   bun run cat-harness-tools/scripts/gen-uml-overview.ts --check   # stale or orphaned?
 *   ... --ref main|<sha>|pr/<n>   # which qa-reports entry a qa directory missing from the checkout is drawn from
 *
 * Two inputs are QA results. The detangle numbers are read from the pinned
 * record, or computed when none is in the checkout. A `qa` directory missing
 * from the checkout is drawn as stored on the `qa-reports` branch. Anything
 * that cannot be determined stops the run with exit 2, writing nothing
 * ({@link UNDETERMINED}).
 *
 * @module scripts/gen-uml-overview
 * @covers uml
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";

import { gitCorpus } from "../schemas/sdlc/git-corpus.ts";
import { dirname, join, relative, resolve, sep } from "node:path";
import { z } from "zod";

import { toJsonSchema } from "../schemas/kg/to-json-schema.js";

import { compareRoute } from "./route-authority.ts";
import { isDirectoryReadme } from "../schemas/kg/kg-node.ts";
import { checkoutRootFor, instanceDirectoryForGraph, layerRootsIn, instanceDirectories, readDeclaration, siteDir, repoRootFor } from "../schemas/kg/cat-harness.js";
import { BASE_GRAPH_TYPOLOGIES, resolveGraphTypology } from "../schemas/kg/graph-typology-registry.js";
import { readUmlPalette } from "./uml-palette.js";
import { bothViews, gridLinks, renderSvgs, safeId, sha256, svgStamp, views, type RenderJob } from "./plantuml-render.js";
import { detangleResultsDir, sidecarFor } from "../schemas/kg/detangle-sidecar.js";
import { QaUsageError, readQaManifest, readQaTree } from "./qa-store.ts";
import { requireCurrentWorkingCopy } from "./qa-working-copy.ts";
import { JUDGEMENT_EXIT } from "./qa-results.ts";
import { overlayDirs, readPathAt, writePathAt } from "./lib/layer-output.ts";
import { spawnSync } from "node:child_process";
import { glossaryLinksMd, schemasViewPuml } from "./gen-object-model-uml.js";
import { resolveKindValidator, resolveNodeSchemas, type NodeSchemaResolution } from "../schemas/kg/kind-validator.js";
import { HARNESS_ROOT } from "./lib/roots.ts";

const HARNESS = resolve(HARNESS_ROOT);
/** Colours for the `.puml`, read from `uml.css` so both renderings agree. */
const PALETTE = readUmlPalette(HARNESS);
const REPO = repoRootFor(HARNESS);
/**
 * The checkout holding the harness. Where it MOUNTS cat-harness, every file
 * this generator computes (the `.puml` model, the pages, the SVGs) is written
 * at the layer's output root (`build/layers/cat-harness/…`,
 * `lib/layer-output.ts`) and read back through the overlay, so a run leaves
 * the pinned mount as its lock pins it (bean `cat-tools-sm8r`, item 4).
 */
const CHECKOUT = checkoutRootFor(HARNESS);
// declared-path-literal: the conventional fallback when no declaration names the directory
const UML_ROOT = join(instanceDirectoryForGraph(HARNESS, "uml") ?? join(HARNESS, "uml"), "overview");
const OWN = readDeclaration(HARNESS);
if (!OWN) throw new Error(`${HARNESS} declares no instance — nothing to draw`);
/** This layer's own site, where the pages are rendered. */
const DOCS_ROOT = join(HARNESS, siteDir(OWN), "uml", "overview");
/** The PlantUML renderings the pages show, beside the BPMN ones under assets/img/. */
const SVG_ROOT = join(HARNESS, siteDir(OWN), "assets", "img", "uml", "overview");
/** The schemas view, one level above the overviews in both trees. */
const SCHEMAS_PUML = join(UML_ROOT, "..", "harness-schemas.puml");
/**
 * The full object model. `gen-object-model-uml.ts` writes it, and only where
 * the `beans` CLI is on PATH, so this generator never writes it: it renders
 * the COMMITTED file. The SVG's stamp is checked against that file, which
 * needs neither Java nor beans.
 */
const OBJECT_MODEL_PUML = join(UML_ROOT, "..", "harness-object-model.puml");
const REPO_URL = "https://github.com/litlfred/folio-assistant";
const SITE_URL = OWN.canonicalUrl ?? "";
const GENERATOR = relative(REPO, import.meta.path);
/** The menu entry the harness pages sit under. */
const NAV_PARENT = "UML overview";

// ── The model ─────────────────────────────────────────────────────────────

interface Attr {
  name: string;
  type: string;
  mult: string;
  /**
   * Set on the one line a box carries when it has no fields to show, saying
   * why. A box with nothing in it reads as a rendering fault; the owner asked
   * "why empty?" of exactly that, 2026-09-23.
   */
  remark?: boolean;
}

/** The line that stands in for fields a box cannot show. */
const remark = (text: string): Attr => ({ name: text, type: "", mult: "", remark: true });

interface UmlClass {
  /** Unique within a layer diagram. */
  id: string;
  title: string;
  /** The stereotype: which schema this class was read from. */
  source: string;
  kind: string;
  attrs: Attr[];
}

interface Composition {
  from: string;
  to: string;
  label: string;
  mult: string;
}

export interface Section {
  instance: string;
  /** The declaration entry's id — the sub-graph's name within its layer. */
  id: string;
  /** Repo-relative directory. */
  path: string;
  kinds: string[];
  classes: UmlClass[];
  compositions: Composition[];
  /** Kinds whose node schema could not be determined, with the reason. */
  undetermined: { kind: string; reason: string }[];
}

// ── JSON Schema → classes ─────────────────────────────────────────────────

type Json = Record<string, unknown>;

function typeOf(s: Json): string {
  if (s.const !== undefined) return JSON.stringify(s.const);
  if (Array.isArray(s.enum)) {
    const vals = (s.enum as unknown[]).map(String);
    return vals.length <= 6 ? vals.join(" | ") : `enum(${vals.length})`;
  }
  const alts = (s.anyOf ?? s.oneOf) as Json[] | undefined;
  if (alts) return [...new Set(alts.map(typeOf))].join(" | ");
  if (s.type === "array") {
    const inner = typeOf((s.items ?? {}) as Json);
    return inner.includes(" | ") ? `list<${inner}>` : `${inner}[]`;
  }
  if (s.type === "object" && s.additionalProperties && !s.properties) {
    return `map<${typeOf(s.additionalProperties as Json)}>`;
  }
  if (Array.isArray(s.type)) return (s.type as string[]).join(" | ");
  if (typeof s.type === "string") return s.format ? `${s.type}<${s.format}>` : s.type;
  return "any";
}

function multOf(s: Json, required: boolean): string {
  if (s.type === "array") {
    const min = (s.minItems as number | undefined) ?? 0;
    return min > 0 ? `${min}..*` : "0..*";
  }
  return required ? "1" : "0..1";
}

/** `roles` → `Role`, `directories` → `Directory`. A label, never an id. */
function singular(prop: string): string {
  const base = prop.replace(/ies$/, "y").replace(/(ss)$/, "$1").replace(/s$/, "");
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/**
 * One class per object in the schema that has named properties: the root,
 * and every array-of-objects property (a composition). Depth is bounded
 * because a class box past the second level is detail nobody reads.
 */
function decompose(
  schema: Json,
  title: string,
  source: string,
  kind: string,
  prefix: string,
  out: { classes: UmlClass[]; compositions: Composition[] },
  depth = 0,
): string {
  const id = safeId(`${prefix}_${title}`);
  const props = (schema.properties ?? {}) as Record<string, Json>;
  const req = new Set((schema.required ?? []) as string[]);
  const attrs: Attr[] = [];
  for (const [name, s] of Object.entries(props)) {
    const items = s.type === "array" ? ((s.items ?? {}) as Json) : undefined;
    if (depth < 2 && items?.type === "object" && items.properties) {
      const child = decompose(items, singular(name), source, kind, prefix, out, depth + 1);
      out.compositions.push({ from: id, to: child, label: name, mult: multOf(s, req.has(name)) });
      // Kept as a line too: a class whose only field is composed otherwise
      // draws as an empty box with an arrow leaving it.
      attrs.push({ name, type: `${singular(name)}[]`, mult: multOf(s, req.has(name)) });
      continue;
    }
    attrs.push({ name, type: typeOf(s), mult: multOf(s, req.has(name)) });
  }
  // A root that resolved to a schema but yields no properties is a converter
  // failure, not an empty shape: the Zod 3 → 4 upgrade made every class come
  // out empty here, silently, while the object model's edge check caught it.
  if (depth === 0 && Object.keys(props).length === 0 && schema.type === "object") {
    throw new Error(`${source}: JSON Schema has no properties — is the Zod → JSON Schema converter current?`);
  }
  if (!out.classes.some((c) => c.id === id)) out.classes.push({ id, title, source, kind, attrs });
  return id;
}

/** A `$schema` that names a JSON Schema metaschema: its nodes are schemas. */
const JSON_SCHEMA_META = /^https?:\/\/json-schema\.org\//;

/** One `$schema` family, as a class — or as the finding it is. */
function drawFamily(
  f: NodeSchemaResolution,
  kind: string,
  prefix: string,
  acc: { classes: UmlClass[]; compositions: Composition[] },
  section: Section,
): void {
  const title = f.tag;
  if (f.state === "resolved") {
    // A validator written as a guard piped into a strict object (the merge
    // queue's: `looseObject` refusing GitHub facts by name, then the entry)
    // has an INPUT side with no properties. Draw the shape it produces, which
    // is the class a reader means.
    const schema = f.schema instanceof z.ZodPipe ? (f.schema.out as z.ZodType) : (f.schema as z.ZodType);
    const json = toJsonSchema(schema) as Json;
    decompose(json, title, `json: ${f.ref.exportName}`, kind, `${prefix}_${safeId(f.tag)}`, acc);
  } else if (f.state === "shape") {
    acc.classes.push({
      id: safeId(`${prefix}_${f.tag}`),
      title,
      source: `ts: ${f.ref.exportName}`,
      kind,
      attrs: f.fields.map((x) => ({ name: x.name, type: x.type, mult: x.optional ? "0..1" : "1" })),
    });
  } else if (f.state === "external" && JSON_SCHEMA_META.test(f.tag)) {
    // The nodes ARE JSON Schemas: their `$schema` names the metaschema, which
    // says only "this is a schema", so a box for it had no fields (owner,
    // 2026-09-23: "why empty?"). Draw each schema document instead: its
    // properties are the fields the sub-graph actually declares.
    //
    // A schema with no properties of its own (a value set's `enum`, or one
    // composed by `$ref`/`allOf`) has no fields to draw, and the DAK base layer holds
    // 22 of them: one empty box each was the same defect 22 times over. They
    // are listed, one line each, in a single summary class instead.
    const docs = (filesByTag(join(REPO, section.path)).get(f.tag) ?? []).sort();
    const listed: Attr[] = [];
    for (const file of docs) {
      const doc = JSON.parse(readFileSync(file, "utf8")) as Json;
      const rel = relative(join(REPO, section.path), file).replace(/\\/g, "/");
      // An EMPTY title counts as none: PlantUML refuses `class ""` and fails
      // the whole render (some IG sidecars, such as a trust IG's, carry `"title": ""`).
      const title = typeof doc.title === "string" && doc.title.trim() ? doc.title : rel;
      const props = (doc.properties ?? {}) as Record<string, unknown>;
      if (Object.keys(props).length > 0) {
        decompose(doc, title, `schema: ${rel}`, kind, safeId(`${prefix}_${rel}`), acc);
        continue;
      }
      const shape = Array.isArray(doc.enum)
        ? `enum(${(doc.enum as unknown[]).length}) of ${String(doc.type ?? "any")}`
        : doc.$ref || doc.allOf || doc.anyOf || doc.oneOf
          ? "composed ($ref / allOf / anyOf / oneOf)"
          : String(doc.type ?? "any");
      listed.push({ name: rel.replace(/\.schema\.json$/, ""), type: shape, mult: "1" });
    }
    if (listed.length) {
      acc.classes.push({
        id: safeId(`${prefix}_${f.tag}_listed`),
        title: `${listed.length} schema(s) with no properties`,
        source: `ext: ${f.spec}`,
        kind,
        attrs: listed,
      });
    }
  } else if (f.state === "external") {
    acc.classes.push({ id: safeId(`${prefix}_${f.tag}`), title: f.spec, source: `ext: ${f.spec}`, kind, attrs: [] });
  } else {
    section.undetermined.push({ kind: `${kind} ${f.tag}`, reason: f.reason });
  }
}

/** Every `$schema` tag carried by a JSON file under `dir`. */
function tagsUnder(dir: string): Set<string> {
  return new Set(filesByTag(dir).keys());
}

/** Which `qa-reports` entry a `qa` directory missing from the checkout is drawn from. `--ref`, default `main`. */
const QA_REF = (() => {
  const at = process.argv.indexOf("--ref");
  return at > 0 && process.argv[at + 1] ? process.argv[at + 1]! : "main";
})();

/**
 * The `$schema` families a sub-graph holds, or `null` when that cannot be
 * determined (the cause is recorded in {@link UNDETERMINED}).
 *
 * Bean `oq1j` (`R19`). For every kind but `qa`, and for a `qa` directory that
 * is in the checkout, the answer is the files on disk, as it always was. A
 * `qa` directory that is NOT in the checkout has left for the `qa-reports`
 * branch (owner rulings D1/D4), so it is drawn as stored there, at
 * {@link QA_REF}. The four store states map like this:
 *
 * - **hit**: the families the stored files carry.
 * - **miss**, with an entry whose manifest published a root covering this
 *   path: a determined empty, drawn exactly as an empty directory on disk is.
 * - **miss** with no such entry or root, **corrupt**, **unknown**: not
 *   determined. Drawing "no node here" for these would be the `dh4f` defect,
 *   a miss read as clean.
 * - **unreachable**: a checkout with no store to ask (no `origin`, no
 *   `QA_STORE_REMOTE`, as a layer standing alone has; bean `cat-tools-sm8r`).
 *   Not determined either. It threw, and a test drawing the real corpus
 *   standing alone passed only while another test's leftover `test/results/`
 *   kept this branch from being reached.
 */
function tagsForSection(path: string, kind: string): Set<string> | null {
  const abs = join(REPO, path);
  if (kind !== "qa") return tagsUnder(abs);
  // A `qa` directory in the checkout, through the layer output overlay: a
  // mounted layer's computed results are under `build/layers/<instance>/`
  // (bean `cat-tools-sm8r`, item 4). The union of its families.
  const dirs = overlayDirs(abs);
  if (dirs.length > 0) return new Set(dirs.flatMap((d) => [...tagsUnder(d)]));
  const where = `${path}/ is not in the checkout, and qa-reports at ${QA_REF}`;
  try {
    return storedTags(path, where);
  } catch (e) {
    if (!(e instanceof QaUsageError)) throw e;
    UNDETERMINED.push(`${where}: unreachable — ${e.message}`);
    return null;
  }
}

/** {@link tagsForSection} for a `qa` directory not in the checkout: as stored in `qa-reports` at {@link QA_REF}. */
function storedTags(path: string, where: string): Set<string> | null {
  const m = readQaManifest(QA_REF);
  if (m.state !== "hit") {
    UNDETERMINED.push(`${where}: ${m.state} — ${m.reason}`);
    return null;
  }
  const tree = readQaTree(QA_REF, path);
  if (tree.state === "hit") {
    const tags = new Set<string>();
    for (const text of tree.files.values()) {
      try {
        const tag = (JSON.parse(text) as { $schema?: unknown })?.$schema;
        if (typeof tag === "string") tags.add(tag);
      } catch {
        // not a node: the same rule `filesByTag` keeps on disk
      }
    }
    return tags;
  }
  if (tree.state === "miss" && m.manifest.roots.some((r) => path === r || path.startsWith(`${r}/`))) return new Set();
  UNDETERMINED.push(`${where}: ${tree.state} — ${tree.reason}`);
  return null;
}

/** The JSON files under `dir`, grouped by the `$schema` tag each carries. */
/**
 * The `$schema`-tagged JSON nodes under {@link dir}, by tag.
 *
 * **Asked of git, not of the disk** — the fourth scanner in this repository to
 * need that said out loud, and the third to need it on one day (bean `rsi6`,
 * after `ramz` and `xd1g`). A bare walk descends into any untracked subtree a
 * declared directory happens to contain, and a publishable package's
 * `node_modules/` holds thousands of `.json` files with `$schema` tags that
 * are facts about other projects.
 *
 * The `statSync` in the fallback is guarded because a DANGLING SYMLINK threw
 * `ENOENT` here and killed the whole generator, which then produced no
 * overview at all rather than an overview missing one file.
 */
function filesByTag(dir: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const record = (p: string): void => {
    try {
      const tag = (JSON.parse(readFileSync(p, "utf8")) as { $schema?: unknown })?.$schema;
      if (typeof tag === "string") out.set(tag, [...(out.get(tag) ?? []), p]);
    } catch {
      // not a node
    }
  };

  const listed = gitCorpus(dir, ["*.json"]);
  if (listed !== undefined) {
    for (const p of listed) record(p);
    return out;
  }

  const walkDir = (d: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(d);
    } catch {
      return;
    }
    for (const e of entries) {
      const p = join(d, e);
      let isDir: boolean;
      try {
        isDir = statSync(p).isDirectory();
      } catch {
        continue; // dangling symlink: not readable is not a reason to stop
      }
      if (isDir) walkDir(p);
      else if (p.endsWith(".json")) {
        try {
          const tag = (JSON.parse(readFileSync(p, "utf8")) as { $schema?: unknown })?.$schema;
          if (typeof tag === "string") out.set(tag, [...(out.get(tag) ?? []), p]);
        } catch {
          // not a node
        }
      }
    }
  };
  walkDir(dir);
  return out;
}

// ── Reading the harnesses ─────────────────────────────────────────────────

/**
 * A kind with no runtime validator may still say where its shape is written
 * down (`GraphTypologyDef.schema`). Two cases are drawable:
 *
 * - a pinned **external-schema record** (`folio-external-schema/v1`) — the
 *   class carries the spec's edition and the operative terms the corpus
 *   uses, which is what BPMN has instead of a JSON Schema;
 * - a **module** — drawn as a class naming it, with no attributes, because a
 *   TypeScript interface cannot be read here and inventing fields would be
 *   worse than showing none.
 */
function fromSchemaField(
  kind: string,
  prefix: string,
  acc: { classes: UmlClass[]; compositions: Composition[] },
): boolean {
  const where = BASE_GRAPH_TYPOLOGIES[kind]?.schema;
  if (!where) return false;
  const abs = join(HARNESS, where);
  if (where.endsWith(".json") && existsSync(abs)) {
    const rec = JSON.parse(readFileSync(abs, "utf8")) as Json;
    if (rec.$schema === "folio-external-schema/v1") {
      const terms = ((rec.terms ?? []) as Json[]).map((t) => String(t.term));
      acc.classes.push({
        id: safeId(`${prefix}_${String(rec.id)}`),
        title: String(rec.title),
        source: `ext: ${String(rec.id)}`,
        kind,
        attrs: terms.map((t) => ({ name: t, type: "element", mult: "0..*" })),
      });
      return true;
    }
  }
  acc.classes.push({
    id: safeId(`${prefix}_${kind}_shape`),
    title: kind,
    source: `schema: ${where}`,
    kind,
    attrs: [remark(`fields not machine-readable: ${where} names no exported schema`)],
  });
  return true;
}

export async function sectionsOf(instanceRoot: string): Promise<Section[]> {
  let decl;
  try {
    decl = readDeclaration(instanceRoot);
  } catch {
    return [];
  }
  if (!decl) return [];
  const out: Section[] = [];
  // Its own entries AND the ones declared from within (bean `cmsl`) — see
  // `instanceDirectories` for the five diagrams `decl.directories` dropped.
  for (const entry of instanceDirectories(instanceRoot, decl)) {
    const abs = join(instanceRoot, entry.path);
    const section: Section = {
      instance: decl.name,
      id: entry.id,
      path: relative(REPO, abs).replace(/\\/g, "/"),
      kinds: entry.graphTypologies.map((k) => resolveGraphTypology(k).kind),
      classes: [],
      compositions: [],
      undetermined: [],
    };
    const acc = { classes: section.classes, compositions: section.compositions };
    const prefix = `${decl.name}_${entry.id}`;
    for (const kind of section.kinds) {
      // `cat-harness` beside another kind is the umbrella, not a node kind: on
      // `["schemas", "cat-harness"]` it says "a schema IS a knowledge-graph
      // node" (graph-typology-registry.ts, §"`cat-harness` SURVIVES"). Drawing it
      // as a second, undetermined box would invent a kind nobody declared.
      if (kind === "cat-harness" && section.kinds.length > 1) continue;
      // A base kind's validator is a path in the harness that DEFINES the
      // kind. Resolving it only against the declaring layer made every
      // downstream sub-graph — bootstrap/scenarios — unresolvable.
      // Bean `rdkm`: a kind that names its `$schema` families is drawn one
      // class per family — seven for `qa` — rather than as one kind-level box.
      const families = await resolveNodeSchemas(kind, HARNESS);
      if (families.length) {
        // Only the families THIS sub-graph holds. The map is the kind's, across
        // every harness; drawing all of it put cat-harness's voice schemas in
        // bootstrap/skills, which holds none of them.
        const here = tagsForSection(section.path, kind);
        if (!here) continue; // could not determine: recorded in UNDETERMINED, and the run stops before writing
        // A DERIVED family is carried by no file: it is what the kind's source
        // files are read into (the `archimate` kind's model), so it is drawn
        // wherever the kind is.
        const present = families.filter((f) => here.has(f.tag) || f.derived);
        for (const f of present) drawFamily(f, kind, prefix, acc, section);
        if (present.length === 0) {
          section.undetermined.push({
            kind,
            reason: `no node here carries a $schema family ${kind} names (${families.length} named)`,
          });
        }
        continue;
      }
      let v = await resolveKindValidator(kind, instanceRoot);
      if (v.state === "unresolvable" && instanceRoot !== HARNESS && BASE_GRAPH_TYPOLOGIES[kind]) {
        v = await resolveKindValidator(kind, HARNESS);
      }
      if (v.state === "resolved") {
        const json = toJsonSchema(v.schema as z.ZodType) as Json;
        decompose(json, v.ref.exportName.replace(/Schema$/, ""), `json: ${v.ref.exportName}`, kind, prefix, acc);
        continue;
      }
      if (fromSchemaField(kind, prefix, acc)) continue;
      section.undetermined.push({ kind, reason: v.state === "undeclared" ? "no validator registered" : v.reason });
    }
    out.push(section);
  }
  return out;
}

// ── PlantUML ──────────────────────────────────────────────────────────────

function pumlEsc(s: string): string {
  return s.replace(/"/g, "'");
}

function puml(name: string, pageUrl: string, sections: Section[], withAttrs: boolean): string {
  const L = [
    `' GENERATED by ${GENERATOR} — do not edit.`,
    `' Rendered page (Mermaid, same model): ${pageUrl}`,
    `@startuml ${safeId(name)}`,
    "!pragma layout elk",
    "!theme plain",
    "skinparam classAttributeIconSize 0",
    "skinparam shadowing false",
    "skinparam packageStyle rectangle",
    "hide empty methods",
    "",
  ];
  for (const s of sections) {
    L.push(`package "${s.instance}/${s.id}" as ${safeId(`pkg_${s.instance}_${s.id}`)} <<${s.kinds.join(", ")}>> {`);
    for (const c of s.classes) {
      L.push(`  class "${pumlEsc(c.title)}" as ${c.id} <<${pumlEsc(c.source)}>> ${PALETTE.kind(c.kind)} {`);
      if (withAttrs) {
        for (const a of c.attrs) L.push(a.remark ? `    //${pumlEsc(a.name)}//` : `    ${a.name} [${a.mult}] : ${pumlEsc(a.type)}`);
      }
      L.push("  }");
    }
    for (const u of s.undetermined) {
      L.push(`  note "${u.kind}: no node schema declared\\n(${u.reason}: could not determine)" as ${safeId(`n_${s.instance}_${s.id}_${u.kind}`)}`);
    }
    L.push("}");
  }
  L.push("");
  for (const s of sections) {
    for (const c of s.compositions) L.push(`${c.from} *-- "${c.mult}" ${c.to} : ${c.label}`);
  }
  // A grid, not a strip. Sub-graphs share no edges, so ELK lays them all in
  // one row (bootstrap: 3303 x 491). Hidden links fold them into a grid:
  // this file is the PORTRAIT view, few columns; `landscapeOf` rebuilds the
  // same links with more. Hidden, so they draw nothing and assert nothing.
  if (sections.length > 1) {
    L.push(...gridLinks(sections.map((s) => safeId(`pkg_${s.instance}_${s.id}`)), "portrait"));
  }
  L.push("@enduml");
  return L.join("\n") + "\n";
}

// ── Mermaid ───────────────────────────────────────────────────────────────

/** Mermaid class-diagram member text: no braces, no angle brackets. */
function mmdText(s: string): string {
  return s.replace(/[{}]/g, "").replace(/</g, "~").replace(/>/g, "~").replace(/"/g, "'");
}

function mmd(sections: Section[], withAttrs: boolean): string {
  // LR for a multi-section overview: dagre lays unconnected groups side by
  // side along the CROSS axis, so LR stacks the sub-graphs vertically — one
  // readable column instead of a strip too wide to scroll. Owner, 2026-09-23.
  const L = ["classDiagram", sections.length > 1 ? "  direction LR" : "  direction TB"];
  for (const s of sections) {
    L.push(`  namespace ${safeId(`${s.instance}__${s.id}`)} {`);
    for (const c of s.classes) {
      L.push(`    class ${c.id}["${mmdText(c.title)}"] {`);
      L.push(`      <<${mmdText(c.source)}>>`);
      if (withAttrs) {
        for (const a of c.attrs) L.push(a.remark ? `      ${mmdText(a.name)}` : `      ${mmdText(a.name)} [${a.mult}] ${mmdText(a.type)}`);
      }
      L.push("    }");
    }
    for (const u of s.undetermined) {
      const id = safeId(`n_${s.instance}_${s.id}_${u.kind}`);
      L.push(`    class ${id}["${u.kind}: no node schema"] {`);
      L.push("      <<could not determine>>");
      L.push("    }");
    }
    L.push("  }");
  }
  for (const s of sections) {
    for (const c of s.compositions) L.push(`  ${c.from} *-- "${c.mult}" ${c.to} : ${mmdText(c.label)}`);
    // Mermaid's grammar takes neither a hyphen in a class name nor a list
    // of classes (a comma separates NODE ids), hence underscores and one
    // statement per class.
    for (const c of s.classes) L.push(`  cssClass "${c.id}" fa_uml_kind_${safeId(c.kind)}`);
    for (const u of s.undetermined) {
      const id = safeId(`n_${s.instance}_${s.id}_${u.kind}`);
      L.push(`  cssClass "${id}" fa_uml_kind_${safeId(u.kind)}`);
      L.push(`  cssClass "${id}" fa_uml_undetermined`);
    }
  }
  return L.join("\n") + "\n";
}

// ── Graphviz DOT (the interactive view) ──────────────────────────────────
//
// The third rendering of the SAME {@link Section} list, for the page's
// Interactive view: `assets/js/kg-graph.js` lays it out in the reader's
// browser with Graphviz compiled to WebAssembly, and lets them drag nodes.
// Owner, 2026-10-09: "could use the wasm-graphviz to make the graph
// visualizers overview more dynamic. also allow users to drag nodes around".
//
// The convention is the i2ce Form Documentor's (skill `kg-subgraph-layout`):
// a node is a rounded box (the look of its `Mrecord`) whose HTML-table label
// is a boxed header, then one row per field; the graph is laid out by `unflatten | dot`. Restated for a
// class diagram:
//
// - a class is a node; NOT an `Mrecord` itself, because Graphviz then splits
//   the label at every `|` and a union type (`a | b`) drew as one field;
//   its fill is its kind's family colour, read from
//   `uml.css` by `uml-palette.ts` exactly as the `.puml` reads it, and its
//   `class` is `fa_uml_kind_<kind>`, the hook the Mermaid view carries;
// - a named sub-graph is a `cluster_` subgraph, labelled as the `.puml`
//   package is;
// - a composition is an edge with a diamond at the whole, labelled with the
//   field and its multiplicity;
// - an undetermined kind is a DASHED node saying why, never an empty box;
// - several sub-graphs are folded into a grid by invisible anchors, the
//   portrait columns of `gridLinks`, because `dot` lays unconnected clusters in
//   one row exactly as ELK does. An anchor's class is `kg-graph-anchor`, so the
//   viewer neither lists nor drags it, and it asserts nothing.

/** A DOT double-quoted string. */
function dotQ(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** Text inside a DOT HTML-like label. */
function dotH(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** The portrait grid's column count, the same formula as {@link gridLinks}. */
const gridCols = (n: number): number => Math.max(1, Math.ceil(Math.sqrt(n / 2)));

export function dot(name: string, pageUrl: string, sections: Section[], withAttrs: boolean): string {
  // Both from uml.css, as every fill below is: no colour is written here.
  const ink = PALETTE.family.edge;
  const other = PALETTE.family.other;
  if (!ink || !other) throw new Error("uml.css declares no --fa-uml-edge or --fa-uml-other: the DOT would have to invent a colour");
  const L = [
    `// GENERATED by ${GENERATOR} — do not edit.`,
    `// Rendered page (interactive view, same model): ${pageUrl}`,
    `digraph ${dotQ(safeId(name))} {`,
    `  graph [label=${dotQ(name)}, labelloc=t, fontname="Helvetica", fontsize=12, fontcolor=${dotQ(ink)}, newrank=true, ratio=auto, nodesep=0.3, ranksep=0.5, bgcolor="transparent"];`,
    `  node [shape=box, style="rounded,filled", margin=0.05, fontname="Helvetica", fontsize=10, color=${dotQ(ink)}, fontcolor=${dotQ(ink)}];`,
    `  edge [color=${dotQ(ink)}, fontcolor=${dotQ(ink)}, fontname="Helvetica", fontsize=9];`,
  ];
  /** Each sub-graph's top and bottom anchors, for the grid of sub-graphs. */
  const anchors: { top: string; bottom: string }[] = [];
  /** Layout scaffolding: drawn by nothing, listed by nothing, asserting nothing. */
  const scaffold: string[] = [];
  const invis = (a: string, b: string) => scaffold.push(`  ${dotQ(a)} -> ${dotQ(b)} [style=invis, class="kg-graph-anchor"];`);
  for (const s of sections) {
    const pkg = safeId(`pkg_${s.instance}_${s.id}`);
    L.push(`  subgraph ${dotQ(`cluster_${pkg}`)} {`);
    L.push(`    label=<<b>${dotH(`${s.instance}/${s.id}`)}</b><br/><i>«${dotH(s.kinds.join(", "))}»</i>>; style="rounded"; color=${dotQ(ink)}; class="fa_uml_subgraph";`);
    const members: string[] = [];
    for (const c of s.classes) {
      const rows = withAttrs
        ? c.attrs.map((a) =>
            a.remark
              ? `<tr><td align="left"><i>${dotH(a.name)}</i></td></tr>`
              : `<tr><td align="left">${dotH(`${a.name} [${a.mult}] : ${a.type}`)}</td></tr>`,
          )
        : [];
      const label =
        `<table border="0" cellborder="0" cellspacing="0" cellpadding="2">` +
        `<tr><td border="1" sides="b"><b>${dotH(c.title)}</b></td></tr>` +
        `<tr><td><i>«${dotH(c.source)}»</i></td></tr>${rows.join("")}</table>`;
      L.push(`    ${dotQ(c.id)} [fillcolor=${dotQ(PALETTE.kind(c.kind))}, class=${dotQ(`fa_uml_kind_${safeId(c.kind)}`)}, label=<${label}>];`);
      members.push(c.id);
    }
    for (const u of s.undetermined) {
      const id = safeId(`n_${s.instance}_${s.id}_${u.kind}`);
      const label =
        `<table border="0" cellborder="0" cellspacing="0" cellpadding="2">` +
        `<tr><td><b>${dotH(`${u.kind}: no node schema`)}</b></td></tr>` +
        `<tr><td align="left"><i>${dotH(`could not determine: ${u.reason}`)}</i></td></tr></table>`;
      L.push(`    ${dotQ(id)} [style="rounded,filled,dashed", fillcolor=${dotQ(other)}, class=${dotQ(`fa_uml_kind_${safeId(u.kind)} fa_uml_undetermined`)}, label=<${label}>];`);
      members.push(id);
    }
    // The members in a near-square grid of their own, or `dot` sets every
    // unconnected class of the sub-graph side by side on one rank.
    const cols = Math.max(1, Math.ceil(Math.sqrt(members.length)));
    for (let i = 0; i + cols < members.length; i++) invis(members[i]!, members[i + cols]!);
    if (sections.length > 1) {
      // Top and bottom anchors, so the NEXT row of sub-graphs starts below
      // the whole of this one rather than beside it.
      const top = safeId(`grid_${pkg}_top`);
      const bottom = safeId(`grid_${pkg}_bottom`);
      for (const a of [top, bottom]) L.push(`    ${dotQ(a)} [shape=point, style=invis, width=0, height=0, label="", class="kg-graph-anchor"];`);
      anchors.push({ top, bottom });
      for (const m of members.slice(0, cols)) invis(top, m);
      for (const m of members.slice(Math.max(0, members.length - cols))) invis(m, bottom);
      if (members.length === 0) invis(top, bottom);
    }
    L.push("  }");
  }
  for (const s of sections) {
    for (const c of s.compositions) {
      L.push(`  ${dotQ(c.from)} -> ${dotQ(c.to)} [dir=both, arrowtail=diamond, arrowhead=none, label=${dotQ(c.label)}, headlabel=${dotQ(c.mult)}, class="fa_uml_composition"];`);
    }
  }
  const cols = gridCols(anchors.length);
  for (let i = 0; i + cols < anchors.length; i++) invis(anchors[i]!.bottom, anchors[i + cols]!.top);
  L.push(...scaffold);
  L.push("}");
  return L.join("\n") + "\n";
}

// ── Detangle measurements ─────────────────────────────────────────────────
//
// Each sub-graph's row carries the detangle numbers for the same directory,
// so the picture and the partition metric are read together (graph-rendering
// rule 10; owner, 2026-09-23). Pinned fields only: `kg-detangle.ts` pins
// size, cohesion and the authority counts, never the verdict. The directory
// comes from `detangleResultsDir`, the same function the writer uses.

interface DetangleNumbers {
  size: number;
  cohesion: number;
  inbound: number;
  outbound: number;
}

const DETANGLE_RESULTS: string | null = (() => {
  const dir = detangleResultsDir(HARNESS);
  return existsSync(dir) ? dir : null;
})();

/**
 * Why this run cannot draw what it was asked to, one line per cause.
 *
 * Bean `oq1j`. A page drawn over QA that could not be read is not a page with
 * "not measured" in it. "Not measured" says the detangler does not scan a
 * directory, and "no node here carries a family" says a directory holds
 * none. Both would be false claims. So any cause here stops the run with
 * exit 2, in check mode and write mode alike, before anything is compared or
 * written.
 */
const UNDETERMINED: string[] = [];

/**
 * The detangle numbers COMPUTED from the tree, used when no record is pinned
 * in the checkout (`R19`): `kg-detangle.ts --check --json`, which writes
 * nothing.
 *
 * Computed, not read from the `qa-reports` branch. A stored record describes
 * the commit it was published for. On any branch that moved a group it would
 * draw the base's numbers and present them as this tree's. When the
 * detangle gate is green, the computed numbers are the pinned ones
 * (`staleFields` compares exactly these fields), so the page does not depend
 * on where they came from.
 */
let computedDetangle: Map<string, DetangleNumbers> | null | undefined;

/** Lazily, once: importing this module must not run the detangler. */
function computeDetangle(): Map<string, DetangleNumbers> | null {
  if (computedDetangle === undefined) computedDetangle = runDetangle();
  return computedDetangle;
}

function runDetangle(): Map<string, DetangleNumbers> | null {
  // Run the detangler by its package script, which is the one place its path
  // is declared; a path literal here would restate it (check:declared-paths).
  const r = spawnSync(process.execPath, ["run", "cat", "kg:detangle", "--check", "--json"], { cwd: REPO, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  try {
    const { results } = JSON.parse(r.stdout) as { results: Parameters<typeof sidecarFor>[0][] };
    return new Map(results.map((m) => [m.group, sidecarFor(m)]));
  } catch {
    UNDETERMINED.push(
      `no detangle record in the checkout (${relative(REPO, detangleResultsDir(HARNESS))}/ is absent), and computing one failed ` +
        `(exit ${r.status}): ${(r.stderr || r.stdout || "").trim().split("\n").slice(-3).join(" | ")}`,
    );
    return null;
  }
}

/** The pinned numbers for the detangle group at `path`, or null: not every directory is scanned. */
function detangleOf(path: string): DetangleNumbers | null {
  if (!DETANGLE_RESULTS) return computeDetangle()?.get(path.replace(/\/$/, "")) ?? null;
  const file = join(DETANGLE_RESULTS, `${path.replace(/\/$/, "")}.detangle.json`);
  if (!existsSync(file)) return null;
  const j = JSON.parse(readFileSync(file, "utf8")) as Partial<DetangleNumbers>;
  if ([j.size, j.cohesion, j.inbound, j.outbound].some((v) => typeof v !== "number")) {
    throw new Error(`${relative(REPO, file)}: missing a pinned detangle number`);
  }
  return j as DetangleNumbers;
}

// ── Pages ─────────────────────────────────────────────────────────────────

function page(opts: {
  title: string;
  lead: string;
  sourceBase: string;
  /** Site path of the PlantUML rendering, e.g. `/assets/img/uml/overview/bootstrap.svg`. */
  svg: string;
  /** Site path of the Graphviz DOT the Interactive view lays out, beside the SVG. */
  dot: string;
  mermaid: string;
  sections: Section[];
  links?: { label: string; href: string }[];
  /** A harness page sits in the menu under the index; a sub-graph page does not. */
  inNav?: boolean;
}): string {
  const blob = `${REPO_URL}/blob/main`;
  const L = [
    "---",
    "layout: default",
    // Says it is generated, so a consumer reads a declaration rather than
    // inferring one from `docs/uml/`. The two copies this script writes --
    // `uml/overview/` and `docs/uml/overview/` -- are the same pages, and
    // 195 of them were reporting to `check:reference-direction` as authored
    // prose naming layers above this one (2026-09-24).
    "generated: scripts/gen-uml-overview.ts — do not hand-edit",
    `title: "UML — ${opts.title}"`,
    // Menu: the index and one entry per harness. The ~85 sub-graph pages stay
    // out of it and are reached from their harness page, because a menu that
    // lists every sub-graph is a second index nobody can scan. Owner, 2026-09-23.
    ...(opts.inNav ? [`parent: "${NAV_PARENT}"`] : ["nav_exclude: true"]),
    "---",
    "",
    `# UML — ${opts.title}`,
    "",
    `Generated by \`${GENERATOR}\` — do not edit. ${opts.lead}`,
    "",
    `**Sources (same model):** [PlantUML](${blob}/${opts.sourceBase}.puml) · [Mermaid](${blob}/${opts.sourceBase}.mmd) · [Graphviz DOT]({{ '${opts.dot}' | relative_url }})`,
    "",
    // The PlantUML rendering, in the same figure markup as the BPMN diagrams,
    // so docs-ui.js gives it the same zoom and full-width controls. PlantUML
    // with ELK is the compact layout; Mermaid's dagre drew the same model as
    // a column three times taller. Owner, 2026-09-23.
    ...views(opts.svg, `UML class diagram of ${opts.title}: one package per named sub-graph, one class per node schema, with its data fields.`, {
      dot: opts.dot,
      label: `UML class diagram of ${opts.title}, laid out by Graphviz in the browser: drag a node to move it and its edges.`,
    }),
    "",
    "| sub-graph | directory | graph typologies | node schema | nodes | cohesion | in | out |",
    "|---|---|---|---|---|---|---|---|",
  ];
  for (const s of opts.sections) {
    const found = [...new Set(s.classes.map((c) => c.source.replace(/^json: /, "")))];
    const missing = s.undetermined.map((u) => `${u.kind}: *could not determine*`);
    const m = detangleOf(s.path);
    const measured = m ? `${m.size} | ${m.cohesion.toFixed(2)} | ${m.inbound} | ${m.outbound}` : "*not measured* | | |";
    L.push(`| \`${s.instance}/${s.id}\` | \`${s.path}\` | ${s.kinds.join(", ")} | ${[...found.map((f) => `\`${f}\``), ...missing].join("; ")} | ${measured} |`);
  }
  L.push(
    "",
    "*Nodes, cohesion, in and out* are the detangler's pinned measurements for the same directory (`bun run cat kg:detangle`; skill [`graph-detanglement`](https://github.com/litlfred/folio-assistant/blob/main/cat-harness/skills/kg/graph-management/graph-detanglement.md)). *Not measured* means the detangler does not scan that directory, not that it has no edges.",
  );
  if (opts.links?.length) {
    L.push("", "## Sub-graphs", "");
    for (const l of opts.links) L.push(`- [${l.label}](${l.href})`);
  }
  L.push(
    "",
    "## The same model, drawn by Mermaid",
    "",
    "Kept so the page renders even where the PlantUML image is missing, and because Mermaid nodes carry the CSS class that colours them from `uml.css`.",
    "",
    "```mermaid",
    opts.mermaid.trimEnd(),
    "```",
  );
  return L.join("\n") + "\n";
}

// ── main ──────────────────────────────────────────────────────────────────

export async function overviewFilesFor(
  roots: readonly string[] = layerRootsIn(REPO),
): Promise<{ files: Map<string, string>; instances: { name: string; sections: Section[] }[] }> {
  const files = new Map<string, string>();
  const instances: { name: string; sections: Section[] }[] = [];
  for (const root of roots) {
    const sections = await sectionsOf(root);
    if (sections.length === 0) continue;
    instances.push({ name: sections[0].instance, sections });
  }
  instances.sort((a, b) => a.name.localeCompare(b.name));

  const umlRel = relative(REPO, UML_ROOT).replace(/\\/g, "/");
  const svgSite = (base: string) => `/assets/img/uml/overview/${base}.svg`;
  // The DOT is fetched by the reader's browser, so it is published, beside the SVG it is a third view of.
  const dotSite = (base: string) => `/assets/img/uml/overview/${base}.dot`;
  for (const inst of instances) {
    const pageUrl = `${SITE_URL}/uml/overview/${inst.name}.html`;
    const overviewMmd = mmd(inst.sections, true);
    files.set(join(UML_ROOT, `${inst.name}.puml`), puml(inst.name, pageUrl, inst.sections, true));
    files.set(join(UML_ROOT, `${inst.name}.mmd`), overviewMmd);
    files.set(join(SVG_ROOT, `${inst.name}.dot`), dot(inst.name, pageUrl, inst.sections, true));
    files.set(
      join(DOCS_ROOT, `${inst.name}.md`),
      page({
        title: inst.name,
        // `instance`, not `harness`. This one template emitted "the `X`
        // harness declares" on every page, and 10 of the 22 layers it runs
        // over are NOT harnesses — declared, with no `<name>.config.json` at
        // the repository root, which is what instantiates one (`harness-tiles`,
        // bean `6n23`). Measured 2026-09-23: a single generator was the largest
        // producer of that mislabelling in the whole corpus, ten pages to one
        // word. `instance` is correct for all 22, since an instantiated one is
        // a layer too.
        lead: `Every named sub-graph the \`${inst.name}\` instance declares, one box each, with the node schema kinds found in it.`,
        sourceBase: `${umlRel}/${inst.name}`,
        svg: svgSite(inst.name),
        dot: dotSite(inst.name),
        mermaid: overviewMmd,
        sections: inst.sections,
        links: inst.sections.map((s) => ({ label: `${s.instance}/${s.id}`, href: `${inst.name}/${s.id}.html` })),
        inNav: true,
      }),
    );
    for (const s of inst.sections) {
      const base = `${inst.name}/${s.id}`;
      const sectionMmd = mmd([s], true);
      files.set(join(UML_ROOT, `${base}.puml`), puml(`${inst.name}_${s.id}`, `${SITE_URL}/uml/overview/${base}.html`, [s], true));
      files.set(join(UML_ROOT, `${base}.mmd`), sectionMmd);
      files.set(join(SVG_ROOT, `${base}.dot`), dot(`${inst.name}/${s.id}`, `${SITE_URL}/uml/overview/${base}.html`, [s], true));
      files.set(
        join(DOCS_ROOT, `${base}.md`),
        page({
          title: `${s.instance}/${s.id}`,
          lead: `The \`${s.id}\` sub-graph of \`${inst.name}\` (\`${s.path}\`), with every attribute read from its node schema.`,
          sourceBase: `${umlRel}/${base}`,
          svg: svgSite(base),
          dot: dotSite(base),
          mermaid: sectionMmd,
          sections: [s],
          links: [{ label: `← all of ${inst.name}`, href: `../${inst.name}.html` }],
        }),
      );
    }
  }
  return { files, instances };
}

async function build(): Promise<Map<string, string>> {
  const { files, instances } = await overviewFilesFor();
  files.set(SCHEMAS_PUML, schemasViewPuml(GENERATOR));
  const index = [
    "---",
    "layout: default",
    "generated: scripts/gen-uml-overview.ts — do not hand-edit",
    `title: "${NAV_PARENT}"`,
    // After the numbered top-level pages (the highest is 14 today): a
    // reference, not a first read.
    "nav_order: 15",
    "has_children: true",
    "---",
    "",
    "# UML overview",
    "",
    "## The harness schemas",
    "",
    "Schema, Role, Actor, Skill, Voice, User Story, Process, Task and Test, each box read from the schema behind it; the stereotype names which. Colours are the five families in `uml.css`. Every arrow runs from the dependent to the general node: a Task realises the Skill it implements, a Voice and a User Story point at their Role, and a Test Run is checked against its Skill's input and output schemas.",
    "",
    glossaryLinksMd(),
    "",
    `**Source:** [PlantUML](${REPO_URL}/blob/main/${relative(REPO, SCHEMAS_PUML)}) · the full model, with Bean and Todo, is [below](#the-full-object-model).`,
    "",
    ...views("/assets/img/uml/harness-schemas.svg", "UML class diagram of the harness schemas: packages scenario (Actor, Role, Skill, Voice, User Story), process (Process, Task), schema (JSON Schema, External Schema) and test (Test Run, KG QA Report), with their data fields and relationships."),
    "",
    "## The full object model",
    "",
    "The same classes plus the state family, Todo and Bean, and the edges that reach them: Task's `folio:bean` op, and Todo's tags on Role, Process, Task and Actor. Bean is read from the `beans` CLI's GraphQL schema, so this file is regenerated only where that CLI is installed (`bun run cat-harness-tools/scripts/gen-object-model-uml.ts`).",
    "",
    `**Source:** [PlantUML](${REPO_URL}/blob/main/${relative(REPO, OBJECT_MODEL_PUML)})`,
    "",
    ...views("/assets/img/uml/harness-object-model.svg", "UML class diagram of the full harness object model: the schemas diagram above plus a state package holding Todo and Bean, with their data fields and relationships."),
    "",
    "## Per harness",
    "",
    `Generated by \`${GENERATOR}\` — do not edit. One diagram per harness and one per named sub-graph it declares. Classes are read from each graph typology's node schema; colours come from \`docs/assets/css/uml.css\`.`,
    "",
    ...instances.map((i) => `- [${i.name}](${i.name}.html) — ${i.sections.length} sub-graph(s)`),
  ];
  files.set(join(DOCS_ROOT, "index.md"), index.join("\n") + "\n");
  return files;
}

/** Where each `.puml` renders to: the same relative path under {@link SVG_ROOT}. */
function svgFor(pumlPath: string): string {
  return join(SVG_ROOT, "..", relative(join(UML_ROOT, ".."), pumlPath).replace(/\.puml$/, ".svg"));
}

/** Both views of every `.puml`: the file itself, and its landscape view (`landscapeOf`). */
function jobsFor(pumls: [string, string][]): RenderJob[] {
  return pumls.flatMap(([p, text]) => bothViews(p, text, svgFor(p)));
}

/**
 * Every file under `dir` as this checkout sees it: the pinned files and those
 * a run computed at the output root, each named by its path under `dir`.
 */
export function walkOverlay(dir: string, root: string): string[] {
  const out = new Set<string>();
  for (const d of overlayDirs(dir, root)) for (const f of walk(d)) out.add(join(dir, relative(d, f)));
  return [...out];
}

/**
 * The render jobs whose SVG, as the overlay reads it, is stale, each aimed
 * at where this checkout writes it: the output root for a mounted harness.
 */
export function jobsToRender(jobs: readonly RenderJob[], root: string): RenderJob[] {
  return jobs
    .filter((j) => svgStamp(readPathAt(root, j.svg)) !== sha256(j.text))
    .map((j) => ({ ...j, svg: writePathAt(root, j.svg) }));
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

// Guarded: an import must write nothing. `declared-directory-resolves.test.ts`
// imports every module that resolves a declared directory, and an unguarded
// run rewrote the generated files on import (in CI, where the output differs).
async function main(): Promise<void> {
  const check = process.argv.includes("--check");
  // Bean `7how`: the `qa` sections are drawn from the copy on disk.
  requireCurrentWorkingCopy(REPO, "uml:overview");
  const files = await build();
  if (UNDETERMINED.length) {
    // Neither "stale" nor "current", and nothing written: a page drawn over QA
    // that could not be read would claim what nobody looked at (bean `oq1j`).
    console.error(`UML overview: UNKNOWN — could not determine what ${UNDETERMINED.length} part(s) hold; this is NOT a pass, and nothing was written:`);
    for (const u of UNDETERMINED) console.error(`  ${u}`);
    console.error("  `bun run cat qa:fetch` materialises the QA results; `--ref <main|sha|pr/n>` reads another qa-reports entry.");
    process.exit(JUDGEMENT_EXIT.unknown);
  }
  const pumls = [...files].filter(([p]) => p.endsWith(".puml"));
  if (!existsSync(OBJECT_MODEL_PUML)) throw new Error(`${relative(REPO, OBJECT_MODEL_PUML)} is missing: run gen-object-model-uml.ts`);
  pumls.push([OBJECT_MODEL_PUML, readFileSync(OBJECT_MODEL_PUML, "utf8")]);
  const jobs = jobsFor(pumls);
  const svgs = new Set(jobs.map((j) => j.svg));
  const existing = [...walkOverlay(UML_ROOT, CHECKOUT), ...walkOverlay(DOCS_ROOT, CHECKOUT), ...walkOverlay(SVG_ROOT, CHECKOUT)];
  const orphans = umlOrphans(existing, files, svgs);

  if (check) {
    // The PAGES are compared against whichever copy the declaration says is
    // authoritative — the checkout today, the branch after `xsrv`'s cutover, and
    // BOTH during the window where the same bytes live in two places on purpose.
    // `compareRoute` resolves that; a branch it cannot reach is `unknown`, which
    // is neither stale nor a pass (bean `xsrv` Done-when 3).
    //
    // Keyed by the DIRECTORY ID, so flipping the cutover is a declaration edit
    // and not a change here. With no `storage` set anywhere in this repository
    // today, this is the on-disk comparison it replaces, file for file —
    // asserted in `route-authority.test.ts` rather than claimed.
    const pages = new Map(
      [...files].filter(([p]) => p.startsWith(`${DOCS_ROOT}/`)).map(([p, t]) => [relative(REPO, p).split(sep).join("/"), t]),
    );
    const verdict = compareRoute("uml-overview-pages", pages, REPO);
    if (verdict.state === "unknown") {
      // Said as its own sentence. "Could not determine" and "stale" send a reader
      // to different places, and collapsing them is the `1xhc` shape.
      console.error(`COULD NOT DETERMINE whether the UML overview pages are current: ${verdict.reason}`);
      console.error(`  authority: ${verdict.authority} — nothing was compared, so this is not a pass.`);
      process.exit(4);
    }
    for (const d of verdict.drift ?? []) console.error(`drift: ${d} differs between the checkout and the branch`);

    // Everything OUTSIDE the pages — the .puml model and the SVGs — stays an
    // on-disk comparison: neither is a published route, so neither is route-keyed.
    const stale = [...files]
      .filter(([p]) => !p.startsWith(`${DOCS_ROOT}/`))
      .filter(([p, text]) => {
        const at = readPathAt(CHECKOUT, p);
        return !existsSync(at) || readFileSync(at, "utf8") !== text;
      })
      .map(([p]) => p);
    for (const j of jobs) if (svgStamp(readPathAt(CHECKOUT, j.svg)) !== sha256(j.text)) stale.push(j.svg);
    const stalePages = verdict.stale.map((r) => join(REPO, r));
    if (stale.length || stalePages.length || orphans.length || (verdict.drift?.length ?? 0) > 0) {
      for (const p of [...stalePages, ...stale]) console.error(`stale: ${relative(REPO, p)}`);
      for (const p of orphans) console.error(`orphan: ${relative(REPO, p)}`);
      console.error(`run: bun run ${GENERATOR}`);
      process.exit(1);
    }
    console.log(`UML overview is current — ${files.size} file(s), pages read from the ${verdict.authority}`);
  } else {
    // Removed, and written, where this run writes: an orphan left in a pinned
    // mount stays until the layer is re-pinned, since a run never edits a mount.
    let pinnedOrphans = 0;
    for (const p of orphans) {
      const at = writePathAt(CHECKOUT, p);
      if (existsSync(at)) rmSync(at);
      if (at !== p && existsSync(p)) pinnedOrphans++;
    }
    if (pinnedOrphans) console.log(`${pinnedOrphans} orphan(s) in the pinned mount left until the layer is re-pinned`);
    for (const [p, text] of files) {
      const at = writePathAt(CHECKOUT, p);
      mkdirSync(dirname(at), { recursive: true });
      writeFileSync(at, text);
    }
    console.log(`wrote ${files.size} file(s) under ${relative(REPO, UML_ROOT)} and ${relative(REPO, DOCS_ROOT)}${orphans.length ? `; removed ${orphans.length} orphan(s)` : ""}`);
    const r = await renderSvgs(jobsToRender(jobs, CHECKOUT), { repo: REPO, generator: GENERATOR });
    if (r.skipped) {
      // Not a pass: the pages would show stale pictures, and --check says so.
      console.error(`SVGs NOT rendered (${r.skipped}); set PLANTUML_JAR or install java, then re-run`);
      process.exit(2);
    }
    console.log(`rendered ${r.rendered} SVG(s) under ${relative(REPO, SVG_ROOT)}`);
  }
}

/**
 * Files under the generator's roots that this run does not write: the pages
 * and diagrams of a layer or section that no longer exists (bean `ghgn`).
 * Only this generator's own kinds of output count, so a file a person put
 * there is never an orphan.
 *
 * ## A directory README is never this generator's output
 *
 * `docs/uml/overview/` and `docs/assets/img/uml/overview/` are DECLARED
 * directories (`docs/docs.json`: `uml-overview-pages`, `uml-overview-svgs`),
 * and every declared directory carries a README written by
 * `readme:subgraphs` — the rule {@link isDirectoryReadme} states for every
 * collector. This generator writes no `README.md`, so one under its roots is
 * another writer's, by the docblock above. Before PR #2094 the nested
 * declaration was not admitted, no README was written there, and `.md` caught
 * nothing it should not; once it was, the two writers never converged — this
 * one deleted the README as an orphan, `readme:subgraphs` wrote it back, and
 * each `--check` reported the other's output as stale or orphaned. Skipping it
 * here rather than in `readme:subgraphs` keeps the README rule in the one
 * place it is declared, and survives `xsrv`'s move of the pages to a
 * route-keyed branch: a stored directory is skipped by `readme:subgraphs`
 * (`isStored`), so there is then simply no README to skip.
 */
export function umlOrphans(existing: readonly string[], written: ReadonlyMap<string, string> | ReadonlySet<string>, svgs: ReadonlySet<string>): string[] {
  return existing.filter((p) => !written.has(p) && !svgs.has(p) && !isDirectoryReadme(p) && /\.(puml|mmd|md|svg|dot)$/.test(p));
}

if (import.meta.main) await main();
