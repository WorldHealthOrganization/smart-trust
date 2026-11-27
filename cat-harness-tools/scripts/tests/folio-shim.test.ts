/**
 * A folio's builders shim re-exports each vocabulary module its profile uses:
 * the science layer's `mathpaper` for a paper, since its kinds' builders are
 * that module's (owner, 2026-10-22). Which modules exist depends on the
 * layers this checkout holds, so these hold for any answer.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { vocabularies } from "../../schemas/content/vocabulary-modules.ts";
import { folioShim } from "../folio-shim.ts";
import { missingReexports, reexportLine, shimAssistant, vocabularyModulesFor } from "../lib/folio-shim.ts";

const SHIM = `export * from "../../.folio-assistant/cat-harness/schemas/builders";\n`;

describe("the shim's vocabulary re-exports", () => {
  test("the platform path is read off the cat-harness re-export", () => {
    expect(shimAssistant(SHIM)).toBe(".folio-assistant");
    // A shim written since bean `8lcl` names cat-harness-tools; the older one above still reads.
    expect(shimAssistant(`export * from "../../.folio-assistant/cat-harness-tools/schemas/builders";\n`)).toBe(".folio-assistant");
    expect(shimAssistant("export * from './elsewhere';")).toBeUndefined();
    expect(reexportLine(".folio-assistant", "folio-assistant-sci/schemas/mathpaper-vocabulary")).toBe(
      `export * from "../../.folio-assistant/folio-assistant-sci/schemas/mathpaper-vocabulary";`,
    );
  });

  test("a paper gets every module typing a math kind, a document none of them, anything else nothing", () => {
    const math = vocabularies().filter((v) => v.schemas.has("theorem"));
    expect(vocabularyModulesFor("paper").length).toBe(math.length);
    expect(vocabularyModulesFor("document").filter((m) => m.endsWith("mathpaper-vocabulary"))).toEqual([]);
    expect(vocabularyModulesFor("dak")).toEqual([]);
  });

  test("what is missing is exactly the lines the shim lacks, and nothing once they are there", () => {
    const missing = missingReexports(SHIM, "paper");
    expect(missing.length).toBe(vocabularyModulesFor("paper").length);
    expect(missingReexports(SHIM + missing.join("\n") + "\n", "paper")).toEqual([]);
  });

  test("a folio with no shim is undetermined, never reported current", () => {
    const root = mkdtempSync(join(tmpdir(), "folio-shim-"));
    expect(folioShim(root, { check: true }).state).toBe("undetermined");
    mkdirSync(join(root, "folio", "schema"), { recursive: true });
    writeFileSync(join(root, "folio", "schema", "builders.ts"), "export const nothing = 1;\n");
    expect(folioShim(root, { check: true }).state).toBe("undetermined");
    expect(readFileSync(join(root, "folio", "schema", "builders.ts"), "utf-8")).toBe("export const nothing = 1;\n");
  });
});
