/**
 * The IG API in the AST cache commit: the layer-provided step's output copied
 * for the seed, and a seed that commits it beside the AST for a restore to lay
 * down. Driven by synthetic trees, so it names no real IG or layer.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { copyIgApi, igApiCache, SIDECARS_STEP } from "./ig-api-cache.ts";

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "ig-api-cache-"));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** A step as a layer above provides it: writes `<work>/ig-api/` from `<ig>/output-ast`, or fails. */
const STEP = `
const a = process.argv.slice(2);
const work = a[a.indexOf("--work") + 1];
const ig = a[a.indexOf("--ig") + 1];
const fs = require("node:fs");
if (!fs.existsSync(ig + "/output-ast/manifest.json")) process.exit(3);
fs.mkdirSync(work + "/ig-api/sidecars", { recursive: true });
fs.mkdirSync(work + "/ig-api/site/openapi", { recursive: true });
fs.writeFileSync(work + "/ig-api/sidecars/ValueSet-x.schema.json", "{}");
fs.writeFileSync(work + "/ig-api/site/ValueSets.schema.json", "{}");
fs.writeFileSync(work + "/ig-api/site/openapi/index.html", "<html></html>");
fs.writeFileSync(work + "/ig-api/ig-api.json", JSON.stringify({ label: "Example API" }));
fs.writeFileSync(work + "/ig-api/scratch.txt", "not copied");
`;

/** An IG checkout with an AST and, when `step`, a root script providing the sidecars step. */
function checkout(name: string, step: "ok" | "fails" | "none"): string {
  const ig = join(dir, name);
  mkdirSync(join(ig, "output-ast", "resources", "ValueSet"), { recursive: true });
  writeFileSync(join(ig, "sushi-config.yaml"), "id: ex.ig\n");
  writeFileSync(join(ig, "output-ast", "resources", "ValueSet", "x--0000.json"), JSON.stringify({ resourceType: "ValueSet", id: "x", url: "http://example.org/ValueSet/x", version: "1.0.0", name: "x" }));
  writeFileSync(
    join(ig, "output-ast", "manifest.json"),
    JSON.stringify({
      $schema: "ig-ast/v1",
      authority: "cache",
      provisional: ["indices", "dependencies", "versions"],
      generatedAt: "2026-11-10T00:00:00Z",
      inputs: { toolchain: "ig-publisher 2.3.4", sourceRevision: "a".repeat(40) },
      resources: [{ key: "http://example.org/ValueSet/x|1.0.0", canonical: "http://example.org/ValueSet/x", version: "1.0.0", resourceType: "ValueSet", id: "x", name: "x", file: "resources/ValueSet/x--0000.json", source: "fsh-generated/resources/ValueSet-x.json" }],
    }),
  );
  writeFileSync(join(ig, "output-ast", "dependencies.json"), JSON.stringify({ $schema: "ig-ast-dependencies/v1", authority: "cache", dependencies: [] }));
  writeFileSync(join(ig, "step.js"), step === "fails" ? "process.exit(1)" : STEP);
  writeFileSync(join(ig, "package.json"), JSON.stringify({ name: "ex", scripts: step === "none" ? {} : { [SIDECARS_STEP]: "bun run step.js" } }));
  return ig;
}

