/**
 * Standing consent (issue #401): the coverage decision, green-commit
 * selection behind a STUBBED GitHub API, and the config + lock rewrite
 * through the mount:remote write paths, against fixture repositories served
 * over `file://` like `remote-mount-gaps.test.ts`.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import type { StandingConsent } from "../../../schemas/kg/mount-trust.js";
import type { RemoteMount } from "../../../schemas/kg/remote-mount.js";
import { readDeclaration } from "../../../schemas/kg/cat-harness.ts";
import { writeDeclaration } from "../../../test/support/instance-fixture.js";
import {
  alignToHeldPins,
  applyRepin,
  candidateFor,
  cascadeOf,
  extendExplicitDirectories,
  inCheckoutDirectoryIds,
  movesSince,
  lockPinsOf,
  newlyDeclaredDirectoryIds,
  planRepin,
  summaryOf,
  upstreamRootsOf,
  verdictOf,
  type CommitVerdict,
  type GitHubApi,
  type RepinPlan,
} from "../../repin-standing.ts";

const A = "a".repeat(40);
const B = "b".repeat(40);
const C = "c".repeat(40);
const D = "d".repeat(40);

/** A stub API: commits per `repo@branch`, newest first, and a verdict per sha. Records every call. */
function stubApi(commits: Record<string, string[]>, verdicts: Record<string, CommitVerdict> = {}): GitHubApi & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async branchCommits(repository, branch, limit) {
      calls.push(`commits ${repository}@${branch} ${limit}`);
      const xs = commits[`${repository}@${branch}`];
      if (!xs) throw new Error(`no branch ${branch}`);
      return xs.slice(0, limit);
    },
    async commitVerdict(repository, sha) {
      calls.push(`verdict ${repository} ${sha.slice(0, 1)}`);
      return verdicts[sha] ?? "none";
    },
  };
}

const rule = (extra: Partial<StandingConsent> = {}): StandingConsent => ({ follows: "main", consentBy: "litlfred", consentAt: "2026-10-16", require: "green", ...extra });
const mount = (harness: string, ref: string, standing?: StandingConsent): RemoteMount =>
  ({ harness, repository: `o/${harness}`, ref, trust: { consent: { by: "litlfred", on: "2026-10-15", ref, evidence: "fixture" }, ...(standing ? { standing } : {}) } }) as RemoteMount;

describe("verdictOf: green only when something checked the commit and all of it passed", () => {
  test("nothing reported is `none`, never green", () => {
    expect(verdictOf({ state: "pending", total_count: 0 }, [])).toBe("none");
    expect(verdictOf(undefined, [])).toBe("none");
  });
  test("statuses and check runs both count", () => {
    expect(verdictOf({ state: "success", total_count: 2 }, [{ status: "completed", conclusion: "success" }])).toBe("green");
    expect(verdictOf({ state: "pending", total_count: 0 }, [{ status: "completed", conclusion: "skipped" }, { status: "completed", conclusion: "success" }])).toBe("green");
    expect(verdictOf({ state: "success", total_count: 1 }, [{ status: "in_progress", conclusion: null }])).toBe("pending");
    expect(verdictOf({ state: "pending", total_count: 1 }, [])).toBe("pending");
    expect(verdictOf({ state: "success", total_count: 1 }, [{ status: "completed", conclusion: "failure" }])).toBe("red");
    expect(verdictOf({ state: "failure", total_count: 1 }, [{ status: "completed", conclusion: "success" }])).toBe("red");
    expect(verdictOf({ state: "pending", total_count: 0 }, [{ status: "completed", conclusion: "cancelled" }])).toBe("red");
  });
});

