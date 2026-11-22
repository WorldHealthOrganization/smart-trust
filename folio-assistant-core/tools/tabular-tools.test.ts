/**
 * The tabular extractors' Tool nodes (bean cat-tools-1wre): declared here,
 * runnable, and bound to the skill that governs them.
 */
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { tools } from "./index.js";

const CORE = join(import.meta.dir, "..");

describe("tabular Tool nodes", () => {
  const tabular = tools("https://litlfred.github.io/folio-assistant").filter((t) => t.id === "tabular-csv" || t.id === "tabular-xlsx");

  test("bothDeclaredNotStub", () => {
    expect(tabular.map((t) => t.id).sort()).toEqual(["tabular-csv", "tabular-xlsx"]);
    for (const t of tabular) {
      expect((t.invoke as { manual?: boolean }).manual, t.id).toBeUndefined();
      expect(t.title, t.id).not.toContain("STUB");
    }
  });

  test("scriptsExist", () => {
    for (const t of tabular) {
      const shell = (t.invoke as { shell: string }).shell;
      const script = shell.replace(/^bun run folio-assistant-core\//, "");
      expect(existsSync(join(CORE, script)), `${t.id}: ${script}`).toBe(true);
    }
  });

  test("satisfyTabularMetadata", () => {
    for (const t of tabular) expect(t.satisfies, t.id).toContain("tabular-metadata");
  });
});
