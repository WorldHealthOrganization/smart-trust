/**
 * Figure and table headings carry their source number and a link icon.
 *
 * Owner, 2026-10-31, on the dth-pc preview: "are the tables and figures
 * numbered in source content? why not in rendered?" The ingested captions kept
 * "Fig. 1. ...", but the heading printed a bare "Figure." with no link icon.
 */
import { describe, expect, test } from "bun:test";

import { captionNumber, renderBlockMarkdown } from "./render-markdown";
import type { Block } from "../schemas/types.ts";

const fig = (caption: string, label = "fig:1") =>
  ({ block: { kind: "figure", label, caption, file: "media/x.png" } as unknown as Block, mdContent: "![alt](media/x.png)" });

describe("captionNumber", () => {
  test("reads the source's own number in its common forms", () => {
    expect(captionNumber("Fig. 1. Product master data")).toEqual({ number: "1", rest: "Product master data" });
    expect(captionNumber("Fig 6. WHO SMART Guidelines approach")).toEqual({ number: "6", rest: "WHO SMART Guidelines approach" });
    expect(captionNumber("Figure 2.13: m4RH monitoring data")).toEqual({ number: "2.13", rest: "m4RH monitoring data" });
    expect(captionNumber("Table 3. Roles")).toEqual({ number: "3", rest: "Roles" });
  });
  test("a caption naming two figures keeps its text and gives a range", () => {
    const r = captionNumber("Fig. 26. Current state in Ethiopia; Fig. 27. Future state in Ethiopia");
    expect(r!.number).toBe("26–27");
    expect(r!.rest).toContain("Fig. 27.");
  });
  test("invents nothing when the source has no number", () => {
    expect(captionNumber("Target users of this handbook across Chapters 1–7")).toBeNull();
  });
});

describe("renderBlockMarkdown headings", () => {
  test("a numbered figure: number in the heading, a link icon, no duplicate number", () => {
    const md = renderBlockMarkdown(fig("Fig. 1. Product master data"));
    expect(md).toContain('<a id="fig:1"></a>');
    expect(md).toContain("**Figure 1.**");
    expect(md).toContain('href="#fig:1" class="block-anchor"');
    expect(md).toContain("*Product master data*");
    expect(md).not.toContain("*Fig. 1. Product master data*");
  });
  test("a numbered figure says its caption once, on the heading line", () => {
    const md = renderBlockMarkdown(fig("Fig. 5. WHO SMART Guidelines Approach", "fig:5"));
    expect(md).toContain("**Figure 5.** *WHO SMART Guidelines Approach*");
    expect(md.split("WHO SMART Guidelines Approach").length - 1).toBe(1);
  });
  test("an unnumbered table keeps its plain heading and still gets the link icon", () => {
    const md = renderBlockMarkdown({
      block: { kind: "table", label: "tbl:target-users", caption: "Target users" } as unknown as Block,
      mdContent: "| a |\n|---|\n| b |",
    });
    expect(md).toContain("**Table.**");
    expect(md).toContain('href="#tbl:target-users"');
    expect(md).toContain("*Target users*");
  });
  test("no anchors means no link icon", () => {
    expect(renderBlockMarkdown(fig("Fig. 2. X", "fig:2"), { anchors: false })).not.toContain("block-anchor");
  });
});

describe("the numbered-block frame", () => {
  test("a figure, diagram or table sits in one frame, Markdown kept inside", () => {
    const md = renderBlockMarkdown(fig("Fig. 1. Product master data"));
    expect(md.startsWith('<div class="fa-numbered fa-numbered-figure" markdown="1">\n\n')).toBe(true);
    expect(md.endsWith("\n\n</div>")).toBe(true);
    const t = renderBlockMarkdown({ block: { kind: "table", label: "tbl:x", caption: "X" } as unknown as Block, mdContent: "| a |\n|---|\n| b |" });
    expect(t).toContain('class="fa-numbered fa-numbered-table"');
  });
  test("prose has no frame", () => {
    const md = renderBlockMarkdown({ block: { kind: "prose", label: "prose:x" } as unknown as Block, mdContent: "Text." });
    expect(md).not.toContain("fa-numbered");
  });
});

