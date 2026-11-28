/**
 * The workflow tools resolve a DEPENDENCY's diagrams — bean `nf2z`.
 *
 * @module scripts/tests/workflow-overlay
 *
 * Since the split every diagram belongs to a dependency, and the root-only
 * resolver left a server started at the repository root listing
 * "Processes: (none)". These tests go through the real registration (the
 * stub-server pattern of `precondition-consumer.test.ts`), because the wiring
 * is what was broken — each helper was correct on its own.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { harnessPath } from "../../lib/harness-layout.ts";

import { processFiles, processRoots, registerWorkflowTools } from "../../../src/tools/workflow.ts";
import { HARNESS_ROOT } from "../../lib/roots.ts";

const CAT_HARNESS = HARNESS_ROOT;
const REPO = resolve(CAT_HARNESS, "..");

type Handler = (args: Record<string, unknown>) => Promise<{ content: { text: string }[] }>;

function handlers(root: string): Map<string, Handler> {
  const captured = new Map<string, Handler>();
  registerWorkflowTools({ tool: (n: string, _d: string, _s: unknown, fn: Handler) => captured.set(n, fn) } as never, root);
  return captured;
}

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

/**
 * A root layer depending on cat-harness, and optionally a diagram of its own.
 *
 * It depended on cat-harness alone until placement PR0 (bean `ejye`), then on
 * `large-datasets`, which owned `sample-import` from bean `cjvs` — a root that
 * wants a diagram must depend on its owner: the cmsl falsifier, "a split
 * checkout sees less", stated as a fixture. Bean `j7ql` (2026-10-01)
 * dissolved large-datasets into cat-harness, so the owner is cat-harness again.
 */
function rootWithDependency(ownDiagram?: string): string {
  const root = mkdtempSync(join(tmpdir(), "wf-overlay-"));
  made.push(root);
  // Mirrors cat-harness's own `processes` entry, the shape a real layer declares.
  const directories = ownDiagram ? [{ id: "processes", path: "processes/", graphTypologies: ["processes"] }] : [];
  writeFileSync(join(root, "t.json"), JSON.stringify({ name: "t", version: "0.0.0", title: "t", directories }));
  writeFileSync(
    join(root, "t.config.json"),
    JSON.stringify({ dependencies: { folioAssistant: [{ name: "cat-harness", path: CAT_HARNESS }] } }),
  );
  if (ownDiagram) {
    mkdirSync(join(root, "processes"), { recursive: true });
    copyFileSync(ownDiagram, join(root, "processes", "sample-import.bpmn"));
  }
  return root;
}

describe("the repository root — what the MCP server starts at by default", () => {
  test("reaches the dependencies' diagrams, sample-import among them", () => {
    // The measurement that opened the bean: this was 0.
    expect(processRoots(REPO)).toContain(CAT_HARNESS);
    expect(processFiles(REPO).some((f) => f.endsWith("/sample-import.bpmn"))).toBe(true);
  });

  test("workflow_list no longer reports none", async () => {
    const out = (await handlers(REPO).get("workflow_list")!({})).content[0].text;
    const processes = out.split("# Instances")[0];
    expect(processes).not.toContain("_(none)_");
    expect(processes).toContain("Process_SampleImport");
  });
});

describe("a root that declares no diagram of its own", () => {
  test("workflow_start resolves a dependency's process, and writes the instance under the ROOT", async () => {
    const root = rootWithDependency();
    const out = (await handlers(root).get("workflow_start")!({ process: "sample-import", subject: "overlay" })).content[0].text;
    expect(out).toContain("Task_Scope");
    // The instance store is the root's, never the dependency's: a sibling
    // session reads the root's `beans/workflows/`.
    expect(existsSync(join(root, "beans", "workflows", "sampleimport--overlay.json"))).toBe(true);
    expect(existsSync(join(CAT_HARNESS, "beans", "workflows", "sampleimport--overlay.json"))).toBe(false);
  });

  test("workflow_complete advances an instance whose diagram lives OUTSIDE the root", async () => {
    // The store keeps an out-of-root `source` absolute; the tools must not
    // join it onto the root. Found by the first real sample-import run.
    const root = rootWithDependency();
    const h = handlers(root);
    await h.get("workflow_start")!({ process: "sample-import", subject: "outside" });
    // A temp root has no git remote, so GitHub vouches for nobody and strict
    // authorization refuses — correctly. What this pins is that the refusal is
    // AUTHORIZATION, reached only after the diagram loaded: before the fix it
    // was ENOENT on `<root>/<absolute path>`.
    const done = h.get("workflow_complete")!({ instance: "sampleimport--outside", node: "Task_Scope", note: "t" });
    await expect(done).rejects.toThrow(/REFUSED \(strict\)/);
    await expect(done).rejects.not.toThrow(/ENOENT/);
  });

  test("the role graph is found in the dependency, so a step says what it acts AS", async () => {
    const root = rootWithDependency();
    const out = (await handlers(root).get("workflow_start")!({ process: "sample-import", subject: "roles" })).content[0].text;
    expect(out).toContain("acting as");
  });
});

describe("a name collision", () => {
  test("the root's own diagram shadows the dependency's", () => {
    // cat-harness owns the diagram (again, since bean `j7ql`), and the
    // fixture reaches it by depending on cat-harness (placement PR0).
    const root = rootWithDependency(harnessPath("library/processes/sample-import.bpmn", CAT_HARNESS));
    const hits = processFiles(root).filter((f) => f.endsWith("/sample-import.bpmn"));
    expect(hits).toEqual([join(root, "processes", "sample-import.bpmn")]);
    expect(readFileSync(hits[0], "utf-8")).toContain("Process_SampleImport");
  });
});
