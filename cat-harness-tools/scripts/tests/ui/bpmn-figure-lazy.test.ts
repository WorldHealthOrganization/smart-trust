// The BPMN figure image gen-docs-pages writes is lazy (owner, 2026-11-14: "do
// lazy load content and libs"), and printing still gets it ("Make sure
// printing loads all of the content before it renders the PDF on the
// browser"): the eager switch and the inlining on beforeprint are docs-ui.js's
// (cat-harness site-chrome/tests/lazy-diagrams.test.ts).
import { describe, expect, test } from "bun:test";
import { bpmnFigureLines } from "../../gen-docs-pages.ts";

describe("the BPMN figure image", () => {
  test("is loaded lazily and decoded off the main thread", () => {
    const html = bpmnFigureLines("p1", "{{ '/assets/img/workflows/p1.svg' | relative_url }}", "A process").join("\n");
    expect(html).toContain('<div class="bpmn-figure" id="figure-p1">');
    expect(html).toMatch(/<img src="\{\{ '\/assets\/img\/workflows\/p1\.svg' \| relative_url \}\}" loading="lazy" decoding="async"/);
  });

  test("keeps its alt text, quotes escaped", () => {
    expect(bpmnFigureLines("p2", "x.svg", 'Say "hi"').join("\n")).toContain('alt="Say &quot;hi&quot;"');
  });

  test("keeps the src docs-ui.js selects to inline it, so printing inlines it too", () => {
    // docs-ui.js inlines `.bpmn-figure img[src$=".svg"]`: the attribute order
    // must leave src ending in .svg.
    expect(bpmnFigureLines("p3", "a/b.svg", "x")[1]).toMatch(/src="[^"]*\.svg"/);
  });
});
