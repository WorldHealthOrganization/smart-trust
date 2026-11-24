/**
 * `check-content-keys.ts` — the key and path halves of the retired
 * `check-context-emission` (beans `yh6u`, `589f`, `folio-assistant-63q4`).
 *
 * @module scripts/tests/check-content-keys
 * @graphNode none — a test
 *
 * Every "real corpus" test asserts a NON-EMPTY corpus first: a check over
 * nothing reports nothing, and that is indistinguishable from success (`6tkl`).
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { checkDeclaredKeys, checkPathsAreNotLinks, looksLikePath, namesContentTerms } from "../check-content-keys.ts";
import { CONTENT_CONTEXT_URL } from "../../schemas/kg/jsonld.ts";

/** A tree of `.jsonld` documents, and nothing else. */
function corpus(docs: Record<string, unknown>): string {
  const root = mkdtempSync(join(tmpdir(), "ctxemit-"));
  for (const [rel, body] of Object.entries(docs)) {
    mkdirSync(join(root, rel, ".."), { recursive: true });
    writeFileSync(join(root, rel), JSON.stringify(body));
  }
  return root;
}

describe("which documents are judged", () => {
  test("the shared content context, or an instance's own generated one — nothing else", () => {
    expect(namesContentTerms(CONTENT_CONTEXT_URL)).toBe(true);
    expect(namesContentTerms("https://litlfred.github.io/who-iris/ns/context/v1.jsonld")).toBe(true);
    expect(namesContentTerms("https://openprovenance.org/prov-jsonld/context.jsonld")).toBe(false);
  });

  test("a document switched to its instance context is still judged against the content terms", () => {
    const C = { title: "dcterms:title" } as Record<string, unknown>;
    const root = corpus({ "a.jsonld": { "@context": ["https://example.org/top/ns/context/v1.jsonld", { "@base": "https://b/" }], title: "t", stray: 1 } });
    const k = checkDeclaredKeys(root, C);
    expect(k.documents).toBe(1);
    expect(k.undeclared.map((u) => u.prefix)).toEqual(["stray"]);
    rmSync(root, { recursive: true, force: true });
  });
});

// ── Every plain key is a declared term — bean `yh6u` ──────────────────────


describe("a key a content document writes must be a declared term", () => {
  const C = { title: "dcterms:title", narrative: { "@id": "x:n", "@type": "@json" } } as Record<string, unknown>;
  const U = "https://example.org/ctx.jsonld";

  test("an undeclared key is caught — the 392-figure-narrative defect", () => {
    const root = corpus({ "a.jsonld": { "@context": U, title: "t", drafted_by: { id: "x" } } });
    const k = checkDeclaredKeys(root, C, U);
    expect(k.documents).toBe(1);
    expect(k.undeclared.map((u) => u.prefix).sort()).toEqual(["drafted_by", "id"]);
    rmSync(root, { recursive: true, force: true });
  });

  test("keys INSIDE a `@json` value are data, never flagged", () => {
    const root = corpus({ "a.jsonld": { "@context": U, narrative: { text: null, drafted_by: { id: "x" } } } });
    const k = checkDeclaredKeys(root, C, U);
    expect(k.documents).toBe(1);
    expect(k.undeclared).toEqual([]);
    rmSync(root, { recursive: true, force: true });
  });

  test("a document on another context is not this check's to judge", () => {
    const root = corpus({ "a.jsonld": { "@context": "https://other.example/ctx", whatever: 1 } });
    expect(checkDeclaredKeys(root, C, U).documents).toBe(0);
    rmSync(root, { recursive: true, force: true });
  });

  test("the real corpus: every key declared, over a non-empty corpus", () => {
    const k = checkDeclaredKeys();
    expect(k.documents).toBeGreaterThan(0);
    expect(k.undeclared).toEqual([]);
  });
});

// ── A path is never an `@id` — bean `589f` ────────────────────────────────


describe("a file path under an `@id` term is caught", () => {
  const U = "https://example.org/ctx.jsonld";
  const LINKED = { text: { "@id": "x:text", "@type": "@id" }, uses: { "@id": "x:uses", "@type": "@id" } } as Record<string, unknown>;
  const LITERAL = { text: { "@id": "x:text" }, uses: { "@id": "x:uses", "@type": "@id" } } as Record<string, unknown>;

  test("the 589f shape — `../sections/x.md` under a coerced `text` — fails", () => {
    const root = corpus({ "a.jsonld": { "@context": U, text: "../sections/sec-001-intro.md", uses: ["papers/p/blocks/def-a"] } });
    const p = checkPathsAreNotLinks(root, LINKED, U);
    expect(p.documents).toBe(1);
    expect(p.undeclared.map((u) => u.prefix)).toEqual(["text"]);
    rmSync(root, { recursive: true, force: true });
  });

  test("the same value under a LITERAL `text` passes, and node ids never trip it", () => {
    const root = corpus({ "a.jsonld": { "@context": U, text: "../sections/sec-001-intro.md", uses: ["papers/p/blocks/def-a"] } });
    const p = checkPathsAreNotLinks(root, LITERAL, U);
    expect(p.documents).toBe(1);
    expect(p.undeclared).toEqual([]);
    rmSync(root, { recursive: true, force: true });
  });

  test("what counts as a path", () => {
    for (const v of ["../sections/a.md", "./x", "thm-foo.md", "Proof.lean", "img.PNG"]) expect(looksLikePath(v)).toBe(true);
    for (const v of ["library/doc/blocks/prose-sec-001", "papers/p/blocks/def-a", "https://example.org/x"]) expect(looksLikePath(v)).toBe(false);
  });

  test("the real corpus: no path under an `@id` term", () => {
    const p = checkPathsAreNotLinks();
    expect(p.documents).toBeGreaterThan(0);
    expect(p.undeclared).toEqual([]);
  });
});
