/**
 * The navbar icon row — WHICH icons, and whose answer it is.
 *
 * Owner, 2026-09-22, on where the list lives: *"should be in each harness
 * config which are shown (so some could show none, but make this default in
 * cat-harness that is inherited)."*
 *
 * That sentence names THREE states, and this file exists because two of them
 * look alike in every shape that gets written by accident:
 *
 * | declaration | means | resolves to |
 * |---|---|---|
 * | absent | *this layer has not decided* | whatever its `needs` chain, or the floor, decided |
 * | `[]` | *show none* — the owner asked for it by name | `[]`, and the walk STOPS |
 * | a list | *this layer's own answer* | that list |
 *
 * A guard written as `if (own)` collapses the middle row into the top one, and
 * the resulting page is indistinguishable from an un-migrated layer's. The
 * implementation guards on `!== undefined` for that reason; the tests below are
 * what stops it drifting back.
 *
 * The row shipped in #959 with NO test at either layer — a measurement taken
 * after the fact, not a suspicion — so this covers the resolver and
 * `navbar-row.e2e.ts` covers what the page does with its answer.
 *
 * @module schemas/navbar-icons.test
 */
import { describe, expect, test } from "bun:test";

import {
  NAVBAR_ICONS,
  NavbarIconsSchema,
  readDeclaration,
  resolveNavbarIcons,
  type NavbarIcon,
} from "./kg/cat-harness.js";

import { requireHarnessRoot } from "./harness-root.ts";
const ROOT = requireHarnessRoot();

/** The two maps `resolveNavbarIcons` walks, built from a readable literal. */
function world(
  spec: Record<string, { icons?: readonly NavbarIcon[]; needs?: readonly string[] }>,
): {
  declared: ReadonlyMap<string, readonly NavbarIcon[] | undefined>;
  needs: ReadonlyMap<string, readonly string[] | undefined>;
} {
  const declared = new Map<string, readonly NavbarIcon[] | undefined>();
  const needs = new Map<string, readonly string[] | undefined>();
  for (const [name, s] of Object.entries(spec)) {
    // `has(name)` with an `undefined` value is the "key present, did not
    // declare" case the resolver's own doc calls out, and it is set here
    // deliberately: a missing key and a present-but-undefined one must behave
    // the same, and only setting it proves the second half.
    declared.set(name, s.icons);
    needs.set(name, s.needs);
  }
  return { declared, needs };
}

describe("three states, and the middle one is the point", () => {
  test("a list is the instance's own answer and outranks what it needs", () => {
    const { declared, needs } = world({
      leaf: { icons: ["todos", "beans"], needs: ["base"] },
      base: { icons: [...NAVBAR_ICONS] },
    });
    expect(resolveNavbarIcons("leaf", declared, needs, "base")).toEqual(["todos", "beans"]);
  });

  test("ABSENT inherits — the nearest declaration up the `needs` chain wins", () => {
    const { declared, needs } = world({
      leaf: { needs: ["mid"] },
      mid: { icons: ["kg"], needs: ["base"] },
      base: { icons: [...NAVBAR_ICONS] },
    });
    expect(resolveNavbarIcons("leaf", declared, needs, "base")).toEqual(["kg"]);
  });

  test("`[]` means SHOW NONE, and stops the walk rather than inheriting over it", () => {
    // The failure this pins: `if (own)` is falsy for `[]`, so the resolver
    // would walk past a layer that said "none" and hand back six icons.
    // Empty and absent are different answers; only one of them is a decision.
    const { declared, needs } = world({
      leaf: { icons: [], needs: ["base"] },
      base: { icons: [...NAVBAR_ICONS] },
    });
    expect(resolveNavbarIcons("leaf", declared, needs, "base")).toEqual([]);
  });

  test("`undefined` is the THIRD state — nobody decided, and that is not `[]`", () => {
    // A caller that renders this as an empty row reports an un-migrated
    // layer as a deliberate one. The resolver must say "nobody said".
    const { declared, needs } = world({ lonely: {} });
    expect(resolveNavbarIcons("lonely", declared, needs)).toBeUndefined();
    // ...and it is distinguishable from the row above, which is the whole test.
    expect(resolveNavbarIcons("lonely", declared, needs)).not.toEqual([]);
  });

  test("the FLOOR answers only when the walk reached nobody who had", () => {
    const { declared, needs } = world({
      island: {}, // no `needs` at all — who-iris's live shape
      floor: { icons: ["launcher"] },
    });
    expect(resolveNavbarIcons("island", declared, needs, "floor")).toEqual(["launcher"]);
    // ...and it does not override a layer that DID decide, including `[]`.
    const quiet = world({ island: { icons: [] }, floor: { icons: ["launcher"] } });
    expect(resolveNavbarIcons("island", quiet.declared, quiet.needs, "floor")).toEqual([]);
  });

  test("a floor already visited is not consulted twice", () => {
    // `!seen.has(floor)` — the floor is in the chain here and declared nothing,
    // so the answer is `undefined`, not a second look that would find the same
    // nothing. Cheap to hold, and it is what makes the fallback a FALLBACK.
    const { declared, needs } = world({ leaf: { needs: ["floor"] }, floor: {} });
    expect(resolveNavbarIcons("leaf", declared, needs, "floor")).toBeUndefined();
  });
});

