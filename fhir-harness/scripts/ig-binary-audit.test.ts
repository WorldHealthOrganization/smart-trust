import { describe, expect, test } from "bun:test";
import { auditTree, formatAudit, isPublisherBinary, parseLsTree } from "./ig-binary-audit.ts";

const tree = [
  "100644 blob aaaaaaaa    1000\tindex.html",
  "100644 blob bbbbbbbb   35000\tfull-ig.zip",
  "100644 blob cccccccc     900\tpackage.tgz",
  "100644 blob dddddddd    1100\tvalidator-hl7.fhir.uv.example.pack",
  "100644 blob eeeeeeee   35000\tbranches/feat-a/full-ig.zip",
  "100644 blob ffffffff   35000\tbranches/feat-b/full-ig.zip",
  "100644 blob 11111111     900\tbranches/feat-b/package.tgz",
  "160000 commit 2222222       -\tsub",
].join("\n");

describe("ig-binary-audit", () => {
  test("namesPublisherBinaries", () => {
    expect(isPublisherBinary("full-ig.zip")).toBe(true);
    expect(isPublisherBinary("validator-x.y.pack")).toBe(true);
    expect(isPublisherBinary("adr.zip")).toBe(false);
    expect(isPublisherBinary("index.html")).toBe(false);
  });

  test("skipsSizelessEntries", () => {
    expect(parseLsTree(tree)).toHaveLength(7);
  });

  test("countsCopiesAndPreviews", () => {
    const a = auditTree("gh-pages", parseLsTree(tree));
    expect(a.total).toEqual({ files: 7, bytes: 108900 });
    expect(a.binaries).toEqual({ files: 6, bytes: 107900 });
    expect(a.inPreviews).toEqual({ files: 3, bytes: 70900, previews: 2 });
    expect(a.byName[0]).toEqual({ name: "full-ig.zip", copies: 3, bytes: 105000 });
    expect(a.byName.find((r) => r.name === "validator-*.pack")?.copies).toBe(1);
    expect(formatAudit(a)).toContain("in 2 preview(s)");
  });
});
