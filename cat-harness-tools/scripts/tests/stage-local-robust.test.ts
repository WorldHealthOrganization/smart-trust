/**
 * Three ways an agent-run publish used to fail, each hit on an IG's
 * first publish (2026-11-06; its own publish script worked around them
 * by hand), and each now handled by the publisher. Every origin
 * here is a local bare repository, so nothing reaches the network.
 *
 * 1. origin has no `gh-pages`: started as an orphan holding `.nojekyll`.
 * 2. a mount an earlier attempt left modified: named with the exact command
 *    that re-lays it, or re-laid under `--fresh`.
 * 3. `render:bpmn`'s beside-source drawings: sent out of the checkout during
 *    a build, so no untracked SVG lands beside an IG's `input/**.bpmn`.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { buildInstanceSite } from "../build-instance-site.ts";
import { BESIDE_SOURCE_OUT_ENV, besideSourceTarget } from "../lib/beside-source-out.ts";
import { ensurePublishBranch, NEW_BRANCH_FILE, remoteHasBranch } from "../lib/publish-branch.ts";
import { checkRemote, editedMountsIn, mountRemote, relayAdvice } from "../remote-mount.ts";
import { relayEditedMounts, type SitePublisher, stageLocal } from "../stage-local.ts";

const ENV = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };

function git(cwd: string, ...args: string[]): string {
  const r = spawnSync("git", args, { cwd, encoding: "utf-8", env: ENV });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}

function write(root: string, files: Record<string, string | object>): void {
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), typeof body === "string" ? body : JSON.stringify(body, null, 2));
  }
}

/** `files` committed on `main` and served as a bare repository. */
function bareRepo(name: string, files: Record<string, string | object>): { bare: string; sha: string } {
  const work = join(base, `${name}-work`);
  mkdirSync(work, { recursive: true });
  git(work, "init", "-q", "-b", "main");
  write(work, files);
  git(work, "add", "-A");
  git(work, "commit", "-q", "-m", "fixture");
  const bare = join(base, `${name}.git`);
  git(base, "clone", "-q", "--bare", work, bare);
  git(bare, "config", "uploadpack.allowFilter", "true");
  git(bare, "config", "uploadpack.allowAnySHA1InWant", "true");
  return { bare, sha: git(work, "rev-parse", "HEAD") };
}

let base: string;
let n = 0;
beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "stage-local-robust-"));
});
afterAll(() => rmSync(base, { recursive: true, force: true }));

