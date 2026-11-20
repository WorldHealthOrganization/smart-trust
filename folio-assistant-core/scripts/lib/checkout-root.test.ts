/**
 * `checkoutRootFor`: core's checkout in the composed and the standalone layout.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { checkoutRootFor } from "./checkout-root.ts";

const tmp = mkdtempSync(join(tmpdir(), "checkout-root-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function harnessAt(dir: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "cat-harness.json"), JSON.stringify({ name: "cat-harness" }));
}

describe("checkoutRootFor", () => {
  test("composedLayoutIsTheParent", () => {
    const root = join(tmp, "composed");
    const core = join(root, "folio-assistant-core");
    mkdirSync(core, { recursive: true });
    harnessAt(join(root, "cat-harness"));
    expect(checkoutRootFor(core)).toBe(root);
  });

  test("standaloneLayoutIsCoreItself", () => {
    const core = join(tmp, "work", "folio-assistant-core");
    harnessAt(join(core, "cat-harness"));
    expect(checkoutRootFor(core)).toBe(core);
  });

  test("noHarnessAnywhereKeepsTheComposedAnswer", () => {
    const core = join(tmp, "bare", "folio-assistant-core");
    mkdirSync(core, { recursive: true });
    expect(checkoutRootFor(core)).toBe(join(tmp, "bare"));
  });
});
