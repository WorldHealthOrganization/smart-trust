/**
 * The ArchiMate harness's shapes: what a layer declares, and how an Archi
 * model becomes nodes — the model, each of its views, elements and
 * relationships — with an IRI each.
 *
 * @module cat-harness/archimate/schemas/archimate
 * @graphNode schema
 * @conformsTo opengroup-archimate-3.0
 *
 * ## The node is the model; views, elements and relationships are nodes inside it
 *
 * The `openapi` subgraph's shape, applied to an ArchiMate model (owner,
 * 2026-10-09: *"need new specialixed harness (like openapi) for archimate
 * content in the KG"*). A directory of graph typology `archimate` holds Archi
 * models, one node each, and every view, element and relationship in a model
 * is a node of its own: `<…>/<model>/<views|elements|relationships>/<id>.jsonld`,
 * with its rendering — a thin page — at `<…>/<id>/`.
 *
 * ## Ids are the model's own
 *
 * Archi gives every object an id (`id-<32 hex>`), and those ids are what a
 * mapping, a comment or another model already cites — the RA mapper keys its
 * mappings on them, so they survive a change of version. They are used as
 * they are; one that is not filename-safe is refused rather than rewritten,
 * because a rewritten id is an IRI nobody chose.
 *
 * ## What is read, and what is not
 *
 * Archi's native format (`.archimate`): plain XML, or the zipped archive Archi
 * writes when a model holds images, whose `model.xml` is the same XML. The
 * Open Group exchange format is not read yet. Of a diagram, what a picture
 * needs: each object's bounds made ABSOLUTE (Archi nests a child's bounds in
 * its parent's), its fill colour where one is set, groups, notes, and each
 * connection with its relative bendpoints. Custom images, fonts and
 * figure alternates beyond the first are not read; a view drawn without them
 * is still the view.
 */
import { inflateRawSync } from "node:zlib";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";

/** A model id and every object id: one path segment, filename-safe. */
const SEGMENT = /^[A-Za-z0-9._-]+$/;

/**
 * `cat-archimate.config.json` — at the layer's root, or inside the
 * directory it declares with graph typology `archimate`; the root wins. It
 * names each model the layer holds, by its file inside that directory.
 *
 * Unlike an OpenAPI document, an ArchiMate model is usually AUTHORED where it
 * is held (smart-ra's are drawn in Archi and committed), so a model is named
 * by its `file` in place. Ingesting one from another repository is a later
 * addition and would add a `source`, as the openapi config has.
 */
export const ARCHIMATE_CONFIG_SCHEMA_TAG = "cat-archimate-config/v1";
export const ArchimateConfigModelSchema = z
  .object({
    /** The model's id: its page directory and its IRI segment. A version (`0.2.0`) is a good one. */
    id: z.string().regex(SEGMENT),
    /** The `.archimate` file, relative to the declared directory. */
    file: z
      .string()
      .regex(/\.archimate$/, "an Archi .archimate file")
      .refine((f) => !f.startsWith("/") && !f.split("/").includes(".."), "relative to the declared directory, without `..`"),
    /** What a reader calls it. Absent, the model's own name is used. */
    title: z.string().min(1).optional(),
    /** One sentence on what this model is and why the layer holds it. */
    description: z.string().min(1).optional(),
  })
  .strict();
/**
 * A figure in the layer's document that IS a view of a model: the link
 * between the picture a reader sees in the prose and the view it was taken
 * from. `archimate-check` fails when the block or the view is gone, so a
 * figure cannot silently drift from the model; `archimate-pages` names the
 * figure on the view's page. Owner, 2026-10-31: "i dont really like native
 * UML, rather derived".
 */
export const ArchimateConfigFigureSchema = z
  .object({
    /** The document block holding the figure, relative to the layer root. */
    block: z
      .string()
      .regex(/\.md$/, "a document block, a .md file")
      .refine((f) => !f.startsWith("/") && !f.split("/").includes(".."), "relative to the instance root, without `..`"),
    /** What the document calls it, e.g. `Figure 3.7.1`. */
    label: z.string().min(1),
    /** The model's id, as in `models`. */
    model: z.string().regex(SEGMENT),
    /** The view's Archi id. */
    view: z.string().min(1),
    /**
     * How the match was made: `same-elements` when the figure shows exactly
     * the view's elements, `by-eye` when a person compared the two pictures.
     */
    basis: z.enum(["same-elements", "by-eye"]),
    /**
     * Where `archimate-blocks` writes the view as SVG, relative to the
     * layer root, so the block can show the model's own drawing instead of
     * a picture of it. Absent, the figure is only linked to the view.
     */
    svg: z
      .string()
      .regex(/\.svg$/, "an .svg file")
      .refine((f) => !f.startsWith("/") && !f.split("/").includes(".."), "relative to the instance root, without `..`")
      .optional(),
  })
  .strict();
