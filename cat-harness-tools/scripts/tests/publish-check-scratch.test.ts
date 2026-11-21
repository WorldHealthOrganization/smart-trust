/**
 * publish:check runs the writer in a scratch copy (owner, 2026-10-30), so
 * the copy must hold every authored file and resolve the workspace packages
 * to the layers IN THE COPY, never to the originals.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { scratchCopy } from "../publish-check";

const repo = mkdtempSync(join(tmpdir(), "publish-check-src-"));
mkdirSync(join(repo, "cat-harness", "docs"), { recursive: true });
writeFileSync(join(repo, "cat-harness", "docs", "a.svg"), "<svg/>");
writeFileSync(join(repo, "package.json"), "{}");
mkdirSync(join(repo, "node_modules", "@litlfred"), { recursive: true });
symlinkSync("../../cat-harness", join(repo, "node_modules", "@litlfred", "cat-harness"));
mkdirSync(join(repo, "node_modules", "zod"), { recursive: true });
writeFileSync(join(repo, "node_modules", "zod", "index.js"), "");
mkdirSync(join(repo, "layer", "node_modules", "dep"), { recursive: true });

const copy = scratchCopy(repo);
afterAll(() => {
  rmSync(copy, { recursive: true, force: true });
  rmSync(repo, { recursive: true, force: true });
});

describe("scratchCopy", () => {
  test("copies authored files", () => {
    expect(readFileSync(join(copy, "cat-harness", "docs", "a.svg"), "utf-8")).toBe("<svg/>");
    expect(existsSync(join(copy, "package.json"))).toBe(true);
  });

  test("a workspace package resolves to the layer in the copy", () => {
    const link = join(copy, "node_modules", "@litlfred", "cat-harness");
    expect(readlinkSync(link)).toBe("../../cat-harness");
    expect(realpathSync(link)).toBe(realpathSync(join(copy, "cat-harness")));
  });

  test("installed packages are linked to the original, not copied", () => {
    const zod = join(copy, "node_modules", "zod");
    expect(lstatSync(zod).isSymbolicLink()).toBe(true);
    expect(readlinkSync(zod)).toBe(join(repo, "node_modules", "zod"));
    expect(lstatSync(join(copy, "layer", "node_modules")).isSymbolicLink()).toBe(true);
  });

  test("writing in the copy leaves the original alone", () => {
    writeFileSync(join(copy, "cat-harness", "docs", "a.svg"), "<svg changed/>");
    expect(readFileSync(join(repo, "cat-harness", "docs", "a.svg"), "utf-8")).toBe("<svg/>");
  });
});

describe("scratchCopy that fails partway", () => {
  test("removes its partial copy and rethrows, leaving os.tmpdir() clean", () => {
    // A FIFO cannot be copied, so cpSync throws after the files before it
    // have been written: the shape of a copy that runs out of disk.
    const src = mkdtempSync(join(tmpdir(), "publish-check-fail-src-"));
    const tmp = mkdtempSync(join(tmpdir(), "publish-check-fail-tmp-"));
    // input-site: inert #54f96ef0 — saves the environment to restore it after the test, or strips names before handing it to a child; no assertion reads the values
    const before = process.env.TMPDIR;
    try {
      writeFileSync(join(src, "a.txt"), "a");
      mkdirSync(join(src, "z"));
      const mk = spawnSync("mkfifo", [join(src, "z", "pipe")]);
      expect(mk.status).toBe(0);
      process.env.TMPDIR = tmp;
      expect(tmpdir()).toBe(tmp);
      expect(() => scratchCopy(src)).toThrow();
      expect(readdirSync(tmp)).toEqual([]);
    } finally {
      if (before === undefined) delete process.env.TMPDIR;
      else process.env.TMPDIR = before;
      rmSync(src, { recursive: true, force: true });
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
