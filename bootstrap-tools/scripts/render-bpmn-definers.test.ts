/**
 * Two diagrams in different directories define the same process id. Each
 * referrer's beside-source sibling link must resolve to the definer in its
 * own directory, whatever order the files were read in; a last-wins map
 * dropped the loser's link (2026-11-13, cat-harness-tools#2068).
 */
import { describe, expect, test } from "bun:test";
import { processFilesFrom, siblingLinks } from "./render-bpmn.ts";

const a = "/x/layer-a/processes/lifecycle.bpmn";
const aCaller = "/x/layer-a/processes/authoring.bpmn";
const b = "/x/layer-b/processes/lifecycle-b.bpmn";
const bCaller = "/x/layer-b/processes/authoring-b.bpmn";
const caller = `<bpmn:callActivity id="Call_1" calledElement="Process_Publication">`;

describe("processFilesFrom", () => {
  for (const order of [[a, b], [b, a]]) {
    const definers = new Map([["Process_Publication", order]]);
    test(`each referrer keeps its own sibling link (order ${order.map((f) => f.split("/")[2]).join(",")})`, () => {
      expect(processFilesFrom(definers, aCaller).get("Process_Publication")).toBe(a);
      expect(processFilesFrom(definers, bCaller).get("Process_Publication")).toBe(b);
      expect(siblingLinks(aCaller, caller, processFilesFrom(definers, aCaller)).get("Call_1")).toBe("lifecycle.svg");
      expect(siblingLinks(bCaller, caller, processFilesFrom(definers, bCaller)).get("Call_1")).toBe("lifecycle-b.svg");
    });
  }

  test("no definer nearby falls back to the first path", () => {
    const definers = new Map([["Process_Publication", [b, a]]]);
    expect(processFilesFrom(definers, "/x/third/p.bpmn").get("Process_Publication")).toBe(a);
  });
});
