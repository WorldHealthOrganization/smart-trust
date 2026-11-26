import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { spawnSync } from "node:child_process";

import { enablePagesByHand, exitStatus, httpAnswer, initSteps, offlineProbe, ownerRepo, pagesWorkflow, type Probe } from "./init.ts";

/** A fake layer `demo` needing `base`, as sibling checkouts. */
function fixture(opts: { workflow?: boolean; withBase?: boolean } = {}): string {
  const top = mkdtempSync(join(tmpdir(), "init-"));
  const root = join(top, "demo");
  mkdirSync(join(root, "skills"), { recursive: true });
  writeFileSync(join(root, "skills", "x.md"), "x\n");
  writeFileSync(join(root, "README.md"), "# demo\n");
  writeFileSync(
    join(root, "demo.json"),
    JSON.stringify({
      name: "demo",
      repository: "someone/demo",
      needs: ["base"],
      directories: [
        { id: "skills", path: "skills/", graphTypologies: ["skills"] },
        { id: "gone", path: "gone/", graphTypologies: ["skills"] },
      ],
    }),
  );
  if (opts.workflow) {
    mkdirSync(join(root, ".github", "workflows"), { recursive: true });
    writeFileSync(join(root, ".github", "workflows", "pages.yml"), "steps:\n  - run: git push origin HEAD:gh-pages\n");
  }
  if (opts.withBase) {
    mkdirSync(join(top, "base", "docs", "bootstrap"), { recursive: true });
    writeFileSync(join(top, "base", "base.json"), JSON.stringify({ name: "base", directories: [] }));
    writeFileSync(join(top, "base", "docs", "bootstrap", "initialization.md"), "do this\n");
  }
  return root;
}

const state = (steps: { id: string; state: string }[], id: string) => steps.find((s) => s.id === id)?.state;

