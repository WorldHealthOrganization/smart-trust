/**
 * `theme-by-ref` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness/schemas/theme-by-ref.test.ts` (bean `7zz1`, owner ruling
 * 2026-10-06 "Top-level instance"): each resolves who-iris's own themes, which
 * only the checkout holds. Standing alone, cat-harness has none of it, and
 * `check:cat-harness-standalone` collects every test in that layer. The rest
 * of that file's tests stay there; every path here is composed from
 * ORIGIN_DIR, the directory they were written in, so nothing they read
 * changed.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { join, resolve } from "node:path";

import { instanceStickyThemes, themeByRef } from "../../schemas/ui/theme-by-ref.ts";
import { THEMES } from "../../schemas/ui/themes.ts";

/** The directory these tests were written in (`cat-harness/schemas/`): every path below is composed from it exactly as it was before the move, so nothing they read changed. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/schemas");

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

describe("over this repository", () => {
  test("who-iris's own theme resolves by reference, with no WHO value in the platform", () => {
    const repoRoot = resolve(ORIGIN_DIR, "..", "..");
    const r = themeByRef({ instance: "who-iris", themeId: "iris-web" }, repoRoot);
    expect(r.ok).toBe(true);
    expect(r.ok && r.theme.kind).toBe("webpage");
    expect(THEMES.some((t) => t.id === "iris-web")).toBe(false);
  });
});

describe("instanceStickyThemes — every instance's sticky themes, for the board stylesheet", () => {

  test("over this repository: who-iris's iris-sticky is found, and holds iris-web's accent", () => {
    const repoRoot = resolve(ORIGIN_DIR, "..", "..");
    const { themes, conflicts } = instanceStickyThemes(repoRoot, "cat-harness", new Set(THEMES.map((t) => t.id)));
    expect(conflicts).toEqual([]);
    const iris = themes.find((t) => t.instance === "who-iris" && t.theme.id === "iris-sticky");
    expect(iris).toBeDefined();
    const web = themeByRef({ instance: "who-iris", themeId: "iris-web" }, repoRoot);
    expect(web.ok && iris!.theme.palette.accent).toBe(web.ok ? web.theme.palette.accent : "");
  });
});
