/**
 * Tests for gettext over an inline drawing's labels (`svg-label-po.ts`).
 *
 * The falsifier: a label is one `<text>` whose `<tspan>`s are its lines, so the
 * msgid must be the whole label and the translation must come back as new
 * lines centred where the English was, never as the English lines' count.
 */
import { describe, expect, it } from "bun:test";

import { extractSvgLabels, injectSvgLabels, wrap } from "./svg-label-po.ts";

const SVG = `<p>Outside</p><svg><g><text lineHeight="1.05" class="djs-label" style="font-family: Arial, sans-serif; font-size: 12px;"><tspan x="20" y="30">Verify each</tspan><tspan x="25" y="44.4">HCERT</tspan></text><title>Dr. Anan</title><svg><text x="6" y="18">😄 +2</text></svg></g></svg>`;

describe("extractSvgLabels", () => {
  it("joins a label's lines into one msgid and reads <title>s", () => {
    const ids = extractSvgLabels(SVG);
    expect(ids).toContain("Verify each HCERT");
    expect(ids).toContain("Dr. Anan");
    expect(ids).not.toContain("Outside");
  });
});

describe("injectSvgLabels", () => {
  it("re-wraps a translation into centred lines around the English block's middle", () => {
    const r = injectSvgLabels(SVG, new Map([["Verify each HCERT", "Vérifier chaque HCERT contre la liste de confiance"]]));
    const spans = [...r.html.matchAll(/<tspan x="([0-9.]+)" y="([0-9.]+)">([^<]*)<\/tspan>/g)];
    expect(spans.length).toBeGreaterThan(2);
    expect(spans.map((s) => s[3]).join(" ")).toBe("Vérifier chaque HCERT contre la liste de confiance");
    const ys = spans.map((s) => Number(s[2]));
    expect((ys[0] + ys[ys.length - 1]) / 2).toBeCloseTo(37.2, 1);
  });

  it("leaves a drawing untouched when nothing is translated", () => {
    expect(injectSvgLabels(SVG, new Map()).html).toBe(SVG);
  });

  it("replaces a <title> and escapes it", () => {
    expect(injectSvgLabels(SVG, new Map([["Dr. Anan", "Dr Anan <x>"]])).html).toContain("<title>Dr Anan &lt;x&gt;</title>");
  });
});

describe("wrap", () => {
  it("breaks a CJK run between characters", () => {
    expect(wrap("核对每一份数字疫苗证书", 12, 50).length).toBeGreaterThan(1);
  });
});
