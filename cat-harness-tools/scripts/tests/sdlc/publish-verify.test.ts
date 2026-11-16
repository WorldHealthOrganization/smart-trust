/**
 * The pre-deployment verifier set — bean `vigi`.
 *
 * Falsified, not assumed: each property is asserted on a document built to
 * break it, beside the real generated documents that must pass.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import jsonld from "jsonld";

import { CONTENT_CONTEXT_URL } from "../../../schemas/kg/jsonld.ts";
import { CAT_HARNESS_NS } from "../../../schemas/kg/namespaces.ts";
import { buildFshGutsExport } from "../../fsh-guts-export";
import { buildGlossary } from "../../glossary-export";
import { buildVocabulary } from "../../ns-export";
import { codeListDirs, loadCodeLists } from "../../../schemas/library/code-list.ts";
import { buildCodeListsDoc } from "../../code-lists";
import { PROV_JSONLD_CONTEXT_URL } from "../../../schemas/kg/prov-jsonld.ts";
import { SCOPES_DIR, render, stableKeys } from "../../search-split.ts";
import { siteDirFor } from "../../../schemas/kg/cat-harness.ts";
import { HTML_UNIQUE_IDS, JSONLD_EXPAND, JSONLD_OBJECT_LINKS, JSONLD_OWN_BASE, SEARCH_EXCLUDE_MARKER, SEARCH_INDEX, SEARCH_INDEX_PATH, SEARCH_SCOPES, VERIFIERS, declaredBase, expandFindings, isOurs, localLoader, verify } from "../../publish-verify";
import { HARNESS_ROOT } from "../../lib/roots.ts";

const site = (files: Record<string, unknown>): string => {
  const dir = mkdtempSync(join(tmpdir(), "publish-verify-"));
  for (const [p, doc] of Object.entries(files)) {
    mkdirSync(join(dir, p, ".."), { recursive: true });
    writeFileSync(join(dir, p), typeof doc === "string" ? doc : JSON.stringify(doc));
  }
  return dir;
};
// One verifier at a time: a tree holding only JSON-LD is "could not tell" for
// the HTML check, which is right for a deploy and noise for these cases.
const JSONLD = [JSONLD_EXPAND];
const ours = (extra: Record<string, unknown> = {}) => ({
  "@context": { cat: CAT_HARNESS_NS, label: "http://www.w3.org/2000/01/rdf-schema#label" },
  "@id": "https://litlfred.github.io/folio-assistant/x.jsonld",
  label: "x",
  ...extra,
});

describe("the JSON-LD verifier", () => {
  test("a clean document of ours passes", async () => {
    const { exit, results } = await verify(site({ "a.jsonld": ours() }), JSONLD);
    expect(exit).toBe(0);
    expect(results[0]!.checked).toBe(1);
  });

  test("FAILS on a key the context does not declare — the property a processor silently drops", async () => {
    const { exit, results } = await verify(site({ "a.jsonld": ours({ layer: "harness" }) }), JSONLD);
    expect(exit).toBe(1);
    expect(results[0]!.findings[0]!.detail).toMatch(/invalid property \(layer\)/);
  });

  test("FAILS on a context it would have to fetch from the network", async () => {
    const doc = { "@context": [`https://example.org/ctx.jsonld`, { cat: CAT_HARNESS_NS }], "@id": "urn:x", "cat:a": 1 };
    const { exit } = await verify(site({ "a.jsonld": doc }), JSONLD);
    expect(exit).toBe(1);
  });

  test("third-party documents are counted, never verified, never blocking", async () => {
    const who = { "@context": { v: "http://smart.who.int/x/" }, "@id": "#relative", "v:a": 1 };
    const { exit, results } = await verify(site({ "a.jsonld": ours(), "who/b.jsonld": who }), JSONLD);
    expect(exit).toBe(0);
    expect(results[0]!.outOfScope).toBe(1);
    expect(isOurs(who)).toBe(false);
  });

  test("nothing to verify is COULD NOT TELL, not a pass", async () => {
    const { exit, results } = await verify(site({}));
    expect(exit).toBe(2);
    expect(results[0]!.couldNotTell).toBeDefined();
  });
});

describe("the unique-id verifier — bean uknu", () => {
  const page = (body: string) => `<!doctype html><html><body>${body}</body></html>`;

  test("a page declaring each id once passes", async () => {
    const { exit, results } = await verify(site({ "a.html": page('<h2 id="x">X</h2><a href="#x">x</a>') }), [HTML_UNIQUE_IDS]);
    expect(exit).toBe(0);
    expect(results[0]!.checked).toBe(1);
  });

  test("FAILS on the defect that was shipped: the nav checkbox rendered twice", async () => {
    const box = '<input type="checkbox" class="fa-nav-open" id="fa-nav-open">';
    const { exit, results } = await verify(site({ "p/a.html": page(box + box) }), [HTML_UNIQUE_IDS]);
    expect(exit).toBe(1);
    expect(results[0]!.findings).toEqual([{ verifier: "html-unique-ids", file: "p/a.html", detail: "duplicate id fa-nav-open ×2" }]);
  });

  test("...and names the page and every id it repeats", async () => {
    const { results } = await verify(site({ "x.html": page('<h3 id="hl7-fhir">HL7 FHIR</h3><p><a id="hl7-fhir"></a></p>') }), [HTML_UNIQUE_IDS]);
    expect(results[0]!.findings.map((f) => f.detail)).toEqual(["duplicate id hl7-fhir ×2"]);
  });
  // The scanner's own edge cases (code samples, script bodies, quote styles)
  // are `duplicate-ids.test.ts`'s; this file owns only the verifier around it.
});

describe("the search-index verifier — bean fq5u", () => {
  const boxed = '<!doctype html><html><body><input id="search-input" type="text"></body></html>';
  const entry = (relUrl: string) => ({ doc: "d", title: "t", content: "c", url: `/base${relUrl}`, relUrl });
  const run = (files: Record<string, unknown>, searchIndex?: "built" | "borrowed") =>
    verify(site(files), [SEARCH_INDEX], { bases: [], ...(searchIndex ? { searchIndex } : {}) });

  test("an index covering every search-box page passes", async () => {
    const { exit } = await run({ "a.html": boxed, "b/index.html": boxed, [SEARCH_INDEX_PATH]: { 0: entry("/a.html"), 1: entry("/b/#h"), 2: entry("/b/") } });
    expect(exit).toBe(0);
  });

  test("MISSING, EMPTY and NOT JSON each fail — the defect that would have shipped green", async () => {
    for (const idx of [undefined, {}, "not json"]) {
      const files: Record<string, unknown> = { "a.html": boxed };
      if (idx !== undefined) files[SEARCH_INDEX_PATH] = idx;
      const { exit, results } = await run(files);
      expect(exit).toBe(1);
      expect(results[0]!.findings).toHaveLength(1);
    }
  });

  test("an indexed page that is not in the tree is a finding", async () => {
    const { exit, results } = await run({ "a.html": boxed, [SEARCH_INDEX_PATH]: { 0: entry("/a.html"), 1: entry("/gone.html") } });
    expect(exit).toBe(1);
    expect(results[0]!.findings.map((f) => f.detail)).toEqual(["indexes /gone.html, which is not in the tree"]);
  });

  test("an index far below the search-box page count is truncated", async () => {
    const files: Record<string, unknown> = { [SEARCH_INDEX_PATH]: { 0: entry("/p0.html") } };
    for (let i = 0; i < 4; i++) files[`p${i}.html`] = boxed;
    const { exit, results } = await run(files);
    expect(exit).toBe(1);
    expect(results[0]!.findings[0]!.detail).toContain("below the 0.5 floor");
  });

  // #2233: 2,800 IG artefact pages excluded on purpose blocked a production
  // publish as "truncated". The marker separates intent from truncation.
  const excludedBox = `<!doctype html><html><head>${SEARCH_EXCLUDE_MARKER}</head><body><input id="search-input" type="text"></body></html>`;
  test("pages excluded from search ON PURPOSE are not counted against the index", async () => {
    const files: Record<string, unknown> = { "a.html": boxed, [SEARCH_INDEX_PATH]: { 0: entry("/a.html") } };
    for (let i = 0; i < 10; i++) files[`artifact/p${i}.html`] = excludedBox;
    expect((await run(files)).exit).toBe(0);
  });
  test("...and a real truncation still fails, naming how many were excluded", async () => {
    const files: Record<string, unknown> = { [SEARCH_INDEX_PATH]: { 0: entry("/p0.html") } };
    for (let i = 0; i < 4; i++) files[`p${i}.html`] = boxed;
    for (let i = 0; i < 3; i++) files[`x${i}.html`] = excludedBox;
    const { exit, results } = await run(files);
    expect(exit).toBe(1);
    expect(results[0]!.findings[0]!.detail).toContain("3 more are excluded from search on purpose");
  });

  test("BORROWED (a staging preview): a declared-empty index is presence and parsing only", async () => {
    expect((await run({ "a.html": boxed, [SEARCH_INDEX_PATH]: {} }, "borrowed")).exit).toBe(0);
    expect((await run({ "a.html": boxed }, "borrowed")).exit).toBe(1);
  });

  test("a tree with no search box is COULD NOT TELL, never a pass", async () => {
    const { exit, results } = await run({ "a.html": "<p>x</p>" });
    expect(exit).toBe(2);
    expect(results[0]!.couldNotTell).toBeDefined();
  });

  test("it is in the deploy set and names the downstream Tool it judges", () => {
    expect(VERIFIERS).toContain(SEARCH_INDEX);
    expect(SEARCH_INDEX.tool).toBe("site-search-index");
  });
});

describe("the documents this platform actually publishes", () => {
  // Built in memory by the same functions the site build runs. The two found
  // by the first run — `layer` on 159 vocabulary terms, `skipped` on the
  // trashcan export — are the regression this pins.
  const loader = localLoader(tmpdir());
  test.each([
    ["the swimlane glossary", () => buildGlossary().doc],
    ["the vocabulary", () => buildVocabulary().doc],
    ["the fsh-guts export", () => buildFshGutsExport()],
  ])("%s expands with no warning", async (_name, build) => {
    expect(await expandFindings(build() as object, loader)).toEqual([]);
  });

  test("the glossary round-trips: expand then compact keeps every concept", async () => {
    const doc = buildGlossary().doc as { "@context": object; "@graph": unknown[] };
    const expanded = await jsonld.expand(doc as object, { documentLoader: loader as never });
    const compacted = (await jsonld.compact(expanded, doc["@context"] as never, { documentLoader: loader as never })) as {
      "@graph"?: unknown[];
    };
    expect((compacted["@graph"] ?? []).length).toBe(doc["@graph"].length);
  });

  test("the content context resolves locally, never over the network", async () => {
    const r = await localLoader(tmpdir())(CONTENT_CONTEXT_URL);
    expect(r.document).toHaveProperty("@context");
  });
});

describe("a staging preview's own context URLs resolve to its tree", () => {
  // A staging export mints under `<published>/branches/<slug>` (`kg-export
  // --base-url`), so its subject documents name a context there, while the
  // preview's tree is the site's root: the file is `<dir>/bootstrap-tools/…`,
  // never `<dir>/branches/<slug>/bootstrap-tools/…`.
  const PUBLISHED = CONTENT_CONTEXT_URL.slice(0, CONTENT_CONTEXT_URL.indexOf("/ns/content/"));
  const STAGED = `${PUBLISHED}/STAGING/feature-x`;
  const CTX = "bootstrap-tools/bootstrap-tools.context.jsonld";
  const tree = () => site({ [CTX]: { "@context": { label: "http://www.w3.org/2000/01/rdf-schema#label" } } });
  const subject = { "@context": `${STAGED}/${CTX}`, "@id": `${STAGED}/subject/x`, label: "x" };

  test("with no --base, a STAGING/<slug>/ URL whose direct path is missing is read without that prefix", async () => {
    const r = await localLoader(tree())(`${STAGED}/${CTX}`);
    expect(r.document).toHaveProperty("@context");
    expect(await expandFindings(subject, localLoader(tree()))).toEqual([]);
  });

  test("with the preview's --base, the longest base maps its URLs onto the tree", async () => {
    const r = await localLoader(tree(), [PUBLISHED, STAGED])(`${STAGED}/${CTX}`);
    expect(r.document).toHaveProperty("@context");
  });

  test("the whole verifier passes the staged subject document", async () => {
    const dir = site({ [CTX]: { "@context": { label: "http://www.w3.org/2000/01/rdf-schema#label" } }, "subject/x.jsonld": subject });
    const { exit, results } = await verify(dir, JSONLD, { bases: [PUBLISHED] });
    expect(results[0]!.findings).toEqual([]);
    expect(results[0]!.checked).toBe(1);
    expect(exit).toBe(0);
  });

  test("a context the tree does not hold is still refused, staged or not", async () => {
    await expect(localLoader(tree())(`${STAGED}/nowhere/x.context.jsonld`)).rejects.toThrow(/refused to fetch/);
  });
});

describe("a document published at our address is ours, whatever vocabulary it speaks — bean 7h1c", () => {
  const INSTANCE = join(HARNESS_ROOT);
  const BASE = declaredBase(INSTANCE)!;
  const skosOnly = (id: string) => ({
    "@context": { skos: "http://www.w3.org/2004/02/skos/core#", prefLabel: "skos:prefLabel" },
    "@id": id,
    prefLabel: "x",
  });

  test("the declaration names the base — otherwise every case below is vacuous", () => {
    expect(BASE).toMatch(/^https:\/\//);
  });

  test("an @id under a base makes a SKOS-only document ours; a lookalike prefix does not", () => {
    expect(isOurs(skosOnly(`${BASE}/cat-harness-code-lists.jsonld`), [BASE])).toBe(true);
    expect(isOurs(skosOnly(`${BASE}-evil/x.jsonld`), [BASE])).toBe(false);
    expect(isOurs(skosOnly(`${BASE}/x.jsonld`))).toBe(false);
  });

  test("the REAL code-lists document is checked, not counted out of scope", async () => {
    // The defect this bean records: its context binds only skos/dcterms/owl/rdf,
    // so the context test alone scoped it out and nothing verified it.
    const lists = [...loadCodeLists(await codeListDirs(INSTANCE)).values()];
    const doc = buildCodeListsDoc(lists, `${BASE}/cat-harness-code-lists.jsonld`);
    const dir = site({ "cat-harness-code-lists.jsonld": doc });
    const before = await verify(dir, JSONLD);
    expect(before.results[0]!.outOfScope).toBe(1);
    const after = await verify(dir, JSONLD, { bases: [BASE] });
    expect(after.exit).toBe(0);
    expect(after.results[0]!.checked).toBe(1);
    expect(after.results[0]!.outOfScope).toBe(0);
  });
});

/**
 * The `linked-data` voice's mechanical half (bean `4pla`). Each case is a
 * PROV-JSONLD association, the shape bean `9y9j` measured broken in all 100
 * activities of the PROV-O reports.
 */
