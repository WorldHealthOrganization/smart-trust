/**
 * A `builtOnHostSite` visualiser's sub-graph page is built at publish on the
 * host site (`derive:publish`'s `hostSiteArtefacts`), so `viewersOf` credits it
 * downstream and names the `renderedBy` Tool's script as its writer.
 *
 * The case that went unseen (dth-sfp, smart-base's `l1-extraction`): a
 * kind-covering, `subgraphs: "instance"` visualiser whose page its declaring
 * layer builds only on its OWN site was dropped in every checkout where
 * another layer owns the site, and `check:subgraph-coverage` read its
 * directory as having no visualiser. Declared `builtOnHostSite`, the page is
 * built wherever its subjects are hosted, and the reader must agree.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { visualisationResolves } from "../../../schemas/kg/cat-harness.js";
import { clearDeclaredVisualisers, declaredVisualisers, hostSiteWriter, viewersOf } from "../../viewer-declarations.js";

/** `base` owns the site (named cat-harness); `lower` declares the visualiser, its Tool and its directory. */
function checkout(visualiser: Record<string, unknown>, shell = "bun run cat lower:extraction:pages"): string {
  const repo = mkdtempSync(join(tmpdir(), "host-site-viewer-"));
  const files: Record<string, unknown> = {
    "base/cat-harness.json": { name: "cat-harness", directories: [] },
    "lower/lower.json": {
      name: "lower",
      needs: ["cat-harness"],
      directories: [
        { id: "lower-tools", path: "tools/", graphTypologies: ["tools"] },
        { id: "extraction-x", path: "extractions/x/", graphTypologies: ["library"] },
      ],
      visualisers: [{ id: "extraction", renderedBy: "extraction-pages", coversKinds: ["library"], subgraphs: "instance", ...visualiser }],
    },
    "lower/tools/extraction-pages/extraction-pages.json": {
      $schema: "tool-definition/v1",
      tool: {
        id: "extraction-pages",
        title: "Extraction pages",
        description: "Draw the extraction pages.",
        install: { none: true },
        invoke: { shell },
        io: { inputs: [], outputs: [] },
        satisfies: ["graph-rendering"],
      },
    },
    "lower/package.json": { name: "lower", checkoutScripts: { "lower:extraction:pages": "bun run lower/scripts/gen-extraction-pages.ts" } },
  };
  for (const [f, body] of Object.entries(files)) {
    mkdirSync(join(repo, dirname(f)), { recursive: true });
    writeFileSync(join(repo, f), JSON.stringify(body));
  }
  mkdirSync(join(repo, "lower/extractions/x"), { recursive: true });
  mkdirSync(join(repo, "lower/scripts"), { recursive: true });
  writeFileSync(join(repo, "lower/scripts/gen-extraction-pages.ts"), "export {};\n");
  clearDeclaredVisualisers();
  return repo;
}

const DIR = { id: "extraction-x", path: "extractions/x/", graphTypologies: ["library"] } as const;

describe("viewersOf and a visualiser built on the host site", () => {
  test("not builtOnHostSite, its page built only on its own site: no viewer downstream, as before", () => {
    const repo = checkout({});
    expect(viewersOf(DIR, join(repo, "lower"), repo)).toEqual([]);
  });

  test("builtOnHostSite: its sub-graph view is credited, with the Tool's script as writer", () => {
    const repo = checkout({ builtOnHostSite: {} });
    const v = declaredVisualisers(repo).find((x) => x.id === "extraction")!;
    expect(hostSiteWriter(repo, v)).toEqual(["lower/scripts/gen-extraction-pages.ts"]);
    const got = viewersOf(DIR, join(repo, "lower"), repo);
    expect(got).toHaveLength(1);
    expect(got[0]!.ref).toContain("/lower/extraction/lower/");
    expect(got[0]!.writer).toEqual(["lower/scripts/gen-extraction-pages.ts"]);
    // What check:subgraph-coverage asks of it: the page resolves by its writer.
    expect(visualisationResolves(got[0]!, (r) => existsSync(join(repo, r)))).toBe(true);
  });

  test("builtOnHostSite with a Tool shell derive:publish refuses: not credited", () => {
    const repo = checkout({ builtOnHostSite: {} }, "bun run lower/scripts/gen-extraction-pages.ts --all");
    expect(viewersOf(DIR, join(repo, "lower"), repo)).toEqual([]);
  });
});
