import { describe, expect, test } from "bun:test";
import { figureTitlesBelow, numberFigures } from "./figure-numbers.ts";

const link = (label: string, what: string) =>
  ` <a href="#${label}" class="block-anchor" aria-label="Link to ${what}" title="Link to ${what}"><svg></svg></a>`;
const frame = (kind: string, label: string, heading: string, what: string) =>
  [`<div class="fa-numbered fa-numbered-${kind}" markdown="1">`, "", `<a id="${label}"></a>`, `**${heading}.**${link(label, what)}`, "", "![x](media/x.svg)", "", "</div>", ""].join("\n");

describe("figure-numbers", () => {
  test("unnumberedFiguresTakeNextNumber", () => {
    const md = [
      frame("figure", "fig:a", "Figure", "Figure"),
      frame("table", "tbl:a", "Table", "Table"),
      frame("figure", "fig:b", "Figure", "Figure"),
    ].join("\n");
    const out = numberFigures(md);
    expect(out).toContain(`**Figure 1.**${link("fig:a", "Figure 1")}`);
    expect(out).toContain(`**Figure 2.**${link("fig:b", "Figure 2")}`);
    expect(out).toContain(`**Table 1.**${link("tbl:a", "Table 1")}`);
  });

  test("sourceNumbersKeptAndContinued", () => {
    const md = [
      frame("figure", "fig:a", "Figure 4", "Figure 4").replace("**Figure 4.**", "**Figure 4.** *From the source*"),
      frame("figure", "fig:b", "Figure", "Figure"),
      frame("figure", "fig:c", "Figure 2.13", "Figure 2.13"),
      frame("figure", "fig:d", "Figure", "Figure"),
    ].join("\n");
    const out = numberFigures(md);
    expect(out).toContain("**Figure 4.** *From the source*");
    expect(out).toContain(`**Figure 5.**${link("fig:b", "Figure 5")}`);
    expect(out).toContain("**Figure 2.13.**");
    expect(out).toContain(`**Figure 6.**${link("fig:d", "Figure 6")}`);
  });

  test("boldOutsideFrameOrInFenceUntouched", () => {
    const md = ["**Figure.** in prose", "```", '<div class="fa-numbered fa-numbered-figure" markdown="1">', "**Figure.**", "```"].join("\n");
    expect(numberFigures(md)).toBe(md);
  });
});

describe("figure titles go under the drawing", () => {
  test("titleMovedBelowCaptionMerged", () => {
    const md = ['<div class="fa-numbered fa-numbered-figure" markdown="1">', "", '<a id="fig:a"></a>', `**Figure 1.**${link("fig:a", "Figure 1")}`, "",
      "![x](media/x.svg)", "", "*Source: a note.*", "", "*Phases and steps*", "", "</div>"].join("\n");
    const out = figureTitlesBelow(md).split("\n");
    expect(out.indexOf('<a id="fig:a"></a>')).toBeLessThan(out.indexOf("![x](media/x.svg)"));
    const title = out.findIndex((l) => l.startsWith("**Figure 1.**"));
    expect(title).toBeGreaterThan(out.indexOf("*Source: a note.*"));
    expect(out[title]).toBe(`**Figure 1.** *Phases and steps*${link("fig:a", "Figure 1")}`);
    expect(out).not.toContain("*Phases and steps*");
    expect(out[out.length - 1]).toBe("</div>");
  });

  test("namedTitleMovedAsIsTableUntouched", () => {
    const fig = ['<div class="fa-numbered fa-numbered-figure" markdown="1">', "", '<a id="fig:a"></a>', "**Figure 4.** *From the source*", "", "![x](media/x.png)", "", "*A note*", "", "</div>"].join("\n");
    const out = figureTitlesBelow(fig).split("\n");
    expect(out.indexOf("**Figure 4.** *From the source*")).toBeGreaterThan(out.indexOf("*A note*"));
    const table = frame("table", "tbl:a", "Table 1", "Table 1");
    expect(figureTitlesBelow(table)).toBe(table);
  });
});
