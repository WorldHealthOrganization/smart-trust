/**
 * The Term cells of a document's glossary table link the term's row on the
 * glossary-folder page (owner, 2026-11-16): the anchor `glossary-page.ts`
 * writes, relative to the document's page, and a term with no entry stays
 * plain text and is reported.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { renderDocumentHtml } from "./build-document-site.ts";
import { glossaryEntries, resolveGlossaryTerm } from "./glossary-term-links.ts";

// A small layer `hb` with one authored scheme of its own.
const repo = mkdtempSync(join(tmpdir(), "glossary-table-"));
writeFileSync(
  join(repo, "hb.json"),
  JSON.stringify({
    $schema: "cat-harness-declaration/1.0.0",
    name: "hb",
    title: "Handbook",
    version: "0.1.0",
    iriBase: "https://example.org/hb/",
    directories: [{ id: "glossary", path: "glossary/", graphTypologies: ["glossary"], description: "The glossary." }],
  }),
);
mkdirSync(join(repo, "glossary"));
writeFileSync(
  join(repo, "glossary", "hb.glossary.json"),
  JSON.stringify({
    $schema: "folio-glossary/v1",
    id: "hb",
    title: "Handbook glossary",
    terms: [
      { id: "algorithm", prefLabel: "Algorithm", definition: "A specification.", status: "candidate" },
      { id: "as-is", prefLabel: "As-Is", altLabel: ["As-is", "Current State"], status: "candidate" },
      { id: "beta-version", prefLabel: "Beta Version", status: "candidate" },
    ],
  }),
);
afterAll(() => rmSync(repo, { recursive: true, force: true }));

const TABLE = [
  "| Term | Definition |",
  "| --- | --- |",
  "| Algorithm | A specification of how a computer shall solve a problem. |",
  "| As-is | The current state of things (also see to-be). |",
  "| Beta version | The initial version of the software. |",
  "| Hackathon | An event with no glossary entry. |",
].join("\n");

describe("glossary table term links", async () => {
  const entries = await glossaryEntries(repo, "en/hb");

  test("entriesAnchorOnTheFolderPage", () => {
    expect(entries.map((e) => e.href)).toEqual([
      "../folio-assistant-core/glossary/instance/hb/#hb--hb--algorithm",
      "../folio-assistant-core/glossary/instance/hb/#hb--hb--as-is",
      "../folio-assistant-core/glossary/instance/hb/#hb--hb--beta-version",
    ]);
  });

  test("termCellsLinkTheirEntry", async () => {
    const reports: string[] = [];
    const html = await renderDocumentHtml(TABLE, { math: false, glossaryEntries: entries, report: (m) => reports.push(m) });
    const base = "../folio-assistant-core/glossary/instance/hb/";
    expect(html).toContain(`<td><a href="${base}#hb--hb--algorithm" class="fa-term">Algorithm</a></td>`);
    // An altLabel, and a label equal but for case, find their entry.
    expect(html).toContain(`<td><a href="${base}#hb--hb--as-is" class="fa-term">As-is</a></td>`);
    expect(html).toContain(`<td><a href="${base}#hb--hb--beta-version" class="fa-term">Beta version</a></td>`);
    // No entry: plain text, reported, not a failure.
    expect(html).toContain("<td>Hackathon</td>");
    expect(reports).toEqual(['glossary table: "Hackathon" has no glossary entry; left as plain text']);
    // The Definition column is left alone.
    expect(html).toContain("<td>A specification of how a computer shall solve a problem.</td>");
  });

  test("onlyGlossaryTables", async () => {
    const other = "| Name | Value |\n| --- | --- |\n| Algorithm | 1 |";
    expect(await renderDocumentHtml(other, { math: false, glossaryEntries: entries })).not.toContain("<a ");
  });

  test("ambiguousStaysPlain", () => {
    const two = [
      { id: "chw", prefLabel: "Community health worker", altLabel: ["CHW"], href: "g/#chw" },
      { id: "hw", prefLabel: "Health worker", altLabel: ["CHW"], href: "g/#hw" },
    ];
    expect(resolveGlossaryTerm(two, "CHW")).toEqual({ ambiguous: ["chw", "hw"] });
    expect(resolveGlossaryTerm(two, "Health worker").entry?.id).toBe("hw");
  });

  test("noEntriesUnchanged", async () => {
    expect(await renderDocumentHtml(TABLE, { math: false })).toBe(await renderDocumentHtml(TABLE, { math: false, glossaryEntries: [] }));
  });
});
