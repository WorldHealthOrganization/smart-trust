/**
 * optimize-library-pngs — a losslessly rewritten PNG that a catalogue records
 * as held keeps its record true: the recorded bytes and sha256 fixity follow
 * the new file, and a record that already disagreed with the old file is left
 * alone rather than blessed.
 *
 * @module cat-harness-tools/test/optimize-library-pngs.test
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { optimizeLibraryPngs, updateCatalogueFixity } from "../scripts/optimize-library-pngs.ts";

const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

function instance(): string {
  const root = mkdtempSync(join(tmpdir(), "optimize-pngs-"));
  mkdirSync(join(root, "catalogue", "nodes"), { recursive: true });
  mkdirSync(join(root, "library"), { recursive: true });
  return root;
}

function node(localPath: string, bytes: number, digest: string) {
  return {
    id: "item-x",
    bitstreams: [
      {
        name: "x-cover.png",
        bundle: "THUMBNAIL",
        bytes,
        materialization: {
          state: "materialized",
          localPath,
          bytes,
          fixity: { algorithm: "sha256", digest, verifiedAt: "2026-01-01" },
        },
      },
    ],
  };
}

describe("updateCatalogueFixity", () => {
  test("a rewritten held file's bytes and sha256 follow the new content", () => {
    const root = instance();
    try {
      const before = Buffer.from("old-bytes");
      const after = Buffer.from("new");
      const file = join(root, "library", "x-cover.png");
      writeFileSync(file, after);
      const nodePath = join(root, "catalogue", "nodes", "item-x.json");
      writeFileSync(nodePath, JSON.stringify(node("library/x-cover.png", before.length, sha(before)), null, 2) + "\n");

      const updates = updateCatalogueFixity(
        [{ file, originalBytes: before.length, originalSha256: sha(before) }],
        "2026-10-09"
      );

      expect(updates).toEqual([{ node: nodePath, file, bytes: after.length, sha256: sha(after) }]);
      const text = readFileSync(nodePath, "utf-8");
      expect(text.endsWith("}\n")).toBe(true);
      const b = JSON.parse(text).bitstreams[0];
      expect(b.bytes).toBe(after.length);
      expect(b.materialization.bytes).toBe(after.length);
      expect(b.materialization.fixity).toEqual({ algorithm: "sha256", digest: sha(after), verifiedAt: "2026-10-09" });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a record that already disagreed with the old file is not blessed", () => {
    const root = instance();
    try {
      const before = Buffer.from("old-bytes");
      const file = join(root, "library", "x-cover.png");
      writeFileSync(file, Buffer.from("new"));
      const nodePath = join(root, "catalogue", "nodes", "item-x.json");
      writeFileSync(nodePath, JSON.stringify(node("library/x-cover.png", 1, "f".repeat(64)), null, 2) + "\n");

      updateCatalogueFixity([{ file, originalBytes: before.length, originalSha256: sha(before) }], "2026-10-09");

      const m = JSON.parse(readFileSync(nodePath, "utf-8")).bitstreams[0].materialization;
      expect(m.bytes).toBe(1);
      expect(m.fixity.digest).toBe("f".repeat(64));
      expect(m.fixity.verifiedAt).toBe("2026-01-01");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("files outside any catalogue, and nodes naming other files, are untouched", () => {
    const root = instance();
    try {
      const nodePath = join(root, "catalogue", "nodes", "item-x.json");
      const original = JSON.stringify(node("library/other.png", 9, "a".repeat(64)), null, 2) + "\n";
      writeFileSync(nodePath, original);
      const file = join(root, "library", "x-cover.png");
      writeFileSync(file, "new");
      const loose = join(tmpdir(), `loose-${process.pid}.png`);
      writeFileSync(loose, "new");

      const updates = updateCatalogueFixity(
        [
          { file, originalBytes: 9, originalSha256: "a".repeat(64) },
          { file: loose, originalBytes: 9, originalSha256: "a".repeat(64) },
        ],
        "2026-10-09"
      );
      rmSync(loose, { force: true });

      expect(updates).toEqual([]);
      expect(readFileSync(nodePath, "utf-8")).toBe(original);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

const hasImageMagick = spawnSync("convert", ["-version"]).status === 0;

describe.skipIf(!hasImageMagick)("optimizeLibraryPngs end to end", () => {
  test("an optimized held cover leaves its catalogue record matching the file on disk", async () => {
    const root = instance();
    try {
      const file = join(root, "library", "x-cover.png");
      // An uncompressed PNG with metadata: ImageMagick can always shrink it losslessly.
      const made = spawnSync("convert", [
        "-size", "64x64", "gradient:red-blue",
        "-define", "png:compression-level=0",
        "-set", "comment", "x".repeat(2000),
        file,
      ]);
      expect(made.status).toBe(0);
      const before = readFileSync(file);
      const nodePath = join(root, "catalogue", "nodes", "item-x.json");
      writeFileSync(nodePath, JSON.stringify(node("library/x-cover.png", before.length, sha(before)), null, 2) + "\n");

      const summary = await optimizeLibraryPngs({ dirs: [join(root, "library")], today: "2026-10-09" });

      expect(summary.optimizedFiles).toBe(1);
      expect(summary.catalogueUpdates.length).toBe(1);
      const after = readFileSync(file);
      expect(after.length).toBeLessThan(before.length);
      const m = JSON.parse(readFileSync(nodePath, "utf-8")).bitstreams[0].materialization;
      expect(m.bytes).toBe(after.length);
      expect(m.fixity.digest).toBe(sha(after));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a dry run rewrites nothing, catalogue included", async () => {
    const root = instance();
    try {
      const file = join(root, "library", "x-cover.png");
      spawnSync("convert", ["-size", "64x64", "gradient:red-blue", "-define", "png:compression-level=0", file]);
      const before = readFileSync(file);
      const nodePath = join(root, "catalogue", "nodes", "item-x.json");
      const original = JSON.stringify(node("library/x-cover.png", before.length, sha(before)), null, 2) + "\n";
      writeFileSync(nodePath, original);

      const summary = await optimizeLibraryPngs({ dirs: [join(root, "library")], dryRun: true });

      expect(summary.catalogueUpdates).toEqual([]);
      expect(readFileSync(file).equals(before)).toBe(true);
      expect(readFileSync(nodePath, "utf-8")).toBe(original);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
