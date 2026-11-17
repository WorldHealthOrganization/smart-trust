/**
 * `lib/jsonld-corpus.ts` — the `.jsonld` corpus, asked of git (bean `ramz`),
 * moved out of the retired `check-context-emission` (bean `folio-assistant-63q4`).
 *
 * @module scripts/tests/jsonld-corpus
 * @graphNode none — a test
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { contentDocuments } from "../../lib/jsonld-corpus.ts";

describe("the .jsonld corpus", () => {
  test("the real repository HAS a corpus, so a check over it is not vacuous", () => {
    expect(contentDocuments().length).toBeGreaterThan(100);
  });

  // Bean `ramz`. This walked the filesystem behind a hand-written denylist,
  // so a gitignored directory the list did not name was swept as if it were
  // repository content: 145 documents of one machine's ingestion residue
  // failed `bun test` on a clean checkout of `main`.
  //
  // BOTH halves are asserted. A fix that returned nothing at all would pass
  // the ignored half on its own, and "skip everything" is indistinguishable
  // from "skip the right things" unless something still comes back.
  test("the corpus is what GIT accounts for — ignored out, unstaged in", () => {
    const root = mkdtempSync(join(tmpdir(), "ctxgit-"));
    const git = (...args: string[]): void => {
      const r = spawnSync("git", args, { cwd: root, encoding: "utf-8" });
      expect(r.status, `git ${args.join(" ")}: ${r.stderr}`).toBe(0);
    };
    git("init", "-q");
    writeFileSync(join(root, ".gitignore"), "staging/\n");
    mkdirSync(join(root, "staging"), { recursive: true });
    mkdirSync(join(root, "content"), { recursive: true });
    const doc = JSON.stringify({ "@context": {}, "@type": "probe:Thing" });
    writeFileSync(join(root, "staging", "residue.jsonld"), doc);
    writeFileSync(join(root, "content", "tracked.jsonld"), doc);
    git("add", "content/tracked.jsonld");
    // Never staged, never ignored: part of the change under test, so the
    // check has to see it. `--cached` alone would miss it.
    writeFileSync(join(root, "content", "unstaged.jsonld"), doc);

    const found = contentDocuments(root).map((f) => f.slice(root.length + 1)).sort();
    expect(found).toEqual(["content/tracked.jsonld", "content/unstaged.jsonld"]);
    rmSync(root, { recursive: true, force: true });
  });
});
