import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { requireHarnessRoot } from "../../../cat-harness-tools/schemas/harness-root.ts";
import { CAT_HARNESS_NS as KG_CAT_HARNESS_NS } from "../schemas/l1-library.ts";
import type { DublinCoreRecord } from "../../platform/index.js";
import { decideL1, LAYER_SCHEME, type IntakeRecord } from "./l1-membership.ts";
import { CAT_HARNESS_NS, identifiersOf, l1LibraryDocument, printedNumber, type Held, type Input } from "./l1-specialise.ts";

const dir = mkdtempSync(join(tmpdir(), "l1-specialise-"));
writeFileSync(join(dir, "intake.json"), "{}");
writeFileSync(join(dir, "rec.json"), "{}");

const record = {
  $schema: "folio-dublin-core/v1",
  id: "x",
  fields: [
    { schema: "dc", element: "title", values: [{ value: "Leave no one behind: guidance for planning and implementing catch-up vaccination" }] },
    { schema: "dc", element: "identifier", qualifier: "isbn", values: [{ value: "9789240016514 (electronic version)" }, { value: "9789240016521 (print version)" }] },
    { schema: "dc", element: "identifier", qualifier: "uri", values: [{ value: "https://iris.who.int/handle/10665/340749" }] },
  ],
  provenance: { source: "t", retrievedAt: "2026-10-07T00:00:00Z", method: "t" },
} as DublinCoreRecord;

const intake: IntakeRecord = {
  record: "rec.json",
  files: [],
  classifications: [{ scheme: LAYER_SCHEME, code: "l1", member: true, source: "declared", basis: "owner", by: "ritikarawlani", at: "2026-10-07" }],
};

const held: Held = { intake, intakePath: "uploads/lnob/intake.json", record, recordPath: "uploads/lnob/rec.json", pdfSha256: "a".repeat(64), abs: { intake: join(dir, "intake.json"), record: join(dir, "rec.json") } };

const input = (): Input => ({
  entryPath: "library/lnob",
  structure: {
    toc_source: "inferred",
    toc: [{ level: 1, number: "1", title: "Principles", page: 11, confidence: 0.8, evidence: ["contents"] }],
    sections: [
      { id: "sec-front-matter", title: "Front matter", level: 1, page_start: 1, page_end: 10 },
      { id: "sec-000-1-principles", number: "1", title: "Principles", level: 1, page_start: 11, page_end: 20, label_start: "1", label_end: "10" },
      { id: "sec-001-11-policy", number: "1.1", title: "Policy", level: 2, page_start: 12, page_end: 14 },
      { id: "sec-002-1-designing", number: "1", title: "Designing schedules", level: 1, page_start: 21, page_end: 22 },
    ],
    figures: [{ kind: "table", number: "A1.1", title: "Catch-up schedule", page: 21, confidence: 0.8, evidence: ["referenced"], page_label: "11" }],
    source: { file: "lnob.pdf", sha256: "a".repeat(64) },
  },
  structureSha256: "b".repeat(64),
  manifest: {
    "@context": ["https://x/ctx.jsonld", { "@base": "https://litlfred.github.io/folio/" }],
    "@id": "library/lnob/manifest",
    contains: ["library/lnob/sections/sec-front-matter", "library/lnob/sections/sec-000", "library/lnob/sections/sec-001", "library/lnob/sections/sec-002"],
  },
  manifestSha256: "c".repeat(64),
  frontMatter: "Section 1. Principles ........ 1\nAnnex 1. Designing schedules ..... 11\n",
  held,
  decision: decideL1(intake, record),
  generatedAt: "2026-10-07T00:00:00Z",
});

describe("l1LibraryDocument", () => {
  const { doc, report } = l1LibraryDocument(input());
  const byType = (t: string) => doc.nodes.filter((n) => n.type === t);

  test("publicationIriFromElectronicIsbn", () => {
    expect(identifiersOf(record)[0]).toEqual({ type: "isbn", value: "9789240016514" });
    const [p] = byType("publication");
    expect(p!.id).toBe("https://smart.who.int/kg/l1/publication/isbn-9789240016514");
    expect(p!.derivation).toBe("decided");
    expect(p!.evidence).toMatchObject({ by: "ritikarawlani", at: "2026-10-07" });
  });

  test("layoutNodesSpecialiseLibraryIris", () => {
    const spec = doc.edges.filter((e) => e.predicate === "specializationOf");
    expect(spec).toHaveLength(1 + 3 + 1);
    for (const e of spec) {
      expect(e.target.startsWith("https://litlfred.github.io/folio/library/lnob/")).toBe(true);
      expect(doc.nodes.find((n) => n.id === e.target)?.type).toBe("library-node");
    }
    // No edge has a library node as its source.
    const lib = new Set(byType("library-node").map((n) => n.id));
    expect(doc.edges.some((e) => lib.has(e.source))).toBe(false);
  });

  test("recoversPrintedNumbers", () => {
    expect(byType("publication-section").map((n) => n.id.split("/section/")[1])).toEqual(["Section-1", "1.1", "Annex-1"]);
    expect(printedNumber("3", "x", "Annex 3. y")).toBe("3");
  });

  test("sectionsNestElementInDeepestSection", () => {
    const contains = doc.edges.filter((e) => e.predicate === "contains").map((e) => [e.source.split("/").pop(), e.target.split("/").pop()]);
    expect(contains).toContainEqual(["Section-1", "1.1"]);
    expect(contains).toContainEqual(["Annex-1", "table-a1-1"]);
    expect(byType("publication-element")[0]!.properties).toMatchObject({ elementType: "table", label: "Table A1.1", pageRange: "11" });
  });

  test("frontMatterReportedNotEmitted", () => {
    expect(report.some((r) => r.includes("front matter"))).toBe(true);
    expect(byType("publication-section").some((n) => n.label.includes("Front matter"))).toBe(false);
  });

  test("catHarnessClassesUnderDeclaredRelease", () => {
    const decl = JSON.parse(readFileSync(join(requireHarnessRoot(), "cat-harness.json"), "utf-8")) as { iriBase: string; version: string };
    const expected = `${decl.iriBase}v${decl.version.split(".")[0]}/ns/`;
    expect(CAT_HARNESS_NS).toBe(expected);
    const classes = byType("library-node").map((n) => String(n.properties.libraryClass)).filter((c) => c.startsWith(decl.iriBase));
    expect(classes).toContain(`${expected}SourceDocument`);
    expect(classes.every((c) => c.startsWith(expected))).toBe(true);
    // The kg package builds without the mount, so it keeps a literal; this is its drift check.
    expect(KG_CAT_HARNESS_NS).toBe(expected);
  });
});
