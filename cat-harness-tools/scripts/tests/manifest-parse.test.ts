import { describe, expect, test } from "bun:test";
import {
  maskStringsAndComments,
  parseManifestStringArray,
  parseForeshadows,
} from "../../pipeline/qa-checkers-extended";

describe("maskStringsAndComments", () => {
  test("preserves length and newlines so indices stay valid", () => {
    const src = 'const a = "hi"; // note\nconst b = 1;\n';
    const out = maskStringsAndComments(src);
    expect(out.length).toBe(src.length);
    expect(out.split("\n").length).toBe(src.split("\n").length);
  });

  test("blanks string contents but keeps the quotes", () => {
    expect(maskStringsAndComments('x = "abc"')).toBe('x = "   "');
  });

  test("does NOT corrupt a URL inside a string — the reason this masks rather than strips", () => {
    // A naive comment-strip would cut at the `//` in https:// and silently
    // truncate the literal.
    const src = 'uses: ["https://folio.example.org/p#def:x"]';
    expect(parseManifestStringArray(src, "uses")).toEqual([
      "https://folio.example.org/p#def:x",
    ]);
  });

  test("blanks line and block comments", () => {
    expect(maskStringsAndComments("a // c\nb")).toBe("a     \nb");
    expect(maskStringsAndComments("a /* c */ b")).toBe("a         b");
  });
});

describe("parseManifestStringArray", () => {
  test("reads a plain array", () => {
    const src = `uses: ["def:a", "thm:b"],`;
    expect(parseManifestStringArray(src, "uses")).toEqual(["def:a", "thm:b"]);
  });

  test("mode 1 — a quoted string in a comment is NOT an entry", () => {
    // Live in the corpus: p3-blowup-yekutieli.ts read 4 entries where the
    // truth is 3, the extra being a phrase from this kind of comment.
    const src = [
      "  uses: [",
      "    // conj:regularity-breakdown removed: this prop is the",
      '    // unconditional reformulation "NS blowup ⟺ obstruction level n*",',
      '    "prop:descent-condition",',
      '    "def:local-cohomology-group",',
      "  ],",
    ].join("\n");
    expect(parseManifestStringArray(src, "uses")).toEqual([
      "prop:descent-condition",
      "def:local-cohomology-group",
    ]);
  });

  test("mode 2 — a quoted `uses: [...]` earlier in the file does not win", () => {
    // Live in hecke-log-decomposition-table-data.ts, whose authorNote quotes
    // a manifest snippet as prose — and appears before the real field.
    const src = [
      "export default remark({",
      "  authorNotes: [",
      "    {",
      '      body: "the block declared `uses: [\\"prop:ghost\\"]`, which does not exist",',
      "    },",
      "  ],",
      '  uses: ["prop:real"],',
      "});",
    ].join("\n");
    expect(parseManifestStringArray(src, "uses")).toEqual(["prop:real"]);
  });

  test("mode 3 — a closing bracket in a comment does NOT truncate", () => {
    // The worst mode: a truncated array is indistinguishable from a shorter
    // one, so no checker can detect it.
    const src = [
      "  foreshadows: [",
      '    "def:a",',
      "    // moved out of uses[] because the reader does not need it first",
      '    "thm:b",',
      '    "rem:c",',
      "  ],",
    ].join("\n");
    expect(parseForeshadows(src)).toEqual(["def:a", "thm:b", "rem:c"]);
  });

  test("does not match a field whose name merely ends with the target", () => {
    const src = `notuses: ["def:wrong"], uses: ["def:right"],`;
    expect(parseManifestStringArray(src, "uses")).toEqual(["def:right"]);
  });

  test("handles a nested array without stopping at its inner bracket", () => {
    const src = `uses: ["a:b", ["c:d"], "e:f"],`;
    expect(parseManifestStringArray(src, "uses")).toEqual(["a:b", "c:d", "e:f"]);
  });

  test("absent field yields nothing", () => {
    expect(parseManifestStringArray('tags: ["x"]', "uses")).toEqual([]);
  });

  test("empty array yields nothing", () => {
    expect(parseManifestStringArray("uses: [],", "uses")).toEqual([]);
  });

  test("an unterminated array yields nothing rather than running away", () => {
    expect(parseManifestStringArray('uses: ["a:b",', "uses")).toEqual([]);
  });

  test("single quotes are accepted, matching the old behaviour", () => {
    expect(parseManifestStringArray("uses: ['def:a'],", "uses")).toEqual(["def:a"]);
  });
});
