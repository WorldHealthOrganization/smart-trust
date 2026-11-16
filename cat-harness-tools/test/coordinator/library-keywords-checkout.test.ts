/**
 * The derived keywords graph over the checkout (cat-harness#1144): keywords
 * are extracted content, so they are built at publish into one
 * `folio-keywords/v2` node per entry, never written inside an entry, and each
 * node holds every variant side by side.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { KeywordsGraphSchema } from "../../schemas/library/library-keywords.ts";
import { KEYWORD_VARIANTS, keywordsGraphPath, keywordsGraphs } from "../../scripts/library-keywords.ts";
import { HARNESS_ROOT } from "../../scripts/lib/roots.ts";

describe("the derived keywords graph (cat-harness#1144)", () => {
  test("names the six variants, the surface log-entropy one first", () => {
    expect(KEYWORD_VARIANTS.map((v) => v.id)).toEqual([
      "lsi-log-entropy-surface",
      "lsi-tfidf-surface",
      "lsi-log-entropy-latent",
      "lsi-tfidf-latent",
      "lsi-log-entropy-latent-rerank",
      "ca-latent",
    ]);
  });

  const library = join(HARNESS_ROOT, "library");
  const graphs = existsSync(library) ? keywordsGraphs(library) : [];

  test("every node parses and carries every variant, for the document and each section", () => {
    expect(graphs.length).toBeGreaterThan(0);
    for (const g of graphs) {
      KeywordsGraphSchema.parse(g);
      for (const v of KEYWORD_VARIANTS) expect(g.document[v.id]).toBeDefined();
      for (const s of Object.values(g.sections)) for (const v of KEYWORD_VARIANTS) expect(s[v.id]).toBeDefined();
      expect(keywordsGraphPath(g)).toBe(`assets/keywords/${g.instance}/${encodeURIComponent(g.entry)}.jsonld`);
    }
  }, 120_000);

  test("nothing is written inside an entry", () => {
    const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [e.name]));
    if (existsSync(library)) expect(walk(library).filter((n) => n.endsWith(".jsonld") && n.includes("keywords"))).toEqual([]);
  });
});
