/**
 * What a file has to SAY to be read as generator output — bean `ws99`.
 *
 * `declaresGenerated` in `check-reference-direction.ts` is the one route by
 * which a file exempts ITSELF, and 476 files take it. The rule it has to hold
 * is narrow in both directions: a generator's output must be able to declare
 * itself without rearranging what it is, and a document that merely TALKS
 * about generation must not be able to exempt itself by using the word.
 *
 * The position half is what `ws99` changed. JSON is parsed now rather than
 * matched from the first key, so `$schema` and `@context` keep the first
 * position every validator and every JSON-LD reader looks for them in. These
 * tests pin both halves, because parsing is only the better rule while the
 * "mentions it" case still fails.
 *
 * @module schemas/reference-direction-declaration.test
 * @graphNode none — a test
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { declaresGenerated } from "../scripts/check-reference-direction.ts";

const DIR = mkdtempSync(join(tmpdir(), "ws99-declares-"));
afterAll(() => rmSync(DIR, { recursive: true, force: true }));

/** A file with this content, named so the function sees the extension it keys on. */
function file(name: string, body: string): string {
  const p = join(DIR, name);
  writeFileSync(p, body);
  return p;
}

describe("JSON declares itself by a top-level `_generated`, in any position", () => {
  test("first key, as `sync-docs-harness.ts` has always emitted it", () => {
    expect(declaresGenerated(file("first.json", JSON.stringify({ _generated: "scripts/x.ts", a: 1 }, null, 2)))).toBe(true);
  });

  test("after `$schema` — the case the old first-key regex refused", () => {
    const body = JSON.stringify({ $schema: "folio-glossary/v1", _generated: "scripts/x.ts", id: "g", terms: [] }, null, 2);
    expect(declaresGenerated(file("after-schema.json", body))).toBe(true);
  });

  test("after `@context` in JSON-LD, which a reader needs first", () => {
    const body = JSON.stringify({ "@context": { skos: "http://www.w3.org/2004/02/skos/core#" }, _generated: "scripts/x.ts", "@graph": [] }, null, 2);
    expect(declaresGenerated(file("after-context.jsonld", body))).toBe(true);
  });

  test("last, after a long array — position is not part of the contract", () => {
    const body = JSON.stringify({ $schema: "s", terms: Array.from({ length: 500 }, (_, i) => ({ id: `t${i}` })), _generated: "scripts/x.ts" }, null, 2);
    expect(body.indexOf('"_generated"')).toBeGreaterThan(2000); // past the old head window
    expect(declaresGenerated(file("last.json", body))).toBe(true);
  });
});

describe("what does NOT count", () => {
  test("`_generated` nested deeper is what the file MENTIONS, not what it IS", () => {
    const body = JSON.stringify({ $schema: "s", projection: { _generated: "scripts/x.ts" }, items: [{ _generated: "scripts/y.ts" }] }, null, 2);
    expect(declaresGenerated(file("nested.json", body))).toBe(false);
  });

  test("a JSON array has no top level to declare on", () => {
    expect(declaresGenerated(file("array.json", JSON.stringify([{ _generated: "scripts/x.ts" }])))).toBe(false);
  });

  test("unparseable JSON is not a licence to skip it", () => {
    expect(declaresGenerated(file("broken.json", '{ "_generated": "scripts/x.ts"'))).toBe(false);
  });

  test("a Markdown page that DISCUSSES generation does not exempt itself", () => {
    const body = "---\nlayout: default\ntitle: How generation works\n---\n\n# Generated output\n\ngenerated: scripts/x.ts is what a generator writes into its own front matter.\n";
    expect(declaresGenerated(file("discusses.md", body))).toBe(false);
  });

  test("a Markdown page with no front matter at all", () => {
    expect(declaresGenerated(file("bare.md", "generated: scripts/x.ts\n"))).toBe(false);
  });

  test("a file that is not there", () => {
    expect(declaresGenerated(join(DIR, "absent.json"))).toBe(false);
  });
});

describe("Markdown keeps the front-matter route unchanged", () => {
  test("a `generated:` key in the front matter, as the docs mirrors carry it", () => {
    const body = "---\nlayout: default\ngenerated: scripts/gen-skill-docs.ts — do not hand-edit\ntitle: X\n---\n\n# X\n";
    expect(declaresGenerated(file("declared.md", body))).toBe(true);
  });
});