export type ArchimateConfigFigure = z.infer<typeof ArchimateConfigFigureSchema>;

/** What an `archimate-blocks` table is drawn from. */
export const ARCHIMATE_TABLE_KINDS = ["relationship-types", "relationship-rules"] as const;

/**
 * A table in the layer's document that is drawn from data, never typed:
 * `archimate-blocks` rewrites the table in `block` and leaves the caption and
 * anything after the table alone. `--check` fails when the block and the data
 * disagree, so the table cannot drift.
 *
 * - `relationship-rules`: the rules file's `rules`, one row each (source,
 *   relationship, target, note).
 * - `relationship-types`: the rules file's `relationships` that carry a
 *   `meaning`, one row each (icon, name, meaning).
 */
export const ArchimateConfigTableSchema = z
  .object({
    /** The document block holding the table, relative to the layer root. */
    block: z
      .string()
      .regex(/\.md$/, "a document block, a .md file")
      .refine((f) => !f.startsWith("/") && !f.split("/").includes(".."), "relative to the instance root, without `..`"),
    /** What the document calls it, e.g. `Table 3.3`. */
    label: z.string().min(1),
    kind: z.enum(ARCHIMATE_TABLE_KINDS),
    /** The `archimate-relationship-rules/v1` file, relative to the archimate directory. */
    rules: z
      .string()
      .regex(/\.json$/, "a .json file")
      .refine((f) => !f.startsWith("/") && !f.split("/").includes(".."), "relative to the archimate directory, without `..`"),
    /** The model whose relationships are checked against the rules (`archimate-blocks --check`). */
    model: z.string().regex(SEGMENT).optional(),
  })
  .strict();
export type ArchimateConfigTable = z.infer<typeof ArchimateConfigTableSchema>;

