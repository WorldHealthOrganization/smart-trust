/**
 * The glossary page SHOWS the three mapping states, and says when nobody asked.
 *
 * @module scripts/glossary-mapping-block.test
 * @graphNode none — a test
 *
 * Bean `7wou`. The page renders what `check:term-mapping` found; it does not
 * recompute it. What must not regress is the distinction the whole check
 * exists for: an `undetermined` count is not an `unmapped` one, and a missing
 * result is neither.
 */
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { readPathAt } from "@litlfred/cat-harness-tools/scripts/lib/layer-output.ts";

import { codeSpans, collect, mappingBlock, mappingStates, perTermMapping } from "./glossary-page.ts";

describe("codeSpans — bean `mylx`, no raw backticks on a rendered page", () => {
  test("backticksBecomeCodeSpans", () => {
    expect(codeSpans("a `b` c")).toBe("a <code>b</code> c");
  });

  test("escapeBeforeCodeSpans", () => {
    const out = codeSpans("<script>alert(1)</script> and `x`");
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
    expect(out).toContain("<code>x</code>");
  });

  test("unpairedBacktickLeft", () => {
    expect(codeSpans("a ` b")).toBe("a ` b");
  });
});

describe("the committed result, read the way the page reads it", () => {
  const states = mappingStates();

  test("committedResultBothTargets", () => {
    // If this goes undefined the page silently switches to "not checked",
    // which is correct behaviour and a broken corpus — so assert it here.
    expect(states).toBeDefined();
    expect(new Set(states!.map((s) => s.target))).toEqual(new Set(["skos", "fhir"]));
  });

  test("rowsCarryThreeCounts", () => {
    for (const s of states!) {
      expect(s.mapped + s.unmapped + s.undetermined).toBeGreaterThan(0);
      expect(s.mapped).toBeGreaterThanOrEqual(0);
    }
  });

  test("undeterminedStatesWhy", () => {
    // The load-bearing distinction: silence is not a negative answer.
    for (const s of states!) {
      if (s.undetermined > 0) expect(s.reason).toBeTruthy();
    }
  });

  test("targetsCoverSameSchemes", () => {
    const of = (t: string) => new Set(states!.filter((s) => s.target === t).map((s) => s.scheme));
    expect(of("skos")).toEqual(of("fhir"));
  });

  test("mappedRowNamesTerms", () => {
    for (const s of states!) {
      expect(s.mappedTerms.length).toBe(s.mapped);
    }
  });
});

describe("the rendered pages say it", () => {
  // The pages are written at publish to the layer output root (bean cat-tools-sm8r):
  // read the copy a reader of the site sees, the pinned bytes when there is none.
  const read = async (p: string) => await Bun.file(readPathAt(process.cwd(), resolve(p))).text();

  test("glossaryPagesCarryTable", async () => {
    for (const p of [
      "cat-harness/docs/en/folio-assistant-core/glossary/index.md",
      "cat-harness/docs/en/folio-assistant-core/glossary/dmn-decisions/index.md",
      "cat-harness/docs/en/folio-assistant-core/glossary/skills/index.md",
    ]) {
      const html = await read(p);
      expect(html, `${p} has no mapping table`).toContain('class="fa-gloss-mapping"');
      expect(html).toContain("why undetermined");
      // Said in WORDS, not only by a column heading.
      expect(html).toContain("Undetermined is never");
    }
  });

  test("perTypeCountsScoped", async () => {
    // dmn-decisions holds 9 terms; the index covers every scheme. If the
    // block ignored its `schemes` argument both would print the same total,
    // which is the bug this catches.
    const dmn = await read("cat-harness/docs/en/folio-assistant-core/glossary/dmn-decisions/index.md");
    const idx = await read("cat-harness/docs/en/folio-assistant-core/glossary/index.md");
    const total = (html: string) =>
      Number(/<td><code>skos<\/code><\/td><td>(\d+)<\/td><td>(\d+)<\/td>/.exec(html)?.[2] ?? "-1");
    expect(total(dmn)).toBeGreaterThan(0);
    expect(total(idx)).toBeGreaterThan(total(dmn));
  });

  test("noRawBacktickInTable", async () => {
    const html = await read("cat-harness/docs/en/folio-assistant-core/glossary/index.md");
    const table = /<table class="fa-gloss-mapping">[\s\S]*?<\/table>/.exec(html)?.[0] ?? "";
    expect(table.length).toBeGreaterThan(0);
    expect(table).not.toContain("`");
  });
});

