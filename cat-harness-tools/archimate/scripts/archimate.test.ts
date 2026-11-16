import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, posix } from "node:path";
import { deflateRawSync } from "node:zlib";
import { ARCHIMATE_MODEL_TAG, ArchimateConfigSchema, ArchimateModelSchema, layerOf, modelXmlOf, parseArchimate, readArchimate, zipEntry } from "../schemas/archimate.ts";
import { renderViewSvg, wrap } from "./render-view.ts";
import { archimateInstances, checkCommitted } from "./check-archimate.ts";
import { pageNodeOf, pageNodeProblems } from "../../scripts/thin-page.ts";
import { baseIriOf, pageDataOf, figureTargets, pagesFor, sitePathOf, type Written } from "./gen-archimate-pages.ts";
import { renderedByOf } from "../../scripts/viewer-declarations.ts";

/** A small Archi model: two elements in a group, a serving and an access relationship, a note. */
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<archimate:model xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:archimate="http://www.archimatetool.com/archimate" name="Tiny &lt;RA&gt;" id="id-model" version="5.0.0">
  <folder name="Application" id="id-f1" type="application">
    <element xsi:type="archimate:ApplicationComponent" name="Registry &lt;script&gt;" id="id-a">
      <documentation>Holds the records.</documentation>
      <property key="owner" value="WHO"/>
    </element>
    <element xsi:type="archimate:ApplicationService" name="Lookup" id="id-b"/>
    <element xsi:type="archimate:DataObject" name="Record" id="id-c"/>
  </folder>
  <folder name="Relations" id="id-f2" type="relations">
    <element xsi:type="archimate:ServingRelationship" id="id-r1" source="id-b" target="id-a"/>
    <element xsi:type="archimate:AccessRelationship" id="id-r2" source="id-a" target="id-c" accessType="1"/>
  </folder>
  <folder name="Views" id="id-f3" type="diagrams">
    <element xsi:type="archimate:ArchimateDiagramModel" name="Overview" id="id-v1" viewpoint="application_cooperation">
      <child xsi:type="archimate:Group" id="id-g" name="Platform">
        <bounds x="100" y="50" width="400" height="200"/>
        <child xsi:type="archimate:DiagramObject" id="id-da" archimateElement="id-a">
          <bounds x="20" y="40" width="-1" height="-1"/>
          <sourceConnection xsi:type="archimate:Connection" id="id-c2" source="id-da" target="id-dc" archimateRelationship="id-r2">
            <bendpoint startX="0" startY="80" endX="-100" endY="0"/>
          </sourceConnection>
        </child>
      </child>
      <child xsi:type="archimate:DiagramObject" id="id-db" archimateElement="id-b">
        <bounds x="120" y="300" width="120" height="55"/>
        <sourceConnection xsi:type="archimate:Connection" id="id-c1" source="id-db" target="id-da" archimateRelationship="id-r1"/>
      </child>
      <child xsi:type="archimate:DiagramObject" id="id-dc" archimateElement="id-c">
        <bounds x="400" y="300" width="120" height="55"/>
      </child>
      <child xsi:type="archimate:Note" id="id-n">
        <bounds x="600" y="50" width="185" height="80"/>
        <content>A note &amp; its text</content>
      </child>
    </element>
  </folder>
