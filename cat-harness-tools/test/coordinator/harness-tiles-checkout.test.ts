/**
 * `harness-tiles` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness-tools/scripts/tests/kg/harness-tiles.test.ts` (bean `7zz1`, owner ruling
 * 2026-10-06 "Top-level instance"): each reads who-iris's own theme, which
 * only the checkout holds. Standing alone, cat-harness has none of it, and
 * `check:cat-harness-standalone` collects every test in that layer. The rest
 * of that file's tests stay there; every path here is composed from
 * ORIGIN_DIR, the directory they were written in, so nothing they read
 * changed.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { harnessTiles } from "../../scripts/harness-tiles.js";

/** The directory these tests were written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move, so nothing they read changed. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

describe("an instance's OWN theme tones its tile (bean v8n5)", () => {
  // Over THIS repository, because the subject is a real reference: who-iris's
  // card cites `{instance: "who-iris", themeId: "iris-sticky"}`, a theme the
  // platform does not hold. If resolution fell back to the platform default,
  // or the tone to the avatar registry, the tile would still render — on the
  // wrong hue — which is why this is a test and not a glance.
  const REPO = join(ORIGIN_DIR, "..", "..", "..");
  const HOST = join(REPO, "cat-harness");
  const tiles = harnessTiles(REPO, HOST, ["who-iris", "cat-harness", "bootstrap"]);

  test("who-iris's tile tone is the hue of its own theme's accent, not the avatar's", async () => {
    const { themeByRef } = await import("../../schemas/ui/theme-by-ref.js");
    const { hexHue } = await import("../../schemas/ui/theme.js");
    const r = themeByRef({ instance: "who-iris", themeId: "iris-sticky" }, REPO);
    expect(r.ok).toBe(true);
    const who = tiles.find((t) => t.name === "who-iris")!;
    expect(who.toneFrom).toBe("theme");
    expect(who.tone).toBe(hexHue(r.ok ? r.theme.palette.accent : "")!);
    expect(who.findings.join(" ")).not.toContain("not installed");
  });
});

describe("a site sub-graph links where its index.md is PUBLISHED (fa#2739)", () => {
  // cat-harness's `docs/start/index.md` is served at `/docs/cat-harness/start/`
  // by the site's permalink defaults. The tile linked its source path,
  // `/start/`, and nothing is served there.
  const REPO = join(ORIGIN_DIR, "..", "..", "..");
  const tiles = harnessTiles(REPO, join(REPO, "cat-harness"), ["cat-harness"]);

  test("the Doc group row opens the published start page", () => {
    const cat = tiles.find((t) => t.name === "cat-harness")!;
    const group = (cat.visualisations ?? []).find((v) => v.kind === "doc-group");
    expect(group?.path).toBe("/docs/cat-harness/start/");
  });
});

describe("each harness carries its page ground (bean yj32, owner Q-DEP-2 A)", () => {
  // The owner, 2026-11-01: a harness's theme art goes "behind every docs page".
  // Over THIS checkout, because the subject is the real theme-to-image join:
  // cat-harness's own sticky names `grumpy-cyborg-agents`, whose role it
  // declares in all three crops.
  const REPO = join(ORIGIN_DIR, "..", "..", "..");
  const tiles = harnessTiles(REPO, join(REPO, "cat-harness"), ["cat-harness", "folio-assistant-core", "bootstrap"]);
  const ground = (name: string) => tiles.find((t) => t.name === name)?.pageGround;

  test("the site owner's ground is the fallback, never a `/` scope", () => {
    const g = ground("cat-harness")!;
    expect(g.siteDefault).toBe(true);
    expect(g.scopes).not.toContain("/");
    expect(g.scopes).toContain("/cat-harness/");
  });

  test("a ground is all three crops or none", () => {
    for (const t of tiles) {
      const art = t.pageGround?.art;
      if (art === undefined) continue;
      expect(Object.keys(art).sort()).toEqual(["card", "laptop", "mobile"]);
      for (const src of Object.values(art)) expect(src.startsWith("/")).toBe(true);
    }
  });

  test("the content core's ground is its own theme's art, not the platform's", () => {
    const core = ground("folio-assistant-core")?.art;
    const cat = ground("cat-harness")?.art;
    expect(core).toBeDefined();
    expect(core!.laptop).not.toBe(cat?.laptop);
  });
});