describe("candidateFor: the followed branch's newest (green) commit, through the stub", () => {
  test("require green: passes over newer pending and red commits to the newest green", async () => {
    const api = stubApi({ "o/x@main": [D, C, B, A] }, { [D]: "pending", [C]: "red", [B]: "green", [A]: "green" });
    const r = await candidateFor(api, "o/x", rule());
    expect(r.candidate).toEqual({ branch: "main", sha: B, verdict: "green" });
    expect(r.looked.map((l) => l.verdict)).toEqual(["pending", "red", "green"]);
    expect(api.calls).not.toContain("verdict o/x a");
  });
  test("require green and nothing green within depth: no candidate", async () => {
    const api = stubApi({ "o/x@main": [D, C, B] }, { [D]: "pending", [C]: "none", [B]: "green" });
    expect((await candidateFor(api, "o/x", rule(), 2)).candidate).toBeUndefined();
  });
  test("no require: the branch head, with no verdict asked", async () => {
    const api = stubApi({ "o/x@dev": [D, C] });
    expect((await candidateFor(api, "o/x", rule({ follows: "dev", require: undefined }))).candidate).toEqual({ branch: "dev", sha: D });
    expect(api.calls.some((c) => c.startsWith("verdict"))).toBe(false);
  });
});

describe("planRepin: the coverage decision, per instance", () => {
  test("a standing rule moves its pin; an instance with no rule is never touched or even asked about", async () => {
    const api = stubApi({ "o/x@main": [C, B] }, { [C]: "green" });
    const plan = await planRepin([mount("x", A, rule()), mount("y", A)], api);
    expect(plan.moves.map((m) => [m.harness, m.from, m.to])).toEqual([["x", A, C]]);
    expect(plan.held).toEqual([]);
    expect(api.calls.some((c) => c.includes("o/y"))).toBe(false);
  });
  test("already at the newest green: held, not moved", async () => {
    const plan = await planRepin([mount("x", C, rule())], stubApi({ "o/x@main": [D, C] }, { [D]: "red", [C]: "green" }));
    expect(plan.moves).toEqual([]);
    expect(plan.held[0]!.reason).toContain("already pinned");
  });
  test("nothing green: held with the reason", async () => {
    const plan = await planRepin([mount("x", A, rule())], stubApi({ "o/x@main": [D] }, { [D]: "pending" }));
    expect(plan.moves).toEqual([]);
    expect(plan.held[0]!.reason).toContain("green");
  });
  test("an API failure is could-not-determine, never 'nothing to move'", async () => {
    const plan = await planRepin([mount("x", A, rule({ follows: "gone" }))], stubApi({}));
    expect(plan.unknown.map((u) => u.harness)).toEqual(["x"]);
    expect(summaryOf(plan, true)).toContain("Could not determine");
  });
  test("the summary names who consented, under which rule", async () => {
    const plan = await planRepin([mount("x", A, rule())], stubApi({ "o/x@main": [C] }, { [C]: "green" }));
    const s = summaryOf(plan, false);
    expect(s).toContain("| x | o/x |");
    expect(s).toContain("litlfred (standing, 2026-10-16)");
  });
});

// ── The rewrite, over fixture repositories ──────────────────────────────────

function git(cwd: string, ...args: string[]): string {
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

let base: string;
let up: { bare: string; first: string; second: string };
let other: { bare: string; sha: string };
let urlFor: (r: string) => string;

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "repin-standing-"));
  const mk = (name: string, commits: Array<Record<string, string | object>>): { bare: string; shas: string[] } => {
    const work = join(base, `${name}-work`);
    mkdirSync(work, { recursive: true });
    git(work, "init", "-q", "-b", "main");
    const shas: string[] = [];
    for (const files of commits) {
      write(work, files);
      git(work, "add", "-A", "-f");
      git(work, "commit", "-q", "-m", "fixture");
      shas.push(git(work, "rev-parse", "HEAD"));
    }
    const bare = join(base, `${name}.git`);
    git(base, "clone", "-q", "--bare", work, bare);
    git(bare, "config", "uploadpack.allowFilter", "true");
    git(bare, "config", "uploadpack.allowAnySHA1InWant", "true");
    return { bare, shas };
  };
  const u = mk("up", [{ "up.json": { name: "up", directories: [] }, "v.txt": "1\n" }, { "v.txt": "2\n" }]);
  up = { bare: u.bare, first: u.shas[0]!, second: u.shas[1]! };
  const o = mk("other", [{ "other.json": { name: "other", directories: [] } }]);
  other = { bare: o.bare, sha: o.shas[0]! };
  const map: Record<string, string> = { "o/up": `file://${up.bare}`, "o/other": `file://${other.bare}` };
  urlFor = (r) => map[r] ?? (() => { throw new Error(`no fixture for ${r}`); })();
});
afterAll(() => rmSync(base, { recursive: true, force: true }));

