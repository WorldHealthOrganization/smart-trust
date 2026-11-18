import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type AsDrawnFigureData, AsDrawnFigureSchema } from "../schemas/figure-data.ts";
import { renderAsDrawn, run, svgName } from "./as-drawn-svg.ts";

const fig: AsDrawnFigureData = {
  $schema: "as-drawn-figure/v1",
  figure: {
    library: "lib-a", labels: ["Fig. 3", "Fig. 4"], caption: "Fig 3. A & B", page: 7,
    file: "who-iris/library/lib-a/figures/vfig-p007.png", render: "vfig-p007",
    section: { id: "sec-001-x", title: "X", file: "who-iris/library/lib-a/sections/sec-001-x.md" },
  },
  basis: "test",
  region: [10, 20, 110, 70],
  canvas: { width: 100, height: 50 },
  clips: [{ d: "M0 0L50 0L50 50L0 50Z" }],
  shapes: [
    { d: "M1 1L99 1L99 49L1 49Z", fill: "#E6E6E6", stroke: "#3899A1", strokeWidth: 1, dash: [2, 1], cap: "round" },
    { d: "M10 10C20 20 30 30 40 40", stroke: "#000000", clip: [0] },
  ],
  texts: [
    { x: 5, y: 15, size: 8, text: "Ministry of health", weight: 700, color: "#001172", width: 55, link: "https://example.org/g/ministry-of-health" },
    { x: 3, y: 40, size: 7, text: "VERTICAL", rotate: 90, width: 30 },
  ],
};

describe("as-drawn-svg", () => {
  test("drawsDataAsPrinted", () => {
    const svg = renderAsDrawn(fig);
    expect(svg).toContain('viewBox="0 0 100 50"');
    expect(svg).toContain('d="M1 1L99 1L99 49L1 49Z" fill="#E6E6E6"');
    expect(svg).toContain('stroke-dasharray="2 1"');
    expect(svg).toContain('stroke-linecap="round"');
    expect(svg).toContain('textLength="55"');
    expect(svg).toContain('transform="rotate(90 3 40)"');
    expect(svg).toContain("<title id=\"t\">Fig 3. A &amp; B</title>");
  });

  test("clipsAndLinks", () => {
    const svg = renderAsDrawn(fig);
    expect(svg).toContain('<clipPath id="c0"');
    expect(svg).toContain('<g clip-path="url(#c0)"><path d="M10 10C20 20 30 30 40 40"');
    expect(svg).toContain('<a href="https://example.org/g/ministry-of-health">');
  });

  test("schemaRefusesBadData", () => {
    expect(AsDrawnFigureSchema.safeParse(fig).success).toBe(true);
    const noPaint = structuredClone(fig) as Record<string, unknown> & AsDrawnFigureData;
    noPaint.shapes = [{ d: "M0 0L1 1" }];
    expect(AsDrawnFigureSchema.safeParse(noPaint).success).toBe(false);
    const badClip = structuredClone(fig);
    badClip.shapes[1].clip = [3];
    expect(AsDrawnFigureSchema.safeParse(badClip).success).toBe(false);
    const badColour = structuredClone(fig);
    badColour.texts[0].color = "red";
    expect(AsDrawnFigureSchema.safeParse(badColour).success).toBe(false);
  });

  test("checkFindsStaleSvg", () => {
    const dir = mkdtempSync(join(tmpdir(), "as-drawn-"));
    const data = join(dir, "fig-3-4.json");
    writeFileSync(data, JSON.stringify(fig));
    const quiet = { log: () => {}, error: () => {} } as unknown as Console;
    expect(svgName(fig)).toBe("as-drawn-fig-3-4.svg");
    expect(run([data], dir, true, quiet)).toBe(1);
    expect(run([data], dir, false, quiet)).toBe(0);
    expect(readFileSync(join(dir, "as-drawn-fig-3-4.svg"), "utf-8")).toBe(renderAsDrawn(fig));
    expect(run([data], dir, true, quiet)).toBe(0);
  });
});
