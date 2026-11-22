/**
 * Remote mounts (bean `0mpw`) against FIXTURE REPOSITORIES — local bare git
 * repositories served over `file://`, so the real fetch path (shallow,
 * blobless, one commit, sparse checkout) runs with no network.
 *
 * The fixture is the shape the who-iris cutover needs, shrunk:
 *
 *   o/up    core   needs base   — mountDefaults narrows to `core-scripts`
 *           base   needs boot   — one directory is branch-kept, so not mounted
 *           boot   a GITLINK    → o/boot at its own pin (the submodule case)
 *   o/boot  boot   (at the repository root)
 *
 * The falsifier from the opening brief is test 2: a module in the mounted
 * `core` imports `../../base/schemas/util.ts` and must resolve.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { declarationChain } from "../../schemas/kg/harness-config.ts";
import { layerRootsIn } from "../../schemas/kg/instance-roots.ts";
import { RemoteSourceSchema, resolveSubgraphSource } from "../../schemas/kg/subgraph-source.ts";
import { MountLockSchema, mountedInstanceRoots } from "../../schemas/kg/remote-mount.ts";
import { AGENT_SURFACE_GENERATORS, checkRemote, currentPerLock, editedOnlyPerLock, optInDriftFromLock, exitCode, lockTextWithPinnedAt, mountRemote, planRemote, regenerateAgentSurface, remoteFanOut, summarise, switchedOffOptInPaths } from "../remote-mount.ts";
import { IGNORE_BLOCK_BEGIN, IGNORE_BLOCK_END, INDEX_CONFIG_SCHEMA, readDeclaredMounts } from "../../schemas/kg/index-config.ts";
import { run as replayLocks } from "../mount-from-lock.ts";
import { gitCorpus } from "../../schemas/sdlc/git-corpus.ts";
import { subgraphIndexPackage } from "../../schemas/kg/subgraph-manifest.ts";
import { packSubgraphIndex } from "../subgraph-index-package.ts";

function git(cwd: string, ...args: string[]): string {
  // input-site: tree #7150efbd — git in the test's own scratch repository, with the environment handed whole plus a fixed identity: git's answer, which the cone replays or records
  const r = spawnSync("git", args, { cwd, encoding: "utf-8", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}

function write(root: string, files: Record<string, string | object>): void {
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), typeof body === "string" ? body : JSON.stringify(body, null, 2));
  }
}

/** Commit `files` (plus any gitlinks) into a fresh repository and serve it bare. Returns the bare path and the commit. */
function bareRepo(base: string, name: string, files: Record<string, string | object>, gitlinks: Record<string, string> = {}): { bare: string; sha: string } {
  const work = join(base, `${name}-work`);
  mkdirSync(work, { recursive: true });
  git(work, "init", "-q", "-b", "main");
  write(work, files);
  git(work, "add", "-A");
  for (const [path, sha] of Object.entries(gitlinks)) git(work, "update-index", "--add", "--cacheinfo", `160000,${sha},${path}`);
  git(work, "commit", "-q", "-m", "fixture");
  const sha = git(work, "rev-parse", "HEAD");
  const bare = join(base, `${name}.git`);
  git(base, "clone", "-q", "--bare", work, bare);
  git(bare, "config", "uploadpack.allowFilter", "true");
  git(bare, "config", "uploadpack.allowAnySHA1InWant", "true");
  return { bare, sha };
}

let base: string;
let up: { bare: string; sha: string };
let boot: { bare: string; sha: string };
let urlFor: (r: string) => string;

const decl = (name: string, extra: object = {}): object => ({ name, directories: [], ...extra });

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "remote-mount-test-"));
  boot = bareRepo(base, "boot", {
    "boot.json": decl("boot", { directories: [{ id: "boot-schemas", path: "schemas/", graphTypologies: ["code"] }] }),
    "schemas/floor.ts": "export const floor = 1;\n",
    "ns.jsonld": '{"@context":{}}\n',
    "README.md": "# boot\n",
  });
  up = bareRepo(
    base,
    "up",
    {
      ".gitmodules": '[submodule "boot"]\n\tpath = boot\n\turl = https://github.com/o/boot\n',
      "core/core.json": decl("core", {
        needs: ["base"],
        livesAt: { repository: "o/up", path: "core" },
        mountDefaults: { directories: ["core-scripts"] },
        directories: [
          { id: "core-scripts", path: "scripts/", graphTypologies: ["code"] },
          { id: "core-docs", path: "docs/", graphTypologies: ["code"] },
        ],
      }),
      "core/scripts/run.ts": 'import { answer } from "../../base/schemas/util.ts";\nexport const doubled = answer * 2;\n',
      "core/docs/readme.md": "# core\n",
      "base/base.json": decl("base", {
        needs: ["boot"],
        livesAt: { repository: "o/up", path: "base" },
        directories: [
          { id: "base-schemas", path: "schemas/", graphTypologies: ["code"] },
          { id: "base-state", path: "state/", graphTypologies: ["code"], source: { kind: "branch", branch: "cat/base/state", keyedBy: "tip" } },
        ],
      }),
      "base/schemas/util.ts": "export const answer = 42;\n",
      "base/state/x.md": "state\n",
    },
    { boot: boot.sha },
  );
  const map: Record<string, string> = { "o/up": `file://${up.bare}`, "o/boot": `file://${boot.bare}` };
  urlFor = (r) => {
    const u = map[r];
    if (!u) throw new Error(`no fixture for ${r}`);
    return u;
  };
});

afterAll(() => rmSync(base, { recursive: true, force: true }));

let n = 0;
/** A person's consent for one pin (H8, bean `ieum`): without it a real mount is refused. */
const consentFor = (ref: string) => ({ trust: { consent: { by: "test", on: "2026-10-07", ref, evidence: "remote-mount.test.ts" } } });
/**
 * A fresh downstream checkout declaring `remoteMounts`. By default it declares
 * `mountApprovers: ["test"]`, and consents to the gitlinked `boot` at its own
 * pin on `overrides.boot.trust` — a gitlink is not covered by its parent's
 * consent (roast `1ygp` L4.2). `noGitlinkConsent` leaves that out.
 */
function downstream(mount: { overrides?: Record<string, object>; [field: string]: unknown }, extra: object = {}, noGitlinkConsent = false): string {
  const root = join(base, `down-${++n}`);
  mkdirSync(root, { recursive: true });
  git(root, "init", "-q", "-b", "main");
  const overrides: Record<string, object> = { ...mount.overrides };
  if (!noGitlinkConsent) overrides.boot = { ...consentFor(boot.sha), ...overrides.boot };
  write(root, {
    "down.json": decl("down", { mountApprovers: ["test"], remoteMounts: [{ harness: "core", repository: "o/up", ref: up.sha, ...consentFor(up.sha), ...mount, overrides }], ...extra }),
  });
  return root;
}

/** Rewrite the downstream's declaration in place. */
function editDecl(root: string, edit: (d: { mountApprovers?: string[]; remoteMounts: Array<Record<string, unknown>> }) => void): void {
  const file = join(root, "down.json");
  const d = JSON.parse(readFileSync(file, "utf-8"));
  edit(d);
  writeFileSync(file, JSON.stringify(d, null, 2));
}

const readLock = (root: string) => MountLockSchema.parse(JSON.parse(readFileSync(join(root, "index.lock.json"), "utf-8")));

describe("the remote source member", () => {
  test("a pin is a full 40-character SHA, never a branch or an abbreviation", () => {
    expect(RemoteSourceSchema.safeParse({ kind: "remote", repository: "o/r", ref: "a".repeat(40) }).success).toBe(true);
    expect(RemoteSourceSchema.safeParse({ kind: "remote", repository: "o/r", ref: "main" }).success).toBe(false);
    expect(RemoteSourceSchema.safeParse({ kind: "remote", repository: "o/r", ref: "a".repeat(12) }).success).toBe(false);
  });

  test("resolves with the upstream path defaulting to the entry's own", () => {
    const r = resolveSubgraphSource({ id: "x", path: "skills/", source: { kind: "remote", repository: "o/r", ref: "b".repeat(40) } });
    expect(r).toMatchObject({ kind: "remote", repository: "o/r", upstreamPath: "skills/", declaredIn: "declaration" });
  });
});

