/**
 * Extraction quality from the IRIS pilot (owner, 2026-11-11, who-iris card
 * Q-ODD-1 = A): failing pages routed to OCR, errata and footnotes in the L1
 * document schema. The Python halves are pinned by
 * `scripts/tests/iris-extraction-quality.test.py`, run from here.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DocumentErrataSchema } from "../../../schemas/content/document-errata.ts";
import { DocumentFootnotesSchema } from "../../../schemas/content/document-footnotes.ts";
import { PdfDiagnosticsSchema } from "../../../schemas/ui/pdf-structure.ts";
import { readFileSync } from "node:fs";
import { errataRequirement, footnotesRequirement } from "../../check-l1-complete.ts";
import { pagesToOcr, planFor, withLanguageHint } from "../../ingest-document.ts";

const SCRIPTS = join(import.meta.dir, "..", "..");
const LIB = "/tmp/lib";

const draft = [{ text: "The title says June 2006; the introduction says June 2005.", lang: "en", state: "draft", drafted_by: { kind: "agent", id: "claude-code", model: "not-disclosed", session: "https://claude.ai/code/session_01Qmmkt69YZtQn3UstRNcFjd" } }];

function entry(slug: string): string {
  const root = mkdtempSync(join(tmpdir(), "iris-x-"));
  const dir = join(root, slug);
  mkdirSync(join(dir, "blocks"), { recursive: true });
  writeFileSync(join(dir, "blocks", "prose-sec-000.jsonld"), "{}");
  return dir;
}

describe("how an oversized section was cut", () => {
  test("every way pdf-structure.py reports is one the schema accepts", () => {
    // 10665-75211 was refused by l1-blocks when the running-head cut first ran:
    // the Python wrote a `by` the schema did not list.
    const py = readFileSync(join(SCRIPTS, "pdf-structure.py"), "utf-8");
    const written = [...py.matchAll(/^\s*by = "([^"]+)"$/gm)].map((m) => m[1]!);
    expect(written.sort()).toEqual(["headings", "pages", "running heads"]);
    const shape = PdfDiagnosticsSchema.shape.oversized_split;
    for (const by of written) {
      expect(shape.safeParse([{ title: "Annex G", page_start: 104, page_end: 223, words: 36773, by, into: 30 }]).success).toBe(true);
    }
  });
});

describe("failing pages go to OCR", () => {
  test("no failing page, no OCR", () => {
    expect(pagesToOcr({ outline: 3, outlineUsable: 3, chars: 9000, pagesFailing: [], pagesTotal: 10 })).toBeUndefined();
  });

  test("a few failing pages in a document with an outline: OCR, then pdf-structure --ocr", () => {
    const p = planFor("x.pdf", { outline: 3, outlineUsable: 3, chars: 9000, pagesFailing: [[2, "mojibake"]], pagesTotal: 10 }, LIB);
    expect(p.rung).toBe("pdf-ocr+pdf-structure");
    expect(p.steps.map((s) => s[1]?.split("/").pop())).toEqual(["pdf-ocr.py", "pdf-structure.py"]);
    expect(p.steps[1]).toContain("--ocr");
  });

  test("most pages failing, no outline: the whole document from OCR", () => {
    const p = planFor("x.pdf", { outline: 0, outlineUsable: 0, chars: 9000, pagesFailing: [[1, "a"], [2, "b"], [3, "c"]], pagesTotal: 4 }, LIB);
    expect(p.rung).toBe("pdf-ocr+pdf-pages");
  });

  test("the languages reach pdf-structure as well as pdf-ocr", () => {
    const p = withLanguageHint({ rung: "pdf-ocr+pdf-structure", why: "", steps: [["python3", "/s/pdf-ocr.py", "x.pdf"], ["python3", "/s/pdf-structure.py", "--ocr", "x.pdf"]] }, ["fr", "en"]);
    expect(p.steps.every((s) => s.slice(-2).join(" ") === "--lang-hint fr,en")).toBe(true);
  });

  test("the Python checks hold (scripts/tests/iris-extraction-quality.test.py)", () => {
    const r = Bun.spawnSync(["python3", join(SCRIPTS, "tests", "iris-extraction-quality.test.py")]);
    expect(r.stdout.toString()).toContain("all checks passed");
    expect(r.exitCode).toBe(0);
  });
});

describe("errata in the L1 document schema", () => {
  const ok = { $schema: "folio-document-errata/v1", entry: "10665-205022", errata: [{ id: "e1", kind: "inconsistency", block: "library/10665-205022/blocks/prose-sec-000", quote: "6 to 10 June 2005", reading: "6 to 10 June 2006", evidence: "The cover (p. 1) and the programme (p. 20, 'Tuesday, 6 June 2006') give 2006", narrative: draft }] };

  test("an erratum names where it is, quotes the source, and carries a note", () => {
    expect(DocumentErrataSchema.safeParse(ok).success).toBe(true);
    const nowhere = { ...ok, errata: [{ ...ok.errata[0], block: undefined }] };
    expect(DocumentErrataSchema.safeParse(nowhere).success).toBe(false);
    const twice = { ...ok, errata: [ok.errata[0], ok.errata[0]] };
    expect(DocumentErrataSchema.safeParse(twice).success).toBe(false);
  });

  test("the L1 check reports errata, and fails on a block the entry does not have", () => {
    const dir = entry("10665-205022");
    try {
      expect(errataRequirement(dir)).toBeUndefined();
      writeFileSync(join(dir, "errata.json"), JSON.stringify(ok));
      expect(errataRequirement(dir)?.state).toBe("met");
      writeFileSync(join(dir, "errata.json"), JSON.stringify({ ...ok, errata: [{ ...ok.errata[0], block: "library/10665-205022/blocks/prose-sec-099" }] }));
      expect(errataRequirement(dir)?.state).toBe("unmet");
    } finally {
      rmSync(join(dir, ".."), { recursive: true, force: true });
    }
  });
});

describe("footnotes and their marks in the L1 document schema", () => {
  const ok = {
    $schema: "folio-document-footnotes/v1", entry: "10665-75211-rus", status: "determined", body_size: 10,
    footnotes: [{ id: "fn-p020-1", page: 20, mark: "3", text: "Резолюция 58.28", marks: [{ page: 20, context: "в резолюциях" }] }],
    uncalled_notes: [{ id: "fn-p021-1", page: 21, mark: "1", text: "Germany 1 090" }],
    unlinked_marks: [],
  };

  test("a footnote is called from the text; an uncalled note is kept apart", () => {
    expect(DocumentFootnotesSchema.safeParse(ok).success).toBe(true);
    const uncalled = { ...ok, footnotes: [{ ...ok.footnotes[0], marks: [] }] };
    expect(DocumentFootnotesSchema.safeParse(uncalled).success).toBe(false);
  });

  test("the L1 check reports the counts and refuses another entry's file", () => {
    const dir = entry("10665-75211-rus");
    try {
      writeFileSync(join(dir, "footnotes.json"), JSON.stringify(ok));
      expect(footnotesRequirement(dir)?.state).toBe("met");
      writeFileSync(join(dir, "footnotes.json"), JSON.stringify({ ...ok, entry: "other" }));
      expect(footnotesRequirement(dir)?.state).toBe("unmet");
    } finally {
      rmSync(join(dir, ".."), { recursive: true, force: true });
    }
  });
});
