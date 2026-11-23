import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";

import { buildEntry, formatOf, frontMatterTitle, headingsOf, linesOf } from "../text-structure.ts";
import { TextStructureSchema, pagesOf, structureOf } from "../../schemas/content/document-structure.ts";

const f = (path: string, text: string) => ({ path, bytes: Buffer.from(text, "utf-8") });
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

const GHERKIN = [
  "---",
  "title: Gherkin Reference",
  "---",
  "Intro prose.",
  "",
  "# Keywords",
  "Some words.",
  "```gherkin",
  "# -- FILE: features/x.feature",
  "Feature: x",
  "```",
  "## Feature",
  "More words.",
  "",
].join("\n");

describe("a Markdown file is divided by its own headings", () => {
  const out = buildEntry([f("ref.md", GHERKIN)], "g");

  test("a `#` line inside fenced code is not a heading", () => {
    expect(headingsOf(linesOf(GHERKIN)).map((h) => h.title)).toEqual(["Keywords", "Feature"]);
  });

  test("the preamble is titled by the front matter, and keeps it verbatim", () => {
    expect(out.structure.sections.map((s) => s.title)).toEqual(["Gherkin Reference", "Keywords", "Feature"]);
    expect(out.sections.get(out.structure.sections[0]!.id)).toContain("title: Gherkin Reference");
    expect(out.structure.metadata.title).toBe("Gherkin Reference");
  });

  test("line ranges tile the file", () => {
    expect(out.structure.sections.map((s) => [s.line_start, s.line_end])).toEqual([[1, 5], [6, 11], [12, 13]]);
  });

  test("a single file's digest is the file's own", () => {
    expect(out.structure.source.sha256).toBe(sha(GHERKIN));
    expect(out.structure.source.digest).toBe("file");
  });

  test("it reads back through the shared accessor as the text variant, with no pages", () => {
    const s = structureOf(JSON.parse(JSON.stringify(out.structure)));
    if ("reason" in s) throw new Error(s.reason);
    expect(s.variant).toBe("text");
    expect(s.sections[1]!.locator).toEqual({ kind: "lines", file: "ref.md", start: 6, end: 11 });
    expect(pagesOf(s.sections[1]!)).toBeUndefined();
  });
});

describe("any other text is one section, verbatim", () => {
  const XML = '<?xml version="1.0"?>\n<div>\n<h2>Scope</h2>\n# not a heading\n</div>\n';

  test("markup that opens with `<` is never divided, even if a line looks like a heading", () => {
    expect(formatOf(XML)).toBe("verbatim");
    const out = buildEntry([f("a.xml", XML)], "x");
    expect(out.structure.sections).toHaveLength(1);
    expect(out.structure.sections[0]!.unit).toBe("file");
    expect(out.structure.toc_source).toBe("files");
    expect(out.sections.get(out.structure.sections[0]!.id)).toContain("```xml\n" + XML.trimEnd() + "\n```");
  });
});

describe("several files are one source", () => {
  const a = "# A\none\n";
  const b = "<x/>\n";
  const img = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  const out = buildEntry([f("d/a.md", a), f("d/b.xml", b), { path: "d/p.png", bytes: img, image: true }], "bundle");

  test("the digest is that of the sha256sum listing, in files order — recomputable without this code", () => {
    const listing = `${sha(a)}  d/a.md\n${sha(b)}  d/b.xml\n${createHash("sha256").update(img).digest("hex")}  d/p.png\n`;
    expect(out.structure.source.sha256).toBe(sha(listing));
    expect(out.structure.source.digest).toBe("listing");
  });

  test("an image is recorded with its digest and never sectioned", () => {
    expect(out.structure.source.files.map((x) => x.format)).toEqual(["markdown", "verbatim", "image"]);
    expect(out.structure.sections.map((s) => s.file)).toEqual(["d/a.md", "d/b.xml"]);
  });

  test("images present means images could not be determined, never `none`", () => {
    expect(out.images.images).toBeNull();
    expect(out.images.undetermined_reason).toContain("1 image file(s)");
  });

  test("no image at all is the determined empty list", () => {
    expect(buildEntry([f("a.md", a)], "a").images.images).toEqual([]);
  });
});

describe("the schema", () => {
  test("refuses an upstream commit that is not a full sha", () => {
    expect(() =>
      buildEntry([f("a.md", "# A\n")], "a", {
        upstream: { repository: "https://example.org/r", commit: "abc", ref: "main", committed: "x", path: "a.md", published: "y", retrieved: "z" },
      }),
    ).toThrow();
  });

  test("refuses a section that ends before it starts", () => {
    const s = JSON.parse(JSON.stringify(buildEntry([f("a.md", "# A\nx\n")], "a").structure));
    s.sections[0].line_end = 0;
    expect(TextStructureSchema.safeParse(s).success).toBe(false);
  });

  test("front-matter titles are unquoted", () => {
    expect(frontMatterTitle(linesOf('---\ntitle: "Quoted"\n---\n# H\n'))).toBe("Quoted");
  });
});

describe("formatOf reads the extension before the content", () => {
  const PY = "#!/usr/bin/env python3\n# Constants from the HCERT specification\nX = 1\n";
  test("a Python file with # comments is verbatim, not markdown", () => {
    expect(formatOf(PY, "input/scripts/generate_dvc_qr.py")).toBe("verbatim");
  });
  test("without a path, content still decides (unchanged behaviour)", () => {
    expect(formatOf(PY)).toBe("markdown");
  });
  test("a .md file with headings is markdown", () => {
    expect(formatOf("# Title\n\ntext\n", "docs/page.md")).toBe("markdown");
  });
  test("buildEntry keeps a .py file as one verbatim section", () => {
    const e = buildEntry([{ path: "gen.py", bytes: Buffer.from(PY) }], "x");
    expect(e.structure.sections).toHaveLength(1);
  });
});

