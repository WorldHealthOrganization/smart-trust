/**
 * One Tool per folder: `<tools dir>/<id>/<id>.json` or `<id>/<id>.ts`, and the
 * loader that reads them.
 *
 * ## The convention, held here rather than in prose
 *
 * | rule | refused with |
 * |---|---|
 * | every folder in the tools directory is one Tool | a folder with neither `<folder>/<folder>.json` nor `<folder>/<folder>.ts`, or with both |
 * | the folder, the file stem and the Tool's `id` are one string | a Tool whose `id` differs from its folder |
 * | a `.ts` file default-exports a {@link ToolFactory} | a module with no default export, or one that is not a function |
 * | what it returns is a Tool node | `defineTool`'s own parse, which the factory calls |
 *
 * The JSON-LD of each Tool and the JSON Schema of each of its types are
 * RENDERINGS, written when the site is published, never committed beside the
 * source.
 *
 * ## Why a factory, not a constant
 *
 * A Tool's I/O type IRIs are minted against the publication base at load
 * (`toolTypeIri`), so relocating the base edits no Tool. A constant would have
 * to know the base when its module is first evaluated; a factory is handed it.
 *
 * ## Why `require`, synchronously
 *
 * `tools()` is synchronous and every consumer calls it that way
 * (`cat-harness-tools/tools/discover.ts`). The module path is a variable read
 * from the directory, so it adds no import edge (`repo-partition` counts only
 * a literal specifier).
 *
 * @module schemas/tool-folders
 * @graphNode none — the folder convention and its loader: the Tool node's schema is `tool.ts`
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

import { defineTool, type ToolDefinition } from "./tool.js";
import { TOOL_TYPES, toolTypeIri, type ToolTypeName } from "./tool-types.js";

/**
 * The directory, beside a layer's published document, that holds one
 * JSON-LD document per Tool.
 *
 * Bean `tdir`. The owner, 2026-10-15: *"i want a seperate jsonld for each Tool
 * w/ its own IRI."* A Tool was `<instance doc>#tool/<id>`: a fragment, which
 * fetches the whole instance graph to read one node. It is now a DOCUMENT,
 * `<dir of the instance doc>/tools/<id>.jsonld`, so the IRI dereferences to
 * exactly the Tool, and the folder that declares it in source
 * (`tools/<id>/<id>.ts`) and the document that publishes it share a name.
 */
export const TOOL_DOCUMENT_DIR = "tools";

/** A Tool's document path relative to its instance document's directory: `tools/<id>.jsonld`. */
export function toolDocumentPath(id: string): string {
  return `${TOOL_DOCUMENT_DIR}/${encodeURIComponent(id)}.jsonld`;
}

/**
 * The IRI of one Tool, given the IRI of the instance document it belongs to.
 *
 * BESIDE the document, never at a second composed address, for the reason
 * `instanceSchemaBase` gives in `harness-schema-export.ts`: the host's
 * document is `<base>/<stub>.jsonld`, a foreign layer's
 * `<base>/<stub>/<stub>.jsonld`, and one with its own `canonicalUrl`
 * `<canonicalUrl>/<stub>.jsonld`. Deriving from the document's own IRI gives
 * all three the right answer and keeps a preview's Tools under the preview.
 * `kg-export` writes the file at the same path relative to its `--out`, so
 * the IRI and the bytes cannot drift apart.
 *
 * A document-relative `docIri` (no base declared) yields a document-relative
 * Tool IRI, `tools/<id>.jsonld`, on `makeIri`'s rule that an IRI which only
 * LOOKS dereferenceable is worse than one that is obviously local.
 */
export function toolIri(docIri: string, id: string): string {
  const doc = docIri.split("#")[0];
  const slash = doc.lastIndexOf("/");
  return slash === -1 ? toolDocumentPath(id) : `${doc.slice(0, slash)}/${toolDocumentPath(id)}`;
}

/** Mint the IRI of one shared I/O type against the publication base. */
export type TypeIri = (name: ToolTypeName) => string;

/**
 * What `<tools dir>/<id>/<id>.ts` default-exports: given the type minter and
 * the base, the Tool node.
 */
export type ToolFactory = (t: TypeIri, base: string) => ToolDefinition;

/** Identity, for the type: `export default toolFactory((t) => defineTool({ … }))`. */
export function toolFactory(f: ToolFactory): ToolFactory {
  return f;
}

