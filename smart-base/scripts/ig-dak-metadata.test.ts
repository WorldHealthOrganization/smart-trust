import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readIgDakMetadata } from "./ig-dak-metadata.ts";

const dir = () => mkdtempSync(join(tmpdir(), "ig-dak-"));

describe("readIgDakMetadata", () => {
  test("readsIndexConfigSection", () => {
    const d = dir();
    writeFileSync(join(d, "index.config.json"), JSON.stringify({ contentTypes: { dak: { canonicalUrl: "u" } } }));
    expect(readIgDakMetadata(d)).toEqual({ data: { canonicalUrl: "u" }, from: "index.config.json#contentTypes.dak" });
  });
  test("sectionWinsOverLegacyDakJson", () => {
    const d = dir();
    writeFileSync(join(d, "index.config.json"), JSON.stringify({ contentTypes: { dak: { id: "new" } } }));
    writeFileSync(join(d, "dak.json"), JSON.stringify({ id: "old" }));
    expect(readIgDakMetadata(d)?.data.id).toBe("new");
  });
  test("fallsBackToDakJson", () => {
    const d = dir();
    writeFileSync(join(d, "index.config.json"), JSON.stringify({ instances: [] }));
    writeFileSync(join(d, "dak.json"), JSON.stringify({ id: "old" }));
    expect(readIgDakMetadata(d)).toEqual({ data: { id: "old" }, from: "dak.json" });
  });
  test("neitherMeansNotADak", () => {
    expect(readIgDakMetadata(dir())).toBeUndefined();
  });
  test("nonObjectSectionThrows", () => {
    const d = dir();
    writeFileSync(join(d, "index.config.json"), JSON.stringify({ contentTypes: { dak: [] } }));
    expect(() => readIgDakMetadata(d)).toThrow(/must be an object/);
  });
});
