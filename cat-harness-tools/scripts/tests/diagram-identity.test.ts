/**
 * A diagram is identified by its layer and its path within it, never by
 * its file name alone: two layers may each hold `processes/global-tasks.bpmn`.
 *
 * The owner asked (2026-10-23) whether a diagram's identity carries its
 * layer. It does where it matters — a call resolves by element id within
 * the caller's own layer (owner, 2026-10-20, "c1"), and the export's IRIs
 * sit under each layer's own document — and these tests pin that, with
 * two layers each holding a same-named shared file. They also pin the one
 * reader that did not: `audit:reachability` counted the two files as a
 * `process-ambiguous` stem clash, and keyed decision references by basename.
 *
 * Fixture layers only, so a change to a real diagram cannot make these pass.
 *
 * @module scripts/tests/diagram-identity.test
 * @graphNode none — a test
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { decisionReach, processReach } from "../audit-reachability.ts";
import { loadProcessModel } from "../../src/workflow/process-model.ts";

const HEAD = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bootstrap.processes="https://litlfred.github.io/bootstrap/v0/processes/ns/"
                  xmlns:cat-harness.processes="https://litlfred.github.io/cat-harness/v0/processes/ns/"
                  id="D" targetNamespace="urn:t">`;

/** A layer's shared file: one global task, `GT_Shared`, named after the layer. */
const globals = (layer: string): string => `${HEAD}
  <bpmn:globalUserTask id="GT_Shared" name="Shared step of ${layer}">
    <bpmn:extensionElements><bootstrap.processes:skill ref="${layer}-skill"/></bpmn:extensionElements>
  </bpmn:globalUserTask>
</bpmn:definitions>`;

/** A process that calls `GT_Shared` by bare id, and routes on `decisions/route.dmn` when `decide`. */
function caller(id: string, decide: boolean): string {
  const gateway = decide
    ? `
    <bpmn:exclusiveGateway id="G_${id}" name="Route?">
      <bpmn:extensionElements><cat-harness.processes:decision ref="decisions/route.dmn#D_Route"/></bpmn:extensionElements>
    </bpmn:exclusiveGateway>
    <bpmn:sequenceFlow id="F2_${id}" sourceRef="Call_${id}" targetRef="G_${id}"/>
    <bpmn:sequenceFlow id="F3_${id}" name="yes" sourceRef="G_${id}" targetRef="E_${id}"/>
    <bpmn:sequenceFlow id="F4_${id}" name="no" sourceRef="G_${id}" targetRef="E_${id}"/>`
    : `
    <bpmn:sequenceFlow id="F2_${id}" sourceRef="Call_${id}" targetRef="E_${id}"/>`;
  return `${HEAD}
  <bpmn:resource id="build-pipeline" name="Build pipeline"/>
  <bpmn:process id="${id}">
    <bpmn:laneSet id="LS_${id}">
      <bpmn:lane id="Lane_${id}" name="CI" partitionElementRef="build-pipeline">
        <bpmn:flowNodeRef>S_${id}</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Call_${id}</bpmn:flowNodeRef>${decide ? `\n        <bpmn:flowNodeRef>G_${id}</bpmn:flowNodeRef>` : ""}
        <bpmn:flowNodeRef>E_${id}</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>
    <bpmn:startEvent id="S_${id}"/>
    <bpmn:callActivity id="Call_${id}" calledElement="GT_Shared"/>
    <bpmn:endEvent id="E_${id}"/>
    <bpmn:sequenceFlow id="F1_${id}" sourceRef="S_${id}" targetRef="Call_${id}"/>${gateway}
  </bpmn:process>
</bpmn:definitions>`;
}

const DMN = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="Defs" name="route" namespace="http://route">
  <decision id="D_Route" name="Route">
    <decisionTable id="T" hitPolicy="FIRST">
      <input id="I1" label="fact"><inputExpression id="E1" typeRef="string"><text>fact</text></inputExpression></input>
      <output id="O1" name="outcome" typeRef="string"/>
      <rule id="R1"><inputEntry id="IE1"><text>"a"</text></inputEntry><outputEntry id="OE1"><text>"yes"</text></outputEntry></rule>
      <rule id="R2"><inputEntry id="IE2"><text>-</text></inputEntry><outputEntry id="OE2"><text>"no"</text></outputEntry></rule>
    </decisionTable>
  </decision>
