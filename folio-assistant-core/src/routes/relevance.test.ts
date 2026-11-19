/**
 * The relevance route's reference facts (bean qou-l7pj): read from a folio's
 * per-entry bibliography files and its `references.ts` alike.
 */
import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readRefFacts } from "./relevance.ts";

const made: string[] = [];
afterAll(() => made.forEach((d) => rmSync(d, { recursive: true, force: true })));

test("factsFromFilesAndRefs", () => {
  const root = mkdtempSync(join(tmpdir(), "relevance-"));
  made.push(root);
  mkdirSync(join(root, "folio", "references"), { recursive: true });
  mkdirSync(join(root, "folio", "schema"), { recursive: true });
  writeFileSync(
    join(root, "folio", "references", "garoufalidis2004.json"),
    JSON.stringify({
      $schema: "folio-reference/v1",
      id: "garoufalidis2004",
      type: "article-journal",
      title: "On the characteristic and deformation varieties of a knot",
      author: [{ family: "Garoufalidis", given: "Stavros" }],
      issued: { "date-parts": [[2004]] },
      DOI: "10.2140/gtm.2004.7.291",
    }),
  );
  writeFileSync(
    join(root, "folio", "references", "bghl-2017.json"),
    JSON.stringify({
      $schema: "folio-reference/v1",
      id: "bghl-2017",
      type: "article-journal",
      author: [{ family: "A" }, { family: "B" }, { family: "C" }, { family: "D" }],
      URL: "https://example.org/x",
    }),
  );
  writeFileSync(
    join(root, "folio", "schema", "references.ts"),
    'export const references = [\n  ref({\n    id: "leitner2026",\n    title: "Quantum \\"Observable\\" Universe",\n    author: [{ family: "Leitner", given: "C." }],\n    issued: { "date-parts": [[2026]] },\n  }),\n];\n',
  );
  const facts = readRefFacts(root);
  expect(facts.get("garoufalidis2004")).toEqual({
    title: "On the characteristic and deformation varieties of a knot",
    authors: "Garoufalidis",
    year: "2004",
    url: "https://doi.org/10.2140/gtm.2004.7.291",
  });
  expect(facts.get("bghl-2017")).toEqual({ title: null, authors: "A et al.", year: null, url: "https://example.org/x" });
  expect(facts.get("leitner2026")).toEqual({ title: 'Quantum "Observable" Universe', authors: "Leitner", year: "2026", url: null });
});
