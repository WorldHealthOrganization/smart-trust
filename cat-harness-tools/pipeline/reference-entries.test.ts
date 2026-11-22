/**
 * A folio's bibliography read in both layouts at once (bean qou-l7pj): one
 * CSL-JSON file per entry under `<folio>/references/`, and the `ref({…})`
 * calls left in `<folio>/schema/references.ts`.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { authorNames, entryUrl, issuedYear, referenceDirs, referenceEntries, referenceEntryIds, stringField } from "./reference-entries.ts";
import { readReferences } from "./source-ledger-index.ts";
import { resolveAllReferenceIds } from "./validate.ts";
import { allConstraintRules } from "../schemas/content/vocabulary-modules.ts";

const made: string[] = [];
afterAll(() => made.forEach((d) => rmSync(d, { recursive: true, force: true })));

function folio(opts: { files?: Record<string, unknown>; module?: string } = {}): string {
  const root = mkdtempSync(join(tmpdir(), "refs-"));
  made.push(root);
  if (opts.files) {
    mkdirSync(join(root, "folio", "references"), { recursive: true });
    for (const [name, body] of Object.entries(opts.files)) {
      writeFileSync(join(root, "folio", "references", name), typeof body === "string" ? body : JSON.stringify(body, null, 2));
    }
  }
  if (opts.module !== undefined) {
    mkdirSync(join(root, "folio", "schema"), { recursive: true });
    writeFileSync(join(root, "folio", "schema", "references.ts"), opts.module);
  }
  return root;
}

const garoufalidis = {
  $schema: "folio-reference/v1",
  id: "garoufalidis2004",
  type: "article-journal",
  title: "On the characteristic and deformation varieties of a knot",
  author: [{ family: "Garoufalidis", given: "Stavros" }],
  issued: { "date-parts": [[2004]] },
  DOI: "10.2140/gtm.2004.7.291",
  note: "arXiv:math/0306230.",
};
const who = { $schema: "folio-reference/v1", id: "who2014", type: "book", author: [{ literal: "World Health Organization" }], URL: "https://iris.who.int/handle/10665/145714" };
const MODULE = `// Entries are \`ref({…})\` calls; one, \`ref({ id: "ghost" })\`, was removed.
export const references = [
  ref({
    id: "leitner2026",
    type: "article",
    title: "Quantum \\"Observable\\" Universe",
    author: [{ family: "Leitner", given: "C." }],
    issued: { "date-parts": [[2026]] },
    URL: "https://arxiv.org/abs/2601.00001",
  }),
  ref({
    id: "garoufalidis2004",
    title: "a stale inline copy the file supersedes",
  }),
];
`;

describe("referenceEntries", () => {
  const root = folio({ files: { "garoufalidis2004.json": garoufalidis, "who2014.json": who, "broken.json": "{" }, module: MODULE });
  const entries = referenceEntries(root);

  test("module entries the files do not already hold are added; unparseable files skipped", () => {
    expect(entries.map((e) => [e.kind, e.id]).sort()).toEqual([
      ["file", "garoufalidis2004"],
      ["file", "who2014"],
      ["module", "leitner2026"],
    ]);
  });

  test("ordered as the module orders them; entries it does not name follow by name", () => {
    // MODULE names leitner2026, then garoufalidis2004; who2014 is a file only.
    expect(entries.map((e) => e.id)).toEqual(["leitner2026", "garoufalidis2004", "who2014"]);
  });

  test("the conventional directory is found when nothing is declared", () => {
    expect(referenceDirs(root)).toEqual([join(root, "folio", "references")]);
  });

  test("fields read the same from a file and from a ref({…}) body", () => {
    const byId = new Map(entries.map((e) => [e.id, e]));
    const [g, w, l] = ["garoufalidis2004", "who2014", "leitner2026"].map((k) => byId.get(k)!) as [(typeof entries)[0], (typeof entries)[0], (typeof entries)[0]];
    expect(stringField(g, "title")).toBe("On the characteristic and deformation varieties of a knot");
    expect(stringField(l, "title")).toBe('Quantum "Observable" Universe');
    expect([issuedYear(g), issuedYear(l), issuedYear(w)]).toEqual(["2004", "2026", undefined]);
    expect(authorNames(g)).toEqual(["Garoufalidis"]);
    expect(authorNames(w)).toEqual(["World Health Organization"]);
    expect(authorNames(l)).toEqual(["Leitner"]);
    expect([entryUrl(g), entryUrl(w), entryUrl(l)]).toEqual([
      "https://doi.org/10.2140/gtm.2004.7.291",
      "https://iris.who.int/handle/10665/145714",
      "https://arxiv.org/abs/2601.00001",
    ]);
  });

  test("a folio with only the module still reads every entry (the layout before a split)", () => {
    expect(referenceEntries(folio({ module: MODULE })).map((e) => e.id)).toEqual(["leitner2026", "garoufalidis2004"]);
  });

  test("a folio with neither reads nothing", () => expect(referenceEntries(folio())).toEqual([]));

  test("a ref({…}) named in a comment is not an entry, and does not swallow the ones after it", () => {
    const ids = referenceEntries(folio({ module: MODULE })).map((e) => e.id);
    expect(ids).not.toContain("ghost");
    expect(ids).toEqual(["leitner2026", "garoufalidis2004"]);
  });
});

describe("source-ledger-index reads split references", () => {
  test("ids, URLs and arXiv ids come from the files and the module alike", () => {
    const r = readReferences(folio({ files: { "garoufalidis2004.json": garoufalidis, "who2014.json": who }, module: MODULE }));
    expect([...r.ids].sort()).toEqual(["garoufalidis2004", "leitner2026", "who2014"]);
    expect(r.byArxiv.get("2601.00001")).toBe("leitner2026");
    expect(r.urls.get("garoufalidis2004")).toBe("https://doi.org/10.2140/gtm.2004.7.291");
  });

  test("reads .jsonld Reference nodes and resolves cites-resolve against them alongside the registry", () => {
    const root = folio({
      files: {
        "garoufalidis2004.json": garoufalidis,
        "knuth1984.jsonld": {
          "@id": "references/knuth1984",
          "@type": ["fabio:Work", "bibo:AcademicArticle"],
          "dcterms:title": "Literate Programming",
          "dcterms:creator": ["Knuth, Donald E."],
          "dcterms:issued": "1984",
          "bibo:doi": "10.1093/comjnl/27.2.97",
        },
      },
    });
    expect([...referenceEntryIds(root)].sort()).toEqual(["garoufalidis2004", "knuth1984"]);
    const allIds = resolveAllReferenceIds(root)!;
    expect(allIds.has("knuth1984")).toBe(true);
    expect(allIds.has("garoufalidis2004")).toBe(true);

    const citesRule = allConstraintRules().find((r) => r.id === "cites-resolve")!;
    const ctx = {
      rootName: "b",
      dir: root,
      allLabels: new Set<string>(),
      allRefIds: allIds,
      fileExists: () => true,
    } as unknown as Parameters<typeof citesRule.check>[1];
    expect(citesRule.check({ kind: "theorem", label: "thm:x", cites: ["knuth1984", "garoufalidis2004"] } as never, ctx)).toBeNull();
    expect(citesRule.check({ kind: "theorem", label: "thm:x", cites: ["missing2099"] } as never, ctx)).toContain("missing2099");
  });
});
