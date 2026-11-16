/**
 * `library-withheld` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness-tools/scripts/tests/library/library-withheld.test.ts` (bean `7zz1`, owner
 * ruling 2026-10-06 "Top-level instance"): each reads a who-iris library
 * entry, which only the checkout holds. Standing alone, cat-harness has none
 * of it, and `check:cat-harness-standalone` collects every test in that layer.
 * The rest of that file's tests stay there.
 *
 * ## The fixture, declared here rather than assumed of a folio
 *
 * Owner ruling 2026-10-09 (litlfred/folio-assistant#2521, ruling 2, option b):
 * withheld-viewer tests use a TEST-ONLY fixture. Until then this half read
 * `who-iris/library/withheld.json` and judged the COMMITTED viewer data
 * against it. The owner cleared every who-iris entry on 2026-10-08, so that
 * list is empty by design, its guard failed, and every per-entry assertion
 * below had nothing to run over.
 *
 * So the input is now a fixture — the approach cat-harness#45 took for
 * `library-withheld-viewer.e2e.ts`, with the same entry: a scratch checkout
 * holding ONE real who-iris entry (`who-pub-tps-931`, its blocks and its
 * cover) under a `withheld.json` that names it, in the shape
 * `gen-iris-pages.ts` writes (the 2026-10-07 gates and catalogue record). The
 * viewer data is then derived by the generator's OWN functions —
 * `readLibraryGraph`, `projection`, `entryBlocks`, `avatarCopies`, which
 * `library:viz` itself calls — never re-implemented here. Every assertion
 * below is the one this file made of the committed data.
 *
 * What the committed data still gets: `library:viz:check` regenerates it from
 * the real list and fails on any difference, so "the committed data is the
 * generator's output" and "the generator honours a list" are each proved, by
 * that gate and by this file.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { withheldPaths } from "../../scripts/lib/withheld.ts";
import { avatarCopies, entryBlocks, projection } from "../../scripts/gen-library-viz.ts";
import { readLibraryGraph } from "../../scripts/library-graph.ts";
import { writeDeclaration } from "../support/instance-fixture.js";

/** The directory these tests were written in (`cat-harness/scripts/tests/`): every checkout path below is composed from it exactly as it was before the move. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

const REPO = resolve(ORIGIN_DIR, "..", "..", "..");
const SOURCE_LIBRARY = join(REPO, "who-iris", "library");

/** The withheld entry — cat-harness#45's, in `gen-iris-pages.ts`'s shape. */
const FIXTURE = {
  path: "who-pub-tps-931/",
  reason: 'item/b08c6c19-315a-41a4-a9cb-8edabdbc6791 ORIGINAL "WHO_PUB_TPS_93.1.pdf": copyright refused, restrictions refused',
  gates: [
    { gate: "copyright", verdict: "refused" },
    { gate: "restrictions", verdict: "refused" },
  ],
  record: {
    id: "item/b08c6c19-315a-41a4-a9cb-8edabdbc6791",
    page: "/who-iris/item-item-b08c6c19-315a-41a4-a9cb-8edabdbc6791.html",
    uri: "https://hdl.handle.net/10665/36842",
  },
};
const SLUG = FIXTURE.path.slice(0, -1);

const scratch: string[] = [];
afterAll(() => scratch.forEach((d) => rmSync(d, { recursive: true, force: true })));

/**
 * A scratch checkout: `who-iris/` declaring one library directory, holding
 * the real entry and its cover, and — when `withhold` — the fixture's list.
 * `withhold: false` is the mutation the guard below exists to catch.
 */
function fixtureCheckout(withhold: boolean): { root: string; lib: string; site: string } {
  const root = mkdtempSync(join(tmpdir(), "withheld-checkout-"));
  scratch.push(root);
  const inst = join(root, "who-iris");
  const lib = join(inst, "library");
  mkdirSync(lib, { recursive: true });
  writeDeclaration(
    inst,
    JSON.stringify({ name: "who-iris", directories: [{ id: "library", path: "library", graphTypologies: ["library"] }] }),
  );
  cpSync(join(SOURCE_LIBRARY, SLUG), join(lib, SLUG), { recursive: true });
  cpSync(join(SOURCE_LIBRARY, `${SLUG}-cover.png`), join(lib, `${SLUG}-cover.png`));
  if (withhold) {
    writeFileSync(join(lib, "withheld.json"), JSON.stringify({ $schema: "folio-withheld/v1", paths: [FIXTURE] }, null, 2));
  }
  return { root, lib, site: join(root, "site") };
}

/** The viewer data for a fixture checkout, derived by the generator's own functions. */
function viewerData(withhold: boolean) {
  const { root, lib, site } = fixtureCheckout(withhold);
  const g = readLibraryGraph([join(root, "who-iris")], root);
  if (g === null) throw new Error("the fixture's library was not found — the fixture, not the generator, is broken");
  const blocks = entryBlocks(g, root);
  const index = projection(g, {}) as { entries: { id: string; withheld?: string; avatar?: unknown }[] };
  const avatars = avatarCopies(g, site, root);
  return { lib, site, index, blocks, avatars };
}

describe("the viewer data honours who-iris's withheld list — over a declared fixture", () => {
  const { lib, site, index, blocks, avatars } = viewerData(true);
  const slugs = withheldPaths(lib).filter((p) => !p.includes("."));

  test("the list names at least one entry — else this half proves nothing", () => {
    expect(slugs.length).toBeGreaterThan(0);
    // ...and the entry it names is really in the library the generator read.
    expect(index.entries.map((e) => e.id)).toContain(SLUG);
  });

  test.each(slugs.map((slug): [string] => [slug]))("%s: flagged, no prose excerpt, no avatar", (slug) => {
    const e = index.entries.find((x) => x.id === slug);
    expect(e?.withheld).toBeTruthy();
    expect(e?.avatar).toBeUndefined();

    const data = { blocks: blocks.get(slug) ?? [] };
    // Non-vacuous: the entry HAS prose blocks; only their excerpt is gone.
    expect(data.blocks.some((b) => b.kind === "prose")).toBe(true);
    expect(data.blocks.filter((b) => b.kind === "prose" && b.content !== null)).toEqual([]);
    expect(avatars.has(join(site, "assets", "library", "avatars", "who-iris", `${slug}.png`))).toBe(false);
    expect(existsSync(join(site, "assets", "library", "avatars", "who-iris", `${slug}.png`))).toBe(false);
  });

  test("the fixture is what is tested: the same entry, NOT withheld, publishes all three", () => {
    // The mutation check, kept as a test so it runs on every run: the
    // fixture's list removed, the derivation hands back the excerpt, the
    // cover and no flag — so the assertions above fail without it.
    const open = viewerData(false);
    const e = open.index.entries.find((x) => x.id === SLUG);
    expect(e?.withheld).toBeUndefined();
    expect(e?.avatar).toBeDefined();
    expect((open.blocks.get(SLUG) ?? []).some((b) => b.kind === "prose" && b.content !== null)).toBe(true);
    expect(open.avatars.has(join(open.site, "assets", "library", "avatars", "who-iris", `${SLUG}.png`))).toBe(true);
  });
});
