import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type DiigFigure, loadFigure, renderSvg, resourceHref } from "./diig-phases-svg.ts";

const fig: DiigFigure = {
  $schema: "diig-phases-figure/v1",
  figure: { library: "lib-a", label: "Fig. 1", caption: "Phases", page: 1, file: "f.png" },
  legend: { d: "PDF for print" },
  phases: [
    { id: "01", name: ["ONE"], color: "#111111", tint: "#EEEEEE", steps: ["First step"] },
    { id: "02", name: ["TWO"], color: "#222222", tint: "#DDDDDD", steps: ["Second step"] },
  ],
  resources: [
    { id: "guide", label: ["A guide"], icons: ["d"], link: { library: "lib-a" } },
    { id: "kit", label: ["Kit"], icons: ["d", "m"], parts: [["Part", "one"], ["Part", "two"]] },
  ],
  layout: { columns: 2, rows: 2, tiles: [
    { resource: "guide", columns: [0, 0], rows: [0, 1], outlinePhase: "01" },
    { resource: "kit", columns: [0, 1], rows: [1, 1], outlinePhase: "02" },
  ] },
  thisDocument: { resource: "guide", style: "dashed", color: "#1A8FD6", fill: "#E8F3FB", note: "(this document)" },
};

describe("diig-phases-svg", () => {
  test("labelsFromData", () => {
    const svg = renderSvg(fig);
    for (const s of ["ONE", "TWO", "First step", "A guide", "Part", "(this document)", "PDF for print"]) expect(svg).toContain(s);
    expect(svg).toContain('id="tile-guide"');
    expect(svg).toContain('stroke-dasharray="5 3"');
  });

  test("tileLinksLibraryEntry", () => {
    expect(resourceHref(fig.resources[0], "https://x/library/")).toBe("https://x/library/lib-a/");
    expect(renderSvg(fig, { libraryBase: "https://x/library/" })).toContain('href="https://x/library/lib-a/"');
  });

  test("unknownResourceOrPhaseFails", () => {
    const bad = structuredClone(fig);
    bad.layout.tiles.push({ resource: "missing", columns: [1, 1], rows: [0, 0], outlinePhase: "01" });
    expect(() => renderSvg(bad)).toThrow(/unknown resource missing/);
    const badPhase = structuredClone(fig);
    badPhase.layout.tiles[0].outlinePhase = "09";
    expect(() => renderSvg(badPhase)).toThrow(/unknown phase 09/);
  });

  test("adaptationAddsTiles", () => {
    const dir = mkdtempSync(join(tmpdir(), "diig-"));
    const basePath = join(dir, "base.json");
    writeFileSync(basePath, JSON.stringify(fig));
    const adaptPath = join(dir, "adapt.json");
    writeFileSync(adaptPath, JSON.stringify({
      $schema: "diig-phases-adaptation/v1",
      adapts: basePath,
      resources: [{ id: "mine", label: ["My handbook"], icons: ["d"] }],
      tiles: [{ resource: "mine", columns: [2, 2], rows: [0, 1], outlinePhase: "01" }],
      thisDocument: { resource: "mine", style: "dashed", color: "#1A8FD6", fill: "#E8F3FB", note: "(this document)" },
    }));
    const adapted = loadFigure(adaptPath);
    expect(adapted.layout.columns).toBe(3);
    expect(adapted.resources.map((r) => r.id)).toEqual(["guide", "kit", "mine"]);
    const svg = renderSvg(adapted);
    expect(svg).toContain("My handbook");
    expect(svg.match(/\(this document\)/g)?.length).toBe(1);
  });
});
