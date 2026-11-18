import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildEntry, openingHeading } from "../notebook-structure.ts";
import { structureOf } from "../../schemas/content/document-structure.ts";

const SRC = { file: "t.ipynb", sha256: "b".repeat(64), bytes: 1, mtime: null };
const md = (s: string) => ({ cell_type: "markdown", source: s });
const code = (s: string) => ({ cell_type: "code", source: [s] });
const nb = (cells: Array<{ cell_type: string; source: string | string[] }>) => ({
  nbformat: 4,
  nbformat_minor: 5,
  metadata: { kernelspec: { language: "python" } },
  cells,
});

describe("sections follow the author's headings", () => {
  const out = buildEntry(nb([md("intro text"), md("# Title\nwords"), code("x = 1"), md("## Part\nmore")]), SRC, "t");

  test("a preamble before the first heading is kept as its own section", () => {
    expect(out.structure.sections.map((s) => s.title)).toEqual(["Preamble", "Title", "Part"]);
    expect(out.structure.toc_source).toBe("headings");
  });

  test("cell ranges tile the notebook, and code cells are counted where they sit", () => {
    const r = out.structure.sections.map((s) => [s.cell_start, s.cell_end, s.code_cells]);
    expect(r).toEqual([[0, 0, 0], [1, 2, 1], [3, 3, 0]]);
  });

  test("code is fenced with the declared language and never run", () => {
    const body = out.sections.get(out.structure.sections[1]!.id)!;
    expect(body).toContain("```python\nx = 1\n```");
  });

  test("the output reads back through the shared accessor as the notebook variant", () => {
    const s = structureOf(JSON.parse(JSON.stringify(out.structure)));
    expect("reason" in s ? s.reason : s.variant).toBe("notebook");
  });
});

describe("a notebook with no heading", () => {
  test("is one section, and says no structure was inferred", () => {
    const out = buildEntry(nb([md("just prose"), code("y = 2")]), SRC, "t");
    expect(out.structure.toc_source).toBe("none");
    expect(out.structure.sections).toHaveLength(1);
    expect(out.structure.structure_note).toContain("no markdown heading");
  });
});

describe("what opens a section", () => {
  test("only a markdown cell whose first line is a heading", () => {
    expect(openingHeading(md("## A heading"))).toEqual({ level: 2, title: "A heading" });
    expect(openingHeading(md("text\n# later heading"))).toBeUndefined();
    expect(openingHeading(code("# a python comment"))).toBeUndefined();
  });
});

describe("ingest-document routes a notebook by its CONTENT (bean rkqp)", () => {
  test("JSON with nbformat and cells goes to the notebook rung, whatever its name", async () => {
    const { planFor } = await import("../ingest-document.ts");
    const dir = mkdtempSync(join(tmpdir(), "nb-route-"));
    try {
      // Named .txt on purpose: the extension is a claim, the content decides.
      const f = join(dir, "not-called-ipynb.txt");
      writeFileSync(f, JSON.stringify(nb([md("# T")])));
      const p = planFor(f, undefined, dir, null);
      expect(p.rung).toBe("notebook");
      expect(p.steps[0]!.join(" ")).toContain("notebook-structure.ts");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("JSON that is not a notebook is not routed there", async () => {
    const { isNotebook } = await import("../ingest-document.ts");
    const dir = mkdtempSync(join(tmpdir(), "nb-route-"));
    try {
      const f = join(dir, "x.ipynb");
      writeFileSync(f, JSON.stringify({ cells: [] }));
      expect(isNotebook(f)).toBe(false);
      writeFileSync(f, "not json at all");
      expect(isNotebook(f)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("the images sidecar says only what the notebook supports", () => {
  test("no image anywhere is the determined empty list", () => {
    expect(buildEntry(nb([md("# T\ntext")]), SRC, "t").images.images).toEqual([]);
  });
  test("an image output or a markdown image is COULD NOT DETERMINE, with the count", () => {
    const withImg = nb([md("# T\n![fig](a.png)"), { cell_type: "code", source: "plot()", outputs: [{ data: { "image/png": "x" } }] } as never]);
    const im = buildEntry(withImg, SRC, "t").images;
    expect(im.images).toBeNull();
    expect(im.undetermined_reason).toContain("1 image output(s), 1 markdown image(s)");
  });
});

describe("the PDF-only arms never run on a notebook (bean rkqp)", () => {
  test("a notebook gets its rung and l1-blocks, and no image, table or vector arm", async () => {
    const { planFor, withDerivedArms } = await import("../ingest-document.ts");
    const dir = mkdtempSync(join(tmpdir(), "nb-arms-"));
    try {
      const f = join(dir, "n.ipynb");
      writeFileSync(f, JSON.stringify(nb([md("# T")])));
      const plan = withDerivedArms(planFor(f, undefined, dir, null), f, dir, join(dir, "n"), dir);
      const scripts = plan.steps.map((s) => s.find((a) => /\.(py|ts)$/.test(a))!.split("/").pop());
      expect(scripts).toEqual(["notebook-structure.ts", "l1-blocks.ts", "extract-candidates.py"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
