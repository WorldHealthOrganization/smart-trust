/**
 * `uses[]` is the editorial relation AGENTS.md makes every ordering
 * metric depend on. It was read out of `.ts` source by four independent
 * hand-rolled parsers; measured against five plausible inputs, the
 * audits' copy got three wrong — and two of those three did something
 * worse than return nothing:
 *
 *   uses: ["def:x[0]", "thm:y"]                  ->  []
 *   causes: ["not-a-dep"], uses: ["def:real"]    ->  ["not-a-dep"]
 *
 * The first is a block that silently loses its dependencies. The second
 * is a block that silently acquires someone else's — a plausible-looking
 * list of labels that were never dependencies at all.
 *
 * Both shapes reach content: `prune-transitive-deps` used the same
 * boundary-less pattern on its WRITE path, so it could rewrite a
 * `causes:` field as `uses:`.
 */
import { describe, expect, test } from "bun:test";
import {
  parseUsesField,
  findUsesField,
  findArrayField,
  replaceUsesArray,
  removeUsesField,
  stripArrayField,
} from "../../pipeline/uses-field";

const BLOCK = (fields: string) => `export default theorem({ label: "thm:a", ${fields} });\n`;

describe("parseUsesField", () => {
  test("reads a plain array", () => {
    expect(parseUsesField(BLOCK(`uses: ["def:x", "thm:y"]`))).toEqual(["def:x", "thm:y"]);
  });

  test("keeps an entry containing a bracket", () => {
    // Stopping at the first `]` yielded [] — the block read as having
    // no editorial dependencies at all.
    expect(parseUsesField(BLOCK(`uses: ["def:x[0]", "thm:y"]`))).toEqual([
      "def:x[0]",
      "thm:y",
    ]);
  });

  test("does not match a field whose name merely ENDS in `uses`", () => {
    // `indexOf("uses:")` matched inside `causes:` and then returned that
    // array. This is the false-edge case, and it is worse than a miss:
    // the result looks like a real dependency list.
    expect(parseUsesField(BLOCK(`causes: ["not-a-dep"], uses: ["def:real"]`))).toEqual([
      "def:real",
    ]);
    expect(parseUsesField(BLOCK(`misuses: ["nope"], uses: ["def:real"]`))).toEqual([
      "def:real",
    ]);
    expect(parseUsesField(BLOCK(`reuses: ["nope"], uses: ["def:real"]`))).toEqual([
      "def:real",
    ]);
  });

  test("is not fooled by `uses:` appearing inside a string", () => {
    expect(
      parseUsesField(BLOCK(`statement: "this uses: nothing", tags: ["wrong"], uses: ["def:real"]`)),
    ).toEqual(["def:real"]);
  });

  test("an empty array stays empty and does not borrow a later one", () => {
    expect(parseUsesField(BLOCK(`uses: [], tags: ["not-a-dep"]`))).toEqual([]);
  });

  test("multiline arrays, trailing commas, single quotes", () => {
    expect(
      parseUsesField(`export default theorem({
  label: "thm:a",
  uses: [
    "def:x",
    'thm:y',
  ],
});
`),
    ).toEqual(["def:x", "thm:y"]);
  });

  test("no `uses` field at all yields []", () => {
    expect(parseUsesField(BLOCK(`tags: ["t"]`))).toEqual([]);
  });

  test("a non-literal `uses` value does not borrow the next array", () => {
    // `uses: SHARED` is not readable by a scanner. Reporting the next
    // array along would invent dependencies; skipping to a real
    // `uses: [...]` later, or reporting none, is honest.
    expect(parseUsesField(BLOCK(`uses: SHARED_DEPS, tags: ["not-a-dep"]`))).toEqual([]);
  });
});

