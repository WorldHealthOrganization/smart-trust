import { describe, expect, test } from "bun:test";
import { markdownHeadings } from "../compose-docs.ts";

// Owner, 2026-11-13: ✎ edit and ✍ suggest on a plain page's sections, "own-text
// sections only". `markdownHeadings` is what decides which sections those are:
// the headings the page's own Markdown writes, with the line each is on.
describe("markdownHeadings: the headings a page writes itself", () => {
  test("ATX headings with their 1-based source lines, front matter skipped", () => {
    const md = ["---", "title: x", "---", "", "# Top", "text", "## Second ##", "### Third {#third}"].join("\n");
    expect(markdownHeadings(md)).toEqual([
      { t: "Top", l: 5 },
      { t: "Second", l: 7 },
      { t: "Third", l: 8 },
    ]);
  });

  test("a heading inside fenced code is not a heading", () => {
    const md = ["# Real", "```md", "# not a heading", "```", "~~~", "## nor this", "~~~", "## Also real"].join("\n");
    expect(markdownHeadings(md).map((h) => h.t)).toEqual(["Real", "Also real"]);
  });

  test("a link keeps its text; a Liquid heading is left out, since its rendered text is unknown", () => {
    const md = ["## See [the guide](x.md) first", "## {{ page.title }}", "{% include landing.html %}"].join("\n");
    expect(markdownHeadings(md)).toEqual([{ t: "See the guide first", l: 1 }]);
  });

  test("an include draws no heading of this file's own", () => {
    expect(markdownHeadings("{% include harness_details.html %}\n")).toEqual([]);
  });
});