function site(): string {
  const root = mkdtempSync(join(base, "site-"));
  git(root, "init", "-q", "-b", "main");
  const consent = (ref: string) => ({ by: "test", on: "2026-10-15", ref, evidence: "fixture" });
  write(root, {
    "down.json": { name: "down", directories: [], mountApprovers: ["test"] },
    "index.config.json": {
      $schema: "folio-index-config/v1",
      instances: [
        { name: "down", source: { local: { at: "." } } },
        { name: "up", source: { remote: { repository: "o/up", ref: up.first, overrides: { up: { whole: true } }, trust: { consent: consent(up.first), standing: { follows: "main", consentBy: "test", consentAt: "2026-10-16", require: "green" } } } } },
        { name: "other", source: { remote: { repository: "o/other", ref: other.sha, overrides: { other: { whole: true } }, trust: { consent: consent(other.sha) } } } },
      ],
    },
  });
  return root;
}

describe("applyRepin: index.config.json and index.lock.json move through the mount:remote write paths", () => {
  test("the covered pin moves with a consent by the rule's person; the other entry is untouched; the lock follows", async () => {
    const root = site();
    const rm = await import("../../remote-mount.ts");
    expect(rm.mountRemote({ instanceRoot: root, urlFor, install: false }).plan.outcomes.every((o) => o.state === "mounted")).toBe(true);
    const otherBefore = JSON.parse(readFileSync(join(root, "index.config.json"), "utf-8")).instances.find((i: { name: string }) => i.name === "other");

    const { readDeclaredMounts } = await import("../../../schemas/kg/index-config.js");
    const plan = await planRepin(readDeclaredMounts(root).mounts, stubApi({ "o/up@main": [up.second, up.first] }, { [up.second]: "green", [up.first]: "green" }));
    expect(plan.moves.map((m) => [m.harness, m.to])).toEqual([["up", up.second]]);
    const r = await applyRepin(root, plan, { on: "2026-10-17", urlFor, install: false });
    expect(r.exit).toBe(0);
    expect(r.mountState).toBe("mounted");

    const cfg = JSON.parse(readFileSync(join(root, "index.config.json"), "utf-8"));
    const upEntry = cfg.instances.find((i: { name: string }) => i.name === "up").source.remote;
    expect(upEntry.ref).toBe(up.second);
    expect(upEntry.overrides).toEqual({ up: { whole: true } });
    expect(upEntry.trust.consent).toMatchObject({ by: "test", on: "2026-10-17", ref: up.second, standing: { follows: "main", consentAt: "2026-10-16", require: "green" } });
    expect(upEntry.trust.standing).toEqual({ follows: "main", consentBy: "test", consentAt: "2026-10-16", require: "green" });
    expect(cfg.instances.find((i: { name: string }) => i.name === "other")).toEqual(otherBefore);

    const lock = JSON.parse(readFileSync(join(root, "index.lock.json"), "utf-8"));
    expect(lock.mounts.find((m: { harness: string }) => m.harness === "up").ref).toBe(up.second);
    const inst = lock.instances.find((i: { instance: string }) => i.instance === "up");
    expect(inst.sha).toBe(up.second);
    expect(inst.trust).toMatchObject({ basis: "consent", by: "test", ref: up.second, approver: "declared", standing: { follows: "main" } });
    expect(readFileSync(join(root, "up/v.txt"), "utf-8")).toBe("2\n");
    expect(rm.checkRemote({ instanceRoot: root }).state).toBe("mounted");
  });

  test("withdrawing the rule afterwards makes the check refuse the pin it moved (it asks again)", async () => {
    const root = site();
    const { readDeclaredMounts } = await import("../../../schemas/kg/index-config.js");
    const plan = await planRepin(readDeclaredMounts(root).mounts, stubApi({ "o/up@main": [up.second] }, { [up.second]: "green" }));
    await applyRepin(root, plan, { urlFor, install: false });
    const f = join(root, "index.config.json");
    const cfg = JSON.parse(readFileSync(f, "utf-8"));
    delete cfg.instances.find((i: { name: string }) => i.name === "up").source.remote.trust.standing;
    writeFileSync(f, JSON.stringify(cfg, null, 2));
    const rm = await import("../../remote-mount.ts");
    const c = rm.checkRemote({ instanceRoot: root });
    expect(c.outcomes.find((o) => o.instance === "up")?.state).toBe("refused");
  });

  test("dry run: nothing moved means nothing written", async () => {
    const root = site();
    const before = readFileSync(join(root, "index.config.json"), "utf-8");
    expect(await applyRepin(root, { moves: [], held: [], unknown: [] })).toEqual({ exit: 0 });
    expect(readFileSync(join(root, "index.config.json"), "utf-8")).toBe(before);
  });
});