describe("mount:remote over fixture repositories", () => {
  test("1. the closure is mounted transitively: same tree, then a gitlink pin", () => {
    const root = downstream({});
    const r = mountRemote({ instanceRoot: root, urlFor });
    const by = Object.fromEntries(r.plan.outcomes.map((o) => [o.instance, o.state]));
    expect(by).toEqual({ core: "mounted", base: "mounted", boot: "mounted" });
    // core: only what its mountDefaults names
    expect(existsSync(join(root, "core/core.json"))).toBe(true);
    expect(existsSync(join(root, "core/scripts/run.ts"))).toBe(true);
    expect(existsSync(join(root, "core/docs"))).toBe(false);
    // base: every in-checkout directory, and NOT the branch-kept one
    expect(existsSync(join(root, "base/schemas/util.ts"))).toBe(true);
    expect(existsSync(join(root, "base/state"))).toBe(false);
    // boot: read from ITS repository at the gitlink's pin, at its root
    expect(readFileSync(join(root, "boot/schemas/floor.ts"), "utf-8")).toContain("floor");

    const lock = MountLockSchema.parse(JSON.parse(readFileSync(join(root, "index.lock.json"), "utf-8")));
    const bootLock = lock.instances.find((i) => i.instance === "boot")!;
    expect(bootLock).toMatchObject({ repository: "o/boot", sha: boot.sha, pinnedBy: "gitlink", upstreamRoot: "" });
    expect(lock.instances.find((i) => i.instance === "base")!.pinnedBy).toBe("same-tree");

    const c = checkRemote({ instanceRoot: root });
    expect(c.state).toBe("mounted");
    expect(exitCode(c.state)).toBe(0);
  });

  test("1b. an instance entry left at an older commit than its pin is missing, not mounted (folio-assistant#2682)", () => {
    const root = downstream({});
    mountRemote({ instanceRoot: root, urlFor });
    const file = join(root, "index.lock.json");
    const lock = JSON.parse(readFileSync(file, "utf-8")) as { mounts: Array<{ harness: string; repository: string }>; instances: Array<{ instance: string; via: string; repository: string; sha: string }> };
    // What `--seed` left behind: the pin moved, its own layer entry did not.
    const own = lock.instances.find((i) => lock.mounts.some((m) => m.harness === i.via && m.repository === i.repository))!;
    own.sha = "f".repeat(40);
    writeFileSync(file, `${JSON.stringify(lock, null, 2)}\n`);
    const c = checkRemote({ instanceRoot: root });
    expect(c.state).toBe("missing");
    expect(c.reason).toContain(`${own.instance} at ffffffffffff`);
  });

  test("1c. a concern name expands to the members its kinds declare: processes/sdlc/ and skills/sdlc/ (bean mo75)", () => {
    const cg = bareRepo(base, "cg", {
      "cg.json": decl("cg", {
        directories: [
          { id: "processes", path: "processes/", graphTypologies: ["processes"] },
          { id: "skills", path: "skills/", graphTypologies: ["skills"] },
          { id: "notes", path: "notes/", graphTypologies: ["code"] },
        ],
      }),
      // declared-path-literal: fixture keys of the bare repository this test builds under its temp base; they
      // name files inside that fixture tree, never this checkout's `processes/` or `skills/`.
      "processes/processes.json": { $schema: "concern-groups/v1", groups: ["sdlc", "kg"] },
      "processes/sdlc/a.bpmn": "<definitions/>\n",
      "processes/kg/b.bpmn": "<definitions/>\n",
      "skills/skills.json": { $schema: "skill-topics/v1", topics: [{ id: "sdlc", path: "sdlc", title: "SDLC", description: "Delivery." }] },
      "skills/sdlc/s.md": "# s\n",
      "notes/n.md": "# n\n",
    });
    const map: Record<string, string> = { "o/cg": `file://${cg.bare}` };
    const cgUrl = (r: string) => map[r] ?? urlFor(r);
    const root = join(base, `down-${++n}`);
    mkdirSync(root, { recursive: true });
    git(root, "init", "-q", "-b", "main");
    write(root, {
      "down.json": decl("down", { mountApprovers: ["test"], remoteMounts: [{ harness: "cg", repository: "o/cg", ref: cg.sha, ...consentFor(cg.sha), overrides: { cg: { directories: ["sdlc"] } } }] }),
    });
    const r = mountRemote({ instanceRoot: root, urlFor: cgUrl, install: false });
    expect(r.plan.outcomes.find((o) => o.instance === "cg")!.state).toBe("mounted");
    expect(existsSync(join(root, "cg/processes/sdlc/a.bpmn"))).toBe(true);
    expect(existsSync(join(root, "cg/skills/sdlc/s.md"))).toBe(true);
    expect(existsSync(join(root, "cg/processes/kg"))).toBe(false);
    expect(existsSync(join(root, "cg/notes"))).toBe(false);
    expect(readLock(root).instances.find((i) => i.instance === "cg")!.directories.map((d) => d.id).sort()).toEqual(["processes/sdlc", "skills/sdlc"]);
    expect(checkRemote({ instanceRoot: root }).state).toBe("mounted");
    // A code no kind declares is refused like any unknown id.
    editDecl(root, (d) => {
      (d.remoteMounts[0]!.overrides as Record<string, { directories: string[] }>).cg = { directories: ["conduct"] };
    });
    const bad = planRemote({ instanceRoot: root, urlFor: cgUrl });
    expect(bad.outcomes.find((o) => o.instance === "cg")!.state).toBe("could-not-determine");
  });

  test("2. code arrives through mounted paths: a cross-instance relative import resolves", async () => {
    const root = downstream({});
    mountRemote({ instanceRoot: root, urlFor });
    const mod = (await import(join(root, "core/scripts/run.ts"))) as { doubled: number };
    expect(mod.doubled).toBe(84);
  });

  test("3. the overlay reads a mounted dependency like a local one", () => {
    const root = downstream({}, { needs: ["core"] });
    mountRemote({ instanceRoot: root, urlFor });
    expect(layerRootsIn(root).map((p) => p.slice(root.length))).toEqual(["", "/base", "/boot", "/core"]);
    expect(declarationChain(root).map((c) => c.name)).toEqual(["boot", "base", "core", "(root)"]);
  });

  test("4. edited mounted bytes are reported, and a re-mount leaves them untouched", () => {
    const root = downstream({});
    mountRemote({ instanceRoot: root, urlFor });
    writeFileSync(join(root, "base/schemas/util.ts"), "export const answer = 41;\n");
    const c = checkRemote({ instanceRoot: root });
    expect(c.state).toBe("missing");
    expect(c.outcomes.find((o) => o.instance === "base")!.detail).toContain("modified");
    const again = mountRemote({ instanceRoot: root, urlFor });
    expect(again.plan.outcomes.find((o) => o.instance === "base")!.detail).toContain("left untouched");
    expect(readFileSync(join(root, "base/schemas/util.ts"), "utf-8")).toContain("41");
  });

  test("4b. --fresh replaces an edited mount, and only what the lock says this mount put there", () => {
    const root = downstream({});
    mountRemote({ instanceRoot: root, urlFor });
    writeFileSync(join(root, "base/schemas/util.ts"), "export const answer = 41;\n");
    const again = mountRemote({ instanceRoot: root, urlFor, discardEdits: true });
    expect(again.plan.outcomes.find((o) => o.instance === "base")!.detail ?? "").not.toContain("left untouched");
    expect(readFileSync(join(root, "base/schemas/util.ts"), "utf-8")).not.toContain("41");
    expect(checkRemote({ instanceRoot: root }).outcomes.find((o) => o.instance === "base")!.state).not.toBe("missing");
  });

  test("5. a downstream overrides by id — path and directories — and the overlay still finds it", () => {
    const root = downstream({ overrides: { core: { path: "vendor/core", directories: ["core-docs"] } } });
    const r = mountRemote({ instanceRoot: root, urlFor });
    expect(summarise(r.plan.outcomes).state).toBe("mounted");
    expect(existsSync(join(root, "vendor/core/docs/readme.md"))).toBe(true);
    expect(existsSync(join(root, "vendor/core/scripts"))).toBe(false);
    expect(mountedInstanceRoots(root).get("core")).toBe(join(root, "vendor/core"));
  });

  test("5b. a dependency an override moved deeper is still resolved by the overlay, through the lock", () => {
    const root = downstream({ overrides: { core: { path: "vendor/core" } } }, { needs: ["core"] });
    mountRemote({ instanceRoot: root, urlFor });
    expect(declarationChain(root).map((c) => c.name)).toEqual(["boot", "base", "core", "(root)"]);
  });

  test("6. an override that names an undeclared directory is refused, not dropped", () => {
    const root = downstream({ overrides: { core: { directories: ["nope"] } } });
    const p = planRemote({ instanceRoot: root, urlFor });
    expect(p.outcomes.find((o) => o.instance === "core")).toMatchObject({ state: "could-not-determine" });
  });

  test("7. `skip` is an answer, recorded in the lock, and not a failure", () => {
    const root = downstream({ overrides: { boot: { skip: true } } });
    mountRemote({ instanceRoot: root, urlFor });
    const c = checkRemote({ instanceRoot: root });
    expect(c.state).toBe("mounted");
    expect(c.outcomes.find((o) => o.instance === "boot")!.state).toBe("skipped");
  });

  test("8. a pin the remote does not have is could-not-determine, never an empty layer", () => {
    const root = downstream({ ref: "0".repeat(40) });
    const r = mountRemote({ instanceRoot: root, urlFor });
    expect(summarise(r.plan.outcomes).state).toBe("could-not-determine");
    expect(checkRemote({ instanceRoot: root }).state).toBe("could-not-determine");
    expect(exitCode("could-not-determine")).toBe(2);
  });

  test("9. a path the mount did not put there is refused", () => {
    const root = downstream({});
    write(root, { "core/mine.txt": "local work\n" });
    const r = mountRemote({ instanceRoot: root, urlFor });
    expect(r.plan.outcomes.find((o) => o.instance === "core")).toMatchObject({ state: "missing" });
    expect(readFileSync(join(root, "core/mine.txt"), "utf-8")).toBe("local work\n");
    expect(checkRemote({ instanceRoot: root }).state).toBe("missing");
  });

  test("9b. a target that IS the pinned bytes, with no lock, is adopted; one that differs is refused and named (folio-assistant#2467)", () => {
    const root = downstream({});
    mountRemote({ instanceRoot: root, urlFor });
    rmSync(join(root, "index.lock.json"));
    const again = mountRemote({ instanceRoot: root, urlFor });
    const base = again.plan.outcomes.find((o) => o.instance === "base")!;
    expect(base.state).toBe("mounted");
    expect(base.detail).toContain("adopted");
    expect(checkRemote({ instanceRoot: root }).state).toBe("mounted");

    rmSync(join(root, "index.lock.json"));
    writeFileSync(join(root, "base/schemas/util.ts"), "export const answer = 41;\n");
    writeFileSync(join(root, "base/schemas/extra.ts"), "export {};\n");
    const refused = mountRemote({ instanceRoot: root, urlFor }).plan.outcomes.find((o) => o.instance === "base")!;
    expect(refused.state).toBe("missing");
    expect(refused.detail).toContain("differ: `base/schemas/util.ts`");
    expect(refused.detail).toContain("extra: `base/schemas/extra.ts`");
    expect(readFileSync(join(root, "base/schemas/util.ts"), "utf-8")).toContain("41");
  });

  test("10. a lock for other pins reads stale; an unreadable lock reads could-not-determine", () => {
    const root = downstream({});
    mountRemote({ instanceRoot: root, urlFor });
    const file = join(root, "down.json");
    const d = JSON.parse(readFileSync(file, "utf-8"));
    d.remoteMounts[0].ref = "1".repeat(40);
    writeFileSync(file, JSON.stringify(d));
    expect(checkRemote({ instanceRoot: root }).state).toBe("missing");
    writeFileSync(join(root, "index.lock.json"), "{ not json");
    expect(checkRemote({ instanceRoot: root }).state).toBe("could-not-determine");
  });

  test("11. no lock where mounts are declared is missing; nothing declared is not-enabled", () => {
    const root = downstream({});
    expect(checkRemote({ instanceRoot: root }).state).toBe("missing");
    const bare = join(base, "plain");
    mkdirSync(bare);
    write(bare, { "plain.json": decl("plain") });
    expect(checkRemote({ instanceRoot: bare }).state).toBe("not-enabled");
  });

  test("12. a need neither in the tree nor pinned as a gitlink is missing, and the check says so", () => {
    const root = downstream({});
    const ghost = bareRepo(base, "ghost", { "g/g.json": decl("g", { needs: ["nobody"], directories: [{ id: "g-x", path: "x/", graphTypologies: ["code"] }] }), "g/x/a.txt": "a\n" });
    const local = (r: string): string => (r === "o/ghost" ? `file://${ghost.bare}` : urlFor(r));
    write(root, { "down.json": decl("down", { remoteMounts: [{ harness: "g", repository: "o/ghost", ref: ghost.sha, ...consentFor(ghost.sha) }] }) });
    mountRemote({ instanceRoot: root, urlFor: local });
    const c = checkRemote({ instanceRoot: root });
    expect(c.state).toBe("missing");
    expect(c.outcomes.find((o) => o.instance === "nobody")!.state).toBe("missing");
  });

  test("13. the mount is kept out of commits", () => {
    const root = downstream({});
    const r = mountRemote({ instanceRoot: root, urlFor });
    expect(r.excluded).toEqual([]);
    expect(git(root, "status", "--porcelain")).not.toContain("core/");
  });

  test("14. the session-start fan-out mounts every declaring instance, then checks clean", () => {
    const root = downstream({});
    expect(remoteFanOut(root, { check: true }).state).toBe("missing");
    expect(remoteFanOut(root, { urlFor }).state).toBe("mounted");
    expect(remoteFanOut(root, { check: true }).state).toBe("mounted");
  });

  test("14b. a fan-out over mounts the lock already verifies fetches nothing (bean folio-assistant-x35i); a removed one is fetched again", () => {
    const root = downstream({});
    expect(remoteFanOut(root, { urlFor }).state).toBe("mounted");
    let asked = 0;
    const counting = (r: string): string => {
      asked++;
      return urlFor(r);
    };
    const again = remoteFanOut(root, { urlFor: counting });
    expect(again.state).toBe("mounted");
    expect(asked).toBe(0);
    expect(again.text).toContain("nothing fetched");
    // A locked directory gone from disk is stale: the full mount runs and lays it again.
    const dir = readLock(root).instances[0]!.directories[0]!.path;
    rmSync(join(root, dir), { recursive: true, force: true });
    const healed = remoteFanOut(root, { urlFor: counting });
    expect(asked).toBeGreaterThan(0);
    expect(healed.state).toBe("mounted");
    expect(existsSync(join(root, dir))).toBe(true);
  });

  test("14c. a fan-out whose only off-lock mounts are edited fetches nothing and stays missing (bean cat-tools-sm8r); an absent one is fetched", () => {
    const root = downstream({});
    expect(remoteFanOut(root, { urlFor }).state).toBe("mounted");
    let asked = 0;
    const counting = (r: string): string => {
      asked++;
      return urlFor(r);
    };
    // A step writes a file into a mounted directory: the mount is edited, not absent.
    const dir = readLock(root).instances[0]!.directories[0]!.path;
    writeFileSync(join(root, dir, "written-by-a-step.json"), "{}\n");
    expect(editedOnlyPerLock(root)).toBeDefined();
    const r = remoteFanOut(root, { urlFor: counting });
    expect(asked).toBe(0);
    expect(r.state).toBe("missing");
    expect(r.text).toContain("nothing fetched");
    expect(r.text).toContain("left untouched");
    // The edit is still there: nothing was laid over it.
    expect(existsSync(join(root, dir, "written-by-a-step.json"))).toBe(true);
    // With a second mount ABSENT as well, the fetch can help, so it runs as before.
    rmSync(join(root, dir, "written-by-a-step.json"));
    rmSync(join(root, dir), { recursive: true, force: true });
    expect(editedOnlyPerLock(root)).toBeUndefined();
    const healed = remoteFanOut(root, { urlFor: counting });
    expect(asked).toBeGreaterThan(0);
    expect(healed.state).toBe("mounted");
  });

  test("15. a declaration whose directory is NOT its name is found, and lands at livesAt.path", () => {
    // The smart-* forks: `smart-base/smart-trust.json` declares `smart-trust`.
    const odd = bareRepo(base, "odd", {
      "shared/trust.json": decl("trust", { livesAt: { repository: "o/odd", path: "trust" }, directories: [{ id: "trust-x", path: "x/", graphTypologies: ["code"] }] }),
      "shared/x/a.txt": "a\n",
    });
    const local = (r: string): string => (r === "o/odd" ? `file://${odd.bare}` : urlFor(r));
    const root = downstream({});
    write(root, { "down.json": decl("down", { mountApprovers: ["test"], remoteMounts: [{ harness: "trust", repository: "o/odd", ref: odd.sha, ...consentFor(odd.sha) }] }) });
    const r = mountRemote({ instanceRoot: root, urlFor: local });
    expect(summarise(r.plan.outcomes).state).toBe("mounted");
    expect(readFileSync(join(root, "trust/x/a.txt"), "utf-8")).toBe("a\n");
    expect(r.plan.instances[0]).toMatchObject({ upstreamRoot: "shared", path: "trust" });
  });

  test("16. declared assets arrive beside the declaration and are locked; an undeclared root file does not", () => {
    // The smart-* forks (bean hupw): `assets` names README.md and AGENTS.md,
    // and nothing declares `stray.ts`.
    const withAssets = bareRepo(base, "assets", {
      "nest/doc.json": decl("doc", {
        livesAt: { repository: "o/assets", path: "doc" },
        assets: [{ id: "readme", src: "README.md", role: "instance-readme" }, { id: "up", src: "../ROOT.md", role: "x" }],
        directories: [{ id: "doc-x", path: "x/", graphTypologies: ["code"] }],
      }),
      "nest/README.md": "# doc\n",
      "nest/stray.ts": "export {};\n",
      "nest/x/a.txt": "a\n",
      "ROOT.md": "not the instance's\n",
    });
    const local = (r: string): string => (r === "o/assets" ? `file://${withAssets.bare}` : urlFor(r));
    const root = downstream({});
    write(root, { "down.json": decl("down", { mountApprovers: ["test"], remoteMounts: [{ harness: "doc", repository: "o/assets", ref: withAssets.sha, ...consentFor(withAssets.sha) }] }) });
    const r = mountRemote({ instanceRoot: root, urlFor: local });
    expect(summarise(r.plan.outcomes).state).toBe("mounted");
    expect(readFileSync(join(root, "doc/README.md"), "utf-8")).toBe("# doc\n");
    expect(existsSync(join(root, "doc/stray.ts"))).toBe(false); // undeclared: never mounted
    expect(existsSync(join(root, "ROOT.md"))).toBe(false); // climbs out: never mounted
    const lock = MountLockSchema.parse(JSON.parse(readFileSync(r.lockFile, "utf-8")));
    expect(lock.instances[0]!.assets?.map((a) => a.src)).toEqual(["README.md"]);
    expect(checkRemote({ instanceRoot: root }).state).toBe("mounted");
    write(root, { "doc/README.md": "# edited\n" });
    const c = checkRemote({ instanceRoot: root });
    expect(c.state).toBe("missing");
    expect(c.outcomes.find((o) => o.instance === "doc")!.detail).toContain("doc/README.md modified");
  });
});

