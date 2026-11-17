/**
 * A listing larger than 1 MiB must still be answered, not reported as
 * "git could not answer".
 *
 * ## The defect, measured 2026-09-30
 *
 * `spawnSync` caps captured stdout at `maxBuffer`, which defaults to 1 MiB.
 * This checkout's `git ls-files -z --cached --others --exclude-standard`
 * reached 1,050,496 bytes, and past that limit the call returns ENOBUFS.
 * {@link gitCorpus} and bootstrap-tools' `gitFiles` both read any error as
 * "git could not answer" and returned `undefined`. So `iri:sync:check`
 * printed "git could not list the corpus" and failed on a clean tree, and
 * every other `gitCorpus` caller fell back quietly.
 *
 * The test builds a repository whose listing is larger than the old default,
 * so it still bites when this checkout is small again.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gitCorpus } from "../../schemas/sdlc/git-corpus.ts";
import { gitFiles } from "@litlfred/bootstrap-tools/scripts/git-files.ts";

describe("a >1 MiB git listing is answered", () => {
  test("gitCorpus and gitFiles both return every file", () => {
    const dir = mkdtempSync(join(tmpdir(), "git-corpus-large-"));
    try {
      spawnSync("git", ["init", "-q"], { cwd: dir });
      // 5,000 names of 220 bytes each, about 1.1 MB of listing, all untracked, so no commit is needed.
      const stem = "x".repeat(210);
      const n = 5000;
      for (let i = 0; i < n; i++) writeFileSync(join(dir, `${stem}${String(i).padStart(5, "0")}`), "");
      const corpus = gitCorpus(dir);
      expect(corpus).toBeDefined();
      expect(corpus!.length).toBe(n);
      expect(gitFiles(dir)?.length).toBe(n);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);
});