describe("alignToHeldPins: an instance below the harness follows the harness's own lock (cascade, bean pqlh)", () => {
  const open = rule({ require: undefined });
  const withLocks = (api: GitHubApi, locks: Record<string, Record<string, string>>): GitHubApi => ({
    ...api,
    async lockPinsAt(repository, sha) {
      return locks[`${repository}@${sha}`];
    },
  });
  const cap = { harness: "harness", below: new Set(["base", "base-tools"]) };

  test("the lower layer moves to the pin the harness's NEW commit holds, not to its branch head", async () => {
    const mounts = [mount("harness", A, open), mount("base", A, open), mount("base-tools", A, open), mount("content", A, open)];
    const api = withLocks(stubApi({ "o/harness@main": [B], "o/base@main": [D], "o/base-tools@main": [D], "o/content@main": [D] }), {
      [`o/harness@${B}`]: { "o/base": C, "o/base-tools": A, "o/content": B },
    });
    const plan = await alignToHeldPins(await planRepin(mounts, api), mounts, api, cap);
    const to = Object.fromEntries(plan.moves.map((m) => [m.harness, m.to]));
    expect(to).toEqual({ harness: B, base: C, content: D });
    expect(plan.moves.find((m) => m.harness === "base")?.alignedTo).toBe(`harness@${B.slice(0, 10)}`);
    expect(plan.held.map((h) => h.harness)).toEqual(["base-tools"]);
    expect(summaryOf(plan, true)).toContain("held by harness@");
  });

  test("a held pin the standing rule does not cover is held, not moved", async () => {
    const mounts = [mount("harness", A, open), mount("base", A, rule())];
    const api = withLocks(stubApi({ "o/harness@main": [B], "o/base@main": [D] }, { [D]: "green", [C]: "red" }), { [`o/harness@${B}`]: { "o/base": C } });
    const plan = await alignToHeldPins(await planRepin(mounts, api), mounts, api, cap);
    expect(plan.moves.map((m) => m.harness)).toEqual(["harness"]);
    expect(plan.held.find((h) => h.harness === "base")?.reason).toContain("does not cover");
  });

  test("an unreadable harness lock is unknown, never a silent pass; no lock reader means no cascade", async () => {
    const mounts = [mount("harness", A, open), mount("base", A, open)];
    const base = stubApi({ "o/harness@main": [B], "o/base@main": [D] });
    const broken: GitHubApi = { ...base, async lockPinsAt() { throw new Error("HTTP 500"); } };
    const plan = await alignToHeldPins(await planRepin(mounts, broken), mounts, broken, cap);
    expect(plan.unknown.map((u) => u.harness)).toEqual(["harness"]);
    const plain = await alignToHeldPins(await planRepin(mounts, base), mounts, base, cap);
    expect(plain.moves.find((m) => m.harness === "base")?.to).toBe(D);
  });

  test("lockPinsOf reads `mounts` and ignores anything else", () => {
    expect(lockPinsOf({ mounts: [{ repository: "o/x", ref: A }, { repository: 1 }], instances: [{ repository: "o/y", sha: B }] })).toEqual({ "o/x": A });
    expect(lockPinsOf(null)).toEqual({});
  });
});

