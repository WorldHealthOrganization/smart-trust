/**
 * who-iris's Tool nodes — the `tools` graph for this instance.
 *
 * @module who-iris/tools
 * @graphNode tool
 *
 * ## Why this exists — owner, 2026-10-09
 *
 * > I still want the harness to be where specific visualizers/pages are
 * > declared for the harness at the level … Need harness to declare
 * > visualizer is renderedBy ....
 *
 * who-iris's catalogue page is a visualiser this instance declares in
 * `who-iris.json` `visualisers`, and a visualiser is `renderedBy` a Tool
 * node. The page's generator, `scripts/gen-iris-pages.ts`, had no node — it
 * was named in a test's exception list as "drawn by who-iris's own
 * generator, which declares no tools graph". This is that node: what the
 * generator is, how it is invoked, and which kind it can draw. The
 * declaration says what it DOES draw, and where:
 * `<base>/who-iris/catalogue/`.
 *
 * The Tool itself is declared in `iris-pages/iris-pages.ts`, one folder per
 * Tool (bean `tdir`); this file only loads the folders.
 *
 * Discovered like every instance's Tools (`cat-harness/tools/discover.ts`,
 * bean `p0za`): this directory is declared with graph typology `tools`, and
 * nothing imports it by name.
 */
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { toolsFromFolders, type ToolDefinition } from "../platform.ts";

export function tools(baseUrl?: string): ToolDefinition[] {
  return toolsFromFolders(dirname(fileURLToPath(import.meta.url)), baseUrl ?? "");
}