export const ArchimateConfigSchema = z
  .object({
    $schema: z.literal(ARCHIMATE_CONFIG_SCHEMA_TAG),
    /** The `<instance>.json` directory id of graph typology `archimate` the models are held in. */
    directory: z.string().min(1),
    models: z.array(ArchimateConfigModelSchema).min(1),
    /** The document's figures that are views of these models. */
    figures: z.array(ArchimateConfigFigureSchema).optional(),
    /** The document's tables that are drawn from data (`archimate-blocks`). */
    tables: z.array(ArchimateConfigTableSchema).optional(),
    /**
     * How banded views are drawn as posters (`render-poster.ts`): the element
     * property holding a card's short text, the property that stars a card,
     * and the words for a star. Absent, the poster defaults apply.
     */
    poster: z
      .object({
        noteProperty: z.string().min(1).optional(),
        starProperty: z.string().min(1).optional(),
        starLabel: z.string().min(1).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((c, ctx) => {
    const seen = new Set<string>();
    for (const [i, m] of c.models.entries()) {
      if (seen.has(m.id)) ctx.addIssue({ code: "custom", path: ["models", i, "id"], message: `model id "${m.id}" is declared twice` });
      seen.add(m.id);
    }
    const blocks = new Set<string>();
    for (const [i, f] of (c.figures ?? []).entries()) {
      if (!seen.has(f.model)) ctx.addIssue({ code: "custom", path: ["figures", i, "model"], message: `figure "${f.label}" names model "${f.model}", which \`models\` does not declare` });
      if (blocks.has(f.block)) ctx.addIssue({ code: "custom", path: ["figures", i, "block"], message: `block ${f.block} is mapped twice` });
      blocks.add(f.block);
    }
    for (const [i, t] of (c.tables ?? []).entries()) {
      if (t.model !== undefined && !seen.has(t.model)) ctx.addIssue({ code: "custom", path: ["tables", i, "model"], message: `table "${t.label}" names model "${t.model}", which \`models\` does not declare` });
      if (blocks.has(t.block)) ctx.addIssue({ code: "custom", path: ["tables", i, "block"], message: `block ${t.block} is mapped twice` });
      blocks.add(t.block);
    }
  });
export type ArchimateConfig = z.infer<typeof ArchimateConfigSchema>;

// ── The layers ───────────────────────────────────────────────────────────

/** ArchiMate 3's layers and aspects, as a reader groups elements. */
export const ARCHIMATE_LAYERS = ["Strategy", "Business", "Application", "Technology", "Physical", "Motivation", "Implementation & Migration", "Other"] as const;
export type ArchimateLayer = (typeof ARCHIMATE_LAYERS)[number];

/** The layer an element type belongs to (ArchiMate 3.2, §3–§13). */
export function layerOf(type: string): ArchimateLayer {
  if (/^(Resource|Capability|ValueStream|CourseOfAction)$/.test(type)) return "Strategy";
  if (/^Business|^(Contract|Representation|Product)$/.test(type)) return "Business";
  if (/^Application|^DataObject$/.test(type)) return "Application";
  if (/^Technology|^(Node|Device|SystemSoftware|Path|CommunicationNetwork|Artifact)$/.test(type)) return "Technology";
  if (/^(Equipment|Facility|DistributionNetwork|Material)$/.test(type)) return "Physical";
  if (/^(Stakeholder|Driver|Assessment|Goal|Outcome|Principle|Requirement|Constraint|Meaning|Value)$/.test(type)) return "Motivation";
  if (/^(WorkPackage|Deliverable|ImplementationEvent|Plateau|Gap)$/.test(type)) return "Implementation & Migration";
  return "Other";
}

// ── The normalised model ─────────────────────────────────────────────────
//
// What `readArchimate` reads a model into, as Zod: the family
// `archimate-model/v1`, which no file carries. It is DERIVED, held only in
// memory from an `.archimate` file, and registered (`derived: true` on the
// `archimate` kind) so the harness UML overview draws Model, Element,
// Relationship and View from it (owner, 2026-10-31: "rather derived"; smart-ra#166 D2).

/** The family the normalised model is registered under. Its validator node is cat-harness's `archimate/validators/archimate-model.json`. */
export const ARCHIMATE_MODEL_TAG = "archimate-model/v1";

export const ArchimatePropertySchema = z.object({ key: z.string(), value: z.string() }).strict().describe("Property");
export type ArchimateProperty = z.infer<typeof ArchimatePropertySchema>;

export const ArchimateElementSchema = z
  .object({
    id: z.string().min(1),
    /** The ArchiMate type without Archi's prefix: `ApplicationComponent`. */
    type: z.string().min(1),
    name: z.string(),
    layer: z.enum(ARCHIMATE_LAYERS),
    documentation: z.string().optional(),
    properties: z.array(ArchimatePropertySchema),
    /** The folder path it is filed under in the model tree. */
    folder: z.array(z.string()),
  })
  .strict()
  .describe("Element");
export type ArchimateElement = z.infer<typeof ArchimateElementSchema>;

export const ArchimateRelationshipSchema = z
  .object({
    id: z.string().min(1),
    /** The relationship type without prefix or suffix: `Composition`, `Serving`. */
    type: z.string().min(1),
    /** An element's id, or another relationship's. */
    source: z.string().min(1),
    target: z.string().min(1),
    name: z.string().optional(),
    documentation: z.string().optional(),
    /** Access only: `write` (Archi's default), `read`, `access` or `readwrite`. */
    accessType: z.enum(["write", "read", "access", "readwrite"]).optional(),
    /** Association only. */
    directed: z.boolean().optional(),
    /** Influence only: the strength, e.g. `+` or `--`. */
    strength: z.string().optional(),
    properties: z.array(ArchimatePropertySchema),
  })
  .strict()
  .describe("Relationship");
export type ArchimateRelationship = z.infer<typeof ArchimateRelationshipSchema>;

/** A box on a diagram, its bounds absolute. */
export const ArchimateViewNodeSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(["element", "group", "note", "view-ref"]),
    /** The element it shows (`element`), or the view it refers to (`view-ref`). */
    ref: z.string().optional(),
    /** A group's label, or a note's text. */
    text: z.string().optional(),
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
    /** The diagram object it is drawn inside, if any. */
    parent: z.string().optional(),
    fill: z.string().optional(),
    /** Archi's `type="1"`: the element drawn as its figure's alternate. */
    alternate: z.boolean().optional(),
  })
  .strict()
  .describe("ViewNode");
export type ArchimateViewNode = z.infer<typeof ArchimateViewNodeSchema>;

/** A line on a diagram. Its ends are diagram ids — a node's, or another connection's. */
export const ArchimateViewConnectionSchema = z
  .object({
    id: z.string().min(1),
    /** The relationship it shows; absent for a plain line between a note and a box. */
    relationship: z.string().optional(),
    source: z.string().min(1),
    target: z.string().min(1),
    /** Archi's relative bendpoints: offsets from the source's and the target's centres. */
    bendpoints: z.array(z.object({ startX: z.number(), startY: z.number(), endX: z.number(), endY: z.number() }).strict()),
  })
  .strict()
  .describe("ViewConnection");
export type ArchimateViewConnection = z.infer<typeof ArchimateViewConnectionSchema>;

export const ArchimateViewSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    viewpoint: z.string().optional(),
    documentation: z.string().optional(),
    /** The view's own properties — a `slug` one chooses its page path (`slugs.ts`). */
    properties: z.array(ArchimatePropertySchema),
    folder: z.array(z.string()),
    nodes: z.array(ArchimateViewNodeSchema),
    connections: z.array(ArchimateViewConnectionSchema),
  })
  .strict()
  .describe("View");
