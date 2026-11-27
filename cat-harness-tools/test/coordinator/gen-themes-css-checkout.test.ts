/**
 * `gen-themes-css` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness-tools/scripts/tests/ui/gen-themes-css.test.ts` (bean `7zz1`, owner
 * ruling 2026-10-06 "Top-level instance"): each reads every layer's sticky
 * themes, which only the checkout holds. Standing alone, cat-harness has none
 * of it, and `check:cat-harness-standalone` collects every test in that layer.
 * The rest of that file's tests stay there; every path here is composed from
 * ORIGIN_DIR, the directory they were written in, so nothing they read
 * changed.
 *
 * The stylesheet is BUILT AT PUBLISH since litlfred/cat-harness#371, so it is
 * built here when the checkout does not have it (`ensureThemesCss`), as
 * `todos-repo-root.test.ts` builds `todos/index.md`; a generator that cannot
 * run here is not itself a failure, and the tests below then fail on the
 * missing file under their own names.
 */
import { beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { instanceStickyThemes } from "../../schemas/ui/theme-by-ref.js";
import { THEMES } from "../../schemas/ui/themes.js";
import { ensureThemesCss } from "../support/themes-css.ts";

/** The directory these tests were written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move, so nothing they read changed. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

const ROOT = join(ORIGIN_DIR, "..", "..");
const REPO = resolve(ROOT, "..");

describe("the committed stylesheet carries every instance sticky theme here", () => {
  // Read in the tests, not while the describe is collected: a missing file
  // then fails each test by name instead of the whole file at load.
  let path = "";
  beforeAll(() => {
    path = ensureThemesCss(ROOT);
  }, 180_000);
  const css = () => readFileSync(path, "utf8");
  const { themes, conflicts } = instanceStickyThemes(REPO, "cat-harness", new Set(THEMES.map((t) => t.id)));

  test("there is at least one to check, and no collision", () => {
    expect(themes.length).toBeGreaterThan(0);
    expect(conflicts).toEqual([]);
  });

  test.each(themes.map((t) => [`${t.instance}:${t.theme.id}`, t] as const))(
    "%s has a block with its own accent — a card citing it does not fall back to the default",
    (_, t) => {
      const committed = css();
      const start = committed.indexOf(`[data-fa-sticky-theme="${t.theme.id}"] {`);
      expect(start).toBeGreaterThan(-1);
      const block = committed.slice(start, committed.indexOf("}", start));
      expect(block).toContain(`--fa-sticky-accent: ${t.theme.palette.accent};`);
    },
  );
});
