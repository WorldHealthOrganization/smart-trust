/**
 * The cache scripts' BUILT-IN family names agree with each other.
 *
 * `special-branches.json` used to be the one place these names lived, with a
 * test that every copy agreed with it. The owner removed it on 2026-10-05
 * (*"dont use /get rid of"*): a family's name is now the declaring folio's
 * `storage.branchPrefix`, read first by every script, and each script keeps
 * the same built-in names only as a fallback when nothing is declared. So the
 * drift worth catching is between the scripts themselves — one script whose
 * fallback list lost a name, or reordered it, resolves a different branch from
 * the rest when no declaration is present.
 *
 * A cache family whose scripts live in a layer above is tested by that layer:
 * the Lean cache scripts and the folio template's restore action moved up
 * (folio-assistant#2598, move M11), and a test here naming their paths would be
 * this layer naming one above it.
 *
 * Each script names the names as whole tokens: `lake-cache` is a substring of
 * both newer names, so a bare `toContain` would pass a file that never names it.
 *
 * @module cat-harness-tools/scripts/tests/cache-family-fallbacks
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { notApplicableAlone } from "../../test/support/checkout.ts";

const REPO = resolve(import.meta.dir, "..", "..", "..");

/**
 * Newest first: the name a script writes when nothing exists, then the names it
 * had before. The old names are being retired (bean `oycs`, 2026-10-24), so a
 * script may list the new name alone or with a leading run of the old ones;
 * either way the new name comes first and the order never changes. This holds
 * on both sides of fhir-harness#150, so the layers can merge in either order.
 */
const FAMILIES = {
  "fhir-ast": {
    names: ["cat/fhir-harness/fhir-ast", "cat-fhir-ast", "fhir-ast"],
    files: ["fhir-harness/scripts/ig-cache.sh"],
  },
} as const;

describe("cache scripts carry the built-in family names newest first, and none unknown", () => {
  const rows = Object.entries(FAMILIES).flatMap(([family, { names, files }]) => files.map((file) => [file, family, names] as const));
  describe.each(rows)("%s (%s)", (file, family, names) => {
    // The script is in the layer that owns the family (`fhir-harness`), a
    // higher layer a standalone checkout does not hold (bean w1gy F18).
    const absent = !existsSync(resolve(REPO, file)) && notApplicableAlone(`${file}, in ${file.split("/")[0]}'s checkout (a higher instance)`);
    test.skipIf(absent)("its fallback list is a newest-first prefix of the known names", () => {
      const text = readFileSync(resolve(REPO, file), "utf-8");
      const m = /for p in ((?:"[^"]+"\s*)+); do/.exec(text);
      expect(m, `${file} writes its list as one \`for p in "…"; do\` literal`).not.toBeNull();
      const listed = [...m![1]!.matchAll(/"([^"]+)"/g)].map((x) => x[1]!.replace(/\/$/, ""));
      expect(listed.length).toBeGreaterThanOrEqual(1);
      expect(listed).toEqual(names.slice(0, listed.length));
    });
  });
});
