import { describe, expect, test } from "bun:test";
import { DiigPhasesAdaptationSchema, DiigPhasesFigureSchema, SmartGuidelinesApproachFigureSchema } from "./figure-data.ts";

const diig = {
  $schema: "diig-phases-figure/v1",
  figure: { library: "x-eng", label: "Figure 1", caption: "c", page: 1, file: "f.png" },
  legend: { d: "PDF" },
  phases: [{ id: "01", name: ["A"], color: "#B3D334", tint: "#E9F1CC", steps: ["s"] }],
  resources: [{ id: "r", label: ["R"], icons: ["d"] }],
  layout: { columns: 1, rows: 1, tiles: [{ resource: "r", columns: [0, 0], rows: [0, 0], outlinePhase: "01" }] },
  thisDocument: { resource: "r", style: "dashed", color: "#1A8FD6", fill: "#FFFFFF" },
};

const cell = { name: "Narrative", text: "t" };
const smart = {
  $schema: "smart-guidelines-approach-figure/v1",
  figure: { library: "x-eng", label: "fig:5", caption: "c", page: 14, file: "f.png" },
  style: { band: "#0D97D4", panel: "#EEF4FB", card: "#FFFFFF", ink: "#1F2854", arrow: "#8C94AC", loop: "#1F2854" },
  loop: "Evidence",
  bands: [{ id: "a", label: "A" }, { id: "b", label: "B" }, { id: "c", label: "C" }],
  rows: [
    { id: "knowledge", label: ["K"], from: "a", to: "b", chained: true },
    { id: "country", label: ["C"], from: "b", to: "c", chained: false },
  ],
  layers: [{ level: 1, knowledge: cell, country: cell }],
};

describe("figure-data schemas", () => {
  test("diigFigureParsesWrongColourRefused", () => {
    expect(DiigPhasesFigureSchema.safeParse(diig).success).toBe(true);
    expect(DiigPhasesFigureSchema.safeParse({ ...diig, phases: [{ ...diig.phases[0], color: "green" }] }).success).toBe(false);
  });
  test("adaptationNeedsAdapts", () => {
    const a = { $schema: "diig-phases-adaptation/v1", adapts: "library/x/figure-data/f.json", thisDocument: diig.thisDocument };
    expect(DiigPhasesAdaptationSchema.safeParse(a).success).toBe(true);
    expect(DiigPhasesAdaptationSchema.safeParse({ ...a, adapts: "" }).success).toBe(false);
  });
  test("smartFigureNeedsThreeBands", () => {
    expect(SmartGuidelinesApproachFigureSchema.safeParse(smart).success).toBe(true);
    expect(SmartGuidelinesApproachFigureSchema.safeParse({ ...smart, bands: smart.bands.slice(0, 2) }).success).toBe(false);
  });
  test("unknownFieldRefused", () => {
    expect(DiigPhasesFigureSchema.safeParse({ ...diig, extra: 1 }).success).toBe(false);
  });
});