</archimate:model>`;

/** A zip archive of one entry, stored (method 0) or deflated (8). */
function zipOf(name: string, data: Buffer, deflate: boolean): Buffer {
  const body = deflate ? deflateRawSync(data) : data;
  const n = Buffer.from(name);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(deflate ? 8 : 0, 8);
  local.writeUInt32LE(body.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(n.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(deflate ? 8 : 0, 10);
  central.writeUInt32LE(body.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(n.length, 28);
  central.writeUInt32LE(0, 42);
  const cdOffset = local.length + n.length + body.length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(central.length + n.length, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  return Buffer.concat([local, n, body, central, n, eocd]);
}

describe("reading a model", () => {
  it("reads into the derived family archimate-model/v1, which its own schema checks", () => {
    const model = parseArchimate(XML);
    expect(ARCHIMATE_MODEL_TAG).toBe("archimate-model/v1");
    expect(ArchimateModelSchema.safeParse(model).success).toBe(true);
    expect(ArchimateModelSchema.safeParse({ ...model, elements: [{ ...model.elements[0], layer: "Nowhere" }] }).success).toBe(false);
  });

  const m = parseArchimate(XML);

  it("reads elements with their layer, documentation, properties and folder", () => {
    expect(m.name).toBe("Tiny <RA>");
    const a = m.elements.find((e) => e.id === "id-a")!;
    expect(a).toMatchObject({ type: "ApplicationComponent", layer: "Application", documentation: "Holds the records.", folder: ["Application"] });
    expect(a.properties).toEqual([{ key: "owner", value: "WHO" }]);
  });

  it("reads relationships, defaulting nothing it was told", () => {
    // A serving relationship carries nothing it was not told: no name, access type or direction.
    expect(m.relationships.find((r) => r.id === "id-r1")).toEqual({ id: "id-r1", type: "Serving", source: "id-b", target: "id-a", properties: [] });
    // Told "1", the access is read, not Archi's default of write.
    expect(m.relationships.find((r) => r.id === "id-r2")).toMatchObject({ type: "Access", accessType: "read" });
    const accessOf = (attr: string) => parseArchimate(XML.replace(' accessType="1"', attr)).relationships.find((r) => r.id === "id-r2")!.accessType;
    expect([accessOf(' accessType="0"'), accessOf(' accessType="2"'), accessOf(' accessType="3"')]).toEqual(["write", "access", "readwrite"]);
    // Told nothing, it takes Archi's own default, write.
    expect(accessOf("")).toBe("write");
  });

  it("makes a nested object's bounds absolute, and gives -1 Archi's default size", () => {
    const v = m.views[0]!;
    expect(v.viewpoint).toBe("application_cooperation");
    expect(v.nodes.find((n) => n.id === "id-da")).toMatchObject({ x: 120, y: 90, w: 120, h: 55, parent: "id-g" });
    expect(v.nodes.find((n) => n.id === "id-n")).toMatchObject({ kind: "note", text: "A note & its text" });
    expect(v.connections.map((c) => c.id).sort()).toEqual(["id-c1", "id-c2"]);
  });

  it("reads Archi's zipped archive, stored or deflated", () => {
    for (const deflate of [false, true]) {
      const zip = zipOf("model.xml", Buffer.from(XML), deflate);
      expect(zipEntry(zip, "model.xml")!.toString()).toBe(XML);
      expect(modelXmlOf(zip)).toBe(XML);
      expect(readArchimate(zip).elements.length).toBe(3);
    }
  });

  it("refuses an id that is not filename-safe rather than rewriting it", () => {
    expect(() => parseArchimate(XML.replace('id="id-b"', 'id="id b"'))).toThrow(/not filename-safe/);
  });

  it("puts each element type in its ArchiMate layer", () => {
    expect([layerOf("BusinessActor"), layerOf("Node"), layerOf("Goal"), layerOf("Capability"), layerOf("WorkPackage"), layerOf("Grouping")]).toEqual([
      "Business", "Technology", "Motivation", "Strategy", "Implementation & Migration", "Other",
    ]);
  });
});

describe("drawing a view", () => {
  const m = parseArchimate(XML);
  const svg = renderViewSvg(m, m.views[0]!, { elementHref: (id) => `../element/${id}/` });

  it("escapes every string from the model", () => {
    expect(svg).toContain("Registry &lt;script&gt;");
    expect(svg).not.toContain("<script>");
    // Markup in the model's, view's, group's, elements' and note's text is drawn as text, never as markup.
    const marked = parseArchimate(
      XML.replace('name="Lookup"', 'name="Lookup &lt;i&gt;"')
        .replace('name="Record"', 'name="Record &lt;s&gt;"')
        .replace('name="Platform"', 'name="Platform &lt;u&gt;"')
        .replace('name="Overview"', 'name="Overview &lt;v&gt;"')
        .replace("A note &amp; its text", "A note &lt;em&gt;"),
    );
    const out = renderViewSvg(marked, marked.views[0]!);
    for (const tag of ["RA", "script", "i", "s", "u", "v", "em"]) {
      expect(out).not.toContain(`<${tag}>`);
      expect(out).toContain(`&lt;${tag}&gt;`);
    }
  });

  it("links each box to its element, and draws each relationship with its own ends", () => {
    expect(svg).toContain('href="../element/id-a/" target="_top"');
    expect(svg).toContain('marker-end="url(#arrow-open)"');
    // A read access draws its arrow at the source end.
    expect(svg).toContain('marker-start="url(#arrow-small)"');
  });

  it("draws a box whose element is missing as missing, not as nothing", () => {
    const broken = parseArchimate(XML.replace('archimateElement="id-c"', 'archimateElement="id-gone"'));
    expect(renderViewSvg(broken, broken.views[0]!)).toContain("(element missing from the model)");
  });

  it("does not draw a nesting relationship between a box and the box it sits in", () => {
    // id-da sits in group id-g; give the model an element-box parent instead.
    const nested = parseArchimate(
      XML.replace('<folder name="Relations" id="id-f2" type="relations">', '<folder name="Relations" id="id-f2" type="relations">\n    <element xsi:type="archimate:RealizationRelationship" id="id-r3" source="id-c" target="id-b"/>\n    <element xsi:type="archimate:ServingRelationship" id="id-r4" source="id-c" target="id-b"/>')
        .replace(
          '<bounds x="120" y="300" width="120" height="55"/>',
          '<bounds x="120" y="300" width="300" height="200"/>\n        <child xsi:type="archimate:DiagramObject" id="id-dc2" archimateElement="id-c"><bounds x="20" y="40" width="120" height="55"/>' +
            '<sourceConnection xsi:type="archimate:Connection" id="id-c3" source="id-dc2" target="id-db" archimateRelationship="id-r3"/>' +
            '<sourceConnection xsi:type="archimate:Connection" id="id-c4" source="id-dc2" target="id-db" archimateRelationship="id-r4"/></child>',
        ),
    );
    const out = renderViewSvg(nested, nested.views[0]!);
    expect(out).not.toContain("<title>Realization</title>");
    // Only the model's own serving line, between boxes that do not nest.
    expect(out.split("<title>Serving</title>").length).toBe(2);
    // A line between boxes that do not nest is still drawn.
    expect(out).toContain("<title>Access</title>");
  });

  it("draws a line straight when a box moved after its bendpoints were set, and two lines between one pair side by side", () => {
    // id-c2's bendpoint: source centre + (0,80) and target centre + (-100,0) are far apart.
    const twisted = parseArchimate(
      XML.replace(
        '<sourceConnection xsi:type="archimate:Connection" id="id-c1" source="id-db" target="id-da" archimateRelationship="id-r1"/>',
        '<sourceConnection xsi:type="archimate:Connection" id="id-c1" source="id-db" target="id-da" archimateRelationship="id-r1"/>' +
          '<sourceConnection xsi:type="archimate:Connection" id="id-c1b" source="id-db" target="id-da" archimateRelationship="id-r1"/>',
      ),
    );
    const out = renderViewSvg(twisted, twisted.views[0]!);
    // Each line's wide transparent twin carries the same path.
    const paths = [...out.matchAll(/<path d="(M[^"]+)" fill="none" stroke="transparent"/g)].map((m) => m[1]!);
    // Every line is a single segment: the stale bendpoint is dropped.
    for (const d of paths) expect(d).toMatch(/^M[\d.-]+ [\d.-]+ L[\d.-]+ [\d.-]+$/);
    // The two serving lines are distinct.
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("draws a key listing only the colours, shapes and lines the view uses, in plain words", () => {
    const key = svg.slice(svg.indexOf('<g class="av-legend">'));
    expect(key).toContain(">Key</text>");
    expect(key).toContain("Software: systems");
    expect(key).toContain("Serving: serves");
    expect(key).toContain("Access: reads or writes data");
    expect(key).toContain("a grouping for layout only");
    expect(key).toContain("Note: a comment");
    // Nothing the view does not draw.
    expect(key).not.toContain("Influence");
    expect(key).not.toContain("Why: who cares");
    // The drawing grows to hold it, and it can be left off.
    const bare = renderViewSvg(m, m.views[0]!, { legend: false });
    expect(bare).not.toContain("av-legend");
    const heightOf = (s: string) => Number(/<svg [^>]*\bheight="([0-9.]+)"/.exec(s)![1]);
    const boxOf = (s: string) => /<svg [^>]*viewBox="([^"]+)"/.exec(s)![1]!.split(" ").map(Number);
    expect(heightOf(svg)).toBeGreaterThan(heightOf(bare));
    expect(boxOf(svg)[3]!).toBeGreaterThan(boxOf(bare)[3]!);
  });

  it("says a view with nothing on it is empty, rather than drawing an empty frame", () => {
    const empty = parseArchimate(XML.replace(/<element xsi:type="archimate:ArchimateDiagramModel"[\s\S]*?<\/element>/, '<element xsi:type="archimate:ArchimateDiagramModel" name="Default View" id="id-v0"/>'));
    expect(renderViewSvg(empty, empty.views[0]!)).toContain("This view is empty");
  });

  it("decodes the line breaks Archi writes as character references", () => {
    const m2 = parseArchimate(XML.replace("A note &amp; its text", "Who owns it?&#xD;&#xA;Next"));
    expect(m2.views[0]!.nodes.find((n) => n.kind === "note")!.text).toBe("Who owns it?\r\nNext");
    expect(renderViewSvg(m2, m2.views[0]!)).not.toContain("#xD");
  });

  it("wraps a long name to the box and marks what it cut", () => {
    expect(wrap("Central Health Workforce Registry and Exchange Services", 160, 2)).toEqual(["Central Health Workforce", "Registry and Exchange…"]);
  });
});

describe("an instance", () => {
  const declaration = {
    name: "tiny",
    iriBase: "https://example.org/tiny/",
    directories: [{ id: "archimate", path: "archimate/", graphTypologies: ["archimate"] }],
    visualisers: [{ id: "archimate", renderedBy: "archimate-pages", covers: ["archimate"] }],
  };
  const make = (config: object, extra?: (dir: string) => void, decl: object = declaration) => {
    const root = mkdtempSync(join(tmpdir(), "archimate-"));
    writeFileSync(join(root, "tiny.json"), JSON.stringify(decl));
    mkdirSync(join(root, "archimate", "1.0.0"), { recursive: true });
    writeFileSync(join(root, "archimate", "1.0.0", "model.archimate"), XML);
    writeFileSync(join(root, "archimate", "cat-archimate.config.json"), JSON.stringify(config));
    extra?.(join(root, "archimate"));
    return root;
  };
  const config = { $schema: "cat-archimate-config/v1", directory: "archimate", models: [{ id: "1.0.0", file: "1.0.0/model.archimate" }] };

  it("refuses a model id declared twice", () => {
    expect(ArchimateConfigSchema.safeParse({ ...config, models: [config.models[0], config.models[0]] }).success).toBe(false);
  });

  it("is consistent when every model is configured, parses and resolves", () => {
    const root = make(config);
    try {
      expect(checkCommitted(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("links a document figure to the view it shows, and fails when either is gone", () => {
    const figure = { block: "folio/f-1.md", label: "Figure 1", model: "1.0.0", view: "id-v1", basis: "same-elements" };
    const withBlock = (root: string) => {
      mkdirSync(join(root, "folio"), { recursive: true });
      writeFileSync(join(root, "folio", "f-1.md"), "![Figure](media/image1.png)\n");
    };
    expect(ArchimateConfigSchema.safeParse({ ...config, figures: [{ ...figure, model: "9.9.9" }] }).success).toBe(false);
    const root = make({ ...config, figures: [figure, { ...figure, block: "folio/f-2.md", label: "Figure 2", view: "id-gone" }] });
    try {
      withBlock(root);
      expect(checkCommitted(root)).toEqual([
        "1.0.0: Figure 2 (folio/f-2.md) is mapped to view id-gone, which the model does not hold",
        "Figure 2: block folio/f-2.md is not in the instance",
      ]);
      const files = pagesFor(root).files;
      const page = files.find((f) => f.path === "1.0.0/view/overview/index.html")!;
      expect(page.content).toContain("drawn in the document as Figure 1 (<code>folio/f-1.md</code>)");
      const node = JSON.parse(files.find((f) => f.path === "1.0.0/view/id-v1.jsonld")!.content);
      expect(node["schema:subjectOf"][0]).toEqual({ "schema:name": "Figure 1", "schema:url": "https://example.org/tiny/folio/f-1.md" });
      // What a document site needs to draw the figure live: the SVG and the page, site-relative.
      const site = pagesFor(root, { site: true });
      const [t] = figureTargets(root);
      expect(t).toMatchObject({ block: "folio/f-1.md", label: "Figure 1", view: "id-v1", viewName: "Overview" });
      expect(site.files.map((f) => sitePathOf(site, f))).toContain(t.svg);
      expect(site.files.map((f) => sitePathOf(site, f))).toContain(`${t.page}index.html`);
      expect(figureTargets(root)).toHaveLength(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("is swept from the checkout when it declares an archimate directory, and a layer that does not is left out", () => {
    const checkout = mkdtempSync(join(tmpdir(), "archimate-checkout-"));
    try {
      const tiny = join(checkout, "tiny");
      mkdirSync(join(tiny, "archimate", "1.0.0"), { recursive: true });
      writeFileSync(join(tiny, "tiny.json"), JSON.stringify(declaration));
      writeFileSync(join(tiny, "archimate", "1.0.0", "model.archimate"), XML);
      writeFileSync(join(tiny, "archimate", "cat-archimate.config.json"), JSON.stringify(config));
      mkdirSync(join(checkout, "plain"));
      writeFileSync(join(checkout, "plain", "plain.json"), JSON.stringify({ name: "plain", directories: [] }));
      expect(archimateInstances(checkout)).toEqual([tiny]);
      expect(checkCommitted(tiny)).toEqual([]);
      // A declaration that does not parse is swept, so its failure is reported, not skipped.
      mkdirSync(join(checkout, "broken"));
      writeFileSync(join(checkout, "broken", "broken.json"), "{ not json");
      expect(archimateInstances(checkout)).toEqual([join(checkout, "broken"), tiny]);
    } finally {
      rmSync(checkout, { recursive: true, force: true });
    }
  });

  it("says so when a model is held that the config does not name", () => {
    const root = make(config, (d) => writeFileSync(join(d, "stray.archimate"), XML));
    try {
      expect(checkCommitted(root).join("\n")).toMatch(/stray\.archimate: held, but/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("writes a page and an IRI for the model and every view, element and relationship", () => {
    const root = make(config);
    try {
      const { graphPath, files } = pagesFor(root);
      expect(graphPath).toBe("archimate");
      const pages = files.filter((f) => f.path.endsWith("/index.html"));
      // model, metamodel, one view, three elements, two relationships
      expect(pages.length).toBe(1 + 1 + 1 + 3 + 2);
      expect(files.some((f) => f.path === "1.0.0/view/id-v1.svg")).toBe(true);
      for (const f of files.filter((x) => x.path.endsWith(".jsonld"))) {
        expect(JSON.parse(f.content)["@id"]).toBe(`https://example.org/tiny/archimate/${f.path.replace(/\.jsonld$/, "")}`);
      }
      const el = JSON.parse(files.find((f) => f.path === "1.0.0/element/id-a.jsonld")!.content);
      expect(el["@type"]).toBe("archimate:ApplicationComponent");
      const rel = JSON.parse(files.find((f) => f.path === "1.0.0/relationship/id-r1.jsonld")!.content);
      expect(rel["archimate:source"]["@id"]).toBe("https://example.org/tiny/archimate/1.0.0/element/id-b");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("links a reused element back to the node it copies, and an own element to the copy it plays (issue #1949)", () => {
    const RA = "https://example.org/ra/archimate/0.3.0/element/id-b";
    const RAREL = "https://example.org/ra/archimate/0.3.0/relationship/id-r1";
    const reused = XML.replace(
      '<element xsi:type="archimate:ApplicationService" name="Lookup" id="id-b"/>',
      `<element xsi:type="archimate:ApplicationService" name="Lookup" id="id-b"><property key="overlay:base" value="${RA}"/></element>`,
    )
      .replace(
        '<element xsi:type="archimate:ServingRelationship" id="id-r1" source="id-b" target="id-a"/>',
        `<element xsi:type="archimate:ServingRelationship" id="id-r1" source="id-b" target="id-a"><property key="overlay:base" value="${RAREL}"/></element>` +
          '<element xsi:type="archimate:RealizationRelationship" id="id-r3" source="id-c" target="id-a"/>' +
          '<element xsi:type="archimate:RealizationRelationship" id="id-r4" source="id-a" target="id-b"/>',
      );
    const root = make(config, (d) => writeFileSync(join(d, "1.0.0", "model.archimate"), reused));
    try {
      const { files } = pagesFor(root);
      const json = (p: string) => JSON.parse(files.find((f) => f.path === p)!.content);
      const html = (p: string) => files.find((f) => f.path === p)!.content;
      // The copy names its source, as data and on its page.
      expect(json("1.0.0/element/id-b.jsonld")["dcterms:source"]).toEqual({ "@id": RA });
      expect(html("1.0.0/element/lookup/index.html")).toContain(`<p class="am-from">Reused from <a href="${RA}">ra 0.3.0</a></p>`);
      expect(json("1.0.0/relationship/id-r1.jsonld")["dcterms:source"]).toEqual({ "@id": RAREL });
      // An own element is no copy: no dcterms:source, but its page names the copy it plays, directly or through another.
      expect(json("1.0.0/element/id-a.jsonld")["dcterms:source"]).toBeUndefined();
      const a = files.find((f) => /^1\.0\.0\/element\/registry[^/]*\/index\.html$/.test(f.path))!.content;
      expect(a).toContain(`Plays <a href="${RA}">Lookup</a> in ra 0.3.0</p>`);
      expect(html("1.0.0/element/record/index.html")).toContain(`Plays <a href="${RA}">Lookup</a> in ra 0.3.0 (through Registry &lt;script&gt;)</p>`);
      // The DTH overlays' older form of the IRI is read as the node's IRI now.
      expect(baseIriOf([{ key: "overlay:base", value: "https://example.org/ra/archimate/0.2.0/relationships/id-r9.jsonld" }])).toBe("https://example.org/ra/archimate/0.2.0/relationship/id-r9");
      expect(baseIriOf([{ key: "overlay:base", value: "not an IRI" }])).toBeUndefined();
      // A node with nothing to name says nothing.
      expect(html("1.0.0/relationship/id-r2/index.html")).not.toContain("am-from");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("bundles the IG sites' Contents card with the renderer, and draws it over a page's sections (issue #1885)", () => {
    const root = make(config);
    try {
      const { files } = pagesFor(root);
      const js = files.find((f) => f.path === "assets/archimate.js")!.content;
      const css = files.find((f) => f.path === "assets/archimate.css")!.content;
      expect(js.indexOf("window.faContentsCard = card")).toBeGreaterThanOrEqual(0);
      expect(js.indexOf("window.faContentsCard = card")).toBeLessThan(js.indexOf("window.faContentsCard(host)"));
      expect(css).toContain(".igi-contents{");
      expect(css).toContain(".am-body>.igi-contents{float:right");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("serves a small page AT each node's IRI that declares the node and links its page, in the graph and in a site", () => {
    const root = make(config);
    try {
      const graph = pagesFor(root).files;
      const stub = graph.find((f) => f.path === "1.0.0/element/id-a.html")!;
      expect(pageNodeOf(stub.content)!.rdfa[0]).toEqual({ iri: "https://example.org/tiny/archimate/1.0.0/element/id-a", types: ["http://www.opengroup.org/xsd/archimate/3.0/ApplicationComponent"] });
      expect(pageNodeProblems(stub.content)).toEqual([]);
      expect(stub.content).toContain('<link rel="alternate" type="application/ld+json" href="id-a.jsonld">');
      expect(stub.content).not.toContain("<script src=");
      // One stub per node: the model, its view, three elements, two relationships.
      expect(graph.filter((f) => f.path.endsWith(".html") && !f.path.endsWith("index.html")).map((f) => f.path).sort()).toEqual([
        "1.0.0.html",
        "1.0.0/element/id-a.html",
        "1.0.0/element/id-b.html",
        "1.0.0/element/id-c.html",
        "1.0.0/relationship/id-r1.html",
        "1.0.0/relationship/id-r2.html",
        "1.0.0/view/id-v1.html",
      ]);
      // In a site the stub is at the IRI (the graph's path) and its link crosses to the page at the declared route.
      const site = pagesFor(root, { site: true });
      const at = (f: Written) => sitePathOf(site, f);
      const written = new Set(site.files.map(at));
      for (const f of site.files.filter((x) => x.path.endsWith(".html") && !x.path.endsWith("index.html"))) {
        expect(at(f).startsWith("archimate/")).toBe(true);
        const href = /<link rel="canonical" href="([^"]*)">/.exec(f.content)![1]!;
        const target = posix.join(posix.normalize(posix.join(posix.dirname(at(f)), href)), "index.html");
        expect({ stub: at(f), target, ok: written.has(target) }).toEqual({ stub: at(f), target, ok: true });
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("a page copies none of the model's documentation, properties or notes: it declares its node and points at the normalised model relative to itself", () => {
    const root = make(config);
    try {
      for (const p of pagesFor(root).files.filter((f) => f.path.endsWith("/index.html"))) {
        const cfg = pageDataOf(p.content) as Record<string, unknown>;
        const depth = p.path.split("/").length;
        // The metamodel page is drawn at build time: it points its renderer at nothing.
        expect(cfg.model).toBe(depth === 2 ? "./model.json" : depth === 3 ? undefined : "../../model.json");
        expect(pageNodeProblems(p.content)).toEqual([]);
        for (const text of ["Holds the records.", "owner", "WHO", "A note", "its text"]) expect({ page: p.path, text, copied: p.content.includes(text) }).toEqual({ page: p.path, text, copied: false });
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("declares the rail's left-hand section: the model's views, relative to each page", () => {
    const root = make(config);
    try {
      const files = pagesFor(root).files;
      const navOf = (path: string) => {
        const m = /<script type="application\/json" data-fa-visualiser-nav>(.*?)<\/script>/.exec(files.find((f) => f.path === path)!.content);
        return JSON.parse(m![1]!);
      };
      expect(navOf("1.0.0/index.html")[0].items).toEqual([
        { label: "Metamodel in use", href: "./metamodel/" },
        { label: "Overview", href: "./view/overview/" },
      ]);
      expect(navOf("1.0.0/view/overview/index.html")[0]).toMatchObject({ href: "../../", items: [{ href: "../../metamodel/" }, { href: "../../view/overview/" }] });
      expect(navOf("index.html")[0].items).toEqual([{ label: "Tiny <RA>", href: "1.0.0/" }]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("in a site, puts the pages at the declared route and leaves the data where its IRIs are (folio-assistant#2527)", () => {
    const root = make(config);
    try {
      const { graphPath, pageRoot, files } = pagesFor(root, { site: true });
      // `<locale>/<harness>/<visualiser>`: the route the layer declares for this Tool.
      expect(pageRoot).toBe("en/tiny/archimate");
      const at = (f: Written) => sitePathOf({ graphPath, pageRoot }, f);
      // Pages at the route, every other file at the graph's own path.
      for (const f of files) expect(at(f).startsWith(f.page ? "en/tiny/archimate/" : "archimate/")).toBe(true);
      expect(files.filter((f) => f.page).map(at).sort()).toEqual(
        pagesFor(root).files.filter((f) => f.path.endsWith("index.html")).map((f) => `en/tiny/archimate/${f.path}`).sort(),
      );
      // Every page names the Tool that drew it, so the routes gate can hold it to the route.
      for (const f of files.filter((x) => x.page)) expect({ page: f.path, by: renderedByOf(f.content) }).toEqual({ page: f.path, by: "archimate-pages" });
      // Every link a page or a drawing makes reaches a file the run writes, or a page's directory.
      const written = new Set(files.map(at));
      const resolves = (from: string, ref: string) => {
        const target = posix.normalize(posix.join(posix.dirname(from), ref));
        return written.has(target) || written.has(posix.join(target, "index.html"));
      };
      for (const f of files.filter((x) => x.page || x.path.endsWith(".svg"))) {
        const refs = [...f.content.matchAll(/(?:href|src|data)="([^"#:]+)"/g)].map((m) => m[1]!);
        const cfg = f.page && f.path !== "index.html" ? pageDataOf(f.content) as Record<string, unknown> : {};
        for (const k of ["node", "model", "svg"]) if (typeof cfg[k] === "string") refs.push(cfg[k] as string);
        for (const r of refs) expect({ from: at(f), ref: r, ok: resolves(at(f), r) }).toEqual({ from: at(f), ref: r, ok: true });
      }
      // The page reaches the model in the data tree, not beside itself.
      const view = files.find((f) => f.path === "1.0.0/view/overview/index.html")!;
      expect(pageDataOf(view.content).model).toBe("../../../../../../archimate/1.0.0/model.json");
      // In the graph (no site), nothing changes: pages beside their data, and no route to name.
      const inGraph = pagesFor(root);
      expect(inGraph.pageRoot).toBe("archimate");
      expect(inGraph.files.find((f) => f.path === "1.0.0/view/id-v1.svg")!.content).toContain('href="../element/registry-script/"');
      expect(inGraph.files.filter((f) => f.page).map((f) => renderedByOf(f.content)).filter(Boolean)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("in a site, refuses an instance that declares no route for these pages", () => {
    const { visualisers: _v, ...undeclared } = declaration;
    const root = make(config, undefined, undeclared);
    try {
      expect(() => pagesFor(root, { site: true })).toThrow(/declares no visualiser\(s\) rendered by `archimate-pages`/);
      // The graph needs no route: its pages sit beside their data.
      expect(pagesFor(root).pageRoot).toBe("archimate");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("in a site, picks the visualiser that covers the directory when several draw these pages", () => {
    const several = {
      ...declaration,
      visualisers: [
        { id: "elsewhere", renderedBy: "archimate-pages", covers: ["other"] },
        { id: "models", renderedBy: "archimate-pages", covers: ["archimate"] },
      ],
    };
    const root = make(config, undefined, several);
    try {
      expect(pagesFor(root, { site: true }).pageRoot).toBe("en/tiny/models");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuses to write pages into a graph that is not served", () => {
    const root = make(config);
    try {
      expect(() => pagesFor(root, { requireServed: true })).toThrow(/served: true/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
