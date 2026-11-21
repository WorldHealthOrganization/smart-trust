/**
 * The suite default reaches every test file, not only the first (Q-TMO-1).
 *
 * Writes two test files, each with one 5.3 s test, and runs `bun test` on
 * them under this repository's own preload. Without the loader hook the
 * second file was back at bun's 5 s default and failed; both must pass. The
 * files are written to a temporary directory, so the suite never runs them
 * itself.
 */
import { afterAll, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "suite-timeout-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

test("a second test file gets the suite default too", () => {
  for (const name of ["one", "two"]) {
    writeFileSync(
      join(dir, `${name}.test.ts`),
      `import { test } from "bun:test";\ntest("${name}", async () => { await Bun.sleep(5_300); });\n`,
    );
  }
  const r = spawnSync("bun", ["test", "--preload", join(import.meta.dir, "test-preload.ts"), "./one.test.ts", "./two.test.ts"], {
    cwd: dir,
    encoding: "utf-8",
    // CI shards the suite through `BUN_OPTIONS` (`--shard=k/4`, which Bun
    // prepends to every invocation), and a child inherits it: this run of two
    // files would then be sharded too and run a quarter of them. The child is
    // its own suite, so it runs unsharded.
    env: { ...process.env, BUN_OPTIONS: (process.env.BUN_OPTIONS ?? "").replace(/--shard(=|\s+)\S+/g, "").trim() },
  });
  const out = `${r.stdout}${r.stderr}`;
  expect(out, out).not.toContain("timed out");
  expect(out).toMatch(/\b2 pass\b/);
}, 60_000);
