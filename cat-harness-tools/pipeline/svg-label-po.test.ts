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

  it("keeps a middle-anchored label centred on its x, reading a font-size attribute", () => {
    const svg = `<svg><text x="100" y="50" font-size="19" text-anchor="middle"><tspan x="100" y="50">Country A's</tspan><tspan x="100" y="72.8">Certificate Authority</tspan></text></svg>`;
    const r = injectSvgLabels(svg, new Map([["Country A's Certificate Authority", "Autorité de certification du pays A"]]));
    const spans = [...r.html.matchAll(/<tspan x="([0-9.]+)" y="([0-9.]+)">([^<]*)<\/tspan>/g)];
    expect(spans.map((s) => s[3]).join(" ")).toBe("Autorité de certification du pays A");
    for (const s of spans) expect(Number(s[1])).toBe(100);
    const ys = spans.map((s) => Number(s[2]));
    expect((ys[0] + ys[ys.length - 1]) / 2).toBeCloseTo(61.4, 1);
  });

  it("keeps a left-aligned block left-aligned", () => {
    const svg = `<svg><text font-size="16" text-anchor="start"><tspan x="40" y="20">Certify provenance,</tspan><tspan x="40" y="39.2">onboard members</tspan></text></svg>`;
    const r = injectSvgLabels(svg, new Map([["Certify provenance, onboard members", "Certifier la provenance, intégrer les membres"]]));
    const xs = [...r.html.matchAll(/<tspan x="([0-9.]+)"/g)].map((m) => Number(m[1]));
    expect(xs.length).toBeGreaterThan(1);
    for (const x of xs) expect(x).toBe(40);
  });

  it("grows a label down or up from its line, within the width it declares", () => {
    const down = `<svg><text font-size="18" text-anchor="middle" data-label-width="110" data-label-grow="down"><tspan x="100" y="200">Trust Anchor</tspan></text></svg>`;
    const ys = (h: string) => [...h.matchAll(/<tspan x="[0-9.]+" y="([0-9.]+)">/g)].map((m) => Number(m[1]));
    const d = ys(injectSvgLabels(down, new Map([["Trust Anchor", "Ancre de confiance"]])).html);
    expect(d.length).toBe(2);
    expect(d[0]).toBe(200);
    const up = down.replace("down", "up");
    const u = ys(injectSvgLabels(up, new Map([["Trust Anchor", "Ancre de confiance"]])).html);
    expect(u[u.length - 1]).toBe(200);
  });

  it("shrinks a name that asks to fit rather than take more lines, keeping its left edge", () => {
    const svg = `<svg><text font-size="12" data-label-width="90" data-label-grow="down" data-label-fit="shrink"><tspan x="40" y="20">Bahamas</tspan></text></svg>`;
    const out = injectSvgLabels(svg, new Map([["Bahamas", "Багамские Острова"]])).html;
    expect([...out.matchAll(/<tspan x="([0-9.]+)"/g)].map((m) => m[1])).toEqual(["40.00"]);
    expect(Number(/font-size="([0-9.]+)"/.exec(out)![1])).toBeLessThan(12);
  });

  it("leaves a drawing untouched when nothing is translated", () => {
    expect(injectSvgLabels(SVG, new Map()).html).toBe(SVG);
  });

  it("replaces a <title> and escapes it", () => {
    expect(injectSvgLabels(SVG, new Map([["Dr. Anan", "Dr Anan <x>"]])).html).toContain("<title>Dr Anan &lt;x&gt;</title>");
    // A drawing's own title, named by aria-labelledby, keeps its id.
    const own = `<svg aria-labelledby="t"><title id="t">The network</title></svg>`;
    expect(extractSvgLabels(own)).toEqual(["The network"]);
    expect(injectSvgLabels(own, new Map([["The network", "Le réseau"]])).html).toBe(`<svg aria-labelledby="t"><title id="t">Le réseau</title></svg>`);
  });
});

describe("wrap", () => {
  it("breaks a CJK run between characters", () => {
    expect(wrap("核对每一份数字疫苗证书", 12, 50).length).toBeGreaterThan(1);
  });
});
