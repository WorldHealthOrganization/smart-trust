/**
 * Process_BeanDrain (cat-harness `sdlc/processes/bean-drain.bpmn`, bean
 * `bssi`) walked through the engine: build the queue, then per bean OPEN →
 * work → CLOSE, then refill.
 *
 * The drain is the one caller that reaches OPEN and CLOSE more than once in
 * a layer, so it rests on two engine properties no other walk asserts:
 * a call activity reached again by a gateway loop RE-ENTERS its process
 * (`enterSubprocesses`), and a CLOSE with more of the caller still ahead does
 * not leave the layer believing it is finished — the drain is not done
 * when one bean is.
 */
import { describe, expect, test } from "bun:test";

import { complete, enabled, startInstance } from "../../src/workflow/instance";
import { loadProcessModel } from "../../src/workflow/process-model";
import { onlyArchiveLeft } from "../../src/workflow/bean-link";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { workflowFile } from "../known-skills.ts";
import { CLOSE_DONE, openNewBean, walkSteps } from "../lib/bean-open-close-walk.ts";

const GATEWAY = "Drain_Claimed";

describe("Process_BeanDrain runs OPEN → work → CLOSE per bean, then refills", () => {
  const path = workflowFile(HARNESS_ROOT, "bean-drain.bpmn");

  test("calls exactly the shared OPEN and CLOSE", async () => {
    const model = await loadProcessModel(path);
    expect(model.id).toBe("Process_BeanDrain");
    expect([...model.children.values()].map((c) => c.id).sort()).toEqual(["Process_BeanClose", "Process_BeanOpen"]);
  });

  test("one bean through OPEN → work → CLOSE, then a refill, a second bean, and the queue drained", async () => {
    const model = await loadProcessModel(path);
    const state = startInstance(model, { id: "bssi-walk", subject: "drain", bean: "ml9h" });
    complete(model, state, "Drain_BuildQueue");
    complete(model, state, "Drain_More", { outcome: "yes" });
    complete(model, state, "Drain_TakeNext");
    openNewBean(model, state, {}, GATEWAY);
    complete(model, state, "Drain_Work");
    walkSteps(model, state, CLOSE_DONE);
    // More of the drain follows CLOSE, so the layer is not "only archive left".
    expect(onlyArchiveLeft(model, state)).toBe(false);
    expect(state.status).toBe("running");
    expect(enabled(model, state).map((e) => e.node)).toEqual(["Drain_More"]);

    // The list is empty: refill, and the next bean goes through OPEN again.
    complete(model, state, "Drain_More", { outcome: "list empty" });
    complete(model, state, "Drain_Refill");
    complete(model, state, "Drain_Refilled", { outcome: "refilled" });
    complete(model, state, "Drain_TakeNext");
    expect(enabled(model, state).map((e) => e.node)).toEqual(["Open_CheckExists"]);
    openNewBean(model, state, {}, GATEWAY);
    complete(model, state, "Drain_Work");
    walkSteps(model, state, CLOSE_DONE);

    complete(model, state, "Drain_More", { outcome: "list empty" });
    complete(model, state, "Drain_Refill");
    complete(model, state, "Drain_Refilled", { outcome: "queue empty" });
    expect(state.status).toBe("completed");
  });

  test("a bean someone else holds is skipped, not worked, and the drain goes on", async () => {
    const model = await loadProcessModel(path);
    const state = startInstance(model, { id: "bssi-skip", subject: "drain", bean: "ml9h" });
    complete(model, state, "Drain_BuildQueue");
    complete(model, state, "Drain_More", { outcome: "yes" });
    complete(model, state, "Drain_TakeNext");
    complete(model, state, "Open_CheckExists");
    complete(model, state, "Open_Exists", { outcome: "yes" });
    complete(model, state, "Open_Owner", { outcome: "someone else's" });
    complete(model, state, "Open_LeaveAlone");
    complete(model, state, GATEWAY, { outcome: "not yours" });
    expect(enabled(model, state).map((e) => e.node)).toEqual(["Drain_Skip"]);
    complete(model, state, "Drain_Skip");
    expect(state.children?.Drain_Close).toBeUndefined();
    expect(state.status).toBe("running");
    expect(enabled(model, state).map((e) => e.node)).toEqual(["Drain_More"]);
  });
});
