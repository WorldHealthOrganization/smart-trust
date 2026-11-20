/**
 * The declared-recipe path (owner, 2026-10-10: "i want one consolidated
 * worfklow"). A repository whose `<instance>.config.json` carries
 * `site.build` is built from its own package scripts by
 * `build-instance-site.ts`, and `stage-local.ts` hands it there rather than
 * reading its workflow files. smart-ra has no publishing workflow, so reading
 * its workflows found only `fhirbuild.yml` and took the folio for an IG.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { recipeFromConfig } from "../build-instance-site.ts";
import { declaredRecipe, stageDeclared } from "../stage-local.ts";

const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

const RECIPE = { pre: ["check:archimate"], sourceSteps: ["site:document", "site:library"], siteSteps: ["site:node-kinds"] };

/** A checkout declaring `demo`, with `config` as its `demo.config.json` (none when undefined). */
function checkout(config: unknown): string {
  const d = mkdtempSync(join(tmpdir(), "stage-declared-"));
  made.push(d);
  writeFileSync(join(d, "demo.json"), JSON.stringify({ name: "demo", title: "Demo" }));
  if (config !== undefined) writeFileSync(join(d, "demo.config.json"), JSON.stringify(config));
  return d;
}

function gitRepo(d: string, branch: string): void {
  const sh = (...a: string[]) => execFileSync("git", ["-C", d, ...a], { stdio: "pipe" });
  sh("init", "-q", "-b", branch);
  sh("-c", "user.name=t", "-c", "user.email=t@t", "add", "-A");
  sh("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "init");
  sh("remote", "add", "origin", "https://github.com/o/demo");
  sh("update-ref", "refs/remotes/origin/main", "HEAD");
  sh("symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main");
}

describe("recipeFromConfig", () => {
  test("reads site.build, with an omitted list read as empty", () => {
    const d = checkout({ site: { build: { home: "README.md", sourceSteps: ["site:document"] } } });
    expect(recipeFromConfig(d, "demo")).toEqual({ home: "README.md", pre: [], sourceSteps: ["site:document"], siteSteps: [] });
  });

  test("finalSteps: read when declared, absent when not, held to package script names", () => {
    const d = checkout({ site: { build: { siteSteps: ["site:a"], finalSteps: ["site:bar"] } } });
    expect(recipeFromConfig(d, "demo")).toEqual({ pre: [], sourceSteps: [], siteSteps: ["site:a"], finalSteps: ["site:bar"] });
    expect(() => recipeFromConfig(checkout({ site: { build: { finalSteps: ["rm -rf /"] } } }), "demo")).toThrow(/package script names/);
  });

  test("no config, or a config with no site.build, is undefined", () => {
    expect(recipeFromConfig(checkout(undefined), "demo")).toBeUndefined();
    expect(recipeFromConfig(checkout({ site: { landing: true } }), "demo")).toBeUndefined();
  });

  test("a step that is a command, not a package script name, is refused", () => {
    expect(() => recipeFromConfig(checkout({ site: { build: { pre: ["rm -rf /"] } } }), "demo")).toThrow(/package script names/);
  });
});

describe("declaredRecipe", () => {
  test("names the instance the checkout declares and its recipe", () => {
    expect(declaredRecipe(checkout({ site: { build: RECIPE } }))).toEqual({ instance: "demo", recipe: RECIPE });
  });

  test("a checkout with no recipe is left to the workflow-described path", () => {
    expect(declaredRecipe(checkout({ site: { landing: true } }))).toBeUndefined();
  });
});

describe("stageDeclared --plan", () => {
  test("the default branch plans the publish root and builds nothing", async () => {
    const d = checkout({ site: { build: RECIPE } });
    gitRepo(d, "main");
    const lines: string[] = [];
    const r = await stageDeclared({ repo: d, plan: true, log: (s) => lines.push(s) }, { instance: "demo", recipe: RECIPE });
    expect(r).toEqual({ kind: "folio", via: "site.build", instance: "demo", target: "main", url: "https://o.github.io/demo/", pushed: false });
    expect(lines.join("\n")).toContain("site:node-kinds");
  });

  test("another branch plans a branches/ preview", async () => {
    const d = checkout({ site: { build: RECIPE } });
    gitRepo(d, "main");
    const r = await stageDeclared({ repo: d, branch: "claude/x", plan: true, log: () => {} }, { instance: "demo", recipe: RECIPE });
    expect(r.target).toBe("preview");
    expect(r.url).toBe("https://o.github.io/demo/branches/claude-x/");
  });

  test("--artifact is refused rather than ignored", async () => {
    const d = checkout({ site: { build: RECIPE } });
    gitRepo(d, "main");
    await expect(stageDeclared({ repo: d, artifact: "/tmp/x", log: () => {} }, { instance: "demo", recipe: RECIPE })).rejects.toThrow(/--artifact/);
  });
});
