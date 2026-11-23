/**
 * Two layers define the same process id; each referrer's call or sibling link
 * resolves to its OWN definer, whatever order the files were read in
 * (2026-11-13: two layers each defined `Process_Publication`, and last-wins
 * dropped one layer's own sibling link).
 */
import { describe, expect, test } from "bun:test";
import { definersFrom, nearestDefiner, processDefiners } from "../../lib/process-definers.ts";

const core = "/x/layer-a/processes/content-lifecycle.bpmn";
const coreCaller = "/x/layer-a/processes/authoring.bpmn";
const ig = "/x/layer-b/input/business-processes/SGAuthoring.DAKLifecycle.bpmn";
const igCaller = "/x/layer-b/input/business-processes/SGAuthoring.bpmn";

function build(order: string[]) {
  return processDefiners(order.map((f) => [f, f === core || f === ig ? ["Process_Publication"] : []]));
}

describe("nearestDefiner", () => {
  test.each([
    ["layer-a,layer-b,layer-a,layer-b", [core, ig, coreCaller, igCaller]],
    ["layer-b,layer-a,layer-b,layer-a", [ig, core, igCaller, coreCaller]],
  ] as const)("each referrer resolves to its own layer's definer (read order %s)", (_label, order) => {
    const d = build([...order]);
    expect(d.get("Process_Publication")).toEqual([core, ig].sort());
    expect(nearestDefiner(d, "Process_Publication", coreCaller)).toBe(core);
    expect(nearestDefiner(d, "Process_Publication", igCaller)).toBe(ig);
    expect(definersFrom(d, coreCaller).get("Process_Publication")).toBe(core);
    expect(definersFrom(d, igCaller).get("Process_Publication")).toBe(ig);
  });

  test("a definer refers to itself", () => {
    const d = build([core, ig]);
    expect(nearestDefiner(d, "Process_Publication", core)).toBe(core);
    expect(nearestDefiner(d, "Process_Publication", ig)).toBe(ig);
  });

  test("equally near definers fall back to the first path, deterministically", () => {
    const d = build([ig, core]);
    expect(nearestDefiner(d, "Process_Publication", "/x/third/p.bpmn")).toBe([core, ig].sort()[0]);
  });

  test("an unknown id resolves to nothing", () => {
    expect(nearestDefiner(build([core]), "Nope", coreCaller)).toBeUndefined();
  });
});

test("render-bpmn resolves every link per referrer, not from one last-wins map", async () => {
  const src = await Bun.file(new URL("../../render-bpmn.ts", import.meta.url)).text();
  expect(src).toContain("besideSourceSvg(renderer, file, definersFrom(definers, file))");
  expect(src).toContain("nearestDefiner(definers, called, file)");
  expect(src).not.toMatch(/processHome|processPath|processFile\.set/);
});