describe("findUsesField", () => {
  test("distinguishes an absent field from an empty one", () => {
    // A writer must not append a field that was never there.
    expect(findUsesField(BLOCK(`tags: ["t"]`))).toBeUndefined();
    expect(findUsesField(BLOCK(`uses: []`))?.entries).toEqual([]);
  });

  test("offsets bound exactly the array literal", () => {
    const src = BLOCK(`uses: ["def:x[0]"]`);
    const f = findUsesField(src)!;
    expect(src.slice(f.arrayStart, f.arrayEnd)).toBe(`["def:x[0]"]`);
    expect(src.slice(f.fieldStart, f.fieldStart + 4)).toBe("uses");
  });
});

describe("replaceUsesArray — the write path", () => {
  test("rewrites uses[] and leaves a `causes:` field untouched", () => {
    // The regression that matters: `/uses:\s*\[[\s\S]*?\]/` matched
    // `causes: [...]` first, so applying a pruning REWROTE THAT FIELD.
    const src = BLOCK(`causes: ["keep-me"], uses: ["a", "b"]`);
    const out = replaceUsesArray(src, `["a"]`);
    expect(out).toContain(`causes: ["keep-me"]`);
    expect(out).toContain(`uses: ["a"]`);
    expect(parseUsesField(out)).toEqual(["a"]);
  });

  test("does not truncate an array whose entry holds a bracket", () => {
    const src = BLOCK(`uses: ["def:x[0]", "thm:y"], tags: ["t"]`);
    const out = replaceUsesArray(src, `["def:x[0]"]`);
    expect(out).toContain(`tags: ["t"]`);
    expect(parseUsesField(out)).toEqual(["def:x[0]"]);
  });

  test("leaves text unchanged when there is no uses field", () => {
    const src = BLOCK(`tags: ["t"]`);
    expect(replaceUsesArray(src, `["x"]`)).toBe(src);
  });

  test("a replace round-trip is stable", () => {
    const src = BLOCK(`uses: ["a", "b"]`);
    const once = replaceUsesArray(src, `["a"]`);
    expect(replaceUsesArray(once, `["a"]`)).toBe(once);
  });
});

describe("removeUsesField", () => {
  test("removes the field and its trailing comma", () => {
    const src = `export default theorem({
  label: "thm:a",
  uses: ["def:x"],
  tags: ["t"],
});
`;
    const out = removeUsesField(src);
    expect(findUsesField(out)).toBeUndefined();
    expect(out).toContain(`label: "thm:a"`);
    expect(out).toContain(`tags: ["t"]`);
    // No orphaned blank line where the field used to be.
    expect(out).not.toMatch(/\n\s*\n\s*tags/);
  });

  test("removes only the uses field, not a similarly named one", () => {
    const src = `export default theorem({
  causes: ["keep-me"],
  uses: ["def:x"],
});
`;
    const out = removeUsesField(src);
    expect(out).toContain(`causes: ["keep-me"]`);
    expect(findUsesField(out)).toBeUndefined();
  });
});

describe("stripArrayField", () => {
  test("strips the whole array, including entries holding brackets", () => {
    const src = BLOCK(`uses: ["def:x[0]", "lp-dual"], script: "s.py"`);
    const out = stripArrayField(src, "uses");
    expect(out).not.toContain("lp-dual");
    expect(out).toContain(`script: "s.py"`);
  });

  test("strips every occurrence and terminates", () => {
    const src = `a: ["1"], cites: ["x"], b: 2, cites: ["y"], c: 3`;
    const out = stripArrayField(src, "cites");
    expect(out).not.toContain('"x"');
    expect(out).not.toContain('"y"');
    expect(out).toContain('a: ["1"]');
  });

  test("leaves a similarly named field alone", () => {
    const src = `recites: ["keep"], cites: ["drop"]`;
    const out = stripArrayField(src, "cites");
    expect(out).toContain('recites: ["keep"]');
    expect(out).not.toContain('"drop"');
  });
});

describe("findArrayField generalises without loosening the boundary", () => {
  test("finds a named field", () => {
    expect(findArrayField(BLOCK(`cites: ["bib:x"]`), "cites")?.entries).toEqual(["bib:x"]);
  });

  test("a field name that is a suffix of another is not matched", () => {
    expect(findArrayField(BLOCK(`recites: ["nope"]`), "cites")).toBeUndefined();
  });
});
