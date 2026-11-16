/**
 * Derived UML data class diagrams and sequence diagrams from an ArchiMate model
 * (and optional FSH Logical Models and BPMN processes): smart-ra#166 D5.
 *
 * @graphNode schema
 * @module cat-harness/archimate/schemas/diagrams
 * @conformsTo opengroup-archimate-3.0
 * @covers archimate
 *
 * Owner, 2026-10-31: *"i dont really like native UML, rather derived"*, then
 * *"make mechanical tools as parts of skills/processes"*.
 *
 * Two kinds of UML diagrams are derived here from the architecture model:
 *
 * 1. **Data class diagrams (`archimate-data-model/v1`)** — from `DataObject`
 *    and `BusinessObject` elements tagged with `logical-model` (and matched
 *    against FSH `Logical:` definitions when the IG holds them), or connected
 *    by data-to-data relationships (`Composition`, `Aggregation`,
 *    `Specialization`, `Realization`, `Association`) or carrying structured
 *    attributes (such as `CDE-HWR` in `0.2.0` and the Product Master Data
 *    hierarchy `Product Classification`, `Generic Product`, `Trade Item`,
 *    `Regulated Trade Item` in `0.3.0-draft.1`).
 *
 * 2. **Sequence diagrams (`archimate-sequences/v1`)** — from
 *    `ApplicationInteraction` / `BusinessInteraction` elements and
 *    cross-component `Flow` / `Triggering` relationship chains in the model's
 *    views (and model-wide), plus cross-lane / cross-pool handoffs in BPMN 2.0
 *    processes when provided.
 */
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import { type ArchimateElement, type ArchimateModel, type ArchimateRelationship, type ArchimateView } from "./archimate.ts";
import { isPlaceholder, typeName, verbOf } from "./metamodel.ts";

/** The Archi property naming the logical model (canonical URL or FSH id) that defines a data object's fields. */
export const LOGICAL_MODEL_PROPERTY = "logical-model";

/** ArchiMate element types that represent data or information structures and may carry `logical-model`. */
export const DATA_ELEMENT_TYPES = new Set<string>([
  "DataObject",
  "BusinessObject",
  "Representation",
  "Contract",
  "Artifact",
]);

/** Primary data/business object types drawn as classes in a derived data model. */
const CORE_DATA_TYPES = new Set<string>(["DataObject", "BusinessObject", "Representation"]);

/** Relationship types that connect classes in a derived data model. */
const DATA_REL_TYPES = new Set<string>([
  "Composition",
  "Aggregation",
  "Specialization",
  "Realization",
  "Association",
  "Flow",
  "Access",
]);

export const FshLogicalFieldSchema = z
  .object({
    name: z.string().min(1),
    cardinality: z.string().min(1).optional(),
    type: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
  })
  .strict();
export type FshLogicalField = z.infer<typeof FshLogicalFieldSchema>;

export const FshLogicalModelSchema = z
  .object({
    name: z.string().min(1),
    id: z.string().min(1),
    title: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    parent: z.string().min(1).optional(),
    fields: z.array(FshLogicalFieldSchema),
  })
  .strict();
export type FshLogicalModel = z.infer<typeof FshLogicalModelSchema>;

export const DataAttributeSchema = z
  .object({
    name: z.string().min(1),
    type: z.string().min(1).optional(),
    cardinality: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    source: z.enum(["logical-model", "property", "documentation"]),
  })
  .strict();
export type DataAttribute = z.infer<typeof DataAttributeSchema>;

export const DataAccessSchema = z
  .object({
    elementId: z.string().min(1),
    name: z.string().min(1),
    type: z.string().min(1),
    relationshipId: z.string().min(1),
    kind: z.enum(["read", "write", "access", "readwrite", "association"]),
    label: z.string().min(1).optional(),
  })
  .strict();
export type DataAccess = z.infer<typeof DataAccessSchema>;

export const DataClassSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    type: z.string().min(1),
    documentation: z.string().min(1).optional(),
    logicalModel: z.string().min(1).optional(),
    skosConcept: z.string().min(1).optional(),
    attributes: z.array(DataAttributeSchema),
    accessedBy: z.array(DataAccessSchema),
  })
  .strict();
export type DataClass = z.infer<typeof DataClassSchema>;

export const DataRelationshipSchema = z
  .object({
    id: z.string().min(1),
    source: z.string().min(1),
    target: z.string().min(1),
    type: z.string().min(1),
    name: z.string().min(1).optional(),
    role: z.string().min(1).optional(),
    cardinality: z.string().min(1).optional(),
  })
  .strict();
export type DataRelationship = z.infer<typeof DataRelationshipSchema>;

export const DATA_MODEL_SCHEMA_TAG = "archimate-data-model/v1";
export const DataModelSchema = z
  .object({
    $schema: z.literal(DATA_MODEL_SCHEMA_TAG),
    model: z.string().min(1),
    name: z.string().min(1),
    classes: z.array(DataClassSchema),
    relationships: z.array(DataRelationshipSchema),
    problems: z.array(z.string()),
  })
  .strict();
export type DataModel = z.infer<typeof DataModelSchema>;

const collapseWs = (s: string): string => s.replace(/\s+/g, " ").trim();

/**
 * Parse FSH `Logical:` definitions into structured models and fields so a
 * `DataObject` tagged `logical-model = <id or canonical>` gets its fields
 * directly from the FSH source.
 */
