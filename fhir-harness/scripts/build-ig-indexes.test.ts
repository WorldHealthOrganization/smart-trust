/**
 * `build-ig-indexes.ts`: which layers get an artefact index built at
 * publish. The build itself clones and restores over the network, so it is
 * measured by running it, not here; what is decided before any clone is.
 *
 * Layers are made up for the test: `ig` needs fhir-harness directly,
 * `overlay-ig` through `overlay`, `bare` has no repository, `lone` needs
 * nothing, and `seedless` has no AST branch family.
 *
 * @module fhir-harness/scripts/build-ig-indexes.test
 */
import { afterAll, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { astAgainstPin, cloneAt, instancesIn, lockedMounts, pinnedAt, referenceAbsent, contextsFrom, fhirVersionsOf, hubFrom, igTargets, withWorkDir, isSafeInstanceName, lockedRepositories, packFromAst, publishedBase, rebaseOnMount } from "./build-ig-indexes.ts";
import type { BranchLister } from "./gen-ig-ast-pages.ts";

const instances = [
  { name: "fhir-harness", root: "/c/fhir-harness", repository: "example/fhir-harness", needs: ["core"] },
  { name: "overlay", root: "/c/overlay", repository: "example/overlay", needs: ["fhir-harness"] },
  { name: "ig", root: "/c/ig", repository: "example/ig", needs: ["fhir-harness"] },
  { name: "overlay-ig", root: "/c/overlay-ig", repository: "example/overlay-ig", needs: ["overlay"] },
  { name: "bare", root: "/c/bare", needs: ["fhir-harness"] },
  { name: "seedless", root: "/c/seedless", repository: "example/seedless", needs: ["fhir-harness"] },
  { name: "broken", root: "/c/broken", repository: "example/broken", needs: ["fhir-harness"] },
  { name: "lone", root: "/c/lone", repository: "example/lone", needs: [] },
];

const list: BranchLister = (repo) => {
  if (repo === "example/broken") return { error: "git ls-remote failed" };
  if (repo === "example/seedless" || repo === "example/overlay") return { branches: [] };
  return { branches: [`cat/fhir-harness/fhir-ast/${repo.split("/")[1]}.pkg`, "main"] };
};

describe("igTargets", () => {
  it("targetsBuildableSkipsWithReason", () => {
    const { targets, skipped } = igTargets(instances, list);
    expect(targets.map((t) => [t.name, t.branches])).toEqual([
      ["ig", ["cat/fhir-harness/fhir-ast/ig.pkg"]],
      ["overlay-ig", ["cat/fhir-harness/fhir-ast/overlay-ig.pkg"]],
    ]);
    const why = Object.fromEntries(skipped.map((s) => [s.name, s.why]));
    expect(Object.keys(why).sort()).toEqual(["bare", "broken", "overlay", "seedless"]);
    expect(why["bare"]).toContain("no repository");
    expect(why["broken"]).toContain("could not determine");
    expect(why["seedless"]).toContain("no AST branch family");
    expect(why["lone"]).toBeUndefined();
  });

  it("refusesUnsafeInstanceName", () => {
    const odd = ["..", "../x", "a/b", "it's", "-x", ""].map((name) => ({ name, root: `/c/odd${name.length}`, repository: "example/ig", needs: ["fhir-harness"] }));
    const { targets, skipped } = igTargets([instances[0]!, ...odd], list);
    expect(targets).toEqual([]);
    expect(skipped.map((s) => s.name).sort()).toEqual(odd.map((o) => o.name).sort());
    for (const s of skipped) expect(s.why).toContain("not a single safe path segment");
    expect(isSafeInstanceName("smart-base")).toBe(true);
    expect(isSafeInstanceName("ig.v2_x")).toBe(true);
  });

  it("onlyNarrowsToOne", () => {
    expect(igTargets(instances, list, "overlay-ig").targets.map((t) => t.name)).toEqual(["overlay-ig"]);
  });
});

describe("publishedBase", () => {
  it("publishedBasePrecedence", () => {
    expect(publishedBase({ source: { kind: "gh-pages", of: "https://example.org/ig/" } }, { iriBase: "https://other.example/" }).base).toBe("https://example.org/ig");
    expect(publishedBase({ source: { kind: "sushi-config", of: "https://github.com/x/y" } }, { iriBase: "https://other.example/ig/" }).base).toBe("https://other.example/ig");
    expect(publishedBase(undefined, undefined).base).toBeUndefined();
  });

  it("namesTheLayoutOfTheSiteItLinks", () => {
    // A committed copy's site is a Publisher's output; an iriBase is the harness's own site (`artifact/…`).
    expect(publishedBase({ source: { kind: "gh-pages", of: "https://example.org/ig/" } }, undefined).layout).toBe("publisher");
    expect(publishedBase(undefined, { iriBase: "https://alpha.github.io/ig/" }).layout).toBe("site");
    expect(publishedBase(undefined, undefined).layout).toBeUndefined();
  });

  it("rebasesPagesOnMountedRepo", () => {
    const decl = { repository: "alpha/ig", iriBase: "https://alpha.github.io/ig/" };
    expect(publishedBase(undefined, decl, "beta/ig").base).toBe("https://beta.github.io/ig");
    expect(publishedBase(undefined, decl, "beta/ig").from).toContain("beta/ig");
    expect(publishedBase(undefined, decl, "alpha/ig").base).toBe("https://alpha.github.io/ig");
    expect(publishedBase(undefined, decl).base).toBe("https://alpha.github.io/ig");
    // A committed copy's site still wins: it is what was published.
    expect(publishedBase({ source: { kind: "gh-pages", of: "https://gamma.github.io/ig" } }, decl, "beta/ig").base).toBe("https://gamma.github.io/ig");
  });
});

describe("rebaseOnMount", () => {
  it("rebasesOwnPagesKeepingPath", () => {
    expect(rebaseOnMount("https://Alpha.github.io/ig/sub/", "alpha/ig", "Beta/ig")).toBe("https://beta.github.io/ig/sub/");
    expect(rebaseOnMount("https://alpha.github.io/ig", "alpha/ig", "beta/ig2")).toBe("https://beta.github.io/ig2");
  });
  it("keepsOtherAddresses", () => {
    expect(rebaseOnMount("https://ig.example.org/", "alpha/ig", "beta/ig")).toBe("https://ig.example.org/");
    expect(rebaseOnMount("https://alpha.github.io/other/", "alpha/ig", "beta/ig")).toBe("https://alpha.github.io/other/");
    expect(rebaseOnMount("https://alpha.github.io/ig/", undefined, "beta/ig")).toBe("https://alpha.github.io/ig/");
    expect(rebaseOnMount("https://alpha.github.io/ig/", "alpha/ig", undefined)).toBe("https://alpha.github.io/ig/");
  });
});

describe("instancesIn", () => {
  it("readsDeclarationBySelfName", () => {
    // CI checks an IG repository out at `fa/`: `fa/fa.json` is absent, and the
    // IG's declaration is `ig-x.json`. Read as `<directory>.json`, the IG was a
    // layer named `fa` needing nothing, so no index was built for it.
    const dir = join(mkdtempSync(join(tmpdir(), "ig-index-root-")), "fa");
    mkdirSync(dir, { recursive: true });
    try {
      writeFileSync(join(dir, "ig-x.json"), JSON.stringify({ name: "ig-x", repository: "alpha/ig-x", needs: ["fhir-harness"] }));
      const ig = instancesIn(dir).find((i) => i.root === dir);
      expect(ig?.name).toBe("ig-x");
      expect(ig?.needs).toEqual(["fhir-harness"]);
      expect(ig?.repository).toBe("alpha/ig-x");
    } finally {
      rmSync(dirname(dir), { recursive: true, force: true });
    }
  });
});

describe("lockedRepositories", () => {
  it("lockedRepositoriesFromLock", () => {
    const dir = mkdtempSync(join(tmpdir(), "ig-index-lock-"));
    try {
      expect(lockedRepositories(dir).size).toBe(0);
      writeFileSync(join(dir, "index.lock.json"), JSON.stringify({ instances: [{ instance: "ig", repository: "beta/ig" }, { instance: "odd", repository: "not a repo" }, { instance: "local" }] }));
      expect([...lockedRepositories(dir)]).toEqual([["ig", "beta/ig"]]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("packFromAst", () => {
  it("packIsReproducible", () => {
    const dir = mkdtempSync(join(tmpdir(), "ig-index-pack-same-"));
    try {
      const ast = join(dir, "output-ast");
      mkdirSync(join(ast, "resources"), { recursive: true });
      writeFileSync(join(ast, "resources", "b.json"), '{"resourceType":"ValueSet","id":"b"}');
      writeFileSync(join(ast, "resources", "a.json"), '{"resourceType":"ValueSet","id":"a"}');
      writeFileSync(join(ast, "manifest.json"), JSON.stringify({ resources: [
        { resourceType: "ValueSet", id: "b", file: "resources/b.json" },
        { resourceType: "ValueSet", id: "a", file: "resources/a.json" },
      ] }));
      writeFileSync(join(dir, "sushi-config.yaml"), "id: ex.ig\nversion: 1.0.0\n");
      const one = join(dir, "one.tgz");
      const two = join(dir, "two.tgz");
      packFromAst(ast, dir, one, join(dir, "stage"), () => {});
      Bun.sleepSync(1100);
      packFromAst(ast, dir, two, join(dir, "stage"), () => {});
      expect(readFileSync(two).equals(readFileSync(one))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("refusesFilesOutsideAst", () => {
    const dir = mkdtempSync(join(tmpdir(), "ig-index-pack-out-"));
    try {
      const ast = join(dir, "output-ast");
      mkdirSync(join(ast, "resources"), { recursive: true });
      writeFileSync(join(dir, "outside.json"), '{"resourceType":"ValueSet","id":"x"}');
      symlinkSync(join(dir, "outside.json"), join(ast, "resources", "link.json"));
      writeFileSync(join(ast, "resources", "ok.json"), '{"resourceType":"ValueSet","id":"ok"}');
      writeFileSync(
        join(ast, "manifest.json"),
        JSON.stringify({ resources: [
          { resourceType: "ValueSet", id: "up", file: "../outside.json" },
          { resourceType: "ValueSet", id: "link", file: "resources/link.json" },
          { resourceType: "ValueSet", id: "ok", file: "resources/ok.json" },
        ] }),
      );
      writeFileSync(join(dir, "sushi-config.yaml"), "id: ex.ig\nversion: 1.0.0\n");
      const out = join(dir, "pkg", "package.tgz");
      const logged: string[] = [];
      expect(packFromAst(ast, dir, out, join(dir, "stage"), (s) => logged.push(s))).toBe(1);
      const names = spawnSync("tar", ["-tzf", out], { encoding: "utf-8" }).stdout.split("\n").filter(Boolean).sort();
      expect(names).toEqual(["package/", "package/ValueSet-ok.json", "package/package.json"]);
      expect(logged.length).toBe(2);
      expect(existsSync(join(dir, "stage", "package", "ValueSet-up.json"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });


  it("packsTypeIdWithPackageJson", () => {
    const dir = mkdtempSync(join(tmpdir(), "ig-index-pack-"));
    try {
      const ast = join(dir, "output-ast");
      mkdirSync(join(ast, "resources", "ValueSet"), { recursive: true });
      writeFileSync(join(ast, "resources", "ValueSet", "vs--abc.json"), '{"resourceType":"ValueSet","id":"vs"}');
      writeFileSync(
        join(ast, "manifest.json"),
        JSON.stringify({ resources: [{ resourceType: "ValueSet", id: "vs", file: "resources/ValueSet/vs--abc.json" }, { resourceType: "ValueSet", id: "missing", file: "resources/ValueSet/nope.json" }] }),
      );
      writeFileSync(join(dir, "sushi-config.yaml"), "id: ex.ig\nversion: 1.0.0\nfhirVersion: 4.0.1\ncanonical: http://example.org/ig\n");
      const out = join(dir, "fhir-artifact-index", "package.tgz");
      expect(packFromAst(ast, dir, out, join(dir, "stage"))).toBe(1);
      const list = spawnSync("tar", ["-tzf", out], { encoding: "utf-8" }).stdout.split("\n").filter(Boolean).sort();
      expect(list).toEqual(["package/", "package/ValueSet-vs.json", "package/package.json"]);
      const pj = JSON.parse(spawnSync("tar", ["-xzOf", out, "package/package.json"], { encoding: "utf-8" }).stdout);
      expect(pj).toMatchObject({ name: "ex.ig", version: "1.0.0", fhirVersions: ["4.0.1"] });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("contextsFrom and fhirVersionsOf", () => {
  it("indexesContextOnlyJsonld", () => {
    const ig = mkdtempSync(join(tmpdir(), "ig-index-ctx-"));
    try {
      mkdirSync(join(ig, "input", "images", "ctx"), { recursive: true });
      writeFileSync(join(ig, "input", "images", "ctx", "v1.jsonld"), JSON.stringify({ "@context": { a: "https://example.org/a" } }));
      writeFileSync(join(ig, "input", "images", "data.jsonld"), JSON.stringify({ "@context": {}, "@graph": [] }));
      writeFileSync(join(ig, "input", "images", "broken.jsonld"), "{");
      writeFileSync(join(ig, "sushi-config.yaml"), "id: ex.ig\nfhirVersion: 4.0.1\n");
      const dir = join(ig, "out");
      const got = contextsFrom(ig, dir, "https://example.org/ig");
      expect(got.map((c) => c.id)).toEqual(["ctx/v1"]);
      expect(got[0]!.representation.url).toBe("https://example.org/ig/ctx/v1.jsonld");
      expect(got[0]!.representation.localPath).toBe("fhir-artifact-index/contexts/ctx/v1.jsonld");
      expect(contextsFrom(join(ig, "none"), dir, undefined)).toEqual([]);
      expect(fhirVersionsOf(ig)).toEqual(["4.0.1"]);
      expect(fhirVersionsOf(join(ig, "none"))).toEqual([]);
    } finally {
      rmSync(ig, { recursive: true, force: true });
    }
  });
});

describe("hubFrom", () => {
  it("hubNamesMarkerPage", () => {
    const ig = mkdtempSync(join(tmpdir(), "ig-index-hub-"));
    try {
      const work = join(ig, "work");
      mkdirSync(join(ig, "input", "pagecontent"), { recursive: true });
      writeFileSync(join(ig, "input", "pagecontent", "index.md"), "# Home\n");
      writeFileSync(join(ig, "input", "pagecontent", "api.md"), "# API\n<!-- X_CONTENT -->\n");
      expect(hubFrom(work, ig, "https://example.org/ig")).toBeUndefined();
      mkdirSync(join(work, "ig-api"), { recursive: true });
      writeFileSync(join(work, "ig-api", "ig-api.json"), JSON.stringify({ label: "Example API", placeholder: "<!-- X_CONTENT -->" }));
      expect(hubFrom(work, ig, "https://example.org/ig")).toEqual({ url: "https://example.org/ig/api.html", placeholder: "<!-- X_CONTENT -->", label: "Example API" });
      expect(hubFrom(work, ig, undefined)).toEqual({ url: "api.html", placeholder: "<!-- X_CONTENT -->", label: "Example API" });
      writeFileSync(join(work, "ig-api", "ig-api.json"), "{}");
      expect(hubFrom(work, ig, "https://example.org/ig")).toEqual({ url: "https://example.org/ig/ig-api.html" });
    } finally {
      rmSync(ig, { recursive: true, force: true });
    }
  });
});

describe("referenceAbsent", () => {
  const root = mkdtempSync(join(tmpdir(), "ref-absent-"));
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "output-ast"), { recursive: true });
  writeFileSync(join(root, "output-ast", "here.json"), "{}");
  const mat = (localPath: string) => ({
    state: "materialized",
    provenance: { upstream: "https://example.org/ig/X.html", local: "fsh-generated/X.json" },
    localPath,
    purpose: "compiled",
    inputs: { sourceRevision: "abc123" },
  });

  it("referencesAbsentBytes", () => {
    const ix = { artifacts: [{ key: "A", materialization: mat("output-ast/here.json") }, { key: "B", materialization: mat("output-ast/gone.json") }] };
    expect(referenceAbsent(ix, root)).toBe(1);
    expect((ix.artifacts[0]!.materialization as { state: string }).state).toBe("materialized");
    expect(ix.artifacts[1]!.materialization as unknown).toEqual({
      state: "referenced",
      provenance: { upstream: "https://example.org/ig/X.html" },
      note: "built at publish from a compiled AST that this checkout does not keep (source revision abc123)",
    });
  });

  it("leavesNonMaterializedAlone", () => {
    const ix = { artifacts: [{ key: "C", materialization: { state: "referenced", provenance: { upstream: "u" } } }] };
    expect(referenceAbsent(ix, root)).toBe(0);
  });
});

describe("lockedMounts and cloneAt (bean fwtz: the IG is read at its pin)", () => {
  it("lockedMountsFullShaOnly", () => {
    const dir = mkdtempSync(join(tmpdir(), "ig-index-pin-"));
    try {
      const sha = "d1cfa96b0e83f088deaaba9e4672c77568663cbd";
      writeFileSync(join(dir, "index.lock.json"), JSON.stringify({ instances: [{ instance: "ig", repository: "beta/ig", sha }, { instance: "short", repository: "beta/short", sha: "d1cfa96" }] }));
      expect([...lockedMounts(dir)]).toEqual([["ig", { repository: "beta/ig", sha }], ["short", { repository: "beta/short" }]]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fetchesPinnedCommit", () => {
    const calls: string[][] = [];
    const git = (_cmd: string, args: string[]) => (calls.push(args), { ok: true, out: "" });
    expect(cloneAt("beta/ig", "/w/ig", "d1cfa96b0e83f088deaaba9e4672c77568663cbd", git).ok).toBe(true);
    expect(calls.map((a) => a.join(" "))).toEqual([
      "init --quiet /w/ig",
      "-C /w/ig remote add origin https://github.com/beta/ig",
      "-C /w/ig fetch --quiet --depth 1 --no-tags origin d1cfa96b0e83f088deaaba9e4672c77568663cbd",
      "-C /w/ig checkout --quiet --detach FETCH_HEAD",
    ]);
    calls.length = 0;
    cloneAt("beta/ig", "/w/ig", undefined, git);
    expect(calls).toEqual([["clone", "--quiet", "--depth", "1", "https://github.com/beta/ig", "/w/ig"]]);
  });

  it("stopsAtFirstFailingGit", () => {
    let n = 0;
    const git = () => (++n === 3 ? { ok: false, out: "not our ref" } : { ok: true, out: "" });
    expect(cloneAt("beta/ig", "/w/ig", "d1cfa96b0e83f088deaaba9e4672c77568663cbd", git)).toEqual({ ok: false, out: "not our ref" });
    expect(n).toBe(3);
  });
});

describe("pinnedAt and astAgainstPin (bean fwtz: a pinned read writes the same bytes any day)", () => {
  it("stampsPinnedCommitTime", () => {
    const git = () => ({ ok: true, out: "2026-10-30T18:07:13+00:00\n" });
    expect(pinnedAt("/w/ig", git)).toBe("2026-10-30T18:07:13+00:00");
    expect(pinnedAt("/w/ig", () => ({ ok: false, out: "no HEAD" }))).toBeUndefined();
  });

  it("saysWhetherAstMatchesPin", () => {
    const dir = mkdtempSync(join(tmpdir(), "ig-index-ast-"));
    try {
      const pin = "633b11fb2e628a9aa6086815e78edfe2d47d2095";
      const old = "adadd67d5a648c250df28ba489c5f82f28cc3356";
      expect(astAgainstPin(dir, pin)).toEqual({});
      writeFileSync(join(dir, "manifest.json"), JSON.stringify({ inputs: { sourceRevision: old } }));
      expect(astAgainstPin(dir, pin)).toEqual({ sourceRevision: old, matchesPin: false });
      expect(astAgainstPin(dir, old)).toEqual({ sourceRevision: old, matchesPin: true });
      expect(astAgainstPin(dir, undefined)).toEqual({ sourceRevision: old });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("withWorkDir", () => {
  const inTmp = <T>(fn: (tmp: string) => T): T => {
    const tmp = mkdtempSync(join(tmpdir(), "ig-index-wd-"));
    const before = process.env.TMPDIR;
    process.env.TMPDIR = tmp;
    try {
      return fn(tmp);
    } finally {
      if (before === undefined) delete process.env.TMPDIR;
      else process.env.TMPDIR = before;
      rmSync(tmp, { recursive: true, force: true });
    }
  };

  it("removesWorkDirOnFailure", () => {
    inTmp((tmp) => {
      expect(tmpdir()).toBe(tmp);
      expect(() =>
        withWorkDir(undefined, (work) => {
          mkdirSync(join(work, "some-ig"), { recursive: true });
          writeFileSync(join(work, "some-ig", "half.json"), "{");
          throw new Error("clone failed");
        }),
      ).toThrow("clone failed");
      expect(readdirSync(tmp)).toEqual([]);
    });
  });

  it("removesWorkDirOnSuccess", () => {
    inTmp((tmp) => {
      expect(withWorkDir(undefined, (work) => (writeFileSync(join(work, "x"), "x"), 7))).toBe(7);
      expect(readdirSync(tmp)).toEqual([]);
    });
  });

  it("keepsNamedWorkDir", () => {
    inTmp((tmp) => {
      const given = join(tmp, "mine");
      mkdirSync(given);
      expect(() => withWorkDir(given, () => { throw new Error("x"); })).toThrow();
      expect(existsSync(given)).toBe(true);
    });
  });
});