describe("object properties are links — ld-object-property-is-a-link", () => {
  const LINKS = [JSONLD_OBJECT_LINKS];
  const assoc = (agentKey: string, agent: unknown) => ({
    "@context": [PROV_JSONLD_CONTEXT_URL, { "@base": "https://litlfred.github.io/folio/", cat: CAT_HARNESS_NS }],
    "@graph": [
      { "@id": "run#1", "@type": "Activity" },
      { "@type": "Association", activity: "run#1", [agentKey]: agent },
    ],
  });

  test("a link passes", async () => {
    const { exit, results } = await verify(site({ "p.jsonld": assoc("agent", "https://example.org/actors/owner") }), LINKS);
    expect(results[0]!.checked).toBe(1);
    expect(results[0]!.findings).toEqual([]);
    expect(exit).toBe(0);
  });

  test("a DECLARED literal — no release address, reason recorded elsewhere — is counted, not a finding", async () => {
    const { exit, results } = await verify(site({ "p.jsonld": assoc("agent", { "@value": "owner" }) }), LINKS);
    expect(results[0]!.findings).toEqual([]);
    expect(results[0]!.note).toContain("1 declared literal");
    expect(exit).toBe(0);
  });

  test("FAILS on a compact-IRI key that misses the term's coercion, and names that as the cause", async () => {
    const { exit, results } = await verify(site({ "p.jsonld": assoc("prov:agent", "owner") }), LINKS);
    expect(exit).toBe(1);
    expect(results[0]!.findings).toHaveLength(1);
    expect(results[0]!.findings[0]!.detail).toContain("http://www.w3.org/ns/prov#agent");
    expect(results[0]!.findings[0]!.detail).toContain("ld-coercion-belongs-to-the-term");
  });

  test("the object properties come from the held context, not a list here — PROV's agent is one", async () => {
    // The control for the case above: the SAME value under a data property of
    // the same context is a literal by design and must not be flagged.
    const doc = assoc("agent", "https://example.org/a");
    (doc["@graph"][0] as Record<string, unknown>)["startTime"] = "2026-10-03T00:00:00Z";
    const { results } = await verify(site({ "p.jsonld": doc }), LINKS);
    expect(results[0]!.findings).toEqual([]);
  });

  test("the real PROV-O reports carry no undeclared literal under an object property", async () => {
    // The corpus 9y9j measured: 100 activities, every agent/role/plan a string.
    // The site root is asked of the declaration, never spelled here
    // (`site-dir-single-answer.test.ts`).
    const instance = join(HARNESS_ROOT);
    const dir = join(instance, siteDirFor(instance), "assets", "prov");
    const { results } = await verify(dir, LINKS);
    expect(results[0]!.checked).toBeGreaterThan(0);
    expect(results[0]!.findings).toEqual([]);
  });
});

