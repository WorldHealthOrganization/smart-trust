#!/usr/bin/env bun
/**
 * Convert a checkout to `index.config.json` (`folio-index-config/v1`).
 *
 * @module scripts/index-config-migrate
 * @graphNode none — a one-shot converter over a checkout's root files; the schema is `schemas/kg/index-config.ts`
 * @covers cat-harness — the instance axis: under --check, a converted checkout's index.config.json, its generated .gitignore block and its lock name are what the converter would write, and no `remoteMounts` is left on the declaration
 *
 *   bun run cat index-config:migrate                 # print the index it would write, and its findings
 *   bun run cat index-config:migrate --write         # write it, move `remoteMounts` off the declaration,
 *                                                    # write the .gitignore block, rename the lock to index.lock.json
 *   bun run cat index-config:migrate --check         # exit 1 when --write would change anything
 *   bun run cat index-config:migrate --root <dir>    # any checkout — a separated harness's standalone clone too
 *   bun run cat index-config:migrate --inline --write
 *                                                    # ALSO retire each imported `<name>.config.json`: its
 *                                                    # content moves inline into its index entry, the file goes
 *   bun run cat index-config:migrate --inline --check
 *                                                    # exit 1 while any imported `<name>.config.json` remains
 *   bun run cat index-config:migrate --harnesses --write
 *                                                    # ALSO say which harnesses are instantiated here: the
 *                                                    # new form, `layers` + `harnesses` (cat-harness#1138)
 *   bun run cat index-config:migrate --write --prefer-declaration
 *                                                    # a remoteMounts entry that DIFFERS from the index's wins
 *                                                    # (a re-pin merged from main); without it, a difference throws
 *
 * The converter is kept, not run once: every separated repository needs the
 * same conversion, and `remoteMounts` keep gaining entries. It reads only
 * `--root`'s own files.
 *
 * IDEMPOTENT: a re-run over an index that already exists merges what the
 * declaration has gained since (a cutover appending to `remoteMounts`), drops
 * an entry the index already holds identically, and THROWS on one it holds
 * differently — `buildIndexConfig` in the schema module says why.
 *
 * Findings — a root `<name>.config.json` naming no instance the checkout
 * declares or mounts (the `<fork>.config.json` a fork inherited), or a
 * landing nobody flagged — are printed and NOT imported. They do not fail the
 * run; the stray file is a person's call.
 *
 * ## `--inline`: retiring `<name>.config.json`
 *
 * The index is the one config; each instance's config is inline in its entry.
 * `--inline` overlays the imported file with the entry's own fields — EXACTLY
 * the effective config every index-first reader already computed — drops its
 * `import` and deletes the file, so no instance's effective config changes
 * ({@link inlineEntries}). A root config the index does not list is not
 * touched (that is `check:landing-instance`'s `unlisted` finding, a person's call).
 *
 * Exit codes: 0 written / up to date / planned · 1 stale under `--check` · 2 could not convert.
 */
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { INDEX_LOCK_FILENAME, findDeclarationFile, lockFilesIn } from "../schemas/kg/instance-roots.js";
import {
  INDEX_CONFIG_FILENAME,
  buildIndexConfig,
  formatIndexConfig,
  importedConfigFilename,
  inlineOverrides,
  lockedMountPaths,
  withDeclaredHarnesses,
  withIgnoreBlock,
  type IndexConfig,
  type IndexLayer,
  type IndexMigration,
} from "../schemas/kg/index-config.js";

import { overlayConfig } from "./instance-config.ts";

export interface MigrateResult {
  migration: IndexMigration;
  /** The index text the conversion produces. */
  indexText: string;
  /** The declaration's text with `remoteMounts` removed, when it carried any. */
  declaration?: { file: string; text: string };
  /** `.gitignore` with the generated index-mounts block, when that changes it. */
  gitignore?: { file: string; text: string };
  /** The legacy `<name>.mount-lock.json` to rename to `index.lock.json`, when there is one. */
  lockRename?: { from: string; to: string };
  /** Under `--inline`: the `<name>.config.json` files whose content moved into their entries, to delete. */
  retire?: string[];
  /** Whether writing would change a file. */
  changes: boolean;
}