export function parseFshLogicalModels(fsh: string): FshLogicalModel[] {
  const models: FshLogicalModel[] = [];
  let cur: FshLogicalModel | undefined;
  for (const raw of fsh.split(/\r?\n/)) {
    const line = raw.replace(/\/\/.*$/, "").trim();
    if (!line) continue;
    const mLog = /^Logical:\s*(\S+)$/.exec(line);
    if (mLog) {
      if (cur) models.push(cur);
      cur = { name: mLog[1]!, id: mLog[1]!, fields: [] };
      continue;
    }
    if (/^(Profile|Extension|Instance|ValueSet|CodeSystem|RuleSet|Invariant|Mapping):\s*\S+/.test(line)) {
      if (cur) models.push(cur);
      cur = undefined;
      continue;
    }
    if (!cur) continue;
    const mId = /^Id:\s*(\S+)$/.exec(line);
    if (mId) {
      cur.id = mId[1]!;
      continue;
    }
    const mParent = /^Parent:\s*(\S+)$/.exec(line);
    if (mParent) {
      cur.parent = mParent[1]!;
      continue;
    }
    const mTitle = /^Title:\s*"((?:[^"\\]|\\.)*)"$/.exec(line);
    if (mTitle) {
      cur.title = mTitle[1]!.replace(/\\"/g, '"');
      continue;
    }
    const mDesc = /^Description:\s*"((?:[^"\\]|\\.)*)"$/.exec(line);
    if (mDesc) {
      cur.description = mDesc[1]!.replace(/\\"/g, '"');
      continue;
    }
    // Field declaration: `* <path> <min>..<max> [flags] <type> "<short>" ["<definition>"]`
    const mField = /^\*\s+([A-Za-z0-9_.[\]]+)\s+(\d+\.\.(?:\d+|\*))(?:(?:\s+(?:MS|SU|\?!|N|TU|D))*)\s+([^\s"]+(?:\([^)]*\))?)\s*(?:"((?:[^"\\]|\\.)*)")?/.exec(line);
    if (mField) {
      cur.fields.push({
        name: mField[1]!,
        cardinality: mField[2]!,
        type: mField[3]!,
        ...(mField[4] ? { description: mField[4].replace(/\\"/g, '"') } : {}),
      });
    }
  }
  if (cur) models.push(cur);
  return models;
}

/**
 * Split a relationship name like `"classification 0..*"` or
 * `"contains 0..* (packaging hierarchy)"` into `{ role, cardinality }`.
 */
export function parseRelationshipCardinality(name?: string): { role?: string; cardinality?: string } {
  if (!name) return {};
  const clean = collapseWs(name);
  if (!clean) return {};
  const m = /^(.*?)\s*(\b\d+\.\.(?:\d+|\*)|\b\*)\s*(.*)$/.exec(clean);
  if (!m) return { role: clean };
  const role = collapseWs(`${m[1] ?? ""} ${m[3] ?? ""}`);
  return {
    ...(role ? { role } : {}),
    cardinality: m[2]!,
  };
}

/**
 * Extract numbered core data elements from an element's documentation when the
 * author enumerated them in prose (e.g. `CDE-HWR` in smart-ra 0.2.0:
 * `1. Named demographics (name, sex, date of birth).`).
 */
export function extractDocAttributes(documentation?: string): DataAttribute[] {
  if (!documentation) return [];
  const out: DataAttribute[] = [];
  for (const raw of documentation.split(/\r?\n/)) {
    const m = /^\s*\d+\.\s+([^:(\n.]+?)(?:\s*(?::\s*([^\n]+)|\(([^)\n]+)\)\.?\s*))?\.?\s*$/.exec(raw);
    if (!m) continue;
    const name = collapseWs(m[1]!);
    const desc = collapseWs(m[2] ?? m[3] ?? "");
    if (!name || name.length > 80) continue;
    out.push({
      name,
      ...(desc ? { description: desc.replace(/\.$/, "") } : {}),
      source: "documentation",
    });
  }
  return out;
}

function matchLogicalModel(tag: string, models: FshLogicalModel[]): FshLogicalModel | undefined {
  const clean = tag.trim();
  const tail = clean.split("/").pop()?.split("#").pop() ?? clean;
  return models.find(
    (m) =>
      m.id.toLowerCase() === clean.toLowerCase() ||
      m.name.toLowerCase() === clean.toLowerCase() ||
      m.id.toLowerCase() === tail.toLowerCase() ||
      m.name.toLowerCase() === tail.toLowerCase(),
  );
}

/**
 * Derive the data class diagram of an ArchiMate model (`archimate-data-model/v1`).
 */
export function dataModelOf(
  model: ArchimateModel,
  modelId = model.id,
  opts: { logicalModels?: FshLogicalModel[]; includeIsolated?: boolean } = {},
): DataModel {
  const problems: string[] = [];
  const seenTags = new Map<string, string>();
  const tagOf = new Map<string, string>();

  for (const e of model.elements) {
    for (const p of e.properties.filter((x) => x.key === LOGICAL_MODEL_PROPERTY)) {
      const val = p.value.trim();
      if (!val) {
        problems.push(`${e.id} "${collapseWs(e.name)}": ${LOGICAL_MODEL_PROPERTY} is empty`);
      } else if (!DATA_ELEMENT_TYPES.has(e.type)) {
        problems.push(`${e.id} "${collapseWs(e.name)}": a ${e.type} cannot carry ${LOGICAL_MODEL_PROPERTY} (expected DataObject, BusinessObject, Representation, Contract or Artifact)`);
      } else if (seenTags.has(val)) {
        problems.push(`${e.id} "${collapseWs(e.name)}": ${LOGICAL_MODEL_PROPERTY}="${val}" is already on ${seenTags.get(val)}`);
      } else {
        seenTags.set(val, e.id);
        tagOf.set(e.id, val);
      }
    }
  }

  const byId = new Map(model.elements.map((e) => [e.id, e]));
  const isCandidate = (e: ArchimateElement): boolean =>
    !isPlaceholder(e) && (CORE_DATA_TYPES.has(e.type) || tagOf.has(e.id));

  const candidates = model.elements.filter(isCandidate);
  const candidateIds = new Set(candidates.map((e) => e.id));

  // Relationships between candidate data/business objects.
  const relationships: DataRelationship[] = [];
  const connectedIds = new Set<string>();
  for (const r of model.relationships) {
    if (!candidateIds.has(r.source) || !candidateIds.has(r.target)) continue;
    if (!DATA_REL_TYPES.has(r.type)) continue;
    connectedIds.add(r.source);
    connectedIds.add(r.target);
    const cardProp = r.properties.find((p) => p.key === "cardinality")?.value.trim();
    const parsed = parseRelationshipCardinality(r.name);
    const name = r.name ? collapseWs(r.name) : undefined;
    relationships.push({
      id: r.id,
      source: r.source,
      target: r.target,
      type: r.type,
      ...(name ? { name } : {}),
      ...(parsed.role ? { role: parsed.role } : {}),
      ...(cardProp ?? parsed.cardinality ? { cardinality: cardProp ?? parsed.cardinality } : {}),
    });
  }

  const fshModels = opts.logicalModels ?? [];
  const attrsOf = (e: ArchimateElement): DataAttribute[] => {
    const out: DataAttribute[] = [];
    const tag = tagOf.get(e.id);
    const lm = tag ? matchLogicalModel(tag, fshModels) : matchLogicalModel(collapseWs(e.name), fshModels);
    if (lm) {
      for (const f of lm.fields) {
        out.push({
          name: f.name,
          ...(f.type ? { type: f.type } : {}),
          ...(f.cardinality ? { cardinality: f.cardinality } : {}),
          ...(f.description ? { description: f.description } : {}),
          source: "logical-model",
        });
      }
    }
    for (const p of e.properties) {
      if (p.key === "attribute" || p.key === "field") {
        const val = collapseWs(p.value);
        if (val) out.push({ name: val, source: "property" });
      } else if (p.key.startsWith("attribute:") || p.key.startsWith("field:")) {
        const name = p.key.slice(p.key.indexOf(":") + 1).trim();
        const type = collapseWs(p.value);
        if (name) out.push({ name, ...(type ? { type } : {}), source: "property" });
      }
    }
    if (out.length === 0) {
      out.push(...extractDocAttributes(e.documentation));
    }
    return out;
  };

  // Access and governance associations from non-data elements (components, services, roles).
  const accessFor = (dataId: string): DataAccess[] => {
    const out: DataAccess[] = [];
    for (const r of model.relationships) {
      if (r.type === "Access" && (r.target === dataId || r.source === dataId)) {
        const otherId = r.target === dataId ? r.source : r.target;
        const other = byId.get(otherId);
        if (!other || isPlaceholder(other) || candidateIds.has(otherId)) continue;
        out.push({
          elementId: other.id,
          name: collapseWs(other.name),
          type: other.type,
          relationshipId: r.id,
          kind: r.accessType ?? "access",
          ...(r.name ? { label: collapseWs(r.name) } : {}),
        });
      } else if (r.type === "Association" && r.name && (r.target === dataId || r.source === dataId)) {
        const otherId = r.target === dataId ? r.source : r.target;
        const other = byId.get(otherId);
        if (!other || isPlaceholder(other) || candidateIds.has(otherId)) continue;
        out.push({
          elementId: other.id,
          name: collapseWs(other.name),
          type: other.type,
          relationshipId: r.id,
          kind: "association",
          label: collapseWs(r.name),
        });
      }
    }
    return out;
  };

  const classes: DataClass[] = [];
  for (const e of candidates) {
    const attributes = attrsOf(e);
    const tagged = tagOf.get(e.id);
    if (!opts.includeIsolated && !tagged && attributes.length === 0 && !connectedIds.has(e.id)) {
      continue;
    }
    const skos = e.properties.find((p) => p.key === "skosConcept")?.value.trim();
    classes.push({
      id: e.id,
      name: collapseWs(e.name),
      type: e.type,
      ...(e.documentation?.trim() ? { documentation: e.documentation.trim() } : {}),
      ...(tagged ? { logicalModel: tagged } : {}),
      ...(skos ? { skosConcept: skos } : {}),
      attributes,
      accessedBy: accessFor(e.id),
    });
  }

  // Also infer relationships from FSH `Reference(Target)` fields between included classes.
  const classByLm = new Map<string, DataClass>();
  for (const c of classes) {
    if (c.logicalModel) {
      const tail = c.logicalModel.split("/").pop()?.split("#").pop() ?? c.logicalModel;
      classByLm.set(c.logicalModel.toLowerCase(), c);
      classByLm.set(tail.toLowerCase(), c);
    }
    classByLm.set(c.name.toLowerCase(), c);
  }
  for (const c of classes) {
    for (const a of c.attributes) {
      if (a.source !== "logical-model" || !a.type) continue;
      const mRef = /^Reference\(([^)]+)\)$/.exec(a.type) ?? /^([A-Za-z0-9_.-]+)$/.exec(a.type);
      if (!mRef) continue;
      for (const refTarget of mRef[1]!.split(/\s*\|\s*/)) {
        const targetClass = classByLm.get(refTarget.trim().toLowerCase());
        if (!targetClass || targetClass.id === c.id) continue;
        const already = relationships.some(
          (r) => r.source === c.id && r.target === targetClass.id && (r.role === a.name || r.name === a.name),
        );
        if (!already) {
          relationships.push({
            id: `fsh-${c.id}-${a.name}-${targetClass.id}`,
            source: c.id,
            target: targetClass.id,
            type: "Association",
            name: a.cardinality ? `${a.name} ${a.cardinality}` : a.name,
            role: a.name,
            ...(a.cardinality ? { cardinality: a.cardinality } : {}),
          });
        }
      }
    }
  }

  classes.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  relationships.sort((a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target) || a.id.localeCompare(b.id));

  return {
    $schema: DATA_MODEL_SCHEMA_TAG,
    model: modelId,
    name: model.name,
    classes,
    relationships,
    problems,
  };
}

const pumlId = (id: string): string => id.replace(/[^A-Za-z0-9_]/g, "_");
const dq = (s: string): string => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;

const PUML_CLASS_ARROW: Record<string, string> = {
  Composition: "*--",
  Aggregation: "o--",
  Specialization: "--|>",
  Realization: "..|>",
  Association: "-->",
  Flow: "..>",
  Access: "..>",
};

const MERMAID_CLASS_ARROW: Record<string, string> = {
  Composition: "*--",
  Aggregation: "o--",
  Specialization: "--|>",
  Realization: "..|>",
  Association: "-->",
  Flow: "..>",
  Access: "..>",
};

/** Render a derived {@link DataModel} as a PlantUML class diagram. */
export function dataModelPuml(dm: DataModel): string {
  const lines = [
    "@startuml",
    `' ${dm.name} (${dm.model}): data class diagram, derived by archimate-diagrams. Do not edit.`,
    "skinparam classAttributeIconSize 0",
    "hide empty members",
  ];
  for (const c of dm.classes) {
    const stereotype = c.logicalModel ? `<<${c.type}>> <<${c.logicalModel}>>` : `<<${c.type}>>`;
    if (c.attributes.length === 0) {
      lines.push(`class ${dq(c.name)} as ${pumlId(c.id)} ${stereotype}`);
    } else {
      lines.push(`class ${dq(c.name)} as ${pumlId(c.id)} ${stereotype} {`);
      for (const a of c.attributes) {
        const typeStr = a.type ? ` : ${a.type}` : "";
        const cardStr = a.cardinality ? ` [${a.cardinality}]` : "";
        lines.push(`  +${a.name}${typeStr}${cardStr}`);
      }
      lines.push("}");
    }
  }
  for (const r of dm.relationships) {
    const arrow = PUML_CLASS_ARROW[r.type] ?? "-->";
    const card = r.cardinality ? ` ${dq(r.cardinality)}` : "";
    const label = r.role ?? r.name ?? verbOf(r.type);
    lines.push(`${pumlId(r.source)} ${arrow}${card} ${pumlId(r.target)} : ${label}`);
  }
  lines.push("@enduml");
  return `${lines.join("\n")}\n`;
}

/** Render a derived {@link DataModel} as a Mermaid `classDiagram`. */
export function dataModelMermaid(dm: DataModel): string {
  const lines = [
    "classDiagram",
    `  %% ${dm.name} (${dm.model}): data class diagram, derived by archimate-diagrams. Do not edit.`,
  ];
  for (const c of dm.classes) {
    const id = pumlId(c.id);
    lines.push(`  class ${id}[${dq(c.name)}]`);
    lines.push(`  <<${c.type}>> ${id}`);
    for (const a of c.attributes) {
      const typeStr = a.type ? `${a.type} ` : "";
      const cardStr = a.cardinality ? ` [${a.cardinality}]` : "";
      lines.push(`  ${id} : +${typeStr}${a.name}${cardStr}`);
    }
  }
  for (const r of dm.relationships) {
    const arrow = MERMAID_CLASS_ARROW[r.type] ?? "-->";
    const card = r.cardinality ? ` ${dq(r.cardinality)}` : "";
    const label = (r.role ?? r.name ?? verbOf(r.type)).replace(/:/g, " -");
    lines.push(`  ${pumlId(r.source)} ${arrow}${card} ${pumlId(r.target)} : ${label}`);
  }
  return `${lines.join("\n")}\n`;
}

/** Render a derived {@link DataModel} as Graphviz DOT (for SVG layout on the metamodel/UML page). */
export function dataModelDot(
  dm: DataModel,
  opts: { href?: { element: (id: string) => string; relationship: (id: string) => string } } = {},
): string {
  const link = (url: string | undefined, tip: string): string =>
    url ? `, URL=${dq(url)}, target="_top", tooltip=${dq(tip)}` : "";
  const lines = [
    `digraph ${dq(`${dm.name} — data model`)} {`,
    `  graph [rankdir=LR, fontname="Helvetica", fontsize=11, nodesep=0.5, ranksep=1.1];`,
    `  node [shape=box, style="filled", fontname="Helvetica", fontsize=10, margin="0.14,0.08"];`,
    `  edge [fontname="Helvetica", fontsize=9, color="#555555", fontcolor="#333333"];`,
  ];
  for (const c of dm.classes) {
    const fill = c.type === "BusinessObject" ? "#ffffb5" : "#b5ffff";
    const head = `«${typeName(c.type)}»\n${c.name}${c.logicalModel ? `\n[${c.logicalModel}]` : ""}`;
    const attrs = c.attributes.length
      ? `\n—\n${c.attributes.map((a) => `• ${a.name}${a.type ? `: ${a.type}` : ""}${a.cardinality ? ` [${a.cardinality}]` : ""}`).join("\n")}`
      : "";
    lines.push(
      `  ${dq(c.id)} [label=${dq(`${head}${attrs}`)}, fillcolor=${dq(fill)}${link(opts.href?.element(c.id), `${c.name} (${typeName(c.type)})`)}];`,
    );
  }
  for (const r of dm.relationships) {
    const lbl = r.role
      ? `${r.role}${r.cardinality ? ` [${r.cardinality}]` : ""}`
      : r.name ?? verbOf(r.type);
    const style =
      r.type === "Composition"
        ? `dir=both, arrowtail=diamond, arrowhead=vee`
        : r.type === "Aggregation"
          ? `dir=both, arrowtail=odiamond, arrowhead=vee`
          : r.type === "Specialization"
            ? `arrowhead=onormal`
            : r.type === "Realization"
              ? `style=dashed, arrowhead=onormal`
              : `arrowhead=vee`;
    lines.push(
      `  ${dq(r.source)} -> ${dq(r.target)} [label=${dq(lbl)}, ${style}${link(opts.href?.relationship(r.id), lbl)}];`,
    );
  }
  lines.push("}");
  return `${lines.join("\n")}\n`;
}

/** Render a derived {@link DataModel} as a Markdown section with Mermaid diagram and tables. */
export function dataModelMarkdown(dm: DataModel): string {
  const nameOf = new Map(dm.classes.map((c) => [c.id, c.name]));
  const lines = [
    `## Data Class Diagram (${dm.name})`,
    "",
    `Derived from ArchiMate model \`${dm.model}\` (${dm.classes.length} data/business object class(es), ${dm.relationships.length} relationship(s)).`,
    "",
  ];
  if (dm.classes.length === 0) {
    lines.push("_No data class hierarchy or `logical-model`-tagged elements in this model._", "");
    return lines.join("\n");
  }
  lines.push("```mermaid", dataModelMermaid(dm).trimEnd(), "```", "");
  lines.push("| Class | Type | Logical model | Attributes | Accessed / governed by |", "|---|---|---|---|---|");
  for (const c of dm.classes) {
    const attrs = c.attributes.length
      ? c.attributes.map((a) => `\`${a.name}\`${a.type ? ` (${a.type})` : ""}${a.cardinality ? ` [${a.cardinality}]` : ""}`).join(", ")
      : "—";
    const acc = c.accessedBy.length
      ? c.accessedBy.map((a) => `${a.name} (${a.label ?? a.kind})`).join(", ")
      : "—";
    lines.push(`| **${c.name}** | ${typeName(c.type)} | ${c.logicalModel ? `\`${c.logicalModel}\`` : "—"} | ${attrs} | ${acc} |`);
  }
  if (dm.relationships.length > 0) {
    lines.push("", "| Source | Relationship | Target | Role / Cardinality |", "|---|---|---|---|");
    for (const r of dm.relationships) {
      const roleCard = [r.role, r.cardinality ? `[${r.cardinality}]` : undefined].filter(Boolean).join(" ") || r.name || "—";
      lines.push(`| ${nameOf.get(r.source) ?? r.source} | ${verbOf(r.type)} | ${nameOf.get(r.target) ?? r.target} | ${roleCard} |`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

// ── Sequence Diagrams ────────────────────────────────────────────────────────

export const SequenceParticipantSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    type: z.string().min(1),
    elementId: z.string().min(1).optional(),
  })
  .strict();
export type SequenceParticipant = z.infer<typeof SequenceParticipantSchema>;

export const SequenceMessageKindSchema = z.enum([
  "triggering",
  "flow",
  "interaction",
  "serving",
  "access",
  "bpmn-flow",
  "bpmn-message",
]);
export type SequenceMessageKind = z.infer<typeof SequenceMessageKindSchema>;

export const SequenceMessageSchema = z
  .object({
    from: z.string().min(1),
    to: z.string().min(1),
    label: z.string().min(1),
    kind: SequenceMessageKindSchema,
    relationshipId: z.string().min(1).optional(),
    interactionId: z.string().min(1).optional(),
  })
  .strict();
export type SequenceMessage = z.infer<typeof SequenceMessageSchema>;

export const SequenceDiagramSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    source: z.enum(["view", "interaction", "flow", "bpmn"]),
    viewId: z.string().min(1).optional(),
    participants: z.array(SequenceParticipantSchema),
    messages: z.array(SequenceMessageSchema),
  })
  .strict();
export type SequenceDiagram = z.infer<typeof SequenceDiagramSchema>;

export const SEQUENCE_SET_SCHEMA_TAG = "archimate-sequences/v1";
export const SequenceSetSchema = z
  .object({
    $schema: z.literal(SEQUENCE_SET_SCHEMA_TAG),
    model: z.string().min(1),
    name: z.string().min(1),
    sequences: z.array(SequenceDiagramSchema),
  })
  .strict();
export type SequenceSet = z.infer<typeof SequenceSetSchema>;

const STRATEGY_TYPES = new Set<string>(["Resource", "Capability", "ValueStream", "CourseOfAction"]);
const INTERACTION_TYPES = new Set<string>(["ApplicationInteraction", "BusinessInteraction", "TechnologyInteraction"]);
const ACTIVE_PARTICIPANT_TYPES = new Set<string>([
  "ApplicationComponent",
  "ApplicationCollaboration",
  "ApplicationInterface",
  "ApplicationService",
  "ApplicationFunction",
  "ApplicationProcess",
  "BusinessActor",
  "BusinessRole",
  "BusinessCollaboration",
  "BusinessInterface",
  "BusinessProcess",
  "BusinessFunction",
  "BusinessService",
  "Product",
  "Node",
  "Device",
  "SystemSoftware",
  "TechnologyCollaboration",
  "TechnologyInterface",
  "TechnologyService",
  "Stakeholder",
]);

/**
 * Resolve an `ApplicationInteraction` / `BusinessInteraction` element into
 * ordered sequence messages between its triggering processes/actors and its
 * assigned components/actors.
 */
function messagesForInteraction(
  interaction: ArchimateElement,
  rels: ArchimateRelationship[],
  byId: Map<string, ArchimateElement>,
  view?: ArchimateView,
): SequenceMessage[] {
  const out: SequenceMessage[] = [];
  const xOf = new Map<string, number>();
  if (view) {
    for (const n of view.nodes) {
      if (n.kind === "element" && n.ref && !xOf.has(n.ref)) xOf.set(n.ref, n.x);
    }
  }

  // Active elements assigned to (or composing/aggregating) the interaction.
  const assigned: Array<{ el: ArchimateElement; rel: ArchimateRelationship }> = [];
  for (const r of rels) {
    if (
      (r.type === "Assignment" || r.type === "Composition" || r.type === "Aggregation") &&
      r.target === interaction.id
    ) {
      const s = byId.get(r.source);
      if (s && !isPlaceholder(s) && !INTERACTION_TYPES.has(s.type)) {
        assigned.push({ el: s, rel: r });
      }
    }
  }

  // Determine which assigned component is the initiator (sender) and which is the responder:
  // 1) If component B realizes a service S that serves component A, A initiates and B responds.
  // 2) Else if a component is realized by "System Under Test", it initiates.
  // 3) Else order left-to-right by x coordinate in the view, then by name.
  const servesPair = new Set<string>();
  const serviceLabel = new Map<string, { service: ArchimateElement; relId: string }>();
  for (const a of assigned) {
    for (const b of assigned) {
      if (a.el.id === b.el.id) continue;
      for (const r1 of rels) {
        if (r1.type !== "Realization" || r1.source !== b.el.id) continue;
        const svc = byId.get(r1.target);
        if (!svc) continue;
        for (const r2 of rels) {
          if (r2.type === "Serving" && r2.source === svc.id && r2.target === a.el.id) {
            servesPair.add(`${a.el.id}->${b.el.id}`);
            serviceLabel.set(`${b.el.id}->${a.el.id}`, { service: svc, relId: r2.id });
          }
        }
      }
    }
  }

  const realizedBySut = new Set<string>();
  for (const r of rels) {
    if (r.type === "Realization") {
      const s = byId.get(r.source);
      if (s && /system under test/i.test(s.name)) realizedBySut.add(r.target);
    }
  }

  assigned.sort((a, b) => {
    if (servesPair.has(`${a.el.id}->${b.el.id}`)) return -1;
    if (servesPair.has(`${b.el.id}->${a.el.id}`)) return 1;
    if (realizedBySut.has(a.el.id) && !realizedBySut.has(b.el.id)) return -1;
    if (realizedBySut.has(b.el.id) && !realizedBySut.has(a.el.id)) return 1;
    const xa = xOf.get(a.el.id) ?? Number.MAX_SAFE_INTEGER;
    const xb = xOf.get(b.el.id) ?? Number.MAX_SAFE_INTEGER;
    if (xa !== xb) return xa - xb;
    return a.el.name.localeCompare(b.el.name);
  });

  // Triggering elements leading into the interaction (e.g. Role -> Process -> Interaction).
  const triggers = rels.filter((r) => r.type === "Triggering" && r.target === interaction.id);
  const initiator = assigned[0]?.el;
  for (const tr of triggers) {
    const trigEl = byId.get(tr.source);
    if (!trigEl || isPlaceholder(trigEl)) continue;
    // Check if a BusinessRole / BusinessActor is assigned to trigEl:
    for (const ar of rels) {
      if (ar.type === "Assignment" && ar.target === trigEl.id) {
        const actor = byId.get(ar.source);
        if (actor && !isPlaceholder(actor)) {
          out.push({
            from: actor.id,
            to: trigEl.id,
            label: collapseWs(ar.name || trigEl.name),
            kind: "triggering",
            relationshipId: ar.id,
            interactionId: interaction.id,
          });
        }
      }
    }
    if (initiator && initiator.id !== trigEl.id) {
      out.push({
        from: trigEl.id,
        to: initiator.id,
        label: collapseWs(tr.name || `triggers ${interaction.name}`),
        kind: "triggering",
        relationshipId: tr.id,
        interactionId: interaction.id,
      });
    } else if (!initiator) {
      out.push({
        from: trigEl.id,
        to: interaction.id,
        label: collapseWs(tr.name || interaction.name),
        kind: "triggering",
        relationshipId: tr.id,
        interactionId: interaction.id,
      });
    }
  }

  if (assigned.length >= 2) {
    const sender = assigned[0]!;
    for (const responder of assigned.slice(1)) {
      out.push({
        from: sender.el.id,
        to: responder.el.id,
        label: collapseWs(interaction.name),
        kind: "interaction",
        relationshipId: responder.rel.id,
        interactionId: interaction.id,
      });
      const reply = serviceLabel.get(`${responder.el.id}->${sender.el.id}`);
      if (reply) {
        out.push({
          from: responder.el.id,
          to: sender.el.id,
          label: collapseWs(reply.service.name),
          kind: "serving",
          relationshipId: reply.relId,
          interactionId: interaction.id,
        });
      }
    }
  } else if (assigned.length === 1) {
    // Outgoing flows or triggers from the interaction itself to another element.
    for (const r of rels) {
      if ((r.type === "Flow" || r.type === "Triggering") && r.source === interaction.id) {
        const t = byId.get(r.target);
        if (t && !isPlaceholder(t)) {
          out.push({
            from: assigned[0]!.el.id,
            to: t.id,
            label: collapseWs(r.name || interaction.name),
            kind: r.type === "Flow" ? "flow" : "triggering",
            relationshipId: r.id,
            interactionId: interaction.id,
          });
        }
      }
    }
  }

  return out;
}

function buildParticipants(
  messages: SequenceMessage[],
  byId: Map<string, ArchimateElement>,
): SequenceParticipant[] {
  const seen = new Set<string>();
  const list: SequenceParticipant[] = [];
  const add = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    const e = byId.get(id);
    list.push({
      id,
      name: e ? collapseWs(e.name) : id,
      type: e?.type ?? "ApplicationComponent",
      ...(e ? { elementId: e.id } : {}),
    });
  };
  for (const m of messages) {
    add(m.from);
    add(m.to);
  }
  return list;
}

/**
 * Derive sequence diagrams from an ArchiMate model (`archimate-sequences/v1`),
 * plus any BPMN 2.0 XML diagrams passed in `opts.bpmn`.
 */
export function sequencesOf(
  model: ArchimateModel,
  modelId = model.id,
  opts: { bpmn?: Array<{ id?: string; title?: string; xml: string }>; includeStrategy?: boolean } = {},
): SequenceSet {
  const byId = new Map(model.elements.map((e) => [e.id, e]));
  const relById = new Map(model.relationships.map((r) => [r.id, r]));
  const sequences: SequenceDiagram[] = [];
  const coveredRels = new Set<string>();
  const coveredInteractions = new Set<string>();

  const allowDynamicRel = (r: ArchimateRelationship): boolean => {
    if (r.type !== "Flow" && r.type !== "Triggering") return false;
    const s = byId.get(r.source);
    const t = byId.get(r.target);
    if (!s || !t || isPlaceholder(s) || isPlaceholder(t)) return false;
    if (!opts.includeStrategy && STRATEGY_TYPES.has(s.type) && STRATEGY_TYPES.has(t.type)) return false;
    return true;
  };

  // 1. View-scoped sequence diagrams.
  for (const v of model.views) {
    const viewRels: ArchimateRelationship[] = [];
    const seenRel = new Set<string>();
    for (const c of v.connections) {
      if (!c.relationship || seenRel.has(c.relationship)) continue;
      const r = relById.get(c.relationship);
      if (r) {
        seenRel.add(r.id);
        viewRels.push(r);
      }
    }
    const viewElementIds = new Set(
      v.nodes.filter((n) => n.kind === "element" && n.ref && byId.has(n.ref)).map((n) => n.ref!),
    );
    const interactions = [...viewElementIds]
      .map((id) => byId.get(id)!)
      .filter((e) => INTERACTION_TYPES.has(e.type) && !isPlaceholder(e));

    const messages: SequenceMessage[] = [];
    const usedInInteraction = new Set<string>();

    for (const inter of interactions) {
      const ims = messagesForInteraction(inter, viewRels, byId, v);
      if (ims.length > 0) {
        coveredInteractions.add(inter.id);
        for (const m of ims) {
          if (m.relationshipId) {
            usedInInteraction.add(m.relationshipId);
            coveredRels.add(m.relationshipId);
          }
          messages.push(m);
        }
      }
    }

    const dynRels = viewRels.filter((r) => allowDynamicRel(r) && !usedInInteraction.has(r.id));
    for (const r of dynRels) {
      const s = byId.get(r.source)!;
      const t = byId.get(r.target)!;
      if (INTERACTION_TYPES.has(s.type) || INTERACTION_TYPES.has(t.type)) continue;
      coveredRels.add(r.id);
      messages.push({
        from: s.id,
        to: t.id,
        label: collapseWs(r.name || (r.type === "Flow" ? `flows to ${t.name}` : `triggers ${t.name}`)),
        kind: r.type === "Flow" ? "flow" : "triggering",
        relationshipId: r.id,
      });
    }

    // When a view has dynamic flow steps (e.g. Track and Trace Fig. 24), append
    // any connected data Access or actor Serving steps drawn on the same view.
    if (dynRels.length > 0) {
      for (const r of viewRels) {
        if (usedInInteraction.has(r.id)) continue;
        const s = byId.get(r.source);
        const t = byId.get(r.target);
        if (!s || !t || isPlaceholder(s) || isPlaceholder(t)) continue;
        if (r.type === "Access" && CORE_DATA_TYPES.has(t.type)) {
          const verb =
            r.accessType === "write"
              ? "writes"
              : r.accessType === "read"
                ? "reads"
                : r.accessType === "readwrite"
                  ? "reads/writes"
                  : "accesses";
          messages.push({
            from: s.id,
            to: t.id,
            label: collapseWs(r.name || `${verb} ${t.name}`),
            kind: "access",
            relationshipId: r.id,
          });
        } else if (
          r.type === "Serving" &&
          (t.type === "BusinessRole" || t.type === "BusinessActor" || t.type === "Stakeholder")
        ) {
          messages.push({
            from: s.id,
            to: t.id,
            label: collapseWs(r.name || `serves ${t.name}`),
            kind: "serving",
            relationshipId: r.id,
          });
        }
      }
    }

    if (messages.length > 0) {
      sequences.push({
        id: v.id,
        title: collapseWs(v.name || v.id),
        source: interactions.length > 0 && dynRels.length === 0 ? "interaction" : "view",
        viewId: v.id,
        participants: buildParticipants(messages, byId),
        messages,
      });
    }
  }

  // 2. Model-level ApplicationInteraction / BusinessInteraction elements not on any view.
  for (const e of model.elements) {
    if (!INTERACTION_TYPES.has(e.type) || isPlaceholder(e) || coveredInteractions.has(e.id)) continue;
    const ims = messagesForInteraction(e, model.relationships, byId);
    if (ims.length > 0) {
      for (const m of ims) if (m.relationshipId) coveredRels.add(m.relationshipId);
      sequences.push({
        id: e.id,
        title: collapseWs(e.name || e.id),
        source: "interaction",
        participants: buildParticipants(ims, byId),
        messages: ims,
      });
    }
  }

  // 3. Remaining cross-element Flow / Triggering relationships not covered by any view.
  const leftoverDyn = model.relationships.filter(
    (r) =>
      allowDynamicRel(r) &&
      !coveredRels.has(r.id) &&
      !INTERACTION_TYPES.has(byId.get(r.source)?.type ?? "") &&
      !INTERACTION_TYPES.has(byId.get(r.target)?.type ?? "") &&
      (ACTIVE_PARTICIPANT_TYPES.has(byId.get(r.source)?.type ?? "") ||
        ACTIVE_PARTICIPANT_TYPES.has(byId.get(r.target)?.type ?? "")),
  );
  if (leftoverDyn.length > 0) {
    const msgs: SequenceMessage[] = leftoverDyn.map((r) => {
      const s = byId.get(r.source)!;
      const t = byId.get(r.target)!;
      return {
        from: s.id,
        to: t.id,
        label: collapseWs(r.name || (r.type === "Flow" ? `flows to ${t.name}` : `triggers ${t.name}`)),
        kind: r.type === "Flow" ? "flow" : "triggering",
        relationshipId: r.id,
      };
    });
    sequences.push({
      id: `${modelId}-flows`,
      title: `${model.name} — Cross-Component Flows`,
      source: "flow",
      participants: buildParticipants(msgs, byId),
      messages: msgs,
    });
  }

  // 4. Optional BPMN 2.0 collaboration and cross-lane handoffs.
  for (const b of opts.bpmn ?? []) {
    sequences.push(...sequencesFromBpmn(b.xml, { id: b.id, title: b.title, model }));
  }

  return {
    $schema: SEQUENCE_SET_SCHEMA_TAG,
    model: modelId,
    name: model.name,
    sequences,
  };
}

type X = Record<string, unknown>;
const asArray = (v: unknown): X[] => (Array.isArray(v) ? (v as X[]) : v && typeof v === "object" ? [v as X] : []);
const asStrings = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String) : v !== undefined && v !== null ? [String(v)] : [];

const BPMN_XML = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  removeNSPrefix: true,
  trimValues: false,
  parseTagValue: false,
  parseAttributeValue: false,
});

/**
 * Derive sequence diagram(s) from BPMN 2.0 XML collaborations and cross-lane
 * sequence-flow handoffs, linking lanes/participants to matching ArchiMate
 * elements when `opts.model` is provided.
 */
export function sequencesFromBpmn(
  xml: string,
  opts: { id?: string; title?: string; model?: ArchimateModel } = {},
): SequenceDiagram[] {
  const doc = BPMN_XML.parse(xml) as X;
  const defs = (doc["definitions"] as X | undefined) ?? doc;
  const processes = asArray(defs["process"]);
  const collaborations = asArray(defs["collaboration"]);
  const resources = new Map<string, string>();
  for (const r of asArray(defs["resource"])) {
    if (r["@id"] && r["@name"]) resources.set(String(r["@id"]), collapseWs(String(r["@name"])));
  }

  // Match a BPMN lane/participant name or ref against an ArchiMate element.
  const matchElement = (name: string, ref?: string): ArchimateElement | undefined => {
    if (!opts.model) return undefined;
    const norm = (s: string) => collapseWs(s).toLowerCase();
    const target = norm(name);
    for (const e of opts.model.elements) {
      if (isPlaceholder(e)) continue;
      if (ref && (e.id === ref || e.properties.some((p) => p.value.trim() === ref))) return e;
      if (norm(e.name) === target) return e;
      if (e.properties.some((p) => (p.key === "fhir-actor" || p.key === "altLabel") && norm(p.value) === target)) return e;
    }
    return undefined;
  };

  interface BpmnNode {
    id: string;
    name: string;
    kind: "start" | "end" | "task" | "gateway";
    laneId?: string;
  }

  const nodes = new Map<string, BpmnNode>();
  const laneOfNode = new Map<string, string>();
  const participantMap = new Map<string, SequenceParticipant>();
  const seqFlows: Array<{ id: string; source: string; target: string; name?: string }> = [];

  const registerParticipant = (id: string, name: string, ref?: string, defaultType = "BusinessRole") => {
    if (participantMap.has(id)) return;
    const matched = matchElement(name, ref);
    participantMap.set(id, {
      id,
      name: collapseWs(name || id),
      type: matched?.type ?? defaultType,
      ...(matched ? { elementId: matched.id } : {}),
    });
  };

  const procToParticipant = new Map<string, string>();
  for (const col of collaborations) {
    for (const p of asArray(col["participant"])) {
      const pid = String(p["@id"] ?? "");
      const pname = String(p["@name"] ?? pid);
      const pref = p["@processRef"] ? String(p["@processRef"]) : undefined;
      if (pid) {
        registerParticipant(pid, pname, pref, "ApplicationComponent");
        if (pref) procToParticipant.set(pref, pid);
      }
    }
  }

  for (const proc of processes) {
    const procId = String(proc["@id"] ?? "process");
    const poolId = procToParticipant.get(procId);
    for (const ls of asArray(proc["laneSet"])) {
      for (const lane of asArray(ls["lane"])) {
        const lid = String(lane["@id"] ?? "");
        const partRef = lane["@partitionElementRef"] ? String(lane["@partitionElementRef"]) : undefined;
        const lname = String(lane["@name"] ?? (partRef ? resources.get(partRef) : undefined) ?? lid);
        registerParticipant(lid, lname, partRef, "BusinessRole");
        for (const fn of asStrings(lane["flowNodeRef"])) {
          laneOfNode.set(fn.trim(), lid);
        }
      }
    }

    const addNodes = (tag: string, kind: BpmnNode["kind"]) => {
      for (const n of asArray(proc[tag])) {
        const nid = String(n["@id"] ?? "");
        if (!nid) continue;
        const lid = laneOfNode.get(nid) ?? poolId;
        nodes.set(nid, {
          id: nid,
          name: collapseWs(String(n["@name"] ?? nid)),
          kind,
          ...(lid ? { laneId: lid } : {}),
        });
      }
    };
    addNodes("startEvent", "start");
    addNodes("endEvent", "end");
    for (const t of ["task", "userTask", "serviceTask", "sendTask", "receiveTask", "manualTask", "businessRuleTask", "scriptTask", "callActivity", "subProcess"]) {
      addNodes(t, "task");
    }
    for (const g of ["exclusiveGateway", "parallelGateway", "inclusiveGateway", "eventBasedGateway", "complexGateway"]) {
      addNodes(g, "gateway");
    }

    for (const sf of asArray(proc["sequenceFlow"])) {
      const id = String(sf["@id"] ?? "");
      const source = String(sf["@sourceRef"] ?? "");
      const target = String(sf["@targetRef"] ?? "");
      const name = sf["@name"] ? collapseWs(String(sf["@name"])) : undefined;
      if (source && target) seqFlows.push({ id, source, target, ...(name ? { name } : {}) });
    }
  }

  const messages: SequenceMessage[] = [];
  const outgoing = new Map<string, typeof seqFlows>();
  for (const sf of seqFlows) {
    const list = outgoing.get(sf.source) ?? [];
    list.push(sf);
    outgoing.set(sf.source, list);
  }

  // Resolve cross-lane sequenceFlows (direct or through 1..2 gateways).
  for (const sf of seqFlows) {
    const src = nodes.get(sf.source);
    const tgt = nodes.get(sf.target);
    if (!src || !tgt || src.kind === "gateway") continue;
    if (tgt.kind !== "gateway") {
      if (src.laneId && tgt.laneId && src.laneId !== tgt.laneId) {
        const label = sf.name ? `${src.name} [${sf.name}] → ${tgt.name}` : `${src.name} → ${tgt.name}`;
        messages.push({
          from: src.laneId,
          to: tgt.laneId,
          label,
          kind: "bpmn-flow",
          ...(sf.id ? { relationshipId: sf.id } : {}),
        });
      }
    } else {
      // Walk through gateway(s) to the next non-gateway activity/event.
      const queue: Array<{ gw: BpmnNode; branchLabels: string[]; flowId: string }> = [
        { gw: tgt, branchLabels: sf.name ? [sf.name] : [], flowId: sf.id },
      ];
      const visitedGw = new Set<string>([tgt.id]);
      while (queue.length > 0) {
        const cur = queue.shift()!;
        for (const outFlow of outgoing.get(cur.gw.id) ?? []) {
          const next = nodes.get(outFlow.target);
          if (!next) continue;
          const labels = [...cur.branchLabels, ...(outFlow.name ? [outFlow.name] : [])];
          if (next.kind === "gateway") {
            if (!visitedGw.has(next.id)) {
              visitedGw.add(next.id);
              queue.push({ gw: next, branchLabels: labels, flowId: outFlow.id || cur.flowId });
            }
          } else if (src.laneId && next.laneId && src.laneId !== next.laneId) {
            const branch = labels.length ? ` [${labels.join(", ")}]` : "";
            messages.push({
              from: src.laneId,
              to: next.laneId,
              label: `${src.name}${branch} → ${next.name}`,
              kind: "bpmn-flow",
              ...(outFlow.id ? { relationshipId: outFlow.id } : {}),
            });
          }
        }
      }
    }
  }

  // Collaboration messageFlows across pools/lanes.
  for (const col of collaborations) {
    for (const mf of asArray(col["messageFlow"])) {
      const id = String(mf["@id"] ?? "");
      const sRef = String(mf["@sourceRef"] ?? "");
      const tRef = String(mf["@targetRef"] ?? "");
      const sNode = nodes.get(sRef);
      const tNode = nodes.get(tRef);
      const from = sNode?.laneId ?? (participantMap.has(sRef) ? sRef : undefined);
      const to = tNode?.laneId ?? (participantMap.has(tRef) ? tRef : undefined);
      if (!from || !to || from === to) continue;
      const label = mf["@name"]
        ? collapseWs(String(mf["@name"]))
        : sNode && tNode
          ? `${sNode.name} → ${tNode.name}`
          : id || "message";
      messages.push({
        from,
        to,
        label,
        kind: "bpmn-message",
        ...(id ? { relationshipId: id } : {}),
      });
    }
  }

  if (messages.length === 0) return [];

  const usedIds = new Set<string>();
  const participants: SequenceParticipant[] = [];
  for (const m of messages) {
    for (const pid of [m.from, m.to]) {
      if (usedIds.has(pid)) continue;
      usedIds.add(pid);
      participants.push(
        participantMap.get(pid) ?? {
          id: pid,
          name: pid,
          type: "BusinessRole",
        },
      );
    }
  }

  const firstProc = processes[0];
  const firstCol = collaborations[0];
  const diagramId = opts.id ?? String(firstProc?.["@id"] ?? firstCol?.["@id"] ?? "bpmn-sequence");
  const diagramTitle =
    opts.title ??
    collapseWs(String(firstProc?.["@name"] ?? firstCol?.["@name"] ?? diagramId));

  return [
    {
      id: diagramId,
      title: diagramTitle,
      source: "bpmn",
      participants,
      messages,
    },
  ];
}

const isActorType = (type: string): boolean =>
  type === "BusinessActor" || type === "BusinessRole" || type === "Stakeholder";
const isDataType = (type: string): boolean => CORE_DATA_TYPES.has(type);

/** Render one {@link SequenceDiagram} as PlantUML (`@startuml` ... `@enduml`). */
export function sequencePuml(seq: SequenceDiagram): string {
  const lines = [
    "@startuml",
    `' ${seq.title} (${seq.id}): sequence diagram, derived by archimate-diagrams. Do not edit.`,
    `title ${seq.title.replace(/\n/g, " ")}`,
    "hide footbox",
  ];
  for (const p of seq.participants) {
    const kw = isActorType(p.type) ? "actor" : isDataType(p.type) ? "database" : "participant";
    lines.push(`${kw} ${dq(p.name)} as ${pumlId(p.id)} <<${p.type}>>`);
  }
  for (const m of seq.messages) {
    const arrow =
      m.kind === "serving"
        ? "-->"
        : m.kind === "flow" || m.kind === "bpmn-message"
          ? "->>"
          : "->";
    lines.push(`${pumlId(m.from)} ${arrow} ${pumlId(m.to)} : ${m.label}`);
  }
  lines.push("@enduml");
  return `${lines.join("\n")}\n`;
}

/** Render all sequences in a {@link SequenceSet} as PlantUML. */
export function sequencesPuml(set: SequenceSet): string {
  if (set.sequences.length === 0) {
    return `@startuml\n' ${set.name} (${set.model}): no derived sequences.\n@enduml\n`;
  }
  return set.sequences.map(sequencePuml).join("\n");
}

/** Render one {@link SequenceDiagram} as a Mermaid `sequenceDiagram`. */
export function sequenceMermaid(seq: SequenceDiagram): string {
  const lines = [
    "sequenceDiagram",
    `  %% ${seq.title} (${seq.id}): sequence diagram, derived by archimate-diagrams. Do not edit.`,
  ];
  for (const p of seq.participants) {
    const kw = isActorType(p.type) ? "actor" : "participant";
    lines.push(`  ${kw} ${pumlId(p.id)} as ${p.name.replace(/[:;#]/g, " -")}`);
  }
  for (const m of seq.messages) {
    const arrow = m.kind === "serving" ? "-->>" : "->>";
    lines.push(`  ${pumlId(m.from)}${arrow}${pumlId(m.to)}: ${m.label.replace(/[:;#]/g, " -")}`);
  }
  return `${lines.join("\n")}\n`;
}

/** Render all sequences in a {@link SequenceSet} as Mermaid `sequenceDiagram` blocks. */
export function sequencesMermaid(set: SequenceSet): string {
  if (set.sequences.length === 0) {
    return `sequenceDiagram\n  %% ${set.name} (${set.model}): no derived sequences.\n`;
  }
  return set.sequences.map(sequenceMermaid).join("\n");
}

/** Render a {@link SequenceSet} as Markdown (replacing placeholder sequence-diagram pages). */
export function sequencesMarkdown(set: SequenceSet): string {
  const lines = [
    `## Sequence Diagrams (${set.name})`,
    "",
    `Derived from ArchiMate model \`${set.model}\` (${set.sequences.length} sequence diagram(s)).`,
    "",
  ];
  if (set.sequences.length === 0) {
    lines.push("_No `ApplicationInteraction`s, `Flow`/`Triggering` chains, or BPMN handoffs in this model._", "");
    return lines.join("\n");
  }
  for (const seq of set.sequences) {
    const nameOf = new Map(seq.participants.map((p) => [p.id, p.name]));
    lines.push(
      `### ${seq.title}`,
      "",
      `Source: ${seq.source}${seq.viewId ? ` (\`${seq.viewId}\`)` : ""} · ${seq.participants.length} participant(s), ${seq.messages.length} step(s).`,
      "",
      "```mermaid",
      sequenceMermaid(seq).trimEnd(),
      "```",
      "",
      "| Step | From | To | Message | Kind |",
      "|---|---|---|---|---|",
      ...seq.messages.map(
        (m, i) => `| ${i + 1} | ${nameOf.get(m.from) ?? m.from} | ${nameOf.get(m.to) ?? m.to} | ${m.label} | \`${m.kind}\` |`,
      ),
      "",
    );
  }
  return lines.join("\n");
}
