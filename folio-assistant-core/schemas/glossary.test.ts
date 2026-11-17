/**
 * folio-glossary/v1 and its SKOS: the three states hold, references resolve,
 * external concepts are linked and never copied, and the repository's own
 * glossary is valid and published.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

import { GlossarySchema, isFixedTranslation, licenceTerms, schemeIri, subjectOf, termIri, toSkos, translationStatusOf, type Glossary } from "./glossary.ts";
import {
  LETTER_PARTS,
  PAGE_KEYS,
  authoredKeys,
  pageKeysOf,
  rowsOn,
  budgetOf,
  partOfLabel,
  collect,
  counts,
  instanceNs,
  instanceOwners,
  ownerOfPath,
  repoPathOf,
  schemeOwner,
  outputs,
  pageOf,
  pagePath,
  permalinkOf,
  renderPages,
  linkTermCodes,
  ROUTE,
  LEGACY_ROUTE,
  localePagePath,
  termsOfSchema,
} from "../scripts/glossary-page.ts";
import {
  ASSET_TYPES,
  EXTRACTED_PREFIX,
  decodeXml,
  fold,
  localId,
  type AssetType,
} from "../scripts/glossary-extract.ts";
import { instanceRootsIn, readDeclaration } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.ts";
import { checkoutRootFor } from "../scripts/lib/checkout-root.ts";

const REPO_ROOT_FOR_NS = checkoutRootFor(resolve(import.meta.dir, ".."));
import { parseFrontMatter } from "@litlfred/cat-harness-tools/schemas/kg/front-matter.ts";
import { discoverTools } from "@litlfred/cat-harness-tools/tools/discover.ts";

// Owner, 2026-10-16 ("c"): the English pages sit under the page locale like
// every other visualiser's, `en/<harness>/<visualiser>/`, computed by the
// shared route helpers; the address without `en/` is only forwarded.
describe("the glossary's route", () => {
  test("englishUnderEnTranslationsUnderLocale", () => {
    expect(ROUTE).toBe("en/folio-assistant-core/glossary");
    expect(LEGACY_ROUTE).toBe("folio-assistant-core/glossary");
    expect(permalinkOf("index")).toBe("/en/folio-assistant-core/glossary/");
    expect(permalinkOf("@cat-harness")).toBe("/en/folio-assistant-core/glossary/instance/cat-harness/");
    expect(pagePath("index").split("\\").join("/")).toMatch(/\/en\/folio-assistant-core\/glossary\/index\.md$/);
    expect(pagePath("@who-iris").split("\\").join("/")).toMatch(/\/en\/folio-assistant-core\/glossary\/instance\/who-iris\/index\.md$/);
    expect(localePagePath("fr").split("\\").join("/")).toMatch(/\/fr\/folio-assistant-core\/glossary\/index\.md$/);
  });
});

const NS = "https://example.org/x/ns#";
function g(over: Record<string, unknown> = {}): unknown {
  return { $schema: "folio-glossary/v1", id: "s", title: "T", terms: [], ...over };
}
const ok = (v: unknown) => GlossarySchema.safeParse(v).success;
const term = (over: Record<string, unknown> = {}) => ({ id: "t", prefLabel: "t", status: "candidate", ...over });

describe("folio-glossary/v1", () => {
  test("authoredTermNeedsDefinition", () => {
    expect(ok(g({ terms: [term({ status: "authored" })] }))).toBe(false);
    expect(ok(g({ terms: [term({ status: "authored", definition: "d" })] }))).toBe(true);
    expect(ok(g({ terms: [term()] }))).toBe(true);
  });

  test("couldNotExtractSaysWhy", () => {
    expect(ok(g({ terms: [term({ status: "could-not-extract" })] }))).toBe(false);
    expect(ok(g({ terms: [term({ status: "could-not-extract", reason: "scanned page" })] }))).toBe(true);
  });

  test("matchIriBroaderLocalOrIri", () => {
    expect(ok(g({ terms: [term({ exactMatch: ["isco:2221"] })] }))).toBe(false);
    expect(ok(g({ terms: [term({ exactMatch: ["http://data.europa.eu/esco/isco/C2221"] })] }))).toBe(true);
    expect(ok(g({ terms: [term({ broader: ["nowhere"] })] }))).toBe(false);
    expect(ok(g({ terms: [term({ id: "a" }), term({ id: "b", broader: ["a"] })] }))).toBe(true);
  });

  test("uniqueIdsUnknownKeyRefused", () => {
    expect(ok(g({ terms: [term(), term()] }))).toBe(false);
    expect(ok(g({ terms: [term({ definiton: "typo" })] }))).toBe(false);
  });

  test("labelsPerLanguage", () => {
    expect(ok(g({ terms: [term({ prefLabel: { en: "nurse", fr: "infirmière" } })] }))).toBe(true);
  });
});

describe("SKOS", () => {
  const glossary = GlossarySchema.parse(
    g({
      terms: [
        term({ id: "a", status: "authored", definition: "A.", notation: "A1", exactMatch: ["http://ex.org/c/1"] }),
        term({ id: "b", broader: ["a"] }),
      ],
      members: ["http://ex.org/c/2"],
    }),
  ) as Glossary;
  const out = toSkos(glossary, NS) as { "@graph": Array<Record<string, unknown>> };
  const node = (id: string) => out["@graph"].find((n) => n["@id"] === id)!;

  test("skosSchemeAndConceptIris", () => {
    expect(node(`${NS}glossary/s`)["@type"]).toBe("skos:ConceptScheme");
    expect(node(`${NS}glossary/s/a`)["skos:inScheme"]).toEqual({ "@id": `${NS}glossary/s` });
  });

  test("externalConceptLinkedNotCopied", () => {
    expect(node(`${NS}glossary/s/a`)["skos:exactMatch"]).toEqual([{ "@id": "http://ex.org/c/1" }]);
    expect(out["@graph"].some((n) => n["@id"] === "http://ex.org/c/1")).toBe(false);
  });

  test("membersBecomeCollection", () => {
    expect(node(`${NS}glossary/s#members`)["skos:member"]).toEqual([{ "@id": "http://ex.org/c/2" }]);
  });

  test("localBroaderCandidateNote", () => {
    expect(node(`${NS}glossary/s/b`)["skos:broader"]).toEqual([{ "@id": `${NS}glossary/s/a` }]);
    expect(node(`${NS}glossary/s/b`)["skos:note"]).toBe("candidate");
    expect(node(`${NS}glossary/s/a`)["skos:notation"]).toBe("A1");
  });
});

describe("this repository", () => {
  const c = collect();

  test("everyGlossaryValidates", () => {
    expect(c.findings.invalid).toEqual([]);
    expect(c.glossaries.length).toBeGreaterThan(0);
  });

  test("swimlaneLedgersAreSource", () => {
    expect(c.ledgers.map((l) => l.instance).sort()).toEqual(["bootstrap", "cat-harness"]);
  });

  test("coreTermsInCoreNamespace", () => {
    const core = c.glossaries.find((s) => s.instance === "folio-assistant-core")!;
    // Its declaration now carries an iriBase (bean yn2k), so the namespace is
    // read through it, as every other layer's is below.
    const decl = readDeclaration(join(REPO_ROOT_FOR_NS, "folio-assistant-core"))!;
    expect(core.ns).toBe(instanceNs(decl.name, decl.stub, decl));
    expect(core.ns).toBe("https://litlfred.github.io/folio-assistant-core/v0/ns/");
  });

  test("everyTermOnceSkosPerScheme", () => {
    const pages = renderPages(c);
    const ids = [...pages.values()].flatMap((p) => [...p.matchAll(/<dt id="([^"]+)"/g)].map((m) => m[1]!));
    const terms = c.glossaries.flatMap((s) => s.glossary.terms);
    expect(ids.length).toBe(terms.length);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...outputs(c).keys()].filter((p) => p.endsWith(".skos.jsonld")).length).toBe(c.glossaries.length);
    // Renders every glossary page AND every SKOS file over the whole corpus,
    // so it grows with each schema added: it sat at bun's 5 s default and
    // crossed it on 2026-10-08 (6.5 s, #2505's new schema fields). The
    // budget is for the corpus, not a hang guard.
  }, 30_000);
});

/**
 * Owner, 2026-09-24: "Split per asset type". The index keeps the authored
 * terms, the counts and the sources; each asset type has a page of its own.
 */
