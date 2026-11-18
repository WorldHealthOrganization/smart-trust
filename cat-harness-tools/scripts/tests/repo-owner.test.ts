/**
 * Same-owner repository names and the derived checkout owner (WHO migration
 * plan T3, cat-harness-tools#2337): the same commit of a content layer must
 * resolve its sibling layers under whichever owner builds it.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  checkoutOwner,
  HARNESS_OWNER,
  HARNESS_ADDRESSES,
  isHarnessRepository,
  isSameOwnerName,
  ownerFromUrl,
  readLockFile,
  relativizeLockRepositories,
  resolveLockJson,
  resolveLockRepositories,
  resolveRepository,
} from "../../schemas/kg/repo-owner.ts";
import { onDiskMount, readDeclaredMounts, resolveSameOwner, writeDeclaredMounts } from "../../schemas/kg/index-config.ts";
import { lockOwner, readLocks } from "../mount-from-lock.ts";
import { convertSameOwner, planSameOwner } from "../mount-same-owner.ts";
import { computeIriBase, readPublishingProfile, stagingSiteFor } from "../../schemas/kg/publishing-profile.ts";
import { iriBaseDrift, syncIriBase } from "../iri-base-sync.ts";
import { lockedInstances } from "../../.github/scripts/layer-publish-context/needs-at-main.ts";

const SHA = "a".repeat(40);
const SHA2 = "b".repeat(40);
let dir: string;
const saved: Record<string, string | undefined> = {};

function git(cwd: string, ...args: string[]): void {
  const r = spawnSync("git", args, { cwd, encoding: "utf-8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
}

/** A checkout whose origin is `https://github.com/<owner>/<repo>`. */
function checkout(owner: string, repo = "smart-x"): string {
  // input-site: inert #8770925d — a unique scratch directory name, removed after the test
  const root = join(dir, `${owner}-${repo}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(root, { recursive: true });
  git(root, "init", "-q", "-b", "main");
  git(root, "remote", "add", "origin", `https://github.com/${owner}/${repo}.git`);
  return root;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "repo-owner-test-"));
  for (const k of ["CAT_REPO_OWNER", "GITHUB_REPOSITORY_OWNER"]) {
    // input-site: inert #88936f3f — saves the environment to restore it after the test
    saved[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("names", () => {
  test("a bare name is same-owner; owner/name is not", () => {
    expect(isSameOwnerName("smart-base")).toBe(true);
    expect(isSameOwnerName("litlfred/smart-base")).toBe(false);
    expect(isSameOwnerName("https://github.com/o/r")).toBe(false);
    expect(isSameOwnerName("a..b")).toBe(false);
  });

  test("resolution takes the owner, and refuses to guess one", () => {
    expect(resolveRepository("smart-base", "WorldHealthOrganization")).toBe("WorldHealthOrganization/smart-base");
    expect(resolveRepository("litlfred/smart-base", "WorldHealthOrganization")).toBe("litlfred/smart-base");
    expect(() => resolveRepository("smart-base", undefined)).toThrow(/owner is unknown/);
  });

  test("owners are read from https, ssh and proxy URLs", () => {
    expect(ownerFromUrl("https://github.com/litlfred/smart-base.git")).toBe("litlfred");
    expect(ownerFromUrl("git@github.com:WorldHealthOrganization/smart-base.git")).toBe("WorldHealthOrganization");
    expect(ownerFromUrl("http://local_proxy@127.0.0.1:1234/git/litlfred/smart-base")).toBe("litlfred");
  });

  test("harness layers are known, content layers are not", () => {
    expect(HARNESS_OWNER).toBe("litlfred");
    // every harness address moves with HARNESS_OWNER
    for (const url of HARNESS_ADDRESSES) expect(ownerFromUrl(url)).toBe(HARNESS_OWNER);
    expect(isHarnessRepository("litlfred/cat-harness-tools")).toBe(true);
    expect(isHarnessRepository("fhir-harness")).toBe(true);
    expect(isHarnessRepository("litlfred/smart-base")).toBe(false);
  });
});

describe("the checkout's owner is derived", () => {
  test("origin first, then GITHUB_REPOSITORY_OWNER; CAT_REPO_OWNER overrides both", () => {
    const fork = checkout("litlfred");
    expect(checkoutOwner(fork, {})).toBe("litlfred");
    const bare = join(dir, "no-git");
    mkdirSync(bare);
    expect(checkoutOwner(bare, {})).toBeUndefined();
    expect(checkoutOwner(bare, { GITHUB_REPOSITORY_OWNER: "WorldHealthOrganization" })).toBe("WorldHealthOrganization");
    expect(checkoutOwner(fork, { CAT_REPO_OWNER: "WorldHealthOrganization" })).toBe("WorldHealthOrganization");
  });
});

describe("locks", () => {
  const lock = {
    $schema: "cat-harness-mount-lock/v1",
    mounts: [
      { harness: "smart-base", repository: "smart-base", ref: SHA },
      { harness: "cat-harness-tools", repository: "litlfred/cat-harness-tools", ref: SHA2 },
    ],
    instances: [
      { instance: "smart-base", repository: "smart-base", sha: SHA },
      { instance: "cat-harness-tools", repository: "litlfred/cat-harness-tools", sha: SHA2 },
    ],
  };

  test("resolve and relativize are inverse, and leave absolute names alone", () => {
    const who = resolveLockRepositories(lock, "WorldHealthOrganization");
    expect(who.mounts.map((m) => m.repository)).toEqual(["WorldHealthOrganization/smart-base", "litlfred/cat-harness-tools"]);
    expect(who.instances[0]!.repository).toBe("WorldHealthOrganization/smart-base");
    expect(relativizeLockRepositories(who, ["worldhealthorganization/smart-base"])).toEqual(lock);
    expect(lock.mounts[0]!.repository).toBe("smart-base");
  });

  test("the same lock file resolves to the fork in the fork and to WHO in WHO", () => {
    for (const owner of ["litlfred", "WorldHealthOrganization"]) {
      const root = checkout(owner);
      writeFileSync(join(root, "index.lock.json"), JSON.stringify(lock));
      expect(readLockFile<typeof lock>(join(root, "index.lock.json")).mounts[0]!.repository).toBe(`${owner}/smart-base`);
      expect(lockedInstances(root).get("smart-base")!.repository).toBe(`${owner}/smart-base`);
      expect(lockOwner(root)).toBe(owner);
    }
  });

  test("a lock with no same-owner name never asks for an owner", () => {
    const abs = resolveLockRepositories(lock, "litlfred");
    let asked = false;
    expect(resolveLockJson(abs, () => ((asked = true), "x"))).toBe(abs);
    expect(asked).toBe(false);
  });

  test("the node-only replayer resolves same-owner entries, and refuses without an owner", () => {
    const full = {
      $schema: "cat-harness-mount-lock/v1",
      instances: [{ instance: "smart-base", repository: "smart-base", sha: SHA, path: "smart-base", directories: [] }],
    };
    const root = checkout("WorldHealthOrganization");
    writeFileSync(join(root, "index.lock.json"), JSON.stringify(full));
    expect(readLocks(root)[0]!.instances![0]!.repository).toBe("WorldHealthOrganization/smart-base");
    const orphan = join(dir, "orphan");
    mkdirSync(orphan);
    writeFileSync(join(orphan, "index.lock.json"), JSON.stringify(full));
    expect(readLocks(orphan)[0]!.error).toMatch(/owner is unknown/);
  });
});

describe("declared mounts", () => {
  function indexAt(root: string, repository: string): void {
    writeFileSync(
      join(root, "index.config.json"),
      JSON.stringify({
        $schema: "folio-index-config/v1",
        instances: [
          { name: "smart-base", source: { remote: { repository, ref: SHA } } },
          { name: "cat-harness-tools", source: { remote: { repository: "litlfred/cat-harness-tools", ref: SHA2 } } },
          { name: "smart-ra", source: { remote: { repository: "other/smart-ra", ref: SHA2 } } },
        ],
      }),
    );
  }

  test("a bare repository reads as owner/name marked sameOwner, and writes back bare", () => {
    const root = checkout("WorldHealthOrganization");
    indexAt(root, "smart-base");
    const mounts = readDeclaredMounts(root).mounts;
    expect(mounts.find((m) => m.harness === "smart-base")).toMatchObject({ repository: "WorldHealthOrganization/smart-base", sameOwner: true });
    expect(mounts.find((m) => m.harness === "cat-harness-tools")!.sameOwner).toBeUndefined();
    expect(onDiskMount(mounts.find((m) => m.harness === "smart-base")!)).toEqual({ harness: "smart-base", repository: "smart-base", ref: SHA });
    writeDeclaredMounts(root, mounts);
    const back = JSON.parse(readFileSync(join(root, "index.config.json"), "utf-8"));
    const entry = (back.layers ?? back.instances).find((l: { name: string }) => l.name === "smart-base");
    expect(entry.source.remote).toEqual({ repository: "smart-base", ref: SHA });
  });

  test("`sameOwner: true` beside an owner-qualified name is read as same-owner too", () => {
    const root = checkout("WorldHealthOrganization");
    expect(resolveSameOwner(root, [{ harness: "smart-base", repository: "litlfred/smart-base", ref: SHA, sameOwner: true }])[0]!.repository).toBe(
      "WorldHealthOrganization/smart-base",
    );
  });

  test("mount:same-owner converts content layers of this owner only, and moves no pin", () => {
    const root = checkout("litlfred");
    indexAt(root, "litlfred/smart-base");
    writeFileSync(
      join(root, "index.lock.json"),
      JSON.stringify({
        $schema: "cat-harness-mount-lock/v1",
        mounts: [{ harness: "smart-base", repository: "litlfred/smart-base", ref: SHA }],
        instances: [{ instance: "smart-base", repository: "litlfred/smart-base", sha: SHA }],
      }),
    );
    const plan = planSameOwner(root);
    expect(plan.convert).toEqual(["smart-base = litlfred/smart-base"]);
    expect(plan.kept.map((k) => k.harness).sort()).toEqual(["cat-harness-tools", "smart-ra"]);
    expect(planSameOwner(root, ["smart-base"]).convert).toEqual([]);

    const r = convertSameOwner(root);
    expect(r.lockChanged).toBe(true);
    const lock = JSON.parse(readFileSync(join(root, "index.lock.json"), "utf-8"));
    expect(lock.mounts[0]).toEqual({ harness: "smart-base", repository: "smart-base", ref: SHA });
    expect(lock.instances[0].repository).toBe("smart-base");
    expect(readDeclaredMounts(root).mounts.find((m) => m.harness === "smart-base")).toMatchObject({ repository: "litlfred/smart-base", ref: SHA, sameOwner: true });
    // idempotent
    expect(planSameOwner(root).convert).toEqual([]);
    // a harness checkout is never converted
    const fa = checkout("litlfred", "folio-assistant");
    indexAt(fa, "litlfred/smart-base");
    expect(() => planSameOwner(fa)).toThrow(/harness repository/);
  });
});

describe("publishing profile and iriBase", () => {
  const profile = { stagingRoot: "https://{owner}.github.io", iriRoot: "https://worldhealthorganization.github.io", publishedRoot: "https://smart.who.int" };

  test("staged IRIs are the same for every owner; the staging site is the owner's", () => {
    expect(computeIriBase(profile, { id: "base", stage: "staging" }, "smart-base")).toBe("https://worldhealthorganization.github.io/smart-base/");
    expect(computeIriBase(profile, { id: "base", stage: "published" }, "smart-base")).toBe("https://smart.who.int/base/");
    expect(stagingSiteFor(profile, "WorldHealthOrganization", "smart-base")).toBe("https://worldhealthorganization.github.io/smart-base/");
    expect(stagingSiteFor(profile, "litlfred", "smart-base")).toBe("https://litlfred.github.io/smart-base/");
  });

  test("a profile with {owner} in a fixed root is refused", () => {
    const f = join(dir, "bad.json");
    writeFileSync(f, JSON.stringify({ ...profile, iriRoot: "https://{owner}.github.io" }));
    expect(() => readPublishingProfile(f)).toThrow(/fixed/);
  });

  test("iri-base:check finds drift and iri-base:sync rewrites only the iriBase line", () => {
    const root = checkout("litlfred", "smart-x");
    mkdirSync(join(root, "smart-x"));
    mkdirSync(join(root, "profile"));
    writeFileSync(join(root, "profile/publishing.json"), JSON.stringify(profile));
    const decl = '{\n  "name": "smart-x",\n  "iriBase": "https://litlfred.github.io/smart-x/",\n  "directories": []\n}\n';
    writeFileSync(join(root, "smart-x/smart-x.json"), decl);
    writeFileSync(
      join(root, "index.config.json"),
      JSON.stringify({
        $schema: "folio-index-config/v1",
        layers: [{ name: "smart-x", source: { local: { at: "smart-x" } }, publish: { id: "x", stage: "staging", profile: "profile/publishing.json" } }],
        harnesses: [{ name: "smart-x" }],
      }),
    );
    const d = iriBaseDrift(root);
    expect(d.problems).toEqual([]);
    expect(d.findings).toEqual([
      { layer: "smart-x", file: join(root, "smart-x/smart-x.json"), have: "https://litlfred.github.io/smart-x/", want: "https://worldhealthorganization.github.io/smart-x/" },
    ]);
    syncIriBase(root);
    expect(readFileSync(join(root, "smart-x/smart-x.json"), "utf-8")).toBe(decl.replace("litlfred.github.io", "worldhealthorganization.github.io"));
    expect(iriBaseDrift(root).findings).toEqual([]);
  });
});
