/**
 * The library pages' source links over the WHOLE CHECKOUT (owner, 2026-10-15):
 * every href an entry page or the whole-library page links resolves to a file
 * the site holds, and the whole-library page lists the library of every
 * layer in the checkout that declares one — read from the declarations,
 * never named here. Lives in `test/coordinator/` with
 * `library-entry-iri-checkout.test.ts` for the same reason (bean `7zz1`):
 * standing alone, cat-harness holds none of these libraries.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
// Publish-time files are written to the layer output overlay (bean sm8r);
// these read the copy a site reader sees, falling back to the path given.
import { existsSync, readFileSync, statSync } from "../support/site-fs.ts";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve, sep } from "node:path";

import { entrySources, instanceSubgraphFile, librarySubgraphs } from "../../scripts/gen-library-viz.ts";
import { subgraphOutDir } from "../../scripts/gen-subgraph-jsonld.ts";
import { viewerPlacement } from "../../scripts/gen-schema-viz.ts";
import { entryGraphFiles } from "../../scripts/lib/library-entry-graphs.ts";
import { instanceOf } from "../../scripts/library-graph.ts";
import { declaredPageRoute } from "../../scripts/viewer-declarations.ts";
import { LibraryIndexSchema } from "../../schemas/ui/site-indexes.ts";
import { siteDirFor } from "../../schemas/kg/cat-harness.ts";
import { checkoutDirectoriesForGraph, corpusDirectoriesForGraph } from "../../schemas/kg/harness-config.js";
import { siteNotBuilt } from "../support/checkout.ts";

const TOOL = resolve(import.meta.dir, "../../scripts/gen-library-viz.ts");
const HARNESS = resolve(import.meta.dir, "../../../cat-harness");
const REPO = resolve(HARNESS, "..");
const SITE = join(HARNESS, siteDirFor(HARNESS));
// The segment the writer publishes under: the TOP-LEVEL declared directory, so
// a corpus declared from within a named sub-graph (cat-harness#1032:
// `library/corpus/`) publishes under `library` (gen-library-viz.ts `topOf`).
const SEG = ((d: string) => {
  const first = relative(HARNESS, d).split(sep)[0]!;
  return first === "" || first === ".." ? basename(d) : first;
})(corpusDirectoriesForGraph(HARNESS, "library")[0]!);
const { pageDir, dataDir } = viewerPlacement(SITE, declaredPageRoute(HARNESS, "library-viewer")!, SEG);
/**
 * The library projection and the viewer's pages are written at publish and
 * gitignored (bean w1gy F18). `describe` still runs its body, so an index
 * that is not built reads as empty and the tests over the site skip.
 */
const NOT_BUILT = siteNotBuilt(
  "the library projection and pages `library:viz` writes at publish (gitignored)",
  join(dataDir, "index.json"),
  join(pageDir, "index.html"),
);
type LibraryIndex = ReturnType<typeof LibraryIndexSchema.parse>;
const index: LibraryIndex = NOT_BUILT
  ? ({ entries: [] } as unknown as LibraryIndex)
  : LibraryIndexSchema.parse(JSON.parse(readFileSync(join(dataDir, "index.json"), "utf-8")));

describe.skipIf(NOT_BUILT)("source links resolve on the checkout's site", () => {
  test("every entry page's sources are files the site holds", () => {
    for (const e of index.entries) {
      const shellDir = join(pageDir, e.instance, e.id);
      const links = entrySources({
        site: SITE,
        dataDir,
        shellDir,
        instance: e.instance,
        entry: e,
        manifest: existsSync(join(REPO, e.dir, "manifest.jsonld")),
        files: e.withheld ? [] : entryGraphFiles(join(REPO, e.dir)),
      });
      for (const l of links) expect(existsSync(resolve(shellDir, l.href)), `${e.instance}/${e.id}: ${l.href}`).toBe(true);
    }
  });

  test("the whole-library page lists every instance in the checkout that declares a library, and its links resolve", () => {
    const pages = new Set(index.entries.map((e) => e.instance));
    const rows = librarySubgraphs({ harnessRoot: HARNESS, repoRoot: REPO, site: SITE, pageDir, pages, entries: index.entries });
    const declared = checkoutDirectoriesForGraph("library", REPO).map((d) => instanceOf(d, REPO));
    expect(rows.map((r) => r.instance)).toEqual([...new Set([...declared, ...pages])].sort());
    for (const r of rows) {
      if (r.page) expect(existsSync(join(pageDir, r.page, "index.html")), r.instance).toBe(true);
      if (r.jsonld) expect(existsSync(resolve(pageDir, r.jsonld)), r.jsonld).toBe(true);
    }
    // More than this harness's own library: the point of the owner's ask.
    expect(rows.filter((r) => r.jsonld !== undefined).length).toBeGreaterThan(1);
  });
});

describe("`--site <dir>` writes a per-repository site", () => {
  test("the subgraph JSON-LD is looked for under the site being written, at the path the subgraph writer uses", () => {
    const site = mkdtempSync(join(tmpdir(), "lib-site-"));
    expect(instanceSubgraphFile(HARNESS, site, "x")).toBeUndefined();
    const at = join(site, relative(siteDirFor(HARNESS), subgraphOutDir(HARNESS)), "x", "index.jsonld");
    mkdirSync(resolve(at, ".."), { recursive: true });
    writeFileSync(at, "{}");
    expect(instanceSubgraphFile(HARNESS, site, "x")).toBe(at);
  });

  test.skipIf(NOT_BUILT)("pages land under the given site at the same declared route, and this harness's own docs are untouched", () => {
    const site = mkdtempSync(join(tmpdir(), "lib-site-"));
    const own = join(pageDir, "index.html");
    const before = statSync(own).mtimeMs;
    const run = Bun.spawnSync(["bun", TOOL, "--site", site], { cwd: REPO, stdout: "pipe", stderr: "pipe" });
    expect(run.exitCode, run.stderr.toString()).toBe(0);
    const route = relative(SITE, pageDir);
    const html = readFileSync(join(site, route, "index.html"), "utf-8");
    expect(html).toContain('id="lib-subgraphs"');
    const first = index.entries[0]!;
    expect(existsSync(join(site, route, first.instance, first.id, "index.html"))).toBe(true);
    expect(statSync(own).mtimeMs).toBe(before);
  }, 60_000);
});
