import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { scriptTable } from "./script-table.ts";

const rootWith = (pkg: object): string => {
  const dir = mkdtempSync(join(tmpdir(), "script-table-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify(pkg));
  return dir;
};

describe("scriptTable at a root that is itself an instance", () => {
  test("a name in both `scripts` and `checkoutScripts` of the root is its `scripts` spelling", () => {
    const t = scriptTable(rootWith({
      scripts: { "check:x": "bun run tool.ts ." },
      checkoutScripts: { "check:x": "bun run tool.ts self", "only:host": "bun run h.ts" },
    }));
    expect(t.get("check:x")?.command).toBe("bun run tool.ts .");
    expect(t.get("only:host")?.command).toBe("bun run h.ts");
  });

  test("a name the root's `checkoutScripts` alone declares is kept", () => {
    expect(scriptTable(rootWith({ checkoutScripts: { a: "x" } })).get("a")?.command).toBe("x");
  });
});