describe("mount trust (H8, bean `ieum`)", () => {
  test("16. unsigned and unconsented is refused, and nothing is written", () => {
    const root = downstream({ trust: undefined });
    const r = mountRemote({ instanceRoot: root, urlFor });
    expect(r.plan.outcomes.every((o) => o.state === "refused")).toBe(true);
    expect(r.plan.outcomes[0]!.detail).toContain("unsigned and unconsented");
    expect(existsSync(join(root, "core"))).toBe(false);
  });

  test("17. a staging mount needs neither signature nor consent", () => {
    const root = downstream({ trust: undefined });
    const r = mountRemote({ instanceRoot: root, urlFor, purpose: "staging" });
    expect(summarise(r.plan.outcomes).state).toBe("mounted");
  });

  test("18. consent for another pin is refused: a moved pin asks again", () => {
    const root = downstream(consentFor("2".repeat(40)));
    const r = mountRemote({ instanceRoot: root, urlFor });
    expect(r.plan.outcomes[0]!.detail).toContain("a moved pin asks again");
  });
});

describe("whole-instance mounts and replaying the lock (bean `nn8e`, #2462)", () => {
  test("19. `whole` mounts every tracked file at the instance root, locked as one `*` directory", () => {
    const root = downstream({ overrides: { boot: { whole: true } } });
    const r = mountRemote({ instanceRoot: root, urlFor });
    expect(Object.fromEntries(r.plan.outcomes.map((o) => [o.instance, o.state])).boot).toBe("mounted");
    // the root files a declared-directories mount leaves behind
    expect(readFileSync(join(root, "boot/ns.jsonld"), "utf-8")).toContain("@context");
    expect(existsSync(join(root, "boot/README.md"))).toBe(true);
    expect(existsSync(join(root, "boot/schemas/floor.ts"))).toBe(true);
    // never the fetch's own repository
    expect(existsSync(join(root, "boot/.git"))).toBe(false);
    const lock = MountLockSchema.parse(JSON.parse(readFileSync(join(root, "index.lock.json"), "utf-8")));
    expect(lock.instances.find((i) => i.instance === "boot")!.directories).toMatchObject([{ id: "*", path: "boot", upstreamPath: "." }]);
    expect(checkRemote({ instanceRoot: root }).state).toBe("mounted");
  });

  test("19b. a re-mount keeps a STATE mount inside the instance — never re-lays over it", () => {
    // folio-assistant#2529: each layer's `health` is state-mounted inside
    // the layer, and a re-mount that removed the layer's directories
    // removed it too — unpushed edits and all — leaving its marker describing
    // files that were gone. The marker is the state store's record of what it
    // put down; that directory is set aside and put back.
    const root = downstream({ overrides: { boot: { whole: true } } });
    mountRemote({ instanceRoot: root, urlFor });
    const into = join(root, "boot/test/health/results");
    mkdirSync(into, { recursive: true });
    writeFileSync(join(into, "report.json"), '{"edited":true}\n');
    mkdirSync(join(root, ".git/branch-mounts"), { recursive: true });
    writeFileSync(
      join(root, ".git/branch-mounts/boot.health.json"),
      JSON.stringify({ $schema: "branch-mount/v1", id: "health", key: "boot.health", path: "boot/test/health/results", into, files: {} }),
    );
    expect(checkRemote({ instanceRoot: root }).state).toBe("mounted");
    const again = mountRemote({ instanceRoot: root, urlFor });
    expect(Object.fromEntries(again.plan.outcomes.map((o) => [o.instance, o.state])).boot).toBe("mounted");
    expect(readFileSync(join(into, "report.json"), "utf-8")).toBe('{"edited":true}\n');
    expect(existsSync(join(root, "boot/schemas/floor.ts"))).toBe(true);
    // The lock hashed only what the mount laid down, so the check stays clean.
    expect(checkRemote({ instanceRoot: root }).state).toBe("mounted");
  });

  test("19c. a re-mount keeps the instance's node_modules — an install artefact is never the mount's to delete", () => {
    // folio-assistant#2529: `state:mount` re-lays the mounts, and the re-lay
    // removed each layer's directory whole — its `node_modules/` with it.
    // A workspace member's dependencies come from the root's `bun install`,
    // which the mount does not repeat, so folio-assistant-sci lost its pinned
    // katex 0.18 and resolved the root's 0.16.
    const root = downstream({ overrides: { boot: { whole: true } } });
    mountRemote({ instanceRoot: root, urlFor });
    const pkg = join(root, "boot/node_modules/katex");
    mkdirSync(pkg, { recursive: true });
    writeFileSync(join(pkg, "package.json"), '{"name":"katex","version":"0.18.10"}\n');
    const again = mountRemote({ instanceRoot: root, urlFor });
    expect(Object.fromEntries(again.plan.outcomes.map((o) => [o.instance, o.state])).boot).toBe("mounted");
    expect(readFileSync(join(pkg, "package.json"), "utf-8")).toContain("0.18.10");
    expect(existsSync(join(root, "boot/schemas/floor.ts"))).toBe(true);
    // node_modules/ is outside the digest, so the check stays clean with it there.
    expect(checkRemote({ instanceRoot: root }).state).toBe("mounted");
  });

  // From EITHER name (owner, 2026-10-07): `index.lock.json`, and the legacy
  // `<name>.mount-lock.json` a downstream folio or an old branch still carries.
  test.each(["index.lock.json", "down.mount-lock.json"])("20. a committed lock (%s) replays on a fresh clone with no declaration reader, and verifies digests", (lockName) => {
    const src = downstream({ overrides: { boot: { whole: true } } });
    mountRemote({ instanceRoot: src, urlFor });
    // A fresh checkout holding only the lock: what CI and session start see.
    const fresh = join(base, `fresh-${++n}`);
    mkdirSync(fresh, { recursive: true });
    git(fresh, "init", "-q", "-b", "main");
    writeFileSync(join(fresh, lockName), readFileSync(join(src, "index.lock.json")));
    writeFileSync(join(fresh, "down.json"), readFileSync(join(src, "down.json")));
    // serve o/<name> under one prefix, as github.com would
    const srv = join(base, `srv-${n}`, "o");
    mkdirSync(srv, { recursive: true });
    spawnSync("ln", ["-s", up.bare, join(srv, "up")]);
    spawnSync("ln", ["-s", boot.bare, join(srv, "boot")]);
    // input-site: inert #865c95f3 — saves the environment to restore it after the test, or strips names before handing it to a child; no assertion reads the values
    const prev = process.env.CAT_MOUNT_URL_PREFIX;
    process.env.CAT_MOUNT_URL_PREFIX = `file://${dirname(srv)}`;
    try {
      const first = replayLocks(fresh, false);
      expect(Object.fromEntries(first.outcomes.map((o) => [o.instance, o.state]))).toEqual({ base: "mounted", boot: "mounted", core: "mounted" });
      expect(readFileSync(join(fresh, "boot/ns.jsonld"), "utf-8")).toContain("@context");
      expect(existsSync(join(fresh, "core/scripts/run.ts"))).toBe(true);
      // idempotent, and the offline check agrees
      expect(replayLocks(fresh, false).outcomes.every((o) => o.state === "current")).toBe(true);
      expect(replayLocks(fresh, true).outcomes.every((o) => o.state === "current")).toBe(true);
      // the mounter that writes locks reads the replayed tree as its own
      expect(checkRemote({ instanceRoot: fresh }).state).toBe("mounted");
      // a repo-wide scan sees mounted files as it saw a submodule's: ignored by git, still corpus
      const corpus = gitCorpus(fresh)!.map((f) => f.slice(fresh.length + 1));
      expect(corpus).toContain("boot/ns.jsonld");
      expect(corpus).toContain("core/scripts/run.ts");
      expect(corpus).toContain("core/core.json");
      expect(corpus.filter((f) => f === "boot/boot.json")).toHaveLength(1);
      expect(gitCorpus(fresh, ["*.jsonld"])!.map((f) => f.slice(fresh.length + 1))).toEqual(["boot/ns.jsonld"]);
      // an edit is reported, and a replay leaves it untouched
      writeFileSync(join(fresh, "boot/README.md"), "edited\n");
      const again = replayLocks(fresh, false).outcomes.find((o) => o.instance === "boot")!;
      expect(again.state).toBe("missing");
      expect(readFileSync(join(fresh, "boot/README.md"), "utf-8")).toBe("edited\n");
    } finally {
      if (prev === undefined) delete process.env.CAT_MOUNT_URL_PREFIX;
      else process.env.CAT_MOUNT_URL_PREFIX = prev;
    }
  });

  test("21. a lock whose digest the fetched bytes do not match is could-not-determine, and nothing is kept", () => {
    const src = downstream({ overrides: { boot: { whole: true } } });
    mountRemote({ instanceRoot: src, urlFor });
    const fresh = join(base, `fresh-${++n}`);
    mkdirSync(fresh, { recursive: true });
    git(fresh, "init", "-q", "-b", "main");
    const lock = JSON.parse(readFileSync(join(src, "index.lock.json"), "utf-8"));
    lock.instances = lock.instances.filter((i: { instance: string }) => i.instance === "boot");
    lock.instances[0].repository = `file://${boot.bare}`;
    lock.instances[0].directories[0].treeDigest = "0".repeat(64);
    writeFileSync(join(fresh, "index.lock.json"), JSON.stringify(lock));
    const r = replayLocks(fresh, false);
    expect(r.outcomes[0]!.state).toBe("could-not-determine");
    expect(existsSync(join(fresh, "boot"))).toBe(false);
  });
});

