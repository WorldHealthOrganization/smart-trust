/**
 * A content manifest written as JSON data (bean `y9r6`) is read the same way
 * as the `.ts` it replaces: same builder, same validation, same identity, by
 * every reader that enumerates blocks.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  JSON_MANIFEST_SCHEMA,
  evaluateJsonManifest,
  isJsonManifest,
  loadManifestValue,
  manifestPath,
  manifestRoot,
  readJsonManifest,
} from "../../pipeline/json-manifest.ts";
import { loadBlockModule, loadBlockModuleSync, loadBlocksUnder } from "../../pipeline/block-module.ts";
import { readBlockManifest, readUnlabelledBlockManifest, walkBlocks } from "../../pipeline/qa-utils.ts";

let root: string;
const put = (rel: string, value: unknown) => {
  const p = join(root, rel);
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, typeof value === "string" ? value : JSON.stringify(value, null, 2));
  return p;
};
const manifest = (builder: string, data?: unknown) => ({ $schema: JSON_MANIFEST_SCHEMA, builder, ...(data ? { data } : {}) });

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "json-manifest-"));
  put("ch1/labelled.json", manifest("prose", { label: "sec:labelled" }));
  put("ch1/labelled.md", "Text.\n");
  put("ch1/unlabelled.json", manifest("prose"));
  put("ch1/page.json", manifest("webpage", { slug: "guides/x", title: "X", nodes: [] }));
  // Other JSON in a content directory is not a manifest.
  put("ch1/data.json", { $schema: "folio-semantic-zoom/v1", rows: [] });
  put("ch1/notjson.json", "{ not json");
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("json-manifest", () => {
  test("a manifest is recognised by its $schema; other JSON is not", () => {
    expect(isJsonManifest(join(root, "ch1/labelled.json"))).toBe(true);
    expect(isJsonManifest(join(root, "ch1/data.json"))).toBe(false);
    expect(isJsonManifest(join(root, "ch1/notjson.json"))).toBe(false);
    expect(isJsonManifest(join(root, "ch1/labelled.md"))).toBe(false);
  });

  test("evaluating calls the builder: kind added, data kept", () => {
    expect(evaluateJsonManifest(join(root, "ch1/labelled.json"))).toEqual({ kind: "prose", label: "sec:labelled" });
    expect(evaluateJsonManifest(join(root, "ch1/unlabelled.json"))).toEqual({ kind: "prose" });
  });

  test("an unknown builder is an authoring error, not a skip", () => {
    const p = put("bad/unknown.json", manifest("eval"));
    expect(() => readJsonManifest(p)).toThrow(/unknown manifest builder/);
  });

  test("the builder's schema still validates the data", () => {
    const p = put("bad/invalid.json", manifest("prose", { label: 7 }));
    expect(() => evaluateJsonManifest(p)).toThrow();
  });

  test("manifestPath prefers a JSON manifest and falls back to .ts", async () => {
    expect(manifestPath(join(root, "ch1"), "page")).toBe(join(root, "ch1/page.json"));
    expect(manifestPath(join(root, "ch1"), "data")).toBe(join(root, "ch1/data.ts"));
    expect(manifestRoot(join(root, "ch1/page.json"))).toBe(join(root, "ch1/page"));
    expect(((await loadManifestValue(join(root, "ch1/page.json"))) as { slug: string }).slug).toBe("guides/x");
  });
});

describe("block readers accept JSON manifests", () => {
  test("loadBlockModule and its sync sibling", async () => {
    const p = join(root, "ch1/labelled.json");
    expect((await loadBlockModule(p))?.label).toBe("sec:labelled");
    expect(loadBlockModuleSync(p)?.kind).toBe("prose");
  });

  test("loadBlocksUnder finds the labelled block and nothing else", async () => {
    const { blocks, failures } = await loadBlocksUnder(root);
    expect([...blocks.keys()]).toEqual(["sec:labelled"]);
    // bad/ holds the two broken manifests: reported, not skipped.
    expect(failures.map((f) => f.file.split("/").pop()).sort()).toEqual(["invalid.json", "unknown.json"]);
  });

  test("readBlockManifest / readUnlabelledBlockManifest", () => {
    expect(readBlockManifest(join(root, "ch1/labelled.json"))).toEqual({ kind: "prose", label: "sec:labelled" });
    expect(readBlockManifest(join(root, "ch1/unlabelled.json"))).toBeUndefined();
    expect(readUnlabelledBlockManifest(join(root, "ch1/unlabelled.json"))).toEqual({ kind: "prose", label: "unlabelled" });
    expect(readBlockManifest(join(root, "ch1/data.json"))).toBeUndefined();
  });

  test("walkBlocks yields the JSON block with its companions", () => {
    const got = [...walkBlocks(join(root, "ch1"), { includeUnlabelled: true })];
    const labelled = got.find((b) => b.label === "sec:labelled")!;
    expect(labelled.ts).toBe(join(root, "ch1/labelled.json"));
    expect(labelled.root).toBe(join(root, "ch1/labelled"));
    expect(labelled.md).toBe(join(root, "ch1/labelled.md"));
    expect(got.map((b) => b.label).sort()).toEqual(["sec:labelled", "unlabelled"]);
  });
});
