/**
 * One layer's graph does not carry another layer's nodes.
 *
 * @module scripts/tests/instance-graph-isolation.test
 *
 * The defect these guard was LIVE on `main` on 2026-09-19, not hypothetical:
 * `findBpmnDirs` walked the filesystem, so `bootstrap/processes/bootstrap.bpmn`
 * was discovered from the repository root as well as from bootstrap, and
 * `_kg/folio-assistant.jsonld` carried **88** references to `Process_InitializeHarness`.
 * CatBootstrap's process was published as part of folio-assistant's graph.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { collectInstanceNodes } from "../../kg-export.js";
import { repoRootFor } from "../../../schemas/kg/cat-harness.js";
import { writeDeclaration } from "../../../test/support/instance-fixture.js";
import { HARNESS_ROOT } from "../../lib/roots.ts";

const ROOT = resolve(HARNESS_ROOT);
const BOOT = join(repoRootFor(ROOT), "bootstrap");
const DOC = "https://example.org/x.jsonld";

const ids = (nodes: Array<Record<string, unknown>>): string[] => nodes.map((n) => String(n["@id"]));

/**
 * The ROOT layer's collection, made once for this file.
 *
 * It is a whole-corpus walk, and since `collectInstanceNodes` collects Tools
 * (bean `tdir`) it also re-homes every Tool's `satisfies` skill across every
 * layer. Measured 2026-10-15 in the CI layout: 7.1 s cold before `tdir`,
 * 9.2 s cold after, 5.3 s warm on both — so each of two calls was past bun's
 * 5 s default on its own, and which side of it the cold call landed on was
 * the runner's mood (it flipped "new failure" on PRs that did not touch it).
 * Both readers only read the nodes, so they share one promise.
 */
let rootNodes: ReturnType<typeof collectInstanceNodes> | undefined;
const rootCollection = (): ReturnType<typeof collectInstanceNodes> =>
  (rootNodes ??= collectInstanceNodes(ROOT, DOC, "", []));

/**
 * The budget for whichever test populates {@link rootCollection} first, on
 * both because test order is not guaranteed. BASIS: the 9.2 s cold collection
 * above; 60 s is ~6x it, room for a loaded runner and a growing corpus, and
 * still fails fast on a regression into something quadratic.
 */
const CORPUS_TIMEOUT = 60_000;

describe("a second instance in the tree stays out of the first's graph", () => {
  test("the root instance's nodes include none of bootstrap's process", async () => {
    const { nodes } = await rootCollection();
    expect(ids(nodes).filter((i) => i.includes("Process_InitializeHarness"))).toEqual([]);
  }, CORPUS_TIMEOUT);

  test("and bootstrap's own graph DOES carry it", async () => {
    // Isolation that achieved itself by losing the node would be worse than
    // the leak: the process would simply be gone.
    const { nodes } = await collectInstanceNodes(BOOT, DOC, "", []);
    expect(ids(nodes).some((i) => i.includes("Process_InitializeHarness"))).toBe(true);
  });

  test("the root instance keeps every process it declares", async () => {
    // Presence, not a count: a pinned number makes "still works" and
    // "somebody deleted a diagram" indistinguishable.
    const { nodes } = await rootCollection();
    const procs = nodes.filter((n) => String(n["@type"]).endsWith("Process"));
    expect(procs.length).toBeGreaterThan(10);
  }, CORPUS_TIMEOUT);
});

describe("discovery reads the declaration rather than the tree", () => {
  test("an undeclared directory holding a .bpmn is NOT collected", async () => {
    // This is the whole difference. A walk would find it; a declaration does
    // not, because the layer never said it was its graph.
    const root = mkdtempSync(join(tmpdir(), "iso-"));
    mkdirSync(join(root, "skills"), { recursive: true });
    mkdirSync(join(root, "stray"), { recursive: true });
    writeFileSync(join(root, "stray", "x.bpmn"), "<x/>");
    writeDeclaration(root, JSON.stringify({
        name: "iso",
        directories: [{ id: "cat-harness", path: "skills/", graphTypologies: ["cat-harness"] }],
      }));
    const problems: string[] = [];
    const { nodes, notes } = await collectInstanceNodes(root, DOC, "", problems);
    rmSync(root, { recursive: true, force: true });

    expect(nodes.filter((n) => String(n["@type"]).endsWith("Process"))).toEqual([]);
    // And it says it found none, rather than passing over in silence.
    //
    // In `notes` since 2026-09-20, not `problems`. The assertion this test
    // cares about is unchanged — the fact is SAID — and what changed is that
    // saying it no longer fails the layer. A skills package with no
    // workflow is ordinary; three of them arrived at once and each failed on
    // this message alone while rendering all its nodes.
    expect(notes.some((n) => n.includes("bpmn"))).toBe(true);
    expect(problems.some((p) => p.includes("bpmn"))).toBe(false);
  });

  test("a DECLARED directory holding a .bpmn directly is collected", async () => {
    // CatBootstrap's shape: `workflows/` declared as its own entry, holding the
    // diagram at its root rather than in a `workflows/` subdirectory.
    const root = mkdtempSync(join(tmpdir(), "iso2-"));
    mkdirSync(join(root, "wf"), { recursive: true });
    writeFileSync(join(root, "wf", "x.bpmn"), "<x/>");
    writeDeclaration(root, JSON.stringify({
        name: "iso2",
        directories: [{ id: "cat-harness-wf", path: "wf/", graphTypologies: ["cat-harness"] }],
      }));
    const problems: string[] = [];
    await collectInstanceNodes(root, DOC, "", problems);
    rmSync(root, { recursive: true, force: true });
    // The directory WAS looked in — no "found no .bpmn directory" complaint.
    expect(problems.some((p) => p.includes("no directory containing"))).toBe(false);
  });
});
