import { describe, expect, it } from "bun:test";
import type { ArchimateView, ArchimateViewConnection, ArchimateViewNode } from "../schemas/archimate.ts";
import { routeConnections } from "./render-view.ts";

// cat-harness-tools#1886: lines are drawn straight, square-on to their boxes.
const box = (id: string, x: number, y: number, w = 120, h = 55): ArchimateViewNode => ({ id, kind: "element", ref: id, x, y, w, h });
const line = (id: string, source: string, target: string, bendpoints: ArchimateViewConnection["bendpoints"] = []): ArchimateViewConnection => ({ id, source, target, bendpoints });
const view = (nodes: ArchimateViewNode[], connections: ArchimateViewConnection[]): ArchimateView =>
  ({ id: "v", name: "v", properties: [], folder: [], nodes, connections }) as ArchimateView;
const axisAligned = (pts: { x: number; y: number }[]) =>
  pts.every((p, i) => i === 0 || Math.abs(p.x - pts[i - 1]!.x) < 0.5 || Math.abs(p.y - pts[i - 1]!.y) < 0.5);

describe("routeConnections straightens lines", () => {
  it("draws a line between boxes side by side horizontally, not centre to centre", () => {
    const [r] = routeConnections(view([box("a", 0, 0, 120, 80), box("b", 300, 40)], [line("c", "a", "b")]));
    expect(r!.pts[0]!.y).toBe(r!.pts[1]!.y);
    expect(r!.pts[0]!.x).toBe(120);
    expect(r!.pts[1]!.x).toBe(300);
  });

  it("draws a line between boxes one above the other vertically", () => {
    const [r] = routeConnections(view([box("a", 0, 0), box("b", 30, 200)], [line("c", "a", "b")]));
    expect(r!.pts[0]!.x).toBe(r!.pts[1]!.x);
    expect([r!.pts[0]!.y, r!.pts[1]!.y]).toEqual([55, 200]);
  });

  it("keeps two lines into the same box apart", () => {
    const routed = routeConnections(view([box("t", 0, 0, 200), box("a", 10, 200, 200), box("b", 20, 300, 160)], [line("c1", "a", "t"), line("c2", "b", "t")]));
    expect(Math.abs(routed[0]!.pts[0]!.x - routed[1]!.pts[0]!.x)).toBeGreaterThanOrEqual(16);
  });

  it("snaps bendpoints a few px off true and meets the boxes square-on", () => {
    // Archi's stored bends, relative to the centres (564,420) and (804,495): 624,427 → 684,433 → 684,493 → 744,494.
    const s = box("s", 504, 393), t = box("t", 744, 468);
    const bends = [
      { startX: 120, startY: 12, endX: -120, endY: -63 },
      { startX: 120, startY: 72, endX: -120, endY: -3 },
    ];
    const [r] = routeConnections(view([s, t], [line("c", "s", "t", bends)]));
    expect(axisAligned(r!.pts)).toBe(true);
    expect(r!.pts[0]!.x).toBe(624);
    expect(r!.pts[r!.pts.length - 1]!.x).toBe(744);
  });

  it("drops a bendpoint that lies inside an end box", () => {
    const [r] = routeConnections(view([box("a", 0, 0), box("b", 10, 300)], [line("c", "b", "a", [{ startX: -10, startY: -270, endX: 0, endY: 0 }])]));
    expect(r!.pts).toHaveLength(2);
    expect(r!.pts[0]!.x).toBe(r!.pts[1]!.x);
  });

  it("runs a line between boxes apart on both axes corner to corner", () => {
    const [r] = routeConnections(view([box("a", 0, 0), box("b", 400, 300)], [line("c", "a", "b")]));
    // Each end leaves within INSET (6 px) of the corner facing the other box.
    expect(Math.hypot(r!.pts[0]!.x - 120, r!.pts[0]!.y - 55)).toBeLessThan(10);
    expect(Math.hypot(r!.pts[1]!.x - 400, r!.pts[1]!.y - 300)).toBeLessThan(10);
  });
});
