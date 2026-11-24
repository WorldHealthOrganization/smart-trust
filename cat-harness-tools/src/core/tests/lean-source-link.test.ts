import { describe, expect, test } from "bun:test";
import { declarationLine, leanSourceUrl } from "../lean-source-link.js";

describe("lean-source-link: a block's Lean link is the declaration's source on GitHub (og5t, ruling A)", () => {
  const src = [
    "import Mathlib",
    "",
    "namespace QOU.Torsion",
    "",
    "theorem lifting_exists_aux : True := trivial",
    "",
    "@[simp] noncomputable def lifting_exists (q : ℝ) : ℝ := q",
    "",
    "theorem Bar.foo : 1 = 1 := rfl",
    "lemma foo : 2 = 2 := rfl",
    "end QOU.Torsion",
  ].join("\n");

  test("a dotted name is found by its last segment inside its namespace, past attributes and modifiers", () => {
    expect(declarationLine(src, "QOU.Torsion.lifting_exists")).toBe(7);
  });

  test("a name does not match a longer one that starts with it", () => {
    expect(declarationLine(src, "lifting_exists_aux")).toBe(5);
    expect(declarationLine("theorem foo_bar : True := trivial", "foo")).toBeUndefined();
  });

  test("the name as written wins over its last segment", () => {
    expect(declarationLine(src, "Bar.foo")).toBe(9);
    expect(declarationLine(src, "foo")).toBe(10);
  });

  test("a name only mentioned, not declared, has no line", () => {
    expect(declarationLine("-- see lifting_exists\nexample : True := trivial", "lifting_exists")).toBeUndefined();
    expect(declarationLine(src, "")).toBeUndefined();
  });

  test("the link is a GitHub blob URL at the commit, with the line", () => {
    expect(leanSourceUrl("https://github.com/litlfred/qou", "77e7f0e", "folio/qou/lean/QOU/A.lean", 7)).toBe(
      "https://github.com/litlfred/qou/blob/77e7f0e/folio/qou/lean/QOU/A.lean#L7",
    );
    expect(leanSourceUrl("https://github.com/litlfred/qou/", "77e7f0e", "./a b.lean")).toBe(
      "https://github.com/litlfred/qou/blob/77e7f0e/a%20b.lean",
    );
  });

  test("no link for another host, a moving ref, or missing facts", () => {
    expect(leanSourceUrl("https://gitlab.com/o/r", "77e7f0e", "a.lean")).toBeUndefined();
    expect(leanSourceUrl("https://github.com/o/r", "main", "a.lean")).toBeUndefined();
    expect(leanSourceUrl(undefined, "77e7f0e", "a.lean")).toBeUndefined();
    expect(leanSourceUrl("https://github.com/o/r", undefined, "a.lean")).toBeUndefined();
    expect(leanSourceUrl("https://github.com/o/r", "77e7f0e", "")).toBeUndefined();
  });
});