describe("no document leans on a remote @base — ld-no-base-in-a-remote-context", () => {
  const BASE = [JSONLD_OWN_BASE];
  const doc = (ctx: unknown[]) => ({ "@context": ctx, "@id": "x", label: "x" });

  test("the content context carries @base — otherwise every case below is vacuous", async () => {
    const held = (await localLoader(".")(CONTENT_CONTEXT_URL)).document as { "@context": Record<string, unknown> };
    expect(held["@context"]["@base"]).toBeDefined();
  });

  test("the two-part context (URL, then an inline @base) passes", async () => {
    const { exit, results } = await verify(
      site({ "a.jsonld": doc([CONTENT_CONTEXT_URL, { "@base": "https://litlfred.github.io/folio/" }]) }),
      BASE,
    );
    expect(results[0]!.findings).toEqual([]);
    expect(exit).toBe(0);
  });

  test("FAILS on the URL alone — relative @ids resolve only under jsonld.js", async () => {
    const { exit, results } = await verify(site({ "a.jsonld": doc([CONTENT_CONTEXT_URL]) }), BASE);
    expect(exit).toBe(1);
    expect(results[0]!.findings[0]!.detail).toContain("states no @base of its own");
  });
});

test("both voice verifiers are in the deploy set", () => {
  const ids = VERIFIERS.map((v) => v.id);
  expect(ids).toContain("jsonld-object-links");
  expect(ids).toContain("jsonld-own-base");
});

