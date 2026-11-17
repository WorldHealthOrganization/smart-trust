/**
 * `actor-capabilities-resolve` reads capabilities over the layers the actors
 * came from.
 *
 * The defect: the platform's run overlays every layer above it for ACTORS
 * (`checkoutActors`) but read CAPABILITIES from the platform's
 * `scenarios/capabilities/` alone, so `folio-assistant-sci`'s `lean-mcp`,
 * claiming the `lean-toolchain` capability that same layer declares, was
 * reported unresolved — CRITICAL. Built as a throwaway tree, never the live
 * repository.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { checkoutActors, neededActors } from "../../schemas/process/scenario-overlay.js";
import { declaredCapabilityIds, unresolvedActorCapabilities } from "../lib/actor-capabilities.ts";

const SCENARIOS = [{ id: "scenarios", path: "scenarios/", graphTypologies: ["scenarios"] }];

function put(root: string, inst: string, sub: string, file: string, body: object): void {
  mkdirSync(join(root, inst, "scenarios", sub), { recursive: true });
  writeFileSync(join(root, inst, "scenarios", sub, `${file}.json`), JSON.stringify(body));
}

/** cat-harness ← sci (declares an actor and the capability it claims); cat-harness ← sibling. */
function checkout(): string {
  const root = mkdtempSync(join(tmpdir(), "actor-caps-"));
  const decl = (name: string, needs: string[]): void => {
    mkdirSync(join(root, name), { recursive: true });
    writeFileSync(join(root, name, `${name}.json`), JSON.stringify({ name, ...(needs.length ? { needs } : {}), directories: SCENARIOS }));
  };
  decl("cat-harness", []);
  decl("sci", ["cat-harness"]);
  decl("sibling", ["cat-harness"]);
  put(root, "cat-harness", "capabilities", "git-read", { id: "git-read", title: "git read" });
  put(root, "cat-harness", "actors", "admin", { id: "admin", title: "Administrator", kind: "person", capabilities: ["git-read"] });
  put(root, "sci", "capabilities", "lean-toolchain", { id: "lean-toolchain", title: "Lean toolchain" });
  put(root, "sci", "actors", "lean-mcp", { id: "lean-mcp", title: "Lean MCP", kind: "system", capabilities: ["lean-toolchain", "git-read"] });
  put(root, "sibling", "capabilities", "sibling-only", { id: "sibling-only", title: "Sibling only" });
  return root;
}

const PLATFORM_ACTORS = (root: string) => join(root, "cat-harness", "scenarios", "actors");
const PLATFORM_CAPS = (root: string) => join(root, "cat-harness", "scenarios", "capabilities");

describe("actor-capabilities-resolve — capabilities over the actors' layers", () => {
  test("on the checkout run, a higher instance's actor claiming that instance's own capability resolves", () => {
    const root = checkout();
    try {
      const platform = join(root, "cat-harness");
      const actors = checkoutActors(platform, PLATFORM_ACTORS(root));
      // Anti-vacuity: the overlay did bring the higher layer's actor in.
      expect(actors.map((a) => a.id).sort()).toEqual(["admin", "lean-mcp"]);
      const caps = declaredCapabilityIds(platform, PLATFORM_CAPS(root), "checkout");
      expect(caps.has("lean-toolchain")).toBe(true);
      expect(unresolvedActorCapabilities(platform, actors, caps)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("the platform's registry alone does not hold it: the defect, reported as a finding", () => {
    const root = checkout();
    try {
      const platform = join(root, "cat-harness");
      const actors = checkoutActors(platform, PLATFORM_ACTORS(root));
      const caps = declaredCapabilityIds(platform, PLATFORM_CAPS(root), "own");
      expect([...caps]).toEqual(["git-read"]);
      const findings = unresolvedActorCapabilities(platform, actors, caps);
      expect(findings).toHaveLength(1);
      expect(findings[0].where).toBe("lean-mcp");
      expect(findings[0].detail).toContain('claims capability "lean-toolchain"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("on an --instance run, the instance's own capability resolves; a sibling's is not read", () => {
    const root = checkout();
    try {
      const sci = join(root, "sci");
      const actors = neededActors(sci, PLATFORM_ACTORS(root));
      const caps = declaredCapabilityIds(sci, PLATFORM_CAPS(root), "needed");
      expect([...caps].sort()).toEqual(["git-read", "lean-toolchain"]);
      expect(unresolvedActorCapabilities(sci, actors, caps)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a capability no layer declares is still a finding", () => {
    const root = checkout();
    try {
      put(root, "sci", "actors", "lean-atlas", { id: "lean-atlas", title: "Atlas", kind: "system", capabilities: ["nowhere"] });
      const platform = join(root, "cat-harness");
      const actors = checkoutActors(platform, PLATFORM_ACTORS(root));
      const caps = declaredCapabilityIds(platform, PLATFORM_CAPS(root), "checkout");
      const findings = unresolvedActorCapabilities(platform, actors, caps);
      expect(findings.map((f) => `${f.where}:${f.detail.match(/"([^"]+)"/)?.[1]}`)).toEqual(["lean-atlas:nowhere"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
