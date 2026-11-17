/**
 * The Export page and the stable "latest" names, from a manifest alone (no
 * pandoc or LibreOffice needed): every exported file appears with its format,
 * filters, parameters, size, date and both links.
 */
import { expect, test } from "bun:test";

import { readFileSync } from "node:fs";
import { humanBytes, latestNames, REFERENCE_DOCX, renderExportIndex, type ExportManifest } from "./document-export.js";

const manifest: ExportManifest = {
  $schema: "document-export/v1",
  document: "dth-hrh", title: "Digital Transformation Handbook — <HRH>",
  commit: "0e155c3aaaaaaaaa", dirty: false, commitDate: "2026-11-04", date: "2026-11-04",
  blocks: 412, tools: { pandoc: "pandoc 3.6", soffice: "LibreOffice 24.8" },
  files: [
    {
      kind: "pdf", file: "dth-hrh-public-comment-0e155c3-2026-11-04.pdf", latest: "dth-hrh-public-comment-latest.pdf",
      format: "PDF", mediaType: "application/pdf", purpose: "The frozen draft.",
      filters: ["assembled", "pandoc", "LibreOffice"], parameters: { "line numbers": "on", "export kind": "release" },
      sha256: "ab".repeat(32), bytes: 3_565_158, pages: 88, lines: 4012,
    },
    {
      kind: "offline-docx", file: "dth-hrh-offline-0e155c3.docx", latest: "dth-hrh-offline-latest.docx",
      format: "Word (.docx)", mediaType: "x", purpose: "Editing copy.",
      filters: ["Track Changes switched on"], parameters: { "track changes": "on" },
      sha256: "cd".repeat(32), bytes: 812_000, bookmarks: 530,
    },
  ],
};

test("latestNamesStable", () => {
  expect(latestNames("dth-hrh")).toEqual({
    pdf: "dth-hrh-public-comment-latest.pdf",
    reviewDocx: "dth-hrh-public-comment-latest.docx",
    offlineDocx: "dth-hrh-offline-latest.docx",
    manifest: "dth-hrh-export-latest.json",
  });
});

test("humanSizes", () => {
  expect(humanBytes(900)).toBe("900 B");
  expect(humanBytes(812_000)).toBe("793 KB");
  expect(humanBytes(3_565_158)).toBe("3.4 MB");
});

test("exportPageListsFiles", () => {
  const html = renderExportIndex(manifest);
  for (const f of manifest.files) {
    expect(html).toContain(`href="${f.file}"`);
    expect(html).toContain(`href="${f.latest}"`);
    for (const x of f.filters) expect(html).toContain(x);
    for (const [k, v] of Object.entries(f.parameters)) expect(html).toContain(`<b>${k}</b>: ${v}`);
  }
  expect(html).toContain("3.4 MB");
  expect(html).toContain("88 pages");
  expect(html).toContain("530 bookmarks");
  expect(html).toContain("2026-11-04");
  expect(html).toContain("<code>0e155c3</code>");
  expect(html).toContain('href="dth-hrh-export-latest.json"');
  // the title is escaped, not injected
  expect(html).toContain("&lt;HRH&gt;");
  expect(html).not.toContain("<HRH>");
  // the content sits in its own padded <main>, so a site's rail and body styles leave it a gutter
  expect(html).toContain('<main class="export">');
  expect(html).toContain('<h2 id="details">');
});

test("wordTemplateShips", () => {
  const docx = readFileSync(REFERENCE_DOCX);
  expect(docx.subarray(0, 2).toString("latin1")).toBe("PK"); // a .docx is a zip
  expect(docx.toString("latin1")).toContain("word/theme/theme1.xml");
});
