/**
 * Library entries as subgraph members (cat-harness#180): one pointer node per
 * entry file, with ONE type, placed by its path; an entry whose types will not
 * expand is reported once, never silently dropped.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { libraryEntryNodes, type Loader } from "../lib/library-subgraph-nodes.ts";

const DIR = mkdtempSync(join(tmpdir(), "lib-subgraph-"));
afterAll(() => rmSync(DIR, { recursive: true, force: true }));

const BASE = "https://example.org/folio/";
const CTX = { "@base": BASE, ex: "https://example.org/ns#", title: "ex:title" };
const noFetch: Loader = async (url) => {
  throw new Error(`fetched ${url}`);
};
const put = (rel: string, v: unknown): void => {
  mkdirSync(join(DIR, rel, ".."), { recursive: true });
  writeFileSync(join(DIR, rel), JSON.stringify(v));
};

writeFileSync(join(DIR, "inst.json"), JSON.stringify({ name: "inst", directories: [{ id: "library", path: "library", graphTypologies: ["library"] }] }));
put("library/doc-a/manifest.jsonld", { "@context": CTX, "@id": "library/doc-a/manifest", "@type": ["ex:SourceDocument"], title: "Doc A" });
put("library/doc-a/blocks/b1.jsonld", { "@context": CTX, "@id": "library/doc-a/blocks/b1", "@type": ["ex:Prose", "ex:Section"], title: "B1" });
// A data file named .jsonld but carrying no @context is not a node.
put("library/doc-a/tabular.jsonld", { "@id": "library/doc-a/tabular", rows: [] });
// A protected term redefined: its type cannot expand.
const PROTECTED = { "@protected": true, "@base": BASE, ex: "https://example.org/ns#" };
put("library/doc-b/manifest.jsonld", { "@context": [PROTECTED, { ex: "https://example.org/other#" }], "@id": "library/doc-b/manifest", "@type": "ex:SourceDocument" });
put("library/doc-b/blocks/b1.jsonld", { "@context": [PROTECTED, { ex: "https://example.org/other#" }], "@id": "library/doc-b/blocks/b1", "@type": "ex:Prose" });
// A directory with no manifest is not an entry.
put("library/notes/x.jsonld", { "@context": CTX, "@id": "library/notes/x", "@type": "ex:Note" });

describe("libraryEntryNodes", async () => {
  const { nodes, problems } = await libraryEntryNodes(DIR, noFetch);

  test("one pointer per entry file: absolute @id, ONE expanded @type (the first named), title and path", () => {
    expect(nodes).toEqual([
      { "@id": `${BASE}library/doc-a/blocks/b1`, "@type": "https://example.org/ns#Prose", path: "library/doc-a/blocks/b1.jsonld", title: "B1" },
      { "@id": `${BASE}library/doc-a/manifest`, "@type": "https://example.org/ns#SourceDocument", path: "library/doc-a/manifest.jsonld", title: "Doc A" },
    ]);
  });

  test("an entry whose types do not expand is one problem naming the count, not a silent drop", () => {
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^library\/doc-b: 2 file\(s\) left out, their @type does not expand/);
  });
});
