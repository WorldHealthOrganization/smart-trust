#!/usr/bin/env bun
/**
 * Write a minimal aggregate root beside a sibling layout of fresh clones, so
 * the checkout scripts can run there without the full folio-assistant index.
 *
 * `run-script.ts` runs every checkout script from `dirname(HARNESS_ROOT)`, and
 * the scripts are spelled `bun run cat-harness-tools/scripts/…`: they assume a
 * composed checkout as cwd. In a bare sibling layout this gives the parent
 * directory the two files a composed checkout's root has and the scripts
 * read — `index.config.json`, naming each sibling as a LOCAL layer, and a
 * `package.json` carrying the `cat` alias (`bun run cat <name>`).
 *
 * ## What it never does
 *
 * Overwrite. A file already there that differs is refused, exit 1, unless
 * `--force`; one with the same content is reported as current. A parent that
 * is a composed index already has both files, and they are not this script's.
 *
 * Usage: `bun cat-harness-tools/scripts/sibling-root.ts [--dir <parent>] [--force]`
 * (`--dir` defaults to the directory holding this layer).
 *
 * @covers none — writes two files for a local layout; reads no graph
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { findDeclarationFile } from "../schemas/kg/instance-roots.ts";
import { TOOLS_ROOT } from "./lib/roots.ts";

/** The four layers a sibling layout of this one holds: it and its closure. */
export const SIBLINGS = ["bootstrap", "bootstrap-tools", "cat-harness", "cat-harness-tools"] as const;

/** The two root files, by name, as the text to write. */
export function siblingRootFiles(): Record<string, string> {
  const json = (v: unknown): string => JSON.stringify(v, null, 2) + "\n";
  return {
    "index.config.json": json({
      $schema: "folio-index-config/v1",
      _comment: "Written by cat-harness-tools/scripts/sibling-root.ts (bean w1gy, F11 option C): a sibling layout of fresh clones, each a local instance. Not a folio-assistant index.",
      title: "sibling layout",
      instances: SIBLINGS.map((name) => ({ name, source: { local: { at: name } } })),
    }),
    "package.json": json({
      _comment: "Written by cat-harness-tools/scripts/sibling-root.ts (bean w1gy, F11 option C). Only the `cat` runner: every other script is an instance's `checkoutScripts`.",
      name: "sibling-root",
      private: true,
      type: "module",
      scripts: { cat: "bun cat-harness-tools/scripts/run-script.ts" },
    }),
  };
}

/** Write the root into `dir`; returns the exit code and prints what it did. */
export function writeSiblingRoot(dir: string, force: boolean): number {
  const missing = SIBLINGS.filter((n) => findDeclarationFile(join(dir, n)) === undefined);
  if (missing.length) {
    console.error(`sibling-root: ${dir} has no declared ${missing.join(", ")} beside this layer; clone them first.`);
    return 2;
  }
  let code = 0;
  for (const [name, text] of Object.entries(siblingRootFiles())) {
    const path = join(dir, name);
    if (existsSync(path) && readFileSync(path, "utf-8") === text) console.log(`current  ${path}`);
    else if (existsSync(path) && !force) {
      console.error(`refused  ${path} exists and differs; pass --force to overwrite it.`);
      code = 1;
    } else {
      writeFileSync(path, text);
      console.log(`wrote    ${path}`);
    }
  }
  return code;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const at = argv.indexOf("--dir");
  const dir = resolve(at >= 0 && argv[at + 1] ? argv[at + 1]! : dirname(TOOLS_ROOT));
  process.exit(writeSiblingRoot(dir, argv.includes("--force")));
}
