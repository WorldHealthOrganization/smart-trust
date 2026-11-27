/**
 * Tests for gettext over a page's HTML and SVG includes (`include-po.ts`).
 *
 * The falsifier: a Liquid tag is never a msgid, and an include's drawing comes
 * back in the catalogue's language with its labels and tooltips, the HTML
 * around it too.
 */
import { describe, expect, it } from "bun:test";

import { extractInclude, includeCatalogue, injectInclude } from "./include-po.ts";

const FIG = `<div class="fig"><label for="a">As drawn</label>
<div class="pane">{% include fig.svg %}</div>
<img src="v.svg" alt="The trust network, ArchiMate view"/></div>`;
const SVG = `<svg><a href="x"><title>Trust Anchor: the root of trust.</title><text font-size="18" text-anchor="middle"><tspan x="50" y="20">Trust Anchor</tspan></text></a></svg>`;

describe("extractInclude", () => {
  it("reads an HTML include's words and leaves its Liquid out", () => {
    const ids = extractInclude(FIG, "input/includes/fig.html").map((e) => e.msgid);
    expect(ids).toContain("As drawn");
    expect(ids).toContain("The trust network, ArchiMate view");
    expect(ids.some((m) => m.includes("{%"))).toBe(false);
  });

  it("reads an SVG include's labels and tooltips", () => {
    const ids = extractInclude(SVG, "input/includes/fig.svg").map((e) => e.msgid);
    expect(ids).toEqual(["Trust Anchor", "Trust Anchor: the root of trust."]);
  });
});

describe("injectInclude", () => {
  it("puts an include's words, labels and tooltips into the catalogue's language", () => {
    const cat = new Map([
      ["As drawn", "Tel que dessiné"],
      ["Trust Anchor", "Ancre de confiance"],
      ["Trust Anchor: the root of trust.", "Ancre de confiance : la racine de la confiance."],
    ]);
    expect(injectInclude(FIG, "fig.html", cat, "fr").text).toContain("Tel que dessiné");
    const svg = injectInclude(SVG, "fig.svg", cat, "fr").text;
    expect([...svg.matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)].map((m) => m[1]).join(" ")).toBe("Ancre de confiance");
    expect(svg).toContain("<title>Ancre de confiance : la racine de la confiance.</title>");
  });

  it("lays an Arabic label out right to left, its edge where the English edge was", () => {
    const svg = `<svg><text font-size="16" text-anchor="start"><tspan x="40" y="20">Verify each</tspan><tspan x="40" y="39.2">document</tspan></text><text x="5" y="9">1</text></svg>`;
    const out = injectInclude(svg, "fig.svg", new Map([["Verify each document", "التحقق"]]), "ar").text;
    expect(out.startsWith('<svg direction="ltr">')).toBe(true);
    expect(out).toContain('text-anchor="end" direction="rtl"><tspan x="40.00"');
    expect(out).toContain('<text x="5" y="9">1</text>');
    expect(injectInclude(svg, "fig.svg", new Map([["Verify each document", "Vérifier"]]), "fr").text).not.toContain("direction");
  });

  it("names an include's catalogue by its file", () => {
    expect(includeCatalogue("fig.svg")).toBe("includes/fig.svg");
  });
});
