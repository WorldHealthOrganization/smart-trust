/**
 * A thin page DECLARES the node it renders (issue #1830): RDFa `resource` /
 * `typeof` on the element the renderer fills, `<html prefix>` for the
 * namespaces, and a JSON-LD stub in the head with the same identity.
 */
import { describe, expect, it } from "bun:test";
import { kgRenderScript, nodeAttrs, nodeStubPageHtml, pageNodeOf, pageNodeProblems, thinPageHtml, type PageNode, type ThinPage } from "../thin-page.ts";

const NS = "https://example.org/ns/";
const node: PageNode = { iri: "https://example.org/tiny/widget/w1", types: ["ex:Widget"] };
const base = (over: Partial<ThinPage> = {}): ThinPage => ({
  title: "Widget w1",
  jsonld: "../w1.jsonld",
  script: "../assets/widget.js",
  renderer: "../assets/kg-render.js",
  node,
  prefixes: { ex: NS },
  body: `<main${nodeAttrs(node)}><h1>Widget w1</h1></main>`,
  ...over,
});

describe("a thin page that declares its node", () => {
  it("writes the node in RDFa and in a JSON-LD stub, and the two agree", () => {
    const html = thinPageHtml(base());
    expect(html).toContain(`<html lang="en" prefix="ex: ${NS}">`);
    expect(html).toContain('<main resource="https://example.org/tiny/widget/w1" typeof="ex:Widget">');
    expect(html).toContain(`<script type="application/ld+json">{"@context":{"ex":"${NS}"},"@id":"https://example.org/tiny/widget/w1","@type":"ex:Widget"}</script>`);
    expect(pageNodeOf(html)).toEqual({
      prefixes: { ex: NS },
      rdfa: [{ iri: node.iri, types: [`${NS}Widget`] }],
      stub: { iri: node.iri, types: [`${NS}Widget`] },
    });
    expect(pageNodeProblems(html)).toEqual([]);
  });

  it("loads the generic renderer before the family's script, and writes no private config block", () => {
    const html = thinPageHtml(base());
    expect(html.indexOf("kg-render.js")).toBeLessThan(html.indexOf("widget.js"));
    expect(html).not.toContain('type="application/json"');
  });

  it("refuses a body with no element carrying the node", () => {
    expect(() => thinPageHtml(base({ body: "<main><h1>w1</h1></main>" }))).toThrow(/no element of its body carries nodeAttrs/);
  });

  it("refuses a hash or query IRI, an undeclared prefix, and a node without the renderer", () => {
    const hash = { iri: "https://example.org/ns#w1", types: ["ex:Widget"] };
    expect(() => thinPageHtml(base({ node: hash, body: `<main${nodeAttrs(hash)}></main>` }))).toThrow(/slash IRIs/);
    expect(() => thinPageHtml(base({ prefixes: {} }))).toThrow(/prefix "ex"/);
    expect(() => thinPageHtml(base({ renderer: undefined }))).toThrow(/generic renderer/);
  });

  it("refuses a page that declares neither a node nor a config block", () => {
    expect(() => thinPageHtml(base({ node: undefined, body: "<main></main>" }))).toThrow(/neither a node nor a config block/);
  });

  it("reports an RDFa and a stub that disagree", () => {
    const html = thinPageHtml(base()).replace('"@id":"https://example.org/tiny/widget/w1"', '"@id":"https://example.org/tiny/widget/w2"');
    expect(pageNodeProblems(html)).toEqual(["JSON-LD stub names https://example.org/tiny/widget/w2, RDFa names https://example.org/tiny/widget/w1"]);
  });

  it("still writes a config-block page unchanged when no node is given", () => {
    const html = thinPageHtml(base({ node: undefined, renderer: undefined, prefixes: undefined, configId: "x-page", config: { kind: "x" }, body: "<main></main>" }));
    expect(html).toContain('<script type="application/json" id="x-page">{"kind":"x"}</script>');
    expect(html).toContain('<html lang="en">');
    expect(pageNodeOf(html)).toBeUndefined();
  });

  it("ships the generic renderer", () => {
    const js = kgRenderScript();
    expect(js).toContain("[resource][typeof]");
    expect(js).toContain("window.kgRenderers");
  });

  it("writes the small page at a node's IRI with the same declaration, a link and a redirect, and no script", () => {
    const html = nodeStubPageHtml({ title: "Widget w1", node, prefixes: { ex: NS }, jsonld: "w1.jsonld", page: "../../en/x/widget/w1/" });
    expect(pageNodeProblems(html)).toEqual([]);
    expect(pageNodeOf(html)!.rdfa[0]!.iri).toBe(node.iri);
    expect(html).toContain('<meta http-equiv="refresh" content="0; url=../../en/x/widget/w1/">');
    expect(html).toContain('<link rel="canonical" href="../../en/x/widget/w1/">');
    expect(html).not.toContain("<script src=");
    expect(Buffer.byteLength(html)).toBeLessThan(1000);
  });
});
