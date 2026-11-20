import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type SmartApproachFigure, loadFigure, renderSvg, wrap } from "./smart-approach-svg.ts";

const fig: SmartApproachFigure = {
  $schema: "smart-guidelines-approach-figure/v1",
  figure: { library: "lib-a", label: "fig:5", caption: "Approach", page: 1, file: "f.png" },
  style: { band: "#0D97D4", panel: "#EEF4FB", card: "#FFFFFF", ink: "#1F2854", arrow: "#8C94AC", loop: "#1F2854" },
  loop: "Evidence loop",
  bands: [{ id: "top", label: "Top band" }, { id: "mid", label: "Middle band" }, { id: "bot", label: "Bottom band" }],
  rows: [
    { id: "knowledge", label: ["Knowledge"], from: "top", to: "mid", chained: true },
    { id: "country", label: ["Country"], from: "mid", to: "bot", chained: false },
  ],
  layers: [
    { level: 1, knowledge: { name: "Narrative", text: "Words", product: "Guidelines" }, country: { name: "Adaptation", text: "Local words" } },
    { level: 2, knowledge: { name: "Operational", text: "Requirements", product: "Kits" }, country: { name: "Adaptation", text: "Local requirements" } },
  ],
};

describe("smart-approach-svg", () => {
  test("labelsFromData", () => {
    const svg = renderSvg(fig);
    for (const s of ["TOP BAND", "MIDDLE BAND", "BOTTOM BAND", "EVIDENCE LOOP", "L1: Narrative", "Words:", "Guidelines", "L2: Adaptation", "Local requirements", "Knowledge", "Country"]) {
      expect(svg).toContain(s);
    }
    expect(svg).toContain('id="cell-l2-operational"');
  });

  test("unknownBandRefused", () => {
    const dir = mkdtempSync(join(tmpdir(), "smart-approach-"));
    const p = join(dir, "bad.json");
    writeFileSync(p, JSON.stringify({ ...fig, rows: [{ ...fig.rows[0], to: "nowhere" }, fig.rows[1]] }));
    expect(() => loadFigure(p)).toThrow(/unknown band nowhere/);
  });

  test("textWraps", () => {
    for (const line of wrap("Software that is able to execute static algorithms and interoperable digital components")) {
      expect(line.length).toBeLessThanOrEqual(19);
    }
  });
});