describe("the glossary pages", () => {
  const c = collect();
  const pages = renderPages(c);
  const idsOn = (page: string) => [...page.matchAll(/<dt id="([^"]+)"/g)].map((m) => m[1]!);
  const idOf = (s: (typeof c.glossaries)[number], t: { id: string }) => `${s.instance}--${s.glossary.id}--${t.id}`;
  /** The page a term is on: its scheme's, or for a split type the part its label's first letter falls in. */
  const pageOfTerm = (s: (typeof c.glossaries)[number], t: { prefLabel: unknown }) => {
    const k = pageOf(s);
    if (k === "index" || !LETTER_PARTS[k as AssetType]) return k;
    const label = typeof t.prefLabel === "string" ? t.prefLabel : Object.values(t.prefLabel as Record<string, string>)[0]!;
    return `${k}/${partOfLabel(k as AssetType, label)}`;
  };
  /** A type's term-holding pages: itself, or its parts when it is split. */
  const pagesOfType = (t: AssetType) => (LETTER_PARTS[t] ? LETTER_PARTS[t]!.map((r) => `${t}/${r}`) : [t]);

  test("indexInstanceAndTypePages", () => {
    expect([...pages.keys()]).toEqual(pageKeysOf(c));
    expect(pageKeysOf(c)).toEqual(["index", ...authoredKeys(c), ...PAGE_KEYS.slice(1)]);
    expect(authoredKeys(c) as string[]).toEqual(
      [...new Set([...c.glossaries.filter((s) => !s.extracted).map((s) => s.instance), ...(c.declaring ?? [])])].sort().map((i) => `@${i}`),
    );
    expect([...PAGE_KEYS] as string[]).toEqual(["index", ...ASSET_TYPES.flatMap((t) => [t, ...(LETTER_PARTS[t] ?? []).map((r) => `${t}/${r}`)])]);
    const out = outputs(c);
    for (const k of pageKeysOf(c)) expect(out.get(pagePath(k))).toBe(pages.get(k)!);
    // `outputs` renders every page AND every SKOS file over the whole corpus:
    // the same budget, for the same reason, as the SKOS test above.
  }, 30_000);

  test("everyTermOnceOnItsPage", () => {
    const seen = new Map<string, string>();
    for (const [k, page] of pages) {
      for (const id of idsOn(page)) {
        expect(seen.has(id) ? `${id} on ${seen.get(id)} and ${k}` : "").toBe("");
        seen.set(id, k);
      }
    }
    const all = c.glossaries.flatMap((s) => s.glossary.terms.map((t) => ({ s, t })));
    expect(all.length).toBeGreaterThan(ASSET_TYPES.length); // vacuity guard
    expect(seen.size).toBe(all.length);
    for (const { s, t } of all) expect(seen.get(idOf(s, t))).toBe(pageOfTerm(s, t));
  });

  test("pagesHoldOnlyTheirTerms", () => {
    const n = counts(c);
    const index = pages.get("index")!;
    expect(idsOn(index)).toEqual([]);
    for (const k of authoredKeys(c)) {
      const page = pages.get(k)!;
      expect((page.match(/data-fa-state="extracted"/g) ?? []).length).toBe(0);
      expect(idsOn(page).length).toBe(c.glossaries.filter((s) => !s.extracted && s.instance === k.slice(1)).reduce((n, s) => n + s.glossary.terms.length, 0));
      expect(index).toContain(`{{ '${permalinkOf(k)}' | relative_url }}`);
      expect(page).toContain(`permalink: ${permalinkOf(k)}\n`);
    }
    for (const t of ASSET_TYPES) {
      const page = pagesOfType(t).map((k) => pages.get(k as never)!).join("\n");
      const want = c.glossaries.filter((s) => s.extracted === t).reduce((k, s) => k + s.glossary.terms.length, 0);
      expect(idsOn(page).length).toBe(want);
      expect((page.match(/data-fa-state="extracted"/g) ?? []).length).toBe(want);
      expect((page.match(/candidate, extracted<\/span>/g) ?? []).length).toBe(want);
    }
    expect(n.authored).toBeGreaterThan(0);
  });

  test("pagesWithinSizeBudget", () => {
    for (const [k, page] of pages) {
      const bytes = Buffer.byteLength(page, "utf-8");
      expect(`${k} ${bytes <= budgetOf(k) ? "within" : `over: ${bytes} > ${budgetOf(k)}`}`).toBe(`${k} within`);
      // A split type's landing page holds no terms, so it states no load cost.
      if (k !== "index" && LETTER_PARTS[k as AssetType]) continue;
      expect(page).toMatch(/is [0-9.]+ (MB|KB) before compression, (fetched in one request, )?within its budget of [0-9.]+ (MB|KB)/);
    }
    // The budgets are what the split was for: the index stays small, and no
    // type's page is fetched at the size the single page had (1.4 MB).
    expect(budgetOf("index")).toBeLessThanOrEqual(64 * 1024);
    for (const t of ASSET_TYPES) expect(budgetOf(t)).toBeLessThan(1.4 * 1024 * 1024);
  });

  test("indexAndTypePagesLinked", () => {
    const index = pages.get("index")!;
    for (const t of ASSET_TYPES) {
      expect(index).toContain(`{{ '${permalinkOf(t)}' | relative_url }}`);
      const page = pages.get(t)!;
      expect(page).toContain(`permalink: ${permalinkOf(t)}\n`);
      expect(page).toContain("parent: Glossary\n");
      expect(page).toContain(`{{ '${permalinkOf("index")}' | relative_url }}`);
    }
    expect(index).toContain("has_children: true\n");
  });

  test("splitTypeLinksResolve", () => {
    for (const t of ASSET_TYPES.filter((x) => LETTER_PARTS[x])) {
      const parts = pagesOfType(t);
      const anchors = new Map(parts.map((k) => [k, new Set(idsOn(pages.get(k as never)!))] as const));
      let links = 0;
      for (const k of parts) {
        for (const m of pages.get(k as never)!.matchAll(/<a href="\{\{ '\/glossary\/[^']+\/([a-z]-[a-z])\/' \| relative_url \}\}#([^"]+)">/g)) {
          links++;
          expect(`${m[2]} on ${m[1]}: ${anchors.get(`${t}/${m[1]}`)?.has(m[2]!) ?? "no such part"}`).toBe(`${m[2]} on ${m[1]}: true`);
        }
        // No bare same-page anchor survives on a split type: it would break for a target on another part.
        expect(pages.get(k as never)!.match(/<a href="#[^"]*--[^"]*--[^"]*">/g) ?? []).toEqual([]);
      }
      // The real schema-field definitions carry no same-scheme term codes
      // today, so `links` may be 0 here; the synthetic test below proves the
      // cross-part href itself.
      expect(links).toBeGreaterThanOrEqual(0);
    }
  });

  test("splitTypeCodeLinksToPart", () => {
    const s = {
      instance: "i",
      extracted: "kg-schema-fields",
      glossary: { id: "g", terms: [{ id: "a", prefLabel: "alpha" }, { id: "z", prefLabel: "zeta" }] },
    } as unknown as Parameters<typeof linkTermCodes>[0];
    expect(linkTermCodes(s, "a", "<code>z</code>")).toBe(
      `<a href="{{ '${permalinkOf("kg-schema-fields/t-z" as never)}' | relative_url }}#i--g--z"><code>z</code></a>`,
    );
  });

  test("pagesKeepFilterAndLetters", () => {
    for (const [k, page] of pages) {
      if (!idsOn(page).length) continue;
      // A page whose every term is in an ordered scheme (bootstrap's) lists
      // them in their own order: there is no A–Z list for a bar to jump in.
      const az = idsOn(page).length > (page.match(/<span class="fa-gloss-n">/g) ?? []).length;
      expect(`${k}: ${page.includes('id="fa-gloss-q"') && (!az || page.includes('<nav aria-label="Letters">'))}`).toBe(`${k}: true`);
    }
  });
});

