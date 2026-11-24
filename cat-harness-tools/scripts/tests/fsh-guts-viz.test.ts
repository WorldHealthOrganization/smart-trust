/**
 * The two ways `gen-fsh-guts-viz` misread a non-markdown node.
 *
 * @module scripts/tests/fsh-guts-viz.test
 * @graphNode none — a test
 *
 * Both were found on 2026-09-30, the moment bean `q7ey`'s sweep put 33
 * archived PDFs and 7 extraction records into `fsh-guts/uploads/`. Neither is
 * about the sweep: both had been live since the viewer was written, with one
 * pre-existing file (`detangle-schema-viewer.html`) sitting in the first of
 * them the whole time. They are here because a generator that reports a false
 * finding, and a generator that prints binary onto a page, are the two
 * failures a reader cannot tell from correct output.
 *
 * The tests of this file that read the whole checkout (reads the root-declared
 * `fsh-guts/` graph) live in `test/fsh-guts-viz-checkout.test.ts` (bean
 * `7zz1`): standing alone, cat-harness has none of it.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { gutsFiles, page } from "../gen-fsh-guts-viz.ts";

const TAG = "$schema: folio-fsh-guts/v1";
const sidecar = (title: string) => `---\n${TAG}\ntitle: "${title}"\nkind: source\n---\n\n# ${title}\n`;

function corpus(files: Record<string, string | Uint8Array>): string {
  const dir = mkdtempSync(join(tmpdir(), "guts-"));
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(dir, rel);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, body);
  }
  return dir;
}

describe("a sidecar describes ANY format that cannot carry front matter", () => {
  test("not just the .py/.ts/.sh the rule used to list", () => {
    // The extension list answered a narrower question than the docblock
    // stated. A PDF can no more carry YAML than a `.py` can.
    const dir = corpus({
      "uploads/paper.pdf": new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
      "uploads/paper.md": sidecar("paper.pdf"),
      "uploads/paper.pdf.extraction.json": '{"ok":true}',
      "uploads/paper.pdf.extraction.md": sidecar("paper.pdf.extraction.json"),
      "retired/page.html": "<html></html>",
      "retired/page.md": sidecar("page.html"),
      "scripts/tool.py": "print(1)\n",
      "scripts/tool.md": sidecar("tool.py"),
    });
    try {
      const byRel = new Map(gutsFiles(dir).map((f) => [f.rel, f.state]));
      for (const rel of [
        "uploads/paper.pdf",
        "uploads/paper.pdf.extraction.json",
        "retired/page.html",
        "scripts/tool.py",
      ]) {
        expect(byRel.get(rel), `${rel} should be described by its sidecar`).toBe("sidecar");
      }
      // The sidecars themselves are declared, not sidecar-described.
      expect(byRel.get("uploads/paper.md")).toBe("declared");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a non-markdown file with NO sidecar is still a finding", () => {
    // The widening must not turn an actual gap into a pass. Six `.py` scripts
    // in the real corpus have no sidecar and must keep reporting as gaps.
    const dir = corpus({ "scripts/orphan.py": "print(1)\n" });
    try {
      expect(gutsFiles(dir)[0]?.state).toBe("undeclared");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("a title is read from markdown only", () => {
  test("binary is never scraped for a heading", () => {
    // `readFileSync(..., "utf-8")` does NOT throw on a PDF: it substitutes
    // U+FFFD for every invalid sequence and returns a string, so `/^#\s+/m`
    // matched inside compressed streams and four rows of the rendered table
    // came out as mojibake.
    const bytes = Buffer.from("%PDF-1.7\n\x80\x81# Not a heading\n\xfe\xff", "latin1");
    const dir = corpus({ "uploads/x.pdf": new Uint8Array(bytes) });
    try {
      const f = gutsFiles(dir)[0]!;
      expect(f.rel).toBe("uploads/x.pdf");
      expect(f.title).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a markdown node still yields its heading", () => {
    const dir = corpus({ "retired/a.md": sidecar("A retired thing") });
    try {
      expect(gutsFiles(dir)[0]?.title).toBe("A retired thing");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("page lede and links (folio-assistant-oi3h)", () => {
  test("lede explains count relationship with interactive viewer", () => {
    const rendered = page(
      [
        { rel: "retired/a.md", group: "retired", state: "declared", title: "A" },
        { rel: "scripts/b.py", group: "scripts", state: "undeclared" },
      ],
      "https://github.com/litlfred/folio-assistant/blob/main/fsh-guts",
    );
    expect(rendered).toContain("Count relationship:");
    expect(rendered).toContain("interactive viewer");
    expect(rendered).toContain("Settings → Discarded");
  });

  test("file links are marked as external links to GitHub", () => {
    const rendered = page(
      [{ rel: "retired/a.md", group: "retired", state: "declared", title: "A" }],
      "https://github.com/litlfred/folio-assistant/blob/main/fsh-guts",
    );
    expect(rendered).toContain('target="_blank"');
    expect(rendered).toContain('rel="noopener noreferrer"');
    expect(rendered).toContain('title="View on GitHub"');
    expect(rendered).toContain("↗");
  });
});


describe("an existing, empty store", () => {
  // A downstream's freshly seeded cat/<instance>/fsh-guts holds nothing yet. Its
  // index says so; refusing it failed every site build that owes the page.
  test("renders an index that says 0 file(s), not an error", () => {
    const rendered = page([], "https://github.com/x/y/blob/main/fsh-guts");
    expect(rendered).toContain("**0 file(s)** across 0 group(s)");
  });
});
