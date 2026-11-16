/**
 * A withheld library entry publishes no verbatim text and no cover — bean `cw35`.
 *
 * @module scripts/tests/library-withheld
 *
 * The 2026-09-24 audit found the library VIEWER still publishing ~124k
 * characters of a refused work, and its cover, after the site mount had
 * stopped serving it. Three halves, each able to fail alone: the shared
 * reader against a planted list, `readEntryBlocks` against a planted entry,
 * and the committed viewer data against the real `who-iris` list.
 *
 * The tests of this file that read the whole checkout (reads who-iris's
 * withheld list) live in `test/library-withheld-checkout.test.ts` (bean
 * `7zz1`): standing alone, cat-harness has none of it.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { orphanAvatars } from "../../gen-library-viz.ts";
import { readEntryBlocks } from "../../library-graph.ts";
import { withheldReason } from "../../lib/withheld.ts";

/** A library root holding one entry with a prose block and a figure. */
function plant(withheld: boolean): string {
  const lib = mkdtempSync(join(tmpdir(), "withheld-"));
  const blocks = join(lib, "book", "blocks");
  mkdirSync(blocks, { recursive: true });
  writeFileSync(join(blocks, "sec-1.md"), "THE SOURCE'S OWN WORDS, verbatim.\n");
  writeFileSync(
    join(blocks, "prose-sec-1.jsonld"),
    JSON.stringify({ "@id": "prose-sec-1", kind: "prose", text: "sec-1.md", pageStart: 1 }),
  );
  writeFileSync(
    join(blocks, "figure-1.jsonld"),
    JSON.stringify({ "@id": "figure-1", kind: "figure", file: "f.png", pageStart: 2, narrative: { state: "drafted", text: "Our description of the figure." } }),
  );
  if (withheld) {
    writeFileSync(
      join(lib, "withheld.json"),
      JSON.stringify({ $schema: "folio-withheld/v1", paths: [{ path: "book/", reason: "copyright refused" }] }),
    );
  }
  return join(lib, "book");
}

describe("withheldReason", () => {
  test("names the reason for an entry its parent lists, trailing slash or not", () => {
    expect(withheldReason(plant(true))).toBe("copyright refused");
  });

  test("an entry with no list beside it is not withheld", () => {
    expect(withheldReason(plant(false))).toBeUndefined();
  });

  test("a malformed list throws rather than reading as 'withhold nothing'", () => {
    const entry = plant(false);
    writeFileSync(join(entry, "..", "withheld.json"), JSON.stringify({ paths: "book" }));
    expect(() => withheldReason(entry)).toThrow(/refusing to publish/);
  });
});

describe("readEntryBlocks({ verbatim: false })", () => {
  test("drops a prose block's excerpt — the source's words", () => {
    const entry = plant(true);
    const prose = readEntryBlocks(entry, { verbatim: false }).find((b) => b.id === "prose-sec-1");
    expect(prose?.content).toBeNull();
    expect(prose?.truncated).toBe(false);
    // Still listed: its id, kind and page are metadata, not the work.
    expect(prose?.pageStart).toBe(1);
  });

  test("keeps a figure's narrative — our words", () => {
    const fig = readEntryBlocks(plant(true), { verbatim: false }).find((b) => b.id === "figure-1");
    expect(fig?.content).toBe("Our description of the figure.");
  });

  test("the default still carries the excerpt, so nothing else changed", () => {
    const prose = readEntryBlocks(plant(false)).find((b) => b.id === "prose-sec-1");
    expect(prose?.content).toContain("THE SOURCE'S OWN WORDS");
  });
});

describe("orphanAvatars", () => {
  test("lists every copy no entry names, and none it does", () => {
    const root = mkdtempSync(join(tmpdir(), "avatars-"));
    mkdirSync(join(root, "inst"), { recursive: true });
    const kept = join(root, "inst", "kept.png");
    const gone = join(root, "inst", "gone.png");
    writeFileSync(kept, "k");
    writeFileSync(gone, "g");
    expect(orphanAvatars(root, new Set([kept]))).toEqual([gone]);
  });

  test("an absent root has no orphans rather than throwing", () => {
    expect(orphanAvatars(join(tmpdir(), "no-such-avatars-root"), new Set())).toEqual([]);
  });
});
