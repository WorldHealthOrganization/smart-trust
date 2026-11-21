/**
 * `sample-import.bpmn` driven over a fixture — bean `xlg2`'s second box.
 *
 * @module folio-assistant-core/scripts/sample-import-run.test
 *
 * A later edit to the diagram, the driver or the import check goes red here.
 * The fixture is a copy of the real WPRO catalogue node, its record and its
 * held bytes, in a temp root. The workflow tools are built over the SAME
 * engine (`startInstance` / `complete`) the registered handlers use, without
 * the GitHub-vouched authorization a temp root cannot satisfy; the recorded
 * runs under `beans/workflows/` went through the real handlers.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { complete, startInstance } from "@litlfred/cat-harness-tools/src/workflow/instance.ts";
import { loadProcessModel } from "@litlfred/cat-harness-tools/src/workflow/process-model.ts";
import { instanceId, loadInstance, saveInstance } from "@litlfred/cat-harness-tools/src/workflow/store.ts";
import { writeDeclaration } from "../../cat-harness-tools/test/support/instance-fixture.ts";
import { runSampleImport, type Handler } from "./sample-import-run.ts";

const REPO = resolve(import.meta.dir, "..", "..");
const WHO_IRIS = join(REPO, "who-iris");
// In cat-harness's `library` sub-graph since cat-harness#1032; under
// `processes/library/` before it.
const DIAGRAM = [
  join(REPO, "cat-harness", "library", "processes", "sample-import.bpmn"),
  join(REPO, "cat-harness", "processes", "library", "sample-import.bpmn"),
].find((p) => existsSync(p)) ?? join(REPO, "cat-harness", "library", "processes", "sample-import.bpmn");
const ITEM = "item/18892cf3-5a4f-42a4-923c-a93f4a594dec";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

/** A temp repository root holding a who-iris catalogue with the WPRO item and its bytes. */
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "sample-import-"));
  made.push(root);
  // The trashcan is DECLARED, as the real root layer declares it: the
  // writer resolves it and refuses to invent one (bean 9c7h). A path OTHER
  // than `fsh-guts/`, so a writer that spells the conventional path fails.
  writeDeclaration(root, JSON.stringify({
    name: "t",
    stub: "t",
    canonicalUrl: "https://example.invalid/t",
    directories: [{ id: "fsh-guts", path: "kept-trash/", description: "trashcan", graphTypologies: ["fsh-guts"] }],
  }));
  const copy = (rel: string) => {
    const to = join(root, "who-iris", rel);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(join(WHO_IRIS, rel), to);
  };
  copy("catalogue/nodes/item-wpr-rdo-2020-003-eng.json");
  copy("catalogue/records/wpr-rdo-2020-003-eng.dc.json");
  copy("uploads/wpr-rdo-2020-003-eng/WPR-RDO-2020-003-eng.pdf");
  copy("library/wpr-rdo-2020-003-eng-cover.png");
  return root;
}

/** workflow_start / workflow_complete over the engine, saving into `root`. */
function engineTools(root: string): Map<string, Handler> {
  const ok = (text: string) => ({ content: [{ text }] });
  return new Map<string, Handler>([
    [
      "workflow_start",
      async (a) => {
        const model = await loadProcessModel(DIAGRAM);
        const state = startInstance(model, { id: instanceId(model.id, a.subject as string), subject: a.subject as string, bean: a.bean as string | undefined });
        saveInstance(root, state);
        return ok("started");
      },
    ],
    [
      "workflow_complete",
      async (a) => {
        const state = loadInstance(root, a.instance as string)!;
        const model = await loadProcessModel(DIAGRAM);
        const next = complete(model, state, a.node as string, { outcome: a.outcome as string | undefined, facts: a.facts as Record<string, unknown> | undefined, note: a.note as string, actor: "test" });
        saveInstance(root, next);
        return ok("done");
      },
    ],
  ]);
}

/** The network, refused — liveness is could-not-determine without touching it. */
const refuses = async () => {
  throw new Error("connect_rejected");
};

const endOf = (root: string, subject: string) =>
  loadInstance(root, instanceId("Process_SampleImport", subject))!.history.map((h) => h.node).at(-1);

describe("the whole item — a derived thumbnail's sourceLoss gate is unknown", () => {
  test("wholeItemRefused", async () => {
    const root = fixture();
    const r = await runSampleImport({ root, instance: "who-iris", item: ITEM, subject: "whole", tools: engineTools(root), livenessFetcher: refuses });
    expect(r.status).toBe("completed");
    expect(r.steps.find((s) => s.node === "Gateway_Gates")?.outcome).toBe("no, or unknown");
    expect(r.steps.find((s) => s.node === "Gateway_Materialized")?.outcome).toBe("no, or unknown");
    expect(r.trialPath).toBeUndefined();
    expect(existsSync(join(root, "kept-trash", "samples"))).toBe(false);
    expect(endOf(root, "whole")).toBe("EndEvent_Refused");
  });
});

describe("the ORIGINAL bundle only — every gate permitted", () => {
  test("originalImported", async () => {
    const root = fixture();
    const r = await runSampleImport({ root, instance: "who-iris", item: ITEM, subject: "original", bundles: ["ORIGINAL"], tools: engineTools(root), livenessFetcher: refuses });
    expect(r.steps.find((s) => s.node === "Gateway_Gates")?.outcome).toBe("yes");
    expect(r.steps.find((s) => s.node === "Gateway_Permanent")?.outcome).toBe("trial");
    expect(r.steps.find((s) => s.node === "Gateway_Passed")?.outcome).toBe("yes");
    expect(endOf(root, "original")).toBe("EndEvent_Imported");
    // The fetch is RECORDED as not performed, never skipped silently.
    expect(r.steps.find((s) => s.node === "Task_Fetch")?.note).toContain("NOT PERFORMED HERE");
    // Liveness is asked, through the Handle, and an unanswered probe is recorded as such.
    expect(r.steps.find((s) => s.node === "Task_Fetch")?.note).toContain("LIVENESS of https://hdl.handle.net/10665/332098: could-not-determine");
    // A trial lands in fsh-guts/ as a declared node, and library/ is untouched.
    expect(r.trialPath!.startsWith(join(root, "kept-trash", "samples"))).toBe(true);
    expect(existsSync(join(root, "fsh-guts"))).toBe(false);
    const trial = readFileSync(r.trialPath!, "utf-8");
    expect(trial).toContain("$schema: folio-fsh-guts/v1");
    expect(trial).toContain("kind: sample-import-trial");
    expect(existsSync(join(root, "library"))).toBe(false);
  });
});

describe("held bytes that no longer match their recorded fixity", () => {
  test("tamperedRefused", async () => {
    const root = fixture();
    writeFileSync(join(root, "who-iris", "uploads", "wpr-rdo-2020-003-eng", "WPR-RDO-2020-003-eng.pdf"), "tampered");
    await expect(
      runSampleImport({ root, instance: "who-iris", item: ITEM, subject: "tampered", bundles: ["ORIGINAL"], tools: engineTools(root), livenessFetcher: refuses }),
    ).rejects.toThrow(/do not match the recorded sha256/);
  });
});
