/**
 * `forgeLocation` — a path under a remote mount links to the mounted
 * repository, not to this checkout's forge, which holds no copy (bean `nn8e`).
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { forgeLocation } from "./kg/cat-harness.ts";

const root = mkdtempSync(join(tmpdir(), "forge-location-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));
const sha = "a".repeat(40);
writeFileSync(
  join(root, "host.mount-lock.json"),
  JSON.stringify({
    $schema: "cat-harness-mount-lock/v1",
    mounts: [{ harness: "leaf", repository: "o/leaf", ref: sha }],
    instances: [
      {
        instance: "leaf",
        repository: "o/leaf",
        sha,
        upstreamRoot: "",
        path: "leaf",
        via: "leaf",
        pinnedBy: "declared",
        declaration: { file: "leaf.json", sha256: "0".repeat(64) },
        directories: [{ id: "*", path: "leaf", upstreamPath: ".", treeDigest: "0".repeat(64), files: 1 }],
      },
    ],
  }),
);

describe("forgeLocation over a remote mount", () => {
  test("a mounted path names the mounted repository, relative to its root", () => {
    expect(forgeLocation("leaf/leaf.json", "https://github.com/o/host", root)).toEqual({ repoUrl: "https://github.com/o/leaf", path: "leaf.json" });
  });
  test("a path that only shares a prefix stays this checkout's", () => {
    expect(forgeLocation("leafy/x.md", "https://github.com/o/host", root)).toEqual({ repoUrl: "https://github.com/o/host", path: "leafy/x.md" });
  });
});
