import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, posix } from "node:path";
import type { ArchimateModel } from "../schemas/archimate.ts";
import { SLUG_MAX, planSlugs, slugify } from "../schemas/slugs.ts";
import { pageNodeOf, pageNodeProblems } from "../../scripts/thin-page.ts";
import { modelFilesFor, pageDataOf, pagesFor, sitePathOf } from "./gen-archimate-pages.ts";

/** A model of named elements and views, nothing drawn: all {@link planSlugs} reads. */
function model(elements: Array<[string, string, string?]>, views: Array<[string, string, string?]> = []): ArchimateModel {
  const props = (slug?: string) => (slug ? [{ key: "slug", value: slug }] : []);
  return {
    id: "id-model",
    name: "M",
    properties: [],
    elements: elements.map(([id, name, slug]) => ({ id, type: "ApplicationComponent", name, layer: "Application", properties: props(slug), folder: [] })),
    relationships: [],
    views: views.map(([id, name, slug]) => ({ id, name, properties: props(slug), folder: [], nodes: [], connections: [] })),
  };
}

describe("slugify", () => {
  it("makes lower-case words joined by dashes, accents dropped", () => {
    expect(slugify("1. Central Health Workforce Registry")).toBe("1-central-health-workforce-registry");
    expect(slugify("  Équipe de santé (draft) ")).toBe("equipe-de-sante-draft");
    expect(slugify("Registry <script>")).toBe("registry-script");
  });

  it("cuts a long name at a word break", () => {
    const s = slugify("Budget execution reports with actionable insights by program geography facility and more")!;
    expect(s.length).toBeLessThanOrEqual(SLUG_MAX);
    expect(s).toBe("budget-execution-reports-with-actionable-insights-by-program");
  });

  it("gives nothing for a name with nothing readable, or one that looks like an Archi id", () => {
    expect(slugify("")).toBeUndefined();
    expect(slugify("—")).toBeUndefined();
    expect(slugify("id-007936f8c2424b96ad1893ef0ff66059")).toBeUndefined();
  });
});

describe("planSlugs", () => {
  it("slugs every named view and element; a clash gives the later one its id's first hex", () => {
    const s = planSlugs(model([["id-aaaa1111", "Business Service"], ["id-bbbb2222", "Business Service"], ["id-c", ""]], [["id-v", "Business Service"]]));
    expect(Object.fromEntries(s)).toEqual({ "id-aaaa1111": "business-service", "id-bbbb2222": "business-service-bbbb", "id-v": "business-service" });
    // Unnamed: no slug, so its page stays at its id.
    expect(s.has("id-c")).toBe(false);
  });

  it("is the same every time for the same model", () => {
    const m = model([["id-a", "Lookup"], ["id-b", "Lookup"]]);
    expect([...planSlugs(m)]).toEqual([...planSlugs(m)]);
  });

  it("an author's `slug` property wins, even over an earlier object's name; a malformed or doubled one is refused", () => {
    expect(Object.fromEntries(planSlugs(model([["id-a", "Hwr"], ["id-b", "Other", "hwr"]])))).toEqual({ "id-b": "hwr", "id-a": "hwr-a" });
    expect(() => planSlugs(model([["id-a", "X", "Not A Slug"]]))).toThrow(/is not lower-case words/);
    expect(() => planSlugs(model([["id-a", "X", "hwr"], ["id-b", "Y", "hwr"]]))).toThrow(/also chosen by id-a/);
  });
});

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<archimate:model xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:archimate="http://www.archimatetool.com/archimate" name="Tiny" id="id-model" version="5.0.0">
  <folder name="Application" id="id-f1" type="application">
    <element xsi:type="archimate:ApplicationComponent" name="Health Worker Registry" id="id-a"/>
    <element xsi:type="archimate:ApplicationService" name="Lookup" id="id-b"/>
    <element xsi:type="archimate:ApplicationService" name="Lookup" id="id-c9"/>
  </folder>
  <folder name="Relations" id="id-f2" type="relations">
    <element xsi:type="archimate:ServingRelationship" id="id-r1" source="id-b" target="id-a"/>
  </folder>
  <folder name="Views" id="id-f3" type="diagrams">
    <element xsi:type="archimate:ArchimateDiagramModel" name="1. Central Health Workforce Registry" id="id-v1">
      <child xsi:type="archimate:DiagramObject" id="id-da" archimateElement="id-a"><bounds x="10" y="10" width="120" height="55"/></child>
      <child xsi:type="archimate:DiagramObject" id="id-db" archimateElement="id-b">
        <bounds x="10" y="200" width="120" height="55"/>
        <sourceConnection xsi:type="archimate:Connection" id="id-c1" source="id-db" target="id-da" archimateRelationship="id-r1"/>
      </child>
    </element>
  </folder>
