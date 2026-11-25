/**
 * Verification for bean folio-assistant-3025:
 * folio-paper-adapter skills modelled into roles (47 at the time; 53 after the syiq moves).
 *
 * Asserts:
 * 1. The 3 paper roles (lean-authoring-agent, proof-review-agent, compute-authoring-agent)
 *    exist, with personas and descriptions, in the harness's scenarios/roles.json or —
 *    since move M4 took them up with the paper skills they carry — in the paper layer's.
 * 2. Every skill in folio-paper-adapter is bound to a role or carries `consulted: true`.
 * 3. 0% unbound skills in folio-paper-adapter.
 *
 * @module scripts/tests/paper-adapter-roles.test
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { notApplicableAlone } from "../../test/support/checkout.js";

/** cat-harness's own scenarios/roles.json does not declare the three paper roles; folio-assistant-sci's does, and only a composed checkout holds it. */
const NO_PAPER_LAYER = notApplicableAlone(
  "folio-assistant-sci's scenarios/roles.json, which declares the three paper roles",
);

const ROOT = resolve(HARNESS_ROOT);
function findCoordinatorRoot(startDir: string): string {
  let curr = resolve(startDir, "..");
  while (curr !== resolve(curr, "..")) {
    if (existsSync(join(curr, "folio-assistant-sci"))) {
      return curr;
    }
    curr = resolve(curr, "..");
  }
  return resolve(startDir, "..");
}
const COORDINATOR = findCoordinatorRoot(ROOT);

describe("folio-paper-adapter role modelling (bean 3025)", () => {
  const harnessRolesPath = join(ROOT, "scenarios", "roles.json");
  const harnessRoles = JSON.parse(readFileSync(harnessRolesPath, "utf-8")) as {
    roles: Array<{ id: string; persona?: string; description?: string; actorKinds?: string[] }>;
  };

  const paperRolesPath = join(COORDINATOR, "folio-assistant-sci", "scenarios", "roles.json");
  const paperRoles = (
    existsSync(paperRolesPath) ? JSON.parse(readFileSync(paperRolesPath, "utf-8")) : {}
  ) as {
    roles?: Array<{ id: string; persona?: string; description?: string; actorKinds?: string[]; skills?: string[] }>;
    extensions?: Array<{ role: string; skills: string[] }>;
  };
  const allRoles = [...harnessRoles.roles, ...(paperRoles.roles ?? [])];

  test.skipIf(NO_PAPER_LAYER)("the three paper roles are declared, by the harness or the paper layer, with personas", () => {
    const roleIds = new Set(allRoles.map((r) => r.id));
    for (const id of ["lean-authoring-agent", "proof-review-agent", "compute-authoring-agent"]) {
      expect(roleIds.has(id)).toBe(true);
      const role = allRoles.find((r) => r.id === id)!;
      expect(role.description).toBeDefined();
      expect(role.description!.length).toBeGreaterThan(10);
      expect(role.persona).toBeDefined();
      expect(role.persona!.length).toBeGreaterThan(10);
      expect(role.actorKinds).toContain("agent");
    }
  });

  test("every skill in folio-paper-adapter is accounted for (bound or consulted: true)", () => {
    // Locate folio-paper-adapter package manifest
    const manifestCandidates = [
      join(COORDINATOR, "folio-assistant-sci", "skills", "content", "folio-paper-adapter", "package-manifest.json"),
      join(ROOT, "skills", "content", "folio-paper-adapter", "package-manifest.json"),
    ];
    const manifestPath = manifestCandidates.find((p) => existsSync(p));
    if (!manifestPath) {
      console.warn("folio-paper-adapter not found at expected paths, skipping package check");
      return;
    }

    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as { skills: string[] };
    // The manifest lists exactly the package's skill files. It was a fixed 47
    // (bean 3025's snapshot) until the syiq moves into sci grew the package to
    // 53; the set of files, not a count, is what the manifest must match.
    const adapterFiles = readdirSync(resolve(manifestPath, ".."))
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.slice(0, -3))
      .sort();
    expect([...manifest.skills].sort()).toEqual(adapterFiles);
    expect(manifest.skills.length).toBeGreaterThanOrEqual(47);

    // Locate sci scenarios/roles.json extensions
    const sciRolesPathCandidates = [
      join(COORDINATOR, "folio-assistant-sci", "scenarios", "roles.json"),
      join(ROOT, "scenarios", "roles.json"),
    ];
    const sciRolesPath = sciRolesPathCandidates.find((p) => existsSync(p));
    expect(sciRolesPath).toBeDefined();

    const sciRoles = JSON.parse(readFileSync(sciRolesPath!, "utf-8")) as {
      roles?: Array<{ id: string; skills?: string[] }>;
      extensions?: Array<{ role: string; skills: string[] }>;
    };

    const boundSkills = new Set<string>();
    for (const r of [...harnessRoles.roles, ...(sciRoles.roles ?? [])]) {
      for (const s of (r as { skills?: string[] }).skills || []) boundSkills.add(s);
    }
    for (const ext of sciRoles.extensions || []) {
      for (const s of ext.skills || []) boundSkills.add(s);
    }

    const adapterDir = resolve(manifestPath, "..");
    const unbound: string[] = [];

    for (const skill of manifest.skills) {
      if (boundSkills.has(skill)) continue;

      // Check if skill is marked consulted: true
      const mdPath = join(adapterDir, `${skill}.md`);
      if (existsSync(mdPath)) {
        const content = readFileSync(mdPath, "utf-8");
        if (/^consulted:\s*true/m.test(content)) {
          continue; // Reference skill, exempt from role binding
        }
      }

      unbound.push(skill);
    }

    expect(unbound).toEqual([]);
  });
});
