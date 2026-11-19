/**
 * `roots.ts` names the three roots a file in this layer can mean. These tests
 * pin the resolution ORDER for the harness root and the two refusals, because
 * a wrong harness root does not fail — it reads as an empty corpus.
 *
 * @module scripts/tests/roots.test
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  HARNESS_ROOT,
  REPO_ROOT,
  TOOLS_ROOT,
  declaredInstanceName,
  harnessFlag,
  instanceFlag,
  isHarnessRoot,
  mountingInstanceRoot,
  repoRootFor,
  resolveHarnessRoot,
  resolveWorkingInstanceRoot,
  runnerRootFor,
} from "../lib/roots.ts";

const scratch = mkdtempSync(join(tmpdir(), "roots-test-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

/** A checkout `<scratch>/<name>/` holding `cat-harness/` (declared `name`) and `cat-harness-tools/`. */
function checkout(name: string, harnessName = "cat-harness"): { repo: string; harness: string; tools: string } {
  const repo = join(scratch, name);
  const harness = join(repo, "cat-harness");
  const tools = join(repo, "cat-harness-tools");
  mkdirSync(harness, { recursive: true });
  mkdirSync(tools, { recursive: true });
  writeFileSync(join(harness, "cat-harness.json"), JSON.stringify({ name: harnessName }));
  return { repo, harness, tools };
}

describe("the constants, in this checkout", () => {
  test("TOOLS_ROOT is this layer, HARNESS_ROOT its declared sibling, REPO_ROOT the checkout", () => {
    expect(TOOLS_ROOT).toBe(resolve(import.meta.dir, "..", ".."));
    expect(TOOLS_ROOT.endsWith("cat-harness-tools")).toBe(true);
    expect(HARNESS_ROOT).toBe(resolve(TOOLS_ROOT, "..", "cat-harness"));
    expect(isHarnessRoot(HARNESS_ROOT)).toBe(true);
    expect(REPO_ROOT).toBe(resolve(TOOLS_ROOT, ".."));
  });
});

describe("resolution order: --harness, then $CAT_HARNESS_ROOT, then the declared sibling", () => {
  const a = checkout("order-a");
  const b = checkout("order-b");
  const c = checkout("order-c");

  test("the flag wins over the environment and the sibling", () => {
    const r = resolveHarnessRoot({ argv: ["bun", "x.ts", "--harness", b.harness], env: { CAT_HARNESS_ROOT: c.harness }, toolsRoot: a.tools });
    expect(r).toEqual({ root: b.harness, source: "flag" });
  });

  test("--harness=<dir> is the same flag", () => {
    expect(resolveHarnessRoot({ argv: [`--harness=${b.harness}`], env: {}, toolsRoot: a.tools }).root).toBe(b.harness);
  });

  test("the environment wins over the sibling", () => {
    const r = resolveHarnessRoot({ argv: [], env: { CAT_HARNESS_ROOT: c.harness }, toolsRoot: a.tools });
    expect(r).toEqual({ root: c.harness, source: "env" });
  });

  test("with neither, the sibling", () => {
    expect(resolveHarnessRoot({ argv: [], env: {}, toolsRoot: a.tools })).toEqual({ root: a.harness, source: "sibling" });
  });

  test("an empty $CAT_HARNESS_ROOT is absent, not the current directory", () => {
    expect(resolveHarnessRoot({ argv: [], env: { CAT_HARNESS_ROOT: "" }, toolsRoot: a.tools }).source).toBe("sibling");
  });
});

describe("refusals — a wrong root reads as an empty corpus, so it must throw instead", () => {
  test("a sibling with the right directory name but another declared name is not the harness", () => {
    const x = checkout("impostor", "something-else");
    expect(isHarnessRoot(x.harness)).toBe(false);
    expect(() => resolveHarnessRoot({ argv: [], env: {}, toolsRoot: x.tools })).toThrow(/cannot find the harness/);
  });

  test("an explicit root that is not the harness throws rather than falling through", () => {
    const ok = checkout("explicit-ok");
    const empty = join(scratch, "not-a-harness");
    mkdirSync(empty, { recursive: true });
    // Falling through to the (valid) sibling would hide the typo.
    expect(() => resolveHarnessRoot({ argv: ["--harness", empty], env: {}, toolsRoot: ok.tools })).toThrow(/--harness names/);
    expect(() => resolveHarnessRoot({ argv: [], env: { CAT_HARNESS_ROOT: empty }, toolsRoot: ok.tools })).toThrow(
      /\$CAT_HARNESS_ROOT names/,
    );
  });

  test("an unparseable declaration is not the harness", () => {
    const x = checkout("garbled");
    writeFileSync(join(x.harness, "cat-harness.json"), "{ not json");
    expect(isHarnessRoot(x.harness)).toBe(false);
  });
});

