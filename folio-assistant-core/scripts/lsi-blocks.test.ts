/**
 * LSI over content blocks — bean `folio-assistant-ec2a`.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { BLOCK_INDEX_OPTIONS, blockText, blockUnits, lsiNearUnits } from "./lsi-blocks.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A library with one entry whose blocks are given; `sections` holds prose text. */
function library(blocks: Record<string, unknown>, sections: Record<string, string> = {}): string {
  const lib = mkdtempSync(join(tmpdir(), "lsi-blocks-"));
  dirs.push(lib);
  mkdirSync(join(lib, "doc", "blocks"), { recursive: true });
  mkdirSync(join(lib, "doc", "sections"), { recursive: true });
  for (const [n, b] of Object.entries(blocks)) writeFileSync(join(lib, "doc", "blocks", `${n}.jsonld`), typeof b === "string" ? b : JSON.stringify(b));
  for (const [n, t] of Object.entries(sections)) writeFileSync(join(lib, "doc", "sections", n), t);
  return lib;
}

describe("blockText", () => {
  test("proseReadsSection", () => {
    const lib = library({}, { "s1.md": "Vaccines and schedules." });
    const t = blockText({ kind: "prose", title: "Intro", text: "../sections/s1.md" }, join(lib, "doc", "blocks", "p.jsonld"));
    expect(t).toEqual({ text: "Intro\n\nVaccines and schedules." });
  });

  test("figureTitleAndNarrative", () => {
    expect(blockText({ kind: "figure", title: "Fig 1", narrative: { text: "A flow of doses." } }, "/x")).toEqual({ text: "Fig 1\n\nA flow of doses." });
  });

  test("narrativeListFirstEntry", () => {
    const narrative = [{ text: "Doses over time.", lang: "en" }, { text: "Doses dans le temps.", lang: "fr" }];
    expect(blockText({ kind: "figure", title: "Fig 2", narrative }, "/x")).toEqual({ text: "Fig 2\n\nDoses over time." });
  });

  test("unknownOrMissingIsReason", () => {
    expect("reason" in blockText({ kind: "equation" }, "/x")).toBe(true);
    expect("reason" in blockText({ kind: "prose", text: "../sections/gone.md" }, "/nowhere/blocks/b.jsonld")).toBe(true);
  });
});

describe("blockUnits", () => {
  test("unitsKeyedById", () => {
    const lib = library(
      {
        a: { "@id": "library/doc/blocks/a", kind: "prose", text: "../sections/s.md" },
        b: { "@id": "library/doc/blocks/b", kind: "figure", narrative: { text: "Doses over time." } },
        c: "{ not json",
        d: { "@id": "library/doc/blocks/d", kind: "mystery" },
      },
      { "s.md": "Text of a section." },
    );
    const u = blockUnits([lib]);
    expect(u.units.map((x) => x.id)).toEqual(["library/doc/blocks/a", "library/doc/blocks/b"]);
    expect(u.byKind).toEqual({ prose: 1, figure: 1 });
    expect(u.unreadable).toHaveLength(2);
  });

  test("repeatedIdReported", () => {
    const lib = library({
      a: { "@id": "same", kind: "figure", narrative: { text: "one" } },
      b: { "@id": "same", kind: "figure", narrative: { text: "two" } },
    });
    const u = blockUnits([lib]);
    expect(u.units).toHaveLength(1);
    expect(u.unreadable[0]!.reason).toContain("already used");
  });
});

describe("lsiNearUnits (the `blocks` provider for cross-graph lsi:near)", () => {
  test("rootLibraryOwnRefs", () => {
    const lib = library({ a: { "@id": "library/doc/blocks/a", kind: "figure", narrative: { text: "Doses over time." } } });
    const r = lsiNearUnits({ checkoutRoot: "/nowhere", roots: [lib] });
    expect(r.units.map((u) => u.id)).toEqual(["library/doc/blocks/a"]);
    expect(r.refKeys).toEqual([["library/doc/blocks/a", "library/doc/blocks/a"]]);
    expect(r.buildOptions).toBe(BLOCK_INDEX_OPTIONS);
    expect(r.notSearched).toBeUndefined();
  });

  test("noLibraryNotSearched", () => {
    const empty = mkdtempSync(join(tmpdir(), "lsi-blocks-empty-"));
    dirs.push(empty);
    const r = lsiNearUnits({ checkoutRoot: empty, roots: [] });
    expect(r.notSearched).toBe("no library is declared in this checkout");
    expect(r.units).toEqual([]);
  });
});