describe("the IG API for the AST cache commit", () => {
  test("copiesTheStepsIgApiOnly", () => {
    const work = join(dir, "copy-work");
    mkdirSync(join(work, "ig-api", "sidecars"), { recursive: true });
    expect(copyIgApi(work, join(dir, "copy-into"))).toBeUndefined();
    writeFileSync(join(work, "ig-api", "sidecars", "a.jsonld"), "{}");
    writeFileSync(join(work, "ig-api", "other.txt"), "x");
    expect(copyIgApi(work, join(dir, "copy-into"))).toBe(1);
    expect(existsSync(join(dir, "copy-into", "sidecars", "a.jsonld"))).toBe(true);
    expect(existsSync(join(dir, "copy-into", "other.txt"))).toBe(false);
  });

  test("runsTheLayerProvidedStep", () => {
    const ig = checkout("ig-ok", "ok");
    const into = join(dir, "ok-into");
    expect(igApiCache({ ig, into, log: () => {} })).toEqual({ written: 1, step: "package.json" });
    expect(JSON.parse(readFileSync(join(into, "ig-api.json"), "utf-8"))).toEqual({ label: "Example API" });
    expect(existsSync(join(into, "site", "ValueSets.schema.json"))).toBe(true);
    expect(existsSync(join(into, "site", "openapi", "index.html"))).toBe(true);
    expect(existsSync(join(into, "scratch.txt"))).toBe(false);
  });

  test("noStepOrAFailedStepWritesNothing", () => {
    expect(igApiCache({ ig: checkout("ig-none", "none"), into: join(dir, "none-into") })).toEqual({ none: `no mounted layer provides ${SIDECARS_STEP}` });
    const r = igApiCache({ ig: checkout("ig-fails", "fails"), into: join(dir, "fails-into") });
    expect("error" in r).toBe(true);
    expect(existsSync(join(dir, "fails-into"))).toBe(false);
  });

  test("seedCommitsTheIgApiAndRestoreLaysItDown", () => {
    const git = (cwd: string, ...a: string[]): string => {
      const r = spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "init.defaultBranch=main", ...a], { cwd, encoding: "utf-8" });
      if (r.status !== 0) throw new Error(`git ${a.join(" ")}: ${r.stderr}`);
      return r.stdout.trim();
    };
    const remote = join(dir, "seed-remote.git");
    git(dir, "init", "-q", "--bare", remote);
    const ig = checkout("ig-seed", "ok");
    git(ig, "init", "-q");
    git(ig, "remote", "add", "origin", remote);
    const env = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };
    const seed = spawnSync("bash", [join(import.meta.dir, "ig-cache.sh"), "seed", "--ig-root", ig, "--push"], { cwd: ig, encoding: "utf-8", env });
    expect(seed.status).toBe(0);
    const br = "cat/fhir-harness/fhir-ast/ex.ig";
    const tree = git(remote, "ls-tree", "-r", "--name-only", br).split("\n");
    expect(tree).toContain("ig-api/sidecars/ValueSet-x.schema.json");
    expect(tree).toContain("ig-api/site/ValueSets.schema.json");
    expect(tree).toContain("ig-api/ig-api.json");
    expect(tree).toContain("manifest.json");
    // The artefact index, built from the same tree, with the IG API's sidecars bound at their paths in it.
    expect(tree).toContain("fhir-artifact-index/index.json");
    const ix = JSON.parse(git(remote, "show", `${br}:fhir-artifact-index/index.json`)) as { artifacts: { key: string; sidecars?: { schema?: { localPath?: string } } }[] };
    expect(ix.artifacts.find((a) => a.key === "ValueSet/x")?.sidecars?.schema?.localPath).toBe("ig-api/sidecars/ValueSet-x.schema.json");
    // A restore into a fresh checkout lays the IG API down beside the AST.
    const fresh = join(dir, "ig-restore");
    mkdirSync(fresh, { recursive: true });
    writeFileSync(join(fresh, "sushi-config.yaml"), "id: ex.ig\n");
    git(fresh, "init", "-q");
    git(fresh, "remote", "add", "origin", remote);
    const restore = spawnSync("bash", [join(import.meta.dir, "ig-cache.sh"), "restore", "--ig-root", fresh], { cwd: fresh, encoding: "utf-8" });
    expect(restore.status).toBe(0);
    expect(existsSync(join(fresh, "output-ast", "ig-api", "sidecars", "ValueSet-x.schema.json"))).toBe(true);
    expect(existsSync(join(fresh, "output-ast", "fhir-artifact-index", "index.json"))).toBe(true);
    // IG_CACHE_IG_API=0 seeds the AST alone.
    const bare = spawnSync("bash", [join(import.meta.dir, "ig-cache.sh"), "seed", "--ig-root", ig, "--push", "--force"], { cwd: ig, encoding: "utf-8", env: { ...env, IG_CACHE_IG_API: "0", IG_CACHE_INDEX: "0" } });
    expect(bare.status).toBe(0);
    expect(git(remote, "ls-tree", "-r", "--name-only", br).split("\n").some((f) => f.startsWith("ig-api/") || f.startsWith("fhir-artifact-index/"))).toBe(false);
  });
});