describe("the search-scopes verifier — bean m7mn", () => {
  const INDEX = { 0: { relUrl: "/" }, 1: { relUrl: "/smart-trust/a.html" }, 2: { relUrl: "/fr/b.html" } };
  const text = JSON.stringify(INDEX);
  /** A tree holding the index and its fresh split, with optional edits on top. */
  const tree = (edit: (files: Record<string, unknown>) => void = () => {}) => {
    const files: Record<string, unknown> = { [SEARCH_INDEX_PATH]: text };
    for (const [p, body] of render(text, new Set(["smart-trust"]), new Set(["fr"]))) files[p] = body;
    edit(files);
    return verify(site(files), [SEARCH_SCOPES], { bases: [] });
  };
  const manifestAt = `${SCOPES_DIR}/manifest.json`;
  const details = async (edit: (files: Record<string, unknown>) => void) =>
    (await tree(edit)).results[0]!.findings.map((f) => f.detail).join("\n");

  test("a fresh split of the tree's own index passes", async () => {
    expect((await tree()).exit).toBe(0);
  });

  test("an unsplit index is a finding — scoped search would load nothing", async () => {
    expect(await details((f) => { for (const k of Object.keys(f)) if (k.startsWith(`${SCOPES_DIR}/`)) delete f[k]; })).toContain("missing");
  });

  test("a split of a DIFFERENT index is stale — what a staging tree that split before borrowing would ship", async () => {
    expect(await details((f) => { f[SEARCH_INDEX_PATH] = JSON.stringify({ ...INDEX, 3: { relUrl: "/x" } }); })).toContain("split from a different index");
  });

  test("an entry in two scopes, or one missing from all, does not partition", async () => {
    const scopeFile = (_f: Record<string, unknown>, id: string) => `${SCOPES_DIR}/${id}.json`;
    // Scope files key entries by URL hash (stableKeys), not the theme's running number.
    const key = stableKeys(INDEX);
    const both = await details((f) => {
      f[scopeFile(f, "smart-trust")] = JSON.stringify({ [key.get("0")!]: { relUrl: "/" }, [key.get("1")!]: { relUrl: "/smart-trust/a.html" } });
    });
    expect(both).toContain(`entry ${key.get("0")!} is in both`);
    const short = await details((f) => { f[scopeFile(f, "locale-fr")] = "{}"; });
    expect(short).toContain("the manifest says 1");
    expect(short).toContain("do not partition it");
  });

  test("a remote lookup the tree does not hold is a finding — bean 1br0", async () => {
    const remote = [{ id: "who-iris", kind: "id-lookup" as const, href: "id-lookup/?index=who-iris/", entries: 10 }];
    const withRemote = (edit: (f: Record<string, unknown>) => void) => {
      const files: Record<string, unknown> = { [SEARCH_INDEX_PATH]: text };
      for (const [p, body] of render(text, new Set(["smart-trust"]), new Set(["fr"]), undefined, remote)) files[p] = body;
      edit(files);
      return verify(site(files), [SEARCH_SCOPES], { bases: [] });
    };
    const ok = await withRemote((f) => { f["id-lookup/index.html"] = "<p/>"; f["id-lookup/who-iris/manifest.json"] = { entryCount: 10 }; });
    expect(ok.exit).toBe(0);
    const noIndex = await withRemote((f) => { f["id-lookup/index.html"] = "<p/>"; });
    expect(noIndex.results[0]!.findings.map((x) => x.detail).join("\n")).toContain("names an index that is not in the tree");
    const noPage = await withRemote((f) => { f["id-lookup/who-iris/manifest.json"] = { entryCount: 10 }; });
    expect(noPage.results[0]!.findings.map((x) => x.detail).join("\n")).toContain("holds no lookup page");
  });

  test("a prebuilt index must cover exactly its scope, under the theme's fields — bean lrzn", async () => {
    const INDEXED = { 0: { title: "Home", content: "gates", relUrl: "/" }, 1: { title: "Trust", content: "lists", relUrl: "/smart-trust/a.html" }, 2: { title: "Accueil", content: "bonjour", relUrl: "/fr/b.html" } };
    const t = JSON.stringify(INDEXED);
    // Budget 0: every scope is published prebuilt.
    const prebuilt = (edit: (f: Record<string, unknown>) => void) => {
      const files: Record<string, unknown> = { [SEARCH_INDEX_PATH]: t };
      for (const [p, body] of render(t, new Set(["smart-trust"]), new Set(["fr"]), undefined, [], 0)) files[p] = body;
      edit(files);
      return verify(site(files), [SEARCH_SCOPES], { bases: [] });
    };
    const at = (id: string) => `${SCOPES_DIR}/${id}.idx.json`;
    const msg = async (edit: (f: Record<string, unknown>) => void) => (await prebuilt(edit)).results[0]!.findings.map((x) => x.detail).join("\n");
    expect((await prebuilt(() => {})).exit).toBe(0);
    // Another scope's index under this scope's name: one ref missing, one foreign.
    const key = stableKeys(INDEXED);
    expect(await msg((f) => { f[at("smart-trust")] = f[at("locale-fr")]; })).toContain(
      `prebuilt index of smart-trust does not cover its entries: 1 missing (${key.get("1")!}), 1 not in the scope (${key.get("2")!})`,
    );
    expect(await msg((f) => { f[at("smart-trust")] = "{"; })).toContain("prebuilt index of smart-trust unreadable");
    const fields = await msg((f) => {
      const idx = JSON.parse(f[at("smart-trust")] as string) as { fields: string[] };
      idx.fields = ["title", "content"];
      f[at("smart-trust")] = JSON.stringify(idx);
    });
    expect(fields).toContain(`has fields ["title","content"]`);
    const version = await msg((f) => { f[at("smart-trust")] = (f[at("smart-trust")] as string).replace(`"version":"2.3.9"`, `"version":"2.4.0"`); });
    expect(version).toContain("is lunr 2.4.0, the theme loads 2.3.9");
  });

  test("a tree with no site index is out of scope — search-index reports that", async () => {
    const { exit, results } = await verify(site({ "a.html": "<p/>" }), [SEARCH_SCOPES], { bases: [] });
    expect(results[0]!.findings).toEqual([]);
    expect(results[0]!.outOfScope).toBe(1);
    expect(exit).not.toBe(1);
  });

  test("it is in the deploy set and names the downstream Tool it judges", () => {
    expect(VERIFIERS).toContain(SEARCH_SCOPES);
    expect(SEARCH_SCOPES.tool).toBe("site-search-scopes");
  });

  test("manifest path is where the split writes it", () => {
    expect(manifestAt).toBe("assets/js/search/manifest.json");
  });
});
