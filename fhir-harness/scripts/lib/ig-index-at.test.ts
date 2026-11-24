/**
 * The artefact index is read through the layer-output overlay (bean
 * `cat-tools-sm8r`, item 4, plan step 2): a mounted IG layer's index is read
 * from `build/layers/<instance>/` when a writer put it there, else from the
 * mount; a layer the checkout does not mount is read in place.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { spawnSync } from "node:child_process";

import { indexReadPath, indexWritePath, layerFileReadPath } from "./ig-index-at.ts";

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "ig-index-at-"));
  mkdirSync(join(root, ".git"));
  writeFileSync(join(root, "index.lock.json"), JSON.stringify({ instances: [{ instance: "some-ig", path: "some-ig", sha: "a".repeat(40) }] }));
  mkdirSync(join(root, "some-ig", "fhir-artifact-index"), { recursive: true });
  writeFileSync(join(root, "some-ig", "fhir-artifact-index", "index.json"), "{}");
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("indexReadPath", () => {
  test("a mounted layer with nothing computed is read from the mount", () => {
    expect(indexReadPath(join(root, "some-ig"), "index.json")).toBe(join(root, "some-ig", "fhir-artifact-index", "index.json"));
  });
  test("a mounted layer's computed index wins over the pinned bytes", () => {
    const built = join(root, "build", "layers", "some-ig", "fhir-artifact-index");
    mkdirSync(built, { recursive: true });
    writeFileSync(join(built, "index.json"), "{}");
    expect(indexReadPath(join(root, "some-ig"), "index.json")).toBe(join(built, "index.json"));
  });
  test("a layer the checkout does not mount is read in place", () => {
    mkdirSync(join(root, "own-ig"));
    expect(indexReadPath(join(root, "own-ig"), "menu.json")).toBe(join(root, "own-ig", "fhir-artifact-index", "menu.json"));
  });
  test("with no path parts it names the index directory itself", () => {
    expect(indexReadPath(join(root, "some-ig"))).toBe(join(root, "some-ig", "fhir-artifact-index"));
  });
});

describe("indexWritePath", () => {
  test("a mounted layer's index is written under build/layers/<instance>/, not in the mount", () => {
    expect(indexWritePath(join(root, "some-ig"), "index.json")).toBe(join(root, "build", "layers", "some-ig", "fhir-artifact-index", "index.json"));
  });
  test("a layer the checkout does not mount is written in place", () => {
    mkdirSync(join(root, "own-ig"));
    expect(indexWritePath(join(root, "own-ig"), "menu.json")).toBe(join(root, "own-ig", "fhir-artifact-index", "menu.json"));
  });
});

describe("layerFileReadPath", () => {
  test("a localPath under fhir-artifact-index/ (the package the JSON view pages read) goes through the overlay", () => {
    const built = join(root, "build", "layers", "some-ig", "fhir-artifact-index");
    mkdirSync(built, { recursive: true });
    writeFileSync(join(built, "package.tgz"), "");
    expect(layerFileReadPath(join(root, "some-ig"), "fhir-artifact-index/package.tgz")).toBe(join(built, "package.tgz"));
  });
  test("any other localPath is the layer's own file", () => {
    expect(layerFileReadPath(join(root, "some-ig"), "output-ast/resources/x.json")).toBe(join(root, "some-ig", "output-ast/resources/x.json"));
  });
});

describe("a reader of a mounted IG's index (p2-refusals, bean sm8r's finding)", () => {
  test("finds an index that exists only in the output root, not in the mount", () => {
    writeFileSync(join(root, "index.lock.json"), JSON.stringify({ instances: ["a-ig", "b-ig"].map((instance) => ({ instance, path: instance, sha: "a".repeat(40) })) }));
    for (const [name, pkg] of [["a-ig", "a.ig"], ["b-ig", "b.ig"]] as const) {
      mkdirSync(join(root, name), { recursive: true });
      writeFileSync(join(root, name, `${name}.json`), JSON.stringify({ name }));
      const at = join(root, "build", "layers", name, "fhir-artifact-index");
      mkdirSync(at, { recursive: true });
      writeFileSync(join(at, "index.json"), JSON.stringify({ id: name, packageId: pkg, artifacts: [{ key: `ValueSet/${name}`, resourceType: "ValueSet", id: name, published: { xml: { url: `https://p/ValueSet-${name}.xml` } } }] }));
    }
    const r = spawnSync("bun", ["run", join(import.meta.dir, "..", "p2-refusals.ts"), "--combine", join(root, "a-ig"), join(root, "b-ig"), "--out", join(root, "combined.json")], { encoding: "utf-8" });
    expect(r.stderr).not.toContain("does not exist");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("across 2 IGs");
  });
});

describe("a writer of a mounted IG's index (ingest-ig-releases, bean sm8r item 4)", () => {
  test("writes releases.json under build/layers/<instance>/ and nothing inside the mount", () => {
    const from = join(root, "releases.github.json");
    writeFileSync(from, "[]");
    const r = spawnSync("bun", ["run", join(import.meta.dir, "..", "ingest-ig-releases.ts"), "--instance", join(root, "some-ig"), "--repo", "example/some-ig", "--from", from], { encoding: "utf-8" });
    expect(r.status).toBe(0);
    expect(existsSync(join(root, "build", "layers", "some-ig", "fhir-artifact-index", "releases.json"))).toBe(true);
    expect(existsSync(join(root, "some-ig", "fhir-artifact-index", "releases.json"))).toBe(false);
  });
});
