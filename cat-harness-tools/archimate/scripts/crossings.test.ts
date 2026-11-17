import { describe, expect, it } from "bun:test";
import type { ArchimateView, ArchimateViewNode } from "../schemas/archimate.ts";
import { tanglesOf } from "./archimate-crossings.ts";

const box = (id: string, x: number, y: number, extra: Partial<ArchimateViewNode> = {}): ArchimateViewNode => ({ id, kind: "element", ref: `e-${id}`, x, y, w: 100, h: 50, ...extra });
const view = (nodes: ArchimateViewNode[], conns: Array<[string, string, string]>): ArchimateView => ({
  id: "v", name: "V", properties: [], folder: [], nodes,
  connections: conns.map(([id, source, target]) => ({ id, source, target, relationship: `r-${id}`, bendpoints: [] })),
});

describe("tanglesOf", () => {
  it("counts two lines that cross, and not two that only share a box", () => {
    // a(0,0) → d(300,300) crosses b(300,0) → c(0,300); a → b and a → c share a only.
    const v = view([box("a", 0, 0), box("b", 300, 0), box("c", 0, 300), box("d", 300, 300)], [["ad", "a", "d"], ["bc", "b", "c"], ["ab", "a", "b"], ["ac", "a", "c"]]);
    const t = tanglesOf(v);
    expect(t.filter((x) => x.kind === "crossing").map((x) => x.connections.sort().join(" "))).toEqual(["ad bc"]);
  });

  it("counts a line through a box it does not connect, but not through a box that holds its end", () => {
    const v = view([box("a", 0, 0), box("m", 150, 0), box("z", 300, 0), box("outer", 280, -20, { w: 140, h: 90 }), box("in", 300, 0, { parent: "outer", w: 100, h: 50 })], [["az", "a", "z"]]);
    // z sits inside nothing; m is in the way.
    const t = tanglesOf({ ...v, nodes: v.nodes.filter((n) => n.id !== "outer" && n.id !== "in") });
    expect(t.map((x) => [x.kind, x.node])).toEqual([["through-box", "m"]]);
    // A line into a nested box passes its container: not counted.
    const nested = view([box("a", 0, 200), box("outer", 280, -20, { w: 140, h: 90 }), box("in", 300, 0, { parent: "outer" })], [["ai", "a", "in"]]);
    expect(tanglesOf(nested)).toEqual([]);
  });

  it("does not count groups a line crosses", () => {
    const v = view([box("a", 0, 0), box("g", 120, -50, { kind: "group", ref: undefined, w: 100, h: 200 }), box("z", 300, 0)], [["az", "a", "z"]]);
    expect(tanglesOf(v)).toEqual([]);
  });
});

describe("viewOf", () => {
  it("finds a view by id, by page slug, or by name", async () => {
    const { viewOf } = await import("./archimate-crossings.ts");
    const v = { id: "id-v1", name: "1. Central Health Workforce Registry", properties: [], folder: [], nodes: [], connections: [] };
    const model = { id: "m", name: "M", properties: [], elements: [], relationships: [], views: [v] };
    expect(viewOf(model, "id-v1")).toBe(v);
    expect(viewOf(model, "1-central-health-workforce-registry")).toBe(v);
    expect(viewOf(model, "1. Central Health Workforce Registry")).toBe(v);
    expect(viewOf(model, "nope")).toBeUndefined();
  });
});