describe("a whole mount leaves out the opt-in sub-graphs the downstream has not switched on (Q-SG-1)", () => {
  test("W1. the paths: top-level and from-within, outermost only, enabled ones kept", () => {
    const top = [
      { id: "skills", path: "skills/" },
      { id: "sdlc", path: "sdlc/", optIn: true },
      { id: "library-graph", path: "library/" },
    ];
    const nested = [
      { id: "library-corpus", path: "library/corpus/", optIn: true },
      { id: "sdlc-skills", path: "sdlc/skills/", optIn: true },
      { id: "climbs", path: "../x/", optIn: true },
    ];
    expect(switchedOffOptInPaths("ch", top, nested, new Set())).toEqual(["library/corpus", "sdlc"]);
    expect(switchedOffOptInPaths("ch", top, nested, new Set(["ch.sdlc"]))).toEqual(["library/corpus", "sdlc/skills"]);
    expect(switchedOffOptInPaths("ch", top, nested, new Set(["ch.sdlc", "ch.sdlc-skills", "ch.library-corpus"]))).toEqual([]);
    expect(switchedOffOptInPaths("ch", top, nested, "all")).toEqual([]);
  });

  test("W2. mounted, locked with `except`, checked clean, and replayed without them; enabling brings them back", () => {
    const opt = bareRepo(base, "opt", {
      "opt.json": decl("opt", {
        directories: [
          { id: "opt-schemas", path: "schemas/", graphTypologies: ["code"] },
          { id: "extra", path: "extra/", optIn: true, graphTypologies: ["code"] },
        ],
      }),
      "package.json": '{"name":"opt"}\n',
      "schemas/a.ts": "export const a = 1;\n",
      "extra/big.txt": "big\n",
    });
    const local = (r: string): string => (r === "o/opt" ? `file://${opt.bare}` : urlFor(r));
    const root = join(base, `down-${++n}`);
    mkdirSync(root, { recursive: true });
    git(root, "init", "-q", "-b", "main");
    write(root, { "down.json": decl("down", { mountApprovers: ["test"], remoteMounts: [{ harness: "opt", repository: "o/opt", ref: opt.sha, ...consentFor(opt.sha), overrides: { opt: { whole: true } } }] }) });
    const r = mountRemote({ instanceRoot: root, urlFor: local });
    expect(summarise(r.plan.outcomes).state).toBe("mounted");
    expect(existsSync(join(root, "opt/package.json"))).toBe(true);
    expect(existsSync(join(root, "opt/schemas/a.ts"))).toBe(true);
    expect(existsSync(join(root, "opt/extra"))).toBe(false);
    const lock = MountLockSchema.parse(JSON.parse(readFileSync(join(root, "index.lock.json"), "utf-8")));
    expect(lock.instances.find((i) => i.instance === "opt")!.directories).toMatchObject([{ id: "*", path: "opt", upstreamPath: ".", except: ["extra"] }]);
    expect(checkRemote({ instanceRoot: root }).state).toBe("mounted");

    // A fresh clone replays the lock and leaves the same paths out.
    const fresh = join(base, `fresh-${++n}`);
    mkdirSync(fresh, { recursive: true });
    git(fresh, "init", "-q", "-b", "main");
    const replayLock = JSON.parse(readFileSync(join(root, "index.lock.json"), "utf-8"));
    for (const i of replayLock.instances) i.repository = `file://${opt.bare}`;
    writeFileSync(join(fresh, "index.lock.json"), JSON.stringify(replayLock));
    const first = replayLocks(fresh, false);
    expect(first.outcomes.map((o) => o.state)).toEqual(["mounted"]);
    expect(existsSync(join(fresh, "opt/schemas/a.ts"))).toBe(true);
    expect(existsSync(join(fresh, "opt/extra"))).toBe(false);
    expect(replayLocks(fresh, true).outcomes.every((o) => o.state === "current")).toBe(true);

    // The downstream switches it on: the next mount brings it.
    write(root, { "down.json": decl("down", { enableSubgraphs: ["opt.extra"], mountApprovers: ["test"], remoteMounts: [{ harness: "opt", repository: "o/opt", ref: opt.sha, ...consentFor(opt.sha), overrides: { opt: { whole: true } } }] }) });
    const again = mountRemote({ instanceRoot: root, urlFor: local });
    expect(summarise(again.plan.outcomes).state).toBe("mounted");
    expect(readFileSync(join(root, "opt/extra/big.txt"), "utf-8")).toBe("big\n");
    const lock2 = MountLockSchema.parse(JSON.parse(readFileSync(join(root, "index.lock.json"), "utf-8")));
    expect(lock2.instances.find((i) => i.instance === "opt")!.directories[0]!.except).toBeUndefined();
  });

  test("W3. a changed `enableSubgraphs` is not current per the lock, so a plain mount lays the group down (no `--fresh`)", () => {
    const opt = bareRepo(base, "opt-w3", {
      "opt.json": decl("opt", {
        directories: [
          { id: "opt-schemas", path: "schemas/", graphTypologies: ["code"] },
          { id: "extra", path: "extra/", optIn: true, graphTypologies: ["code"] },
        ],
      }),
      "package.json": '{"name":"opt"}\n',
      "schemas/a.ts": "export const a = 1;\n",
      "extra/big.txt": "big\n",
    });
    const local = (r: string): string => (r === "o/opt" ? `file://${opt.bare}` : urlFor(r));
    const root = join(base, `down-${++n}`);
    mkdirSync(root, { recursive: true });
    git(root, "init", "-q", "-b", "main");
    const down = (enable?: string[]) =>
      write(root, { "down.json": decl("down", { ...(enable ? { enableSubgraphs: enable } : {}), mountApprovers: ["test"], remoteMounts: [{ harness: "opt", repository: "o/opt", ref: opt.sha, ...consentFor(opt.sha), overrides: { opt: { whole: true } } }] }) });
    down();
    expect(summarise(mountRemote({ instanceRoot: root, urlFor: local }).plan.outcomes).state).toBe("mounted");
    // Unchanged: the fast path holds.
    expect(optInDriftFromLock(root)).toEqual([]);
    expect(currentPerLock(root)?.state).toBe("mounted");

    // Switched on: the bytes still hash to the lock, but the lock left the group out.
    down(["opt.extra"]);
    expect(checkRemote({ instanceRoot: root }).state).toBe("mounted");
    expect(optInDriftFromLock(root)).toEqual([expect.stringContaining("opt: extra is now switched on")]);
    expect(currentPerLock(root)).toBeUndefined();
    expect(editedOnlyPerLock(root)).toBeUndefined();
    mountRemote({ instanceRoot: root, urlFor: local });
    expect(readFileSync(join(root, "opt/extra/big.txt"), "utf-8")).toBe("big\n");
    expect(optInDriftFromLock(root)).toEqual([]);
    expect(currentPerLock(root)?.state).toBe("mounted");

    // Switched off again: the same, the other way.
    down();
    expect(optInDriftFromLock(root)).toEqual([expect.stringContaining("opt: extra is now switched off")]);
    expect(currentPerLock(root)).toBeUndefined();
  });
});

describe("mount trust is recorded, re-judged and scoped (roast `1ygp` L4.2)", () => {
  test("22. the lock records the basis: consent with who, when and approver; staging when --staging", () => {
    const root = downstream({});
    mountRemote({ instanceRoot: root, urlFor });
    const core = readLock(root).instances.find((i) => i.instance === "core")!;
    expect(core.trust).toEqual({ basis: "consent", by: "test", on: "2026-10-07", ref: up.sha, approver: "declared" });
    expect(readLock(root).instances.find((i) => i.instance === "boot")!.trust).toMatchObject({ basis: "consent", ref: boot.sha });

    const staged = downstream({ trust: undefined });
    mountRemote({ instanceRoot: staged, urlFor, purpose: "staging" });
    expect(readLock(staged).instances.every((i) => i.trust?.basis === "staging")).toBe(true);
    const c = checkRemote({ instanceRoot: staged });
    expect(c.state).toBe("mounted");
    expect(c.outcomes.find((o) => o.instance === "core")!.detail).toContain("staging");
  });

  test("23. a gitlinked instance needs consent of its own: the parent's consent does not cover it", () => {
    const root = downstream({}, {}, true);
    const r = mountRemote({ instanceRoot: root, urlFor });
    const by = Object.fromEntries(r.plan.outcomes.map((o) => [o.instance, o.state]));
    expect(by).toEqual({ core: "mounted", base: "mounted", boot: "refused" });
    expect(r.plan.outcomes.find((o) => o.instance === "boot")!.detail).toContain("gitlink");
    expect(existsSync(join(root, "boot"))).toBe(false);
    expect(checkRemote({ instanceRoot: root }).state).toBe("missing");
  });

  test("24. the check re-runs the trust check: consent withdrawn after the mount is reported, not inherited", () => {
    const root = downstream({});
    mountRemote({ instanceRoot: root, urlFor });
    expect(checkRemote({ instanceRoot: root }).state).toBe("mounted");
    editDecl(root, (d) => delete d.remoteMounts[0]!.trust);
    const c = checkRemote({ instanceRoot: root });
    expect(c.state).toBe("missing");
    expect(c.outcomes.find((o) => o.instance === "core")).toMatchObject({ state: "refused" });
    expect(c.outcomes.find((o) => o.instance === "core")!.detail).toContain("no longer holds");
    expect(exitCode(c.state)).toBe(1);
  });

  test("25. a refused re-mount leaves the old bytes on disk and the lock as it was, but NOT presented as mounted; restored consent re-mounts", () => {
    const root = downstream({});
    mountRemote({ instanceRoot: root, urlFor });
    const lockBefore = readFileSync(join(root, "index.lock.json"), "utf-8");
    editDecl(root, (d) => {
      (d.remoteMounts[0]!.trust as { consent: { ref: string } }).consent.ref = "3".repeat(40);
    });
    const r = mountRemote({ instanceRoot: root, urlFor });
    expect(r.plan.outcomes.find((o) => o.instance === "core")).toMatchObject({ state: "refused" });
    expect(summarise(r.plan.outcomes).state).toBe("missing");
    // never deleted by the agent...
    expect(existsSync(join(root, "core/scripts/run.ts"))).toBe(true);
    // ...the lock is not rewritten without it (a downstream layer, 2026-11-18)...
    expect(readFileSync(join(root, "index.lock.json"), "utf-8")).toBe(lockBefore);
    // ...and never presented as current: the check re-judges the basis
    const c = checkRemote({ instanceRoot: root });
    expect(c.state).toBe("missing");
    expect(c.outcomes.find((o) => o.instance === "core")).toMatchObject({ state: "refused" });
    expect(c.outcomes.find((o) => o.instance === "core")!.detail).toContain("no longer holds");
    // consent restored: the left-on-disk record says this mount put it there
    editDecl(root, (d) => {
      (d.remoteMounts[0]!.trust as { consent: { ref: string } }).consent.ref = up.sha;
    });
    const again = mountRemote({ instanceRoot: root, urlFor });
    expect(again.plan.outcomes.find((o) => o.instance === "core")).toMatchObject({ state: "mounted" });
    expect(checkRemote({ instanceRoot: root }).state).toBe("mounted");
  });

  // A downstream layer, 2026-11-18: mount:remote rewrote index.lock.json without the
  // instances it refused to re-mount, so the lock CI replays was partial.
  test("25b. a refusal of one locked instance writes nothing: the lock keeps every entry, and no other layer is re-laid", () => {
    const root = downstream({});
    mountRemote({ instanceRoot: root, urlFor });
    const file = join(root, "index.lock.json");
    const lockBefore = readFileSync(file, "utf-8");
    // consent for the gitlinked `boot` withdrawn; core and base still consented
    editDecl(root, (d) => {
      const o = d.remoteMounts[0]!.overrides as Record<string, { trust: { consent: { ref: string } } }>;
      o.boot!.trust.consent.ref = "3".repeat(40);
    });
    writeFileSync(join(root, "base/schemas/marker.txt"), "not re-laid\n");
    const r = mountRemote({ instanceRoot: root, urlFor });
    const by = Object.fromEntries(r.plan.outcomes.map((o) => [o.instance, o.state]));
    expect(by).toEqual({ core: "missing", base: "missing", boot: "refused" });
    expect(r.plan.outcomes.find((o) => o.instance === "core")!.detail).toContain("nothing was written");
    expect(readFileSync(file, "utf-8")).toBe(lockBefore);
    expect(readLock(root).instances.map((i) => i.instance).sort()).toEqual(["base", "boot", "core"]);
    // base was not replaced: the bytes it would have removed are still there
    expect(existsSync(join(root, "base/schemas/marker.txt"))).toBe(true);
    expect(existsSync(join(root, "boot/schemas/floor.ts"))).toBe(true);
  });

  test("25c. a locked instance the plan cannot reach (a fetch fails) writes nothing either", () => {
    const root = downstream({});
    mountRemote({ instanceRoot: root, urlFor });
    const file = join(root, "index.lock.json");
    const lockBefore = readFileSync(file, "utf-8");
    const noBoot = (repo: string) => {
      if (repo === "o/boot") throw new Error("unreachable");
      return urlFor(repo);
    };
    const r = mountRemote({ instanceRoot: root, urlFor: noBoot });
    expect(r.plan.outcomes.find((o) => o.instance === "boot")).toMatchObject({ state: "could-not-determine" });
    expect(r.plan.outcomes.find((o) => o.instance === "boot")!.detail).toContain("nothing was written");
    expect(readFileSync(file, "utf-8")).toBe(lockBefore);
    expect(checkRemote({ instanceRoot: root }).state).toBe("mounted");
  });

  test("26. approvers: none declared is UNVERIFIED (its own state, never clean); one not on the list is refused", () => {
    const root = downstream({}, { mountApprovers: undefined });
    const r = mountRemote({ instanceRoot: root, urlFor });
    expect(summarise(r.plan.outcomes).state).toBe("unverified-approver");
    expect(readLock(root).instances.find((i) => i.instance === "core")!.trust).toMatchObject({ approver: "unverified" });
    const c = checkRemote({ instanceRoot: root });
    expect(c.state).toBe("unverified-approver");
    expect(exitCode(c.state)).toBe(0);

    const other = downstream({}, { mountApprovers: ["someone-else"] });
    const o = mountRemote({ instanceRoot: other, urlFor });
    expect(o.plan.outcomes.find((x) => x.instance === "core")).toMatchObject({ state: "refused" });
    expect(o.plan.outcomes.find((x) => x.instance === "core")!.detail).toContain("mountApprovers");
  });
});