describe("1. origin has no gh-pages: it is started as an orphan holding .nojekyll", () => {
  test("ensurePublishBranch starts the branch once, and leaves an existing one alone", () => {
    const { bare } = bareRepo(`nopages-${++n}`, { "README.md": "# r\n" });
    expect(remoteHasBranch(bare, "gh-pages")).toBe(false);
    const said: string[] = [];
    expect(ensurePublishBranch(bare, "gh-pages", { log: (s) => said.push(s) })).toBe("created");
    expect(said.join("\n")).toContain("orphan");
    expect(git(bare, "ls-tree", "-r", "--name-only", "gh-pages")).toBe(NEW_BRANCH_FILE);
    // An orphan: no parent, so main's history is not on the publish branch.
    expect(git(bare, "rev-list", "--count", "gh-pages")).toBe("1");
    const tip = git(bare, "rev-parse", "gh-pages");
    expect(ensurePublishBranch(bare, "gh-pages")).toBe("exists");
    expect(git(bare, "rev-parse", "gh-pages")).toBe(tip);
  });

  test("a remote that does not answer is never read as 'no branch'", () => {
    const missing = join(base, "no-such-remote.git");
    expect(remoteHasBranch(missing, "gh-pages")).toHaveProperty("unknown");
    expect(() => ensurePublishBranch(missing, "gh-pages")).toThrow(/could not read gh-pages/);
  });

  test("stage-local's push publishes onto the branch it started, instead of failing", async () => {
    const { bare } = bareRepo(`stage-${++n}`, { "README.md": "# r\n", ".github/workflows/pages.yml": "jobs:\n  build:\n    uses: o/tools/.github/workflows/standin.yml@main\n" });
    const repo = join(base, `stage-clone-${n}`);
    git(base, "clone", "-q", bare, repo);
    // origin reads as GitHub, and talks to the local bare repository.
    git(repo, "remote", "set-url", "origin", "https://github.com/o/r");
    git(repo, "config", `url.${bare}.insteadOf`, "https://github.com/o/r");
    // The publish commit is made by stage-local's own git calls, which read the
    // repository's identity: a runner with no global git identity (the
    // standalone rehearsal) refused it, so the checkout carries its own.
    git(repo, "config", "user.name", "t");
    git(repo, "config", "user.email", "t@t");
    git(repo, "checkout", "-q", "-b", "feature");
    expect(remoteHasBranch(bare, "gh-pages")).toBe(false);
    const standIn: SitePublisher = {
      kind: "standin",
      workflows: ["standin.yml"],
      preferred: "standin.yml",
      stage: async (run, host) => {
        const r = await host.pushLoop({
          repo: run.repo,
          publishBranch: "gh-pages",
          gate: false,
          attempts: 1,
          compose: (pages) => {
            write(pages, { "branches/feature/index.html": "<p>preview</p>" });
            return { commit: ["preview of feature"], add: ["branches"] };
          },
          url: "https://o.github.io/r/branches/feature/",
          log: run.log,
        });
        return { kind: "standin", target: run.target, slug: "feature", url: "", site: "", plan: {} as never, ...r };
      },
    };
    const said: string[] = [];
    const r = await stageLocal({ repo, publisher: "standin", publishers: [standIn], log: (s) => said.push(s) });
    expect(r.pushed).toBe(true);
    expect(said.join("\n")).toContain("orphan");
    expect(git(bare, "ls-tree", "-r", "--name-only", "gh-pages").split("\n").sort()).toEqual([NEW_BRANCH_FILE, "branches/feature/index.html"]);
    expect(git(bare, "rev-list", "--count", "gh-pages")).toBe("2");
  });
});