</definitions>
`;

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

/**
 * Two layers, `low` and `up` (which needs `low`), each holding
 * `processes/global-tasks.bpmn` and `processes/decisions/route.dmn` — the
 * same paths within each layer. Only `up`'s process routes on its table.
 */
function twoLayers(): { low: string; up: string; files: Record<string, string> } {
  const base = mkdtempSync(join(tmpdir(), "diagram-identity-"));
  made.push(base);
  const directories = [{ id: "processes", path: "processes/", graphTypologies: ["processes"] }];
  const layer = (name: string, needs?: string): string => {
    const root = join(base, name);
    mkdirSync(join(root, "processes", "decisions"), { recursive: true });
    writeFileSync(join(root, `${name}.json`), JSON.stringify({ name, version: "0.0.0", title: name, directories }));
    if (needs !== undefined) {
      writeFileSync(join(root, `${name}.config.json`), JSON.stringify({ dependencies: { folioAssistant: [{ name: needs, path: join(base, needs) }] } }));
    }
    writeFileSync(join(root, "processes", "global-tasks.bpmn"), globals(name));
    writeFileSync(join(root, "processes", `${name}-work.bpmn`), caller(`P_${name}`, name === "up"));
    writeFileSync(join(root, "processes", "decisions", "route.dmn"), DMN);
    return root;
  };
  const low = layer("low");
  const up = layer("up", "low");
  return {
    low,
    up,
    files: {
      lowGlobals: join(low, "processes", "global-tasks.bpmn"),
      upGlobals: join(up, "processes", "global-tasks.bpmn"),
      lowWork: join(low, "processes", "low-work.bpmn"),
      upWork: join(up, "processes", "up-work.bpmn"),
      lowDmn: join(low, "processes", "decisions", "route.dmn"),
      upDmn: join(up, "processes", "decisions", "route.dmn"),
    },
  };
}

describe("two instances, each with processes/global-tasks.bpmn", () => {
  test("a bare-id call resolves to the global task of the caller's OWN instance", async () => {
    const { files } = twoLayers();
    const up = (await loadProcessModel(files.upWork!)).nodes.get("Call_P_up")!;
    const low = (await loadProcessModel(files.lowWork!)).nodes.get("Call_P_low")!;
    expect(up.globalTask?.source).toBe(files.upGlobals);
    expect(up.name).toBe("Shared step of up");
    expect(up.skills).toEqual(["up-skill"]);
    expect(low.globalTask?.source).toBe(files.lowGlobals);
    expect(low.name).toBe("Shared step of low");
  });

  test("audit:reachability reports both files as shared, and no name clash", async () => {
    const { up, files } = twoLayers();
    const bpmn = [files.lowGlobals!, files.lowWork!, files.upGlobals!, files.upWork!].sort();
    const { rows, ambiguous } = await processReach(up, bpmn);
    expect(ambiguous).toEqual([]);
    expect(rows.filter((r) => r.state === "shared").map((r) => r.file).sort()).toEqual(
      [join("..", "low", "processes", "global-tasks.bpmn"), join("processes", "global-tasks.bpmn")].sort(),
    );
    // The control: two STARTABLE diagrams of one stem are still a clash,
    // because `workflow_start` resolves a stem and keeps one of them.
    const twin = join(files.lowWork!, "..", "..", "..", "up", "processes", "low-work.bpmn");
    writeFileSync(twin, caller("P_twin", false));
    const again = await processReach(up, [...bpmn, twin].sort());
    expect(again.ambiguous.map((a) => `${a.on}:${a.name}`)).toEqual(["stem:low-work"]);
  });

  test("a decision reference is credited to the table at its path, not to every table of that name", async () => {
    const { up, files } = twoLayers();
    const bpmn = [files.lowGlobals!, files.lowWork!, files.upGlobals!, files.upWork!].sort();
    const { decisionRefs } = await processReach(up, bpmn);
    const rows = await decisionReach(up, [files.lowDmn!, files.upDmn!], decisionRefs);
    const by = new Map(rows.map((r) => [r.file, r.referencedBy]));
    expect(by.get("processes/decisions/route.dmn")).toEqual(["up-work.bpmn#G_P_up"]);
    expect(by.get(join("..", "low", "processes", "decisions", "route.dmn"))).toEqual([]);
  });
});
