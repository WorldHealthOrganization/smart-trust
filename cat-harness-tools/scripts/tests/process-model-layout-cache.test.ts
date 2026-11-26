/**
 * The layer layout `loadProcessModel` resolves calls against is computed
 * once per layer root — and is resolved AGAIN when the layout changes.
 *
 * Bean `sff8`. Resolving a layer's `processes` directories and its
 * dependencies' was redone for every diagram, which was half of a corpus pass;
 * it is now memoised by layer root (`instanceLayout` in
 * `src/workflow/process-model.ts`). A memo is only as good as its key, so
 * these pin the two changes a fixture actually makes to one checkout without
 * moving it: a declaration rewritten to need a dependency, and a dependency's
 * layer root appearing beside it. A stale layout leaves the call opaque, so
 * each case asserts the call was opaque first — otherwise a pass would prove
 * nothing about invalidation.
 *
 * @module scripts/tests/process-model-layout-cache.test
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, test } from "bun:test";

import { loadProcessModel } from "../../src/workflow/process-model.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

const NS = `xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="urn:t"`;

/** A layer root `name` under `checkout`, declaring one `processes/` directory holding `file`. */
function instance(checkout: string, name: string, file: string, xml: string): string {
  const root = join(checkout, name);
  mkdirSync(join(root, "processes"), { recursive: true });
  writeFileSync(
    join(root, `${name}.json`),
    JSON.stringify({
      name,
      version: "0.0.0",
      title: name,
      directories: [{ id: "processes", path: "processes/", graphTypologies: ["processes"] }],
    }),
  );
  writeFileSync(join(root, "processes", file), xml);
  return root;
}

const PARENT = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions ${NS}>
  <bpmn:process id="Process_Parent" name="Parent" isExecutable="false">
    <bpmn:startEvent id="Start_P" name="Start"/>
    <bpmn:callActivity id="Call_P" name="Ask" calledElement="Process_LayoutChild"/>
  </bpmn:process>
</bpmn:definitions>
`;

const CHILD = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions ${NS}>
  <bpmn:process id="Process_LayoutChild" name="Child" isExecutable="false">
    <bpmn:startEvent id="Start_C" name="Start"/>
    <bpmn:task id="Task_C" name="Do"/>
  </bpmn:process>
</bpmn:definitions>
`;

function needs(root: string, name: string, dep: { name: string; path: string }): void {
  writeFileSync(join(root, `${name}.config.json`), JSON.stringify({ dependencies: { folioAssistant: [dep] } }));
}

function checkout(): string {
  const d = mkdtempSync(join(tmpdir(), "layout-cache-"));
  made.push(d);
  return d;
}

describe("the per-instance layout memo is invalidated by a layout change", () => {
  test("a declaration rewritten to NEED a dependency is read again", async () => {
    const co = checkout();
    const low = instance(co, "low", "child.bpmn", CHILD);
    const high = instance(co, "high", "parent.bpmn", PARENT);
    const parent = join(high, "processes", "parent.bpmn");

    // No dependency yet: the callee is in no directory `high` can reach.
    expect((await loadProcessModel(parent)).children.has("Call_P")).toBe(false);

    needs(high, "high", { name: "low", path: low });
    expect((await loadProcessModel(parent)).children.get("Call_P")?.id).toBe("Process_LayoutChild");
  });

  test("a dependency's instance root APPEARING beside the instance is seen", async () => {
    const co = checkout();
    const high = instance(co, "high", "parent.bpmn", PARENT);
    const parent = join(high, "processes", "parent.bpmn");
    // Needed before it exists — the state a fixture is in between two writes.
    needs(high, "high", { name: "low", path: join(co, "low") });

    expect((await loadProcessModel(parent)).children.has("Call_P")).toBe(false);

    instance(co, "low", "child.bpmn", CHILD);
    expect((await loadProcessModel(parent)).children.get("Call_P")?.id).toBe("Process_LayoutChild");
  });
});
