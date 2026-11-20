import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { candidateTypes, owningLayerRoot } from "../../pipeline/gen-library-jsonld.ts";
import { writeDeclaration, writeInstanceConfig } from "../../test/support/instance-fixture.js";

/**
 * A library block is typed by its OWNING layer's dependency closure, never by
 * whatever else the checkout mounts (folio-assistant#3124: who-iris's NHWA
 * indicators were `smart-base:Indicator` in the index and `cat-harness:Block`
 * in who-iris's own checkout, so no committed .jsonld passed both).
 */
const TMP = mkdtempSync(join(tmpdir(), "test_library_owner_closure-"));
afterAll(() => rmSync(TMP, { recursive: true, force: true }));

/** A layer that contributes the `indicator` kind, as smart-base does. */
function dakLayer(): string {
  const dir = join(TMP, "dak");
  mkdirSync(join(dir, "block-kinds"), { recursive: true });
  writeFileSync(
    join(dir, "block-kinds", "indicator.json"),
    JSON.stringify({ $schema: "folio-block-kind/v1", kind: "indicator", adapter: "dak", builder: "indicator", labelPrefix: "ind", folioType: "dak:Indicator" }),
  );
  writeDeclaration(dir, { name: "dak", directories: [{ id: "dak-block-kinds", path: "block-kinds/", graphTypologies: ["block-kinds"] }] });
  writeInstanceConfig(dir, JSON.stringify({}));
  return dir;
}

/** A layer with a library, depending on `deps`. */
function libraryLayer(name: string, deps: Array<{ name: string; path: string }>): string {
  const dir = join(TMP, name);
  mkdirSync(join(dir, "library", "entry"), { recursive: true });
  writeDeclaration(dir, { name, directories: [{ id: "library", path: "library/", graphTypologies: ["library"] }] });
  writeInstanceConfig(dir, JSON.stringify(deps.length ? { dependencies: { folioAssistant: deps } } : {}));
  return dir;
}

const dak = dakLayer();
const below = libraryLayer("below", []);
const above = libraryLayer("above", [{ name: "dak", path: dak }]);

describe("a library block is typed by its owning layer's dependency closure", () => {
  test("the owning layer is the nearest declaration above the entry", () => {
    expect(owningLayerRoot(join(below, "library", "entry", "structure.json"))).toBe(below);
  });

  test("a layer that does not depend on the contributor types the kind as a plain block", () => {
    expect(candidateTypes("indicator", below)).toEqual(["cat-harness:Block"]);
  });

  test("a layer that depends on the contributor gets the contributed type", () => {
    expect(candidateTypes("indicator", above)).toContain("dak:Indicator");
  });
});
