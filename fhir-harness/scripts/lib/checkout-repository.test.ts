/**
 * Same-owner lock entries and the derived checkout repository
 * (cat-harness-tools#2337; the rule is restated from its repo-owner.ts).
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { checkoutOwner, checkoutRepository, repositoryFromUrl, resolveRepository } from "./checkout-repository.ts";
import { lockedMounts } from "../build-ig-indexes.ts";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "checkout-repository-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function checkout(owner: string, repo: string): string {
  const root = join(dir, `${owner}-${repo}`);
  mkdirSync(root, { recursive: true });
  spawnSync("git", ["-C", root, "init", "-q"]);
  spawnSync("git", ["-C", root, "remote", "add", "origin", `https://github.com/${owner}/${repo}.git`]);
  return root;
}

describe("checkout repository", () => {
  test("names come from https, ssh and proxy URLs", () => {
    expect(repositoryFromUrl("https://github.com/o/r.git")).toBe("o/r");
    expect(repositoryFromUrl("git@github.com:O/r")).toBe("O/r");
    expect(repositoryFromUrl("http://proxy@127.0.0.1:9/git/o/r")).toBe("o/r");
  });

  test("a checkout names itself; a directory inside it does not borrow the name", () => {
    const root = checkout("o", "ig");
    expect(checkoutRepository(root, {})).toBe("o/ig");
    expect(checkoutRepository(root, { CAT_REPO_OWNER: "p" })).toBe("p/ig");
    mkdirSync(join(root, "sub"));
    expect(checkoutRepository(join(root, "sub"), {})).toBeUndefined();
  });

  test("the owner is CAT_REPO_OWNER, origin's, else GITHUB_REPOSITORY_OWNER", () => {
    const root = checkout("o", "ig");
    expect(checkoutOwner(root, {})).toBe("o");
    expect(checkoutOwner(root, { CAT_REPO_OWNER: "p" })).toBe("p");
    expect(checkoutOwner(join(dir), { GITHUB_REPOSITORY_OWNER: "q" })).toBe("q");
    expect(resolveRepository("base", "o")).toBe("o/base");
    expect(resolveRepository("x/base", "o")).toBe("x/base");
    expect(resolveRepository("base", undefined)).toBeUndefined();
  });

  test("lockedMounts resolves a same-owner entry against the checkout's owner", () => {
    const sha = "a".repeat(40);
    for (const owner of ["o", "p"]) {
      const root = checkout(owner, "ig");
      writeFileSync(
        join(root, "index.lock.json"),
        JSON.stringify({ instances: [{ instance: "base", repository: "base", sha }, { instance: "tools", repository: "h/tools", sha }] }),
      );
      const m = lockedMounts(root);
      expect(m.get("base")).toEqual({ repository: `${owner}/base`, sha });
      expect(m.get("tools")).toEqual({ repository: "h/tools", sha });
    }
  });
});
