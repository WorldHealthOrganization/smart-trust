/**
 * `restoringTracked` (bean `folio-assistant-w1gy` F24): a test that runs a
 * writer over the real tree puts back every TRACKED file it changed or
 * deleted, and leaves what the writer added for the caller to judge.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { restoringTracked } from "./support/checkout.ts";

const repo = mkdtempSync(join(tmpdir(), "restoring-tracked-"));
afterAll(() => rmSync(repo, { recursive: true, force: true }));
const git = (...args: string[]) =>
  spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", "-C", repo, ...args], { encoding: "utf-8" });
const results = join(repo, "test", "results");
mkdirSync(join(results, "witnesses"), { recursive: true });
writeFileSync(join(results, "witnesses", "a.json"), "{\"a\":1}\n");
writeFileSync(join(results, "witnesses", "b.json"), "{\"b\":1}\n");
writeFileSync(join(repo, "outside.txt"), "outside\n");
git("init", "-q");
git("add", "-A");
git("commit", "-q", "-m", "fixture");

const status = () => git("status", "--porcelain=v1", "--untracked-files=all").stdout;

describe("restoringTracked", () => {
  test("a changed and a deleted tracked file are put back; an added file is left; the result is returned", () => {
    const got = restoringTracked([results], () => {
      writeFileSync(join(results, "witnesses", "a.json"), "{\"a\":2}\n");
      rmSync(join(results, "witnesses", "b.json"));
      writeFileSync(join(results, "witnesses", "new.json"), "{}\n");
      // Inside the run, the writer's bytes are what a reader sees.
      expect(readFileSync(join(results, "witnesses", "a.json"), "utf-8")).toBe("{\"a\":2}\n");
      return 7;
    });
    expect(got).toBe(7);
    expect(status()).toBe("?? test/results/witnesses/new.json\n");
    rmSync(join(results, "witnesses", "new.json"));
    expect(status()).toBe("");
  });

  test("a whole tracked directory removed by the run comes back", () => {
    restoringTracked([results], () => rmSync(join(results, "witnesses"), { recursive: true, force: true }));
    expect(existsSync(join(results, "witnesses", "a.json"))).toBe(true);
    expect(status()).toBe("");
  });

  test("it restores when the run throws, and the error still reaches the caller", () => {
    expect(() =>
      restoringTracked([results], () => {
        writeFileSync(join(results, "witnesses", "a.json"), "broken\n");
        throw new Error("writer failed");
      }),
    ).toThrow("writer failed");
    expect(status()).toBe("");
  });

  test("only what lies under the directories given is protected", () => {
    restoringTracked([results], () => writeFileSync(join(repo, "outside.txt"), "changed\n"));
    expect(status()).toBe(" M outside.txt\n");
    git("checkout", "--", "outside.txt");
  });
});
