import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { folioAnchors } from "./review-anchors-from-folio.ts";

/** A two-chapter folio, the smallest that exercises sections, subsections and a block with no prose. */
function fixture(): string {
  const repo = mkdtempSync(join(tmpdir(), "anchors-"));
  const folio = join(repo, "folio", "doc");
  mkdirSync(join(folio, "intro"), { recursive: true });
  mkdirSync(join(folio, "body"), { recursive: true });
  mkdirSync(join(repo, "library"), { recursive: true });
  writeFileSync(join(repo, "library", "outline.md"), "# Outline\n");
  writeFileSync(join(folio, "doc.ts"), `export default { chapters: [{ dir: "intro" }, { dir: "body" }] };`);
  writeFileSync(join(folio, "intro", "intro.ts"),
    `export default { title: "Introduction", number: 1, label: "ch:intro", sections: [{ title: "1.1 Why", label: "sec:why", blocks: ["why"] }] };`);
  writeFileSync(join(folio, "intro", "why.ts"), `export default { kind: "prose", label: "blk:why" };`);
  writeFileSync(join(folio, "intro", "why.md"), "Because **health workers** matter.\n");
  writeFileSync(join(folio, "body", "body.ts"),
    `export default { title: "Body", label: "ch:body", sections: [{ title: "2.1 Parts", blocks: [], subsections: [{ title: "2.1.1 One", label: "sec:one", blocks: ["fig"] }] }] };`);
  writeFileSync(join(folio, "body", "fig.ts"), `export default { kind: "diagram", caption: "A figure" };`);
  return repo;
}

describe("review anchors from the working document", () => {
  test("indexesInReadingOrder", async () => {
    const repo = fixture();
    const a = JSON.parse(await folioAnchors({ repo, document: "doc", library: "outline", source: "library/outline.md", sourceLabel: "the outline" }));
    expect(a.$schema).toBe("folio-review-anchors/v1");
    expect(a.chapters.map((c: { dir: string }) => c.dir)).toEqual(["intro", "body"]);
    expect(a.sections.map((s: { label: string }) => s.label)).toEqual(["sec:why", "sec:body-1", "sec:one"]);
    expect(a.sections[0].number).toBe("1.1");
    expect(a.sections[2].parent).toBe("sec:body-1");
    expect(a.blocks.map((b: { label: string }) => b.label)).toEqual(["blk:why", "fig"]);
    expect(a.blocks[0].excerpt).toBe("Because health workers matter.");
    expect(a.blocks[1]).toMatchObject({ caption: "A figure", sections: ["sec:body-1", "sec:one"], excerpt: "" });
    expect(a.source.docx.file).toBe("library/outline.md");
    expect(a.source.docx.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  test("deterministic", async () => {
    const repo = fixture();
    const o = { repo, document: "doc", library: "outline", source: "library/outline.md", sourceLabel: "the outline" };
    expect(await folioAnchors(o)).toBe(await folioAnchors(o));
  });

  test("noSeedFile", async () => {
    const repo = fixture();
    const a = JSON.parse(await folioAnchors({ repo, document: "doc" }));
    expect(a.library).toBeUndefined();
    expect(a.source).toBeUndefined();
    expect(a.sections.length).toBe(3);
  });
});
