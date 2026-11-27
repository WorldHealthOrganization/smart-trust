import { describe, expect, test } from "bun:test";
import { firstUse, passagesIn, proseText, MAX_MENTIONS } from "./term-passages.ts";

const block = (label: string, text: string, extra: Partial<{ defines: string[]; source: string; section: string }> = {}) => ({
  document: "doc",
  section: extra.section ?? "1.1 Section",
  label,
  page: "en/doc/index.html",
  source: extra.source ?? `folio/doc/ch1/${label}.md`,
  text,
  defines: extra.defines ?? [],
});

describe("term passages (folio-assistant-core#498)", () => {
  test("proseTextKeepsLinkText", () => {
    expect(proseText("# Title\n\nSee [Trade Item](x.md) and `code` <b>bold</b> :defterm[Registry]{#registry}.")).toBe("See Trade Item and bold Registry.");
  });

  test("multiWordAnyCase", () => {
    expect(firstUse("the application\ncomponents here", { labels: ["Application Component"] })).toBe(4);
  });

  test("acronymOwnCase", () => {
    expect(firstUse("a product", { labels: ["Product"] })).toBe(-1);
    expect(firstUse("a Product", { labels: ["Product"] })).toBe(2);
    expect(firstUse("DPI-H only", { labels: [], notation: "DPI" })).toBe(-1);
    expect(firstUse("two DPIs", { labels: [], notation: "DPI" })).toBe(4);
    expect(firstUse("dpi", { labels: [], notation: "DPI" })).toBe(-1);
  });

  test("definingBlockFirst", () => {
    const blocks = [
      block("p-1", "The Registry holds records."),
      block("p-2", "What it is.", { defines: ["registry"] }),
      block("tbl-glossary", "Registry A store of records.", { source: "folio/doc/glossary/t-glossary.md" }),
    ];
    const m = passagesIn(blocks, [{ key: "k", id: "registry", labels: ["Registry"], source: "folio/doc/glossary/t-glossary.md" }]);
    expect(m.get("k")!.map((p) => [p.kind, p.label])).toEqual([
      ["explains", "p-2"],
      ["mentions", "p-1"],
    ]);
    expect(m.get("k")![1]!.href).toBe("en/doc/index.html#p-1");
  });

  test("mentionsCapped", () => {
    const blocks = Array.from({ length: MAX_MENTIONS + 5 }, (_, i) => block(`p-${i}`, "uses Registry"));
    const m = passagesIn(blocks, [{ key: "k", labels: ["Registry"] }, { key: "none", labels: ["Nowhere"] }]);
    expect(m.get("k")!.length).toBe(MAX_MENTIONS);
    expect(m.has("none")).toBe(false);
  });
});
