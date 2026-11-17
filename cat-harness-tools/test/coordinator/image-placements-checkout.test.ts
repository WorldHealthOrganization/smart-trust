/**
 * `image-placements` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness/scripts/tests/image-placements.test.ts` (bean `7zz1`, owner
 * ruling 2026-10-06 "Top-level instance"): each reads the image sidecars of
 * the WHO library entries (in who-iris since frs5), which only the checkout holds. Standing alone,
 * cat-harness has none of it, and `check:cat-harness-standalone` collects
 * every test in that layer. The rest of that file's tests stay there; every
 * path here is composed from ORIGIN_DIR, the directory they were written in,
 * so nothing they read changed.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { harnessRel } from "../../scripts/lib/harness-layout.ts";

import { ImagesSidecarSchema } from "../../schemas/content/document-image.ts";
import { narrativeFor } from "../../schemas/content/narrative.ts";

/** The directory these tests were written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move, so nothing they read changed. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

const REPO = join(ORIGIN_DIR, "../../..");

describe("the real corpus is deduplicated, and stays that way", () => {
  const entries = [
    // measured 2026-09-24; the left number is what the corpus held BEFORE
    { path: `cat-harness/${harnessRel("library/corpus/ui/arxiv-2312.07755v1", join(REPO, "cat-harness"))}`, was: 84, now: 28 },
    { path: "who-iris/library/9789241509510-eng", was: 162, now: 103 },
    { path: "who-iris/library/9789241511766-eng", was: 99, now: 44 },
    { path: "who-iris/library/9789240010567-eng", was: 17, now: 11 },
  ];

  test.each(entries.map((e): [string, number, number, string] => [e.path.split("/").pop()!, e.now, e.was, e.path]))(
    "%s holds %i distinct images, not %i placements",
    (_entry, now, was, path) => {
      const s = ImagesSidecarSchema.parse(
        JSON.parse(readFileSync(join(REPO, path, "images.json"), "utf8")),
      );
      expect(s.images).not.toBeNull();
      expect(s.images!.length).toBe(now);
      const placements = s.images!.reduce((n, i) => n + (i.placements?.length ?? 1), 0);
      expect(placements, "every placement is still recorded").toBe(was);
    },
  );

  test("no two entries in one sidecar name the same file", () => {
    // What duplication looked like from inside: distinct ids, one image. This
    // is the property the collapse establishes, asserted directly rather than
    // through a count that a re-ingest could move.
    for (const e of entries) {
      const s = ImagesSidecarSchema.parse(
        JSON.parse(readFileSync(join(REPO, e.path, "images.json"), "utf8")),
      );
      const files = (s.images ?? []).map((i) => i.file);
      expect(new Set(files).size, e.path).toBe(files.length);
    }
  });

  test("the seven Principles logos are one image with six notes", () => {
    // The group that settled the design: byte-identical copies whose
    // descriptions share a clause about the IMAGE and differ about what each
    // copy serves. Collapsing without `note` would have dropped six of them.
    const s = ImagesSidecarSchema.parse(
      JSON.parse(readFileSync(join(REPO, "who-iris/library/9789240010567-eng/images.json"), "utf8")),
    );
    const logo = (s.images ?? []).find((i) => (i.placements?.length ?? 0) === 7);
    expect(logo, "the seven-placement entry").toBeDefined();
    expect(logo!.narrative && narrativeFor(logo!.narrative).text).toContain("Principles for Digital Development");
    const notes = logo!.placements!.filter((p) => p.note);
    expect(notes.length, "one per placement after the first").toBe(6);
    expect(notes.some((p) => p.note!.includes("Build for sustainability"))).toBe(true);
  });
});