describe("index.config.json as the mount declaration (owner, 2026-10-07)", () => {
  /** A downstream whose mounts live in `index.config.json`, its declaration carrying none. */
  function indexed(mount: object = {}): string {
    const root = join(base, `idx-${++n}`);
    mkdirSync(root, { recursive: true });
    git(root, "init", "-q", "-b", "main");
    write(root, {
      "down.json": decl("down", { mountApprovers: ["test"] }),
      "index.config.json": {
        $schema: INDEX_CONFIG_SCHEMA,
        instances: [
          { name: "down", source: { local: { at: "." } } },
          // `boot` arrives through a gitlink, so it needs consent of its own (`1ygp` L4.2)
          { name: "core", source: { remote: { repository: "o/up", ref: up.sha, ...consentFor(up.sha), overrides: { boot: consentFor(boot.sha) }, ...mount } } },
        ],
      },
    });
    return root;
  }
  const exclude = (root: string): string => {
    const f = join(root, ".git", "info", "exclude");
    return existsSync(f) ? readFileSync(f, "utf-8") : "";
  };

  test("27. mounts declared only in the index are mounted, locked as index.lock.json, and ignored by the COMMITTED block — never info/exclude", () => {
    const root = indexed();
    const before = exclude(root);
    const r = mountRemote({ instanceRoot: root, urlFor });
    expect(Object.fromEntries(r.plan.outcomes.map((o) => [o.instance, o.state]))).toEqual({ core: "mounted", base: "mounted", boot: "mounted" });
    expect(r.lockFile).toBe(join(root, "index.lock.json"));
    expect(existsSync(join(root, "down.mount-lock.json"))).toBe(false);
    expect(r.excluded).toEqual([]);
    expect(exclude(root)).toBe(before);
    // the index names `core`; the closure brought `base` and `boot`, and the lock says where
    expect(readFileSync(join(root, ".gitignore"), "utf-8")).toBe(`${IGNORE_BLOCK_BEGIN}\n/core/\n/base/\n/boot/\n${IGNORE_BLOCK_END}\n`);
    expect(checkRemote({ instanceRoot: root }).state).toBe("mounted");
  });

  test("27b. a need the index mounts by its OWN entry is that entry's — no `skip` needed, none recorded", () => {
    const root = indexed();
    const cfg = JSON.parse(readFileSync(join(root, "index.config.json"), "utf-8"));
    cfg.instances.push({ name: "base", source: { remote: { repository: "o/up", ref: up.sha, ...consentFor(up.sha), overrides: { boot: consentFor(boot.sha) } } } });
    writeFileSync(join(root, "index.config.json"), JSON.stringify(cfg, null, 2));
    const r = mountRemote({ instanceRoot: root, urlFor });
    expect(r.plan.outcomes.filter((o) => o.state === "skipped")).toEqual([]);
    const lock = readLock(root);
    expect(lock.instances.find((i) => i.instance === "base")).toMatchObject({ via: "base", pinnedBy: "declared" });
    expect(lock.unmounted).toEqual([]);
  });

  test("28. without an index: remoteMounts on the declaration, and the SAME committed block from the lock — never info/exclude (owner, 2026-10-09)", () => {
    const root = downstream({});
    expect(readDeclaredMounts(root).from).toBe("declaration");
    const before = exclude(root);
    const r = mountRemote({ instanceRoot: root, urlFor });
    expect(r.excluded).toEqual([]);
    expect(exclude(root)).toBe(before);
    expect(readFileSync(join(root, ".gitignore"), "utf-8")).toBe(`${IGNORE_BLOCK_BEGIN}\n/base/\n/boot/\n/core/\n${IGNORE_BLOCK_END}\n`);
    expect(Object.values(Object.fromEntries(r.plan.outcomes.map((o) => [o.instance, o.state])))).not.toContain("missing");
  });

  test("29. mounts in BOTH the index and the declaration: the check is could-not-determine and names both, the mount throws", () => {
    const root = indexed();
    write(root, { "down.json": decl("down", { remoteMounts: [{ harness: "core", repository: "o/up", ref: up.sha, ...consentFor(up.sha) }] }) });
    const c = checkRemote({ instanceRoot: root });
    expect(c.state).toBe("could-not-determine");
    expect(c.reason).toContain("index.config.json");
    expect(c.reason).toContain("down.json");
    expect(() => mountRemote({ instanceRoot: root, urlFor })).toThrow(/BOTH/);
  });

  test("29b. approvers in the index count when the declaration has none; on both, the mount throws (folio-assistant#2389)", () => {
    const withIndexApprovers = (who: string[]): string => {
      const root = indexed();
      write(root, { "down.json": decl("down", { mountApprovers: undefined }) });
      const cfg = JSON.parse(readFileSync(join(root, "index.config.json"), "utf-8"));
      cfg.mountApprovers = who;
      writeFileSync(join(root, "index.config.json"), JSON.stringify(cfg, null, 2));
      return root;
    };
    const ok = withIndexApprovers(["test"]);
    const r = mountRemote({ instanceRoot: ok, urlFor });
    expect(r.plan.outcomes.find((o) => o.instance === "core")).toMatchObject({ state: "mounted" });
    expect(readLock(ok).instances.find((i) => i.instance === "core")!.trust).toMatchObject({ approver: "declared" });
    expect(checkRemote({ instanceRoot: ok }).state).toBe("mounted");

    const other = withIndexApprovers(["someone-else"]);
    expect(mountRemote({ instanceRoot: other, urlFor }).plan.outcomes.find((o) => o.instance === "core")).toMatchObject({ state: "refused" });

    const both = withIndexApprovers(["test"]);
    write(both, { "down.json": decl("down", { mountApprovers: ["test"] }) });
    expect(() => mountRemote({ instanceRoot: both, urlFor })).toThrow(/mountApprovers in both/);
  });

  test("30. a legacy lock is RENAMED onto index.lock.json when the mount rewrites it, never left beside it", () => {
    const root = indexed();
    mountRemote({ instanceRoot: root, urlFor });
    // an old branch's state: the lock under the legacy name only
    writeFileSync(join(root, "down.mount-lock.json"), readFileSync(join(root, "index.lock.json")));
    rmSync(join(root, "index.lock.json"));
    expect(checkRemote({ instanceRoot: root }).state).toBe("mounted");
    mountRemote({ instanceRoot: root, urlFor });
    expect(existsSync(join(root, "index.lock.json"))).toBe(true);
    expect(existsSync(join(root, "down.mount-lock.json"))).toBe(false);
    // both at once is refused by every reader
    writeFileSync(join(root, "down.mount-lock.json"), readFileSync(join(root, "index.lock.json")));
    expect(checkRemote({ instanceRoot: root }).state).toBe("could-not-determine");
    expect(mountedInstanceRoots(root).size).toBe(0);
  });
});

describe("a changed lock re-renders the agent surface", () => {
  // The generators run by path, so a rename would turn the step into a
  // spawn of a missing file — a failure at re-pin time rather than here.
  test("every agent-surface generator exists beside remote-mount.ts", () => {
    for (const g of AGENT_SURFACE_GENERATORS) expect(existsSync(join(import.meta.dir, "..", g)), g).toBe(true);
  });

  test("mount:remote + regenerateAgentSurface writes nothing under a mounted instance and reports stale committed surfaces naming the layer (bean bx4c)", () => {
    const staleCmd = [
      "---",
      'description: "outdated description"',
      'argument-hint: "[what to run it on]"',
      "generated: cat-harness-tools/scripts/gen-skill-commands.ts",
      "---",
      "",
      "# /hello",
      "",
      "stale command body",
      "",
    ].join("\n");
    const staleMem = [
      "# watcher — memory",
      "",
      "<!-- folio:memory:begin -->",
      "## STABLE — outdated lesson",
      "old lesson body",
      "<!-- folio:memory:end -->",
      "",
    ].join("\n");
    const surf = bareRepo(base, "surf", {
      "surf.json": decl("surf", {
        mountDefaults: { whole: true },
        directories: [
          { id: "skills", path: "skills/", graphTypologies: ["skills"] },
          { id: "memory", path: "memory/", graphTypologies: ["memory"] },
        ],
      }),
      // declared-path-literal: fixture keys of the bare repository this test builds under its temp base
      "skills/pkg/hello.md": "---\nname: hello\ndescription: The hello skill.\nuser_invocable: true\n---\n\n# hello\n",
      "memory/lesson.md": [
        "---",
        "$schema: folio-memory/v1",
        "id: lesson",
        "label: stable",
        'summary: "fresh mounted lesson"',
        "createdAt: 2026-11-05",
        "references:",
        "  agents:",
        "    - watcher",
        "---",
        "fresh mounted lesson body",
        "",
      ].join("\n"),
      ".claude/commands/hello.md": staleCmd,
      ".claude/agents/watcher.md": "---\nname: watcher\ndescription: Watches.\n---\n\nWatcher prompt.\n",
      ".claude/agent-memory/watcher/MEMORY.md": staleMem,
    });
    const surfUrl = (r: string) => (r === "o/surf" ? `file://${surf.bare}` : urlFor(r));
    const root = join(base, `surf-index-${++n}`);
    mkdirSync(root, { recursive: true });
    git(root, "init", "-q", "-b", "main");
    write(root, {
      "index.config.json": {
        $schema: INDEX_CONFIG_SCHEMA,
        mountApprovers: ["test"],
        instances: [
          {
            name: "surf",
            source: {
              remote: {
                repository: "o/surf",
                ref: surf.sha,
                ...consentFor(surf.sha),
                overrides: { surf: { whole: true } },
              },
            },
          },
        ],
      },
    });

    const m = mountRemote({ instanceRoot: root, urlFor: surfUrl, install: false });
    expect(m.plan.outcomes.find((o) => o.instance === "surf")!.state).toBe("mounted");
    expect(checkRemote({ instanceRoot: root }).state).toBe("mounted");

    const surface = regenerateAgentSurface(root);
    // 1. The index's own surface is rendered at the index root.
    expect(existsSync(join(root, ".claude/commands/hello.md"))).toBe(true);
    expect(existsSync(join(root, ".agents/rules/agent-memory.md"))).toBe(true);
    expect(readFileSync(join(root, ".agents/rules/agent-memory.md"), "utf-8")).toContain("fresh mounted lesson");
    // 2. Nothing under the mounted layer's directory was written: lock digests still match.
    expect(readFileSync(join(root, "surf/.claude/commands/hello.md"), "utf-8")).toBe(staleCmd);
    expect(readFileSync(join(root, "surf/.claude/agent-memory/watcher/MEMORY.md"), "utf-8")).toBe(staleMem);
    expect(checkRemote({ instanceRoot: root }).state).toBe("mounted");
    expect(replayLocks(root, true).outcomes.map((o) => o.state)).toEqual(["current"]);
    // 3. The stale committed surface in the mounted layer is reported, naming the layer `surf`.
    expect(surface.ok).toBe(false);
    expect(surface.lines.every((l) => l.includes("surf") && l.includes("not rewritten"))).toBe(true);
  });
});

