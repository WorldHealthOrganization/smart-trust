import { describe, expect, test } from "bun:test";
import { parseManifestStringArrays } from "../../pipeline/qa-checkers-extended";

/**
 * The position map `loadChapterGraph` builds is what every detangler criterion
 * runs on, and a block with no position reads as "not listed" and returns
 * `pass`. So a mis-parse here does not produce a wrong answer — it produces a
 * silent absence of checking, which nothing downstream can distinguish from a
 * clean one.
 *
 * These cases came out of the corpus. They were originally pinned against a
 * comment-stripping stopgap; they now run against `parseManifestStringArrays`,
 * which reads every `blocks: [...]` in a chapter manifest by masking strings
 * and comments and depth-scanning for the close.
 */
describe("chapter-manifest block arrays", () => {
  test("a ] inside a comment does not truncate the array", () => {
    // The live case: a note mentioning `uses: []` sat mid-array in mass-theory
    // and hid every block below it from the checker.
    const src = `blocks: [
      "alpha",
      // four consumers are the EW blocks there, and it has \`uses: []\` today
      "beta",
      "gamma",
    ],`;
    expect(parseManifestStringArrays(src, "blocks")).toEqual([["alpha", "beta", "gamma"]]);
  });

  test("a slug quoted inside a comment is not counted as a block", () => {
    // Worse than a miscount: the phantom entry also advanced the position
    // counter, shifting every later block in that chapter by one.
    const src = `blocks: [
      "alpha",
      // "ghost" was relocated to another chapter in July
      "beta",
    ],`;
    expect(parseManifestStringArrays(src, "blocks")).toEqual([["alpha", "beta"]]);
  });

  test("every section's array is returned, in source order", () => {
    // The reason a single-array parser could not be dropped in: a chapter
    // manifest holds one array per section and per subsection, and position is
    // assigned by walking them in order.
    const src = `
      sections: [
        { title: "one", blocks: ["a", "b"] },
        { title: "two", blocks: ["c"], subsections: [
          { title: "two-a", blocks: ["d", "e"] },
        ] },
      ],`;
    expect(parseManifestStringArrays(src, "blocks")).toEqual([["a", "b"], ["c"], ["d", "e"]]);
  });

  test("a nested array does not end the scan early", () => {
    const src = `blocks: ["a", ["b", "c"], "d"],`;
    expect(parseManifestStringArrays(src, "blocks").length).toBe(1);
    expect(parseManifestStringArrays(src, "blocks")[0]).toEqual(["a", "b", "c", "d"]);
  });

  test("a // inside a string literal is not treated as a comment", () => {
    const src = `title: "See https://example.com/docs", blocks: ["alpha"],`;
    expect(parseManifestStringArrays(src, "blocks")).toEqual([["alpha"]]);
  });

  test("a field name inside a string does not win over the real one", () => {
    // The unanchored-match bug: a quoted `blocks: [...]` in an authorNotes body
    // used to be found first and read instead of the block's own field.
    const src = `authorNotes: "we wrote blocks: [\\"ghost\\"] here once", blocks: ["alpha"],`;
    expect(parseManifestStringArrays(src, "blocks")).toEqual([["alpha"]]);
  });

  test("no such field yields nothing", () => {
    expect(parseManifestStringArrays(`title: "T",`, "blocks")).toEqual([]);
  });
});
