/**
 * `bean-link` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness/scripts/tests/bean-link.test.ts` (bean `7zz1`, owner ruling
 * 2026-10-06 "Top-level instance"): each reads every diagram the checkout
 * ships, folio-assistant-core's among them, which only the checkout holds.
 * Standing alone, cat-harness has none of it, and
 * `check:cat-harness-standalone` collects every test in that layer. The rest
 * of that file's tests stay there; every path here is composed from
 * ORIGIN_DIR, the directory they were written in, so nothing they read
 * changed.
 */
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { workflowFile } from "../../scripts/known-skills.ts";
import { loadProcessModel } from "../../src/workflow/process-model.ts";
import { WORK_PLAN_OPS } from "../../src/workflow/bean-link.ts";

/** The directory these tests were written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move, so nothing they read changed. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

/**
 * `beans/` says what is being worked on; a layer says where it got to.
 * Kept apart they diverge. These tests are about the operations that keep them
 * one record — and about the one that deliberately refuses to fire.
 *
 * They write to a temp repo, never the real `beans/`.
 */

let repo: string;

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "bean-link-"));
  mkdirSync(join(repo, "beans"), { recursive: true });
});
afterEach(() => rmSync(repo, { recursive: true, force: true }));

describe("the diagrams declare which operation each step performs", () => {
  // The order the EDITING process takes them in is pinned beside that
  // diagram, in folio-assistant-core/scripts/tests/bean-link.test.ts (bean
  // `ho66`): standing alone, cat-harness has no such diagram.
  test("every bean-marked activity in the shipped diagrams names an op", async () => {
    // Found by NAME through the declared `processes` graphs: each diagram sits
    // with its owner (#1772; placement PR3, bean `63wl`), grouped by concern.
    let marked = 0;
    for (const f of ["editing-hci-validation", "draft-to-publication", "content-lifecycle",
                     "authoring-a-paper", "l2-dak-authoring", "l3-fhir-pipeline"]) {
      const file = workflowFile(resolve(ORIGIN_DIR, "../.."), `${f}.bpmn`);
      const model = await loadProcessModel(file);
      for (const n of model.nodes.values()) {
        if (!n.touchesWorkPlan) continue;
        // Only the work's own `note` steps are left here: claim, resolve and
        // archive are drawn once, in cat-harness's bean-open.bpmn and
        // bean-close.bpmn, which these diagrams call (bean m8gz).
        marked++;
        // Asserted as a defined string, not just "one of these": an activity
        // marked as touching the plan whose op is absent would silently do
        // nothing, and `toContain(undefined)` would not say so clearly.
        expect(n.workPlanOp).toBeDefined();
        expect([...WORK_PLAN_OPS]).toContain(n.workPlanOp!);
      }
    }
    expect(marked).toBe(8);
  });
});
