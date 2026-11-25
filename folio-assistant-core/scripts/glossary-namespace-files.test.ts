/**
 * A site being built serves each in-scope layer's namespace document at
 * `<iriBase>v0/ns/` (owner, 2026-11-18, option 1A), with every glossary
 * concept of that layer in it.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { namespaceFiles, skosAsset, termPagePath, type GlossarySource } from "./glossary-page.ts";
import { toSkos, type Glossary } from "../schemas/glossary.ts";
import { servedPath } from "../schemas/glossary-namespace.ts";

const site = "/site";
const scheme = (id: string, terms: string[]) =>
  ({ id, title: id, terms: terms.map((t) => ({ id: t, prefLabel: t, status: "authored" })) }) as unknown as Glossary;
const src = (instance: string, ns: string, g: Glossary, extracted?: boolean): GlossarySource =>
  ({ instance, ns, file: `${instance}/${g.id}.glossary.json`, glossary: g, ...(extracted ? { extracted: "skills" } : {}) }) as GlossarySource;

const own = src("layer", "https://example.org/layer/v0/ns/", scheme("demo", ["alpha", "beta"]));
const ownExtracted = src("layer", "https://example.org/layer/v0/ns/", scheme("kg-skills", ["gamma"]), true);
const other = src("other", "https://example.org/other/v0/ns/", scheme("theirs", ["delta"]));
const c = { glossaries: [own, ownExtracted, other] };

describe("namespaceFiles", () => {
  test("writes the namespace document of a layer whose namespace is under the site, and of no other", () => {
    const files = namespaceFiles(c, { site, siteBase: "https://example.org/layer/" }, new Set());
    expect([...files.keys()].filter((k) => !k.startsWith(join(site, "v0/ns/glossary/"))).sort()).toEqual([join(site, "v0/ns/index.html"), join(site, "v0/ns/index.json"), join(site, "v0/ns/index.jsonld")]);
    // Beside it, a page at each concept IRI (owner, 2026-11-19), of this layer only.
    expect(files.has(join(site, "v0/ns/glossary/demo/alpha/index.html"))).toBe(true);
    expect(files.has(join(site, "v0/ns/glossary/kg-skills/gamma/index.html"))).toBe(true);
    expect([...files.keys()].some((k) => k.includes("theirs"))).toBe(false);
    const doc = JSON.parse(files.get(join(site, "v0/ns/index.jsonld"))!);
    expect(doc["@id"]).toBe("https://example.org/layer/v0/ns/");
    const ids = (doc["@graph"] as Array<{ "@id": string }>).map((n) => n["@id"]);
    expect(ids).toContain("https://example.org/layer/v0/ns/glossary/demo/alpha");
    expect(ids).toContain("https://example.org/layer/v0/ns/glossary/kg-skills/gamma");
    expect(ids.some((i) => i.includes("/other/"))).toBe(false);
    expect(files.get(join(site, "v0/ns/index.json"))).toBe(files.get(join(site, "v0/ns/index.jsonld")));
  });
  test("links a term page only when this run writes it, and the scheme's SKOS, relative to the namespace", () => {
    const pages = new Set([termPagePath(own, "alpha")]);
    const files = namespaceFiles(c, { site, siteBase: "https://example.org/layer/" }, pages);
    const graph = JSON.parse(files.get(join(site, "v0/ns/index.jsonld"))!)["@graph"] as Array<Record<string, string>>;
    const at = (id: string) => graph.find((n) => n["@id"] === `https://example.org/layer/v0/ns/glossary/${id}`)!;
    expect(at("demo/alpha")["seeAlso"]).toMatch(/^\.\.\/\.\.\/en\/.*\/demo\/alpha\/$/);
    expect(at("demo/beta")["seeAlso"]).toBeUndefined();
    expect(at("demo")["seeAlso"]).toBe(`../../${skosAsset(own)}`);
  });
  test("with --instance, only that layer's document", () => {
    expect(namespaceFiles(c, { site, siteBase: "https://example.org/", only: "other" }, new Set()).has(join(site, "other/v0/ns/index.html"))).toBe(true);
    expect(namespaceFiles(c, { site, siteBase: "https://example.org/", only: "other" }, new Set()).has(join(site, "layer/v0/ns/index.html"))).toBe(false);
  });
  test("adds the concepts to the layer's vocabulary when the tools build one", () => {
    const vocab = { "@context": { layer: "https://example.org/layer/v0/ns/" }, "@id": "https://example.org/layer/v0/ns/", "@graph": [{ "@id": "layer:graphTypology/glossary" }] };
    const files = namespaceFiles(c, { site, siteBase: "https://example.org/layer/" }, new Set(), (i) => (i === "layer" ? vocab : undefined));
    const html = files.get(join(site, "v0/ns/index.html"))!;
    expect(html).toContain('id="graphTypology/glossary"');
    expect(html).toContain('id="glossary/demo/alpha"');
  });
  test("serves every IRI the scheme's SKOS mints in the namespace: a page at each path, an id for each fragment", () => {
    const g = {
      id: "demo",
      title: "demo",
      ordered: true,
      terms: [
        { id: "alpha", prefLabel: { en: "alpha", fr: "alpha (fr)", es: "alfa" }, definition: { en: "The first." }, scopeNote: "In tests.", status: "authored" },
        { id: "beta", prefLabel: "beta", related: ["alpha"], status: "authored" },
      ],
    } as unknown as Glossary;
    const layer = src("layer", "https://example.org/layer/v0/ns/", g);
    const files = namespaceFiles({ glossaries: [layer] }, { site, siteBase: "https://example.org/layer/" }, new Set());
    const minted = (toSkos(g, layer.ns)["@graph"] as Array<{ "@id": string }>).map((n) => n["@id"]).filter((i) => i.startsWith(layer.ns));
    expect(minted).toContain("https://example.org/layer/v0/ns/glossary/demo/alpha#label-fr");
    expect(minted).toContain("https://example.org/layer/v0/ns/glossary/demo#order");
    for (const iri of minted) {
      const at = servedPath(iri, "https://example.org/layer/")!;
      const page = files.get(join(site, at.dir, "index.html"));
      expect([iri, page !== undefined]).toEqual([iri, true]);
      if (at.fragment !== undefined) expect([iri, page!.includes(`id="${at.fragment}"`)]).toEqual([iri, true]);
    }
    const alpha = files.get(join(site, "v0/ns/glossary/demo/alpha/index.html"))!;
    expect(alpha).toContain('<span lang="es">alfa</span>');
    expect(alpha).toContain(`href="../../../../../${skosAsset(layer)}"`);
  });
  test("serves the SKOS this run writes into the site, not a second minting of it", () => {
    const written = { "@context": {}, "@graph": [{ "@id": "https://example.org/layer/v0/ns/glossary/demo/only-in-the-written-skos", "skos:prefLabel": "written" }] };
    const run = new Map([[join(site, skosAsset(own)), JSON.stringify(written)]]);
    const files = namespaceFiles({ glossaries: [own] }, { site, siteBase: "https://example.org/layer/" }, run);
    expect(files.has(join(site, "v0/ns/glossary/demo/only-in-the-written-skos/index.html"))).toBe(true);
    expect(files.has(join(site, "v0/ns/glossary/demo/alpha/index.html"))).toBe(false);
  });
});
