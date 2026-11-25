/**
 * The readable half of a `Schema` node's page: the module's own description
 * and, for each public Zod `*Schema` it exports, a table of its fields.
 *
 * A Schema node's page used to show only its name, the first line of its
 * docblock (often cut mid-sentence) and its module path. A reader who wanted
 * to know what a Dublin Core record holds had to open the TypeScript source
 * or a raw JSON Schema file. This draws both on the page itself.
 *
 * Pure: {@link schemaSectionHtml} draws a {@link SchemaPageDetail} and reads
 * nothing. {@link schemaPageDetails} reads the module text and takes the
 * rendered JSON Schemas the caller already has, so the fields and the
 * published `zod/` files come from one rendering.
 *
 * @module cat-harness-tools/scripts/lib/schema-page
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** One public `*Schema` export of a module, rendered. */
export interface SchemaExportDetail {
  exportName: string;
  /** The rendered JSON Schema (`namedJsonSchema`'s `{ $ref, definitions }` shape, or a plain body). */
  jsonSchema: Record<string, unknown>;
  /** Where the rendering is published, when the layer publishes one. */
  href?: string;
}

/** What a Schema node's page shows beyond its fields table. */
export interface SchemaPageDetail {
  /** The module's leading docblock, tags removed. */
  prose: string;
  exports: SchemaExportDetail[];
}

/** One row of a fields table. */
export interface FieldRow {
  path: string;
  type: string;
  required: boolean;
  description?: string;
}

/**
 * The leading docblock's prose: the comment markers and every `@tag` paragraph
 * removed. Only the FIRST docblock, as `schema-nodes.ts` reads it.
 */
export function docblockProse(text: string): string {
  const block = /^\/\*\*[\s\S]*?^ \*\//m.exec(text)?.[0] ?? "";
  const lines = block
    .split("\n")
    .slice(1, -1)
    .map((l) => l.replace(/^\s*\*\s?/, ""));
  const out: string[] = [];
  let inTag = false;
  for (const l of lines) {
    if (/^@\w/.test(l.trim())) {
      inTag = true;
      continue;
    }
    // A tag's text runs until the next blank line.
    if (inTag && l.trim() === "") inTag = false;
    if (!inTag) out.push(l);
  }
  return out.join("\n").trim();
}

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Inline Markdown a docblock uses: `code`, **bold**, *emphasis*. Escaped first. */
function inline(s: string): string {
  return esc(s)
    .replace(/\{@link(?:code|plain)?\s+([^}\s|]+)(?:[\s|]+([^}]+))?\}/g, (_m, target: string, label?: string) => `<code>${label ?? target}</code>`)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=[\s).,;:]|$)/g, "$1<em>$2</em>");
}

/**
 * A docblock's prose as HTML: headings (`## `), bullet lists (`- `),
 * fenced code, and paragraphs. Enough for how schema docblocks are written;
 * anything else is a paragraph, escaped.
 */