/**
 * Bean `lqo9`, piece 1 as posed: every KG asset with a title and a
 * description, extracted as `candidate` terms. These run over the REAL
 * repository, and every count is guarded against zero first: "every extracted
 * term is a candidate" passes perfectly over no terms (`6tkl`).
 */
describe("extracted KG terms", () => {
  const c = collect();
  const REPO = checkoutRootFor(resolve(import.meta.dir, ".."));
  const extracted = c.glossaries.filter((s) => s.extracted);
  const terms = extracted.flatMap((s) => s.glossary.terms.map((t) => ({ s, t })));
  const pathOf = (src: string) => src.split("#", 2)[0]!;
  const anchorOf = (src: string) => src.split("#", 2)[1];
  // The pages, rendered once for this block, as `collect()` above is: a
  // render takes seconds, and a test rendering its own pushed it past bun's
  // 5 s per-test limit on CI (5098-5140 ms, folio-assistant run 41358487974).
  const rendered = renderPages(c);

  test("eachTypeAboveFloor", () => {
    const floors: Record<AssetType, number> = {
      "kg-skills": 200,
      "kg-tools": 80,
      "kg-bpmn-activities": 400,
      "kg-dmn-decisions": 5,
      "kg-schema-fields": 1000,
    };
    for (const type of ASSET_TYPES) {
      const n = extracted.filter((s) => s.extracted === type).reduce((k, s) => k + s.glossary.terms.length, 0);
      expect({ type, atLeast: n >= floors[type] }).toEqual({ type, atLeast: true });
    }
  });

  test("extractedTermsAreSourcedCandidates", () => {
    expect(terms.length).toBeGreaterThan(0);
    const bad = terms.filter(({ t }) => t.status !== "candidate" || !t.source || !existsSync(join(REPO, pathOf(t.source))));
    expect(bad.map(({ t }) => t.source)).toEqual([]);
  });

  test("anchorNamesElementInFile", () => {
    const anchored = terms.filter(({ s, t }) => s.extracted !== "kg-skills" && anchorOf(t.source!));
    expect(anchored.length).toBeGreaterThan(0);
    const text = new Map<string, string>();
    const read = (p: string) => text.get(p) ?? (text.set(p, readFileSync(join(REPO, p), "utf-8")), text.get(p)!);
    const missing = anchored.filter(({ s, t }) => {
      const body = read(pathOf(t.source!));
      const a = anchorOf(t.source!)!;
      if (s.extracted === "kg-schema-fields") {
        const [decl, field] = a.split(/\.(.*)/s) as [string, string];
        return !body.includes(decl) || !body.includes(field);
      }
      if (s.extracted === "kg-tools") return !body.includes(`"${a}"`);
      return !body.includes(`id="${a}"`);
    });
    expect(missing.map(({ t }) => t.source)).toEqual([]);
  });

  test("definitionsVerbatimInAsset", () => {
    const withDef = terms.filter(({ t }) => t.definition);
    expect(withDef.length).toBeGreaterThan(1000);
    const tools = new Map(discoverTools(REPO).tools.map((t) => [t.id, t]));
    // The asset's text as a reader of the file would read it: XML entities
    // decoded, JSDoc line markers dropped, whitespace folded. Nothing else,
    // so a paraphrase, a summary or a completed sentence fails.
    const asRead = (p: string) =>
      fold(
        decodeXml(readFileSync(join(REPO, p), "utf-8"))
          .split("\n")
          .map((l) => l.replace(/^\s*(?:\/\*\*+|\*+\/?|\/\/)\s?/, ""))
          .join("\n"),
      );
    const cache = new Map<string, string>();
    const bad = withDef.filter(({ s, t }) => {
      const d = t.definition as string;
      // A Tool is a node, not a file: its description may be a concatenated
      // literal, so the verbatim check is against the node itself.
      if (s.extracted === "kg-tools") return fold(tools.get(t.notation!)?.description ?? "") !== d;
      if (s.extracted === "kg-skills") {
        const fm = parseFrontMatter(readFileSync(join(REPO, t.source!), "utf-8")).fm;
        return fold(String(fm.description ?? "")) !== d;
      }
      const p = pathOf(t.source!);
      if (!cache.has(p)) cache.set(p, asRead(p));
      if (cache.get(p)!.includes(d)) return false;
      // A callActivity naming one of its layer's global tasks takes the global
      // task's definition first (checked verbatim against its own asset via the
      // `globaltask.*` term) and the call's own documentation after.
      if (s.extracted === "kg-bpmn-activities" && !t.id.startsWith("globaltask.")) {
        const gts = s.glossary.terms
          .filter((g) => g.id.startsWith("globaltask."))
          .map((g) => g.definition)
          .filter((gd): gd is string => typeof gd === "string" && gd.length > 0);
        if (
          gts.some(
            (gd) => d === gd || (d.startsWith(`${gd} `) && cache.get(p)!.includes(d.slice(gd.length + 1))),
          )
        ) {
          return false;
        }
      }
      return true;
    });
    expect(bad.map(({ t }) => `${t.source}: ${t.definition}`)).toEqual([]);
  });

  test("dmnNotDefinedByRule", () => {
    const dmn = terms.filter(({ s }) => s.extracted === "kg-dmn-decisions");
    expect(dmn.length).toBeGreaterThan(0);
    for (const { t } of dmn) {
      const xml = readFileSync(join(REPO, pathOf(t.source!)), "utf-8");
      const rules = [...xml.matchAll(/<rule\b[\s\S]*?<\/rule>/g)].flatMap((r) =>
        [...r[0].matchAll(/<description>([\s\S]*?)<\/description>/g)].map((m) => fold(decodeXml(m[1]!))),
      );
      if (t.definition) expect(rules).not.toContain(t.definition);
    }
  });

  test("noTwoTermsMintOneIri", () => {
    const iris = c.glossaries.flatMap((s) => s.glossary.terms.map((t) => termIri(s.ns, s.glossary, t.id)));
    expect(iris.length).toBeGreaterThan(2000);
    expect(new Set(iris).size).toBe(iris.length);
    expect(c.findings.invalid).toEqual([]);
  });

  test("extractedIriInHoldersNamespace", () => {
    for (const s of extracted) {
      const decl = instanceRootsIn(REPO)
        .map((r) => ({ r, d: readDeclaration(r) }))
        .find(({ d }) => d?.name === s.instance)!;
      expect(s.ns).toBe(instanceNs(decl.d!.name, decl.d!.stub, decl.d!));
      const rel = relative(REPO, decl.r).split("\\").join("/");
      for (const t of s.glossary.terms) expect(t.source!.startsWith(`${rel}/`)).toBe(true);
    }
  });

  test("rolesAndLanesNotReextracted", () => {
    expect(c.ledgers.reduce((k, l) => k + l.terms, 0)).toBeGreaterThan(0);
    const types = new Set(extracted.map((s) => s.extracted));
    expect([...types].sort()).toEqual([...ASSET_TYPES].sort());
    // No term comes from the role registry or from a lane element.
    expect(terms.filter(({ t }) => /(^|\/)roles\.json(#|$)/.test(t.source!))).toEqual([]);
    const lanes = new Map<string, Set<string>>();
    const laneIds = (p: string) =>
      lanes.get(p) ??
      (lanes.set(p, new Set([...readFileSync(join(REPO, p), "utf-8").matchAll(/<(?:bpmn:)?lane\b[^>]*\sid="([^"]+)"/g)].map((m) => m[1]!))),
      lanes.get(p)!);
    const fromLanes = terms.filter(({ t }) => pathOf(t.source!).endsWith(".bpmn") && laneIds(pathOf(t.source!)).has(anchorOf(t.source!)!));
    expect(fromLanes.map(({ t }) => t.source)).toEqual([]);
    expect(rendered.get("index")).toContain("auto-docs/glossary/swimlane-glossary/");
  });

  test("pagesTellExtractedFromAuthored", () => {
    const pages = rendered;
    const all = [...pages.values()].join("\n");
    const n = counts(c);
    expect(n.extracted).toBe(terms.length);
    expect((all.match(/data-fa-state="extracted"/g) ?? []).length).toBe(n.extracted);
    expect((all.match(/data-fa-state="authored"/g) ?? []).length).toBe(n.authored);
    expect((all.match(/candidate, extracted<\/span>/g) ?? []).length).toBe(n.extracted);
    // Each layer's authored page carries the DefinedTermSet of its own
    // authored terms, and no other page carries one.
    const ldOf = (page: string) =>
      (JSON.parse(/<script type="application\/ld\+json">\n([\s\S]*?)\n<\/script>/.exec(page)![1]!) as { hasDefinedTerm: unknown[] }).hasDefinedTerm.length;
    const authored = authoredKeys(c);
    expect(authored.reduce((k, a) => k + ldOf(pages.get(a)!), 0)).toBe(n.authored);
    expect(all.match(/<script type="application\/ld\+json">/g)?.length).toBe(authored.length);
    // Each page states its term count and size, which is how a reader learns
    // the load cost before scrolling.
    for (const a of authored) expect(pages.get(a)!).toMatch(new RegExp(`holds ${rowsOn(c, a).length} terms and is [0-9.]+ (MB|KB) before compression`));
    for (const t of ASSET_TYPES) {
      const k = extracted.filter((s) => s.extracted === t).reduce((m, s) => m + s.glossary.terms.length, 0);
      const parts = LETTER_PARTS[t];
      if (!parts) {
        expect(pages.get(t)!).toMatch(new RegExp(`holds ${k} terms and is [0-9.]+ (MB|KB) before compression`));
        continue;
      }
      // A split type states each part's count, and the parts add up to the type.
      const held = parts.map((r) => Number(/holds (\d+) terms and is/.exec(pages.get(`${t}/${r}` as never)!)?.[1] ?? NaN));
      expect(held.reduce((a, b) => a + b, 0)).toBe(k);
    }
  });

  test("extractedWrittenUnderGenerated", () => {
    const files = [...outputs(c).keys()].map((p) => relative(REPO, p).split("\\").join("/"));
    const gen = files.filter((p) => p.endsWith(".glossary.json"));
    expect(gen.length).toBe(extracted.length);
    for (const p of gen) {
      expect(p).toMatch(/\/glossary\/generated\/[^/]+\/[^/]+\.glossary\.json$/);
      expect(c.declaring).toContain(p.split("/")[0]!);
    }
    for (const s of c.glossaries.filter((x) => !x.extracted)) expect(gen).not.toContain(s.file);
    // `outputs` over the whole corpus: measured 5.3-5.8 s on 2026-10-09,
    // over bun's 5 s default. A corpus budget, as above, not a hang guard.
  }, 30_000);

  test("authoredNotExtractedPrefix", () => {
    expect(c.glossaries.filter((s) => !s.extracted && s.glossary.id.startsWith(EXTRACTED_PREFIX))).toEqual([]);
  });
});

describe("extraction helpers", () => {
  test("localIdKeepsAtIdApart", () => {
    expect(localId("x.X.@id")).not.toBe(localId("x.X.id"));
    expect(localId("@id")).not.toBe(localId("id"));
    for (const k of ["Process_A.Task_B", "graph.GraphSchema.$schema", "x.Y.@context", "  weird  key!"]) {
      expect(ok(g({ terms: [term({ id: localId(k) })] }))).toBe(true);
    }
  });

  test("xmlDecodingOnce", () => {
    expect(decodeXml("a &amp;lt; b &#183; &#x41; <![CDATA[c]]>")).toBe("a &lt; b · A c");
  });
});

/**
 * Owner, 2026-09-24: *"make sure all glossary terms properly localed to ihris
 * so [no] collision w/ other subgraphs. general rule/skill"*. A term lives in
 * the namespace of the layer that owns its source asset, never of whichever
 * layer happens to declare the `glossary/` directory. Each check below runs
 * over the REAL repository and works its answer out independently of
 * `collect()`: the layer holding a path is found here by walking the
 * declared roots, not by calling the code under test.
 */
describe("every term in the namespace of the instance that owns its source", () => {
  const REPO = checkoutRootFor(resolve(import.meta.dir, ".."));
  const c = collect();
  // Independent: every declared root, longest first.
  const roots = instanceRootsIn(REPO)
    .map((r) => ({ root: resolve(r), decl: readDeclaration(r)! }))
    .filter((r) => r.decl)
    .sort((a, b) => b.root.length - a.root.length);
  const nsOfName = new Map(roots.map((r) => [r.decl.name, instanceNs(r.decl.name, r.decl.stub, r.decl)] as const));
  const holder = (path: string) => {
    const p = resolve(REPO, path);
    return roots.find((r) => p === r.root || p.startsWith(`${r.root}/`))?.decl.name;
  };
  // A repository path is one that exists; a scheme's dcterms:source may be prose.
  const isPath = (src?: string) =>
    !!src && !/^[a-z][a-z0-9+.-]*:\/\//i.test(src) && existsSync(resolve(REPO, src.split("#", 2)[0]!));

  test("noTwoSchemesOneIri", () => {
    expect(c.findings.invalid.filter((f) => f.includes("collision"))).toEqual([]);
    const iris = c.glossaries.map((s) => schemeIri(s.ns, s.glossary));
    expect(iris.length).toBeGreaterThan(ASSET_TYPES.length); // vacuity guard
    expect(iris.filter((x, i) => iris.indexOf(x) !== i)).toEqual([]);
  });

  test("noTwoInstancesOneNamespace", () => {
    const all = [...nsOfName.values()];
    expect(all.length).toBeGreaterThan(1); // vacuity guard
    expect(all.filter((x, i) => all.indexOf(x) !== i)).toEqual([]);
  });

  test("termMintedInOwnersNamespace", () => {
    const wrong: string[] = [];
    let checked = 0;
    let authored = 0;
    for (const s of c.glossaries) {
      // A scheme whose own source is a repository path is DEFINED by that
      // layer, and a term contributed from elsewhere (a code list extended
      // by another package) is still the defining layer's.
      const defining = isPath(s.glossary.source) ? holder(s.glossary.source!.split("#", 2)[0]!) : undefined;
      for (const t of s.glossary.terms) {
        if (!isPath(t.source)) continue;
        const owner = defining ?? holder(t.source!.split("#", 2)[0]!);
        const ns = owner ? nsOfName.get(owner) : undefined;
        checked++;
        if (!s.extracted) authored++;
        const iri = termIri(s.ns, s.glossary, t.id);
        if (!ns || !iri.startsWith(ns)) wrong.push(`${iri} (source ${t.source}, owner ${owner ?? "none"})`);
      }
    }
    expect(checked).toBeGreaterThan(1000); // vacuity guard: extracted terms
    expect(authored).toBeGreaterThan(0); // and authored ones, which are what the rule added
    expect(wrong).toEqual([]);
  });

  test("multiInstanceSchemeRefused", () => {
    const owners = instanceOwners(REPO);
    const g = (over: Record<string, unknown>) => GlossarySchema.parse({ $schema: "folio-glossary/v1", id: "x", title: "X", ...over });
    const mixed = g({
      terms: [
        { id: "a", prefLabel: "a", status: "candidate", source: "cat-harness-tools/schemas/content/odrl.ts" },
        { id: "b", prefLabel: "b", status: "candidate", source: "folio-assistant-core/schemas/glossary.ts" },
      ],
    });
    expect("error" in schemeOwner(REPO, mixed, "folio-assistant-core", owners)).toBe(true);
    // The code-list case: the scheme names the layer that DEFINES it.
    expect(schemeOwner(REPO, { ...mixed, source: "cat-harness-tools/schemas/content/odrl.ts" }, "folio-assistant-core", owners)).toEqual({ owner: "cat-harness-tools" });
    // One layer holds every source: that layer, not the declaring one.
    expect(schemeOwner(REPO, g({ terms: [mixed.terms[0]] }), "folio-assistant-core", owners)).toEqual({ owner: "cat-harness-tools" });
    // No repository source at all: the layer whose directory holds the file.
    expect(schemeOwner(REPO, g({ terms: [] }), "folio-assistant-core", owners)).toEqual({ owner: "folio-assistant-core" });
    // A sub-layer, never the root, holds a path inside it.
    expect(ownerOfPath(REPO, "cat-harness-tools/schemas/content/odrl.ts", owners)).toBe("cat-harness-tools");
    // A path at the index root is held by NO layer. This read
    // `.toBe("folio-assistant")` while the root declared that layer; the
    // separation removed the declaration (folio-assistant@3d4caf6e0f) and
    // the root is now an index of mounts, so a root file has no owner and a
    // scheme sourced there is refused ("in no instance") rather than credited.
    expect(ownerOfPath(REPO, "package.json", owners)).toBeUndefined();
    expect(repoPathOf("https://example.org/x#y", REPO)).toBeUndefined();
    expect(repoPathOf("Skills of cat-harness", REPO)).toBeUndefined();
    expect(repoPathOf("cat-harness-tools/schemas/content/odrl.ts#Policy", REPO)).toBe("cat-harness-tools/schemas/content/odrl.ts");
  });
});


describe("an ordered glossary (owner, 2026-09-29: logical, not alphabetical)", () => {
  const term = (id: string, requires?: string[]) => ({
    id,
    prefLabel: id,
    definition: `about ${id}`,
    status: "authored" as const,
    ...(requires ? { requires } : {}),
  });
  const g = (terms: unknown[], ordered = true) =>
    GlossarySchema.safeParse({ $schema: "folio-glossary/v1", id: "t", title: "T", ordered, terms });

  test("requiresOnlyEarlierTerms", () => {
    expect(g([term("a"), term("b", ["a"])]).success).toBe(true);
    expect(g([term("a", ["b"]), term("b")]).success).toBe(false); // forward
    expect(g([term("a", ["a"])]).success).toBe(false); // self
    expect(g([term("a", ["zz"])]).success).toBe(false); // missing
    expect(g([term("a", ["b"]), term("b")], false).success).toBe(true); // unordered: forward allowed
  });

  test("skosOrderedCollection", () => {
    const parsed = GlossarySchema.parse({
      $schema: "folio-glossary/v1",
      id: "t",
      title: "T",
      ordered: true,
      terms: [term("a"), term("b", ["a"])],
    });
    const graph = toSkos(parsed, "https://example.org/ns#")["@graph"] as Record<string, unknown>[];
    const order = graph.find((n) => n["@type"] === "skos:OrderedCollection")!;
    expect((order["skos:memberList"] as { "@list": { "@id": string }[] })["@list"].map((m) => m["@id"])).toEqual([
      "https://example.org/ns#glossary/t/a",
      "https://example.org/ns#glossary/t/b",
    ]);
    const b = graph.find((n) => n["@id"] === "https://example.org/ns#glossary/t/b")!;
    expect(b["dcterms:requires"]).toEqual([{ "@id": "https://example.org/ns#glossary/t/a" }]);
  });

  test("bootstrapTermsOrderedFromSchema", () => {
    const c = collect();
    const boot = c.glossaries.find((s) => s.instance === "bootstrap" && s.glossary.ordered)!;
    expect(boot.file).toBe("bootstrap/schemas/graph.schema.json");
    expect(boot.glossary.terms.every((t) => t.status === "authored")).toBe(true);
    const schema = JSON.parse(readFileSync(join(import.meta.dir, "..", "..", boot.file), "utf-8")) as { $defs: Record<string, unknown> };
    expect(boot.glossary.terms.map((t) => t.prefLabel)).toEqual(
      Object.keys(schema.$defs).map((k) => k.replace(/([a-z])([A-Z])/g, "$1 $2")),
    );
  });
});

describe("a description naming another term links to it (bean qgjh)", () => {
  const c = collect();
  const pages = renderPages(c);

  test("inPageLinksLand", () => {
    for (const [k, page] of pages) {
      const ids = new Set([...page.matchAll(/<dt id="([^"]+)"/g)].map((m) => m[1]!));
      for (const m of page.matchAll(/<a href="#([^"]+--[^"]+--[^"]+)"><code>/g)) {
        expect(ids.has(m[1]!) ? "" : `${k}: #${m[1]} has no entry`).toBe("");
      }
    }
  });

  test("onlySameSchemeIdLinks", () => {
    const s = { instance: "i", glossary: { id: "g", terms: [{ id: "a" }, { id: "b" }] } } as unknown as Parameters<
      typeof linkTermCodes
    >[0];
    expect(linkTermCodes(s, "a", "<code>a</code> <code>b</code> <code>c</code>")).toBe(
      '<code>a</code> <a href="#i--g--b"><code>b</code></a> <code>c</code>',
    );
  });
});

describe("D4: a glossary's licence comes from the licence-naming row (bean gzkt)", () => {
  test("licenceAsDctermsLicense", () => {
    expect(licenceTerms("CC0-1.0")).toEqual({ "dcterms:license": "CC0-1.0" });
  });

  test("noLicenceNothingWritten", () => {
    expect(licenceTerms(undefined)).toEqual({});
  });
});

describe("scoped fixed terms: subject area and translation status (owner, 2026-11-07)", () => {
  const base = {
    $schema: "folio-glossary/v1",
    id: "s",
    title: "S",
    subject: "harness-vocabulary",
    terms: [
      { id: "policy", prefLabel: "policy", definition: "d", status: "authored", translationStatus: { fr: "official" } },
      { id: "role", prefLabel: "role", definition: "d", status: "authored", subject: "process-modelling" },
      { id: "draft", prefLabel: "draft", status: "candidate" },
    ],
  };

  test("subjectOverridesScheme", () => {
    const g = GlossarySchema.parse(base);
    expect(subjectOf(g, g.terms[0]!)).toBe("harness-vocabulary");
    expect(subjectOf(g, g.terms[1]!)).toBe("process-modelling");
    expect(subjectOf({}, {})).toBeUndefined();
  });

  test("subjectIsLocalId", () => {
    expect(GlossarySchema.safeParse({ ...base, subject: "Harness vocabulary" }).success).toBe(false);
  });

  test("translationStatusPerLocale", () => {
    const g = GlossarySchema.parse(base);
    expect(translationStatusOf(g.terms[0]!, "fr")).toBe("official");
    expect(translationStatusOf(g.terms[0]!, "zh")).toBe("unofficial");
    const bad = structuredClone(base);
    (bad.terms[0] as Record<string, unknown>).translationStatus = { fr: "signed" };
    expect(GlossarySchema.safeParse(bad).success).toBe(false);
  });

  test("fixedTranslationFromCatalogue", () => {
    const g = GlossarySchema.parse(base);
    expect(isFixedTranslation(g.terms[0]!, "politique")).toBe(true);
    expect(isFixedTranslation(g.terms[0]!, "")).toBe(false);
    expect(isFixedTranslation(g.terms[0]!, undefined)).toBe(false);
    expect(isFixedTranslation(g.terms[0]!, "politique", true)).toBe(false);
    expect(isFixedTranslation(g.terms[2]!, "brouillon")).toBe(false);
  });

  test("subjectPublishedAsDctermsSubject", () => {
    const sk = toSkos(GlossarySchema.parse(base), "https://example.org/ns/") as { "@graph": Record<string, unknown>[] };
    const nodes = sk["@graph"];
    expect(nodes.find((n) => n["@type"] === "skos:ConceptScheme")!["dcterms:subject"]).toBe("harness-vocabulary");
    const role = nodes.find((n) => String(n["@id"]).endsWith("/role"))!;
    expect(role["dcterms:subject"]).toBe("process-modelling");
    const policy = nodes.find((n) => String(n["@id"]).endsWith("/policy"))!;
    expect(policy["dcterms:subject"]).toBeUndefined();
  });
});

describe(`a schema's terms take the subject area the schema publishes (owner, 2026-11-07: "do it in the schema")`, () => {
  const schema = (extra: Record<string, unknown>) => {
    const f = join(mkdtempSync(join(tmpdir(), "terms-")), "graph.schema.json");
    writeFileSync(f, JSON.stringify({ $id: "https://example.org/graph.schema.json", ...extra, $defs: { Node: { description: "A file.", uses: [] } } }));
    return f;
  };

  test("subjectReadFromSchema", () => {
    const g = termsOfSchema(schema({ subject: "harness-vocabulary" }), "schemas/graph.schema.json", { name: "bootstrap" });
    expect(g?.subject).toBe("harness-vocabulary");
    expect(GlossarySchema.safeParse(g).success).toBe(true);
  });

  test("noSchemaSubjectNoSchemeSubject", () => {
    expect(termsOfSchema(schema({}), "schemas/graph.schema.json", { name: "bootstrap" })?.subject).toBeUndefined();
  });
});
