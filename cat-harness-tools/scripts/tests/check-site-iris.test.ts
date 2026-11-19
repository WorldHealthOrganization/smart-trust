/**
 * `check:site-iris` — a built site serves the IRIs it mints (IRI fix 1A, f).
 * Every case is a temp site tree: the check never fetches.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { checkSiteIris, evenSample, isServed, jsonLdFiles, pathUnder, servedFile } from "../check-site-iris.ts";

const BASE = "https://example.org/layer/";
const roots: string[] = [];
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

function site(files: Record<string, unknown>): string {
  const root = mkdtempSync(join(tmpdir(), "site-iris-"));
  roots.push(root);
  for (const [p, v] of Object.entries(files)) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), typeof v === "string" ? v : JSON.stringify(v));
  }
  return root;
}

describe("served, as GitHub Pages serves it", () => {
  const s = site({ "a.jsonld": "{}", "b.html": "<p id=\"x\">", "c/index.html": "", "index.html": "" });

  test("the path itself, <path>.html, or <path>/index.html", () => {
    expect(servedFile(s, "a.jsonld")).toBeDefined();
    expect(servedFile(s, "b")).toBeDefined();
    expect(servedFile(s, "c")).toBeDefined();
    expect(servedFile(s, "c/")).toBeDefined();
    expect(servedFile(s, "")).toBeDefined();
    expect(servedFile(s, "a")).toBeUndefined(); // Pages does not add .jsonld
    expect(servedFile(s, "d")).toBeUndefined();
  });

  test("a hash IRI needs its fragment in the served document", () => {
    expect(isServed(s, BASE, `${BASE}b#x`).ok).toBe(true);
    const missing = isServed(s, BASE, `${BASE}b#y`);
    expect(missing.ok).toBe(false);
    expect(missing.detail).toContain("has no #y");
  });

  test("pathUnder: under the base or not, fragment dropped", () => {
    expect(pathUnder(`${BASE}v0/ns#glossary/t/a`, BASE)).toBe("v0/ns");
    expect(pathUnder("https://example.org/layer", BASE)).toBe("");
    expect(pathUnder("https://elsewhere.org/x", BASE)).toBeUndefined();
  });
});

describe("checkSiteIris", () => {
  const ctx = `${BASE}ns/context/v1.jsonld`;

  test("a relative @id under the site's own release base, published at its path, passes", () => {
    const s = site({
      "ns/context/v1.jsonld": { "@context": {} },
      "v0/papers/d/blocks/b1.jsonld": { "@context": [ctx, { "@base": `${BASE}v0/` }], "@id": "papers/d/blocks/b1" },
      "v0/papers/d/blocks/b1.html": "<p>",
    });
    const r = checkSiteIris(s, BASE, 0);
    expect(r.findings).toEqual([]);
    expect(r.checked).toBe(2); // the block's context URL and its @id
  });

  test("the shared folio base is a foreign base: minted here, served nowhere", () => {
    const s = site({
      "ns/context/v1.jsonld": {},
      "d/kg/ch1/b1.jsonld": { "@context": [ctx, { "@base": "https://litlfred.github.io/folio/" }], "@id": "papers/d/blocks/b1" },
    });
    const r = checkSiteIris(s, BASE, 0);
    expect(r.findings.map((f) => f.kind)).toEqual(["foreign-base"]);
    expect(r.findings[0]!.iri).toBe("https://litlfred.github.io/folio/papers/d/blocks/b1");
  });

  test("an @id under the site that the tree does not hold is unserved", () => {
    const s = site({
      "ns/context/v1.jsonld": {},
      "v0/x.jsonld": { "@context": [ctx, { "@base": `${BASE}v0/` }], "@id": "papers/d/blocks/missing" },
    });
    const r = checkSiteIris(s, BASE, 0);
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]).toMatchObject({ kind: "unserved", file: "v0/x.jsonld", iri: `${BASE}v0/papers/d/blocks/missing` });
  });

  test("a context URL under the site that is not published is unserved-context", () => {
    const s = site({ "a.jsonld": { "@context": [ctx], "@id": `${BASE}a.jsonld` } });
    expect(checkSiteIris(s, BASE, 0).findings.map((f) => f.kind)).toEqual(["unserved-context"]);
  });

  test("a glossary concept: its namespace document must be served and hold the concept", () => {
    const ns = `${BASE}v0/ns`;
    const s = site({
      "v0/ns/index.html": `<dt id="glossary/t/a">a</dt>`,
      "v0/ns/index.jsonld": { "@id": ns, "@graph": [{ "@id": `${ns}#glossary/t/a` }, { "@id": `${ns}#glossary/t/gone` }] },
    });
    const r = checkSiteIris(s, BASE, 0);
    // `<ns>` itself is served (v0/ns/index.html); `#glossary/t/a` is in it; `#glossary/t/gone` is not.
    expect(r.findings.map((f) => f.iri)).toEqual([`${ns}#glossary/t/gone`]);
  });

  test("an absolute @id outside the site, and a blank node, are not this site's to serve", () => {
    const s = site({ "a.jsonld": { "@graph": [{ "@id": "https://schema.org/Thing" }, { "@id": "_:b0" }] } });
    expect(checkSiteIris(s, BASE, 0)).toMatchObject({ checked: 1, findings: [] });
  });

  test("with no @base a relative @id resolves against the document's own URL", () => {
    const s = site({ "dir/a.jsonld": { "@id": "a.jsonld" } });
    expect(checkSiteIris(s, BASE, 0).findings).toEqual([]);
    const t = site({ "dir/a.jsonld": { "@id": "b" } });
    expect(checkSiteIris(t, BASE, 0).findings[0]!.iri).toBe(`${BASE}dir/b`);
  });

  test("a file that is not JSON is skipped, not a crash", () => {
    const s = site({ "a.jsonld": "not json" });
    expect(checkSiteIris(s, BASE, 0)).toMatchObject({ documents: 1, checked: 0, findings: [] });
  });
});

describe("sampling", () => {
  test("evenly spread, repeatable, and all when 0 or at least the count", () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    expect(evenSample(items, 5)).toEqual([0, 2, 4, 6, 8]);
    expect(evenSample(items, 0)).toEqual(items);
    expect(evenSample(items, 20)).toEqual(items);
  });

  test("the files are read in sorted order, skipping node_modules", () => {
    const s = site({ "b.jsonld": "{}", "a/c.jsonld": "{}", "node_modules/x.jsonld": "{}", "d.json": "{}" });
    expect(jsonLdFiles(s)).toEqual(["a/c.jsonld", "b.jsonld"]);
  });

  test("a sampled run reads only the sample", () => {
    const files: Record<string, unknown> = {};
    for (let i = 0; i < 20; i++) files[`n${String(i).padStart(2, "0")}.jsonld`] = { "@id": `n${String(i).padStart(2, "0")}.jsonld` };
    const r = checkSiteIris(site(files), BASE, 4);
    expect(r).toMatchObject({ documents: 20, sampled: 4, checked: 4, findings: [] });
  });
});