describe("the third state at the PAGE level — nobody asked", () => {
  const row = (over: Record<string, unknown> = {}) => ({
    scheme: "kg-skills", target: "skos", mapped: 0, unmapped: 3, undetermined: 0,
    mappedTerms: [], ...over,
  }) as never;

  test("noResultSaysNotChecked", () => {
    // The `dh4f` guard. A page that printed "0 mapped" over a file nobody
    // wrote would present could-not-determine as a determined empty.
    const html = mappingBlock(undefined, ["kg-skills"]);
    expect(html).toContain("Not checked");
    expect(html).toContain("unknown");
    expect(html).toContain("bun run cat term:mapping");
    expect(html).not.toContain("<table");
  });

  test("noPageSchemesRendersNothing", () => {
    // Not "0 of 0" — there is no question to answer for this page.
    expect(mappingBlock([row()], ["kg-tools"])).toBe("");
  });

  test("countsSummedPerTarget", () => {
    const html = mappingBlock(
      [row({ scheme: "a", unmapped: 2 }), row({ scheme: "b", unmapped: 5 })],
      ["a", "b"],
    );
    expect(html).toContain("<td>7</td>");
  });

  test("reasonSurfacedForTarget", () => {
    const html = mappingBlock(
      [row({ target: "fhir", unmapped: 0, undetermined: 4, reason: "host refused" })],
      ["kg-skills"],
    );
    expect(html).toContain("host refused");
  });
});

describe("the page and the record key a scheme the same way (bean q3n9, owner ruling A)", () => {
  // The page places a scheme under its owning layer; the record keys its
  // rows by (layer, scheme). If the two ever derive the owner differently,
  // a term on the page reads another layer's row, or none. Over the real
  // checkout, in both directions.
  const states = mappingStates() ?? [];
  const page = collect().glossaries.filter((s) => s.file.endsWith(".glossary.json") && existsSync(s.file));
  const onPage = new Set(page.map((s) => `${s.instance}\0${s.glossary.id}`));
  const inRecord = new Set(states.map((r) => `${r.instance}\0${r.scheme}`));

  test("recordHasRows", () => {
    expect(states.length).toBeGreaterThan(0);
  });

  test("recordRowsOnPage", () => {
    const stray = [...inRecord].filter((k) => !onPage.has(k)).map((k) => k.replace("\0", " / "));
    expect(stray).toEqual([]);
  });

  test("pageSchemesHaveRows", () => {
    const missing = page
      .filter((s) => s.glossary.terms.some((t) => t.status !== "authored"))
      .map((s) => `${s.instance}\0${s.glossary.id}`)
      .filter((k) => !inRecord.has(k))
      .map((k) => k.replace("\0", " / "));
    expect(missing).toEqual([]);
  });
});