export type ArchimateView = z.infer<typeof ArchimateViewSchema>;

export const ArchimateModelSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    /** Archi's model `version` attribute — the tool's file version, not the model's. */
    archiVersion: z.string().optional(),
    documentation: z.string().optional(),
    properties: z.array(ArchimatePropertySchema),
    elements: z.array(ArchimateElementSchema),
    relationships: z.array(ArchimateRelationshipSchema),
    views: z.array(ArchimateViewSchema),
  })
  .strict()
  .describe("Model");
export type ArchimateModel = z.infer<typeof ArchimateModelSchema>;

// ── Reading the bytes ────────────────────────────────────────────────────

/**
 * One entry of a zip archive, by name — the central directory read, the
 * entry stored (0) or deflated (8). Enough for Archi's archive format and no
 * more: no zip64, no encryption, which Archi does not write.
 */
export function zipEntry(buf: Buffer, name: string): Buffer | undefined {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a zip archive: no end-of-central-directory record");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("corrupt zip central directory");
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const entry = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    if (entry === name) {
      const dataAt = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(dataAt, dataAt + size);
      if (method === 0) return Buffer.from(data);
      if (method === 8) return inflateRawSync(data);
      throw new Error(`zip entry ${name}: compression method ${method} is not supported`);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return undefined;
}

/** The model XML a `.archimate` file holds: the file itself, or `model.xml` inside Archi's archive. */
export function modelXmlOf(bytes: Buffer): string {
  if (bytes.length >= 4 && bytes.readUInt32LE(0) === 0x04034b50) {
    const xml = zipEntry(bytes, "model.xml");
    if (!xml) throw new Error("an Archi archive with no model.xml");
    return xml.toString("utf8");
  }
  return bytes.toString("utf8");
}

const ARRAYS = new Set(["folder", "element", "child", "sourceConnection", "property", "bendpoint", "feature", "purpose"]);
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  textNodeName: "#text",
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: false,
  // Archi writes a line break inside a value as `&#xD;`: decode it, never show it.
  htmlEntities: true,
  isArray: (name) => ARRAYS.has(name),
});

type X = Record<string, unknown>;
const arr = (v: unknown): X[] => (Array.isArray(v) ? (v as X[]) : []);
const str = (v: unknown): string | undefined => {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "object") return str((v as X)["#text"]);
  const s = String(v).trim();
  return s === "" ? undefined : s;
};
const xsiType = (x: X): string => String(x["@xsi:type"] ?? "").replace(/^archimate:/, "");
const props = (x: X): ArchimateProperty[] =>
  arr(x.property).map((p) => ({ key: String(p["@key"] ?? ""), value: String(p["@value"] ?? "") }));
const ACCESS = ["write", "read", "access", "readwrite"] as const;

function checkId(id: unknown, what: string): string {
  const s = String(id ?? "");
  if (!SEGMENT.test(s)) throw new Error(`${what} has an id that is not filename-safe: "${s}"`);
  return s;
}

/** Archi's default size for an object whose bounds say `-1`. */
const DEFAULT_W = 120;
const DEFAULT_H = 55;

