import { describe, expect, test } from "bun:test";
import {
  parseMdBlockRefs,
  deriveForeshadows,
} from "../../pipeline/qa-checkers-extended";

describe("parseMdBlockRefs", () => {
  test("reads markdown links", () => {
    expect(parseMdBlockRefs("see [the thing](#prop:foo) for more")).toEqual(["prop:foo"]);
  });

  test("reads backtick mentions", () => {
    expect(parseMdBlockRefs("as `conj:bar` shows")).toEqual(["conj:bar"]);
  });

  test("de-duplicates across both forms", () => {
    const md = "[x](#prop:foo) and `prop:foo` again and [y](#prop:foo)";
    expect(parseMdBlockRefs(md)).toEqual(["prop:foo"]);
  });

  test("ignores glossary term slugs — a different namespace", () => {
    // :refterm/:defterm carry lowercase-hyphen term slugs owned by `defines`,
    // not `kind:label` block labels. Including them would invent pointers to
    // blocks that do not exist.
    const md = "the :refterm[braided monoidal category]{#braided-monoidal-category} is";
    expect(parseMdBlockRefs(md)).toEqual([]);
  });

  test("ignores prose that merely looks label-ish", () => {
    expect(parseMdBlockRefs("ratio 3:4 and http://x.example/y")).toEqual([]);
  });

  test("empty narrative yields nothing", () => {
    expect(parseMdBlockRefs("")).toEqual([]);
  });
});

describe("deriveForeshadows", () => {
  // Reading order: a=0, b=1, c=2, d=3
  const pos: Record<string, number> = {
    "rem:a": 0,
    "prop:b": 1,
    "thm:c": 2,
    "def:d": 3,
  };
  const positionOf = (l: string) => pos[l];
  const known = (l: string) => l in pos;

  test("keeps a forward reference that is not a dependency", () => {
    const md = "[later](#thm:c)";
    expect(deriveForeshadows("rem:a", md, [], positionOf, known)).toEqual(["thm:c"]);
  });

  test("drops a BACKWARD reference — a foreshadow must point forward", () => {
    const md = "[earlier](#rem:a)";
    expect(deriveForeshadows("def:d", md, [], positionOf, known)).toEqual([]);
  });

  test("drops a reference already declared in uses[] — that is a dependency", () => {
    const md = "[later](#thm:c)";
    expect(deriveForeshadows("rem:a", md, ["thm:c"], positionOf, known)).toEqual([]);
  });

  test("drops a self-reference", () => {
    expect(deriveForeshadows("rem:a", "[me](#rem:a)", [], positionOf, known)).toEqual([]);
  });

  test("drops an unresolvable label rather than inventing a pointer", () => {
    const md = "[ghost](#prop:does-not-exist)";
    expect(deriveForeshadows("rem:a", md, [], positionOf, known)).toEqual([]);
  });

  test("a block with no reading-order position derives nothing", () => {
    // Unlisted in any chapter manifest: there is no "forward" to speak of.
    expect(deriveForeshadows("rem:unlisted", "[x](#thm:c)", [], positionOf, known)).toEqual([]);
  });

  test("returns sorted, de-duplicated results across both ref forms", () => {
    const md = "[c](#thm:c) `def:d` [c again](#thm:c) `thm:c`";
    expect(deriveForeshadows("rem:a", md, [], positionOf, known)).toEqual([
      "def:d",
      "thm:c",
    ]);
  });

  test("derived and uses[] are disjoint by construction", () => {
    // This is what makes the union behaviour-neutral for the cost metrics:
    // they iterate the uses graph, and nothing derived can appear there.
    const md = "[b](#prop:b) [c](#thm:c) [d](#def:d)";
    const derived = deriveForeshadows("rem:a", md, ["prop:b"], positionOf, known);
    expect(derived).toEqual(["def:d", "thm:c"]);
    expect(derived).not.toContain("prop:b");
  });
});
