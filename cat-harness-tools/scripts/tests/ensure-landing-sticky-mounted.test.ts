/**
 * A separated layer composes its own landing, and a mounted layer's card is
 * not its to write — bean `1yd7`.
 *
 * Measured from who-iris's own repository before this: the script resolved its
 * root from its own location, which is the REMOTE-MOUNTED cat-harness, so it
 * wrote cards into the mounts (gitignored, committed nowhere) and never
 * declared a `folio` graph in who-iris, the layer actually being composed.
 *
 * @module scripts/tests/ensure-landing-sticky-mounted.test
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ensureLandingSticky } from "../ensure-landing-sticky.ts";
import { mountedInstanceRoots } from "../../schemas/kg/remote-mount.ts";

const SHA = "a".repeat(40);
const DIGEST = "b".repeat(64);

/** A downstream layer `down` with one remote-mounted layer `base` beneath it, each contributing a card. */
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "sticky-mounted-"));
  writeFileSync(
    join(root, "down.json"),
    JSON.stringify(
      {
        name: "down",
        description: "the downstream instance",
        needs: ["base"],
        stickies: [{ id: "down", order: 10, theme: { themeId: "engineer" }, body: "down's card" }],
        directories: [{ id: "down-docs", path: "docs/", graphTypologies: ["docs"] }],
      },
      null,
      2,
    ) + "\n",
  );
  mkdirSync(join(root, "base"), { recursive: true });
  writeFileSync(
    join(root, "base", "base.json"),
    JSON.stringify(
      {
        name: "base",
        description: "the mounted layer",
        stickies: [{ id: "base", order: 20, theme: { themeId: "engineer" }, body: "base's card" }],
        directories: [{ id: "base-folio", path: "folio/", graphTypologies: ["folio"] }],
      },
      null,
      2,
    ) + "\n",
  );
  writeFileSync(
    join(root, "index.lock.json"),
    JSON.stringify({
      $schema: "cat-harness-mount-lock/v1",
      mounts: [{ harness: "base", repository: "o/base", ref: SHA }],
      instances: [
        {
          instance: "base",
          repository: "o/base",
          sha: SHA,
          upstreamRoot: "",
          path: "base",
          via: "base",
          pinnedBy: "declared",
          declaration: { file: "base.json", sha256: DIGEST },
          directories: [{ id: "*", path: "base", upstreamPath: ".", treeDigest: DIGEST, files: 1 }],
        },
      ],
      unmounted: [],
    }),
  );
  return root;
}

describe("ensureLandingSticky from a separated instance's own repository", () => {
  test("the fixture's layer really reads as mounted (not vacuous)", () => {
    const root = fixture();
    try {
      expect([...mountedInstanceRoots(root).keys()]).toEqual(["base"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("--check counts the instance's own missing card and folio graph, never the mounted layer's", () => {
    const root = fixture();
    try {
      const report = ensureLandingSticky(root, "2026-10-09T00:00:00.000Z", { check: true });
      expect(report.declaredFolio).toBe("added");
      const byId = Object.fromEntries(report.stickies.map((s) => [s.id, s]));
      expect(byId.down).toMatchObject({ state: "written" });
      expect(byId.down!.mounted).toBeUndefined();
      expect(byId.base).toMatchObject({ mounted: true });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a run declares the instance's folio graph and writes its card, and writes nothing into the mount", () => {
    const root = fixture();
    try {
      ensureLandingSticky(root, "2026-10-09T00:00:00.000Z");
      const decl = JSON.parse(readFileSync(join(root, "down.json"), "utf-8")) as { directories: { path: string; graphTypologies: string[] }[] };
      expect(decl.directories.some((d) => d.path === "folio/" && d.graphTypologies.includes("folio"))).toBe(true);
      expect(existsSync(join(root, "folio", "down.json"))).toBe(true);
      expect(existsSync(join(root, "base", "folio", "base.json"))).toBe(false);
      expect(existsSync(join(root, "folio", "base.json"))).toBe(false);
      // And the next check is clean.
      const again = ensureLandingSticky(root, "2026-10-09T00:00:00.000Z", { check: true });
      expect(again.declaredFolio).toBe("already");
      expect(again.stickies.filter((s) => s.state !== "already" && !s.mounted)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("the CLI composes the instance it is GIVEN, not the one it sits in", () => {
    const root = fixture();
    try {
      const script = join(import.meta.dir, "..", "ensure-landing-sticky.ts");
      const check = spawnSync("bun", [script, root, "--check"], { encoding: "utf-8" });
      expect(check.status).toBe(1);
      expect(check.stderr).toContain("folio/down.json is missing");
      expect(check.stderr).not.toContain("base.json");
      const run = spawnSync("bun", [script, root], { encoding: "utf-8" });
      expect(run.status).toBe(0);
      expect(run.stdout).toContain("base mounted");
      expect(spawnSync("bun", [script, root, "--check"], { encoding: "utf-8" }).status).toBe(0);
      expect(spawnSync("bun", [script, join(root, "nowhere"), "--check"], { encoding: "utf-8" }).status).toBe(2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