describe("extendExplicitDirectories: a directory the new pin declares joins an explicit list (folio-assistant#3023)", () => {
  const decl = (...dirs: object[]) => ({ name: "up", directories: dirs });
  const OLD = decl({ id: "library", path: "library/" }, { id: "ast", path: "fhir-ast/", storage: { branchPrefix: "x/" } });
  const NEW = decl(
    { id: "library", path: "library/" },
    { id: "ast", path: "fhir-ast/", storage: { branchPrefix: "x/" } },
    { id: "scenarios", path: "scenarios/" },
    { id: "tools", path: "tools/" },
    { id: "cache", path: "cache/", storage: { branchPrefix: "c/" } },
    { id: "extra", path: "extra/", optIn: true },
  );
  const withDecls = (decls: Record<string, unknown>): GitHubApi => ({
    ...stubApi({}),
    async declarationAt(_r, sha) {
      return decls[sha];
    },
  });
  const listed = (dirs: string[] | undefined): RemoteMount => ({ ...mount("up", A, rule()), ...(dirs ? { overrides: { up: { directories: dirs } } } : {}) }) as RemoteMount;
  const moved = (): RepinPlan => ({ moves: [{ harness: "up", repository: "o/up", from: A, to: B, rule: rule(), skipped: [] }], held: [], unknown: [] });

  test("in the checkout only: a branch-kept or opt-in directory is never added", () => {
    expect(inCheckoutDirectoryIds(NEW)).toEqual(["library", "scenarios", "tools"]);
    expect(newlyDeclaredDirectoryIds(OLD, NEW)).toEqual(["scenarios", "tools"]);
    expect(inCheckoutDirectoryIds(undefined)).toEqual([]);
  });

  test("an explicit list gains the new ids, less those it already names", async () => {
    const plan = await extendExplicitDirectories(moved(), [listed(["library", "tools"])], withDecls({ [A]: OLD, [B]: NEW }));
    expect(plan.moves[0]!.addDirectories).toEqual(["scenarios"]);
    expect(summaryOf(plan, false)).toContain("- up: `scenarios`");
  });

  test("no explicit list: nothing to extend, and no declaration is read", async () => {
    let read = 0;
    const api: GitHubApi = { ...stubApi({}), async declarationAt() { read++; return NEW; } };
    const plan = await extendExplicitDirectories(moved(), [listed(undefined)], api);
    expect(plan.moves[0]!.addDirectories).toBeUndefined();
    expect(read).toBe(0);
  });

  test("a declaration it cannot read withdraws the move as could-not-determine, never a short list", async () => {
    const plan = await extendExplicitDirectories(moved(), [listed(["library"])], withDecls({ [A]: OLD }));
    expect(plan.moves).toEqual([]);
    expect(plan.unknown[0]!.reason).toContain("cannot be told");
    const failing: GitHubApi = { ...stubApi({}), async declarationAt() { throw new Error("HTTP 500"); } };
    expect((await extendExplicitDirectories(moved(), [listed(["library"])], failing)).unknown[0]!.reason).toContain("HTTP 500");
  });

  test("a declaration below the root is read where the site's lock says it sits (smart-base/, 2026-11-13)", async () => {
    const asked: (string | undefined)[] = [];
    const api: GitHubApi = {
      ...stubApi({}),
      async declarationAt(_r, sha, _i, at) {
        asked.push(at);
        return at === "smart-base" ? ({ [A]: OLD, [B]: NEW } as Record<string, unknown>)[sha] : undefined;
      },
    };
    const plan = await extendExplicitDirectories(moved(), [listed(["library", "tools"])], api, { up: "smart-base" });
    expect(asked).toEqual(["smart-base", "smart-base"]);
    expect(plan.unknown).toEqual([]);
    expect(plan.moves[0]!.addDirectories).toEqual(["scenarios"]);
    // Missing even there: the reason names the directory it looked in.
    const none = await extendExplicitDirectories(moved(), [listed(["library"])], { ...stubApi({}), async declarationAt() { return undefined; } }, { up: "smart-base" });
    expect(none.unknown[0]!.reason).toContain("in `smart-base/` of o/up@");
  });

  test("upstreamRootsOf reads each instance's upstreamRoot from the lock, and nothing else", () => {
    expect(
      upstreamRootsOf({
        instances: [
          { instance: "smart-base", upstreamRoot: "smart-base" },
          { instance: "cat-harness", upstreamRoot: "" },
          { instance: "no-root" },
          "junk",
        ],
      }),
    ).toEqual({ "smart-base": "smart-base", "cat-harness": "" });
    expect(upstreamRootsOf(undefined)).toEqual({});
    expect(upstreamRootsOf({ instances: "x" })).toEqual({});
  });

  test("applyRepin writes the added ids after the site's own, and touches no other entry", async () => {
    const root = site();
    const f = join(root, "index.config.json");
    const cfg = JSON.parse(readFileSync(f, "utf-8"));
    cfg.instances.find((i: { name: string }) => i.name === "up").source.remote.overrides = { up: { directories: ["library"] } };
    writeFileSync(f, JSON.stringify(cfg, null, 2));
    const otherBefore = cfg.instances.find((i: { name: string }) => i.name === "other");
    const plan: RepinPlan = { moves: [{ harness: "up", repository: "o/up", from: up.first, to: up.second, rule: rule(), skipped: [], addDirectories: ["scenarios", "tools"] }], held: [], unknown: [] };
    await applyRepin(root, plan, { on: "2026-11-07", mount: false });
    const after = JSON.parse(readFileSync(f, "utf-8"));
    const upEntry = after.instances.find((i: { name: string }) => i.name === "up").source.remote;
    expect(upEntry.ref).toBe(up.second);
    expect(upEntry.overrides).toEqual({ up: { directories: ["library", "scenarios", "tools"] } });
    expect(after.instances.find((i: { name: string }) => i.name === "other")).toEqual(otherBefore);
  });
});

