/**
 * The L1 extractor reads, and never infers.
 *
 * Calibrated: dropping the qualifier line from the GRADE search makes the
 * strong/moderate case fail; reading strength from the whole section rather
 * than the block makes `ignoresGradePhraseOutsideBlock` fail;
 * comparing `generatedAt` in `isCurrent` makes `currentUpToGeneratedAtStaleOnEdit` fail.
 */
import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  findRecommendations,
  isCurrent,
  L1_DOCUMENT_FILENAME,
  l1Document,
  MAX_STATEMENT_LINES,
  readEntry,
  readIsbn,
  serialise,
  unpinnedClasses,
  type L1Document,
  type LibraryEntry,
} from "./extract-smart-kg-l1.ts";
import { kgClasses } from "../../scripts/kg-classes.ts";

const SCRIPT = join(import.meta.dir, "extract-smart-kg-l1.ts");
const AT = "2026-10-02T00:00:00Z";

const FRONT = "---\ndoc_id: test\n---\n";
const GRADED = [
  "Recommendation 3: WHO recommends offering the vaccine",
  "to every infant at birth.",
  "(strong recommendation, moderate-certainty evidence)",
  "Source: WHO, 2020 (4).",
].join("\n");
const UNGRADED = [
  "Recommendation 8: WHO recommends digital tracking",
  "under these conditions:",
  "•\tin settings where the system can support it.",
  "(Recommended only in specific contexts or conditions)",
].join("\n");

/** A PDF-variant entry on disk, sections as given. */
function writeEntry(sections: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "smart-kg-l1-"));
  mkdirSync(join(dir, "sections"));
  const ids = Object.keys(sections);
  writeFileSync(
    join(dir, "structure.json"),
    JSON.stringify({
      _schema: "pdf-structure/v1",
      doc_id: "test",
      source: { file: "test.pdf", sha256: "a".repeat(64), bytes: 1, mtime: null, mimetype_sniffed: "application/pdf", mimetype_source: "magic-bytes" },
      metadata: { title: "A test guideline", docinfo: {} },
      toc_source: "none",
      sections: ids.map((id, i) => ({ id, number: null, title: `Section ${i + 1}`, level: 1, page_start: i + 1, page_end: i + 1, n_chars: 1, n_words: 1 })),
    }),
  );
  for (const [id, body] of Object.entries(sections)) writeFileSync(join(dir, "sections", `${id}.md`), FRONT + body + "\n");
  return dir;
}

function entryOf(sections: Record<string, string>): LibraryEntry {
  const dir = writeEntry(sections);
  const e = readEntry(dir, dir);
  if ("reason" in e) throw new Error(e.reason);
  return e;
}

const recommendations = (doc: L1Document) => doc.nodes.flatMap((n) => (n.type === "recommendation" ? [n] : []));

describe("a recommendation is read, never inferred", () => {
  it("readsGradeFromLabelledBlock", () => {
    const [r] = recommendations(l1Document(entryOf({ "page-001": GRADED }), AT).doc);
    expect(r!.properties.statement).toBe("WHO recommends offering the vaccine to every infant at birth.");
    expect(r!.properties.strength).toBe("strong");
    expect(r!.properties.certainty).toBe("moderate");
    expect(r!.evidence!.quote).toContain("strong recommendation");
    expect(r!.evidence!.quote).toContain("moderate-certainty evidence");
  });

  it("leavesNonGradeCategoryUnset", () => {
    const [r] = recommendations(l1Document(entryOf({ "page-001": UNGRADED }), AT).doc);
    expect(r!.properties.strength).toBeUndefined();
    expect(r!.properties.certainty).toBeUndefined();
    expect(r!.note).toContain('"(Recommended only in specific contexts or conditions)"');
  });

  it("ignoresGradePhraseOutsideBlock", () => {
    const body = `${UNGRADED}\n\nElsewhere: a strong recommendation, high-certainty evidence.`;
    const [r] = recommendations(l1Document(entryOf({ "page-001": body }), AT).doc);
    expect(r!.properties.strength).toBeUndefined();
    expect(r!.properties.certainty).toBeUndefined();
  });

  it("gradeOnlyWithSourcePhraseInQuote", () => {
    const doc = l1Document(entryOf({ "page-001": GRADED, "page-002": UNGRADED }), AT).doc;
    for (const r of recommendations(doc)) {
      const quote = r.evidence!.quote!.toLowerCase();
      if (r.properties.strength) expect(quote).toContain(`${r.properties.strength} recommendation`);
      if (r.properties.certainty) expect(quote).toContain(`${r.properties.certainty.replace("-", " ")}-certainty`);
    }
  });

  it("inferredCarriesNoteAndEvidence", () => {
    const [r] = recommendations(l1Document(entryOf({ "page-001": GRADED }), AT).doc);
    expect(r!.derivation).toBe("inferred");
    expect(r!.evidence!.location).toMatch(/sections\/page-001\.md:4 /);
    expect(r!.note).toContain('"Source: WHO, 2020 (4)."');
  });

  it("unlabelledProseCountedNotEmitted", () => {
    const { doc, coverage } = l1Document(entryOf({ "page-001": "WHO recommends (recommendation 8) the use of it." }), AT);
    expect(recommendations(doc)).toHaveLength(0);
    expect(coverage.unlabelledMentions).toBe(1);
  });

  it("refusesUnendingBlock", () => {
    const body = ["Recommendation 1: WHO recommends", ...Array.from({ length: MAX_STATEMENT_LINES + 5 }, () => "more text")].join("\n");
    const { found, refused } = findRecommendations(body);
    expect(found).toHaveLength(0);
    expect(refused).toHaveLength(1);
  });
});