describe("REPO_ROOT is absent when this layer is standalone", () => {
  test("a sibling harness gives the common parent", () => {
    const x = checkout("together");
    expect(repoRootFor(x.tools, x.harness)).toBe(x.repo);
  });

  test("a harness elsewhere gives undefined, not a plausible wrong path", () => {
    const x = checkout("apart-tools");
    const y = checkout("apart-harness");
    expect(repoRootFor(x.tools, y.harness)).toBeUndefined();
  });
});

describe("harnessFlag", () => {
  test("the last flag wins, and an empty value is absent", () => {
    expect(harnessFlag(["--harness", "/a", "--harness=/b"])).toBe("/b");
    expect(harnessFlag(["--harness="])).toBeUndefined();
    expect(harnessFlag(["--harness"])).toBeUndefined();
    expect(harnessFlag(["--harnessy", "/a"])).toBeUndefined();
  });
});

/**
 * The layer being worked on (bean `j3ls`). Each layout is a fixture whose
 * `.git` is a plain directory: the resolver reads the marker, never git.
 */
describe("resolveWorkingInstanceRoot: the instance worked on, not the one loaded from", () => {
  /** A separated layer's repository, `<scratch>/<dir>/`, declaring `name` and mounting the harness. */
  function separated(dir: string, name = "who-iris"): { repo: string; harness: string; tools: string } {
    const x = checkout(dir);
    mkdirSync(join(x.repo, ".git"), { recursive: true });
    writeFileSync(join(x.repo, `${name}.json`), JSON.stringify({ name }));
    writeFileSync(join(x.repo, "package.json"), JSON.stringify({ name: `@litlfred/${name}` }));
    return x;
  }

  test("a harness MOUNTED in a separated instance's checkout resolves to that instance", () => {
    const x = separated("mounted");
    expect(mountingInstanceRoot(x.harness)).toBe(x.repo);
    expect(resolveWorkingInstanceRoot({ argv: [], env: {}, harnessRoot: x.harness })).toEqual({ root: x.repo, source: "mount" });
  });

  test("the declared name decides, never the folder: a clone named `wim/` is still who-iris", () => {
    const x = separated("wim");
    expect(declaredInstanceName(x.repo)).toBe("who-iris");
  });

  test("the harness in its own repository is the harness", () => {
    const x = checkout("own-repo");
    mkdirSync(join(x.harness, ".git"), { recursive: true });
    expect(resolveWorkingInstanceRoot({ argv: [], env: {}, harnessRoot: x.harness })).toEqual({ root: x.harness, source: "harness" });
  });

  test("an index checkout whose root declares nothing keeps the harness", () => {
    const x = checkout("index");
    mkdirSync(join(x.repo, ".git"), { recursive: true });
    writeFileSync(join(x.repo, "index.config.json"), JSON.stringify({ title: "an index" }));
    writeFileSync(join(x.repo, "package.json"), JSON.stringify({ name: "@litlfred/folio-assistant-index" }));
    expect(declaredInstanceName(x.repo)).toBeUndefined();
    expect(resolveWorkingInstanceRoot({ argv: [], env: {}, harnessRoot: x.harness }).source).toBe("harness");
  });

  test("no `.git` anywhere keeps the harness", () => {
    const x = checkout("no-git");
    writeFileSync(join(x.repo, "who-iris.json"), JSON.stringify({ name: "who-iris" }));
    // The scratch dir is under the OS tmpdir, which holds no `.git`.
    expect(resolveWorkingInstanceRoot({ argv: [], env: {}, harnessRoot: x.harness }).source).toBe("harness");
  });

  test("--instance wins over the environment and the mount; a declaration-less root throws", () => {
    const x = separated("flagged");
    const other = separated("other", "smart-base");
    expect(resolveWorkingInstanceRoot({ argv: ["--instance", other.repo], env: { CAT_INSTANCE_ROOT: x.repo }, harnessRoot: x.harness })).toEqual({
      root: other.repo,
      source: "flag",
    });
    expect(resolveWorkingInstanceRoot({ argv: [], env: { CAT_INSTANCE_ROOT: other.repo }, harnessRoot: x.harness }).source).toBe("env");
    const empty = join(scratch, "declares-nothing");
    mkdirSync(empty, { recursive: true });
    expect(() => resolveWorkingInstanceRoot({ argv: [`--instance=${empty}`], env: {}, harnessRoot: x.harness })).toThrow(/--instance names/);
    expect(() => resolveWorkingInstanceRoot({ argv: [], env: { CAT_INSTANCE_ROOT: empty }, harnessRoot: x.harness })).toThrow(
      /\$CAT_INSTANCE_ROOT names/,
    );
  });

  test("instanceFlag: the last flag wins, and an empty value is absent", () => {
    expect(instanceFlag(["--instance", "/a", "--instance=/b"])).toBe("/b");
    expect(instanceFlag(["--instance="])).toBeUndefined();
  });

  test("runnerRootFor: the checkout holding both layers, else the harness's parent", () => {
    const x = separated("runner");
    expect(runnerRootFor(x.harness, repoRootFor(x.tools, x.harness))).toBe(x.repo);
    expect(runnerRootFor(x.harness, undefined)).toBe(x.repo);
  });
});
