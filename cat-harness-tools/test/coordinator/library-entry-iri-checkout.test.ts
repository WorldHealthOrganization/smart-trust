/**
 * `library-entry-iri` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness-tools/scripts/tests/library/library-entry-iri.test.ts` (bean `7zz1`, owner
 * ruling 2026-10-06 "Top-level instance"): each reads the library entries of
 * smart-base, smart-trust and fhir-harness, which only the checkout holds.
 * Standing alone, cat-harness has none of it, and
 * `check:cat-harness-standalone` collects every test in that layer. The rest
 * of that file's tests stay there; every path here is composed from
 * ORIGIN_DIR, the directory they were written in, so nothing they read
 * changed.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "../support/site-fs.ts";
import { join, resolve } from "node:path";

import { entryView, instanceRootRoutes } from "../../scripts/gen-library-viz.ts";
import { LibraryIndexSchema } from "../../schemas/ui/site-indexes.ts";
import { siteDirFor } from "../../schemas/kg/cat-harness.ts";
import { libraryAssetIri, libraryAssetSitePath } from "../../schemas/library/library-iri.ts";
import { notApplicableAlone, siteNotBuilt } from "../support/checkout.ts";

/** The directory these tests were written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move, so nothing they read changed. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

const HARNESS = resolve(ORIGIN_DIR, "../..");
const REPO = resolve(HARNESS, "..");
const SITE = join(HARNESS, siteDirFor(HARNESS));
const INDEX = join(SITE, "assets", "library", "index.json");
/** The projection and the entry files it lists are written at publish and gitignored (bean w1gy F18). */
const NOT_BUILT = siteNotBuilt("the library projection `library:viz` writes at publish (gitignored)", INDEX);

describe("asset and rendering: two resources, two IRIs (owner, 2026-10-02)", () => {
  // "each asset should have one IRI, but the view page is a rendering of that
  // asset, a different page. fix IRIs" — and "asset doesnt know about its
  // renderings".
  test.skipIf(NOT_BUILT)("every entry's @id IS the address of its published JSON-LD, and that file is published", () => {
    const index = LibraryIndexSchema.parse(JSON.parse(readFileSync(INDEX, "utf-8")));
    // An item catalogued BY REFERENCE (`referencedCatalogueEntries`) holds no
    // bytes here: no `<library>/<slug>/`, no manifest, no asset JSON-LD; it is
    // a page only. Every HELD entry must still carry its asset.
    const held = index.entries.filter((e) => e.provenance !== "catalogued");
    expect(held.length).toBeGreaterThan(0);
    for (const e of index.entries.filter((x) => x.provenance === "catalogued")) {
      expect(existsSync(join(REPO, e.dir)), e.dir).toBe(false);
    }
    for (const e of held) {
      const m = JSON.parse(readFileSync(join(REPO, e.dir, "manifest.jsonld"), "utf-8")) as { "@id": string };
      expect(m["@id"], e.dir).toBe(libraryAssetIri(e.instance, e.id));
      const published = join(SITE, libraryAssetSitePath(e.instance, e.id));
      expect(existsSync(published), published).toBe(true);
      expect((JSON.parse(readFileSync(published, "utf-8")) as { "@id": string })["@id"]).toBe(m["@id"]);
    }
  });
  test("entryView takes a link only when it is a DECLARED root, never any page", () => {
    const roots = new Map([["smart-trust", "/smart-trust/"]]);
    expect(entryView({ links: [{ href: "/smart-trust/" }] }, roots, "x/y/z")).toBe("/smart-trust/");
    expect(entryView({ links: [{ href: "/somewhere-else/" }] }, roots, "x/y/z")).toBe("/x/y/z/");
    expect(entryView({}, roots, "x/y/z")).toBe("/x/y/z/");
  });
  // smart-trust is a layer above the harness, held only by the composed checkout.
  const noSmartTrust =
    !existsSync(join(REPO, "smart-trust")) && notApplicableAlone("smart-trust's checkout, whose declared root this reads (a higher instance)");
  test.skipIf(noSmartTrust)("and smart-trust's declared root is the route its entries take", () => {
    expect(instanceRootRoutes(REPO).get("smart-trust")).toBe("/smart-trust/");
  });
});
