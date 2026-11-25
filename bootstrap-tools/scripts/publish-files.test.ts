import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { publishFiles } from "./publish-files.ts";

const tmp = mkdtempSync(join(tmpdir(), "publish-files-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe("bootstrap's files, published as they sit", () => {
  const root = join(tmp, "bootstrap");
  mkdirSync(join(root, "schemas"), { recursive: true });
  mkdirSync(join(root, ".git"), { recursive: true });
  writeFileSync(join(root, "README.md"), "# b\n\nsee [schemas](schemas/x.json)\n");
  writeFileSync(join(root, "schemas", "x.json"), "{}\n");
  writeFileSync(join(root, "bootstrap.json"), '{"name":"bootstrap"}\n');
  writeFileSync(join(root, ".git", "HEAD"), "ref\n");

  test("publishesFilesVerbatim", () => {
    const out = join(tmp, "site1");
    const r = publishFiles(root, out);
    expect(r.written.sort()).toEqual(["README.md", "bootstrap.json", "schemas/x.json"]);
    expect(readFileSync(join(out, "schemas", "x.json"), "utf-8")).toBe("{}\n");
    expect(r.written.some((f) => f.endsWith(".html"))).toBe(false);
  });

  test("neverOverwritesAndReports", () => {
    const out = join(tmp, "site2");
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "bootstrap.json"), "the graph's copy\n");
    const r = publishFiles(root, out);
    expect(r.skipped).toEqual(["bootstrap.json"]);
    expect(readFileSync(join(out, "bootstrap.json"), "utf-8")).toBe("the graph's copy\n");
  });
});
