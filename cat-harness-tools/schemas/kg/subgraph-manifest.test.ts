/**
 * Where a layer publishes one subgraph's two files (bean `mo75` G2).
 *
 * @module schemas/subgraph-manifest.test
 */
import { describe, expect, test } from "bun:test";

import { publishedSubgraphDir, subgraphIndexPackage, SubgraphIndexManifestSchema } from "./subgraph-manifest";

describe("publishedSubgraphDir", () => {
  test("is <docs>/subgraph/<HARNESS>/<PATH>, with no trailing slash", () => {
    expect(publishedSubgraphDir("docs/", "cat-harness", "tools/")).toBe("docs/subgraph/cat-harness/tools");
    expect(publishedSubgraphDir("./site/docs", "h", "skills/sdlc")).toBe("site/docs/subgraph/h/skills/sdlc");
  });

  test("refuses the root (the f233 monolith) and a climbing path", () => {
    expect(() => publishedSubgraphDir("docs/", "h", "")).toThrow(/root/);
    expect(() => publishedSubgraphDir("docs/", "h", ".")).toThrow(/root/);
    expect(() => publishedSubgraphDir("docs/", "h", "a/../b")).toThrow(/climbs/);
  });
});

describe("the subgraph index package (bean `mo75` G2b)", () => {
  const PIN = "0123456789abcdef0123456789abcdef01234567";
  const H = "a".repeat(64);

  test("every name is computed from repository, pin and harness", () => {
    expect(subgraphIndexPackage("litlfred/cat-harness", PIN, "cat-harness")).toEqual({
      name: "cat-harness-subgraph-index",
      version: `0.0.0-pin.${PIN}`,
      tag: `subgraph-index-${PIN}`,
      tarball: `cat-harness-subgraph-index-0.0.0-pin.${PIN}.tgz`,
      record: `cat-harness-subgraph-index-0.0.0-pin.${PIN}.tgz.release.json`,
      tarballUrl: `https://github.com/litlfred/cat-harness/releases/download/subgraph-index-${PIN}/cat-harness-subgraph-index-0.0.0-pin.${PIN}.tgz`,
      recordUrl: `https://github.com/litlfred/cat-harness/releases/download/subgraph-index-${PIN}/cat-harness-subgraph-index-0.0.0-pin.${PIN}.tgz.release.json`,
    });
  });

  test("a branch or a short SHA is not a pin", () => {
    expect(() => subgraphIndexPackage("o/r", "main", "h")).toThrow(/pin/);
    expect(() => subgraphIndexPackage("o/r", PIN.slice(0, 12), "h")).toThrow(/pin/);
  });

  test("the manifest holds each file where its subgraph publishes it, and never a hydrated root", () => {
    const m = (files: object[]) => ({ $schema: "folio-subgraph-index/v1", repository: "o/r", ref: PIN, harness: "h", docs: "docs", files });
    const ok = m([
      { path: "docs/subgraph/h/index.jsonld", subgraph: "", file: "index.jsonld", bytes: 1, sha256: H },
      { path: "docs/subgraph/h/tools/index.hydrated.jsonld", subgraph: "tools", file: "index.hydrated.jsonld", bytes: 1, sha256: H },
    ]);
    expect(SubgraphIndexManifestSchema.safeParse(ok).success).toBe(true);
    expect(SubgraphIndexManifestSchema.safeParse(m([{ path: "docs/subgraph/h/index.hydrated.jsonld", subgraph: "", file: "index.hydrated.jsonld", bytes: 1, sha256: H }])).success).toBe(false);
    expect(SubgraphIndexManifestSchema.safeParse(m([{ path: "elsewhere/index.jsonld", subgraph: "tools", file: "index.jsonld", bytes: 1, sha256: H }])).success).toBe(false);
    expect(SubgraphIndexManifestSchema.safeParse(m([])).success).toBe(false);
  });
});
