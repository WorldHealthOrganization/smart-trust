/**
 * `library-links` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness-tools/scripts/tests/library/library-links.test.ts` (bean `7zz1`, owner ruling
 * 2026-10-06 "Top-level instance"): each reads the library entries of the
 * content layers, which only the checkout holds. Standing alone,
 * cat-harness has none of it, and `check:cat-harness-standalone` collects
 * every test in that layer. The rest of that file's tests stay there; every
 * path here is composed from ORIGIN_DIR, the directory they were written in,
 * so nothing they read changed.
 */
import { describe, expect, it } from "bun:test";
// Publish-time files are written to the layer output overlay (bean sm8r);
// these read the copy a site reader sees, falling back to the path given.
import { existsSync, readFileSync } from "../support/site-fs.ts";
import { join, resolve } from "node:path";

import { forgeLocation, siteDirFor } from "../../schemas/kg/cat-harness.ts";
import { libraryResolver } from "../../scripts/lib/library-links.ts";
import { pageParts } from "../../scripts/viewer-declarations.ts";
import { visualiserRoute } from "../../schemas/kg/visualiser-route.ts";
import { siteNotBuilt } from "../support/checkout.ts";

/** The directory these tests were written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move, so nothing they read changed. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

const INSTANCE = resolve(ORIGIN_DIR, "..", "..");
const REPO = resolve(INSTANCE, "..");
const r = libraryResolver(REPO, INSTANCE);
const INDEX = join(INSTANCE, siteDirFor(INSTANCE), "assets", "library", "index.json");
/** The projection is written at publish and gitignored (bean w1gy F18). */
const NOT_BUILT = siteNotBuilt("the library projection `library:viz` writes at publish (gitignored)", INDEX);
const entries = NOT_BUILT
  ? []
  : (
      JSON.parse(readFileSync(INDEX, "utf-8")) as {
        entries: { id: string; instance: string; dir: string }[];
      }
    ).entries;

describe.skipIf(NOT_BUILT)("a library reference resolves only where its target exists", () => {
  it("links every projected item to its viewer page and README", () => {
    // The premise: a resolver over no entries would pass the loop vacuously.
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) {
      const l = r.links(e.id, e.instance);
      // The key the viewer's honourAnchor matches: `<instance>/<id>`, on the
      // layer's page at the declared route, under the page locale
      // (`en/cat-harness/library/<instance>/`, folio-assistant#2527) — asked,
      // never spelled: `cat-harness/library/` is only a forwarding page now.
      const page = visualiserRoute(pageParts({ harness: "cat-harness", visualiser: "library", subgraph: e.instance })).replace(/\/?$/, "/");
      expect(l?.viewer, e.id).toBe(`${page}#${encodeURIComponent(`${e.instance}/${e.id}`)}`);
      // A remote-mounted layer's README is in ITS repository (bean `nn8e`), so
      // the path to expect is the one inside the repository that holds it.
      if (existsSync(join(REPO, e.dir, "README.md"))) expect(l?.readme, e.id).toContain(`/${forgeLocation(e.dir, "", REPO).path}/README.md`);
    }
  });
});
