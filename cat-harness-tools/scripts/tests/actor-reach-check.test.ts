/**
 * `check:actor-reach` — what it reports, and what it refuses to call clean.
 *
 * Bean `folio-assistant-r0rq`. The interesting assertions are the two states
 * that are NOT failures: an air-gapped actor inside a connected deployment
 * (the feature's own case), and nothing declared at all (the third state,
 * reported rather than ticked).
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { buildReport } from "../check-actor-reach";
import { repoRootFor } from "../../schemas/kg/cat-harness.js";
import { writeDeclaration } from "../../test/support/instance-fixture.js";
import { actorsDir } from "../../schemas/process/role-graph.ts";

type Actor = Record<string, unknown>;

/** A throwaway layer: a harness declaration plus an actor registry. */
function instance(network: string | undefined, actors: Actor[]): string {
  const root = mkdtempSync(join(tmpdir(), "reach-"));
  const dir = join(root, ".claude", "skills", "actors");
  mkdirSync(dir, { recursive: true });
  writeDeclaration(root, JSON.stringify({
      name: "test-instance",
      description: "throwaway instance for reach tests",
      directories: [],
      ...(network ? { topology: { network } } : {}),
    }));
  for (const a of actors) writeFileSync(join(dir, `${String(a.id)}.json`), JSON.stringify(a));
  return root;
}
const actorsOf = (root: string) => join(root, ".claude", "skills", "actors");

const machine = (id: string, reach?: string): Actor => ({
  id,
  title: id,
  kind: "system",
  ...(reach ? { reach } : {}),
});

describe("buildReport", () => {
  test("an actor claiming more than its deployment grants is a conflict", () => {
    const root = instance("air-gapped", [machine("signer", "internet")]);
    const r = buildReport(actorsOf(root), root);
    expect(r.conflicts.map((c) => c.actorId)).toEqual(["signer"]);
    rmSync(root, { recursive: true, force: true });
  });

  test("an air-gapped actor inside a connected deployment is reported, not flagged", () => {
    // The owner's case. If this were a finding the list would be useless on
    // exactly the deployment the feature exists for.
    const root = instance("internet", [machine("isolated", "air-gapped")]);
    const r = buildReport(actorsOf(root), root);
    expect(r.conflicts).toEqual([]);
    expect(r.declared).toEqual([
      { id: "isolated", reach: "air-gapped", effective: "air-gapped" },
    ]);
    rmSync(root, { recursive: true, force: true });
  });

  test("an undeclared actor is `unknown`, not the deployment's value", () => {
    const root = instance("internet", [machine("quiet")]);
    const r = buildReport(actorsOf(root), root);
    expect(r.undeclared).toEqual([{ id: "quiet", effective: "unknown" }]);
    expect(r.declared).toEqual([]);
    rmSync(root, { recursive: true, force: true });
  });

  test("...except under an air-gapped deployment, which admits one value", () => {
    const root = instance("air-gapped", [machine("quiet")]);
    const r = buildReport(actorsOf(root), root);
    expect(r.undeclared).toEqual([{ id: "quiet", effective: "air-gapped" }]);
    rmSync(root, { recursive: true, force: true });
  });

  test("a deployment that declares nothing leaves every actor unknown", () => {
    const root = instance(undefined, [machine("a"), machine("b")]);
    const r = buildReport(actorsOf(root), root);
    expect(r.deployment).toBeUndefined();
    expect(r.undeclared.map((u) => u.effective)).toEqual(["unknown", "unknown"]);
    rmSync(root, { recursive: true, force: true });
  });

  test("an unreadable reach value throws rather than being coerced", () => {
    // Same reasoning as an unrecognised `kind`: coerced permissively it would
    // route a signing task to an API the machine cannot call, and the failure
    // would surface as a network error rather than a typo.
    const root = instance("internet", [machine("typo", "air gapped")]);
    expect(() => buildReport(actorsOf(root), root)).toThrow(/not a network reach/);
    rmSync(root, { recursive: true, force: true });
  });

  test("a missing registry yields no actors rather than throwing", () => {
    // The vacuity guard in `main()` is what turns this into a non-pass; the
    // reader must not throw, or the guard never runs.
    const root = mkdtempSync(join(tmpdir(), "reach-empty-"));
    writeDeclaration(root, JSON.stringify({ name: "x", description: "empty", directories: [] }));
    expect(buildReport(join(root, "nope"), root).actors).toEqual([]);
    rmSync(root, { recursive: true, force: true });
  });
});

describe("this repository's own registry", () => {
  test("is consistent, and the check examines something", () => {
    // The registry is resolved from the DECLARED `scenarios` graph (bean
    // rqao), the same call the gate makes, never spelled as a path: a test
    // that hardcodes the location passes over a registry the gate no longer
    // reads. It was `.claude/skills/actors/` until 2026-09-30.
    const INSTANCE = resolve(import.meta.dir, "../..");
    const dir = actorsDir(repoRootFor(INSTANCE));
    expect(dir).toBeDefined();
    const r = buildReport(dir!, INSTANCE);
    expect(r.actors.length).toBeGreaterThan(0);
    expect(r.conflicts).toEqual([]);
    // Not a count of declarers: that is a number this repo will change, and a
    // test that pins it reports as a failure what is really a new actor.
    expect(r.declared.length + r.undeclared.length).toBe(r.actors.length);
  });
});
