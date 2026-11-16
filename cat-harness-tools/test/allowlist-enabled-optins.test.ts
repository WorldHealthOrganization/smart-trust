/**
 * A downstream's named directory list still mounts the opt-in sub-graphs it
 * switches on (directly or through `requires`), so the switch resolves.
 */
import { describe, expect, test } from "bun:test";
import { withEnabledOptIns } from "../scripts/remote-mount.ts";
import { closeOverRequires, enabledSubgraphsFrom } from "../schemas/kg/opt-in-subgraphs.ts";

const decl = {
  directories: [
    { id: "skills", path: "skills/" },
    { id: "collab", path: "collab/", optIn: true, requires: ["layer.levels"] },
    { id: "levels", path: "L/", optIn: true },
    { id: "extra", path: "extra/", optIn: true },
  ],
} as never;

describe("withEnabledOptIns", () => {
  test("an enabled group the list leaves out, and what it requires, are added", () => {
    const enabled = closeOverRequires(new Set(enabledSubgraphsFrom(["layer.collab"])), new Map([["layer.collab", ["layer.levels"]]]));
    expect(withEnabledOptIns("layer", decl, ["skills"], enabled)).toEqual(["skills", "collab", "levels"]);
  });

  test("a group the downstream does not switch on stays out", () => {
    expect(withEnabledOptIns("layer", decl, ["skills"], new Set(["layer.collab"]))).not.toContain("extra");
  });

  test("an id already named is not repeated, and the list's order is kept", () => {
    expect(withEnabledOptIns("layer", decl, ["collab", "skills"], new Set(["layer.collab"]))).toEqual(["collab", "skills"]);
  });

  test("another layer's switch does not add this layer's group", () => {
    expect(withEnabledOptIns("layer", decl, ["skills"], new Set(["other.collab"]))).toEqual(["skills"]);
  });
});
