#!/usr/bin/env bun
/**
 * Generate a lightweight JSON manifest of schema types for the viewer.
 *
 * Extracts type names, fields, and doc comments from schemas/types.ts
 * into a compact JSON file that the viewer can lazy-load to show
 * schema documentation inline when viewing block source.
 *
 * Output: build/schema-manifest.json
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/generate-schema-manifest.ts
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { HARNESS_ROOT } from "./lib/roots.ts";

const ROOT = join(HARNESS_ROOT);
const TYPES_FILE = join(ROOT, "folio-assistant/schemas/types.ts");
const QOU_TYPES_FILE = join(ROOT, "folio-assistant/schemas/formalization-types.ts");
const OUT_DIR = join(ROOT, "build");
const OUT_FILE = join(OUT_DIR, "schema-manifest.json");

interface FieldInfo {
  name: string;
  type: string;
  optional: boolean;
  doc?: string;
}

interface TypeInfo {
  name: string;
  kind: "interface" | "type" | "enum";
  doc?: string;
  fields?: FieldInfo[];
  values?: string[];
  /** TypeDoc URL path relative to schema-docs/ */
  docsUrl?: string;
  /** Source file */
  source: string;
}

function parseInterfaces(source: string, filename: string): TypeInfo[] {
  const types: TypeInfo[] = [];
  const lines = source.split("\n");

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Collect doc comment
    let doc = "";
    if (line.trim().startsWith("/**")) {
      const docLines: string[] = [];
      while (i < lines.length && !lines[i].includes("*/")) {
        docLines.push(lines[i].replace(/^\s*\*\s?/, "").replace(/^\/\*\*\s*/, ""));
        i++;
      }
      if (i < lines.length) {
        docLines.push(lines[i].replace(/^\s*\*\/\s*/, "").replace(/^\s*\*\s?/, ""));
        i++;
      }
      doc = docLines.filter(l => l.trim() && !l.trim().startsWith("@")).join(" ").trim();
    }

    const currentLine = lines[i] || "";

    // Match: export interface Foo extends Bar {
    const ifaceMatch = currentLine.match(/^export interface (\w+)(?:\s+extends\s+\w+)?\s*\{/);
    if (ifaceMatch) {
      const name = ifaceMatch[1];
      const fields: FieldInfo[] = [];
      i++;

      while (i < lines.length && !lines[i].match(/^}/)) {
        const fieldLine = lines[i].trim();

        // Field doc comment
        let fieldDoc = "";
        if (fieldLine.startsWith("/**")) {
          const fdLines: string[] = [];
          while (i < lines.length && !lines[i].includes("*/")) {
            fdLines.push(lines[i].replace(/^\s*\*\s?/, "").replace(/^\/\*\*\s*/, ""));
            i++;
          }
          if (i < lines.length) {
            fdLines.push(lines[i].replace(/^\s*\*\/\s*/, "").replace(/^\s*\*\s?/, ""));
            i++;
          }
          fieldDoc = fdLines.filter(l => l.trim()).join(" ").trim();
          continue;
        }

        // Match: fieldName?: Type;
        const fieldMatch = fieldLine.match(/^(\w+)(\?)?:\s*(.+?);?\s*$/);
        if (fieldMatch) {
          fields.push({
            name: fieldMatch[1],
            type: fieldMatch[3].replace(/;$/, "").trim(),
            optional: !!fieldMatch[2],
            ...(fieldDoc ? { doc: fieldDoc } : {}),
          });
          fieldDoc = "";
        }
        i++;
      }

      const module = filename.includes("formalization-types") ? "schemas_formalization-types" : "content_schema_types";
      types.push({
        name,
        kind: "interface",
        ...(doc ? { doc } : {}),
        fields,
        docsUrl: `interfaces/${module}.${name}.html`,
        source: filename,
      });
      i++;
      continue;
    }

    // Match: export type Foo = "a" | "b" | "c";
    const typeMatch = currentLine.match(/^export type (\w+)\s*=\s*$/);
    const inlineTypeMatch = currentLine.match(/^export type (\w+)\s*=\s*(.+);$/);
    if (typeMatch) {
      const name = typeMatch[1];
      const values: string[] = [];
      i++;
      while (i < lines.length && !lines[i].match(/;\s*$/)) {
        const val = lines[i].trim().replace(/^\|\s*/, "").replace(/;$/, "").trim();
        if (val && !val.startsWith("//")) values.push(val);
        i++;
      }
      if (i < lines.length) {
        const val = lines[i].trim().replace(/^\|\s*/, "").replace(/;$/, "").trim();
        if (val && !val.startsWith("//")) values.push(val);
      }

      const module = filename.includes("formalization-types") ? "schemas_formalization-types" : "content_schema_types";
      // Determine if it's a string union (enum-like) or type alias
      const isStringUnion = values.every(v => v.startsWith('"') || v.startsWith("'"));
      types.push({
        name,
        kind: isStringUnion ? "enum" : "type",
        ...(doc ? { doc } : {}),
        ...(isStringUnion ? { values: values.map(v => v.replace(/^["']|["']$/g, "")) } : {}),
        docsUrl: `types/${module}.${name}.html`,
        source: filename,
      });
      i++;
      continue;
    }

    if (inlineTypeMatch) {
      const name = inlineTypeMatch[1];
      const module = filename.includes("formalization-types") ? "schemas_formalization-types" : "content_schema_types";
      types.push({
        name,
        kind: "type",
        ...(doc ? { doc } : {}),
        docsUrl: `types/${module}.${name}.html`,
        source: filename,
      });
    }

    i++;
  }

  return types;
}

// ── Main ──

const typesSource = readFileSync(TYPES_FILE, "utf-8");
const qouSource = readFileSync(QOU_TYPES_FILE, "utf-8");

const contentTypes = parseInterfaces(typesSource, "types.ts");
const qouTypes = parseInterfaces(qouSource, "formalization-types.ts");

// Map block kind → TypeDoc interface name: the kinds cat-harness's types.ts
// declares. The science layer's (definition, theorem, …) are typed by its
// vocabulary module since 2026-10-22, not here.
const BLOCK_KIND_MAP: Record<string, string> = {
  example: "ExampleBlock",
  remark: "RemarkBlock",
  prose: "ProseBlock",
  equation: "EquationBlock",
  diagram: "DiagramBlock",
};

const manifest = {
  generated: new Date().toISOString(),
  docsBaseUrl: "/schema-docs/",
  blockKindMap: BLOCK_KIND_MAP,
  types: [...contentTypes, ...qouTypes],
};

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, JSON.stringify(manifest, null, 2));
console.log(`Schema manifest: ${manifest.types.length} types → ${OUT_FILE}`);
