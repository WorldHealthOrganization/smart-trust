/**
 * The keyword viewer page (cat-harness#1144): variants side by side, an A–Z
 * index of the default variant, and agreement with headings, the authors' own
 * keywords and the glossaries. Drawn over a FIXTURE model.
 */
import { describe, expect, test } from "bun:test";
import { agreement, authorKeywords, keywordsPage, norm, type KeywordsPageModel } from "../lib/keywords-page.ts";

const k = (term: string, heading = false) => ({ term, score: 1, evidence: heading ? ["heading" as const] : [] });

const MODEL: KeywordsPageModel = {
  variants: [
    { id: "a", method: "lsi", weighting: "log-entropy", space: "surface" },
    { id: "b", method: "correspondence-analysis", weighting: "raw", space: "latent", k: 100 },
  ],
  entries: [
    {
      instance: "fx",
      entry: "paper-one",
      href: "../../library/fx/paper-one/",
      document: { a: [k("decision table"), k("sweep")], b: [k("notation | pipe")] },
      sections: { s1: { a: [k("decision", true), k("sweep")], b: [k("notation")] } },
      author: ["Decision Table", "Sweep algorithm"],
    },
    {
      instance: "fx",
      entry: "paper-two",
      document: { a: [k("glossary")], b: [k("glossary")] },
      sections: {},
      author: [],
    },
  ],
  glossary: new Set([norm("Glossary")]),
  glossaryFiles: ["fx/glossary/fx.glossary.json"],
};

describe("author keyword lines", () => {
  test("reads Keywords: and Index Terms— lines, split on commas and semicolons", () => {
    expect(authorKeywords("x\nKeywords: SWOT Matrix, TOWS Analysis; Planning.\ny")).toEqual(["SWOT Matrix", "TOWS Analysis", "Planning"]);
    expect(authorKeywords("Index Terms—rdm, research data management")).toEqual(["rdm", "research data management"]);
    expect(authorKeywords("The keywords filling a slot")).toEqual([]);
  });
});

describe("agreement", () => {
  const ag = agreement(MODEL);
  test("heading share is over sections; author share over entries with a line; glossary over document keywords", () => {
    expect(ag.heading.get("a")).toBe(0.5);
    expect(ag.heading.get("b")).toBe(0);
    // "decision table" names "Decision Table"; "sweep" names "Sweep algorithm".
    expect(ag.author.get("a")).toBe(1);
    expect(ag.author.get("b")).toBe(0);
    expect(ag.authorEntries).toBe(1);
    expect(ag.glossary.get("a")).toBe(0.5);
  });
  test("a variant overlaps itself fully", () => {
    expect(ag.pairs.get("a|a")).toBe(1);
    expect(ag.pairs.get("a|b")).toBe(0.5);
  });
});

describe("the page", () => {
  const page = keywordsPage(MODEL, "generated: fixture");
  test("names every variant and links its method on the evidence page", () => {
    expect(page).toContain("| `a` (default) | [`lsi`](../#lsi) |");
    expect(page).toContain("[`correspondence-analysis`](../#correspondence-analysis)");
  });
  test("indexes the default variant A–Z, linking each entry", () => {
    expect(page).toContain("### D {#kw-d}");
    expect(page).toContain("- **decision table**: [paper-one](../../library/fx/paper-one/)");
    expect(page).toContain("- **glossary**: paper-two");
  });
  test("shows each entry's variants side by side, with its author keywords", () => {
    expect(page).toContain("author keywords: Decision Table, Sweep algorithm");
    expect(page).toContain("| 1 | decision table | notation \\| pipe |");
  });
  test("a backslash in a term is escaped, so it cannot unescape the cell bar after it", () => {
    const one = { ...MODEL.entries[1]!, document: { a: [k("back\\")], b: [k("x")] } };
    expect(keywordsPage({ ...MODEL, entries: [one] }, "generated: fixture")).toContain("| 1 | back\\\\ | x |");
  });
  test("each entry's details block lets kramdown read the table inside it", () => {
    // Without markdown="1" kramdown leaves a block-HTML body unparsed, and the
    // reader sees rows of pipes (check:escaped-markup on folio-assistant#3124).
    const opens = page.split("\n").filter((l) => l.startsWith("<details"));
    expect(opens.length).toBeGreaterThan(0);
    for (const l of opens) expect(l.startsWith('<details markdown="1">')).toBe(true);
  });
  test("every table row has as many cells as its header", () => {
    let cols = 0;
    for (const line of page.split("\n")) {
      if (!line.startsWith("|")) {
        cols = 0;
        continue;
      }
      const cells = line.replace(/\\\|/g, "").split("|").length - 2;
      if (cols === 0) cols = cells;
      else expect(cells).toBe(cols);
    }
  });
});
