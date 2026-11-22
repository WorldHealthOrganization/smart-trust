/**
 * `splitDeclarations` cuts each declaration into signature and body. Its
 * doc comment always said "at the first **top-level** `:=` or `where`";
 * the implementation was `text.search(/:=|\bwhere\b/)`, which finds the
 * first one *anywhere*.
 *
 * A theorem statement may legitimately contain `:=` — a `let`, a
 * structure instance, an anonymous constructor — and every consumer of
 * the split degrades quietly when the cut lands inside one:
 *
 * - `lean-signature` hashes the truncated signature, so a changed
 *   statement can hash identically and never invalidate its QA sidecar;
 * - `lean-triviality-probe` splices its tactic over the statement, the
 *   file stops elaborating, and the declaration is recorded as
 *   "not machine-trivial";
 * - scan mode files statement text under `value_deps`.
 *
 * None of the three surfaces an error. That is what these pin.
 */
import { describe, expect, test } from "bun:test";
import { splitDeclarations, stripLeanComments, topLevelCut } from "../../pipeline/lean-lexer";

/** The cut exactly as it was before the fix, for the equivalence check. */
const oldCut = (t: string) => t.search(/:=|\bwhere\b/);

/** Declarations whose first `:=` is already top-level — must not move. */
const UNCHANGED = [
  `theorem t (n : Nat) : n + 0 = n := by rfl\n`,
  `theorem t {α : Type} (xs : List α) : xs ++ [] = xs := by simp\n`,
  `theorem t [Group G] (g : G) : g * 1 = g := by simp\n`,
  `theorem t (n : Nat)\n    (h : n > 0) :\n    n ≥ 1 := by omega\n`,
  `structure Foo where\n  a : Nat\n`,
  `inductive Bar\n  | mk\n`,
  `def f (n : Nat) : Nat := g n where g := id\n`,
  `@[simp] theorem t : True := by trivial\n`,
  `theorem t' (h' : True) : True := h'\n`,
  `theorem t : ∀ n : Nat, n = n := fun n => rfl\n`,
  `theorem t : True ∧ True := ⟨trivial, trivial⟩\n`,
  `theorem t : (⟨1, by simp⟩ : Sub).val = 1 := by rfl\n`,
];

/** Declarations the old cut got wrong, with the offset it should find. */
const NESTED: Array<[string, string]> = [
  [`theorem t : (let x := 5; x) = 5 := by rfl\n`, `theorem t : (let x := 5; x) = 5 `],
  [`theorem t : ({ a := 1 } : Foo).a = 1 := by rfl\n`, `theorem t : ({ a := 1 } : Foo).a = 1 `],
  [
    `theorem t (n : Nat) : (let y := n; let z := y; z) = n := by rfl\n`,
    `theorem t (n : Nat) : (let y := n; let z := y; z) = n `,
  ],
  [`theorem t : parse "x := 1" = ok := by rfl\n`, `theorem t : parse "x := 1" = ok `],
  [`theorem t : f (g where h := 1) = c := by rfl\n`, `theorem t : f (g where h := 1) = c `],
];

describe("topLevelCut", () => {
  test("agrees with the old cut on every already-correct declaration", () => {
    // The fix must be a strict repair: it may only move cuts that were
    // landing inside a statement. Anything else is a silent reindexing
    // of every statement hash in every folio.
    for (const src of UNCHANGED) {
      expect({ src, cut: topLevelCut(src) }).toEqual({ src, cut: oldCut(src) });
    }
  });

  test("skips `:=` nested in brackets, braces, anonymous constructors", () => {
    for (const [src, expectedSig] of NESTED) {
      expect({ src, sig: src.slice(0, topLevelCut(src)) }).toEqual({ src, sig: expectedSig });
    }
  });

  test("skips `:=` inside a string literal, escapes included", () => {
    const src = `theorem t : parse "a \\" := b" = ok := by rfl\n`;
    expect(src.slice(0, topLevelCut(src))).toBe(`theorem t : parse "a \\" := b" = ok `);
  });

  test("does not treat a prime-suffixed identifier as the `where` keyword", () => {
    // JS `\b` counts `'` as a boundary, so `\bwhere\b` matched inside
    // `h'where`. Lean identifiers may carry primes; the boundary has to
    // use Lean's identifier class, not JS's.
    const src = `theorem t (h'where : True) : True := h'where\n`;
    expect(src.slice(0, topLevelCut(src))).toBe(`theorem t (h'where : True) : True `);
  });

  test("returns -1 when there is no top-level cut at all", () => {
    expect(topLevelCut(`theorem stated : True\n`)).toBe(-1);
    // Every `:=` nested: no body, rather than a cut inside the type.
    expect(topLevelCut(`theorem t : (let x := 5; x) = 5\n`)).toBe(-1);
  });

  test("a stray closing bracket does not mask every later cut", () => {
    // Span boundaries can chop mid-term. If depth went negative the
    // scan would never see depth 0 again and the whole declaration
    // would read as body-less.
    expect(topLevelCut(`theorem t : f x) = y := by rfl\n`)).toBeGreaterThan(0);
  });

  test("the cut always lands on a real `:=` or `where`", () => {
    for (const src of [...UNCHANGED, ...NESTED.map((n) => n[0])]) {
      const c = topLevelCut(src);
      if (c === -1) continue;
      expect(src.startsWith(":=", c) || src.startsWith("where", c)).toBe(true);
    }
  });
});

describe("splitDeclarations", () => {
  test("body starts at the top-level `:=`, not one inside the statement", () => {
    const src = `theorem t : (let x := 5; x) = 5 := by rfl\n`;
    const [d] = splitDeclarations(stripLeanComments(src));
    expect(d.signature).toBe(`theorem t : (let x := 5; x) = 5 `);
    expect(d.body).toBe(`:= by rfl\n`);
  });

  test("bodyAt is an absolute offset that slices the original source", () => {
    // The probe splices with this offset. `indexOf` was used before,
    // which finds the FIRST matching body text — and `:= by rfl` is not
    // distinctive, so it could rewrite a different declaration.
    const src = `theorem a : True := by trivial\n\ntheorem b : True := by trivial\n`;
    const decls = splitDeclarations(stripLeanComments(src));
    const b = decls.find((d) => d.name === "b")!;
    expect(src.slice(b.bodyAt, b.bodyAt + b.body.length)).toBe(b.body);
    // And it is the SECOND one, not the first identical body.
    expect(b.bodyAt).toBeGreaterThan(decls.find((d) => d.name === "a")!.bodyAt);
  });

  test("a body-less declaration reports bodyAt -1, not 0", () => {
    // 0 is a valid offset; -1 is the only value that cannot be mistaken
    // for "the body is at the start of the file".
    const [d] = splitDeclarations(stripLeanComments(`theorem stated : True\n`));
    expect(d.body).toBe("");
    expect(d.bodyAt).toBe(-1);
  });

  test("offsets survive comment stripping", () => {
    // `bodyAt` indexes the stripped text but is used against the
    // original, which is only sound because stripping blanks in place.
    const src = `/-- doc with := inside -/\ntheorem t : True := by trivial\n`;
    const [d] = splitDeclarations(stripLeanComments(src));
    expect(src.slice(d.bodyAt, d.bodyAt + d.body.length)).toBe(d.body);
    expect(d.body.trimStart().startsWith(":=")).toBe(true);
  });
});