/** The `$schema` value of a Tool declared as data: `<id>/<id>.json`. */
export const TOOL_DEFINITION_SCHEMA = "tool-definition/v1";

/**
 * A Tool declared as data rather than as a `.ts` module (bean `y9r6`: a
 * content repository holds no code). The file is
 * `{ "$schema": "tool-definition/v1", "tool": { … } }`, where `tool` is the
 * Tool definition with every shared type written `{ "$type": "<Name>" }`
 * instead of `t("<Name>")`. Each one becomes the same IRI `t` would give, then
 * `defineTool` validates the whole, exactly as for a `.ts` declaration.
 */
export interface ToolDefinitionFile {
  $schema: typeof TOOL_DEFINITION_SCHEMA;
  tool: unknown;
}

/** Read one `<id>/<id>.json` Tool declaration, resolving its type references through `t`. */
export function toolFromJson(file: string, t: TypeIri): ToolDefinition {
  let parsed: Partial<ToolDefinitionFile>;
  try {
    parsed = JSON.parse(readFileSync(file, "utf-8")) as Partial<ToolDefinitionFile>;
  } catch (e) {
    throw new Error(`${file}: not valid JSON — ${(e as Error).message}`);
  }
  if (parsed.$schema !== TOOL_DEFINITION_SCHEMA) {
    throw new Error(`${file}: a Tool declared as data carries "$schema": "${TOOL_DEFINITION_SCHEMA}"`);
  }
  const resolve = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(resolve);
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      const keys = Object.keys(o);
      if (keys.length === 1 && keys[0] === "$type") {
        const name = o.$type;
        if (typeof name !== "string" || !(name in TOOL_TYPES)) {
          throw new Error(`${file}: unknown Tool type ${JSON.stringify(name)}`);
        }
        return t(name as ToolTypeName);
      }
      return Object.fromEntries(keys.map((k) => [k, resolve(o[k])]));
    }
    return v;
  };
  return defineTool(resolve(parsed.tool) as ToolDefinition);
}

/**
 * Every Tool under `dir`, one per folder, in folder order.
 *
 * Throws on the first folder that breaks the convention: a partial list would
 * read as "this instance has fewer Tools", which is the clean-run-over-nothing
 * defect (`dh4f`) for one Tool at a time. `check:tools` runs discovery, so a
 * broken folder fails CI in the same pull request.
 */
export function toolsFromFolders(dir: string, base: string): ToolDefinition[] {
  const t: TypeIri = (n) => toolTypeIri(base, n);
  const req = createRequire(join(dir, "index.ts"));
  const out: ToolDefinition[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    const json = join(dir, entry.name, `${entry.name}.json`);
    const file = join(dir, entry.name, `${entry.name}.ts`);
    if (existsSync(json) && existsSync(file)) {
      throw new Error(`${join(dir, entry.name)}: declares its Tool twice, in ${entry.name}.json and ${entry.name}.ts — keep one`);
    }
    let tool: ToolDefinition;
    if (existsSync(json)) {
      tool = toolFromJson(json, t);
    } else {
      if (!existsSync(file)) {
        throw new Error(`${join(dir, entry.name)}: a folder in a tools directory is one Tool, declared in ${entry.name}/${entry.name}.json (or .ts) — that file is missing`);
      }
      const f = (req(file) as { default?: unknown }).default;
      if (typeof f !== "function") {
        throw new Error(`${file}: must \`export default toolFactory((t) => defineTool({ … }))\``);
      }
      tool = (f as ToolFactory)(t, base);
    }
    if (tool.id !== entry.name) {
      throw new Error(`${file}: declares Tool \`${tool.id}\`, but its folder is \`${entry.name}\` — the folder, the file and the id are one name`);
    }
    out.push(tool);
  }
  return out;
}

/**
 * Files in a tools directory that DECLARE Tools inline instead of in a folder:
 * a `defineTool(` outside `<id>/<id>.ts`. `check:tools` reports each one, since
 * a Tool declared in a barrel has no folder of its own to hold its scripts,
 * tests and QA.
 */
export function inlineToolDeclarations(dir: string, read: (file: string) => string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".ts") && !e.name.endsWith(".test.ts"))
    .map((e) => join(dir, e.name))
    .filter((f) => /\bdefineTool\(/.test(read(f)));
}
