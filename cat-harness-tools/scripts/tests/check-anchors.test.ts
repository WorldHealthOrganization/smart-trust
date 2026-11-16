import { describe, expect, test } from "bun:test";
import { anchorProblems } from "../check-anchors.ts";

describe("check-anchors: every page can be linked into and leads back (owner, 2026-11-02)", () => {
  test("a heading with no id is reported, by its text", () => {
    const p = anchorProblems("a.html", "<main><h2>Scope</h2><h3 id=\"x\">Ok</h3></main><script src=\"edit-links.js\"></script>");
    expect(p).toHaveLength(1);
    expect(p[0]!.reason).toContain('"Scope"');
  });

  test("headings inside scripts, styles and navigation are not judged", () => {
    const html = '<nav><h2>Menu</h2></nav><script>var h = "<h2>x</h2>";</script><style>h2{}</style><h2 id="a">A</h2><script src="../assets/js/edit-links.js"></script>';
    expect(anchorProblems("b.html", html)).toEqual([]);
  });

  test("anchored headings with no way to copy a link are reported", () => {
    const p = anchorProblems("c.html", '<h2 id="a">A</h2>');
    expect(p).toHaveLength(1);
    expect(p[0]!.reason).toContain("no 🔗");
    // The theme's heading anchors, or the inline runtime, count as a way.
    expect(anchorProblems("c.html", '<h2 id="a"><a href="#a" class="anchor-heading">#</a>A</h2>')).toEqual([]);
    expect(anchorProblems("c.html", '<h2 id="a">A</h2><script>(() => { if (window.faEditLinks) return; })()</script>')).toEqual([]);
  });

  test("a review page with no link back to its document is reported", () => {
    const review = '<h1>What changed</h1><div id="changes"></div>';
    expect(anchorProblems("en/review/index.html", review).map((p) => p.reason)).toContain("review page with no link back to the source document");
    expect(anchorProblems("en/review/index.html", review.replace("<div", '<p id="source-docs"></p><div'))).toEqual([]);
  });
});
