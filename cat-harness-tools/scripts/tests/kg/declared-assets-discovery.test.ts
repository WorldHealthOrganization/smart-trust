/**
 * The declared-asset gate DISCOVERS layers, and refuses to find none.
 *
 * Bean `6tkl`. This gate has been bitten twice by the same shape.
 *
 * **First**, `DECLARED_INSTANCES = ["cat-harness", "bootstrap"]` was a
 * hand-kept list. After the `wggr` move it named a root carrying no
 * `harness.json`, so `declaredAssets` returned `[]` and the gate printed
 * *"1 declared asset across 2 instances, 0 findings"* over a file it had never
 * opened — a clean run across an empty set, in the one check whose whole
 * subject is a file nobody was looking at.
 *
 * **Second**, the list drifted again the moment `folio-assistant-core` became a
 * real layer on 2026-09-20: four declarations existed and two were checked,
 * so that layer's `README.md` was declared with `role: "instance-readme"`
 * and never verified.
 *
 * Discovery fixes the list. It does not fix the failure mode — a discovery
 * that finds nothing reported success until the guard these tests pin. The
 * lesson is the one the bean states: *"Discovery that finds zero instances
 * must FAIL rather than report a clean run."*
 *
 * @module cat-harness/scripts/tests/declared-assets-discovery.test
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { declaredInstances } from "../../check-declared-assets.js";
import { readDeclaration, repoRootFor } from "../../../schemas/kg/cat-harness.js";
import { writeDeclaration } from "../../../test/support/instance-fixture.js";

const ROOT = repoRootFor(resolve(import.meta.dir, "..", "..", ".."));

describe("instances are discovered, not listed", () => {
  test("this repository has at least three, and the next one needs no edit", () => {
    // The concrete regression: two were listed while four existed. Asserting
    // a FLOOR rather than an exact count, so adding a layer does not fail
    // a test whose subject is that adding one should require nothing.
    expect(declaredInstances(ROOT).length).toBeGreaterThanOrEqual(3);
  });

  test("folio-assistant-core is among them — the instance that was silently unchecked", () => {
    // `folio-assistant-core`, not `folio-assist-core`. The two spellings were a
    // live disagreement between `main` and PR #477 until the owner settled it
    // on 2026-09-20: the `cat-` prefix reaches the harness layer
    // (`bootstrap` -> `bootstrap`, taken from main) and does NOT extend to
    // `folio-assistant-*`, which keeps the long form.
    //
    // The layer this test is ABOUT is unchanged — it is still the one that
    // went silently unchecked while `declaredInstances` was a hardcoded pair.
    const names = declaredInstances(ROOT).map((p) => p.replace(ROOT + "/", ""));
    expect(names).toContain("folio-assistant-core");
  });

  test("the root declares no instance, so it is not among them", () => {
    // The root BECAME a layer during this work, and this asserted that it
    // counted. RESTATED 2026-10-09: the owner removed that declaration
    // (3d4caf6, 2026-10-08: "should not need folio-assistant declared at
    // all"), so the checkout root is an index and discovery must not invent a
    // layer there. Discovered, not listed, in both directions.
    expect(readDeclaration(ROOT)).toBeUndefined();
    expect(declaredInstances(ROOT)).not.toContain(ROOT);
  });

  test("a directory with no harness.json is NOT an instance", () => {
    const root = mkdtempSync(join(tmpdir(), "assets-none-"));
    mkdirSync(join(root, "not-an-instance"), { recursive: true });
    expect(declaredInstances(root)).not.toContain(join(root, "not-an-instance"));
  });

  test("a nested harness.json IS discovered — declaring itself is the contract", () => {
    const root = mkdtempSync(join(tmpdir(), "assets-nested-"));
    mkdirSync(join(root, "sub"), { recursive: true });
    writeDeclaration(join(root, "sub"), JSON.stringify({ name: "sub", description: "d", directories: [] }));
    expect(declaredInstances(root).map((p) => p.replace(root + "/", ""))).toContain("sub");
  });

  test("a repository with NO declarations discovers none — which the gate must refuse", () => {
    // Pins the input to the guard rather than the guard's exit code, which
    // would need a subprocess. The gate exits 2 on this, because a pass over
    // an empty set is what bean `6tkl` exists to stop.
    const root = mkdtempSync(join(tmpdir(), "assets-empty-"));
    expect(declaredInstances(root)).toEqual([]);
  });
});
