/**
 * Parser tests for the mirror-drift audit.
 *
 * The parser is the whole risk surface of this checker. A sloppier version of
 * it, written ad hoc, reported 167 same-FQN pairs and 50 drifted where `main`'s
 * real figures are 147 and 46 (bean `qou-u87j`) — and three further bugs
 * surfaced only once these tests existed. Every case below is one of those
 * mistakes, kept so the numbers stay trustworthy.
 */
import { test, expect, describe } from "bun:test";
import { parseLeanDecls, parentName } from "../check-mirror-drift.ts";

// input-site: inert #bffb1353 — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
const F = "/tmp/x.lean";

describe("parseLeanDecls", () => {
  test("reads fields and the enclosing namespace", () => {
    const [d] = parseLeanDecls(
      F,
      `namespace QOU.Torsion

structure MassIdentity (R : Type*) where
  connectionGradient : M → R
  vortexCycle : Set M
  cycle_nonempty : vortexCycle.Nonempty

end QOU.Torsion
`,
    );
    expect(d.fqn).toBe("QOU.Torsion.MassIdentity");
    expect(d.kind).toBe("structure");
    expect(d.fields).toEqual([
      "connectionGradient",
      "vortexCycle",
      "cycle_nonempty",
    ]);
  });

  test("instance-implicit fields count, and their brackets are stripped", () => {
    const [d] = parseLeanDecls(
      F,
      `structure CRManifoldData where
  M : Type*
  [topM : TopologicalSpace M]
  n : ℕ
`,
    );
    expect(d.fields).toEqual(["M", "topM", "n"]);
  });

  // Mistake 1 — the expensive one. `section Foo … end Foo` is indistinguishable
  // from a namespace at the regex level, so a parser that pops only on
  // `end <name>` against a namespace-only stack mis-attributes every
  // declaration after the first named section: it invents collisions where
  // there are none and hides the real ones.
  test("a named section does not corrupt the namespace of later declarations", () => {
    const decls = parseLeanDecls(
      F,
      `namespace QOU

section Helpers

structure Inside where
  a : ℕ

end Helpers

structure After where
  b : ℕ

end QOU
`,
    );
    expect(decls.map((d) => d.fqn)).toEqual(["QOU.Inside", "QOU.After"]);
  });

  test("an anonymous section is popped too", () => {
    const decls = parseLeanDecls(
      F,
      `namespace QOU
section
structure A where
  a : ℕ
end
structure B where
  b : ℕ
end QOU
`,
    );
    expect(decls.map((d) => d.fqn)).toEqual(["QOU.A", "QOU.B"]);
  });

  // Mistake 2 — docstrings are full of prose that matches `name :`.
  test("docstring and comment lines are not read as fields", () => {
    const [d] = parseLeanDecls(
      F,
      `structure VolumeFromRigidity where
  /-- The projection \`π : V ⊗ V ↠ Λ²V\`.
      note : this line looks exactly like a field. -/
  projection : X ⟶ Y
  -- comment : also not a field
  volumeIso : Y ≅ Z
`,
    );
    expect(d.fields).toEqual(["projection", "volumeIso"]);
  });

  // Mistake 3 — inherit-vs-inline is a real difference, but it is not field
  // drift, and conflating them made the old scan's diffs unreadable.
  test("extends is captured, on the head line and wrapped onto the next", () => {
    const [inline, wrapped] = parseLeanDecls(
      F,
      `structure A extends B, C where
  x : ℕ

structure D
    extends E where
  y : ℕ
`,
    );
    expect(inline.extends).toEqual(["B", "C"]);
    expect(inline.fields).toEqual(["x"]);
    expect(wrapped.extends).toEqual(["E"]);
    expect(wrapped.fields).toEqual(["y"]);
  });

  test("a dedented declaration closes the previous body", () => {
    const decls = parseLeanDecls(
      F,
      `structure A where
  a : ℕ

def notAField : ℕ := 0

structure B where
  b : ℕ
`,
    );
    expect(decls.map((d) => [d.fqn, d.fields])).toEqual([
      ["A", ["a"]],
      ["B", ["b"]],
    ]);
  });

  test("classes are parsed like structures, and nested namespaces concatenate", () => {
    const [d] = parseLeanDecls(
      F,
      `namespace QOU
namespace LiftingDescent
class MotivicGaloisCharacter (K0 : Type*) where
  frobenius_at : Nat.Primes → Mhat
end LiftingDescent
end QOU
`,
    );
    expect(d.fqn).toBe("QOU.LiftingDescent.MotivicGaloisCharacter");
    expect(d.kind).toBe("class");
    expect(d.fields).toEqual(["frobenius_at"]);
  });

  test("field order is significant — a reordering is drift, not a match", () => {
    const [a] = parseLeanDecls(F, `structure S where\n  x : ℕ\n  y : ℕ\n`);
    const [b] = parseLeanDecls(F, `structure S where\n  y : ℕ\n  x : ℕ\n`);
    expect(a.fields).not.toEqual(b.fields);
  });

  test("records the head line so a finding can be clicked to source", () => {
    const [d] = parseLeanDecls(F, `\n\n\nstructure S where\n  x : ℕ\n`);
    expect(d.line).toBe(4);
  });
});