describe("per term — bean `5yhm`, every term's state, none of them graded", () => {
  const row = (over: Record<string, unknown> = {}) =>
    ({ instance: "i", scheme: "s", target: "skos", mapped: 0, unmapped: 3, undetermined: 0, mappedTerms: [], ...over }) as never;
  const keys = ["a", "b", "c"].map((t) => ({ anchor: `x--s--${t}`, instance: "i", scheme: "s", term: t }));

  test("allUnmappedOneDefault", () => {
    const { note, marks } = perTermMapping([row()], keys);
    expect(note).toContain("<strong>unmapped</strong> on <code>skos</code>");
    expect(note).toContain("No entry says otherwise.");
    expect(marks.size).toBe(0);
  });

  test("allUndeterminedDefault", () => {
    const { note, marks } = perTermMapping([row({ target: "fhir", unmapped: 0, undetermined: 3, reason: "r" })], keys);
    expect(note).toContain("<strong>undetermined</strong> on <code>fhir</code>");
    expect(note).not.toContain("unmapped");
    expect(marks.size).toBe(0);
  });

  test("exactAndConceptMarkedApart", () => {
    const { marks, note } = perTermMapping(
      [
        row({
          mapped: 2,
          unmapped: 1,
          mappedTerms: [
            { term: "a", exact: true, concepts: ["http://ex/a"] },
            { term: "b", exact: false, concepts: ["http://ex/b"] },
          ],
        }),
      ],
      keys,
    );
    expect(marks.get("x--s--a")).toContain("mapped, exact");
    expect(marks.get("x--s--a")).toContain("http://ex/a");
    expect(marks.get("x--s--b")).toContain("mapped by concept only");
    expect(marks.get("x--s--b")).not.toContain("exact");
    expect(marks.has("x--s--c")).toBe(false); // the stated default covers it
    expect(note).toContain("2 entries say otherwise.");
  });

  test("mixedNamedUndetermined", () => {
    const { marks, note } = perTermMapping(
      [row({ target: "fhir", unmapped: 2, undetermined: 1, undeterminedTerms: ["c"], reason: "r" })],
      keys,
    );
    expect(note).toContain("no single state on <code>fhir</code>");
    expect(marks.get("x--s--a")).toContain("unmapped");
    expect(marks.get("x--s--c")).toContain("undetermined");
    expect(marks.size).toBe(3);
  });

  test("mixedUnnamedIsUnknown", () => {
    const { marks } = perTermMapping([row({ unmapped: 2, undetermined: 1 })], keys);
    for (const k of keys) {
      expect(marks.get(k.anchor)).toContain("cannot be told from the committed result");
      expect(marks.get(k.anchor)).not.toContain("<code>skos</code> unmapped");
    }
  });

  test("sharedKeyBothUnknown", () => {
    const dup = [
      { anchor: "i1--s--a", instance: "i", scheme: "s", term: "a" },
      { anchor: "i2--s--a", instance: "i", scheme: "s", term: "a" },
    ];
    const { marks } = perTermMapping(
      [row({ mapped: 1, unmapped: 0, mappedTerms: [{ term: "a", exact: true, concepts: [] }] })],
      dup,
    );
    expect(marks.get("i1--s--a")).toContain("two entries share the id");
    expect(marks.get("i2--s--a")).toContain("two entries share the id");
  });

  test("twoInstancesOwnRows", () => {
    const two = [
      { anchor: "ch--s--a", instance: "cat-harness", scheme: "s", term: "a" },
      { anchor: "fh--s--a", instance: "fhir-harness", scheme: "s", term: "a" },
    ];
    const { marks } = perTermMapping(
      [
        row({ instance: "cat-harness", mapped: 1, unmapped: 0, mappedTerms: [{ term: "a", exact: true, concepts: ["http://ex/a"] }] }),
        row({ instance: "fhir-harness", mapped: 0, unmapped: 1 }),
      ],
      two,
    );
    expect(marks.get("ch--s--a")).toContain("mapped, exact");
    expect(marks.get("fh--s--a") ?? "").not.toContain("cannot be told");
  });

  test("noResultNoNote", () => {
    const { note, marks } = perTermMapping(undefined, keys);
    expect(note).toBe("");
    expect(marks.size).toBe(0);
  });

  test("typePagesCarryPerTermNote", async () => {
    // schema-fields is split by first letter (its page outgrew the budget), so
    // the note is on each part; the type's own page is a landing page.
    const parts = ["a-c", "d-e", "f-l", "m-o", "p-r", "s", "t-z"].map((r) => `cat-harness/docs/en/folio-assistant-core/glossary/schema-fields/${r}/index.md`);
    for (const p of ["cat-harness/docs/en/folio-assistant-core/glossary/dmn-decisions/index.md", ...parts]) {
      const html = await Bun.file(readPathAt(process.cwd(), resolve(p))).text();
      expect(html, `${p} has no per-term note`).toContain('class="fa-gloss-mapping-perterm"');
    }
  });
});
