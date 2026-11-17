/**
 * The slot schemas take one narrative or one per language (bean
 * `cat-tools-e1lo`, stage 3c), and a summary's status reads every language.
 */
import { describe, expect, test } from "bun:test";
import { BlockSummarySchema, bodyHash, summaryStatus } from "./content/block-summary.ts";
import { TabularCsvwSchema } from "./library/tabular-csvw.ts";

const by = { kind: "agent" as const, id: "a", model: "m" };
const human = { kind: "human" as const, id: "h" };
const n = (lang: string, state: "draft" | "confirmed" | "rejected") => ({
  text: `summary ${lang}`,
  state,
  lang,
  drafted_by: by,
  drafted_at: "2026-10-21T00:00:00Z",
  ...(state === "confirmed" ? { confirmed_by: human, confirmed_at: "2026-10-21T01:00:00Z" } : {}),
  ...(state === "rejected" ? { rejected_by: human, rejected_at: "2026-10-21T01:00:00Z", rejection_reason: "wrong" } : {}),
});
const body = "The section text.";
const record = (narrative: unknown) =>
  BlockSummarySchema.parse({ block: "library/x/blocks/prose-sec-000", source: "sections/a.md", source_hash: bodyHash(body), narrative });

describe("a summary's status reads every language", () => {
  test("a one-entry list reads as its one narrative", () => {
    expect(summaryStatus(record([n("en", "confirmed")]), body)).toBe("confirmed");
  });

  test("confirmed only when every language is", () => {
    expect(summaryStatus(record([n("en", "confirmed"), n("fr", "confirmed")]), body)).toBe("confirmed");
    expect(summaryStatus(record([n("en", "confirmed"), n("fr", "draft")]), body)).toBe("draft");
  });

  test("rejected when any language is", () => {
    expect(summaryStatus(record([n("en", "confirmed"), n("fr", "rejected")]), body)).toBe("rejected");
  });

  test("FALSIFIED: a list entry that is not-authored is refused, as the single form is", () => {
    const bad = { text: null, state: "not-authored", lang: "fr" };
    expect(BlockSummarySchema.safeParse({ block: "b", source: "s", source_hash: bodyHash(body), narrative: [n("en", "draft"), bad] }).success).toBe(false);
  });
});

describe("an optional slot takes a per-language list", () => {
  test("tabular-csvw: a list parses; a list missing a lang does not", () => {
    const base = {
      $schema: "folio-tabular-csvw/v1",
      doc_id: "p",
      source: { sha256: "0" },
      tables: [
        {
          url: "p.csv",
          tableSchema: { columns: [{ name: "a", titles: "a", datatype: "string", datatypeSource: "measured" }] },
          "fac:anchor": null,
          "fac:headerRow": 1,
          "fac:extent": { rows: 1, columns: 1, source: "measured" },
        },
      ],
    };
    const ok = TabularCsvwSchema.safeParse({ ...base, narrative: [n("en", "draft"), n("fr", "draft")] });
    const bad = TabularCsvwSchema.safeParse({ ...base, narrative: [n("en", "draft"), { ...n("fr", "draft"), lang: undefined }] });
    expect(bad.success).toBe(false);
    expect(ok.success).toBe(true);
  });
});
