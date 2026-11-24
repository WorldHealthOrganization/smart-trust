/**
 * The pages `index:render` reads the presence of, built before it renders.
 *
 * @module cat-harness-tools/scripts/lib/index-pages
 *
 * The README's layer table links a declared `docs` directory only when it
 * is on disk (`pipeline/readme-sections.ts`), and an IG layer's `docs/` is
 * BUILT, by its `<instance>:pages` script, never committed. So the rendered
 * README depended on whether somebody had built the pages: the gate job, which
 * builds them, read one README; a checkout that had not, another
 * (`declared-assets > the provenance … is RENDERED`, folio-assistant#2544).
 *
 * Owner, 2026-10-14: "Build pages first". `index:render` and its check build
 * the declared pages first, so the links are always computed against a built
 * tree. A docs directory counts when its declaration names a `writer` (it is
 * built, not authored) and its layer's package declares `<instance>:pages`
 * (the convention every IG layer follows); one already on disk is not
 * rebuilt, since only its presence is read.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { readDeclaration } from "../../schemas/kg/cat-harness.js";

/** One page build the render needs first. */
export interface PagesBuild {
  instance: string;
  /** The package script, run as `bun run cat <script>` from the checkout root. */
  script: string;
  /** The built docs directories it is run for, relative to the layer. */
  dirs: string[];
}

/** The `<instance>:pages` script, when the layer's package declares it. */
function pagesScriptOf(instanceAbs: string, name: string): string | undefined {
  const p = join(instanceAbs, "package.json");
  if (!existsSync(p)) return undefined;
  try {
    const pkg = JSON.parse(readFileSync(p, "utf-8")) as { scripts?: Record<string, string>; checkoutScripts?: Record<string, string> };
    const script = `${name}:pages`;
    return pkg.scripts?.[script] !== undefined || pkg.checkoutScripts?.[script] !== undefined ? script : undefined;
  } catch {
    return undefined;
  }
}

/** The builds an index's render needs: built docs directories that are not on disk. */
export function pagesBuildsFor(root: string, instances: readonly { name: string; path: string }[]): PagesBuild[] {
  const out: PagesBuild[] = [];
  for (const { name, path } of instances) {
    const abs = join(root, path);
    let decl;
    try {
      decl = readDeclaration(abs);
    } catch {
      continue; // an unreadable declaration is the render's own finding
    }
    const dirs = (decl?.directories ?? [])
      .filter((d) => (d.graphTypologies ?? []).includes("docs" as never) && Array.isArray((d as { writer?: unknown }).writer) && ((d as { writer?: unknown[] }).writer ?? []).length > 0)
      .map((d) => d.path)
      .filter((p) => !existsSync(join(abs, p)));
    if (dirs.length === 0) continue;
    const script = pagesScriptOf(abs, name);
    if (script !== undefined) out.push({ instance: name, script, dirs });
  }
  return out;
}

/** Run each build from the checkout root. Returns the ones that failed. */
export function buildPages(root: string, builds: readonly PagesBuild[]): string[] {
  const failed: string[] = [];
  for (const b of builds) {
    // input-site: spawned #25652691 — a bun run cat <script> page build; the cone audits the child from its read set
    const r = spawnSync("bun", ["run", "cat", b.script], { cwd: root, stdio: ["ignore", "ignore", "inherit"] });
    if (r.status !== 0) failed.push(`${b.instance}: \`bun run cat ${b.script}\` exited ${r.status ?? r.signal}`);
  }
  return failed;
}