describe("extends comparison", () => {
  // A mirror that spells its universes explicitly is not drift. The corpus's
  // own `QOU.QuantumObservableUniverse` pair is exactly this: identical in
  // every field, differing only in `.{u, v}` on the parent. Comparing raw text
  // reported it as drift and made the gate's own baseline wrong by one.
  test("explicit universe levels on a parent are not a difference", () => {
    const [withU] = parseLeanDecls(
      F,
      `structure A (R : Type*)\n    extends B.{u, v} R where\n  x : ℕ\n`,
    );
    const [withoutU] = parseLeanDecls(
      F,
      `structure A (R : Type*)\n    extends B R where\n  x : ℕ\n`,
    );
    expect(withU.extends.map(parentName)).toEqual(
      withoutU.extends.map(parentName),
    );
  });

  test("a different parent, or a different arity, still shows", () => {
    const [one] = parseLeanDecls(F, `structure A extends B where\n  x : ℕ\n`);
    const [two] = parseLeanDecls(F, `structure A extends C where\n  x : ℕ\n`);
    const [three] = parseLeanDecls(F, `structure A extends B, C where\n  x : ℕ\n`);
    expect(one.extends.map(parentName)).not.toEqual(two.extends.map(parentName));
    expect(one.extends.map(parentName)).not.toEqual(three.extends.map(parentName));
  });
});

describe("§7c regime detection", () => {
  // Two mirrors can agree on every field NAME and still sit on opposite sides
  // of the substrate→archimedean wall. The field-name comparison scores that as
  // a faithful mirror; on qou it hid 7 such pairs.
  test("a real-typed field marks the declaration archimedean", () => {
    const [d] = parseLeanDecls(
      F,
      `structure SubstrateParameter (M : Type*) where\n  field : M → ℝ\n`,
    );
    expect(d.archimedean).toBe(true);
  });

  test("the same field over a generic ring does not", () => {
    const [d] = parseLeanDecls(
      F,
      `structure SubstrateParameter (M : Type*) where\n  field : M → R_q\n`,
    );
    expect(d.archimedean).toBe(false);
  });

  // Only the type is tested. A field merely *named* for a real is not evidence
  // — otherwise `q_real : R` would read as archimedean when its whole point is
  // that it is not (see bean qou-mt7r).
  test("the field NAME is not evidence — only the type after the colon", () => {
    const [d] = parseLeanDecls(
      F,
      `structure S where\n  real_part : R\n  q_real : R\n`,
    );
    expect(d.archimedean).toBe(false);
  });

  test("`Real` and `LinearOrderedField` count, matching the corpus regex", () => {
    const [a] = parseLeanDecls(F, `structure S where\n  x : Real\n`);
    const [b] = parseLeanDecls(F, `structure S where\n  x : LinearOrderedField k\n`);
    expect(a.archimedean).toBe(true);
    expect(b.archimedean).toBe(true);
  });

  test("an archimedean binder on the head line marks it too", () => {
    const [d] = parseLeanDecls(
      F,
      `structure S (f : M → ℝ) where\n  n : ℕ\n`,
    );
    expect(d.archimedean).toBe(true);
  });
});
