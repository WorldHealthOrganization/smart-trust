/**
 * publish:check calls a moved file COMMITTED only when the index could hold a
 * committed copy of it. In a mount that is only what the lock carries, so a
 * file a writer leaves elsewhere in a mount is not stale (folio-assistant#2781).
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { outsideMounts } from "../publish-check";

const repo = mkdtempSync(join(tmpdir(), "publish-check-mounts-"));
writeFileSync(
  join(repo, "index.lock.json"),
  JSON.stringify({
    instances: [
      {
        instance: "phw",
        path: "phw",
        directories: [{ id: "library", path: "phw/library" }],
        assets: [{ src: "README.md" }],
        declaration: { file: "phw.json" },
      },
    ],
  }),
);
afterAll(() => rmSync(repo, { recursive: true, force: true }));

describe("outsideMounts", () => {
  const paths = [
    "phw/test/results/library-qa/a.qa-results.json",
    "phw/library/a/index.md",
    "phw/README.md",
    "phw/phw.json",
    "own/glossary/x.json",
  ];
  const out = outsideMounts(paths, repo);

  test("a file outside every locked path of a mount is not committed here", () => {
    expect(out.has("phw/test/results/library-qa/a.qa-results.json")).toBe(true);
  });

  test("files under a locked directory, asset or declaration are", () => {
    expect(out.has("phw/library/a/index.md")).toBe(false);
    expect(out.has("phw/README.md")).toBe(false);
    expect(out.has("phw/phw.json")).toBe(false);
  });

  test("an instance the lock does not list is left to its own .gitignore", () => {
    expect(out.has("own/glossary/x.json")).toBe(false);
  });

  test("no lock, nothing excluded", () => {
    const bare = mkdtempSync(join(tmpdir(), "publish-check-nolock-"));
    expect(outsideMounts(paths, bare).size).toBe(0);
    rmSync(bare, { recursive: true, force: true });
  });
});