describe("movesSince + applyRepin({ seed: false }): step 4a after the pins already moved (--extend-from)", () => {
  test("only instances whose ref changed AND carry a standing rule are moves", () => {
    const before = { instances: [
      { name: "up", source: { remote: { ref: A } } },
      { name: "still", source: { remote: { ref: B } } },
      { name: "norule", source: { remote: { ref: A } } },
      { name: "local", source: { local: { at: "." } } },
    ] };
    const now = [mount("up", B, rule()), mount("still", B, rule()), mount("norule", C), mount("new", D, rule())];
    expect(movesSince(before, now).map((m) => [m.harness, m.from, m.to])).toEqual([["up", A, B]]);
    expect(movesSince(undefined, now)).toEqual([]);
  });

  test("seed: false writes the added ids and leaves the pin and its consent exactly as they are", async () => {
    const root = site();
    const f = join(root, "index.config.json");
    const cfg = JSON.parse(readFileSync(f, "utf-8"));
    cfg.instances.find((i: { name: string }) => i.name === "up").source.remote.overrides = { up: { directories: ["library"] } };
    writeFileSync(f, JSON.stringify(cfg, null, 2));
    const trustBefore = cfg.instances.find((i: { name: string }) => i.name === "up").source.remote.trust;
    const plan: RepinPlan = { moves: [{ harness: "up", repository: "o/up", from: up.second, to: up.first, rule: rule(), skipped: [], addDirectories: ["scenarios"] }], held: [], unknown: [] };
    await applyRepin(root, plan, { seed: false, mount: false });
    const upEntry = JSON.parse(readFileSync(f, "utf-8")).instances.find((i: { name: string }) => i.name === "up").source.remote;
    expect(upEntry.ref).toBe(up.first);
    expect(upEntry.trust).toEqual(trustBefore);
    expect(upEntry.overrides).toEqual({ up: { directories: ["library", "scenarios"] } });
  });
});

