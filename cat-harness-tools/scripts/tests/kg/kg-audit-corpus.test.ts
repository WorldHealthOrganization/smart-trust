/**
 * The page corpus is asked of GIT, not of the disk — bean `xd1g`.
 *
 * Why this file exists at all: the predicate was inline first, so nothing could
 * show it working OR broken, and an untestable corpus rule is exactly how the
 * defect survived. Each case below is one of the four states the predicate must
 * keep apart, and two of them are the ones a naive `tracked.has(abs)` gets
 * wrong in opposite directions — a sibling checkout wrongly dropped, and a
 * git-can't-answer wrongly read as an empty corpus.
 *
 * NOT claimed here: that this changes any verdict today. Running the writer
 * with the fix changed no sidecar, so the exposure is LATENT. It is fixed
 * because a measurement that depends on what a gate happened to install is not
 * a measurement.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, test } from "bun:test";

import { corpusPredicate } from "../../../schemas/sdlc/git-corpus.js";

/** A git work tree with one tracked page and one gitignored page. */
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "kg-corpus-"));
  spawnSync("git", ["init", "-q"], { cwd: root });
  // `pages`, NOT the site root's name. The predicate keys on repository
  // membership and does not care where pages live, so naming the real site
  // directory would assert something the subject does not require —
  // `site-dir-single-answer` refuses the literal, and it refused this one. That
  // is the fourth time in this session's work that the same invariant caught
  // the same reflex, and the second time inside a test fixture.
  mkdirSync(join(root, "pages"), { recursive: true });
  writeFileSync(join(root, ".gitignore"), "_kg/\n");
  writeFileSync(join(root, "pages", "tracked.md"), "# tracked\n");
  mkdirSync(join(root, "_kg"), { recursive: true });
  writeFileSync(join(root, "_kg", "generated.html"), "<p>generated</p>\n");
  return root;
}

describe("corpusPredicate", () => {
  test("a git-listed page is IN", () => {
    const root = fixture();
    try {
      // Untracked but NOT ignored still counts: `gitCorpus` passes
      // `--others --exclude-standard`, so a file a contributor has just written
      // is part of the corpus. Reading only `--cached` would make the audit
      // disagree with itself between `git add` and `git commit`.
      expect(corpusPredicate(root)(join(root, "pages", "tracked.md"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a GITIGNORED page under the repository is OUT — the defect", () => {
    const root = fixture();
    try {
      // The measured case: five such files under `_kg/` existed in one
      // container and not in a fresh checkout, and the old walk read them
      // because it excluded three directory NAMES and `_kg` was not one.
      expect(corpusPredicate(root)(join(root, "_kg", "generated.html"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a path OUTSIDE the repository is IN, not silently dropped", () => {
    const root = fixture();
    try {
      // `docsLayers` can return a layer in a sibling checkout. That layer is
      // outside this corpus and so cannot be JUDGED by it — keeping it is the
      // could-not-determine answer, and dropping it would be a clean run over
      // content nobody looked at (`dh4f`).
      expect(corpusPredicate(root)("/some/other/checkout/pages/page.md")).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("git unable to answer keeps EVERYTHING — an unanswerable question is not an empty answer", () => {
    // A bare temp directory is not a work tree, so `gitCorpus` returns
    // undefined. Reading that as "the corpus is empty" would drop every page
    // and report a clean audit over nothing, which is the failure this
    // repository has paid for three times.
    const root = mkdtempSync(join(tmpdir(), "kg-corpus-nogit-"));
    try {
      const p = corpusPredicate(root);
      expect(p(join(root, "pages", "anything.md"))).toBe(true);
      expect(p("/elsewhere/x.html")).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a prefix that merely SHARES a name is not inside the repository", () => {
    // `startsWith(repoRoot)` without the trailing separator would treat
    // `<root>-other/pages/p.md` as inside, and then drop it for not being in the
    // corpus. Off-by-one on a path boundary, silent and in the wrong direction.
    const root = fixture();
    try {
      expect(corpusPredicate(root)(`${root}-other/pages/p.md`)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