describe("init — the steps the declarations name, in four states", () => {
  test("parsesOwnerRepo", () => {
    expect(ownerRepo("litlfred/bootstrap")).toEqual({ owner: "litlfred", repo: "bootstrap" });
    expect(ownerRepo("https://github.com/litlfred/bootstrap.git")).toEqual({ owner: "litlfred", repo: "bootstrap" });
    expect(ownerRepo(undefined)).toBeUndefined();
  });

  test("checksDirectoriesNeedsReadme", async () => {
    const { steps } = await initSteps(fixture(), { probe: offlineProbe, dryRun: true });
    expect(state(steps, "declaration")).toBe("done");
    expect(state(steps, "directory:skills")).toBe("done");
    expect(state(steps, "directory:gone")).toBe("not-done");
    expect(state(steps, "needs:base")).toBe("not-done");
    expect(state(steps, "readme")).toBe("done");
    expect(state(steps, "site:workflow")).toBe("not-done");
  });

  test("workflowPublisherMustCheckOut", () => {
    const root = fixture();
    const tools = mkdtempSync(join(tmpdir(), "tools-"));
    mkdirSync(join(tools, ".github", "workflows"), { recursive: true });
    const wf = (repo: string) => `steps:\n  - uses: actions/checkout@v4\n    with:\n      repository: ${repo}\n  - run: git push origin gh-pages\n`;
    writeFileSync(join(tools, ".github", "workflows", "other.yml"), wf("someone/other"));
    expect(pagesWorkflow(root, { owner: "someone", repo: "demo" }, tools)).toBeUndefined();
    writeFileSync(join(tools, ".github", "workflows", "publish-demo.yml"), wf("someone/demo"));
    expect(pagesWorkflow(root, { owner: "someone", repo: "demo" }, tools)).toBe("the toolset's .github/workflows/publish-demo.yml, publishing someone/demo");
    expect(pagesWorkflow(root, undefined, tools)).toBeUndefined();
  });

  test("neededHarnessStepsStated", async () => {
    const { steps } = await initSteps(fixture({ withBase: true }), { probe: offlineProbe, dryRun: true });
    expect(state(steps, "needs:base")).toBe("done");
    expect(state(steps, "instructions:base")).toBe("stated");
  });

  test("noGhPagesUndetermined", async () => {
    const { steps } = await initSteps(fixture({ workflow: true }), { probe: offlineProbe, dryRun: true });
    const s = steps.find((x) => x.id === "site:enabled")!;
    expect(s.state).toBe("could-not-determine");
    expect(s.action).toBe(enablePagesByHand({ owner: "someone", repo: "demo" }));
    expect(s.action).toContain("https://github.com/someone/demo/settings/pages");
    expect(state(steps, "site:live")).toBe("could-not-determine");
  });

  const branchExists = (yes: boolean): Probe["git"] => () => ({ status: 0, stdout: yes ? "abc123\trefs/heads/gh-pages\n" : "", stderr: "" });

  test("ghPagesBranchNeverCreated", async () => {
    const probe: Probe = {
      gh: (args) => (args[0] === "auth" ? { status: 0, stdout: "", stderr: "" } : args.includes("POST") ? (() => { throw new Error("enabled before the branch exists"); })() : { status: 1, stdout: "", stderr: "HTTP 404" }),
      httpStatus: async () => 404,
      git: branchExists(false),
    };
    const { steps } = await initSteps(fixture({ workflow: true }), { probe });
    expect(state(steps, "site:branch")).toBe("not-done");
    expect(steps.find((x) => x.id === "site:branch")!.action).toContain("--orphan gh-pages");
    expect(state(steps, "site:enabled")).toBe("not-done");
    const ids = steps.map((x) => x.id);
    expect(ids.indexOf("site:branch")).toBeLessThan(ids.indexOf("site:enabled"));
  });

  test("branchWithoutGitUndetermined", async () => {
    const { steps } = await initSteps(fixture({ workflow: true }), { probe: offlineProbe, dryRun: true });
    expect(state(steps, "site:branch")).toBe("could-not-determine");
  });

  test("enablesPagesThenRechecks", async () => {
    const calls: string[][] = [];
    let on = false;
    const probe: Probe = {
      gh(args) {
        calls.push(args);
        if (args[0] === "auth") return { status: 0, stdout: "", stderr: "" };
        if (args.includes("POST")) {
          on = true;
          return { status: 0, stdout: "{}", stderr: "" };
        }
        return on ? { status: 0, stdout: '{"source":{"branch":"gh-pages","path":"/"}}', stderr: "" } : { status: 1, stdout: "", stderr: "HTTP 404: Not Found" };
      },
      httpStatus: async () => 404,
      git: branchExists(true),
    };
    const { steps } = await initSteps(fixture({ workflow: true }), { probe });
    const s = steps.find((x) => x.id === "site:enabled")!;
    expect(s.state).toBe("done");
    expect(s.performed).toBe(true);
    expect(calls).toContainEqual(["api", "-X", "POST", "repos/someone/demo/pages", "-f", "source[branch]=gh-pages", "-f", "source[path]=/"]);
    expect(state(steps, "site:live")).toBe("not-done");
  });

  test("dryRunEnablesNothing", async () => {
    const probe: Probe = {
      gh: (args) => (args[0] === "auth" ? { status: 0, stdout: "", stderr: "" } : args.includes("POST") ? (() => { throw new Error("enabled in a dry run"); })() : { status: 1, stdout: "", stderr: "HTTP 404" }),
      httpStatus: async () => undefined,
      git: branchExists(true),
    };
    const { steps } = await initSteps(fixture({ workflow: true }), { probe, dryRun: true });
    expect(state(steps, "site:enabled")).toBe("not-done");
  });

  test("exitStatusRanking", () => {
    expect(exitStatus([{ id: "a", namedBy: "x", what: "", detail: "", state: "done" }])).toBe(0);
    expect(exitStatus([{ id: "a", namedBy: "x", what: "", detail: "", state: "could-not-determine" }])).toBe(3);
    expect(
      exitStatus([
        { id: "a", namedBy: "x", what: "", detail: "", state: "could-not-determine" },
        { id: "b", namedBy: "x", what: "", detail: "", state: "not-done" },
      ]),
    ).toBe(1);
  });

  test("httpStatusClassified", () => {
    expect(httpAnswer(200)).toBe("done");
    expect(httpAnswer(301)).toBe("done");
    expect(httpAnswer(404)).toBe("not-done");
    expect(httpAnswer(403)).toBe("could-not-determine");
    expect(httpAnswer(407)).toBe("could-not-determine");
    expect(httpAnswer(503)).toBe("could-not-determine");
    expect(httpAnswer(undefined)).toBe("could-not-determine");
  });

  describe("the PRIMARY step: JSON Schema and JSON-LD at their IRIs", () => {
    const top = mkdtempSync(join(tmpdir(), "init-docs-"));
    const root = join(top, "kg");
    mkdirSync(join(root, "schemas"), { recursive: true });
    writeFileSync(join(root, "kg.json"), JSON.stringify({ name: "kg", version: "0.1.0", iriBase: "https://o.github.io/kg/", repository: "o/kg", directories: [{ id: "schemas", path: "schemas/", graphTypologies: ["schemas"] }] }));
    writeFileSync(join(root, "README.md"), "# kg\n");
    writeFileSync(join(root, "schemas", "a.schema.json"), JSON.stringify({ $id: "https://o.github.io/kg/v0/schemas/a.schema.json" }));
    spawnSync("git", ["init", "-q"], { cwd: root });
    const probeWith = (status: (url: string) => number | undefined): Probe => ({ gh: () => undefined, httpStatus: async (u) => status(u) });

    test("primaryStepAfterDeclaration", async () => {
      const { steps } = await initSteps(root, { probe: offlineProbe, dryRun: true });
      const ids = steps.map((s) => s.id);
      expect(ids.slice(0, 3)).toEqual(["declaration", "schemas:staged", "schemas:published"]);
      expect(state(steps, "schemas:staged")).toBe("done");
      expect(state(steps, "schemas:published")).toBe("could-not-determine");
    });

    test("primaryStepHttpVerdicts", async () => {
      const at = async (code: number) => state((await initSteps(root, { probe: probeWith(() => code), dryRun: true })).steps, "schemas:published");
      expect(await at(404)).toBe("not-done");
      expect(await at(403)).toBe("could-not-determine");
      expect(await at(200)).toBe("done");
    });

    test("liveNeedsReadmePage", async () => {
      const { steps } = await initSteps(root, { probe: probeWith((u) => (u.endsWith("README.html") ? 404 : 200)), dryRun: true });
      const live = steps.find((x) => x.id === "site:live")!;
      expect(live.state).toBe("not-done");
      expect(live.detail).toContain("README.html answered 404");
    });

    test("live403Undetermined", async () => {
      const { steps } = await initSteps(root, { probe: probeWith(() => 403), dryRun: true });
      expect(state(steps, "site:live")).toBe("could-not-determine");
    });
  });
});