/** The raw text of a legacy config as JSON, keeping its `_comment` (it moves with the content). */
function readLegacy(file: string): Record<string, unknown> {
  const raw = JSON.parse(readFileSync(file, "utf-8")) as unknown;
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`${file} is not a JSON object`);
  return raw as Record<string, unknown>;
}

/**
 * Every index entry with its imported `<name>.config.json` folded in: the
 * file's content overlaid by the entry's inline fields — the same overlay
 * `effectiveLayerConfig` reads — with `import` dropped. The file's
 * `_comment` is kept as the entry's when the entry has none. Returns the new
 * config and the files whose content moved. Pure apart from reading.
 */
export function inlineEntries(root: string, config: IndexConfig): { config: IndexConfig; retire: string[] } {
  const retire: string[] = [];
  const instances = config.instances.map((entry): IndexLayer => {
    const file = importedConfigFilename(entry);
    const path = join(root, file);
    if (!existsSync(path)) return entry;
    const { _comment: legacyComment, ...legacy } = readLegacy(path);
    const merged = overlayConfig(legacy, inlineOverrides(entry));
    const { import: _i, ...head } = entry;
    retire.push(file);
    const comment = entry._comment ?? (typeof legacyComment === "string" ? legacyComment : undefined);
    return { ...head, ...(comment !== undefined ? { _comment: comment } : {}), ...merged } as IndexLayer;
  });
  // Two entries importing ONE file each get its content; it is deleted once.
  return { config: { ...config, instances }, retire: [...new Set(retire)] };
}

/** Plan the conversion of `root`; writes nothing. */
export function planMigration(root: string, opts: { preferDeclaration?: boolean; inline?: boolean; harnesses?: boolean } = {}): MigrateResult {
  const migration = buildIndexConfig(root, opts);
  if (opts.harnesses) migration.config = withDeclaredHarnesses(root, migration.config);
  let retire: string[] | undefined;
  if (opts.inline) {
    const inlined = inlineEntries(root, migration.config);
    migration.config = inlined.config;
    if (inlined.retire.length > 0) retire = inlined.retire;
  }
  const indexText = formatIndexConfig(migration.config);
  const indexFile = join(root, INDEX_CONFIG_FILENAME);
  let changes = !existsSync(indexFile) || readFileSync(indexFile, "utf-8") !== indexText;

  let declaration: MigrateResult["declaration"];
  const declName = findDeclarationFile(root);
  if (declName !== undefined && migration.moved.length > 0) {
    const file = join(root, declName);
    const raw = JSON.parse(readFileSync(file, "utf-8")) as Record<string, unknown>;
    delete raw.remoteMounts;
    declaration = { file, text: `${JSON.stringify(raw, null, 2)}\n` };
    changes = true;
  }
  // The generated ignore block: one `/<path>/` per remote instance.
  let gitignore: MigrateResult["gitignore"];
  const giFile = join(root, ".gitignore");
  const giText = existsSync(giFile) ? readFileSync(giFile, "utf-8") : "";
  const giNext = withIgnoreBlock(giText, migration.config, giFile, lockedMountPaths(root));
  if (giNext !== giText) {
    gitignore = { file: giFile, text: giNext };
    changes = true;
  }

  // The lock moves to `index.lock.json`. Two legacy locks cannot be renamed
  // onto one name without choosing, so that is refused rather than merged.
  let lockRename: MigrateResult["lockRename"];
  const locks = lockFilesIn(root);
  if (locks.conflict !== undefined) throw new Error(locks.conflict);
  const legacy = locks.files.filter((f) => f !== INDEX_LOCK_FILENAME);
  if (legacy.length > 1) throw new Error(`${root} holds ${legacy.length} legacy locks (${legacy.join(", ")}); rename one to ${INDEX_LOCK_FILENAME} by hand`);
  if (legacy.length === 1) {
    lockRename = { from: join(root, legacy[0]!), to: join(root, INDEX_LOCK_FILENAME) };
    changes = true;
  }
  if (retire !== undefined) changes = true;
  return {
    migration,
    indexText,
    ...(declaration ? { declaration } : {}),
    ...(gitignore ? { gitignore } : {}),
    ...(lockRename ? { lockRename } : {}),
    ...(retire ? { retire } : {}),
    changes,
  };
}

