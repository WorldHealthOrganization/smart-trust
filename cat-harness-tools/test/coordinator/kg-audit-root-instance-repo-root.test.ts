/**
 * `kg-audit-root-instance` tests that read the aggregate repository's own root
 * — the root layer declaration — moved here from
 * `cat-harness-tools/scripts/tests/kg/kg-audit-root-instance.test.ts` (bean `ho66`), as
 * `merge-guard-workflows.test.ts` was: a standalone cat-harness layer has no
 * such root, and `check:cat-harness-standalone` collects every test in that
 * layer. The rest of that file's tests stay there.
 *
 * Moved again, from `cat-harness-tools/scripts/tests/` to the checkout's own
 * test home `test/` (bean `7zz1`, owner ruling 2026-10-06 "Top-level
 * instance"): what it reads belongs to the whole checkout, which the root
 * layer declares, not to any one layer — so cat-harness-tools stays green
 * standing alone too.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { layerRootsIn, readDeclaration } from "../../schemas/kg/cat-harness.js";

/**
 * The directory this test was written in (`cat-harness/scripts/tests/`): every path below
 * is composed from it exactly as it was before the move, so nothing it reads changed.
 */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

const REPO = resolve(ORIGIN_DIR, "../../..");

describe("kg:audit over the instance declared at the repository root (bean `pgzn`)", () => {
  // `pgzn` was a layer sitting AT the repository root that kg:audit never
  // reached. This asserted the root was declared, so that case had a subject.
  //
  // RESTATED 2026-10-09: the owner removed the root declaration on 2026-10-08
  // (3d4caf6: "should not need folio-assistant declared at all"), and its
  // repository-scoped state graphs are cat-harness's now (coordinator decision
  // (b), cat-harness#10). So there is no root layer for kg:audit to miss --
  // which is itself the property to pin, because a root declaration coming
  // back would bring `pgzn` back with it. The non-vacuity half moves to what
  // the root DOES hold: an index whose every layer is a declared layer
  // below it, so each is reached as a nested layer.
  test("the repository root declares no instance, so nothing escapes kg:audit by sitting at the root", () => {
    expect(readDeclaration(REPO)).toBeUndefined();
  });

  test("every instance the root's index lists is declared below it — the cases kg:audit does reach", () => {
    const index = JSON.parse(readFileSync(join(REPO, "index.config.json"), "utf-8")) as {
      instances?: { name: string }[];
      layers?: { name: string }[];
    };
    const names = (index.instances ?? index.layers ?? []).map((i) => i.name);
    expect(names.length).toBeGreaterThan(0);
    const roots = layerRootsIn(REPO).filter((r) => r !== REPO);
    const declared = new Set(roots.map((r) => readDeclaration(r)?.name));
    expect(names.filter((n) => !declared.has(n))).toEqual([]);
  });
});
