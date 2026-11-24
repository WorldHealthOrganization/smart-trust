/**
 * `l1-blocks.ts` and `gen-library-jsonld.ts` must name a block the same way —
 * bean `xwi8`.
 *
 * @module scripts/tests/l1-blocks
 * @graphNode none — a test
 *
 * ## The defect this pins
 *
 * Both writers put a prose block in `blocks/` for every section. The arm named
 * it `prose-${section id}` — `prose-sec-001-introduction` — and the generator
 * names it `prose-sec-001` through `sectionKey()`. Only the generator's names
 * are referenced by a section node, so a document that went through both
 * carried a second, unreferenced, byte-identical copy of every prose block.
 * Measured 2026-09-23: 91 across four documents, every one identical to its
 * referenced twin apart from `@id`.
 *
 * The test runs BOTH writers on one staged entry and then asks the generator's
 * own orphan detector. A check on the arm's names alone would pass the day the
 * generator's rule changed — the drift this exists to catch.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { buildL1 } from "../l1-blocks.ts";
import { blockId, buildDocumentNodes, orphanedBlocks, sectionKey } from "../../pipeline/gen-library-jsonld.ts";

const SECTIONS = [
  { id: "sec-001-introduction", number: null, title: "Introduction", level: 1, page_start: 1, page_end: 2, n_chars: 13, n_words: 1 },
  { id: "sec-002-2-related-work", number: "2", title: "Related work", level: 1, page_start: 3, page_end: 4, n_chars: 13, n_words: 2 },
];

/** A staged entry: `structure.json` plus the section `.md` files it names. */
function staged(): { root: string; dir: string; docId: string } {
  const root = mkdtempSync(join(tmpdir(), "l1-"));
  const docId = "fixture-doc";
  const dir = join(root, docId);
  mkdirSync(join(dir, "sections"), { recursive: true });
  // A conforming `pdf-structure/v1`: `buildL1` reads through the shared
  // accessor (bean rkqp), which refuses an untagged file rather than guessing.
  writeFileSync(
    join(dir, "structure.json"),
    JSON.stringify({
      _schema: "pdf-structure/v1",
      doc_id: docId,
      source: { file: "fixture.pdf", sha256: "c".repeat(64), bytes: 1, mtime: null, mimetype_sniffed: "application/pdf", mimetype_source: "magic-bytes" },
      toc_source: "outline",
      sections: SECTIONS,
    }),
  );
  for (const s of SECTIONS) writeFileSync(join(dir, "sections", `${s.id}.md`), `# ${s.title}\n`);
  return { root, dir, docId };
}

const ls = (d: string): string[] => (existsSync(d) ? readdirSync(d) : []);
const rd = (p: string): string | undefined => (existsSync(p) ? readFileSync(p, "utf-8") : undefined);

describe("one naming rule for a prose block — bean `xwi8`", () => {
  test("the arm writes the generator's block ids, not the full section id", () => {
    const { root, dir } = staged();
    const r = buildL1(dir);
    expect(r.missing).toEqual([]);
    const written = ls(join(dir, "blocks")).sort();
    expect(written).toEqual(SECTIONS.map((s) => `${blockId("prose", sectionKey(s.id))}.jsonld`).sort());
    expect(written).toEqual(["prose-sec-001.jsonld", "prose-sec-002.jsonld"]);
    rmSync(root, { recursive: true, force: true });
  });

  test("the arm's manifest points at section NODES by the generator's name", () => {
    const { root, dir, docId } = staged();
    buildL1(dir);
    const m = JSON.parse(readFileSync(join(dir, "manifest.jsonld"), "utf-8")) as { contains: string[] };
    expect(m.contains).toEqual([`library/${docId}/sections/sec-001`, `library/${docId}/sections/sec-002`]);
    rmSync(root, { recursive: true, force: true });
  });

  test("both writers on one entry leave NO orphaned block", () => {
    const { root, dir, docId } = staged();
    buildL1(dir);
    const structure = JSON.parse(readFileSync(join(dir, "structure.json"), "utf-8"));
    const files = buildDocumentNodes(docId, structure, undefined, (sid) => existsSync(join(dir, "sections", `${sid}.md`)));
    expect(files.length).toBeGreaterThan(0); // the generator really ran
    for (const f of files) {
      mkdirSync(dirname(join(dir, f.path)), { recursive: true });
      writeFileSync(join(dir, f.path), f.content);
    }
    expect(ls(join(dir, "blocks")).length).toBeGreaterThan(0); // not vacuous
    expect(orphanedBlocks(dir, ls, rd)).toEqual([]);
    rmSync(root, { recursive: true, force: true });
  });
});
