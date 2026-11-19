/**
 * Unit and integration tests for redundant rendered content audit and dynamic load classifier.
 *
 * Implements bean folio-assistant-s32v:
 * "QA: agentic audit of large redundant rendered content that can load from the KG"
 *
 * Covers:
 * 1. Detection of repeated markup blocks across HTML fixtures (> threshold).
 * 2. Detection of KG-identical content embedded in HTML.
 * 3. Classification logic against visualizer skill (move vs keep_serverside vs unsure).
 * 4. Vacuity guard: returns 'unknown' when 0 HTML files are examined.
 * 5. Sidecar output validation against KgQaReportSchema.
 *
 * @module scripts/tests/redundant-rendered-content-audit.test
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { auditRenderedBloat, classifyCandidate, extractHtmlBlocks, CRITERION_ID } from "../audit-rendered-bloat.js";
import { KgQaReportSchema, KG_CRITERIA_BY_ID } from "../../schemas/sdlc/kg-qa.js";

describe("redundant-rendered-content-audit registration", () => {
  test("criterion is registered in KG_CRITERIA_BY_ID with expected properties", () => {
    const criterion = KG_CRITERIA_BY_ID[CRITERION_ID];
    expect(criterion).toBeDefined();
    expect(criterion.id).toBe(CRITERION_ID);
    expect(criterion.applies).toContain("graph");
    expect(criterion.scope).toBe("repo");
    expect(criterion.severity).toBe("minor");
    expect(criterion.scopeBasis).toBeDefined();
    expect(criterion.scopeBasis!.length).toBeGreaterThan(80);
    expect(/repoRootFor|repository root|repository-level|MEASURED/.test(criterion.scopeBasis!)).toBe(true);
  });
});

describe("extractHtmlBlocks", () => {
  test("extracts blocks meeting the byte threshold with selectors", () => {
    const tableRows = "<tr><td>Item</td><td>Value</td></tr>".repeat(25);
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Test Page</title></head>
        <body>
          <nav class="site-nav" id="main-nav">
            <a href="/">Home</a>
          </nav>
          <div class="content-container">
            <table class="data-table artifact-grid" id="metrics-table">
              <thead><tr><th>Item</th><th>Value</th></tr></thead>
              <tbody>${tableRows}</tbody>
            </table>
          </div>
        </body>
      </html>
    `;

    const blocks = extractHtmlBlocks(html, "test.html", { threshold: 200 });
    expect(blocks.length).toBeGreaterThan(0);

    const tableBlock = blocks.find((b) => b.tag === "table");
    expect(tableBlock).toBeDefined();
    expect(tableBlock!.selector).toContain("table");
    expect(tableBlock!.selector).toContain("data-table");
    expect(tableBlock!.byteLength).toBeGreaterThan(200);
    expect(tableBlock!.page).toBe("test.html");
  });

  test("extracts embedded ld+json scripts even below generic threshold", () => {
    const json = JSON.stringify({ "@context": "https://schema.org", "@type": "Dataset", name: "KG Data" });
    const html = `<html><head><script type="application/ld+json">${json}</script></head><body>Hello</body></html>`;

    const blocks = extractHtmlBlocks(html, "page.html", { threshold: 500 });
    const scriptBlock = blocks.find((b) => b.tag === "script");
    expect(scriptBlock).toBeDefined();
    expect(scriptBlock!.rawHtml).toContain("application/ld+json");
  });
});

describe("classification logic (move vs keep_serverside vs unsure)", () => {
  test("classifies navigation, header, footer, and search as keep_serverside", () => {
    const navResult = classifyCandidate({
      tag: "nav",
      selector: "nav.site-navbar",
      byteLength: 800,
      occurrences: 5,
    });
    expect(navResult.action).toBe("keep_serverside");
    expect(navResult.reason).toContain("Navigation");

    const headerResult = classifyCandidate({
      tag: "header",
      selector: "header.site-header",
      byteLength: 600,
      occurrences: 4,
    });
    expect(headerResult.action).toBe("keep_serverside");

    const breadcrumbResult = classifyCandidate({
      tag: "div",
      selector: "div.breadcrumb-trail",
      byteLength: 550,
      occurrences: 3,
    });
    expect(breadcrumbResult.action).toBe("keep_serverside");

    const formResult = classifyCandidate({
      tag: "form",
      selector: "form.search-form",
      byteLength: 700,
      occurrences: 2,
    });
    expect(formResult.action).toBe("keep_serverside");
  });

  test("classifies headings, document identity, and noscript as keep_serverside", () => {
    const headingResult = classifyCandidate({
      tag: "div",
      selector: "div.page-title",
      byteLength: 600,
      occurrences: 1,
    });
    expect(headingResult.action).toBe("keep_serverside");

    const noscriptResult = classifyCandidate({
      tag: "noscript",
      selector: "noscript",
      byteLength: 800,
      occurrences: 3,
    });
    expect(noscriptResult.action).toBe("keep_serverside");
    expect(noscriptResult.reason).toContain("No-JS fallback");
  });

  test("classifies heavy data tables and repeated card lists as move", () => {
    const tableResult = classifyCandidate({
      tag: "table",
      selector: "table.data-table.artifact-grid",
      byteLength: 1200,
      occurrences: 3,
    });
    expect(tableResult.action).toBe("move");
    expect(tableResult.reason).toContain("tabular data");

    const cardListResult = classifyCandidate({
      tag: "div",
      selector: "div.card-list",
      byteLength: 950,
      occurrences: 2,
    });
    expect(cardListResult.action).toBe("move");
    expect(cardListResult.reason).toContain("Repeated component list");
  });

  test("classifies embedded raw JSON / code blocks and KG-matched blocks as move", () => {
    const jsonDumpResult = classifyCandidate({
      tag: "pre",
      selector: "pre.json-dump",
      byteLength: 1500,
      occurrences: 1,
    });
    expect(jsonDumpResult.action).toBe("move");
    expect(jsonDumpResult.reason).toContain("Raw data dump");

    const kgMatchedResult = classifyCandidate({
      tag: "div",
      selector: "div.artifact-viewer",
      byteLength: 800,
      occurrences: 1,
      kgFile: "schemas/artifact.json",
    });
    expect(kgMatchedResult.action).toBe("move");
    expect(kgMatchedResult.reason).toContain("schemas/artifact.json");
  });

  test("classifies ambiguous generic containers without clear markers as unsure", () => {
    const unsureResult = classifyCandidate({
      tag: "div",
      selector: "div.generic-container",
      byteLength: 600,
      occurrences: 1,
    });
    expect(unsureResult.action).toBe("unsure");
    expect(unsureResult.reason).toContain("requires agentic/author review");
  });
});

describe("auditRenderedBloat end-to-end with fixtures", () => {
  let tempDir: string;
  let siteDir: string;
  let kgDir: string;
  let sidecarFile: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `rendered-bloat-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    siteDir = join(tempDir, "_site");
    kgDir = join(tempDir, "kg");
    sidecarFile = join(tempDir, "results", "rendered-content-bloat.kg-qa.json");

    mkdirSync(siteDir, { recursive: true });
    mkdirSync(kgDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("vacuity guard: returns 'unknown' when 0 HTML files exist", () => {
    const emptySiteDir = join(tempDir, "empty-site");
    mkdirSync(emptySiteDir, { recursive: true });

    const result = auditRenderedBloat({
      siteDir: emptySiteDir,
      sidecarPath: sidecarFile,
      writeSidecar: true,
      repoRoot: tempDir,
    });

    expect(result.stats.totalPages).toBe(0);
    expect(result.report.criteria[CRITERION_ID].result).toBe("unknown");
    expect(result.report.totals.unknown).toBe(1);
    expect(result.report.totals.pass).toBe(0);
    expect(result.report.criteria[CRITERION_ID].findings[0].detail).toContain("vacuity guard");

    // Sidecar file was written and validates
    expect(existsSync(sidecarFile)).toBe(true);
    const sidecarContent = JSON.parse(readFileSync(sidecarFile, "utf-8"));
    expect(() => KgQaReportSchema.parse(sidecarContent)).not.toThrow();
  });

  test("detects repeated markup blocks across multiple HTML pages (> threshold)", () => {
    // Repeated table > 500 bytes
    const repeatedRows = "<tr><td>Property A</td><td>Value 1234567890</td></tr>".repeat(15);
    const repeatedTable = `<table class="data-table repeated-matrix"><tbody>${repeatedRows}</tbody></table>`;
    expect(Buffer.byteLength(repeatedTable, "utf-8")).toBeGreaterThan(500);

    const page1Html = `
      <!DOCTYPE html>
      <html>
        <head><title>Page One</title></head>
        <body>
          <h1>Page One</h1>
          ${repeatedTable}
        </body>
      </html>
    `;

    const page2Html = `
      <!DOCTYPE html>
      <html>
        <head><title>Page Two</title></head>
        <body>
          <h1>Page Two</h1>
          ${repeatedTable}
        </body>
      </html>
    `;

    writeFileSync(join(siteDir, "page1.html"), page1Html, "utf-8");
    writeFileSync(join(siteDir, "page2.html"), page2Html, "utf-8");

    const result = auditRenderedBloat({
      siteDir,
      kgRoots: [kgDir],
      threshold: 400,
      minOccurrences: 2,
      sidecarPath: sidecarFile,
      writeSidecar: true,
      repoRoot: tempDir,
    });

    expect(result.stats.totalPages).toBe(2);
    expect(result.stats.totalBytes).toBeGreaterThan(1000);
    expect(result.stats.candidateCount).toBeGreaterThan(0);

    const moveCandidate = result.stats.candidates.find((c) => c.action === "move");
    expect(moveCandidate).toBeDefined();
    expect(moveCandidate!.occurrences).toBe(2);
    expect(moveCandidate!.pages).toContain("page1.html");
    expect(moveCandidate!.pages).toContain("page2.html");

    expect(result.report.criteria[CRITERION_ID].result).toBe("fail");
    expect(result.report.criteria[CRITERION_ID].findings.length).toBeGreaterThan(0);
    expect(result.report.criteria[CRITERION_ID].findings[0].where).toContain("page1.html");

    // Check sidecar file validity
    expect(existsSync(sidecarFile)).toBe(true);
    const parsedSidecar = JSON.parse(readFileSync(sidecarFile, "utf-8"));
    expect(() => KgQaReportSchema.parse(parsedSidecar)).not.toThrow();
  });

  test("detects KG-identical content embedded in HTML", () => {
    // Committed KG JSON file
    const sampleKgData = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      id: "schemas/sample-spec.json",
      title: "Sample Specification",
      description: "Committed KG node describing system architecture and parameters",
      properties: {
        timeout: { type: "integer", default: 3000 },
        retries: { type: "integer", default: 5 },
        endpoints: ["https://api.example.org/v1", "https://api.example.org/v2"],
      },
    };

    const kgFilePath = join(kgDir, "sample-spec.json");
    const kgJsonString = JSON.stringify(sampleKgData, null, 2);
    writeFileSync(kgFilePath, kgJsonString, "utf-8");

    // HTML embedding the KG JSON
    const pageWithKgHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>Spec Viewer</title></head>
        <body>
          <h1>Spec Viewer</h1>
          <div class="kg-data-viewer" data-kg-source="kg/sample-spec.json">
            <pre class="json-code">${kgJsonString}</pre>
          </div>
        </body>
      </html>
    `;

    writeFileSync(join(siteDir, "spec.html"), pageWithKgHtml, "utf-8");

    const result = auditRenderedBloat({
      siteDir,
      kgRoots: [kgDir],
      threshold: 200,
      minOccurrences: 1, // test single-page KG match
      sidecarPath: sidecarFile,
      writeSidecar: true,
      repoRoot: tempDir,
    });

    expect(result.stats.totalPages).toBe(1);
    const kgCandidate = result.stats.candidates.find((c) => c.kgFile?.includes("sample-spec.json"));
    expect(kgCandidate).toBeDefined();
    expect(kgCandidate!.action).toBe("move");
    expect(kgCandidate!.reason).toContain("sample-spec.json");
  });

  test("sidecar output conforms to schemas/sdlc/kg-qa.ts when all candidates are keep_serverside (pass)", () => {
    // Page with navigation repeated across pages, but no heavy data tables
    const navBlock = `<nav class="site-navbar"><ul><li><a href="/">Home</a></li><li><a href="/about">About</a></li></ul></nav>`;
    const pageA = `<!DOCTYPE html><html><body>${navBlock}<h1>Hello A</h1></body></html>`;
    const pageB = `<!DOCTYPE html><html><body>${navBlock}<h1>Hello B</h1></body></html>`;

    writeFileSync(join(siteDir, "a.html"), pageA, "utf-8");
    writeFileSync(join(siteDir, "b.html"), pageB, "utf-8");

    const result = auditRenderedBloat({
      siteDir,
      kgRoots: [kgDir],
      threshold: 50,
      minOccurrences: 2,
      sidecarPath: sidecarFile,
      writeSidecar: true,
      repoRoot: tempDir,
    });

    expect(result.stats.totalPages).toBe(2);
    expect(result.stats.moveCount).toBe(0);
    expect(result.report.criteria[CRITERION_ID].result).toBe("pass");
    expect(result.report.criteria[CRITERION_ID].findings).toHaveLength(0);
    expect(result.report.totals.pass).toBe(1);

    expect(existsSync(sidecarFile)).toBe(true);
    const parsed = JSON.parse(readFileSync(sidecarFile, "utf-8"));
    const validated = KgQaReportSchema.parse(parsed);
    expect(validated.$schema).toBe("kg-qa/v1");
    expect(validated.subject.kind).toBe("graph");
    expect(validated.subject.id).toBe("rendered-content-bloat");
  });
});
