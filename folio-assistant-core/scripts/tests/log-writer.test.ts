/**
 * Which of folio-assistant-core's processes declare activity-log capture —
 * moved here from `cat-harness-tools/scripts/tests/log-writer.test.ts` (bean
 * `ho66`). The log writer is cat-harness code and its tests stay there;
 * `editing-hci-validation` and `content-lifecycle` are this layer's, so
 * standing alone cat-harness has neither to read.
 *
 * Bean `folio-assistant-7uff`.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { workflowFile, workflowFiles } from "@litlfred/cat-harness-tools/scripts/known-skills.js";
import { loadProcessModel } from "@litlfred/cat-harness-tools/src/workflow/process-model.ts";

describe("the process says whether running it is logged", () => {
  // Diagrams by NAME through the declared `processes` graphs (placement PR3, bean `63wl`).
  const diagram = (name: string): string => workflowFile(join(import.meta.dir, "../.."), name);
  // The corpus cat-harness serves: its own diagrams and every layer stacked
  // on it, this one included — `crdm-requirements` is cat-harness's.
  const CORPUS = join(import.meta.dir, "../../../cat-harness");

  test("namedProcessesDeclareCapture", async () => {
    // Located through `workflowFiles`, not composed from a literal
    // directory. `crdm-requirements.bpmn` moved to its own topical subgraph
    // on 2026-09-20 and a composed path went ENOENT — which this test read
    // as the process failing to declare capture, the wrong finding
    // entirely. The declaration says where diagrams live; asking it is the
    // difference between "this moved" and "this is broken".
    const byStem = new Map(
      workflowFiles(CORPUS).map((f) => [basename(f, ".bpmn"), f]),
    );
    for (const stem of ["crdm-requirements", "editing-hci-validation", "content-lifecycle"]) {
      const file = byStem.get(stem);
      // Asserted rather than defaulted: a missing diagram must not read as a
      // missing declaration.
      expect(`${stem}: ${file ? "found" : "NOT FOUND"}`).toBe(`${stem}: found`);
      const m = await loadProcessModel(file!);
      expect(m.logCapture, `${stem} does not declare folio:log`).toBe("on");
    }
  });

  test("unhonourableCaptureRefused", async () => {
    // Same discipline as `folio:bean op`: a diagram that asks for a mode the
    // engine does not have must not load and quietly log nothing. That is
    // worse here than elsewhere, because the missing artefact IS the record.
    const root = mkdtempSync(join(tmpdir(), "log-bpmn-"));
    const good = readFileSync(diagram("content-lifecycle.bpmn"), "utf-8");
    const bad = good.replace('<cat-harness.processes:log capture="on" />', '<cat-harness.processes:log capture="sometimes" />');
    expect(bad).not.toBe(good);
    const p = join(root, "content-lifecycle.bpmn");
    writeFileSync(p, bad);
    await expect(loadProcessModel(p)).rejects.toThrow(/capture="sometimes" is not implemented/);
  });

  test("markingDidNotChangeEnforcement", async () => {
    // The falsification check for taking the extension route over a call
    // activity. A call activity is a NODE in the control flow, so adding one
    // to a strict process would have inserted a step that must be completed
    // in order — changing what the diagram says about work nobody asked to
    // reorder. An extension element adds no node and no flow.
    for (const stem of ["editing-hci-validation", "content-lifecycle"]) {
      const m = await loadProcessModel(diagram(`${stem}.bpmn`));
      expect(m.enforcement).toBe("strict");
      // No node anywhere in the process mentions the log process.
      for (const n of m.nodes.values()) expect(n.calledElement).not.toBe("Process_ActivityLog");
    }
  });
});
