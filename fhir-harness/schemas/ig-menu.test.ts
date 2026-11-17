import { describe, expect, test } from "bun:test";

import { IG_MENU_SCHEMA_TAG, IgMenuSchema, menuHref, menuItemCount } from "./ig-menu";
import { groupsFromSushiMenu } from "../scripts/ingest-ig-menu";

/**
 * SUSHI's `menu:` is a nested MAP whose two shapes appear in one config, so a
 * parser that assumed either would silently drop the other's entries.
 */
describe("groupsFromSushiMenu — both shapes, in file order", () => {
  test("nestedMapBecomesGroups", () => {
    const groups = groupsFromSushiMenu({
      Home: { Summary: "index.html", Dependencies: "dependencies.html" },
      Indices: { "Artifact Index": "artifacts.html", Downloads: "downloads.html" },
    });
    expect(groups.map((g) => g.label)).toEqual(["Home", "Indices"]);
    expect(groups[0]!.items).toEqual([
      { label: "Summary", href: "index.html" },
      { label: "Dependencies", href: "dependencies.html" },
    ]);
  });

  /**
   * ORDER IS THE FILE'S ORDER, never sorted: the top bar's order IS the
   * config's, and alphabetising here would silently re-navigate the IG.
   */
  test("preservesConfigOrder", () => {
    const groups = groupsFromSushiMenu({ Zeta: { a: "a.html" }, Alpha: { b: "b.html" } });
    expect(groups.map((g) => g.label)).toEqual(["Zeta", "Alpha"]);
  });

  test("bareStringIsTopLevelPage", () => {
    const [g] = groupsFromSushiMenu({ Home: "index.html" });
    expect(g).toEqual({ label: "Home", href: "index.html", items: [] });
  });

  /**
   * An entry that is neither a page nor a group is KEPT with no children. A
   * label the IG shows is a label this file should carry; one that vanished
   * here would read downstream as an IG that never had it.
   */
  test("keepsUnrecognisedEntry", () => {
    expect(groupsFromSushiMenu({ Odd: 42 })).toEqual([{ label: "Odd", items: [] }]);
  });

  test("nonObjectMenuIsEmpty", () => {
    expect(groupsFromSushiMenu(undefined)).toEqual([]);
    expect(groupsFromSushiMenu(null)).toEqual([]);
    expect(groupsFromSushiMenu(["a"])).toEqual([]);
  });
});

describe("menuHref — the join is written once", () => {
  const menu = { canonical: "http://hl7.org/fhir/uv/ips" };
  test("joinsRelativeHref", () => {
    expect(menuHref(menu, { href: "ips-overview.html" })).toBe(
      "http://hl7.org/fhir/uv/ips/ips-overview.html",
    );
  });
  test("doesNotDoubleSlash", () => {
    expect(menuHref({ canonical: "http://x.org/ig/" }, { href: "/a.html" })).toBe("http://x.org/ig/a.html");
  });
  test("leavesAbsoluteHrefAlone", () => {
    expect(menuHref(menu, { href: "https://elsewhere.org/p.html" })).toBe("https://elsewhere.org/p.html");
  });
});

describe("the schema refuses a menu with no provenance", () => {
  const valid = {
    $schema: IG_MENU_SCHEMA_TAG,
    id: "hl7.fhir.uv.ips",
    canonical: "http://hl7.org/fhir/uv/ips",
    source: {
      kind: "sushi-config" as const,
      of: "https://github.com/HL7/fhir-ips",
      ref: "0000000000000000000000000000000000000000",
      path: "sushi-config.yaml",
      readAt: "2026-09-23",
    },
    groups: [{ label: "Home", items: [{ label: "Summary", href: "index.html" }] }],
  };

  test("completeMenuParses", () => {
    expect(IgMenuSchema.safeParse(valid).success).toBe(true);
    expect(menuItemCount(valid)).toBe(1);
  });

  /**
   * The commit is what makes the menu re-derivable. Without it the file is a
   * claim about an IG with nothing behind it — which is the transcription this
   * whole ingest exists to avoid.
   */
  test("refusesMissingRef", () => {
    const { ref: _ref, ...rest } = valid.source;
    expect(IgMenuSchema.safeParse({ ...valid, source: rest }).success).toBe(false);
  });

  test("refusesNonUrlOf", () => {
    expect(
      IgMenuSchema.safeParse({ ...valid, source: { ...valid.source, of: "somewhere" } }).success,
    ).toBe(false);
  });

  /**
   * `items` is required and may be EMPTY. A group the config declares with no
   * children is legal; omitting the field would make "declared empty" and
   * "the parser lost them" the same shape.
   */
  test("emptyItemsLegalMissingItemsNot", () => {
    expect(IgMenuSchema.safeParse({ ...valid, groups: [{ label: "X", items: [] }] }).success).toBe(true);
    expect(IgMenuSchema.safeParse({ ...valid, groups: [{ label: "X" }] }).success).toBe(false);
  });
});
