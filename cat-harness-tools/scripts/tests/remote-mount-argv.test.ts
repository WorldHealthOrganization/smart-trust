/**
 * `mount:remote`'s arguments are checked before it does anything.
 *
 * Observed 2026-10-20: `bun run cat mount:remote --help` was not a flag, so it
 * was ignored and the command ran a full mount; and `mount:remote --plan`
 * without `--instance` fell through to the fan-out, which fetched, mounted and
 * wrote the lock although the header documents `--plan` as "write nothing".
 * Now `--help`/`-h` prints the header and exits 0, an unknown flag exits 2
 * having run nothing, and the fan-out honours `--plan`.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { INDEX_CONFIG_SCHEMA } from "../../schemas/kg/index-config.ts";
import { argvProblems, MOUNT_REMOTE_FLAGS, remoteFanOut, usageText } from "../remote-mount.ts";

const SCRIPT = join(import.meta.dir, "..", "remote-mount.ts");

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
beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "remote-mount-argv-"));
});
afterAll(() => rmSync(base, { recursive: true, force: true }));

describe("argvProblems", () => {
  test("known switches and valued flags pass", () => {
    expect(argvProblems([])).toEqual([]);
    expect(argvProblems(["--plan"])).toEqual([]);
    expect(argvProblems(["--instance", "x", "--check", "--json"])).toEqual([]);
    expect(argvProblems(["--seed", "a=o/r@" + "0".repeat(40), "--consent-by", "me", "--whole"])).toEqual([]);
  });

  test("an unknown flag or a stray argument is a problem", () => {
    expect(argvProblems(["--dry-run"])).toEqual(["unknown flag --dry-run"]);
    expect(argvProblems(["oops"])).toEqual(["unexpected argument oops"]);
  });

  test("a valued flag with no value is a problem, and does not swallow the next flag", () => {
    expect(argvProblems(["--instance"])).toEqual(["--instance needs a value"]);
    expect(argvProblems(["--instance", "--check"])).toEqual(["--instance needs a value"]);
  });

  test("every flag the usage text documents is known", () => {
    const documented = new Set([...usageText().matchAll(/(?<![\w-])(--[a-z][a-z-]*)/g)].map((m) => m[1]!));
    // Quoted from other commands' lines in the header: mount:repin:standing's
    // `--dry-run` and the `bun install --no-save --omit dev` each mount gets.
    const quoted = new Set(["--dry-run", "--no-save", "--omit"]);
    expect([...documented].filter((f) => !quoted.has(f) && !MOUNT_REMOTE_FLAGS.has(f))).toEqual([]);
  });
});

describe("the command line", () => {
  const run = (cwd: string, ...args: string[]) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: "utf-8" });

  test("--help and -h print the usage, exit 0 and write nothing", () => {
    const dir = join(base, "help");
    mkdirSync(dir);
    for (const flag of ["--help", "-h"]) {
      const r = run(dir, flag);
      expect(r.status).toBe(0);
      expect(r.stdout).toContain("bun run cat mount:remote --plan");
    }
    expect(existsSync(join(dir, "index.lock.json"))).toBe(false);
  });

  test("an unknown flag exits 2 and runs nothing", () => {
    const dir = join(base, "unknown");
    mkdirSync(dir);
    const r = run(dir, "--dry-run");
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("unknown flag --dry-run");
    expect(r.stderr).toContain("nothing was run");
    expect(existsSync(join(dir, "index.lock.json"))).toBe(false);
  });
});

describe("the fan-out honours --plan", () => {
  test("a plan resolves the closure, mounts nothing and writes no lock", () => {
    const work = join(base, "lib-work");
    mkdirSync(work, { recursive: true });
    git(work, "init", "-q", "-b", "main");
    write(work, { "lib.json": { name: "lib", directories: [{ id: "lib-schemas", path: "schemas/", graphTypologies: ["code"] }] }, "schemas/a.ts": "export const a = 1;\n" });
    git(work, "add", "-A");
    git(work, "commit", "-q", "-m", "fixture");
    const sha = git(work, "rev-parse", "HEAD");
    const bare = join(base, "lib.git");
    git(base, "clone", "-q", "--bare", work, bare);
    git(bare, "config", "uploadpack.allowFilter", "true");
    git(bare, "config", "uploadpack.allowAnySHA1InWant", "true");

    const root = join(base, "down");
    mkdirSync(root);
    git(root, "init", "-q", "-b", "main");
    write(root, {
      "down.json": { name: "down", directories: [], mountApprovers: ["test"] },
      "index.config.json": {
        $schema: INDEX_CONFIG_SCHEMA,
        instances: [
          { name: "down", source: { local: { at: "." } } },
          { name: "lib", source: { remote: { repository: "o/lib", ref: sha, overrides: { lib: { whole: true } }, trust: { consent: { by: "test", on: "2026-10-20", ref: sha, evidence: "remote-mount-argv.test.ts" } } } } },
        ],
      },
    });
    const urlFor = (r: string) => {
      if (r !== "o/lib") throw new Error(`no fixture for ${r}`);
      return `file://${bare}`;
    };

    const plan = remoteFanOut(root, { plan: true, urlFor });
    expect(plan.state).toBe("mounted");
    expect(plan.text).toContain("plan for");
    expect(existsSync(join(root, "index.lock.json"))).toBe(false);
    expect(existsSync(join(root, "lib"))).toBe(false);

    // The same call without `plan` is the one that writes.
    expect(remoteFanOut(root, { urlFor }).state).toBe("mounted");
    expect(existsSync(join(root, "index.lock.json"))).toBe(true);
    expect(existsSync(join(root, "lib/schemas/a.ts"))).toBe(true);
  });
});