describe("2. a mount an earlier attempt left modified", () => {
  let up: { bare: string; sha: string };
  let urlFor: (r: string) => string;
  beforeAll(() => {
    up = bareRepo("up", {
      "core/core.json": { name: "core", livesAt: { repository: "o/up", path: "core" }, directories: [{ id: "core-scripts", path: "scripts/", graphTypologies: ["code"] }] },
      "core/scripts/run.ts": "export const answer = 42;\n",
    });
    urlFor = (r) => {
      if (r !== "o/up") throw new Error(`no fixture for ${r}`);
      return `file://${up.bare}`;
    };
  });

  /** A checkout mounting `core` from the local bare origin, then edited the way a build edits a mount. */
  function editedCheckout(): string {
    const root = join(base, `down-${++n}`);
    mkdirSync(root, { recursive: true });
    git(root, "init", "-q", "-b", "main");
    git(root, "remote", "add", "origin", "https://github.com/o/down");
    const consent = { trust: { consent: { by: "test", on: "2026-11-07", ref: up.sha, evidence: "stage-local-robust.test.ts" } } };
    write(root, { "down.json": { name: "down", directories: [], mountApprovers: ["test"], remoteMounts: [{ harness: "core", repository: "o/up", ref: up.sha, ...consent }] } });
    mountRemote({ instanceRoot: root, urlFor });
    writeFileSync(join(root, "core/scripts/written-by-a-build.svg"), "<svg/>\n");
    return root;
  }

  test("is named, with the exact command that re-lays it", () => {
    const root = editedCheckout();
    const edited = editedMountsIn(root);
    expect(edited.map((e) => e.instance)).toEqual(["core"]);
    const advice = relayAdvice(root, edited, { script: join(root, "cat-harness-tools/scripts/remote-mount.ts") });
    expect(advice).toContain("core (core/)");
    expect(advice).toContain(`cd ${root} && bun run cat-harness-tools/scripts/remote-mount.ts --fresh`);
    expect(advice).toContain("--fresh to stage-local.ts");
  });

  test("a plan prints the advice; without --fresh nothing is re-laid", () => {
    const root = editedCheckout();
    const said: string[] = [];
    let relaid = 0;
    expect(relayEditedMounts(root, { plan: true, fresh: true }, (s) => said.push(s), () => relaid++)).toEqual([]);
    expect(said.join("\n")).toContain("--fresh");
    expect(relayEditedMounts(root, {}, () => {}, () => relaid++)).toEqual([]);
    expect(relaid).toBe(0);
  });

  test("--fresh re-lays it, and the mount matches the lock again", () => {
    const root = editedCheckout();
    const said: string[] = [];
    const relaid = relayEditedMounts(root, { fresh: true }, (s) => said.push(s), (r) => void mountRemote({ instanceRoot: r, urlFor, discardEdits: true }));
    expect(relaid).toEqual(["core"]);
    expect(said.join("\n")).toContain("re-laying 1 mount(s)");
    expect(existsSync(join(root, "core/scripts/written-by-a-build.svg"))).toBe(false);
    expect(editedMountsIn(root)).toEqual([]);
    expect(checkRemote({ instanceRoot: root }).outcomes.find((o) => o.instance === "core")!.state).not.toBe("missing");
  });

  test("the build refuses before its mount step, saying how to re-lay", async () => {
    const root = editedCheckout();
    await expect(
      buildInstanceSite({ root, instance: "down", linkRoot: "https://example.org", out: join(base, `out-${n}`), pre: [], sourceSteps: [], mount: true, fresh: false, publish: false }),
    ).rejects.toThrow(/remote-mount\.ts --fresh/);
  });
});

describe("3. render:bpmn's beside-source drawings go out of the checkout during a build", () => {
  test("beside the source by default; under the build's directory, at the repository-relative path, when set", () => {
    expect(besideSourceTarget("/r/input/business-processes/a.bpmn", "/r")).toBe("/r/input/business-processes/a.svg");
    expect(besideSourceTarget("/r/input/business-processes/a.bpmn", "/r", "/out/d")).toBe("/out/d/input/business-processes/a.svg");
    expect(besideSourceTarget("/elsewhere/b.bpmn", "/r", "/out/d")).toBe("/out/d/_outside/elsewhere/b.svg");
  });

  test("the build hands every step a directory outside the checkout for them", async () => {
    const root = join(base, `ig-${++n}`);
    mkdirSync(root, { recursive: true });
    git(root, "init", "-q", "-b", "main");
    git(root, "remote", "add", "origin", "https://github.com/o/ig");
    // The drawing step stands in for render:bpmn: it records where it was told
    // to draw, and stops the build there.
    write(root, {
      "ig.json": { name: "ig", directories: [] },
      "package.json": { name: "ig", private: true, scripts: { "check:l1-complete": "true", "render:bpmn": `sh -c 'printf %s "$${BESIDE_SOURCE_OUT_ENV}" > probe.txt; exit 3'` } },
    });
    git(root, "add", "-A");
    git(root, "commit", "-q", "-m", "fixture");
    const out = join(base, `ig-${n}-site`);
    await expect(
      buildInstanceSite({ root, instance: "ig", linkRoot: "https://example.org", out, pre: ["render:bpmn"], sourceSteps: [], mount: false, fresh: false, publish: false }),
    ).rejects.toThrow(/pre: render:bpmn failed/);
    const told = readFileSync(join(root, "probe.txt"), "utf-8");
    expect(told).toBe(join(out, "beside-source-drawings"));
    expect(told.startsWith(`${root}/`)).toBe(false);
  });
});
