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

// The shapes the block renderer gives dth-phc's blocks (2026-11-17): a title
// printed verbatim beside a heading numbered from it, a range taken from a
// caption that cites another figure, a table numbered from the figure it
// tabulates, and a caption left as the frame's last italic line.
const titled = (kind: string, label: string, heading: string, caption: string) =>
  frame(kind, label, heading, heading).replace(`**${heading}.**`, `**${heading}.** *${caption}*`);

describe("a caption's own source label is not printed twice", () => {
  test("titleWithSourceLabelLosesIt", () => {
    const out = numberFigures(titled("figure", "fig:3", "Figure 3", "Fig. 3. Primary health care digital ecosystem"));
    expect(out).toContain(`**Figure 3.** *Primary health care digital ecosystem*${link("fig:3", "Figure 3")}`);
    expect(out).not.toContain("Fig. 3.");
  });

  test("rangeFromCitedFigureKeepsOwnNumber", () => {
    const cap = "Fig. 6. Planning and implementing a digital health enterprise (adapted from WHO DIIG Fig. 1.1.1)";
    const out = numberFigures(titled("figure", "fig:6", "Figure 6–1.1.1", cap));
    expect(out).toContain(`**Figure 6.** *Planning and implementing a digital health enterprise (adapted from WHO DIIG Fig. 1.1.1)*${link("fig:6", "Figure 6")}`);
  });

  test("unnumberedHeadingTakesCaptionNumber", () => {
    const md = ['<div class="fa-numbered fa-numbered-figure" markdown="1">', "", '<a id="fig:a"></a>', `**Figure.**${link("fig:a", "Figure")}`, "",
      "![x](media/x.svg)", "", "*Figura 4: Ecosistema digital*", "", "</div>"].join("\n");
    const out = numberFigures(md);
    expect(out).toContain(`**Figure 4.**${link("fig:a", "Figure 4")}`);
    expect(out).toContain("*Ecosistema digital*");
    expect(out).not.toContain("Figura 4");
    expect(figureTitlesBelow(out)).toContain(`**Figure 4.** *Ecosistema digital*${link("fig:a", "Figure 4")}`);
  });

  test("everyLocaleAndSpelling", () => {
    for (const [cap, n] of [["Figure 2.13: Flows", "2.13"], ["Fig 7 Steps", "7"], ["FIG. 12. Data", "12"], ["Рис. 5. Схема", "5"], ["图 8 流程", "8"], ["Abb. 3. Ablauf", "3"]] as const) {
      const out = numberFigures(titled("figure", "fig:x", "Figure", cap));
      expect(out).toContain(`**Figure ${n}.** *`);
      expect(out).not.toContain(cap);
    }
    const t = numberFigures(titled("table", "tbl:x", "Tableau", "Tableau 3. Types de normes"));
    expect(t).toContain("**Tableau 3.** *Types de normes*");
  });

  test("captionWithoutLabelStillNumbered", () => {
    const out = numberFigures(titled("figure", "fig:a", "Figure", "Phases and steps"));
    expect(out).toContain(`**Figure 1.** *Phases and steps*${link("fig:a", "Figure 1")}`);
  });

  test("tableFromFigureNumberedAsItsOwnAndNeverReusesASourceNumber", () => {
    const md = [
      titled("table", "tbl:fig-1", "Table 1", "Fig. 1 table: From paper to digital"),
      titled("figure", "fig:1", "Figure 1", "Fig. 1. From paper to digital"),
      titled("table", "tbl:fig-8", "Table 8", "Fig. 8 as a table: example prompts"),
      titled("table", "tbl:1", "Table 1", "Table 1. Key BPMN symbols"),
      titled("table", "tbl:panel", "Table", "Chapter 3 phase panel"),
      titled("table", "tbl:2", "Table 2", "Table 2. Types of architecture domains"),
    ].join("\n");
    const out = numberFigures(md);
    expect(out).toContain("**Table 1.** *Key BPMN symbols*");
    expect(out).toContain("**Table 2.** *Types of architecture domains*");
    expect(out).toContain("**Figure 1.** *From paper to digital*");
    expect(out).toContain(`**Table 3.** *Fig. 1 table: From paper to digital*${link("tbl:fig-1", "Table 3")}`);
    expect(out).toContain(`**Table 4.** *Fig. 8 as a table: example prompts*${link("tbl:fig-8", "Table 4")}`);
    expect(out).toContain(`**Table 5.** *Chapter 3 phase panel*${link("tbl:panel", "Table 5")}`);
    const numbers = [...out.matchAll(/\*\*(Table \d+)\.\*\*/g)].map((m) => m[1]);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  test("untouchedWhenNothingToDo", () => {
    const md = titled("figure", "fig:a", "Figure 4", "From the source");
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