/** Write what {@link planMigration} planned. The index first, so a failure leaves the mounts declared somewhere. */
export function applyMigration(root: string, plan: MigrateResult): void {
  writeFileSync(join(root, INDEX_CONFIG_FILENAME), plan.indexText);
  if (plan.gitignore) writeFileSync(plan.gitignore.file, plan.gitignore.text);
  if (plan.declaration) writeFileSync(plan.declaration.file, plan.declaration.text);
  // A rename, so the lock's history follows it (`git` sees the move at commit).
  if (plan.lockRename) renameSync(plan.lockRename.from, plan.lockRename.to);
  // Last: the index that now carries their content is already written.
  for (const f of plan.retire ?? []) rmSync(join(root, f));
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

if (import.meta.main) {
  const root = resolve(arg("--root") ?? process.cwd());
  const write = process.argv.includes("--write");
  const check = process.argv.includes("--check");
  let plan: MigrateResult;
  try {
    plan = planMigration(root, { preferDeclaration: process.argv.includes("--prefer-declaration"), inline: process.argv.includes("--inline"), harnesses: process.argv.includes("--harnesses") });
  } catch (e) {
    console.error(`index-config:migrate: could not convert ${root}: ${(e as Error).message}`);
    process.exit(2);
  }
  const { migration } = plan;
  console.log(`index-config:migrate — ${root}`);
  console.log(`  layers:    ${migration.config.instances.map((i) => `${i.name}${i.source && "remote" in i.source ? " (remote)" : ""}`).join(", ")}`);
  console.log(`  harnesses: ${migration.config.harnesses?.map((h) => h.name).join(", ") ?? "(not declared — every layer is read as instantiated)"}`);
  console.log(`  landing:   ${migration.config.site?.landing ?? "(none — the sole instance, or undetermined)"}`);
  if (migration.moved.length) console.log(`  moved from ${migration.movedFrom}: remoteMounts ${migration.moved.join(", ")}`);
  if (plan.lockRename) console.log(`  lock:      ${plan.lockRename.from} → ${plan.lockRename.to}`);
  if (plan.gitignore) console.log(`  .gitignore: the generated index-mounts block is written`);
  if (plan.retire) console.log(`  inline:    ${plan.retire.join(", ")} → moved into their index entries, and the files retired`);
  for (const f of migration.findings) console.log(`  ⚠ ${f.kind}: ${"file" in f ? `${f.file} — ` : ""}${f.detail}`);

  if (check) {
    if (plan.changes) {
      console.error(
        `✗ ${INDEX_CONFIG_FILENAME}, its .gitignore block or the lock's name is stale, or the declaration still carries remoteMounts` +
          (plan.retire ? `, or a legacy config is still imported (${plan.retire.join(", ")})` : "") +
          ` — run \`bun run cat index-config:migrate${plan.retire ? " --inline" : ""} --write\``,
      );
      process.exit(1);
    }
    console.log(`✓ ${INDEX_CONFIG_FILENAME} is current`);
    process.exit(0);
  }
  if (!write) {
    console.log(`\n${plan.indexText}`);
    console.log(plan.changes ? "(dry run — pass --write to write it)" : "(up to date)");
    process.exit(0);
  }
  if (plan.changes) applyMigration(root, plan);
  console.log(
    plan.changes
      ? `✓ wrote ${join(root, INDEX_CONFIG_FILENAME)}${plan.declaration ? ` and removed remoteMounts from ${plan.declaration.file}` : ""}${plan.retire ? `; retired ${plan.retire.join(", ")}` : ""}`
      : "✓ up to date",
  );
}
