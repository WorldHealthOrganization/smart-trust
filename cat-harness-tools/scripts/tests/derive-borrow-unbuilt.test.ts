import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unbuiltOnlyBy } from "../derive-at-publish.ts";

// A preview borrows main's copy of an index writer. An artefact declared after
// main's copy was made is not in that copy, so the writer must run instead.
const root = mkdtempSync(join(tmpdir(), "borrow-unbuilt-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));
mkdirSync(join(root, "bean"), { recursive: true });
writeFileSync(join(root, "bean", "index.html"), "x");
mkdirSync(join(root, "empty"), { recursive: true });
const art = (path: string, writer: string[]) => ({ instance: "cat-harness", abs: join(root, path), path, writer });

describe("unbuiltOnlyBy", () => {
  test("names a declared directory the borrowed copy left absent", () => {
    const declared = [art("bean/", ["node-kind:pages"]), art("work-plan/", ["node-kind:pages"])];
    expect(unbuiltOnlyBy(declared, "node-kind:pages")).toEqual(["cat-harness/work-plan/"]);
  });

  test("an empty directory is not built", () => {
    expect(unbuiltOnlyBy([art("empty/", ["node-kind:pages"])], "node-kind:pages")).toEqual(["cat-harness/empty/"]);
  });

  test("nothing when every artefact of the writer is built", () => {
    expect(unbuiltOnlyBy([art("bean/", ["node-kind:pages"])], "node-kind:pages")).toEqual([]);
  });

  test("ignores artefacts another writer also builds, or only other writers build", () => {
    const declared = [art("shared/", ["node-kind:pages", "kg:viz"]), art("other/", ["kg:viz"])];
    expect(unbuiltOnlyBy(declared, "node-kind:pages")).toEqual([]);
  });
});
