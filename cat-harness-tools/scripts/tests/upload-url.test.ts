/**
 * The upload URL is composed from the declaration, and every failure is named.
 *
 * The regression under test is a real 404: the owner was sent to
 * `/upload/main/uploads` on 2026-09-20 and that path does not exist — the queue
 * is at `cat-harness/uploads`. Verified against GitHub the same day:
 * `/tree/main/uploads` returns 404, `/tree/main/cat-harness/uploads` returns
 * 200.
 *
 * The URL's SHAPE is asserted over a throwaway repository whose `origin` is
 * known (`test/support/git-fixture.ts`), not over this checkout's: standing
 * alone, cat-harness has no `origin`, and the shape is logic over whatever
 * remote it is given. Whether THIS layer resolves — its declaration, its
 * queue on disk, its remote — is a check of this repository's configuration,
 * and lives in `test/upload-url-repo-root.test.ts` at the checkout's root.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { queueRepoRelative, uploadUrl } from "../upload-url.js";
import { repoRootFor } from "../../schemas/kg/cat-harness.js";
import { gitFixtureRepo } from "../../test/support/git-fixture.js";
import { HARNESS_ROOT } from "../lib/roots.ts";

const ROOT = resolve(HARNESS_ROOT);

/**
 * A LAYER inside a throwaway repository: `inst/` declares an `uploads`
 * graph at `uploads/`, which exists, and the repository's `origin` is
 * `https://github.com/example/demo.git` — `.git` suffix and all.
 */
const FIXTURE = gitFixtureRepo({
  files: {
    "inst/inst.json": JSON.stringify({
      name: "inst",
      directories: [{ id: "uploads", path: "uploads/", graphTypologies: ["uploads"] }],
    }),
    "inst/uploads/.gitkeep": "",
  },
});
const FIXTURE_INSTANCE = resolve(FIXTURE.root, "inst");
afterAll(() => FIXTURE.cleanup());

describe("the queue path is REPOSITORY-relative, not instance-relative", () => {
  test("it carries the instance segment", () => {
    // The whole bug. `harness.json` declares `path: "uploads/"` with no scope,
    // and absent scope means layer — so the declared path is missing the
    // `cat-harness/` a forge URL needs.
    const rel = queueRepoRelative(ROOT);
    expect(rel).toBeDefined();
    expect(rel).toContain("/");
    expect(rel!.endsWith("uploads")).toBe(true);
  });

  test("it is NOT the bare declared path", () => {
    // The assertion that would have caught the 404. If this ever equals
    // `uploads`, the layer segment has been dropped again.
    expect(queueRepoRelative(ROOT)).not.toBe("uploads");
  });

  test("it resolves to a directory that exists", () => {
    expect(existsSync(resolve(repoRootFor(ROOT), queueRepoRelative(ROOT)!))).toBe(true);
  });

  test("it uses POSIX separators, because it becomes a URL", () => {
    expect(queueRepoRelative(ROOT)).not.toContain("\\");
  });
});

describe("the URL", () => {
  // "resolves for this instance" checks THIS repository's configuration, and is
  // in `test/upload-url-repo-root.test.ts`.

  test("is the /upload/<branch>/<repo-relative path> form", () => {
    const t = uploadUrl(FIXTURE_INSTANCE, "main");
    if (!t.ok) throw new Error(t.reason);
    expect(t.url).toContain("/upload/main/");
    expect(t.url.endsWith(t.repoRelative)).toBe(true);
  });

  test("honours a branch other than main", () => {
    const t = uploadUrl(FIXTURE_INSTANCE, "some-branch");
    if (!t.ok) throw new Error(t.reason);
    expect(t.url).toContain("/upload/some-branch/");
  });

  test("carries no `.git` suffix from the remote", () => {
    const t = uploadUrl(FIXTURE_INSTANCE, "main");
    if (!t.ok) throw new Error(t.reason);
    expect(t.url).not.toContain(".git/upload/");
  });
});

describe("a failure is NAMED, never a guessed URL", () => {
  test("no declaration reports the reason and a remedy", () => {
    // An agent that guesses a URL sends somebody somewhere that does not exist,
    // and they cannot tell a wrong link from an empty directory.
    const t = uploadUrl("/tmp");
    expect(t.ok).toBe(false);
    if (t.ok) return;
    expect(t.reason.length).toBeGreaterThan(0);
    expect(t.remedy.length).toBeGreaterThan(0);
  });

  test("the failure path returns no url field at all", () => {
    // Structurally impossible to read a url off a failure, rather than a
    // convention that it will be empty.
    const t = uploadUrl("/tmp");
    expect("url" in t).toBe(false);
  });
});
