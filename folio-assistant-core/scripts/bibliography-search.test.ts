import { describe, expect, test } from "bun:test";
import { buildSearchIndex, searchHtml, searchIndex, termShard, tokens, type SearchRecord } from "./bibliography-search.ts";

const rec = (k: string, c: string, y: number, s = 0): SearchRecord => ({ k, c, y, s, h: `sg/${k}/` });
const records: SearchRecord[] = [
  rec("a1", "World Health Organization. Malaria report", 2004),
  rec("a2", "Rapport sur l'épidémie mondiale de SIDA", 2004, 1),
  rec("a3", "Malaria vaccines: a review", 2019, 1),
  rec("a4", "世界卫生组织 疟疾报告", 2015),
];
const files = buildSearchIndex(records, ["refs", "library"], (r) => `${r.c} ${r.k} ${r.y}`);
const load = async (n: string) => {
  const t = files.get(n);
  if (t === undefined) throw new Error(`no ${n}`);
  return JSON.parse(t);
};

describe("tokens", () => {
  test("foldsCaseAndAccents", () => expect(tokens("Épidémie MONDIALE, de l'OMS")).toEqual(["epidemie", "mondiale", "de", "oms"]));
  test("readsHanAsPairs", () => expect(tokens("疟疾报告")).toEqual(["疟疾", "疾报", "报告"]));
});

describe("index and search", () => {
  test("filesAreCutAsTheManifestSays", () => {
    const m = JSON.parse(files.get("manifest.json")!);
    expect(m).toEqual({ v: 1, count: 4, refsPer: 100, termShards: 1, subgraphs: ["refs", "library"] });
    expect([...files.keys()].sort()).toEqual(["facets.json", "manifest.json", "refs-0.json", "terms-0.json"]);
    expect(termShard("malaria", 7)).toBe(termShard("mali", 7));
  });

  test("everyWordMatchesAsAPrefix", async () => {
    const r = await searchIndex("malar 2004", load);
    expect(r.hits.map((h) => h.k)).toEqual(["a1"]);
    expect((await searchIndex("epidémie", load)).hits.map((h) => h.k)).toEqual(["a2"]);
    expect((await searchIndex("疟疾", load)).hits.map((h) => h.k)).toEqual(["a4"]);
    expect((await searchIndex("nothing-here", load)).total).toBe(0);
  });

  test("countsBySubgraphAndDecade", async () => {
    const r = await searchIndex("malaria", load);
    expect(r.total).toBe(2);
    expect(r.bySubgraph).toEqual({ 0: 1, 1: 1 });
    expect(r.byDecade).toEqual({ 2000: 1, 2010: 1 });
    expect((await searchIndex("malaria", load, { scope: 1 })).hits.map((h) => h.k)).toEqual(["a3"]);
    expect((await searchIndex("malaria", load, { decade: 2000 })).hits.map((h) => h.k)).toEqual(["a1"]);
  });

  test("theBrowserRunsTheSameCode", async () => {
    // The page embeds these functions' own source: rebuilt from it, they still search.
    const html = searchHtml({ index: "search/", root: "" });
    for (const fn of [tokens, termShard, searchIndex]) expect(html).toContain(`var ${fn.name}=${fn.toString()};`);
    const make = new Function(`var tokens=${tokens.toString()};var termShard=${termShard.toString()};return ${searchIndex.toString()};`);
    const browserSearch = make() as typeof searchIndex;
    expect((await browserSearch("malaria", load)).hits.map((h) => h.k)).toEqual(["a1", "a3"]);
  });
});
