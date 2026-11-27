/**
 * `kg-subscriptions` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness-tools/scripts/tests/kg/kg-subscriptions.test.ts` (bean `7zz1`, owner
 * ruling 2026-10-06 "Top-level instance"): each derives the staged layers
 * of the checkout, which only the checkout holds. Standing alone, cat-harness
 * has none of it, and `check:cat-harness-standalone` collects every test in
 * that layer. The rest of that file's tests stay there; every path here is
 * composed from ORIGIN_DIR, the directory they were written in, so nothing
 * they read changed.
 */
import { describe, expect, test } from "bun:test";

import { knownSubstrates } from "../../scripts/subscriptions-viz.ts";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";

/** The directory these tests were written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move, so nothing they read changed. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

describe("the known-substrates registry (subscriptions-viz)", () => {
  const REPO = resolve(ORIGIN_DIR, "../../..");

  // RESTATED 2026-10-09. This asserted the rule on the real checkout, where
  // folio-assistant-core was STAGED: declared with a `livesAt` in a repository
  // other than its own. Since cat-harness#15 every mounted layer's
  // `livesAt` names its own home, so nothing here is staged and no row is
  // derived as planned -- core became the repository it was planned to be.
  // The rule is unchanged and is asserted over a synthetic checkout, where a
  // staged layer can still exist; the real checkout asserts its half.
  test("a staged instance is DERIVED as planned — nobody keeps a second list of it", () => {
    const root = mkdtempSync(join(tmpdir(), "substrates-"));
    try {
      mkdirSync(join(root, ".git"));
      const instance = (name: string, extra: Record<string, unknown>) => {
        mkdirSync(join(root, name), { recursive: true });
        writeFileSync(join(root, name, `${name}.json`), JSON.stringify({ name, version: "0.1.0", repository: `o/${name}`, directories: [], ...extra }));
      };
      instance("staged", { livesAt: { repository: "o/host", path: "staged" } });
      instance("home", { livesAt: { repository: "o/home", path: "." } });
      const rows = knownSubstrates(root);
      const staged = rows.find((r) => r.name === "staged");
      expect(staged?.status).toBe("planned");
      expect(staged?.source).toBe("staged instance");
      expect(staged?.repository).toBe("o/staged");
      expect(rows.find((r) => r.name === "home")).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("this checkout stages nothing, so nothing is derived as planned — core is its own repository now", () => {
    const rows = knownSubstrates(REPO);
    expect(rows.filter((r) => r.source === "staged instance")).toEqual([]);
    expect(rows.find((r) => r.name === "folio-assistant-core")).toBeUndefined();
  });
});