describe("the walk is breadth-first, and it terminates", () => {
  test("a nearer layer beats a deeper one", () => {
    const { declared, needs } = world({
      leaf: { needs: ["near", "far"] },
      near: { icons: ["todos"] },
      far: { icons: ["beans"] },
    });
    expect(resolveNavbarIcons("leaf", declared, needs)).toEqual(["todos"]);
  });

  test("a `needs` cycle does not hang — the finding belongs elsewhere", () => {
    // `check:harness-dirs` and the dependency order own reporting a cycle.
    // Here it must simply return, which a `seen` set is the whole reason for.
    const { declared, needs } = world({ a: { needs: ["b"] }, b: { needs: ["a"] } });
    expect(resolveNavbarIcons("a", declared, needs)).toBeUndefined();
  });

  test("an instance that needs something undeclared resolves rather than throwing", () => {
    const { declared, needs } = world({ leaf: { needs: ["ghost"] } });
    expect(resolveNavbarIcons("leaf", declared, needs)).toBeUndefined();
  });
});

describe("the schema holds the owner's cap", () => {
  test("eight is allowed; a ninth is REFUSED, never truncated", () => {
    // Truncating drops whichever the layer listed last, silently. A
    // layer that declared eight made a decision, and overruling it without
    // saying so is the failure the `.max(8)` message names.
    expect(NavbarIconsSchema.safeParse([...NAVBAR_ICONS]).success).toBe(true);
    expect(NAVBAR_ICONS.length).toBe(8);
    const nine = [...NAVBAR_ICONS, "todos"];
    expect(NavbarIconsSchema.safeParse(nine).success).toBe(false);
  });

  test("an icon listed twice is two slots doing one job", () => {
    expect(NavbarIconsSchema.safeParse(["todos", "todos"]).success).toBe(false);
  });

  test("the set is CLOSED — a name nothing draws is refused at the declaration", () => {
    // A free string would put a slot in a six-wide row that renders nothing,
    // and a navbar that lost something reads as a broken site rather than as
    // a typo in a JSON file.
    expect(NavbarIconsSchema.safeParse(["kg"]).success).toBe(true);
    expect(NavbarIconsSchema.safeParse(["kgviewer"]).success).toBe(false);
  });

  test("`[]` PARSES — the owner asked for it and the schema must not forbid it", () => {
    expect(NavbarIconsSchema.safeParse([]).success).toBe(true);
  });
});

describe("the live declarations", () => {
  test("cat-harness is the floor, and it is the one that declares", () => {
    // *"make this default in cat-harness that is inherited"*. Read from the
    // declaration rather than retyped: a fixture that restates the value under
    // test cannot catch a wrong one.
    const decl = readDeclaration(ROOT);
    expect(decl?.name).toBe("cat-harness");
    // A SUBSET of the vocabulary since 2026-10-05: the owner dropped
    // processes and the knowledge graph from the row (bean `82qs`).
    expect(NavbarIconsSchema.safeParse(decl?.navbarIcons).success).toBe(true);
    expect(decl?.navbarIcons).not.toContain("processes");
    expect(decl?.navbarIcons).not.toContain("kg");
  });
});