describe("the publication", () => {
  it("takesElectronicIsbn", () => {
    const r = readIsbn([{ path: "x.md", text: "ISBN 978-92-4-009336-2 (electronic version)\nISBN 978-92-4-009337-9 (print version)" }]);
    expect(r.isbn).toBe("978-92-4-009336-2");
  });
  it("takesNoUnlabelledIsbn", () => {
    const r = readIsbn([{ path: "x.md", text: "ISBN 978-92-4-009336-2\nISBN 978-92-4-009337-9" }]);
    expect(r.isbn).toBeUndefined();
    expect(r.reason).toContain("2 ISBNs");
  });
  it("publicationIsFileHashWithoutIsbn", () => {
    const { doc } = l1Document(entryOf({ "page-001": GRADED }), AT);
    expect(doc.nodes[0]!.id).toBe(`urn:sha256:${"a".repeat(64)}`);
  });
});

describe("the vocabulary is smart-base's own", () => {
  it("everyClassInKgClassLists", () => {
    const { doc } = l1Document(entryOf({ "page-001": GRADED, "page-002": UNGRADED }), AT);
    expect(new Set(doc.nodes.map((n) => n.type))).toEqual(new Set(["publication", "publication-section", "recommendation"]));
    expect(unpinnedClasses(doc, kgClasses())).toEqual([]);
  });
  it("catchesClassOutsideLists", () => {
    const { doc } = l1Document(entryOf({ "page-001": GRADED }), AT);
    expect(unpinnedClasses(doc, new Set(["sgkg-l1#publication"]))).toEqual(["publication-section", "recommendation"]);
  });
});

describe("staleness", () => {
  it("currentUpToGeneratedAtStaleOnEdit", () => {
    const dir = writeEntry({ "page-001": GRADED });
    const before = readEntry(dir, dir);
    if ("reason" in before) throw new Error(before.reason);
    const written = serialise(l1Document(before, AT).doc);
    expect(isCurrent(written, l1Document(before, "2030-01-01T00:00:00Z").doc)).toBe(true);
    writeFileSync(join(dir, "sections", "page-001.md"), FRONT + GRADED + "\nan edit\n");
    const after = readEntry(dir, dir);
    if ("reason" in after) throw new Error(after.reason);
    expect(isCurrent(written, l1Document(after, AT).doc)).toBe(false);
  });

  it("checkFailsStalePassesCurrent", () => {
    const dir = writeEntry({ "page-001": GRADED });
    const run = (...a: string[]) => spawnSync("bun", ["run", SCRIPT, ...a], { encoding: "utf-8" });
    expect(run("--entry", dir).status).toBe(0);
    expect(readFileSync(join(dir, L1_DOCUMENT_FILENAME), "utf-8")).toContain('"recommendation"');
    expect(run("--check", "--entry", dir).status).toBe(0);
    writeFileSync(join(dir, "sections", "page-001.md"), FRONT + UNGRADED + "\n");
    const stale = run("--check", "--entry", dir);
    expect(stale.status).toBe(1);
    expect(stale.stdout).toContain("stale");
  });
});

describe("T3 fidelity is left to a person (bean 8pzh)", () => {
  it("reportsT3PendingPerson", () => {
    const { doc, coverage } = l1Document(entryOf({ "page-001": GRADED }), AT);
    expect(coverage.fidelity.t3).toBe("pending-person");
    expect(coverage.fidelity.inferredNodes).toBe(doc.nodes.filter((n) => n.derivation === "inferred").length);
    expect(coverage.fidelity.inferredNodes).toBeGreaterThan(0);
  });

  it("neverSetsT3OtherThanPending", () => {
    const src = readFileSync(join(import.meta.dir, "extract-smart-kg-l1.ts"), "utf-8");
    const assigned = [...src.matchAll(/t3:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(assigned.length).toBeGreaterThan(0);
    expect(new Set(assigned)).toEqual(new Set(["pending-person"]));
  });
});