</archimate:model>`;

function instance(): string {
  const root = mkdtempSync(join(tmpdir(), "archimate-slugs-"));
  writeFileSync(
    join(root, "tiny.json"),
    JSON.stringify({
      name: "tiny",
      iriBase: "https://example.org/tiny/",
      directories: [{ id: "archimate", path: "archimate/", graphTypologies: ["archimate"] }],
      visualisers: [{ id: "archimate", renderedBy: "archimate-pages", covers: ["archimate"] }],
    }),
  );
  mkdirSync(join(root, "archimate", "1.0.0"), { recursive: true });
  writeFileSync(join(root, "archimate", "1.0.0", "model.archimate"), XML);
  writeFileSync(join(root, "archimate", "cat-archimate.config.json"), JSON.stringify({ $schema: "cat-archimate-config/v1", directory: "archimate", models: [{ id: "1.0.0", file: "1.0.0/model.archimate" }] }));
  return root;
}

describe("pages at slugs", () => {
  it("puts each view and element page at its slug, keeps the id IRI, and leaves nothing at the id path", () => {
    const root = instance();
    try {
      const files = pagesFor(root).files;
      const at = (p: string) => files.find((f) => f.path === p);
      const view = at("1.0.0/view/1-central-health-workforce-registry/index.html")!;
      expect(pageDataOf(view.content)).toMatchObject({ node: "../id-v1.jsonld", svg: "../id-v1.svg" });
      // The page declares its node: the id IRI, extensionless, in RDFa and in the JSON-LD stub alike.
      expect(pageNodeOf(view.content)!.rdfa[0]).toEqual({ iri: "https://example.org/tiny/archimate/1.0.0/view/id-v1", types: ["http://www.opengroup.org/xsd/archimate/3.0/Diagram"] });
      expect(pageNodeProblems(view.content)).toEqual([]);
      expect(at("1.0.0/element/lookup/index.html")).toBeDefined();
      expect(at("1.0.0/element/lookup-c9/index.html")).toBeDefined();
      // Relationships keep id paths.
      expect(at("1.0.0/relationship/id-r1/index.html")).toBeDefined();
      // A clean break: no page at the old id path.
      expect(at("1.0.0/view/id-v1/index.html")).toBeUndefined();
      expect(at("1.0.0/element/id-a/index.html")).toBeUndefined();
      // The IRI is the id, as before.
      expect(JSON.parse(at("1.0.0/view/id-v1.jsonld")!.content)["@id"]).toBe("https://example.org/tiny/archimate/1.0.0/view/id-v1");
      // The drawing, the rail and the loader all link the slug.
      expect(at("1.0.0/view/id-v1.svg")!.content).toContain('href="../element/health-worker-registry/"');
      expect(at("1.0.0/index.html")!.content).toContain('"href":"./view/1-central-health-workforce-registry/"');
      expect(JSON.parse(at("1.0.0/model.json")!.content).slugs).toMatchObject({ "id-v1": "1-central-health-workforce-registry", "id-c9": "lookup-c9" });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("in a site, every link a page or a drawing makes reaches a file the run writes", () => {
    const root = instance();
    try {
      const { graphPath, pageRoot, files } = pagesFor(root, { site: true });
      const at = (f: (typeof files)[number]) => sitePathOf({ graphPath, pageRoot }, f);
      const written = new Set(files.map(at));
      for (const f of files.filter((x) => x.page || x.path.endsWith(".svg"))) {
        const refs = [...f.content.matchAll(/(?:href|src|data)="([^"#:]+)"/g)].map((m) => m[1]!);
        const cfg = f.page && f.path !== "index.html" ? (pageDataOf(f.content) as Record<string, unknown>) : {};
        for (const k of ["node", "model", "svg"]) if (typeof cfg[k] === "string") refs.push(cfg[k] as string);
        for (const r of refs) {
          const target = posix.normalize(posix.join(posix.dirname(at(f)), r));
          expect({ from: at(f), r, ok: written.has(target) || written.has(posix.join(target, "index.html")) }).toEqual({ from: at(f), r, ok: true });
        }
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("the Archi model file a model page links", () => {
  it("is listed for the site build at its data path, so the link is not a 404", () => {
    const root = instance();
    try {
      const files = modelFilesFor(root);
      expect(files.map((f) => f.file)).toEqual(["1.0.0/model.archimate"]);
      expect(files[0]!.source).toBe(join(root, "archimate", "1.0.0", "model.archimate"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
