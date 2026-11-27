/**
 * ONE definition of "open beans" — bean `v215`.
 *
 * The icon row counted `draft + todo + in-progress`, the Beans tile counted
 * every bean, and the board's "open" counted `todo + in-progress`. This
 * holds the single definition every Beans badge now takes, and holds the
 * two committed projections the badges read to it.
 */
import { beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { OPEN_BEANS_UNIT, OPEN_STATUSES, openBeanCount } from "../bean-store-read.ts";
import { readTileCounts } from "../../schemas/ui/tile-count.ts";
import { siteDirFor } from "../../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { ensureDocsPages, siteNotBuilt } from "../../test/support/checkout.ts";
import { overlayPath } from "../lib/layer-output.ts";

const INSTANCE = join(HARNESS_ROOT);
const SITE = join(INSTANCE, siteDirFor(INSTANCE));
const json = (p: string) => JSON.parse(readFileSync(overlayPath(join(SITE, p)), "utf8")) as unknown;

describe("openBeanCount", () => {
  test("counts draft, todo and in-progress; not completed, scrapped or a bean with no status", () => {
    const beans = ["draft", "todo", "in-progress", "completed", "scrapped", undefined, "constructor"]
      .map((status) => ({ status }));
    expect(openBeanCount(beans)).toBe(3);
    expect([...OPEN_STATUSES].sort()).toEqual(["draft", "in-progress", "todo"]);
  });

  test("an empty store is zero, a real answer", () => {
    expect(openBeanCount([])).toBe(0);
  });
});

describe("the two projections every Beans badge reads agree", () => {
  beforeAll(() => {
    ensureDocsPages(INSTANCE);
  }, 180_000);
  // Standing alone, neither is built: `docs:pages` writes both at publish from
  // the composed bean store, and `assets/beans/` is gitignored (bean w1gy F18).
  const notBuilt = (...rels: string[]): boolean =>
    siteNotBuilt("the beans projections `docs:pages` writes at publish (gitignored)", ...rels.map((r) => overlayPath(join(SITE, r))));

  test.skipIf(notBuilt("assets/beans/index.json", "assets/beans/count.json"))("index.json's tile count (the glass and launcher tiles) equals count.json's (the icon row)", () => {
    const tile = readTileCounts(json("assets/beans/index.json")).get("beans");
    const row = readTileCounts(json("assets/beans/count.json")).get("beans");
    expect(tile).toBeDefined();
    expect(tile).toEqual(row);
    expect(tile!.unit).toBe(OPEN_BEANS_UNIT);
  });

  test.skipIf(notBuilt("assets/beans/index.json"))("and equals openBeanCount over the index's own items", () => {
    const doc = json("assets/beans/index.json") as { items: { status?: string }[] };
    expect(readTileCounts(doc).get("beans")!.count).toBe(openBeanCount(doc.items));
  });
});
