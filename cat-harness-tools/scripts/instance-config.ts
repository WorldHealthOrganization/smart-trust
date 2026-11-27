/**
 * A layer's config, read by NAME at a checkout root: the
 * `index.config.json` entry first, a root `<name>.config.json` only as a
 * fallback that is reported as LEGACY.
 *
 * @module scripts/instance-config
 * @graphNode none — a reader over `cat-harness/schemas/kg/index-config.ts`; the schema stays there
 *
 * A checkout's root `index.config.json` is the ONE authoritative config, each
 * layer's config is inline in its `instances[]` entry, and a
 * `<name>.config.json` is only a migration step.
 *
 * `readHarnessConfig` / `readEffectiveConfig` in cat-harness answer the same
 * question from a DIRECTORY (they find the layer that owns it); the
 * readers here are handed a root and a layer name, so this resolves the
 * entry by name and keeps the same overlay rule: the imported file, when one
 * exists, overlaid by the entry's inline fields (objects merge key by key,
 * anything else is replaced).
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { importedConfigFilename, inlineOverrides, readIndexConfig } from "../schemas/kg/index-config.ts";

export interface InstanceConfigRead {
  /** The effective config, raw (keys the schema does not name are kept). Absent when nothing configures the layer. */
  config?: Record<string, unknown>;
  /** Where it came from, as a sentence fragment a message can name. */
  from: string;
  /** `index`: the entry alone. `index+legacy`: the entry over an imported `<name>.config.json`. `legacy`: the file alone. */
  via: "index" | "index+legacy" | "legacy" | "none";
  /** The legacy `<name>.config.json` that was read, when one was — always reported (bean `ymvt`). */
  legacy?: string;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** Inline over imported: objects merge key by key, anything else (arrays included) is replaced. */
export function overlayConfig(base: Record<string, unknown>, top: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(top)) out[k] = isPlainObject(v) && isPlainObject(out[k]) ? overlayConfig(out[k] as Record<string, unknown>, v) : v;
  return out;
}

/** `file` parsed, `_comment` keys stripped; undefined when absent. Throws when it is not a JSON object. */
export function readRawConfigFile(file: string): Record<string, unknown> | undefined {
  if (!existsSync(file)) return undefined;
  const raw = JSON.parse(readFileSync(file, "utf-8"), (k, v) => (k === "_comment" ? undefined : v)) as unknown;
  if (!isPlainObject(raw)) throw new Error(`${file} is not a JSON object`);
  return raw;
}

/**
 * The config of instance `name` at checkout `root`, index first.
 *
 * An UNREADABLE index throws: it was written to override the fallback that
 * silence would select. An index that does not list `name` falls back to the
 * file, reported as legacy like any other read of it.
 */
export function readInstanceConfig(root: string, name: string): InstanceConfigRead {
  const r = resolve(root);
  const legacyName = `${name}.config.json`;
  const idx = readIndexConfig(r);
  if (idx.state === "unreadable") throw new Error(`${idx.file} is ${idx.why}`);
  if (idx.state === "ok") {
    const entry = idx.config.instances.find((e) => e.name === name);
    if (entry !== undefined) {
      const importName = importedConfigFilename(entry);
      const imported = readRawConfigFile(join(r, importName));
      const inline = inlineOverrides(entry);
      const from = `index.config.json entry "${name}"`;
      if (imported === undefined) return { config: inline, from, via: "index" };
      return { config: overlayConfig(imported, inline), from: `${from} (importing legacy ${importName})`, via: "index+legacy", legacy: importName };
    }
  }
  const file = readRawConfigFile(join(r, legacyName));
  if (file !== undefined) return { config: file, from: `legacy ${legacyName}`, via: "legacy", legacy: legacyName };
  return { from: idx.state === "ok" ? `index.config.json (no entry "${name}")` : "no config", via: "none" };
}

/** The one sentence every reader prints when it read a legacy file. */
export function legacyNotice(read: InstanceConfigRead): string | undefined {
  if (read.legacy === undefined) return undefined;
  return (
    `⚠ legacy config: ${read.legacy} was read. index.config.json is the one config (bean ymvt); ` +
    `move it inline with \`bun run cat index-config:migrate --inline --write\` and delete the file.`
  );
}
