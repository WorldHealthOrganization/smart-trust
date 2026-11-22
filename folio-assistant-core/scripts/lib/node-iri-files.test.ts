/**
 * Each content node is served at its IRI, `<iriBase>v<major>/<@id>` (IRI fix
 * 1A, a; owner 2026-11-18), as `<@id>.jsonld` and `<@id>.html`.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { FOLIO_BASE } from "@litlfred/cat-harness-tools/schemas/kg/jsonld.js";

import { writeNodeIris } from "../build-document-site.ts";
import { atCurrentBase, nodeIri, nodeIriFiles, nodePage, nodeSitePath } from "./node-iri-files.ts";

const site = "https://example.org/folio/";
const node = (id: string, base = `${site}v0/`, extra: Record<string, unknown> = {}) =>
  `${JSON.stringify({ "@context": ["https://example.org/folio/ns/context/v1.jsonld", { "@base": base }], "@id": id, ...extra }, null, 2)}\n`;

describe("nodeIri", () => {
  test("a relative @id resolves against the context's @base", () => {
    expect(nodeIri(node("papers/doc/blocks/a"))).toBe(`${site}v0/papers/doc/blocks/a`);
  });
  test("an absolute @id is itself, without its fragment", () => {
    expect(nodeIri(node("https://other.example/x#frag"))).toBe("https://other.example/x");
  });
  test("no @id, a blank node or text that is not JSON has none", () => {
    expect(nodeIri(JSON.stringify({ "@context": [] }))).toBeUndefined();
    expect(nodeIri(node("_:b0"))).toBeUndefined();
    expect(nodeIri("not json")).toBeUndefined();
  });
});

describe("nodeSitePath", () => {
  test("an IRI under the site is its path there", () => {
    expect(nodeSitePath(`${site}v0/library/e/sections/s1`, site)).toBe("v0/library/e/sections/s1");
    expect(nodeSitePath(`${site}v0/library/e/sections/s1`, "https://example.org/folio")).toBe("v0/library/e/sections/s1");
  });
  test("another site's IRI, a directory or the site itself is not a node path here", () => {
    expect(nodeSitePath("https://example.org/other/v0/x", site)).toBeUndefined();
    expect(nodeSitePath(`${site}v0/x/`, site)).toBeUndefined();
    expect(nodeSitePath(site, site)).toBeUndefined();
  });
});

describe("nodeIriFiles", () => {
  test("each node at its IRI: the node as .jsonld, and a page linking where it is read", () => {
    const text = node("papers/doc/blocks/a");
    const { files, collisions } = nodeIriFiles([{ text, source: "a.jsonld", page: "en/doc/#a" }], site);
    expect(collisions).toEqual([]);
    expect([...files.keys()].sort()).toEqual(["v0/papers/doc/blocks/a.html", "v0/papers/doc/blocks/a.jsonld"]);
    expect(files.get("v0/papers/doc/blocks/a.jsonld")).toBe(text);
    const html = files.get("v0/papers/doc/blocks/a.html")!;
    expect(html).toContain('href="../../../../en/doc/#a"');
    expect(html).toContain('href="a.jsonld"');
    expect(html).toContain('<script type="application/ld+json">');
  });
  test("a node of another site is left out", () => {
    expect(nodeIriFiles([{ text: node("x", FOLIO_BASE), source: "x.jsonld" }], site).files.size).toBe(0);
  });
  test("two different nodes at one IRI are a collision; the same node twice is not", () => {
    const a = node("library/e/s", undefined, { title: "one" });
    const b = node("library/e/s", undefined, { title: "two" });
    expect(nodeIriFiles([{ text: a, source: "1" }, { text: a, source: "2" }], site).collisions).toEqual([]);
    expect(nodeIriFiles([{ text: a, source: "1" }, { text: b, source: "2" }], site).collisions).toEqual([`${site}v0/library/e/s: published by both 1 and 2, with different content`]);
  });
});

describe("nodePage", () => {
  test("escapes the IRI and keeps </ out of the embedded script", () => {
    const html = nodePage(`${site}v0/x<y`, "v0/x", node("x", undefined, { note: "</script><b>" }));
    expect(html).toContain("x&lt;y");
    expect(html).not.toContain("</script><b>");
    expect(html).not.toContain("canonical");
  });
});

describe("atCurrentBase", () => {
  test("a node off the old shared base, or not JSON, is returned unchanged", () => {
    const text = node("x");
    expect(atCurrentBase(text, "/nowhere/x.jsonld")).toBe(text);
    expect(atCurrentBase("not json", "/nowhere/x.jsonld")).toBe("not json");
  });
  test("a node on the old shared base, in no layer, keeps it", () => {
    const text = node("x", FOLIO_BASE);
    expect(atCurrentBase(text, join(tmpdir(), "no-layer", "x.jsonld"))).toBe(text);
  });
});

describe("writeNodeIris", () => {
  const roots: string[] = [];
  afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));
  const repo = (decl: Record<string, unknown>) => {
    const r = mkdtempSync(join(tmpdir(), "node-iris-"));
    roots.push(r);
    writeFileSync(join(r, "folio.json"), JSON.stringify({ $schema: "cat-harness-declaration/1.0.0", name: "folio", ...decl }));
    return r;
  };
  test("writes each node under the site the folio's iriBase names", () => {
    const r = repo({ iriBase: site, version: "0.1.0" });
    const out = join(r, "_site");
    expect(writeNodeIris(r, out, [{ text: node("papers/doc/blocks/a"), source: "a", page: "en/doc/#a" }])).toEqual([]);
    expect(existsSync(join(out, "v0", "papers", "doc", "blocks", "a.jsonld"))).toBe(true);
    expect(readFileSync(join(out, "v0", "papers", "doc", "blocks", "a.html"), "utf-8")).toContain("en/doc/#a");
  });
  test("a folio declaring no iriBase serves no node IRI, and writes nothing", () => {
    const r = repo({});
    const out = join(r, "_site");
    expect(writeNodeIris(r, out, [{ text: node("papers/doc/blocks/a"), source: "a" }])).toEqual([]);
    expect(existsSync(out)).toBe(false);
  });
});
