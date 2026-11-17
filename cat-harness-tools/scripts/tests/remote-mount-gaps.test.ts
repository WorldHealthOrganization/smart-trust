/**
 * Three mount gaps observed 2026-10-12 (task #10), against FIXTURE
 * REPOSITORIES served over `file://` like `remote-mount.test.ts`:
 *
 * (a) was the transitional `content/pipeline` link being declared, so a mount
 *     laid it down. The link is gone (bean `rnfl`, last step), and so is (a).
 * (b) A mounted layer with a `package.json` gets its dependencies installed,
 *     its code then RUNS, and `--check` still passes: `node_modules/` is not a
 *     pinned byte and the lockfile is left as it was.
 * (c) Seeding a remote layer writes its `trust.consent` for that pin.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { INDEX_CONFIG_SCHEMA, readDeclaredMounts } from "../../schemas/kg/index-config.ts";
import { MountLockSchema } from "../../schemas/kg/remote-mount.ts";
import { checkRemote, chooseRemote, mountRemote, parseChoose, parseSeed, seedRemote } from "../remote-mount.ts";
import { enclosingWorkspaceRoot, installDependencies, isInstallArtefact, run as replayLocks } from "../mount-from-lock.ts";

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

function bareRepo(base: string, name: string, files: Record<string, string | object>): { bare: string; sha: string } {
  const work = join(base, `${name}-work`);
  mkdirSync(work, { recursive: true });
  git(work, "init", "-q", "-b", "main");
  write(work, files);
  git(work, "add", "-A", "-f");
  git(work, "commit", "-q", "-m", "fixture");
  const sha = git(work, "rev-parse", "HEAD");
  const bare = join(base, `${name}.git`);
  git(base, "clone", "-q", "--bare", work, bare);
  git(bare, "config", "uploadpack.allowFilter", "true");
  git(bare, "config", "uploadpack.allowAnySHA1InWant", "true");
  return { bare, sha };
}

const decl = (name: string, extra: object = {}): object => ({ name, directories: [], ...extra });
const consentFor = (ref: string) => ({ trust: { consent: { by: "test", on: "2026-10-12", ref, evidence: "remote-mount-gaps.test.ts" } } });

let base: string;
let lib: { bare: string; sha: string };
let tool: { bare: string; sha: string };
let tracksArtefacts: { bare: string; sha: string };
let urlFor: (r: string) => string;

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "remote-mount-gaps-"));
  // `lib` is a package a sibling mount resolves through its workspaces, the
  // shape `cat-harness-tools` has with `../cat-harnes[s]`.
  lib = bareRepo(base, "lib", {
    "lib.json": decl("lib", { directories: [{ id: "lib-schemas", path: "schemas/", graphTypologies: ["code"] }] }),
    "package.json": { name: "@t/lib", version: "0.1.0", type: "module" },
    "schemas/answer.ts": "export const answer = 42;\n",
  });
  tool = bareRepo(base, "tool", {
    "tool.json": decl("tool", { directories: [{ id: "tool-scripts", path: "scripts/", graphTypologies: ["code"] }] }),
    "package.json": { name: "@t/tool", version: "0.1.0", type: "module", workspaces: ["../li[b]"], dependencies: { "@t/lib": "0.1.0" } },
    "scripts/run.ts": 'import { answer } from "@t/lib/schemas/answer.ts";\nconsole.log(String(answer * 2));\n',
  });
  tracksArtefacts = bareRepo(base, "bad", {
    "bad.json": decl("bad"),
    "node_modules/x/index.js": "module.exports = 1;\n",
  });
  const map: Record<string, string> = { "o/lib": `file://${lib.bare}`, "o/tool": `file://${tool.bare}`, "o/bad": `file://${tracksArtefacts.bare}` };
  urlFor = (r) => {
    const u = map[r];
    if (!u) throw new Error(`no fixture for ${r}`);
    return u;
  };
});

afterAll(() => rmSync(base, { recursive: true, force: true }));

let n = 0;
function indexed(entries: Array<{ name: string; repository: string; ref: string; consent?: boolean }>): string {
  const root = join(base, `down-${++n}`);
  mkdirSync(root, { recursive: true });
  git(root, "init", "-q", "-b", "main");
  write(root, {
    "down.json": decl("down", { mountApprovers: ["test"] }),
    "index.config.json": {
      $schema: INDEX_CONFIG_SCHEMA,
      instances: [
        { name: "down", source: { local: { at: "." } } },
        ...entries.map((e) => ({
          name: e.name,
          source: { remote: { repository: e.repository, ref: e.ref, overrides: { [e.name]: { whole: true } }, ...(e.consent === false ? {} : consentFor(e.ref)) } },
        })),
      ],
    },
  });
  return root;
}
const both = () => [
  { name: "lib", repository: "o/lib", ref: lib.sha },
  { name: "tool", repository: "o/tool", ref: tool.sha },
];
const states = (outcomes: Array<{ instance: string; state: string }>) => Object.fromEntries(outcomes.map((o) => [o.instance, o.state]));

describe("(b) a mounted layer is runnable, and the install does not make it modified", () => {
  test("after mounting, the mounted tool runs: its workspace package resolves through node_modules", () => {
    const root = indexed(both());
    const r = mountRemote({ instanceRoot: root, urlFor });
    expect(states(r.plan.outcomes)).toEqual({ lib: "mounted", tool: "mounted" });
    expect(existsSync(join(root, "tool/node_modules/@t/lib"))).toBe(true);
    const ran = spawnSync(process.execPath, [join(root, "tool/scripts/run.ts")], { encoding: "utf-8" });
    expect(ran.stderr).toBe("");
    expect(ran.stdout.trim()).toBe("84");
  });

  test("--check still passes over the installed mount, and a re-mount does not refuse it", () => {
    const root = indexed(both());
    mountRemote({ instanceRoot: root, urlFor });
    expect(existsSync(join(root, "tool/node_modules"))).toBe(true);
    expect(checkRemote({ instanceRoot: root }).state).toBe("mounted");
    const again = mountRemote({ instanceRoot: root, urlFor });
    expect(states(again.plan.outcomes)).toEqual({ lib: "mounted", tool: "mounted" });
    expect(checkRemote({ instanceRoot: root }).state).toBe("mounted");
  });

  test("the install writes no lockfile and the lock's digests are the ones a bytes-only mount writes", () => {
    const bytesOnly = indexed(both());
    mountRemote({ instanceRoot: bytesOnly, urlFor, install: false });
    expect(existsSync(join(bytesOnly, "tool/node_modules"))).toBe(false);
    const installed = indexed(both());
    mountRemote({ instanceRoot: installed, urlFor });
    expect(existsSync(join(installed, "tool/bun.lock"))).toBe(false);
    const digests = (root: string) => MountLockSchema.parse(JSON.parse(readFileSync(join(root, "index.lock.json"), "utf-8"))).instances.map((i) => i.directories.map((d) => d.treeDigest));
    expect(digests(installed)).toEqual(digests(bytesOnly));
  });

  test("an edit OUTSIDE node_modules still reads modified — the exclusion is that directory only", () => {
    const root = indexed(both());
    mountRemote({ instanceRoot: root, urlFor });
    writeFileSync(join(root, "tool/scripts/run.ts"), "console.log('edited');\n");
    const c = checkRemote({ instanceRoot: root });
    expect(c.state).toBe("missing");
    expect(c.outcomes.find((o) => o.instance === "tool")?.detail).toContain("modified");
  });

  test("an upstream that TRACKS node_modules/ is refused, never locked with bytes no check would see", () => {
    const root = indexed([{ name: "bad", repository: "o/bad", ref: tracksArtefacts.sha }]);
    const r = mountRemote({ instanceRoot: root, urlFor });
    const bad = r.plan.outcomes.find((o) => o.instance === "bad")!;
    expect(bad.state).toBe("could-not-determine");
    expect(bad.detail).toContain("node_modules");
  });

  test("replaying the lock (mount:lock) installs too, and its --check reads current", () => {
    const first = indexed(both());
    mountRemote({ instanceRoot: first, urlFor, install: false });
    const fresh = join(base, `replay-${++n}`);
    mkdirSync(fresh, { recursive: true });
    git(fresh, "init", "-q", "-b", "main");
    copyFileSync(join(first, "index.lock.json"), join(fresh, "index.lock.json"));
    const prefix = process.env.CAT_MOUNT_URL_PREFIX;
    process.env.CAT_MOUNT_URL_PREFIX = `file://${base}`;
    try {
      // `o/lib` → file://<base>/o/lib: serve the fixtures at that layout.
      mkdirSync(join(base, "o"), { recursive: true });
      for (const [name, repo] of [["lib", lib], ["tool", tool]] as const) if (!existsSync(join(base, "o", name))) git(base, "clone", "-q", "--bare", repo.bare, join(base, "o", name));
      for (const name of ["lib", "tool"]) {
        git(join(base, "o", name), "config", "uploadpack.allowFilter", "true");
        git(join(base, "o", name), "config", "uploadpack.allowAnySHA1InWant", "true");
      }
      const r = replayLocks(fresh, false);
      expect(r.outcomes.map((o) => o.state)).toEqual(["mounted", "mounted"]);
      expect(existsSync(join(fresh, "tool/node_modules/@t/lib"))).toBe(true);
      expect(replayLocks(fresh, true).outcomes.map((o) => o.state)).toEqual(["current", "current"]);
    } finally {
      if (prefix === undefined) delete process.env.CAT_MOUNT_URL_PREFIX;
      else process.env.CAT_MOUNT_URL_PREFIX = prefix;
    }
  });

  test("installDependencies: a lockfile behind its package.json still installs, and is put back", () => {
    // bun's `--production` implies `--frozen-lockfile`, which refused exactly
    // this and left a mount's tools without dependencies (smart-ra#48).
    const dir = mkdtempSync(join(base, "stale-"));
    const stale = '{\n  "lockfileVersion": 1,\n  "workspaces": {\n    "": {\n      "name": "@t/old",\n    },\n  },\n  "packages": {},\n}\n';
    write(dir, { "package.json": { name: "@t/x", version: "0.1.0" }, "bun.lock": stale });
    expect(installDependencies(dir).state).toBe("installed");
    expect(readFileSync(join(dir, "bun.lock"), "utf-8")).toBe(stale);
  });

  test("installDependencies: no manifest is nothing; a lockfile the install touched is put back byte-for-byte", () => {
    const dir = mkdtempSync(join(base, "inst-"));
    expect(installDependencies(dir).state).toBe("none");
    write(dir, { "package.json": { name: "@t/x", version: "0.1.0" }, "bun.lock": "PINNED\n" });
    installDependencies(dir);
    expect(readFileSync(join(dir, "bun.lock"), "utf-8")).toBe("PINNED\n");
    expect(isInstallArtefact("node_modules/a.js")).toBe(true);
    expect(isInstallArtefact("x/node_modules/a.js")).toBe(true);
    expect(isInstallArtefact("scripts/node_modules.ts")).toBe(false);
  });

  test("installDependencies: a workspace member of the root is left to the root's install (folio-assistant#2529, ajv)", () => {
    // Installing from inside a member rewrote the ROOT node_modules with
    // `--omit dev`, re-hoisting ajv@8 over eslint's ajv@6 and failing lint.
    const root = mkdtempSync(join(base, "ws-"));
    write(root, {
      "package.json": { name: "@t/root", private: true, workspaces: ["inst", "pkgs/*"] },
      "inst/package.json": { name: "@t/inst", version: "0.1.0" },
      "pkgs/a/package.json": { name: "@t/a", version: "0.1.0" },
      "other/package.json": { name: "@t/other", version: "0.1.0" },
      "pkgs/a/deep/package.json": { name: "@t/deep", version: "0.1.0" },
    });
    expect(enclosingWorkspaceRoot(join(root, "inst"))).toBe(root);
    expect(enclosingWorkspaceRoot(join(root, "pkgs", "a"))).toBe(root);
    expect(enclosingWorkspaceRoot(join(root, "other"))).toBeUndefined();
    expect(enclosingWorkspaceRoot(join(root, "pkgs", "a", "deep"))).toBeUndefined();
    const r = installDependencies(join(root, "inst"));
    expect(r.state).toBe("none");
    expect(r.detail).toContain("workspace member");
    expect(existsSync(join(root, "node_modules"))).toBe(false);
  });
});

describe("(c) seeding a remote instance writes its consent", () => {
  const grant = { by: "test", evidence: "owner, session X: 'repin as needed'", on: "2026-10-12" };

  test("a new remote instance is written WITH trust.consent bound to its pin, and then mounts", () => {
    const root = indexed([]);
    seedRemote(root, [{ ...parseSeed(`lib=o/lib@${lib.sha}`), whole: true }], grant);
    const m = readDeclaredMounts(root).mounts.find((x) => x.harness === "lib")!;
    expect(m.trust?.consent).toEqual({ by: "test", on: "2026-10-12", ref: lib.sha, evidence: grant.evidence });
    expect(m.overrides?.lib?.whole).toBe(true);
    expect(states(mountRemote({ instanceRoot: root, urlFor, install: false }).plan.outcomes)).toEqual({ lib: "mounted" });
  });

  test("a re-pin moves the consent with the pin and keeps the entry's overrides", () => {
    const root = indexed([{ name: "lib", repository: "o/lib", ref: "b".repeat(40), consent: true }]);
    seedRemote(root, [parseSeed(`lib=o/lib@${lib.sha}`)], grant);
    const m = readDeclaredMounts(root).mounts.find((x) => x.harness === "lib")!;
    expect(m.ref).toBe(lib.sha);
    expect(m.trust?.consent?.ref).toBe(lib.sha);
    expect(m.trust?.consent?.evidence).toBe(grant.evidence);
    expect(m.overrides?.lib?.whole).toBe(true);
  });

  test("a re-pin over edited mounts is refused, unless --fresh will replace them (folio-assistant#2682)", () => {
    const root = indexed([]);
    seedRemote(root, [{ ...parseSeed(`lib=o/lib@${lib.sha}`), whole: true }], grant);
    mountRemote({ instanceRoot: root, urlFor, install: false });
    const lockPath = (p: string) => join(root, p);
    const lockText = readFileSync(join(root, "index.lock.json"), "utf-8");
    const mounted = JSON.parse(lockText).instances.find((i: { instance: string }) => i.instance === "lib");
    writeFileSync(lockPath(join(mounted.path, "schemas/answer.ts")), "export const answer = 41;\n");
    const before = readFileSync(join(root, "index.config.json"), "utf-8");
    const moved = parseSeed(`lib=o/lib@${"c".repeat(40)}`);
    expect(() => seedRemote(root, [moved], grant)).toThrow(/edits the lock does not hold.*lib/);
    expect(readFileSync(join(root, "index.config.json"), "utf-8")).toBe(before);
    seedRemote(root, [moved], grant, { discardEdits: true });
    expect(readDeclaredMounts(root).mounts.find((x) => x.harness === "lib")!.ref).toBe("c".repeat(40));
  });

  test("a review's choice is written back to the mount entry, keeping the pin and consent (bean mo75)", () => {
    const root = indexed([]);
    seedRemote(root, [parseSeed(`lib=o/lib@${lib.sha}`)], grant);
    const before = readDeclaredMounts(root).mounts.find((x) => x.harness === "lib")!;
    chooseRemote(root, { ...parseChoose("lib"), directories: ["lib-schemas", "lib-schemas"] });
    const m = readDeclaredMounts(root).mounts.find((x) => x.harness === "lib")!;
    expect(m.overrides?.lib).toEqual({ directories: ["lib-schemas"] });
    expect(m.ref).toBe(before.ref);
    expect(m.trust).toEqual(before.trust);
    expect(states(mountRemote({ instanceRoot: root, urlFor, install: false }).plan.outcomes)).toEqual({ lib: "mounted" });
    expect(parseChoose("a:b")).toEqual({ harness: "a", instance: "b" });
    expect(() => chooseRemote(root, { harness: "lib" })).toThrow(/a choice of nothing/);
    expect(() => chooseRemote(root, { harness: "nope", directories: ["x"] })).toThrow(/no mount entry/);
  });

  test("a seed spec must be <name>=<owner/repo>@<40-char sha>, and an empty grant writes nothing", () => {
    expect(() => parseSeed("lib=o/lib@main")).toThrow(/40-character/);
    const root = indexed([]);
    const before = readFileSync(join(root, "index.config.json"), "utf-8");
    expect(() => seedRemote(root, [parseSeed(`lib=o/lib@${lib.sha}`)], { by: "test", evidence: "" })).toThrow();
    expect(readFileSync(join(root, "index.config.json"), "utf-8")).toBe(before);
  });
});