/** Parse Archi's native model XML into the normalised model. */
export function parseArchimate(xml: string): ArchimateModel {
  const doc = parser.parse(xml) as X;
  const root = doc["archimate:model"] as X | undefined;
  if (!root) throw new Error("not an Archi model: no <archimate:model> root");
  const model: ArchimateModel = {
    id: checkId(root["@id"], "the model"),
    name: String(root["@name"] ?? ""),
    ...(root["@version"] ? { archiVersion: String(root["@version"]) } : {}),
    ...(str(arr(root.purpose)[0]) ? { documentation: str(arr(root.purpose)[0]) } : {}),
    properties: props(root),
    elements: [],
    relationships: [],
    views: [],
  };

  const walkFolder = (folder: X, path: string[]) => {
    for (const e of arr(folder.element)) {
      const type = xsiType(e);
      const id = checkId(e["@id"], `${type} "${e["@name"] ?? ""}"`);
      const documentation = str(e.documentation);
      if (type === "ArchimateDiagramModel" || type === "SketchModel" || type === "CanvasModel") {
        if (type !== "ArchimateDiagramModel") continue;
        model.views.push(readView(e, id, path, documentation));
      } else if (type.endsWith("Relationship")) {
        const accessType = e["@accessType"] !== undefined ? ACCESS[Number(e["@accessType"])] : undefined;
        model.relationships.push({
          id,
          type: type.replace(/Relationship$/, ""),
          source: checkId(e["@source"], `relationship ${id}'s source`),
          target: checkId(e["@target"], `relationship ${id}'s target`),
          ...(str(e["@name"]) ? { name: str(e["@name"]) } : {}),
          ...(documentation ? { documentation } : {}),
          ...(type === "AccessRelationship" ? { accessType: accessType ?? "write" } : {}),
          ...(type === "AssociationRelationship" ? { directed: e["@directed"] === "true" } : {}),
          ...(type === "InfluenceRelationship" && str(e["@strength"]) ? { strength: str(e["@strength"]) } : {}),
          properties: props(e),
        });
      } else {
        model.elements.push({
          id,
          type,
          name: String(e["@name"] ?? ""),
          layer: layerOf(type),
          ...(documentation ? { documentation } : {}),
          properties: props(e),
          folder: path,
        });
      }
    }
    for (const f of arr(folder.folder)) walkFolder(f, [...path, String(f["@name"] ?? "")]);
  };
  for (const f of arr(root.folder)) walkFolder(f, [String(f["@name"] ?? "")]);
  return model;
}

function readView(e: X, id: string, folder: string[], documentation: string | undefined): ArchimateView {
  const view: ArchimateView = {
    id,
    name: String(e["@name"] ?? ""),
    ...(str(e["@viewpoint"]) ? { viewpoint: str(e["@viewpoint"]) } : {}),
    ...(documentation ? { documentation } : {}),
    properties: props(e),
    folder,
    nodes: [],
    connections: [],
  };
  const walk = (children: X[], ox: number, oy: number, parent: string | undefined) => {
    for (const c of children) {
      const type = xsiType(c);
      const cid = checkId(c["@id"], `a diagram object in view "${view.name}"`);
      const b = (arr(c.bounds)[0] ?? (c.bounds as X | undefined) ?? {}) as X;
      const x = ox + Number(b["@x"] ?? 0);
      const y = oy + Number(b["@y"] ?? 0);
      const w = Number(b["@width"] ?? -1);
      const h = Number(b["@height"] ?? -1);
      const node: ArchimateViewNode = {
        id: cid,
        kind: "element",
        x,
        y,
        w: w > 0 ? w : DEFAULT_W,
        h: h > 0 ? h : DEFAULT_H,
        ...(parent ? { parent } : {}),
        ...(str(c["@fillColor"]) ? { fill: str(c["@fillColor"]) } : {}),
      };
      if (type === "DiagramObject") {
        node.ref = String(c["@archimateElement"] ?? "");
        if (c["@type"] === "1") node.alternate = true;
      } else if (type === "Group") {
        node.kind = "group";
        node.text = String(c["@name"] ?? "");
      } else if (type === "Note") {
        node.kind = "note";
        node.text = str(c.content) ?? "";
      } else if (type === "DiagramModelReference") {
        node.kind = "view-ref";
        node.ref = String(c["@model"] ?? "");
      } else {
        continue;
      }
      view.nodes.push(node);
      for (const s of arr(c.sourceConnection)) {
        view.connections.push({
          id: checkId(s["@id"], `a connection in view "${view.name}"`),
          ...(s["@archimateRelationship"] ? { relationship: String(s["@archimateRelationship"]) } : {}),
          source: String(s["@source"] ?? cid),
          target: String(s["@target"] ?? ""),
          bendpoints: arr(s.bendpoint).map((p) => ({
            startX: Number(p["@startX"] ?? 0),
            startY: Number(p["@startY"] ?? 0),
            endX: Number(p["@endX"] ?? 0),
            endY: Number(p["@endY"] ?? 0),
          })),
        });
      }
      walk(arr(c.child), x, y, cid);
    }
  };
  walk(arr(e.child), 0, 0, undefined);
  return view;
}

/** Read a `.archimate` file's bytes into the normalised model. */
export function readArchimate(bytes: Buffer): ArchimateModel {
  return parseArchimate(modelXmlOf(bytes));
}
