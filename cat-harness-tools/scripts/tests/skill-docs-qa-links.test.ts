/**
 * A skill page's link to a QA result names the declared `qa-reports` storage,
 * never `blob/main`.
 *
 * The defect (folio-assistant#3186's `stage` job): `gen-skill-docs` published a
 * skill's relative link into `cat-harness/test/results/…` as
 * `blob/main/cat-harness/test/results/…`. That directory declares `storage`,
 * so its record is the `qa-reports` branch and `check:qa-result-links`
 * refused all six such links. The shape here is the CI one: `cat-harness` is a
 * mounted layer at `cat-harness/`, its `test/results` declared stored on
 * `cat/cat-harness/qa-reports`.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { judgeBlobMainPath, type QaDirDecl } from "../check-qa-result-links.ts";
import { repositoryFileHref } from "../gen-skill-docs.ts";
import { clearMountedCache } from "../lib/layer-output.ts";
import type { QaLocation } from "../qa-store.ts";

const WEB = "https://github.com/litlfred/folio-assistant";
const BRANCH = "cat/cat-harness/qa-reports";
const SHA = "2153da13c6f1d1e4d2b0f2a4e3c5b6a7d8e9f0a1";
const REL = "cat-harness/test/results/skill-qa/qa-reports.qa.json";

const root = mkdtempSync(join(tmpdir(), "skill-docs-qa-links-"));
writeFileSync(join(root, "index.lock.json"), JSON.stringify({ instances: [{ instance: "cat-harness", path: "cat-harness" }] }));
mkdirSync(join(root, "cat-harness/test/results/skill-qa"), { recursive: true });
writeFileSync(join(root, REL), "{}\n");
mkdirSync(join(root, "cat-harness/scripts"), { recursive: true });
writeFileSync(join(root, "cat-harness/scripts/x.ts"), "\n");

const location: QaLocation = {
  branch: BRANCH,
  keyedBy: "commit",
  declared: true,
  directories: [
    {
      instance: join(root, "cat-harness"),
      id: "qa-results",
      path: "cat-harness/test/results",
      absPath: join(root, "cat-harness/test/results"),
      present: true,
      storage: { branch: BRANCH } as never,
    },
  ],
};
const dirs: QaDirDecl[] = [{ path: "cat-harness/test/results", stored: true }];
const blobMainPath = (href: string) => /\/blob\/main\/(.+)$/.exec(href)?.[1];

afterAll(() => {
  clearMountedCache();
  rmSync(root, { recursive: true, force: true });
});

describe("repositoryFileHref", () => {
  test("a stored QA result is addressed on the declared branch, at the entry when the build knows it", () => {
    const href = repositoryFileHref(join(root, REL), false, { repoRoot: root, location, key: `main/${SHA}` });
    expect(href).toBe(`${WEB}/blob/cat/cat-harness/qa-reports/main/${SHA}/${REL}`);
  });
  test("with no entry known it names the branch tip's index, never main", () => {
    const href = repositoryFileHref(join(root, REL), false, { repoRoot: root, location });
    expect(href).toBe(`${WEB}/blob/cat/cat-harness/qa-reports/index.json`);
  });
  test("a stored results directory at an entry is a tree", () => {
    const href = repositoryFileHref(join(root, "cat-harness/test/results"), true, { repoRoot: root, location, key: `main/${SHA}` });
    expect(href).toBe(`${WEB}/tree/cat/cat-harness/qa-reports/main/${SHA}/cat-harness/test/results`);
  });
  test("passes the stage gate's own judge", () => {
    for (const key of [`main/${SHA}`, undefined]) {
      const href = repositoryFileHref(join(root, REL), false, { repoRoot: root, location, key });
      const p = blobMainPath(href);
      expect(p === undefined ? undefined : judgeBlobMainPath(p, dirs)).toBeUndefined();
    }
  });
  test("a file outside any qa directory keeps its main address", () => {
    expect(repositoryFileHref(join(root, "cat-harness/scripts/x.ts"), false, { repoRoot: root, location })).toBe(`${WEB}/blob/main/cat-harness/scripts/x.ts`);
    expect(repositoryFileHref(join(root, "cat-harness/scripts"), true, { repoRoot: root, location: undefined })).toBe(`${WEB}/tree/main/cat-harness/scripts`);
  });
  test("the old address is what the gate refused", () => {
    expect(judgeBlobMainPath(REL, dirs)).toBeDefined();
  });
});
