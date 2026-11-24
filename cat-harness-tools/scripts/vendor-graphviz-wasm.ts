#!/usr/bin/env bun
/**
 * Vendor Graphviz, compiled to WebAssembly, into the docs site for the
 * interactive KG subgraph viewer (`docs/assets/js/kg-graph.js`), which lays a
 * DOT file out in the reader's browser and lets them drag nodes.
 *
 * It is loaded from `docs/assets/js/vendor/wasm-graphviz/` and NOT from a CDN,
 * for the reasons `vendor-sqlite-wasm.ts` gives and the `kg-viewer` skill
 * states: a third host in the trust boundary of a page that shows this
 * repository's own data, and a page that cannot be tested where the CDN is
 * refused. "No CDN" means no THIRD party's.
 *
 * One file is copied, `dist/index.js` (about 740 KB): the ESM bundle with the
 * WASM inlined, so there is no second fetch to resolve. The SOURCE is the
 * devDependency `@hpcc-js/wasm-graphviz`, pinned exactly, so an upgrade is a
 * `package.json` bump plus `bun run cat kg-graph:vendor`, and `--check` fails
 * when the vendored bytes differ from the pinned package (a hand-edit, or a
 * bump that was never re-vendored).
 *
 * @module cat-harness/scripts/vendor-graphviz-wasm
 * @covers none — vendored third-party bytes compared with their pinned package; no declared graph typology
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { repoRootFor, siteFileFor } from "../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";

const INSTANCE_ROOT = resolve(HARNESS_ROOT);
/** Where `bun install` put the package: this layer's own install first, then the checkout root's. */
function packageDir(): string {
  const own = join(INSTANCE_ROOT, "node_modules", "@hpcc-js", "wasm-graphviz");
  return existsSync(own) ? own : join(repoRootFor(INSTANCE_ROOT), "node_modules", "@hpcc-js", "wasm-graphviz");
}
export const VENDOR_DIR = join(INSTANCE_ROOT, siteFileFor(INSTANCE_ROOT, "assets/js/vendor/wasm-graphviz"));
export const VENDORED = ["index.js"] as const;

/**
 * The notice beside the copy. The wrapper is Apache-2.0 and its full text is
 * the package's own `LICENSE`, appended verbatim. The Graphviz library compiled
 * into the WASM is Graphviz's own licence (EPL-1.0), with its source where
 * Graphviz publishes it; the version is the one the bundle reports.
 */
function license(pkg: string, version: string): string {
  return [
    `@hpcc-js/wasm-graphviz ${version}, vendored by cat-harness/scripts/vendor-graphviz-wasm.ts`,
    "(dist/index.js, unmodified). https://github.com/hpcc-systems/hpcc-js-wasm",
    "",
    "The wrapper is licensed under the Apache License, Version 2.0; its full text follows.",
    "The Graphviz library compiled into the bundled WebAssembly (Graphviz 12.1.2, as",
    "`Graphviz.version()` reports it) is distributed under the Eclipse Public License 1.0;",
    "its source is at https://gitlab.com/graphviz/graphviz.",
    "",
    "----",
    "",
    readFileSync(join(pkg, "LICENSE"), "utf-8"),
  ].join("\n");
}

export function vendorProblems(): string[] {
  const pkg = packageDir();
  if (!existsSync(pkg)) return [`${pkg} is missing: run bun install`];
  const version = (JSON.parse(readFileSync(join(pkg, "package.json"), "utf-8")) as { version: string }).version;
  const problems: string[] = [];
  for (const f of VENDORED) {
    const dest = join(VENDOR_DIR, f);
    if (!existsSync(dest)) problems.push(`${f} is not vendored`);
    // input-site: inert #e18029a0 — names a build-output directory only to leave it out of a walk
    else if (!readFileSync(dest).equals(readFileSync(join(pkg, "dist", f)))) problems.push(`${f} differs from @hpcc-js/wasm-graphviz ${version}`);
  }
  const lic = join(VENDOR_DIR, "LICENSE.txt");
  if (!existsSync(lic) || readFileSync(lic, "utf-8") !== license(pkg, version)) problems.push(`LICENSE.txt does not name ${version}`);
  return problems;
}

if (import.meta.main) {
  if (process.argv.includes("--check")) {
    const p = vendorProblems();
    if (p.length) {
      for (const x of p) console.error(`  ✗ ${x} — run bun run cat kg-graph:vendor`);
      process.exit(1);
    }
    console.log("✓ vendored wasm-graphviz matches the pinned package");
  } else {
    const pkg = packageDir();
    const version = (JSON.parse(readFileSync(join(pkg, "package.json"), "utf-8")) as { version: string }).version;
    mkdirSync(VENDOR_DIR, { recursive: true });
    // input-site: inert #ec86acc8 — names a build-output directory only to leave it out of a walk
    for (const f of VENDORED) copyFileSync(join(pkg, "dist", f), join(VENDOR_DIR, f));
    writeFileSync(join(VENDOR_DIR, "LICENSE.txt"), license(pkg, version));
    console.log(`  · vendored @hpcc-js/wasm-graphviz ${version} → ${VENDOR_DIR}`);
  }
}
