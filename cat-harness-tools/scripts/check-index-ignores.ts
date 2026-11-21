#!/usr/bin/env bun
/**
 * The committed `.gitignore` covers every remote mount `index.config.json`
 * names — the generated index-mounts block agrees with the index.
 *
 * @module scripts/check-index-ignores
 * @covers cat-harness — the instance axis: every remote layer index.config.json declares is ignored by the committed .gitignore block generated from it
 *
 * The root `.gitignore` carries a marked block,
 * `# BEGIN index mounts (generated from index.config.json — do not edit)` …
 * `# END index mounts`, one `/<path>/` per remote layer (its
 * `overrides.<name>.path`, else `<name>/`). `mount:remote`,
 * `writeDeclaredMounts` and `index-config:migrate --write` write it; this
 * fails when it is missing or disagrees.
 *
 * Why a gate and not only a writer: a mount path the committed rules do not
 * ignore is another repository's bytes one `git add -A` away from being
 * committed here, and with an index `mount:remote` no longer patches
 * `.git/info/exclude` — a local rule every other clone would lack.
 *
 * Exit codes: 0 current, or no index (nothing to agree with) · 1 block
 * missing or drifted · 2 the index cannot be read.
 */
import { resolve } from "node:path";

import { repoRootFor } from "../schemas/kg/cat-harness.js";
import { checkIgnoreBlock, readIndexConfig, type IgnoreBlockState } from "../schemas/kg/index-config.js";

/** Resolved from this file, not `process.cwd()` — the reason `check-landing-instance` gives. */
const REPO = repoRootFor(resolve(import.meta.dir, ".."));

/** The report for one state. Pure, so the tests need no process. */
export function formatIgnoreBlock(s: IgnoreBlockState): { text: string; ok: boolean } {
  switch (s.state) {
    case "current":
      return { text: "  ✓ the .gitignore index-mounts block matches index.config.json", ok: true };
    case "missing":
      return { text: `  ✗ ${s.detail}`, ok: false };
    case "drift":
      return {
        text: [`  ✗ ${s.detail} — run \`bun run cat index-config:migrate --write\``, "    want:", ...s.want.map((l) => `      ${l}`), "    have:", ...s.have.map((l) => `      ${l}`)].join("\n"),
        ok: false,
      };
  }
}

if (import.meta.main) {
  console.log("Index mounts in .gitignore:");
  const idx = readIndexConfig(REPO);
  if (idx.state === "absent") {
    console.log("  · no index.config.json — nothing to agree with (mounts may still be excluded locally)");
    process.exit(0);
  }
  if (idx.state === "unreadable") {
    console.log(`  ✗ ${idx.file} is ${idx.why}`);
    process.exit(2);
  }
  const { text, ok } = formatIgnoreBlock(checkIgnoreBlock(REPO, idx.config));
  console.log(text);
  if (!ok) process.exit(1);
}
