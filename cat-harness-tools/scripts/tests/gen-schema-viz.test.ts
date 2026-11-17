/**
 * Tests for the schemas visualiser HTML generator (scripts/gen-schema-viz.ts).
 *
 * Verifies the 5 wireframe findings addressed for bean `folio-assistant-nnpk`:
 * 1. On phone, selecting a declaration smooth-scrolls and focuses into #detail.
 * 2. Responsive CSS rule on small viewports (max-width: 640px) constrains #items max-height to avoid scroll trapping.
 * 3. Diagram instruction points to the filter below and empty #ov-svg is hidden.
 * 4. Field table prevents mid-token wrapping on identifiers and code tokens.
 * 5. UML box uses wider truncation limits on desktop so field types are not cut short.
 *
 * @module scripts/tests/gen-schema-viz.test
 */
import { describe, expect, it } from "bun:test";
import { viewerHtml } from "../gen-schema-viz.ts";

describe("schemas visualiser wireframe fixes (folio-assistant-nnpk)", () => {
  const html = viewerHtml("assets/schemas/index.json", "cat-harness", [], "../../");

  it("Finding 1: smooth-scrolls and focuses into #detail when selecting on small viewports", () => {
    // #detail has tabindex="-1" so it can receive programmatic focus
    expect(html).toContain('<section id="detail" tabindex="-1"');
    // select function checks for small viewport or off-screen position and scrolls/focuses
    expect(html).toContain('dt.scrollIntoView({ behavior: "smooth", block: "start" })');
    expect(html).toContain("dt.focus()");
    expect(html).toContain("window.innerWidth <= 640");
  });

  it("Finding 2: sets compact #items max-height on small viewports to prevent nested scroll trapping", () => {
    // Scoped under `.sc-page` since aa499bc dropped the unscoped duplicates.
    expect(html).toMatch(/@media\s*\(max-width:\s*640px\)\s*\{\s*\.sc-page ul#items\s*\{\s*max-height:\s*35vh;\s*\}\s*\}/);
  });

  it("Finding 3: points to filter below and collapses empty #ov-svg", () => {
    // Instruction points to filter below
    expect(html).toContain("Pick a <b>module</b> in the filter below and the diagram for it appears here.");
    expect(html).not.toContain("Pick a <b>module</b> in the filter above");
    // Empty SVG is hidden to prevent default 150-200px empty height
    expect(html).toContain("#ov-svg:empty { display: none; }");
  });

  it("Finding 4: field table prevents mid-token identifier breakage", () => {
    // Table td code has word-break: normal and overflow-wrap: anywhere
    expect(html).toContain("td code { font-family: var(--fa-font-mono,Menlo,Consolas,monospace); font-size: .82rem; word-break: normal; overflow-wrap: anywhere; }");
    expect(html).toContain("#detail table td code { word-break: normal; overflow-wrap: anywhere; }");
    // Field name identifiers in first column stay on one line
    expect(html).toContain("#detail table td:first-child code { white-space: nowrap; }");
  });

  it("Finding 5: UML box truncation is stated, through the one shared renderer", () => {
    // The selected type is drawn by classDiagram (scripts/class-diagram.ts),
    // inlined here and run at build time for skill and Tool pages (bean cat-tools-4xq6).
    expect(html).toContain("function classDiagram(model)");
    expect(html).toContain("return classDiagram({ classes: classes, edges: edges, label:".replace("return ", ""));
    // A box shows at most MAXR rows and says how many it left out.
    expect(html).toContain('"\\u2026 " + more + " more"');
    // A clipped name or type ends in an ellipsis rather than being cut silently.
    expect(html).toContain('s.slice(0, n - 1) + "\\u2026"');
  });
});

describe("source descriptors in a schemas directory (folio-assistant-1nu0)", async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { sourceDescriptorRows } = await import("../gen-schema-viz.ts");

  const valid = {
    $schema: "folio-source-descriptor/v1",
    id: "demo",
    title: "Demo corpus",
    system: "DSpace 7",
    nodeKind: "item",
    subsetStrategies: ["identifier"],
    subsetIsSelfContained: true,
    identifiers: [{ name: "Handle", authoritative: true, example: "1/2" }],
    enumeration: { method: "page the REST API", pageSize: 10, totalNodes: 95, basis: "measured" },
    character: { remote: true, large: false, volatility: "versioned", availability: "unknown", hasOwnSearch: false, basis: "read" },
  };

  const repo = mkdtempSync(join(tmpdir(), "srcdesc-"));
  mkdirSync(join(repo, "inst", "sources"), { recursive: true });
  writeFileSync(join(repo, "inst", "sources", "demo.json"), JSON.stringify(valid));
  writeFileSync(join(repo, "inst", "sources", "broken.json"), JSON.stringify({ $schema: "folio-source-descriptor/v1", id: "broken", title: "Broken" }));
  // Neither of these is a source descriptor, and neither may become a row.
  writeFileSync(join(repo, "inst", "sources", "schemas.json"), JSON.stringify({ $schema: "concern-groups/v1", groups: [] }));
  writeFileSync(join(repo, "inst", "sources", "x.schema.json"), JSON.stringify({ $schema: "https://json-schema.org/draft/2020-12/schema" }));
  const rows = sourceDescriptorRows(["inst/sources"], repo);
  rmSync(repo, { recursive: true });

  it("reads only folio-source-descriptor/v1 files, attributed to the instance holding them", () => {
    expect(rows.map((r) => r.id)).toEqual(["broken", "demo"]);
    expect(rows.every((r) => r.instance === "inst")).toBe(true);
  });

  it("carries what the descriptor says about enumerating it, with the request cost derived", () => {
    const d = rows.find((r) => r.id === "demo")!;
    expect(d.title).toBe("Demo corpus");
    expect(d.system).toBe("DSpace 7");
    expect(d.file).toBe("inst/sources/demo.json");
    expect(d.enumeration).toEqual({ method: "page the REST API", pageSize: 10, totalNodes: 95, requests: 10 });
    expect(d.identifiers).toEqual([{ name: "Handle", authoritative: true, example: "1/2" }]);
    expect(d.note).toBeUndefined();
  });

  it("lists a descriptor that fails its schema, and says why, rather than dropping it", () => {
    const b = rows.find((r) => r.id === "broken")!;
    expect(b.title).toBe("Broken");
    expect(b.note).toContain("does not satisfy folio-source-descriptor/v1");
  });

  it("the page carries a source-descriptor table, hidden until a scope holds one", () => {
    const html = viewerHtml("assets/schemas/index.json", "who-iris", [], "../../");
    expect(html).toContain('<details id="sources" open hidden>');
    expect(html).toContain("function renderSources()");
  });
});
