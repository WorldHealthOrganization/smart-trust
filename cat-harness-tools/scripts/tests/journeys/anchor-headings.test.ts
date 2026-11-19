/**
 * Every section heading of a journeys view has an anchor (owner, 2026-11-11:
 * "sections and steps need anchors").
 *
 * @module scripts/tests/journeys/anchor-headings.test
 */
import { describe, expect, test } from "bun:test";

import { anchorHeadings } from "../../journeys/present.ts";

describe("anchorHeadings", () => {
  test("a heading with no id gets one from its text, unique on the page", () => {
    const out = anchorHeadings(
      '<section id="hood"><h3 class="jp-h"><svg></svg> Who’s in this moment</h3></section>' +
        "<h3>Policy takeaway</h3><h4>Policy takeaway</h4><h2>Hood</h2>",
    );
    expect(out).toContain('<h3 id="who-s-in-this-moment" class="jp-h">');
    expect(out).toContain('<h3 id="policy-takeaway">');
    expect(out).toContain('<h4 id="policy-takeaway-2">');
    // An id already on the page is not reused.
    expect(out).toContain('<h2 id="hood-2">');
  });

  test("a heading that has an id keeps it, and other markup is unchanged", () => {
    const html = '<h3 id="steps">Steps</h3><p>text</p><h5>Deep</h5>';
    expect(anchorHeadings(html)).toBe(html);
  });
});
