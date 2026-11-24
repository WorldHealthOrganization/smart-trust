/**
 * Read an IG checkout's DAK metadata, wherever that IG keeps it.
 *
 * @module scripts/ig-dak-metadata
 *
 * Since 2026-10-24 a DAK declares itself in the `dak` section of
 * `contentTypes` in its root `index.config.json` (bean `cz17`;
 * `schemas/dak.ts` `readDakDeclaration` is the strict, validated reader).
 * The scripts here also run over OTHER IG checkouts, and most of those,
 * including WHO's own, still carry the old `dak.json`. Reading only the new
 * place would quietly turn their DAK steps off, so these scripts read the
 * section first and fall back to the legacy file, and say which one they read.
 *
 * No dependencies beyond `node:fs`, because `ig-site-sidecars.ts` runs before
 * the platform is installed.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const DAK_INDEX_FILE = "index.config.json";
export const DAK_INDEX_SECTION = "dak";
/** The pre-2026-10-24 spelling, read only as a fallback. */
export const LEGACY_DAK_FILE = "dak.json";

export interface IgDakMetadata {
  /** The declaration, unvalidated: these scripts read one or two fields. */
  data: Record<string, unknown>;
  /** Where it was read from, for messages. */
  from: `${typeof DAK_INDEX_FILE}#contentTypes.${typeof DAK_INDEX_SECTION}` | typeof LEGACY_DAK_FILE;
}

function readJson(p: string): unknown {
  try {
    return JSON.parse(readFileSync(p, "utf-8"));
  } catch (e) {
    throw new Error(`${p} is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);

/** The IG's DAK metadata, or `undefined` when it is not a DAK. Unparseable JSON throws. */
export function readIgDakMetadata(igRoot: string): IgDakMetadata | undefined {
  const index = join(igRoot, DAK_INDEX_FILE);
  if (existsSync(index)) {
    const raw = readJson(index);
    const section = isObject(raw) && isObject(raw.contentTypes) ? raw.contentTypes[DAK_INDEX_SECTION] : undefined;
    if (section !== undefined) {
      if (!isObject(section)) throw new Error(`${index}: contentTypes.${DAK_INDEX_SECTION} must be an object`);
      return { data: section, from: `${DAK_INDEX_FILE}#contentTypes.${DAK_INDEX_SECTION}` };
    }
  }
  const legacy = join(igRoot, LEGACY_DAK_FILE);
  if (existsSync(legacy)) {
    const raw = readJson(legacy);
    if (!isObject(raw)) throw new Error(`${legacy} must be a JSON object`);
    return { data: raw, from: LEGACY_DAK_FILE };
  }
  return undefined;
}
