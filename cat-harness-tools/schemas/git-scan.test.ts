/**
 * `xd1g` — the corpus rule, stated once so it is not re-implemented eleven
 * times.
 *
 * ## What `gitScan` has to get right, and the two ways it could be wrong
 *
 * It must EXCLUDE what git ignores — that is the defect. `ramz`: 145 ignored
 * documents counted as repository content. `biz4`: 233 nodes read as 1443 from
 * residue a clean `git status` cannot show.
 *
 * And it must LOSE NOTHING ELSE. A conversion that quietly narrowed the
 * pattern would look like a success — the count goes down, which is what was
 * wanted — while dropping real files. So every case below asserts the SET,
 * never the size.
 *
 * "check-source-licence's corpus, over this repository" reads THIS checkout's
 * corpus — every layer's `library/` — so it lives in the checkout's root
 * test home, as `test/git-scan-repo-root.test.ts` (owner, 2026-10-06:
 * "Throwaway repository, plus moving the real-repo checks"). The fixture
 * repositories above are what assert `gitScan`'s logic.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { gitScan } from "./sdlc/git-corpus.ts";

/** A throwaway repository holding the given files, with a `.gitignore`. */
function repo(files: Record<string, string>, ignore: string): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "gitscan-"));
  spawnSync("git", ["init", "-q"], { cwd: dir });
  writeFileSync(join(dir, ".gitignore"), ignore);
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), body);
  }
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

describe("gitScan", () => {
  test("an IGNORED file matching the pattern is not in the corpus", () => {
    const { dir, cleanup } = repo(
      { "a/library/x/manifest.jsonld": "{}", "build/library/y/manifest.jsonld": "{}" },
      "build/\n",
    );
    const r = gitScan(dir, "**/library/*/manifest.jsonld");
    expect(r.source).toBe("git");
    expect(r.files).toEqual(["a/library/x/manifest.jsonld"]);
    cleanup();
  });

  test("an UNTRACKED but not ignored file IS in the corpus", () => {
    // Never `--cached` alone. A file a contributor has just written and not
    // yet staged is part of the change under test, and a check that cannot see
    // it passes on the very file it exists to examine.
    const { dir, cleanup } = repo({ "a/library/x/manifest.jsonld": "{}" }, "build/\n");
    expect(gitScan(dir, "**/library/*/manifest.jsonld").files).toEqual([
      "a/library/x/manifest.jsonld",
    ]);
    cleanup();
  });

  test("the pattern keeps Bun `Glob` semantics, not git pathspec semantics", () => {
    // Why this is a glob over git's list rather than a git pathspec: a
    // pathspec's star crosses a path separator and a Bun single star does not,
    // so porting the pattern would change what it matches without changing a
    // character of it.
    const { dir, cleanup } = repo({ "one/x.md": "", "one/two/x.md": "", "one/two/three/x.md": "" }, "");
    expect(gitScan(dir, "one/*/x.md").files).toEqual(["one/two/x.md"]);
    cleanup();
  });

  test("outside a work tree it falls back to the bare scan and SAYS SO", () => {
    // `gates` must stay runnable where git cannot be asked, and a measurement
    // taken from a bare walk counts whatever is on the machine — so the
    // fallback is reported rather than silent. Collapsing the two into one
    // answer is the `dh4f` shape.
    const dir = mkdtempSync(join(tmpdir(), "nogit-"));
    mkdirSync(join(dir, "a", "library", "x"), { recursive: true });
    writeFileSync(join(dir, "a", "library", "x", "manifest.jsonld"), "{}");
    const r = gitScan(dir, "**/library/*/manifest.jsonld");
    expect(r.source).toBe("walk");
    expect(r.files).toEqual(["a/library/x/manifest.jsonld"]);
    rmSync(dir, { recursive: true, force: true });
  });
});
