import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { writeDeclaration } from "../../cat-harness-tools/test/support/instance-fixture.ts";
import { toCslItem, type ReferenceNode } from "../schemas/reference.ts";
import { entryText, referenceListsOf, renderReferenceList, shortEntry, whoEntry } from "./references-render.ts";

const made: string[] = [];
afterAll(() => made.forEach((d) => rmSync(d, { recursive: true, force: true })));

const node = (r: Partial<ReferenceNode> & Record<string, unknown>): ReferenceNode =>
  ({ $schema: "folio-reference/v1", id: "k", type: "book", ...r }) as ReferenceNode;

// Entries as dth-sc and dth-phc print them (WHO style).
const diig = node({
  id: "9789240010567-eng",
  title: "Digital implementation investment guide (DIIG): integrating digital interventions into health programmes",
  "publisher-place": "Geneva",
  publisher: "World Health Organization",
  issued: { "date-parts": [[2020]] },
  URL: "https://iris.who.int/handle/10665/334306",
});

describe("whoEntry", () => {
  test("whoBookEntry", () => {
    expect(whoEntry(diig)).toBe(
      "Digital implementation investment guide (DIIG): integrating digital interventions into health programmes. Geneva: World Health Organization; 2020 (https://iris.who.int/handle/10665/334306).",
    );
  });

  test("whoWebPageEntry", () => {
    const page = node({
      type: "webpage",
      title: "Health workforce",
      "container-title": "World Health Organization [website]",
      "publisher-place": "Geneva",
      publisher: "World Health Organization",
      issued: { "date-parts": [[2023]] },
      URL: "https://www.who.int/health-topics/health-workforce",
      accessed: { "date-parts": [[2023, 10, 11]] },
    });
    expect(whoEntry(page)).toBe(
      "Health workforce. In: World Health Organization [website]. Geneva: World Health Organization; 2023 (https://www.who.int/health-topics/health-workforce, accessed 11 October 2023).",
    );
    expect(whoEntry(page, { accessed: false })).toContain("(https://www.who.int/health-topics/health-workforce).");
  });

  test("whoJournalEntry", () => {
    const art = node({
      type: "article-journal",
      title: "Digitalization of routine health information systems: Bangladesh, Indonesia, Pakistan",
      author: [{ family: "Tamrat", given: "T" }, { family: "Chandir", given: "S" }],
      "container-title": "Bull World Health Organ",
      volume: "100",
      issue: "10",
      page: "590–600",
      issued: { "date-parts": [[2022]] },
      DOI: "10.2471/BLT.22.287816",
    });
    expect(whoEntry(art)).toBe(
      "Tamrat T, Chandir S. Digitalization of routine health information systems: Bangladesh, Indonesia, Pakistan. Bull World Health Organ. 2022;100(10):590–600. doi:10.2471/BLT.22.287816.",
    );
  });

  test("sevenAuthorsEtAlEditors", () => {
    const seven = Array.from({ length: 7 }, (_, i) => ({ family: `A${i}`, given: "B" }));
    expect(whoEntry(node({ title: "T", author: seven }))).toStartWith("A0 B, A1 B, A2 B, A3 B, A4 B, A5 B et al. T.");
    const ed = node({
      title: "ASCM supply chain dictionary, seventeenth edition",
      editor: [{ family: "Pittman", given: "PH" }, { family: "Atwater", given: "JB" }],
      "publisher-place": "Chicago",
      publisher: "Association for Supply Chain Management",
      issued: { "date-parts": [[2022]] },
    });
    expect(whoEntry(ed)).toBe(
      "Pittman PH, Atwater JB, editors. ASCM supply chain dictionary, seventeenth edition. Chicago: Association for Supply Chain Management; 2022.",
    );
  });
});

describe("shortEntry and printed", () => {
  test("shortEntry", () => {
    expect(shortEntry(node({ title: "Global strategy on human resources for health: Workforce 2030", author: [{ literal: "WHO" }], issued: { "date-parts": [[2016]] } }))).toBe(
      "WHO. Global strategy on human resources for health: Workforce 2030. 2016.",
    );
    expect(shortEntry(node({ title: "Global strategy on digital health 2020–2025", author: [{ literal: "WHO" }] }))).toBe("WHO. Global strategy on digital health 2020–2025.");
  });

  test("printedVerbatim", () => {
    const r = node({ title: "SMART Guidelines", author: [{ literal: "WHO" }], printed: "WHO SMART Guidelines." });
    expect(entryText(r, { style: "short" })).toBe("WHO SMART Guidelines.");
    expect(entryText(r, { style: "who" })).toBe("WHO SMART Guidelines.");
    expect(toCslItem(r)).not.toHaveProperty("printed");
  });

  test("numberedOrBulleted", () => {
    const a = node({ id: "a", title: "A", printed: "A." });
    const b = node({ id: "b", title: "B", printed: "B." });
    expect(renderReferenceList([a, b])).toBe("1. A.\n2. B.\n");
    expect(renderReferenceList([a, b], { list: "bullet" })).toBe("- A.\n- B.\n");
  });
});

describe("referenceListsOf", () => {
  const builders = resolve(import.meta.dir, "../../cat-harness-tools/schemas/builders.ts");
  function instance(cites: string[], meta: unknown): string {
    const root = mkdtempSync(join(tmpdir(), "refs-render-"));
    made.push(root);
    writeDeclaration(root, {
      name: "doc-x",
      directories: [
        { id: "folio", path: "folio/", graphTypologies: ["folio"] },
        { id: "references", path: "references/", graphTypologies: ["references"] },
      ],
    });
    mkdirSync(join(root, "references"), { recursive: true });
    mkdirSync(join(root, "folio/doc-x/references"), { recursive: true });
    writeFileSync(join(root, "references/a.json"), JSON.stringify(node({ id: "a", title: "First", author: [{ literal: "WHO" }], issued: { "date-parts": [[2015]] } })));
    writeFileSync(join(root, "references/b.json"), JSON.stringify(node({ id: "b", title: "Second", printed: "WHO and ITU. Second. Draft, July 2026." })));
    writeFileSync(
      join(root, "folio/doc-x/references/p-references.ts"),
      `import { prose } from ${JSON.stringify(builders)};\nexport default prose({ label: "prose:references", uses: [], cites: ${JSON.stringify(cites)}, meta: ${JSON.stringify(meta)} });\n`,
    );
    // A block that is not a reference list is left alone.
    writeFileSync(join(root, "folio/doc-x/references/p-other.ts"), `import { prose } from ${JSON.stringify(builders)};\nexport default prose({ label: "prose:other", uses: [], cites: ["a"] });\n`);
    return root;
  }

  test("listFromCitedNodes", async () => {
    const root = instance(["b", "a"], { referenceList: { style: "short", list: "bullet" } });
    expect(await referenceListsOf(root)).toEqual([
      {
        block: "folio/doc-x/references/p-references.ts",
        md: "folio/doc-x/references/p-references.md",
        content: "- WHO and ITU. Second. Draft, July 2026.\n- WHO. First. 2015.\n",
      },
    ]);
  });

  test("badKeyEmptyUnknownOption", async () => {
    await expect(referenceListsOf(instance(["a", "nope"], { referenceList: {} }))).rejects.toThrow(/"nope", which no reference node/);
    await expect(referenceListsOf(instance([], { referenceList: {} }))).rejects.toThrow(/cites nothing/);
    await expect(referenceListsOf(instance(["a"], { referenceList: { style: "apa" } }))).rejects.toThrow(/meta.referenceList/);
  });
});
