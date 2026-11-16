/**
 * Content manifests written as JSON data instead of TypeScript modules.
 *
 * Bean `y9r6` (owner D2, 2026-10-01, option 1): a content repository holds no
 * code, so a block, chapter or page manifest can be a `<stem>.json` that the
 * tools validate on read. The file names the builder that a `.ts` manifest
 * would have called, and carries that builder's argument:
 *
 * ```json
 * { "$schema": "block-manifest/v1", "builder": "prose", "data": { "label": "sec:x" } }
 * ```
 *
 * Reading it calls the same builder from `@litlfred/cat-harness/schemas`, so
 * the same Zod schema validates it and the result is the value the `.ts`
 * default export would have been. Nothing is executed from the content tree.
 *
 * Only the builders named in `BUILDERS` can be used. A builder a dependency
 * contributes (a `dak` kind) still needs a `.ts` manifest.
 *
 * @module pipeline/json-manifest
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as builders from "../schemas/builders.ts";
import { inputSiteReached } from "../schemas/sdlc/input-trace.ts";
import { webpage } from "../schemas/ui/webpage.ts";

/** The `$schema` value that marks a JSON file as a manifest. */
export const JSON_MANIFEST_SCHEMA = "block-manifest/v1";

type Builder = (data: never) => unknown;

/** Builders a JSON manifest may name: the block, structure and page builders. */
const BUILDERS: Readonly<Record<string, Builder>> = {
  algorithm: builders.algorithm,
  example: builders.example,
  remark: builders.remark,
  simulator: builders.simulator,
  prose: builders.prose,
  equation: builders.equation,
  diagram: builders.diagram,
  table: builders.table,
  figure: builders.figure,
  recommendation: builders.recommendation,
  section: builders.section,
  chapter: builders.chapter,
  paper: builders.paper,
  folio: builders.folio,
  document: builders.document,
  webpage: webpage as Builder,
};

/** The builder names a JSON manifest may use. */
export const JSON_MANIFEST_BUILDERS: readonly string[] = Object.keys(BUILDERS);

export interface JsonManifest {
  $schema: typeof JSON_MANIFEST_SCHEMA;
  builder: string;
  data?: unknown;
}

/**
 * Parse `path` and return it when it is a JSON manifest, else `undefined`.
 * A content directory holds other JSON (sidecars, data files), so a file that
 * does not carry the manifest `$schema` is simply not one. A file that does,
 * but names an unknown builder, throws: that is an authoring error.
 */
export function readJsonManifest(path: string): JsonManifest | undefined {
  if (!path.endsWith(".json") || !existsSync(path)) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return undefined;
  }
  if (!parsed || typeof parsed !== "object") return undefined;
  const m = parsed as Partial<JsonManifest>;
  if (m.$schema !== JSON_MANIFEST_SCHEMA) return undefined;
  if (typeof m.builder !== "string" || !(m.builder in BUILDERS)) {
    throw new Error(
      `${path}: unknown manifest builder ${JSON.stringify(m.builder)}; ` +
        `expected one of ${JSON_MANIFEST_BUILDERS.join(", ")}`,
    );
  }
  return m as JsonManifest;
}

/** True when `path` is a JSON manifest. Never throws. */
export function isJsonManifest(path: string): boolean {
  try {
    return readJsonManifest(path) !== undefined;
  } catch {
    return true; // it claims to be one; loading it reports the error
  }
}

/**
 * The value a manifest file stands for: the builder's result for a JSON
 * manifest, `undefined` when `path` is not one. Builder validation errors
 * propagate, as they would on importing the `.ts`.
 */
export function evaluateJsonManifest(path: string): unknown {
  const m = readJsonManifest(path);
  if (!m) return undefined;
  return BUILDERS[m.builder]!(m.data as never);
}

/**
 * The manifest file for `stem` in `dir`: `<stem>.json` when it is a JSON
 * manifest, else `<stem>.ts`. Returns the `.ts` path even when it does not
 * exist, so a caller's existing "missing manifest" handling is unchanged.
 */
export function manifestPath(dir: string, stem: string): string {
  const json = join(dir, `${stem}.json`);
  return isJsonManifest(json) ? json : join(dir, `${stem}.ts`);
}

/** Strip a manifest extension (`.ts` or `.json`) from a path. */
export function manifestRoot(path: string): string {
  return path.replace(/\.(ts|json)$/, "");
}

/**
 * Load a manifest's value, whatever its form: a `.json` manifest is evaluated,
 * a `.ts` one is imported and its default export returned.
 */
export async function loadManifestValue(path: string): Promise<unknown> {
  if (path.endsWith(".json")) return evaluateJsonManifest(path);
  // input-site: traced #39e1173c — a legacy .ts manifest loaded by path when no .json manifest exists
  inputSiteReached("json-manifest: computed load");
  return ((await import(path)) as { default?: unknown }).default;
}