describe("cascadeOf: a site whose directories name kinds this job does not mount (standing re-pin, ig-ast)", () => {
  test("reads only name and needs, so an unregistered kind in the site's declaration does not stop the re-pin", async () => {
    const base = mkdtempSync(join(tmpdir(), "repin-cascade-"));
    try {
      // The site declares a directory of a kind only an unmounted layer registers.
      writeDeclaration(base, {
        name: "site-x",
        needs: ["ig-x"],
        directories: [{ id: "site-x-ast", path: "ast/", graphTypologies: ["ig-ast-unmounted"] }],
      });
      for (const [dir, name, needs] of [["ig", "ig-x", ["harness-x"]], ["harness", "harness-x", ["floor-x"]], ["floor", "floor-x", []]] as const) {
        mkdirSync(join(base, dir), { recursive: true });
        writeDeclaration(join(base, dir), { name, needs });
      }
      // The full read is what failed: it judges every directory's kind.
      expect(() => readDeclaration(base)).toThrow(/unknown graph typology/);
      const c = await cascadeOf(base, join(base, "harness"));
      expect(c.harness).toBe("harness-x");
      expect([...c.below]).toEqual(["floor-x"]);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});

describe("alignToHeldPins never moves a pin backwards (folio-assistant train #3111)", () => {
  const harness = (ref: string) => mount("top", ref, rule({ require: undefined }));
  const lower = (ref: string) => mount("low", ref, rule({ require: undefined }));
  const api = (rel: string | Error): GitHubApi => ({
    ...stubApi({}),
    async lockPinsAt() {
      return { "o/low": B };
    },
    async compareCommits() {
      if (rel instanceof Error) throw rel;
      return rel;
    },
  });
  const cap = { harness: "top", below: new Set(["low"]) };
  const empty: RepinPlan = { moves: [], held: [], unknown: [] };

  test("a held pin OLDER than the current one is held, not moved", async () => {
    const plan = await alignToHeldPins(empty, [harness(A), lower(C)], api("behind"), cap);
    expect(plan.moves).toEqual([]);
    expect(plan.held[0]!.reason).toContain("never moves a pin backwards");
  });

  test("a NEWER held pin moves, as before", async () => {
    const plan = await alignToHeldPins(empty, [harness(A), lower(C)], api("ahead"), cap);
    expect(plan.moves.map((m) => [m.harness, m.from, m.to])).toEqual([["low", C, B]]);
  });

  test("when the order cannot be asked, it is held with the reason, never moved blind", async () => {
    const plan = await alignToHeldPins(empty, [harness(A), lower(C)], api(new Error("HTTP 500")), cap);
    expect(plan.moves).toEqual([]);
    expect(plan.held[0]!.reason).toContain("HTTP 500");
  });
});
