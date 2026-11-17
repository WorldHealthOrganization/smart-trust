import { describe, expect, test } from "bun:test";
import { maskComments, findUsesField, parseUsesField } from "../../pipeline/uses-field";
import { extractUses, parseUses } from "../../pipeline/content-graph";

/**
 * The editorial graph is built from `uses[]`, and a block whose array cannot be
 * parsed contributes no edges — which is indistinguishable from a block that
 * genuinely declares nothing. So a parse failure here does not produce a wrong
 * answer, it produces a silent absence of one, and every ordering, cone and
 * reachability metric quietly under-counts.
 *
 * That is not hypothetical: `content-graph.extractUses` anchored on
 * `/(?:^|[{,])\s*uses\s*:\s*\[/`, and `\s*` does not span comments — so a `//`
 * note between the previous field's comma and the `uses:` key made the match
 * fail outright. **27 blocks and 53 declared edges were invisible**, including
 * `def:crossing-energy` and `def:borromean-baryon`, and a prune-damage audit
 * built on this graph reported those blocks as declaring nothing.
 */
describe("uses[] parsing survives comments", () => {
  const withCommentBeforeField = `export default proposition({
  label: "prop:x",
  title: "T",
  // def:crossing-energy, which clause 2 reduces at Q = 0, is NOT listed:
  // it is reached through def:coulomb-charge.
  uses: ["def:coulomb-charge"],
});`;

  test("a comment between the previous field and uses: does not hide the array", () => {
    // The regression. Before the fix this returned undefined.
    expect(extractUses(withCommentBeforeField)?.entries).toEqual(["def:coulomb-charge"]);
    expect(parseUses(withCommentBeforeField)).toEqual(["def:coulomb-charge"]);
  });

  test("labels named only in that comment are not picked up as dependencies", () => {
    // The comment names def:crossing-energy; it is prose about why the edge is
    // absent, not a declaration of it.
    expect(parseUses(withCommentBeforeField)).not.toContain("def:crossing-energy");
  });

  test("a label quoted inside a comment INSIDE the array is not an entry", () => {
    const src = `uses: [
      "def:a",
      // "def:ghost" was relocated in July
      "def:b",
    ],`;
    expect(parseUsesField(src)).toEqual(["def:a", "def:b"]);
  });

  test("the field boundary still keeps causes/reuses out", () => {
    const src = `causes: ["def:not-this"], uses: ["def:this"],`;
    expect(parseUsesField(src)).toEqual(["def:this"]);
  });

  test("a uses: quoted inside an authorNotes body does not win", () => {
    const src = `authorNotes: "we wrote uses: [\\"def:ghost\\"] once", uses: ["def:real"],`;
    expect(parseUsesField(src)).toEqual(["def:real"]);
  });

  test("no uses field is undefined, not an empty array", () => {
    // Writers depend on the distinction: rewriting an absent field appends one.
    expect(findUsesField(`label: "prop:x",`)).toBeUndefined();
    expect(extractUses(`label: "prop:x",`)).toBeUndefined();
  });
});

describe("maskComments", () => {
  test("a // inside a string literal is not a comment", () => {
    const src = `["https://example.com/docs"]`;
    expect(maskComments(src)).toBe(src);
  });

  test("comments are blanked, and offsets are preserved", () => {
    const src = `a // note\nb`;
    const out = maskComments(src);
    expect(out).toBe(`a        \nb`);
    expect(out.length).toBe(src.length);
  });

  test("block comments are blanked across lines, keeping newlines", () => {
    const src = `a /* x\ny */ b`;
    const out = maskComments(src);
    expect(out.length).toBe(src.length);
    expect(out).not.toContain("x");
    expect(out.split("\n").length).toBe(2);
  });

  test("an escaped quote does not end the string early", () => {
    const src = `"a\\"b" // c`;
    const out = maskComments(src);
    expect(out.startsWith(`"a\\"b"`)).toBe(true);
    expect(out).not.toContain("c");
  });
});