describe("hydrated mounts: metadata at the pin, no files (bean `mo75` G2)", () => {
  // Each test here builds bare repositories and replays mounts through `git`
  // subprocesses over local file:// fixtures. The 30 s budget dates from
  // 2026-11-05 (folio-assistant#2949, #2950; cat-harness-tools#1487), when the
  // timeouts were read as load. They were not: a directory whose
  // index.hydrated.jsonld the tree does not hold falls back to the pin's
  // subgraph index PACKAGE (G2b), and with no `packageUrlFor` that fetch
  // curled the real https://github.com/o/<repo>/releases/... — a 404 in
  // ~1 s on a quiet runner, a hang until bun killed curl on a busy one, so a
  // different subset failed each run as `could-not-determine`
  // (cat-harness-tools#1487, #1488). `beforeAll` below points every package
  // fetch at a file:// path that holds nothing, so the answer is "absent"
  // and no test here reaches the network.
  const HYDRATED_TIMEOUT_MS = 30_000;
  // o/hy holds two layers. `hh` publishes ONE hydrated file, for `tools`
  // (and a child's, which must not travel); its `skills` and `docs` publish
  // none, and its code must not arrive. `hb` publishes a file under the
  // wrong IRI. o/np builds its subgraph files at publish, so no pin of it
  // carries one — the state of every litlfred harness on 2026-10-24.
  const BASE = "https://example.org";
  const hydratedFile = (harness: string, sub: string, iriSub = sub) => ({
    "@context": `${BASE}/ns/subgraph/v1.jsonld`,
    "@id": `${BASE}/subgraph/${harness}/${iriSub}/`,
    "@type": "Subgraph",
    name: sub,
    path: `${sub}/`,
    hasMember: [{ "@id": `${BASE}/tool/a`, "@type": "Tool", description: "Tool a" }],
  });
  const dirs = [
    { id: "tools", path: "tools/", graphTypologies: ["tools"] },
    { id: "skills", path: "skills/", graphTypologies: ["skills"] },
    { id: "docs", path: "docs/", graphTypologies: ["docs"] },
    { id: "state", path: "state/", graphTypologies: ["code"], source: { kind: "branch", branch: "cat/hh/state", keyedBy: "tip" } },
  ];
  const builtAtPublish = [{ path: "docs/subgraph/", writer: ["subgraph:jsonld"], because: "checkout", reason: "generated" }];
  let hy: { bare: string; sha: string };
  let np: { bare: string; sha: string };
  let hUrl: (r: string) => string;

  let prevPrefix: string | undefined;
  beforeAll(() => {
    // No package is published for these fixtures: every release-asset URL is
    // fetched from an empty file:// mirror (curl exit 37, read as absent),
    // never from github.com. H6 and H10 set their own mirror and restore this one.
    // input-site: inert #04b6f973 — saves the environment to restore it after the suite; no assertion reads the value
    prevPrefix = process.env.CAT_MOUNT_URL_PREFIX;
    process.env.CAT_MOUNT_URL_PREFIX = `file://${join(base, "no-packages-published")}`;
    hy = bareRepo(base, "hy", {
      "hh/hh.json": decl("hh", { livesAt: { repository: "o/hy", path: "hh" }, directories: dirs }),
      "hh/tools/a/a.ts": "export const a = 1;\n",
      "hh/skills/s/s.md": "# s\n",
      "hh/docs/readme.md": "# hh\n",
      "hh/docs/subgraph/hh/tools/index.hydrated.jsonld": hydratedFile("hh", "tools"),
      "hh/docs/subgraph/hh/tools/index.jsonld": { "@context": `${BASE}/ns/subgraph/v1.jsonld`, "@id": `${BASE}/subgraph/hh/tools/` },
      "hh/docs/subgraph/hh/tools/a/index.hydrated.jsonld": hydratedFile("hh", "tools/a"),
      "hb/hb.json": decl("hb", { livesAt: { repository: "o/hy", path: "hb" }, directories: dirs.slice(0, 1).concat(dirs[2]!) }),
      "hb/docs/subgraph/hb/tools/index.hydrated.jsonld": hydratedFile("hb", "tools", "elsewhere"),
    });
    np = bareRepo(base, "np", {
      "np.json": decl("np", { directories: dirs.slice(0, 3), builtAtPublish }),
      "tools/a/a.ts": "export const a = 1;\n",
      "docs/readme.md": "# np\n",
    });
    const map: Record<string, string> = { "o/hy": `file://${hy.bare}`, "o/np": `file://${np.bare}` };
    hUrl = (r) => {
      const u = map[r];
      if (!u) throw new Error(`no fixture for ${r}`);
      return u;
    };
  });

  /** A downstream declaring one hydrated-capable mount of `harness`. */
  function hdown(harness: string, repo: { sha: string }, repository: string, mount: object): string {
    const root = join(base, `hdown-${++n}`);
    mkdirSync(root, { recursive: true });
    git(root, "init", "-q", "-b", "main");
    write(root, { "down.json": decl("down", { mountApprovers: ["test"], remoteMounts: [{ harness, repository, ref: repo.sha, ...consentFor(repo.sha), ...mount }] }) });
    return root;
  }

  test("H1. `hydrated: true` on the entry lays down only the published index.hydrated.jsonld — no code, no child file, no declaration", () => {
    const root = hdown("hh", hy, "o/hy", { hydrated: true });
    const r = mountRemote({ instanceRoot: root, urlFor: hUrl });
    const o = r.plan.outcomes.find((x) => x.instance === "hh")!;
    expect(o.state).toBe("mounted");
    expect(o.detail).toContain("hydrated metadata");
    // the others are named, not silently dropped
    expect(o.detail).toMatch(/not published at the pin, so not mounted: skills, docs|not published at the pin, so not mounted: docs, skills/);

    expect(JSON.parse(readFileSync(join(root, "hh/tools/index.hydrated.jsonld"), "utf-8"))["@id"]).toBe(`${BASE}/subgraph/hh/tools/`);
    expect(existsSync(join(root, "hh/tools/a"))).toBe(false);
    expect(existsSync(join(root, "hh/tools/index.jsonld"))).toBe(false);
    expect(existsSync(join(root, "hh/skills"))).toBe(false);
    expect(existsSync(join(root, "hh/hh.json"))).toBe(false);
    // nothing discovers a code-less layer there, and the overlay offers none
    expect(layerRootsIn(root)).toEqual([root]);
    expect(mountedInstanceRoots(root).has("hh")).toBe(false);

    const inst = readLock(root).instances.find((i) => i.instance === "hh")!;
    expect(inst.hydrated).toBe(true);
    expect(inst.directories).toEqual([expect.objectContaining({ id: "tools", path: "hh/tools", upstreamPath: "hh/docs/subgraph/hh/tools", files: 1 })]);
    expect(inst.declaration.file).toBe("hh.json");

    // the per-directory answer is a `hydrated` SubgraphSource naming this Tool (l4ay, j9cs)
    const planned = r.plan.instances.find((i) => i.instance === "hh")!.directories[0]!;
    expect(resolveSubgraphSource({ id: planned.id, path: planned.path, source: planned.hydrated })).toMatchObject({ kind: "hydrated", harness: "hh", subgraph: "tools", ref: hy.sha, tool: "remote-mount" });

    expect(checkRemote({ instanceRoot: root }).state).toBe("mounted");
    // edited metadata is reported like edited files
    writeFileSync(join(root, "hh/tools/index.hydrated.jsonld"), "{}\n");
    const c = checkRemote({ instanceRoot: root });
    expect(c.state).toBe("missing");
    expect(c.outcomes.find((x) => x.instance === "hh")!.detail).toContain("hh/tools/ modified");
  }, HYDRATED_TIMEOUT_MS);

  test("H2. an override chooses the subgraphs; a named one the pin does not publish is missing, the rest mounted", () => {
    const root = hdown("hh", hy, "o/hy", { overrides: { hh: { hydrated: true, directories: ["tools", "skills"] } } });
    const o = mountRemote({ instanceRoot: root, urlFor: hUrl }).plan.outcomes.find((x) => x.instance === "hh")!;
    expect(o.state).toBe("missing");
    expect(o.detail).toContain("skills");
    expect(o.detail).toContain("no index.hydrated.jsonld published there");
    expect(existsSync(join(root, "hh/tools/index.hydrated.jsonld"))).toBe(true);
    // `hydrated: false` on the override opts back into files
    const files = hdown("hh", hy, "o/hy", { hydrated: true, overrides: { hh: { hydrated: false, directories: ["tools"] } } });
    mountRemote({ instanceRoot: files, urlFor: hUrl });
    expect(existsSync(join(files, "hh/tools/a/a.ts"))).toBe(true);
    expect(existsSync(join(files, "hh/hh.json"))).toBe(true);
  }, HYDRATED_TIMEOUT_MS);

  test("H3. a pin that publishes no hydrated file is missing, and says the files are built at publish — never an empty 'mounted'", () => {
    const root = hdown("np", np, "o/np", { hydrated: true });
    const r = mountRemote({ instanceRoot: root, urlFor: hUrl });
    const o = r.plan.outcomes.find((x) => x.instance === "np")!;
    expect(o.state).toBe("missing");
    expect(o.detail).toContain("builtAtPublish");
    expect(existsSync(join(root, "np"))).toBe(false);
    expect(checkRemote({ instanceRoot: root }).state).toBe("missing");
  }, HYDRATED_TIMEOUT_MS);

  test("H4. a hydrated file declaring another subgraph's IRI is refused, not held as the one asked for", () => {
    const root = hdown("hb", hy, "o/hy", { hydrated: true });
    const o = mountRemote({ instanceRoot: root, urlFor: hUrl }).plan.outcomes.find((x) => x.instance === "hb")!;
    expect(o.state).toBe("missing");
    expect(o.detail).toContain("it was fetched for");
    expect(existsSync(join(root, "hb/tools"))).toBe(false);
  }, HYDRATED_TIMEOUT_MS);

  test("H5. `whole` and `hydrated` together are refused at plan time", () => {
    const root = hdown("hh", hy, "o/hy", { overrides: { hh: { hydrated: true, whole: true } } });
    const o = planRemote({ instanceRoot: root, urlFor: hUrl }).outcomes.find((x) => x.instance === "hh")!;
    expect(o.state).toBe("could-not-determine");
    expect(o.detail).toContain("keep one");
  }, HYDRATED_TIMEOUT_MS);

  test("H6. the lock replays on a fresh clone: the one file again, still no declaration, then current", () => {
    const src = hdown("hh", hy, "o/hy", { hydrated: true });
    mountRemote({ instanceRoot: src, urlFor: hUrl });
    const fresh = join(base, `hfresh-${++n}`);
    mkdirSync(fresh, { recursive: true });
    git(fresh, "init", "-q", "-b", "main");
    writeFileSync(join(fresh, "index.lock.json"), readFileSync(join(src, "index.lock.json")));
    writeFileSync(join(fresh, "down.json"), readFileSync(join(src, "down.json")));
    const srv = join(base, `hsrv-${n}`, "o");
    mkdirSync(srv, { recursive: true });
    spawnSync("ln", ["-s", hy.bare, join(srv, "hy")]);
    // input-site: inert #865c95f3 — saves the environment to restore it after the test, or strips names before handing it to a child; no assertion reads the values
    const prev = process.env.CAT_MOUNT_URL_PREFIX;
    process.env.CAT_MOUNT_URL_PREFIX = `file://${dirname(srv)}`;
    try {
      expect(replayLocks(fresh, false).outcomes.map((o) => [o.instance, o.state])).toEqual([["hh", "mounted"]]);
      expect(readFileSync(join(fresh, "hh/tools/index.hydrated.jsonld"))).toEqual(readFileSync(join(src, "hh/tools/index.hydrated.jsonld")));
      expect(existsSync(join(fresh, "hh/hh.json"))).toBe(false);
      expect(existsSync(join(fresh, "hh/tools/a"))).toBe(false);
      expect(replayLocks(fresh, true).outcomes.every((o) => o.state === "current")).toBe(true);
      expect(checkRemote({ instanceRoot: fresh }).state).toBe("mounted");
    } finally {
      if (prev === undefined) delete process.env.CAT_MOUNT_URL_PREFIX;
      else process.env.CAT_MOUNT_URL_PREFIX = prev;
    }
  }, HYDRATED_TIMEOUT_MS);
  // ── G2b: the index files come from the pin's subgraph index PACKAGE ──────

  /** Publish `harness`'s package for `repo@sha`, holding `files` under docs/subgraph/<harness>/. */
  function publish(harness: string, repository: string, sha: string, files: Record<string, object>): string {
    const root = join(base, `pkg-src-${++n}`);
    write(root, { [`${harness}.json`]: decl(harness, { directories: dirs.slice(0, 3) }) });
    for (const [rel, body] of Object.entries(files)) write(root, { [`docs/subgraph/${harness}/${rel}`]: body });
    const out = join(base, `pkg-out-${n}`);
    packSubgraphIndex({ root, repository, ref: sha, outDir: out });
    return out;
  }
  const serveFrom = (dir: string) => (url: string) => `file://${join(dir, url.split("/").pop()!)}`;

  test("H7. a pin whose tree holds no index file (builtAtPublish) mounts it from the pin's package, and the lock says so", () => {
    const out = publish("np", "o/np", np.sha, { "tools/index.hydrated.jsonld": hydratedFile("np", "tools"), "tools/index.jsonld": { "@id": `${BASE}/subgraph/np/tools/` } });
    const root = hdown("np", np, "o/np", { hydrated: true });
    const r = mountRemote({ instanceRoot: root, urlFor: hUrl, packageUrlFor: serveFrom(out) });
    const o = r.plan.outcomes.find((x) => x.instance === "np")!;
    expect(o.state).toBe("mounted");
    expect(o.detail).toContain("1 from the pin's subgraph index package");
    expect(o.detail).toMatch(/not published at the pin, so not mounted: (skills, docs|docs, skills)/);
    expect(JSON.parse(readFileSync(join(root, "np/tools/index.hydrated.jsonld"), "utf-8"))["@id"]).toBe(`${BASE}/subgraph/np/tools/`);
    expect(existsSync(join(root, "np/tools/index.jsonld"))).toBe(false);
    expect(existsSync(join(root, "np/np.json"))).toBe(false);

    const pkg = subgraphIndexPackage("o/np", np.sha, "np");
    const dir = readLock(root).instances.find((i) => i.instance === "np")!.directories[0]!;
    // the CANONICAL url, never the fixture's — so a replay anywhere fetches the same asset
    expect(dir).toMatchObject({ id: "tools", path: "np/tools", upstreamPath: "docs/subgraph/np/tools", files: 1, package: { url: pkg.tarballUrl, member: "docs/subgraph/np/tools/index.hydrated.jsonld" } });
    expect(dir.package!.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(checkRemote({ instanceRoot: root }).state).toBe("mounted");
  }, HYDRATED_TIMEOUT_MS);

  test("H8. a package file declaring another subgraph's IRI is refused like a tree file; no package at all keeps G2's answer, naming where it looked", () => {
    const bad = publish("np", "o/np", np.sha, { "tools/index.hydrated.jsonld": hydratedFile("np", "tools", "elsewhere") });
    const root = hdown("np", np, "o/np", { hydrated: true });
    const o = mountRemote({ instanceRoot: root, urlFor: hUrl, packageUrlFor: serveFrom(bad) }).plan.outcomes.find((x) => x.instance === "np")!;
    expect(o.state).toBe("missing");
    expect(o.detail).toContain("it was fetched for");
    expect(existsSync(join(root, "np/tools"))).toBe(false);

    const none = hdown("np", np, "o/np", { hydrated: true });
    const p = mountRemote({ instanceRoot: none, urlFor: hUrl, packageUrlFor: serveFrom(join(base, "no-such-release")) }).plan.outcomes.find((x) => x.instance === "np")!;
    expect(p.state).toBe("missing");
    expect(p.detail).toContain("builtAtPublish");
    expect(p.detail).toContain("subgraph index package: absent");
  }, HYDRATED_TIMEOUT_MS);

  test("H9. a package that fails its checks is never an empty layer", () => {
    const out = publish("np", "o/np", np.sha, { "tools/index.hydrated.jsonld": hydratedFile("np", "tools") });
    const pkg = subgraphIndexPackage("o/np", np.sha, "np");
    writeFileSync(join(out, pkg.tarball), "not the published bytes");
    const root = hdown("np", np, "o/np", { hydrated: true });
    const o = mountRemote({ instanceRoot: root, urlFor: hUrl, packageUrlFor: serveFrom(out) }).plan.outcomes.find((x) => x.instance === "np")!;
    expect(o.state).toBe("missing");
    expect(o.detail).toContain("subgraph index package: refused");
    expect(existsSync(join(root, "np"))).toBe(false);
  }, HYDRATED_TIMEOUT_MS);

  test("H10. the lock replays a package-sourced directory on a fresh clone: same bytes, refused if they change", () => {
    const out = publish("np", "o/np", np.sha, { "tools/index.hydrated.jsonld": hydratedFile("np", "tools") });
    const src = hdown("np", np, "o/np", { hydrated: true });
    mountRemote({ instanceRoot: src, urlFor: hUrl, packageUrlFor: serveFrom(out) });
    const fresh = join(base, `hfresh-${++n}`);
    mkdirSync(fresh, { recursive: true });
    git(fresh, "init", "-q", "-b", "main");
    writeFileSync(join(fresh, "index.lock.json"), readFileSync(join(src, "index.lock.json")));
    writeFileSync(join(fresh, "down.json"), readFileSync(join(src, "down.json")));
    // CAT_MOUNT_URL_PREFIX serves the repository AND its release assets, as github.com does.
    const srv = join(base, `hsrv-${n}`);
    mkdirSync(join(srv, "o"), { recursive: true });
    spawnSync("ln", ["-s", np.bare, join(srv, "o", "np")]);
    const pkg = subgraphIndexPackage("o/np", np.sha, "np");
    const rel = join(srv, "o", "np", "releases", "download", pkg.tag);
    mkdirSync(rel, { recursive: true });
    writeFileSync(join(rel, pkg.tarball), readFileSync(join(out, pkg.tarball)));
    // input-site: inert #865c95f3 — saves the environment to restore it after the test, or strips names before handing it to a child; no assertion reads the values
    const prev = process.env.CAT_MOUNT_URL_PREFIX;
    process.env.CAT_MOUNT_URL_PREFIX = `file://${srv}`;
    try {
      expect(replayLocks(fresh, false).outcomes.map((o) => [o.instance, o.state])).toEqual([["np", "mounted"]]);
      expect(readFileSync(join(fresh, "np/tools/index.hydrated.jsonld"))).toEqual(readFileSync(join(src, "np/tools/index.hydrated.jsonld")));
      expect(existsSync(join(fresh, "np/np.json"))).toBe(false);
      expect(replayLocks(fresh, true).outcomes.every((o) => o.state === "current")).toBe(true);
      // re-published bytes under the same name are not the lock's
      rmSync(join(fresh, "np"), { recursive: true, force: true });
      writeFileSync(join(rel, pkg.tarball), "other bytes");
      const again = replayLocks(fresh, false).outcomes.find((o) => o.instance === "np")!;
      expect(again.state).toBe("could-not-determine");
      expect(again.detail).toContain("refused");
      expect(existsSync(join(fresh, "np/tools/index.hydrated.jsonld"))).toBe(false);
    } finally {
      if (prev === undefined) delete process.env.CAT_MOUNT_URL_PREFIX;
      else process.env.CAT_MOUNT_URL_PREFIX = prev;
    }
  }, HYDRATED_TIMEOUT_MS);

  afterAll(() => {
    if (prevPrefix === undefined) delete process.env.CAT_MOUNT_URL_PREFIX;
    else process.env.CAT_MOUNT_URL_PREFIX = prevPrefix;
  });
});

describe("named ids declared FROM WITHIN (bean `mo75` G3)", () => {
  // o/nest: `nn` declares `skills/` at the top level, and `skills/skills.json`
  // declares `voices/` from within it (beans `cmsl`, `1g4s`) — the shape of
  // cat-harness's own `voices`. Before G3 both planners built their id map
  // from `<name>.json` alone and refused `voices` as "not declared".
  const BASE = "https://example.org";
  let nest: { bare: string; sha: string };
  let nUrl: (r: string) => string;

  beforeAll(() => {
    nest = bareRepo(base, "nest", {
      "nn/nn.json": decl("nn", {
        livesAt: { repository: "o/nest", path: "nn" },
        directories: [
          { id: "tools", path: "tools/", graphTypologies: ["tools"] },
          { id: "skills", path: "skills/", graphTypologies: ["skills"] },
          { id: "docs", path: "docs/", graphTypologies: ["docs"] },
        ],
      }),
      "nn/skills/skills.json": { directories: [{ id: "voices", path: "voices", subgraph: true, graphTypologies: ["skills"] }] },
      "nn/skills/s/s.md": "# s\n",
      "nn/skills/voices/v.md": "# v\n",
      "nn/tools/a/a.ts": "export const a = 1;\n",
      "nn/docs/readme.md": "# nn\n",
      // `mm`: the harness's OWN default names a nested id
      "mm/mm.json": decl("mm", {
        livesAt: { repository: "o/nest", path: "mm" },
        mountDefaults: { directories: ["voices"] },
        directories: [{ id: "skills", path: "skills/", graphTypologies: ["skills"] }],
      }),
      "mm/skills/skills.json": { directories: [{ id: "voices", path: "voices", subgraph: true, graphTypologies: ["skills"] }] },
      "mm/skills/s/s.md": "# s\n",
      "mm/skills/voices/v.md": "# v\n",
      "nn/docs/subgraph/nn/skills/voices/index.hydrated.jsonld": {
        "@context": `${BASE}/ns/subgraph/v1.jsonld`,
        "@id": `${BASE}/subgraph/nn/skills/voices/`,
        "@type": "Subgraph",
        name: "skills/voices",
        path: "skills/voices/",
      },
    });
    nUrl = (r) => {
      if (r !== "o/nest") throw new Error(`no fixture for ${r}`);
      return `file://${nest.bare}`;
    };
  });

  function ndown(mount: object, harness = "nn"): string {
    const root = join(base, `ndown-${++n}`);
    mkdirSync(root, { recursive: true });
    git(root, "init", "-q", "-b", "main");
    write(root, { "down.json": decl("down", { mountApprovers: ["test"], remoteMounts: [{ harness, repository: "o/nest", ref: nest.sha, ...consentFor(nest.sha), ...mount }] }) });
    return root;
  }

  test("N1. files: a nested id mounts its own path alone, and the lock and check agree", () => {
    const root = ndown({ overrides: { nn: { directories: ["voices"] } } });
    const r = mountRemote({ instanceRoot: root, urlFor: nUrl });
    expect(r.plan.outcomes.find((x) => x.instance === "nn")!.state).toBe("mounted");
    expect(existsSync(join(root, "nn/skills/voices/v.md"))).toBe(true);
    expect(existsSync(join(root, "nn/skills/s"))).toBe(false);
    expect(existsSync(join(root, "nn/tools"))).toBe(false);
    expect(readLock(root).instances.find((i) => i.instance === "nn")!.directories).toEqual([
      expect.objectContaining({ id: "voices", path: "nn/skills/voices", upstreamPath: "nn/skills/voices" }),
    ]);
    expect(checkRemote({ instanceRoot: root }).state).toBe("mounted");
  });

  test("N2. files: a nested id beside a top-level one, through the harness's own `mountDefaults` too", () => {
    const root = ndown({ overrides: { nn: { directories: ["tools", "voices"] } } });
    mountRemote({ instanceRoot: root, urlFor: nUrl });
    expect(existsSync(join(root, "nn/tools/a/a.ts"))).toBe(true);
    expect(existsSync(join(root, "nn/skills/voices/v.md"))).toBe(true);
    expect(existsSync(join(root, "nn/skills/s"))).toBe(false);
    const own = ndown({}, "mm");
    mountRemote({ instanceRoot: own, urlFor: nUrl });
    expect(existsSync(join(own, "mm/skills/voices/v.md"))).toBe(true);
    expect(existsSync(join(own, "mm/skills/s"))).toBe(false);
  });

  test("N3. hydrated: a nested id lays down its own published file, as a `hydrated` source for its nested path", () => {
    const root = ndown({ overrides: { nn: { hydrated: true, directories: ["voices"] } } });
    const r = mountRemote({ instanceRoot: root, urlFor: nUrl });
    expect(r.plan.outcomes.find((x) => x.instance === "nn")!.state).toBe("mounted");
    expect(JSON.parse(readFileSync(join(root, "nn/skills/voices/index.hydrated.jsonld"), "utf-8"))["@id"]).toBe(`${BASE}/subgraph/nn/skills/voices/`);
    expect(existsSync(join(root, "nn/skills/voices/v.md"))).toBe(false);
    const planned = r.plan.instances.find((i) => i.instance === "nn")!.directories[0]!;
    expect(planned).toMatchObject({ id: "voices", path: "nn/skills/voices", upstreamPath: "nn/docs/subgraph/nn/skills/voices" });
    expect(planned.hydrated).toMatchObject({ kind: "hydrated", harness: "nn", subgraph: "skills/voices" });
  });

  test("N4. an id declared nowhere — not in `<name>.json`, not from within — is refused at plan time and says where it looked", () => {
    for (const hydrated of [false, true]) {
      const root = ndown({ overrides: { nn: { hydrated, directories: ["voices", "choir"] } } });
      const o = planRemote({ instanceRoot: root, urlFor: nUrl }).outcomes.find((x) => x.instance === "nn")!;
      expect(o.state).toBe("could-not-determine");
      expect(o.detail).toContain("`choir` named for mounting but not declared");
      expect(o.detail).toContain("neither in its declaration nor from within");
    }
  });
});

describe("Tools chosen by id, mounted runnable (bean `mo75` G3; owner, 2026-10-24)", () => {
  // o/tl is the layer stack, shrunk: `kit` (bootstrap-tools: mounted whole),
  // `def` (cat-harness: the Tool DEFINITIONS, `tools/<id>/<id>.ts`, plus
  // their published Tools metadata) and `impl` (cat-harness-tools: the code
  // the definitions invoke). Each implementation reaches the layers below it
  // the way the real one does: a relative import inside its own layer, and a
  // PACKAGE import (`@o/def/…`, `@o/kit/…`) across layers.
  const BASE = "https://example.org";
  const tool = (id: string, invoke: object) => ({
    "@id": `${BASE}/subgraph/def/tools/${id}/`,
    "@type": "Subgraph",
    name: `tools/${id}`,
    path: `tools/${id}/`,
    hasMember: [{ "@id": `${BASE}/def/tools/${id}.jsonld`, "@type": "Tool", name: id, description: `Tool ${id}`, invoke }],
  });
  const INVOKE: Record<string, object> = {
    alpha: { inProcess: { module: "src/alpha.ts" }, mcp: { tool: "alpha" } },
    beta: { shell: "bun run cat beta:run" },
    gamma: { inProcess: { module: "src/gamma.ts" } },
    delta: { shell: "gh pr list" },
    broken: { inProcess: { module: "src/broken.ts" } },
    stray: { inProcess: { module: "src/stray.ts" } },
  };
  const metadata = (ids: string[]) => ({
    "@context": `${BASE}/ns/subgraph/v1.jsonld`,
    "@id": `${BASE}/subgraph/def/tools/`,
    "@type": "Subgraph",
    name: "tools",
    path: "tools/",
    hasSubgraph: ids.map((id) => tool(id, INVOKE[id] ?? { manual: true })),
  });
  /** A Tool definition the way cat-harness writes one: a factory, through the folder's shared helper. */
  const definition = (id: string) =>
    `import { defineTool } from "../../schemas/tool.ts";\nimport { described } from "../lib.ts";\nexport default () => defineTool({ id: "${id}", description: described("${id}") });\n`;
  let tl: { bare: string; sha: string };
  let bad: { bare: string; sha: string };
  let tUrl: (r: string) => string;

  const layers = (extra: Record<string, string | object> = {}, tools = ["alpha", "beta", "gamma", "delta"]): Record<string, string | object> => ({
    "kit/kit.json": decl("kit", { livesAt: { repository: "o/tl", path: "kit" }, mountDefaults: { whole: true }, directories: [{ id: "kit-schemas", path: "schemas/", graphTypologies: ["code"] }] }),
    "kit/package.json": { name: "@o/kit", private: true },
    "kit/schemas/graph.ts": "export const edge = (a: string, b: string): string => `${a}->${b}`;\n",
    "def/def.json": decl("def", {
      needs: ["kit"],
      livesAt: { repository: "o/tl", path: "def" },
      directories: [
        { id: "tools", path: "tools/", graphTypologies: ["tools"] },
        { id: "schemas", path: "schemas/", graphTypologies: ["code"] },
        { id: "skills", path: "skills/", graphTypologies: ["skills"] },
        { id: "docs", path: "docs/", graphTypologies: ["docs"] },
      ],
    }),
    "def/package.json": { name: "@o/def", private: true, exports: { "./*.js": "./*.ts", "./*": "./*" } },
    "def/schemas/tool.ts": 'import { stamp } from "./util.ts";\nexport const defineTool = <T extends { id: string }>(t: T): T & { stamped: string } => ({ ...t, stamped: stamp(t.id) });\n',
    "def/schemas/util.ts": "export const stamp = (s: string): string => `def:${s}`;\n",
    "def/tools/lib.ts": "export const described = (id: string): string => `the ${id} Tool`;\n",
    ...Object.fromEntries(tools.map((id) => [`def/tools/${id}/${id}.ts`, definition(id)])),
    "def/skills/s/s.md": "# s\n",
    "def/docs/readme.md": "# def\n",
    "def/docs/subgraph/def/tools/index.hydrated.jsonld": metadata(tools),
    "impl/impl.json": decl("impl", {
      needs: ["def", "kit"],
      livesAt: { repository: "o/tl", path: "impl" },
      directories: [
        { id: "impl-src", path: "src/", graphTypologies: ["code"] },
        { id: "impl-scripts", path: "scripts/", graphTypologies: ["code"] },
        { id: "impl-ui", path: "ui/", graphTypologies: ["code"] },
        { id: "impl-tools", path: "tools/", graphTypologies: ["tools"] },
      ],
    }),
    "impl/package.json": { name: "@o/impl", private: true, checkoutScripts: { "beta:run": "bun run impl/scripts/beta.ts" } },
    "impl/src/alpha.ts": 'import { stamp } from "@o/def/schemas/util.js";\nimport { shared } from "../scripts/shared.ts";\nexport const alpha = (): string => stamp(shared("alpha"));\n',
    "impl/src/gamma.ts": 'import { edge } from "@o/kit/schemas/graph.js";\nexport const gamma = (): string => edge("gamma", "kit");\n',
    "impl/scripts/beta.ts": 'import { shared } from "./shared.ts";\nexport const beta = (): string => shared("beta");\n',
    "impl/scripts/shared.ts": "export const shared = (s: string): string => `shared:${s}`;\n",
    "impl/ui/page.ts": "export const page = 1;\n",
    "impl/tools/own/own.ts": "export default () => ({ id: \"own\" });\n",
    ...extra,
  });

  beforeAll(() => {
    tl = bareRepo(base, "tl", layers());
    // Two Tools whose code cannot arrive whole: `broken` imports a file the pin
    // does not hold, `stray` a file outside every declared directory.
    bad = bareRepo(
      base,
      "tlbad",
      layers(
        {
          "impl/src/broken.ts": 'import { gone } from "../scripts/gone.ts";\nexport const broken = gone;\n',
          "impl/src/stray.ts": 'import { loose } from "../loose.ts";\nexport const stray = loose;\n',
          "impl/loose.ts": "export const loose = 1;\n",
        },
        ["alpha", "broken", "stray"],
      ),
    );
    const map: Record<string, string> = { "o/tl": `file://${tl.bare}`, "o/tlbad": `file://${bad.bare}` };
    tUrl = (r) => {
      const u = map[r];
      if (!u) throw new Error(`no fixture for ${r}`);
      return u;
    };
  });

  function tdown(harness: string, repo: { sha: string }, repository: string, mount: object): string {
    const root = join(base, `tdown-${++n}`);
    mkdirSync(root, { recursive: true });
    git(root, "init", "-q", "-b", "main");
    write(root, { "down.json": decl("down", { mountApprovers: ["test"], remoteMounts: [{ harness, repository, ref: repo.sha, ...consentFor(repo.sha), ...mount }] }) });
    return root;
  }

  test("T1. load the Tools metadata (hydrated), choose three Tools by id, materialise them: each arrives with definition, implementation and closure, and loads", async () => {
    // 1. Load the metadata: no code arrives.
    const meta = tdown("def", tl, "o/tl", { hydrated: true, overrides: { def: { directories: ["tools"] } } });
    const read = mountRemote({ instanceRoot: meta, urlFor: tUrl, install: false });
    expect(read.plan.outcomes.find((o) => o.instance === "def")!.state).toBe("mounted");
    expect(existsSync(join(meta, "def/tools/alpha"))).toBe(false);
    const hydrated = JSON.parse(readFileSync(join(meta, "def/tools/index.hydrated.jsonld"), "utf-8")) as {
      hasSubgraph: Array<{ hasMember: Array<{ name: string; invoke: Record<string, unknown> }> }>;
    };

    // 2. Review and choose: the three whose metadata says they run code of a layer.
    const chosen = hydrated.hasSubgraph
      .flatMap((s) => s.hasMember)
      .filter((t) => t.invoke.inProcess !== undefined || String(t.invoke.shell ?? "").startsWith("bun run cat "))
      .map((t) => t.name);
    expect(chosen).toEqual(["alpha", "beta", "gamma"]);

    // 3. Materialise exactly those, runnable.
    const root = tdown("impl", tl, "o/tl", { overrides: { def: { tools: chosen } } });
    const r = mountRemote({ instanceRoot: root, urlFor: tUrl, install: false });
    const state = Object.fromEntries(r.plan.outcomes.map((o) => [o.instance, o.state]));
    expect(state).toEqual({ impl: "mounted", def: "mounted", kit: "mounted" });
    expect(r.plan.outcomes.find((o) => o.instance === "def")!.detail).toContain("Tools `alpha` (def/tools/alpha/alpha.ts + impl/src/alpha.ts)");

    // The directories the closure touches, whole — and nothing else.
    const dirs = (i: string) => readLock(root).instances.find((x) => x.instance === i)!.directories.map((d) => d.id).sort();
    expect(dirs("def")).toEqual(["schemas", "tools"]);
    expect(dirs("impl")).toEqual(["impl-scripts", "impl-src"]);
    expect(dirs("kit")).toEqual(["*"]);
    for (const absent of ["def/skills", "def/docs", "impl/ui", "impl/tools"]) expect(existsSync(join(root, absent))).toBe(false);
    // Directory granularity: a Tool folder is not a declared directory, so an
    // unchosen Tool's folder comes with `tools/` (owner's ruling 3).
    expect(existsSync(join(root, "def/tools/delta/delta.ts"))).toBe(true);
    expect(checkRemote({ instanceRoot: root }).state).toBe("mounted");

    // It loads: the workspace links a root install would make, then each
    // definition and each implementation, imported from the mounted bytes.
    mkdirSync(join(root, "node_modules/@o"), { recursive: true });
    for (const p of ["kit", "def", "impl"]) symlinkSync(join(root, p), join(root, "node_modules/@o", p));
    for (const id of chosen) {
      const def = (await import(join(root, `def/tools/${id}/${id}.ts`))) as { default: () => { id: string; stamped: string; description: string } };
      expect(def.default()).toEqual({ id, description: `the ${id} Tool`, stamped: `def:${id}` });
    }
    expect(((await import(join(root, "impl/src/alpha.ts"))) as { alpha: () => string }).alpha()).toBe("def:shared:alpha");
    expect(((await import(join(root, "impl/scripts/beta.ts"))) as { beta: () => string }).beta()).toBe("shared:beta");
    expect(((await import(join(root, "impl/src/gamma.ts"))) as { gamma: () => string }).gamma()).toBe("gamma->kit");
  });

  test("T2. a Tool with no implementation layer brings its definition only, and names what it runs", () => {
    const root = tdown("impl", tl, "o/tl", { overrides: { def: { tools: ["delta"] } } });
    const r = mountRemote({ instanceRoot: root, urlFor: tUrl, install: false });
    expect(r.plan.outcomes.find((o) => o.instance === "def")!.detail).toContain("runs `gh pr list`");
    expect(readLock(root).instances.find((x) => x.instance === "impl")!.directories).toEqual([]);
    expect(existsSync(join(root, "impl/src"))).toBe(false);
  });

  test("T3. an id the metadata does not hold, an import that names nothing and a file in no declared directory are refused — and nothing of the entry is mounted", () => {
    const unknown = tdown("impl", tl, "o/tl", { overrides: { def: { tools: ["alpha", "omega"] } } });
    const u = mountRemote({ instanceRoot: unknown, urlFor: tUrl, install: false });
    expect(u.plan.outcomes.find((o) => o.instance === "def")).toMatchObject({ state: "missing" });
    expect(u.plan.outcomes.find((o) => o.instance === "def")!.detail).toContain("`omega` named for mounting but in none of `def`'s published Tools metadata");
    expect(existsSync(join(unknown, "def"))).toBe(false);
    expect(existsSync(join(unknown, "impl"))).toBe(false);

    for (const [id, says] of [
      ["broken", "impl/src/broken.ts imports `../scripts/gone.ts`, which names no file at the pin"],
      ["stray", "impl/loose.ts is in no directory `impl` declares"],
    ] as const) {
      const root = tdown("impl", bad, "o/tlbad", { overrides: { def: { tools: [id] } } });
      const r = mountRemote({ instanceRoot: root, urlFor: tUrl, install: false });
      expect(r.plan.outcomes.find((o) => o.instance === "def")!.state).toBe("missing");
      expect(r.plan.outcomes.find((o) => o.instance === "def")!.detail).toContain(says);
      expect(r.plan.outcomes.find((o) => o.instance === "impl")!.state).toBe("missing");
      expect(existsSync(join(root, "impl/src"))).toBe(false);
    }
  });

  test("T5. an instance of ANOTHER entry the closure reaches shrinks to what it needs; an explicit list wins (owner, 2026-10-29, option B)", () => {
    const two = (implMount: object = {}): string => {
      const root = join(base, `tdown-${++n}`);
      mkdirSync(root, { recursive: true });
      git(root, "init", "-q", "-b", "main");
      write(root, {
        "down.json": decl("down", {
          mountApprovers: ["test"],
          remoteMounts: [
            { harness: "def", repository: "o/tl", ref: tl.sha, ...consentFor(tl.sha), overrides: { def: { tools: ["alpha"] } } },
            { harness: "impl", repository: "o/tl", ref: tl.sha, ...consentFor(tl.sha), ...implMount },
          ],
        }),
      });
      return root;
    };
    const dirs = (root: string, i: string) => readLock(root).instances.find((x) => x.instance === i)!.directories.map((d) => d.id).sort();

    // impl's own entry names no directories: it shrinks to alpha's closure.
    const shrinks = two();
    const r = mountRemote({ instanceRoot: shrinks, urlFor: tUrl, install: false });
    expect(r.plan.outcomes.find((o) => o.instance === "impl")!.state).toBe("mounted");
    expect(dirs(shrinks, "impl")).toEqual(["impl-scripts", "impl-src"]);
    expect(existsSync(join(shrinks, "impl/ui"))).toBe(false);

    // An explicit list wins, and then it must bring what the closure needs.
    const explicit = two({ overrides: { impl: { directories: ["impl-src", "impl-ui"] } } });
    const e = mountRemote({ instanceRoot: explicit, urlFor: tUrl, install: false });
    expect(e.plan.outcomes.find((o) => o.instance === "def")!.state).toBe("missing");
    expect(e.plan.outcomes.find((o) => o.instance === "def")!.detail).toContain("the closure needs `impl`'s `impl-scripts`, which its own mount entry (`impl`) does not bring");
  });

  test("T4. `tools` with `hydrated` is refused at plan time: metadata brings no code", () => {
    const root = tdown("def", tl, "o/tl", { overrides: { def: { hydrated: true, tools: ["alpha"] } } });
    const p = planRemote({ instanceRoot: root, urlFor: tUrl });
    expect(p.outcomes.find((o) => o.instance === "def")).toMatchObject({ state: "could-not-determine" });
    expect(p.outcomes.find((o) => o.instance === "def")!.detail).toContain("`tools` and `hydrated` both asked for");
  });
});

describe("same-owner mounts (cat-harness-tools#2337, WHO migration plan T3)", () => {
  test("a bare repository mounts from the checkout's owner, and the lock keeps it bare", () => {
    // input-site: inert #ff7a5eaa — saves the environment to restore it after the test, or strips names before handing it to a child; no assertion reads the values
    const prev = process.env.CAT_REPO_OWNER;
    process.env.CAT_REPO_OWNER = "o";
    try {
      const root = downstream({ repository: "up" });
      const r = mountRemote({ instanceRoot: root, urlFor });
      expect(Object.fromEntries(r.plan.outcomes.map((o) => [o.instance, o.state]))).toEqual({ core: "mounted", base: "mounted", boot: "mounted" });
      const raw = JSON.parse(readFileSync(join(root, "index.lock.json"), "utf-8"));
      // the mount and the layer reached in the same tree stay same-owner; the gitlink stays absolute
      expect(raw.mounts[0].repository).toBe("up");
      expect(raw.instances.find((i: { instance: string }) => i.instance === "base").repository).toBe("up");
      expect(raw.instances.find((i: { instance: string }) => i.instance === "boot").repository).toBe("o/boot");
      // readers see owner/name, and the check agrees with the declaration
      expect(readLock(root).mounts[0]!.repository).toBe("up");
      expect(checkRemote({ instanceRoot: root }).state).toBe("mounted");
      // another owner reads the same files as its own: declared and locked names move together
      process.env.CAT_REPO_OWNER = "who";
      expect(readDeclaredMounts(root).mounts[0]).toMatchObject({ repository: "who/up", sameOwner: true });
    } finally {
      if (prev === undefined) delete process.env.CAT_REPO_OWNER;
      else process.env.CAT_REPO_OWNER = prev;
    }
  });
});

describe("the lock records when it was written: pinnedAt (merge-manager, 2026-11-17)", () => {
  const dir = mkdtempSync(join(tmpdir(), "lock-pinned-at-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, "index.lock.json");
  const lock = (ref: string) =>
    MountLockSchema.parse({
      $schema: "cat-harness-mount-lock/v1",
      mounts: [{ harness: "core", repository: "litlfred/core", ref: ref.repeat(40) }],
      instances: [],
    });
  const at = (iso: string) => () => new Date(iso);

  test("a new lock is stamped now, in whole seconds, after $schema, and parses", () => {
    rmSync(file, { force: true });
    const text = lockTextWithPinnedAt(lock("a"), file, at("2026-11-17T10:15:00.123Z"));
    const parsed = JSON.parse(text);
    expect(Object.keys(parsed).slice(0, 3)).toEqual(["$schema", "pinnedAt", "mounts"]);
    expect(parsed.pinnedAt).toBe("2026-11-17T10:15:00Z");
    expect(MountLockSchema.parse(parsed).pinnedAt).toBe("2026-11-17T10:15:00Z");
    writeFileSync(file, text);
  });

  test("the same content keeps its pinnedAt, so a re-run leaves the bytes alone", () => {
    const before = readFileSync(file, "utf-8");
    expect(lockTextWithPinnedAt(lock("a"), file, at("2026-11-17T11:00:00Z"))).toBe(before);
  });

  test("changed pins are stamped anew", () => {
    expect(JSON.parse(lockTextWithPinnedAt(lock("b"), file, at("2026-11-17T11:00:00Z"))).pinnedAt).toBe("2026-11-17T11:00:00Z");
  });

  test("a lock written before pinnedAt existed is stamped at its next write", () => {
    writeFileSync(file, JSON.stringify(lock("a"), null, 2) + "\n");
    expect(JSON.parse(lockTextWithPinnedAt(lock("a"), file, at("2026-11-17T12:00:00Z"))).pinnedAt).toBe("2026-11-17T12:00:00Z");
  });
});
