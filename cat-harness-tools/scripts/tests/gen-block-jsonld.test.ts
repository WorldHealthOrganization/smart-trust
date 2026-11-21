/**
 * `gen-block-jsonld` cannot be exercised in this repo against real content:
 * folio-assistant is the platform, papers live in the folio repo, and
 * `findPapers` correctly reports none here. Left at that, the emitter would
 * ship untested and only ever run somewhere no test does.
 *
 * So this builds a synthetic paper — the same tactic
 * `scripts/tests/who-l1-extractor.test.py` uses for a document class no
 * sandboxed session can obtain — and asserts the emitted shape end to end,
 * through the real `loadBlocksUnder` import path.
 *
 * Fixtures export a plain object rather than calling a builder: the builders
 * are identity functions whose value is compile-time typing, and
 * `loadBlockModule` reads the default export, so a literal exercises exactly
 * the same path without making the fixture depend on a relative import that
 * would not resolve from a temp directory.
 */
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { blockToJsonLd } from "../../pipeline/gen-block-jsonld";
import { loadBlocksUnder, type LoadedBlock } from "../../pipeline/block-module";
import { CONTENT_DOCUMENT_CONTEXT } from "../../schemas/kg/jsonld.ts";

const ROOT = mkdtempSync(join(tmpdir(), "gen-block-jsonld-"));
const PAPER = "test-paper";
const CHAPTER = join(ROOT, "ch01");

let blocks: Map<string, LoadedBlock>;

beforeAll(async () => {
  mkdirSync(CHAPTER, { recursive: true });

  writeFileSync(
    join(CHAPTER, "def-widget.ts"),
    `export default {
      kind: "definition",
      label: "def:widget",
      title: "A widget",
      tags: ["algebra", "algebra"],
      cites: ["kock2004"],
    };\n`,
  );
  // The .md sibling exists; the .lean sibling deliberately does not.
  writeFileSync(join(CHAPTER, "def-widget.md"), "A widget is a thing.\n");

  writeFileSync(
    join(CHAPTER, "thm-main.ts"),
    `export default {
      kind: "theorem",
      label: "thm:main",
      title: "Main theorem",
      uses: ["def:widget", "def:widget", "other-paper:cor:pbw", "bare-ref", "ns:mystery:bogus"],
      foreshadows: ["conj:later"],
      lean: { ref: "qou:QOU.Main", sorryFree: true },
      meta: { chapter: 1 },
    };\n`,
  );

  // Not a block: a chapter manifest. Must be skipped, not emitted.
  writeFileSync(join(CHAPTER, "ch01.ts"), `export default { title: "Chapter one" };\n`);

  const loaded = await loadBlocksUnder(ROOT);
  expect(loaded.failures).toEqual([]);
  blocks = loaded.blocks;
});

afterAll(() => {
  try {
    rmSync(ROOT, { recursive: true, force: true });
  } catch {}
});

describe("gen-block-jsonld", () => {
  test("loads only real block manifests", () => {
    expect([...blocks.keys()].sort()).toEqual(["def:widget", "thm:main"]);
  });

  test("emits a minted @id and preserves the authored label verbatim", () => {
    const doc = blockToJsonLd(blocks.get("def:widget")!, PAPER, []);
    expect(doc["@id"]).toBe("papers/test-paper/blocks/def-widget");
    expect(doc.label).toBe("def:widget");
    // A definition is sci's kind, so its document binds sci's prefix itself:
    // the published context binds only cat-harness's (bean `0r7u`).
    const [url, local] = doc["@context"] as [string, Record<string, string>];
    expect(url).toBe(CONTENT_DOCUMENT_CONTEXT[0]);
    expect(local["@base"]).toBe(CONTENT_DOCUMENT_CONTEXT[1]["@base"]);
    expect(Object.keys(local).sort()).toEqual(["@base", "folio-assistant-sci"]);
  });

  test("co-types with DoCO where the mapping is unambiguous", () => {
    const doc = blockToJsonLd(blocks.get("thm:main")!, PAPER, []);
    expect(doc["@type"]).toEqual(["folio-assistant-sci:Theorem", "doco:Section"]);
  });

  test("resolves uses[] to IRIs, dedupes, and preserves authored order", () => {
    const doc = blockToJsonLd(blocks.get("thm:main")!, PAPER, []);
    expect(doc.uses).toEqual([
      "papers/test-paper/blocks/def-widget",
      "papers/other-paper/blocks/cor-pbw",
      // Prefix-less, and KEPT. Refusing these dropped 35 real edges on the
      // qou corpus, aimed at five real `prose` blocks whose labels carry no
      // prefix because `prose` does not require one.
      "papers/test-paper/blocks/bare-ref",
    ]);
  });

  test("an unresolvable reference is reported, not silently emitted", () => {
    const dangling: Parameters<typeof blockToJsonLd>[2] = [];
    const doc = blockToJsonLd(blocks.get("thm:main")!, PAPER, dangling);
    // Only the one that is genuinely ambiguous: a colon is present and no
    // segment is a known kind prefix, so namespace and label cannot be told
    // apart. A bare word has no such ambiguity and is not in this list.
    expect(dangling).toHaveLength(1);
    expect(dangling[0]!.ref).toBe("ns:mystery:bogus");
    expect(dangling[0]!.field).toBe("uses");
    expect(JSON.stringify(doc)).not.toContain("mystery");
  });

  test("a prefix-less reference is reported as unconventional, not dropped", () => {
    // The two lists exist so the convention stays visible without the edge
    // being the thing that pays for it. Kept apart because they need opposite
    // responses: dangling is data loss, this is a naming nit.
    const dangling: Parameters<typeof blockToJsonLd>[2] = [];
    const unconventional: NonNullable<Parameters<typeof blockToJsonLd>[3]> = [];
    const doc = blockToJsonLd(blocks.get("thm:main")!, PAPER, dangling, unconventional);
    expect(unconventional).toHaveLength(1);
    expect(unconventional[0]!.ref).toBe("bare-ref");
    expect(unconventional[0]!.field).toBe("uses");
    expect(JSON.stringify(doc)).toContain("papers/test-paper/blocks/bare-ref");
    expect(dangling.map((d) => d.ref)).not.toContain("bare-ref");
  });

  test("lean.ref stays a literal — a Lean decl is not a web resource", () => {
    const doc = blockToJsonLd(blocks.get("thm:main")!, PAPER, []);
    expect(doc.leanRef).toBe("qou:QOU.Main");
    expect(doc.sorryFree).toBe(true);
  });

  test("links companions that exist and omits those that do not", () => {
    const doc = blockToJsonLd(blocks.get("def:widget")!, PAPER, []);
    expect(doc.text).toBe("def-widget.md");
    expect(doc.leanSource).toBeUndefined();
  });

  test("cites become reference IRIs, and tags dedupe", () => {
    const doc = blockToJsonLd(blocks.get("def:widget")!, PAPER, []);
    expect(doc.cites).toEqual(["references/kock2004"]);
    expect(doc.tags).toEqual(["algebra"]);
  });

  test("marks provenance so ingested nodes stay distinguishable", () => {
    const doc = blockToJsonLd(blocks.get("def:widget")!, PAPER, []);
    expect(doc.provenance).toBe("authored");
  });

  test("output is byte-stable — the --check gate depends on it", () => {
    const a = JSON.stringify(blockToJsonLd(blocks.get("thm:main")!, PAPER, []), null, 2);
    const b = JSON.stringify(blockToJsonLd(blocks.get("thm:main")!, PAPER, []), null, 2);
    expect(a).toBe(b);
  });
});
