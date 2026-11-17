/**
 * `sibling-root.ts` (bean `w1gy`, F11 option C): it writes the two root files
 * into a sibling layout and never overwrites a different file without `--force`.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { IndexConfigSchema } from "../../schemas/kg/index-config.ts";
import { SIBLINGS, siblingRootFiles, writeSiblingRoot } from "../sibling-root.ts";

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

function layout(names: readonly string[] = SIBLINGS): string {
  const d = mkdtempSync(join(tmpdir(), "sibling-root-"));
  dirs.push(d);
  for (const n of names) {
    mkdirSync(join(d, n));
    writeFileSync(join(d, n, `${n}.json`), JSON.stringify({ name: n }));
  }
  return d;
}

describe("sibling-root", () => {
  test("the index names the four siblings as local instances and validates", () => {
    const cfg = IndexConfigSchema.parse(JSON.parse(siblingRootFiles()["index.config.json"]!));
    expect(cfg.instances.map((i) => [i.name, i.source])).toEqual(SIBLINGS.map((n) => [n, { local: { at: n } }]));
    expect(JSON.parse(siblingRootFiles()["package.json"]!).scripts).toEqual({ cat: "bun cat-harness-tools/scripts/run-script.ts" });
  });

  test("writes both files, then reports them current", () => {
    const d = layout();
    expect(writeSiblingRoot(d, false)).toBe(0);
    expect(readFileSync(join(d, "package.json"), "utf-8")).toBe(siblingRootFiles()["package.json"]!);
    expect(writeSiblingRoot(d, false)).toBe(0);
  });

  test("refuses a different existing file unless --force", () => {
    const d = layout();
    writeFileSync(join(d, "package.json"), "{}\n");
    expect(writeSiblingRoot(d, false)).toBe(1);
    expect(readFileSync(join(d, "package.json"), "utf-8")).toBe("{}\n");
    expect(writeSiblingRoot(d, true)).toBe(0);
    expect(readFileSync(join(d, "package.json"), "utf-8")).toBe(siblingRootFiles()["package.json"]!);
  });

  test("a layout missing a sibling is exit 2 and writes nothing", () => {
    const d = layout(SIBLINGS.filter((n) => n !== "bootstrap"));
    expect(writeSiblingRoot(d, false)).toBe(2);
    expect(() => readFileSync(join(d, "index.config.json"))).toThrow();
  });
});