export function proseHtml(prose: string): string {
  const out: string[] = [];
  const blocks = prose.split(/\n\s*\n/);
  for (const raw of blocks) {
    const b = raw.replace(/\s+$/, "");
    if (b.trim() === "") continue;
    if (/^```/.test(b.trim())) {
      out.push(`<pre><code>${esc(b.trim().replace(/^```\w*\n?/, "").replace(/\n?```$/, ""))}</code></pre>`);
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(b.trim());
    if (h && !b.trim().includes("\n")) {
      out.push(`<h4>${inline(h[2]!)}</h4>`);
      continue;
    }
    const lines = b.split("\n");
    if (lines.every((l) => /^\s*[-*]\s+/.test(l) || /^\s{2,}\S/.test(l))) {
      const items: string[] = [];
      for (const l of lines) {
        if (/^\s*[-*]\s+/.test(l)) items.push(l.replace(/^\s*[-*]\s+/, ""));
        else if (items.length > 0) items[items.length - 1] += " " + l.trim();
      }
      out.push(`<ul>${items.map((i) => `<li>${inline(i)}</li>`).join("")}</ul>`);
      continue;
    }
    out.push(`<p>${inline(lines.map((l) => l.trim()).join(" "))}</p>`);
  }
  return out.join("\n");
}

/** The schema body a `{ $ref: "#/definitions/X", definitions }` wrapper names, or the schema itself. */
function bodyOf(js: Record<string, unknown>): Record<string, unknown> {
  const ref = typeof js.$ref === "string" ? /^#\/(?:definitions|\$defs)\/(.+)$/.exec(js.$ref)?.[1] : undefined;
  const defs = (js.definitions ?? js.$defs) as Record<string, Record<string, unknown>> | undefined;
  return ref !== undefined && defs?.[ref] ? defs[ref]! : js;
}

/** A short, readable type for one JSON Schema node. */
export function typeLabel(s: Record<string, unknown>): string {
  if ("const" in s) return `= ${JSON.stringify(s.const)}`;
  if (Array.isArray(s.enum)) return s.enum.map((v) => JSON.stringify(v)).join(" | ");
  if (typeof s.$ref === "string") return s.$ref.split("/").pop()!;
  const union = (s.anyOf ?? s.oneOf) as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(union)) return [...new Set(union.map(typeLabel))].join(" | ");
  if (Array.isArray(s.allOf)) return (s.allOf as Array<Record<string, unknown>>).map(typeLabel).join(" & ");
  const t = Array.isArray(s.type) ? (s.type as string[]).join(" | ") : typeof s.type === "string" ? s.type : "any";
  if (t === "array" && s.items && typeof s.items === "object") return `array of ${typeLabel(s.items as Record<string, unknown>)}`;
  if (t === "array" && Array.isArray(s.prefixItems)) return `[${(s.prefixItems as Array<Record<string, unknown>>).map(typeLabel).join(", ")}]`;
  if (t === "string" && typeof s.format === "string") return `string (${s.format})`;
  if (t === "string" && typeof s.pattern === "string") return "string (pattern)";
  return t;
}

/**
 * The fields of an object schema, nested objects and arrays of objects
 * flattened to dotted paths (`fields[].element`) down to `depth`.
 */
export function fieldRows(js: Record<string, unknown>, depth = 3): FieldRow[] {
  const rows: FieldRow[] = [];
  const walk = (s: Record<string, unknown>, prefix: string, level: number): void => {
    const props = s.properties as Record<string, Record<string, unknown>> | undefined;
    if (!props) return;
    const required = new Set(Array.isArray(s.required) ? (s.required as string[]) : []);
    for (const [k, v] of Object.entries(props)) {
      const path = prefix === "" ? k : `${prefix}.${k}`;
      rows.push({
        path,
        type: typeLabel(v),
        required: required.has(k),
        ...(typeof v.description === "string" ? { description: v.description } : {}),
      });
      if (level >= depth) continue;
      if (v.properties) walk(v, path, level + 1);
      else if (v.type === "array" && v.items && typeof v.items === "object" && (v.items as Record<string, unknown>).properties)
        walk(v.items as Record<string, unknown>, `${path}[]`, level + 1);
    }
  };
  walk(bodyOf(js), "", 1);
  return rows;
}

/** The section a Schema node's page shows under its fields table. */
export function schemaSectionHtml(detail: SchemaPageDetail): string {
  const parts: string[] = [];
  if (detail.prose !== "") parts.push(`<h2>Description</h2>\n<div class="schema-prose">\n${proseHtml(detail.prose)}\n</div>`);
  if (detail.exports.length > 0) {
    parts.push("<h2>Schemas</h2>");
    for (const e of detail.exports) {
      const body = bodyOf(e.jsonSchema);
      const rows = fieldRows(e.jsonSchema);
      const link = e.href === undefined ? "" : ` · <a href="${esc(e.href)}">JSON Schema</a>`;
      parts.push(`<section id="${esc(e.exportName)}"><h3><code>${esc(e.exportName)}</code>${link}</h3>`);
      if (typeof body.description === "string") parts.push(`<p>${inline(body.description)}</p>`);
      if (rows.length === 0) {
        parts.push(`<p class="muted">Type: <code>${esc(typeLabel(body))}</code></p>`);
      } else {
        parts.push(
          '<table class="fa-page-wide schema-fields"><thead><tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr></thead><tbody>',
          ...rows.map(
            (r) =>
              `<tr><td><code>${esc(r.path)}</code></td><td><code>${esc(r.type)}</code></td><td>${r.required ? "yes" : "no"}</td><td>${r.description === undefined ? "" : inline(r.description)}</td></tr>`,
          ),
          "</tbody></table>",
        );
      }
      parts.push("</section>");
    }
  }
  return parts.join("\n");
}

/**
 * One {@link SchemaPageDetail} per Schema node, keyed by its `@id`.
 *
 * `nodes` are the graph's Schema nodes (`@id` and `module`, relative to
 * `root`). `rendered` is what the caller already rendered, by module; a
 * module with none still gets its prose.
 */
export function schemaPageDetails(
  root: string,
  nodes: ReadonlyArray<{ "@id": string; module: string }>,
  rendered: ReadonlyArray<{ module: string; exportName: string; schema: Record<string, unknown>; href?: string }>,
): Map<string, SchemaPageDetail> {
  const out = new Map<string, SchemaPageDetail>();
  for (const n of nodes) {
    const file = join(root, n.module);
    const prose = existsSync(file) ? docblockProse(readFileSync(file, "utf-8")) : "";
    const exports = rendered
      .filter((r) => r.module === n.module)
      .map((r) => ({ exportName: r.exportName, jsonSchema: r.schema, ...(r.href !== undefined ? { href: r.href } : {}) }));
    out.set(n["@id"], { prose, exports });
  }
  return out;
}
