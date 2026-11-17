#!/usr/bin/env bun
/**
 * CLI for the stakeholder map — CRDM phase 1's mechanical half.
 *
 * Usage:
 *   bun run cat stakeholder-map <path>...        explicit paths
 *   bun run cat stakeholder-map --since <ref>    everything changed since a ref
 *
 * See src/impact/stakeholder-map.ts for why this reads skills and BPMN lanes
 * rather than the CODEOWNERS and folio.config fields that were proposed and
 * do not exist.
 */
import { resolve } from "node:path";
import { stakeholderMap, formatStakeholderMap } from "../src/impact/stakeholder-map.js";
import { HARNESS_ROOT } from "./lib/roots.ts";

const root = resolve(HARNESS_ROOT);
const argv = process.argv.slice(2);

let changed: string[];
const sinceIdx = argv.indexOf("--since");
if (sinceIdx !== -1) {
  const ref = argv[sinceIdx + 1];
  if (!ref) {
    console.error("--since needs a git ref, e.g. --since main");
    process.exit(2);
  }
  const proc = Bun.spawnSync(["git", "diff", "--name-only", `${ref}...HEAD`], { cwd: root });
  if (proc.exitCode !== 0) {
    console.error(`git diff against "${ref}" failed:\n${new TextDecoder().decode(proc.stderr)}`);
    process.exit(2);
  }
  changed = new TextDecoder().decode(proc.stdout).split("\n").map((l) => l.trim()).filter(Boolean);
} else {
  changed = argv.filter((a) => !a.startsWith("--"));
}

if (changed.length === 0) {
  console.error("Nothing to map. Pass paths, or --since <ref>.");
  process.exit(2);
}

console.log(formatStakeholderMap(await stakeholderMap(root, changed)));