describe("structured blocks: a light card", () => {
  const fr = {
    block: { kind: "functional-requirement", label: "freq:FR-AN-01", title: "Standard reports and dashboards on stock…", meta: { requirementId: "FR-AN-01" } } as unknown as Block,
    mdContent: "**FR-AN-01.** Standard reports and dashboards on stock and status.\n\n*Priority:* to be set. *Linked use cases:* to be traced.\n",
  };
  test("kind label, id chip and the body on one line; the id and the cut title are said once", () => {
    const md = renderBlockMarkdown(fr);
    expect(md.startsWith('<div class="fa-block fa-block-functional-requirement" markdown="1">\n\n')).toBe(true);
    expect(md).toContain('<span class="fa-block-kind">Functional requirement</span> <span class="fa-block-id">FR-AN-01</span> Standard reports and dashboards on stock and status.');
    expect(md).not.toContain("**FR-AN-01.**");
    expect(md).not.toContain("stock…");
  });
  test("trailing *Label:* lines become the metadata row", () => {
    expect(renderBlockMarkdown(fr)).toContain('<div class="fa-block-meta" markdown="1">\n\n*Priority:* to be set. *Linked use cases:* to be traced.\n\n</div>');
  });
  test("an id with a title in its bold lead keeps the title", () => {
    const md = renderBlockMarkdown({
      block: { kind: "non-functional-requirement", label: "nfreq:NFR-01", title: "Security", meta: { requirementId: "NFR-01" } } as unknown as Block,
      mdContent: "**NFR-01 Security.** Data are protected.",
    });
    expect(md).toContain('<span class="fa-block-kind">Non-functional requirement</span> <span class="fa-block-id">NFR-01</span> **Security.** Data are protected.');
  });
  test("a list body keeps the heading on its own line, and the text is otherwise unchanged", () => {
    const body = "- One.\n- Two.\n\n```\na\n\n\nb\n```";
    const md = renderBlockMarkdown({ block: { kind: "user-scenario", label: "scen:x", title: "X" } as unknown as Block, mdContent: body });
    expect(md).toContain('<span class="fa-block-kind">User scenario</span> **X.**\n\n' + body);
  });
  test("an indicator shows its id, its calculation as a fraction, and its module and disaggregation", () => {
    const md = renderBlockMarkdown({
      block: {
        kind: "indicator",
        label: "ind:1-01",
        title: "Density of health workers",
        meta: { indicatorId: "1-01", module: "1", numerator: "Active health workers", denominator: "Total population", unit: "10 000", disaggregation: "occupation; sex" },
      } as unknown as Block,
      mdContent: "Health workers per 10 000 population.",
    });
    expect(md).toContain('<span class="fa-block-kind">Indicator</span> <span class="fa-block-id">1-01</span> **Density of health workers.** Health workers per 10 000 population.');
    expect(md).toContain('<span class="fa-block-ratio-num"><span class="fa-block-ratio-label">Numerator</span> Active health workers</span>');
    expect(md).toContain('<span class="fa-block-ratio-unit">\u00d7 10 000</span>');
    expect(md).toContain("*Module:* 1 \u00b7 *Disaggregation:* occupation; sex");
  });
  test("an indicator whose text already gives the numerator is not repeated", () => {
    const md = renderBlockMarkdown({
      block: { kind: "indicator", label: "ind:x", meta: { numerator: "A", denominator: "B" } } as unknown as Block,
      mdContent: "Text.\n\n*Numerator:* A. *Denominator:* B.",
    });
    expect(md).not.toContain("fa-block-ratio");
  });
  test("prose and numbered kinds are not cards", () => {
    expect(renderBlockMarkdown({ block: { kind: "prose", label: "p:x" } as unknown as Block, mdContent: "Text." })).not.toContain("fa-block");
    expect(renderBlockMarkdown(fig("Fig. 1. X"))).not.toContain("fa-block ");
  });
});
