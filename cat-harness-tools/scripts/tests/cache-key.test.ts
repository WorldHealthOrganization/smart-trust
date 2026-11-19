/**
 * `cache:key` / `cache:publish` (`scripts/cache-key.ts`): the derived key of a
 * cached CI step, and a committer's published entry.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashFiles, namespaced, publish, STEPS, treePathOf } from "../cache-key.ts";

const sha = (b: Buffer | string) => createHash("sha256").update(b).digest();

describe("hashFiles", () => {
  test("is the runner's: sha256 over each file's raw sha256, in path order", () => {
    const d = mkdtempSync(join(tmpdir(), "ck-"));
    writeFileSync(join(d, "b"), "B");
    writeFileSync(join(d, "a"), "A");
    const want = createHash("sha256").update(sha("A")).update(sha("B")).digest("hex");
    expect(hashFiles(d, ["b", "a"])).toBe(want);
  });
  test("a missing file, or none, is undetermined — never a constant key", () => {
    const d = mkdtempSync(join(tmpdir(), "ck-"));
    expect(hashFiles(d, ["nope"])).toEqual({ undetermined: "nope is not a file" });
    expect(hashFiles(d, [])).toEqual({ undetermined: "no file to hash" });
  });
});

describe("namespaced", () => {
  test("matches cached-step.sh's cs1-<step>-<key>", () => expect(namespaced("cat-mount", "ab")).toBe("cs1-cat-mount-ab"));
  test("refuses a step id the action refuses", () => expect(() => namespaced("Bad Step", "k")).toThrow());
});

describe("treePathOf", () => {
  test("a checkout path goes under ws/, a home path under home/, anything else is refused", () => {
    expect(treePathOf("/r", "build/x", "/h")).toBe("ws/build/x");
    expect(treePathOf("/r", "~/.cache/cat-mount", "/h")).toBe("home/.cache/cat-mount");
    expect(() => treePathOf("/r", "/etc/passwd", "/h")).toThrow();
  });
});

describe("publish", () => {
  test("--dry-run commits the output as a tree and pushes nothing", () => {
    const d = mkdtempSync(join(tmpdir(), "ck-repo-"));
    Bun.spawnSync(["git", "init", "-q", d]);
    mkdirSync(join(d, "out"));
    writeFileSync(join(d, "out", "f.txt"), "bytes");
    const r = publish(d, "demo", "k1", ["out"], { dryRun: true });
    expect(r.ref).toBe("refs/cache/cs1-demo-k1");
    const ls = Bun.spawnSync(["git", "ls-tree", "-r", "--name-only", r.commit], { cwd: d }).stdout.toString().trim();
    expect(ls).toBe("ws/out/f.txt");
  });
  test("the commit is the same wherever it is published, with no git identity configured", () => {
    // CI runners have no user.name; a cache commit must not need one, and its
    // hash must depend on the output and the key only.
    const saved = { g: process.env.GIT_CONFIG_GLOBAL, s: process.env.GIT_CONFIG_NOSYSTEM };
    process.env.GIT_CONFIG_GLOBAL = "/dev/null";
    process.env.GIT_CONFIG_NOSYSTEM = "1";
    try {
      const commits = [0, 1].map(() => {
        const d = mkdtempSync(join(tmpdir(), "ck-repo-"));
        Bun.spawnSync(["git", "init", "-q", d]);
        mkdirSync(join(d, "out"));
        writeFileSync(join(d, "out", "f.txt"), "bytes");
        return publish(d, "demo", "k1", ["out"], { dryRun: true }).commit;
      });
      expect(commits[0]).toBe(commits[1]);
    } finally {
      if (saved.g === undefined) delete process.env.GIT_CONFIG_GLOBAL; else process.env.GIT_CONFIG_GLOBAL = saved.g;
      if (saved.s === undefined) delete process.env.GIT_CONFIG_NOSYSTEM; else process.env.GIT_CONFIG_NOSYSTEM = saved.s;
    }
  });
  test("an output that was not built is refused", () => {
    const d = mkdtempSync(join(tmpdir(), "ck-repo-"));
    Bun.spawnSync(["git", "init", "-q", d]);
    expect(() => publish(d, "demo", "k", ["absent"], { dryRun: true })).toThrow(/does not exist/);
  });
});

test("every published step derives its key, never from a hand list of inputs", () => {
  for (const [step, s] of Object.entries(STEPS)) {
    expect(() => namespaced(step, "k")).not.toThrow();
    expect("script" in s.key || "hashFiles" in s.key).toBe(true);
    expect(s.paths.length).toBeGreaterThan(0);
  }
});

test("cache:key is the key `gates` records: the same fingerprint, the same io projection, the same baseline", async () => {
  const { keyOf } = await import("../cache-key.ts");
  const { GateSkipper } = await import("../gates.ts");
  const { FileDigests, qaBaselineIdentity } = await import("../input-hash.ts");
  const { TASK_IO } = await import("../task-io.ts");
  const { scriptsOf } = await import("../../schemas/sdlc/script-table.ts");
  const { checkoutRootFor } = await import("../../schemas/kg/cat-harness.ts");
  const { HARNESS_ROOT } = await import("../lib/roots.ts");
  const root = checkoutRootFor(HARNESS_ROOT);
  const skipper = new GateSkipper(root, scriptsOf(root), undefined, qaBaselineIdentity({ repoRoot: root }));
  const sample = Object.keys(TASK_IO).filter((s) => TASK_IO[s]?.inputs !== undefined).sort().slice(0, 5);
  expect(sample.length).toBeGreaterThan(0);
  for (const s of sample) {
    const fp = skipper.fingerprint(s, new FileDigests(root));
    const k = keyOf(root, { script: s });
    expect(typeof k === "string" ? k : "undetermined").toBe("hash" in fp ? fp.hash : "undetermined");
  }
}, 120_000);
