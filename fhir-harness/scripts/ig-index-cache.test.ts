/**
 * The IG's artefact index in the AST cache commit: built from the tree about
 * to be committed, with every path a path in that tree. Synthetic trees only.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { igIndexCache, indexCacheArgs } from "./ig-index-cache.ts";
import { INDEX_CACHED } from "./ig-repo-site.ts";
import { FhirArtifactIndexSchema } from "../schemas/fhir-artifact-index.js";

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "ig-index-cache-"));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** A cache tree as the seed lays it out: the AST at its root and, when `api`, the IG API beside it. */
function tree(name: string, api: boolean): { ig: string; tree: string } {
  const ig = join(dir, name, "ig");
  const t = join(dir, name, "tree");
  mkdirSync(ig, { recursive: true });
  mkdirSync(join(t, "resources", "ValueSet"), { recursive: true });
  writeFileSync(join(t, "resources", "ValueSet", "x--0000.json"), JSON.stringify({ resourceType: "ValueSet", id: "x", url: "http://example.org/ValueSet/x", version: "1.0.0", name: "x" }));
  writeFileSync(
    join(t, "manifest.json"),
    JSON.stringify({
      $schema: "ig-ast/v1",
      authority: "cache",
      provisional: ["indices", "dependencies", "versions"],
      generatedAt: "2026-11-10T00:00:00Z",
      inputs: { toolchain: "ig-publisher 2.3.4", sourceRevision: "a".repeat(40) },
      resources: [{ key: "http://example.org/ValueSet/x|1.0.0", canonical: "http://example.org/ValueSet/x", version: "1.0.0", resourceType: "ValueSet", id: "x", name: "x", file: "resources/ValueSet/x--0000.json", source: "fsh-generated/resources/ValueSet-x.json" }],
    }),
  );
  writeFileSync(join(t, "dependencies.json"), JSON.stringify({ $schema: "ig-ast-dependencies/v1", authority: "cache", dependencies: [] }));
  if (api) {
    mkdirSync(join(t, "ig-api", "sidecars"), { recursive: true });
    writeFileSync(join(t, "ig-api", "sidecars", "ValueSet-x.schema.json"), "{}");
  }
  // A copy restored from an older commit: replaced, never carried.
  mkdirSync(join(t, "fhir-artifact-index"), { recursive: true });
  writeFileSync(join(t, INDEX_CACHED), "stale");
  return { ig, tree: t };
}

describe("the artefact index for the AST cache commit", () => {
  test("indexPathsAreTreePaths", () => {
    const { ig, tree: t } = tree("api", true);
    expect(igIndexCache({ ig, tree: t })).toEqual({ written: join(t, INDEX_CACHED) });
    const ix = FhirArtifactIndexSchema.parse(JSON.parse(readFileSync(join(t, INDEX_CACHED), "utf-8")));
    const vs = ix.artifacts.find((a) => a.key === "ValueSet/x")!;
    expect((vs.materialization as { localPath?: string } | undefined)?.localPath).toBe("resources/ValueSet/x--0000.json");
    expect(vs.sidecars?.schema?.localPath).toBe("ig-api/sidecars/ValueSet-x.schema.json");
    expect(ix.sidecarBase).toBeUndefined();
    expect(ix.source.of).toBe(".");
  });

  test("argsFollowTheSiteBuild", () => {
    const { ig, tree: t } = tree("args", false);
    expect(indexCacheArgs(ig, t, "ex")).toEqual(["--ast", t, "--instance-id", "ex", "--ast-path", "", "--out", join(t, INDEX_CACHED)]);
    // An index the IG still commits gives the grouping, as in compose.
    mkdirSync(join(ig, "fhir-artifact-index"), { recursive: true });
    writeFileSync(join(ig, INDEX_CACHED), "{}");
    expect(indexCacheArgs(ig, t, "ex")).toContain("--keep-published-grouping");
  });

  test("noAstWritesNothing", () => {
    const { ig, tree: t } = tree("none", false);
    rmSync(join(t, "manifest.json"));
    expect("error" in igIndexCache({ ig, tree: t })).toBe(true);
    expect(existsSync(join(t, "fhir-artifact-index"))).toBe(false);
  });
});
