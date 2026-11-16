/**
 * Slide decks, PPTX and ODP — bean `scfh`, issue #1614.
 *
 * The owner sent one deck twice, as `.pptx` and `.odp`, and asked which is
 * more accessible. Each fixture here is a two-slide deck written by `zipfile`
 * at test time and shaped like the real exports: slide 1 has a title
 * PLACEHOLDER, slide 2 has only a loose text box (which must NOT become its
 * title), and the pictures carry one real alt text, one editor auto-caption and
 * one with none. The ODP copy drops the alt text, as Google's ODP export of
 * the #1614 deck did (0 of 39 images kept one).
 *
 * @module scripts/tests/slides-structure
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { PdfStructureSchema } from "../../schemas/ui/pdf-structure.ts";
import { type SlidesAccessibility, SlidesAccessibilitySchema } from "../../schemas/ui/slides-accessibility.ts";
import { ImagesSidecarSchema } from "../../schemas/content/document-image.ts";
import { attributionFor } from "../apply-image-verdicts.ts";
import { planFor } from "../ingest-document.ts";

const SCRIPT = resolve(import.meta.dir, "../slides-structure.py");
const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});
function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), "slides-"));
  made.push(d);
  return d;
}
function py(src: string, ...args: string[]): string {
  const r = Bun.spawnSync(["python3", "-c", src, ...args]);
  if (r.exitCode !== 0) throw new Error(new TextDecoder().decode(r.stderr));
  return new TextDecoder().decode(r.stdout);
}

/** A 1×1 PNG — enough bytes to be an image member. */
const PNG =
  "b'\\x89PNG\\r\\n\\x1a\\n\\x00\\x00\\x00\\rIHDR\\x00\\x00\\x00\\x01\\x00\\x00\\x00\\x01\\x08\\x06\\x00\\x00\\x00\\x1f\\x15\\xc4\\x89\\x00\\x00\\x00\\rIDATx\\x9cc\\xf8\\x0f\\x00\\x00\\x01\\x01\\x00\\x05\\x18\\xd8N\\x00\\x00\\x00\\x00IEND\\xaeB`\\x82'";

function pptx(dir: string): string {
  const p = join(dir, "deck.pptx");
  py(
    [
      "import zipfile, sys",
      "P='http://schemas.openxmlformats.org/presentationml/2006/main'",
      "A='http://schemas.openxmlformats.org/drawingml/2006/main'",
      "R='http://schemas.openxmlformats.org/officeDocument/2006/relationships'",
      "REL='http://schemas.openxmlformats.org/package/2006/relationships'",
      "z = zipfile.ZipFile(sys.argv[1], 'w')",
      "z.writestr('[Content_Types].xml', '<Types/>')",
      "z.writestr('ppt/presentation.xml', f'<p:presentation xmlns:p=\"{P}\" xmlns:r=\"{R}\"><p:sldIdLst>'",
      "  '<p:sldId id=\"256\" r:id=\"rId2\"/><p:sldId id=\"257\" r:id=\"rId3\"/></p:sldIdLst>'",
      "  '<p:sldSz cx=\"1000\" cy=\"1000\"/></p:presentation>')",
      "z.writestr('ppt/_rels/presentation.xml.rels', f'<Relationships xmlns=\"{REL}\">'",
      "  '<Relationship Id=\"rId2\" Target=\"slides/slide1.xml\"/><Relationship Id=\"rId3\" Target=\"slides/slide2.xml\"/></Relationships>')",
      "def pic(i, rid, descr, cx):",
      "    d = f' descr=\"{descr}\"' if descr else ''",
      "    return (f'<p:pic><p:nvPicPr><p:cNvPr id=\"{i}\" name=\"Pic {i}\"{d}/></p:nvPicPr>'",
      "            f'<p:blipFill><a:blip r:embed=\"{rid}\"/></p:blipFill>'",
      "            f'<p:spPr><a:xfrm><a:off x=\"0\" y=\"0\"/><a:ext cx=\"{cx}\" cy=\"{cx}\"/></a:xfrm></p:spPr></p:pic>')",
      "def sp(text, ph=None):",
      "    phx = f'<p:nvPr><p:ph type=\"{ph}\"/></p:nvPr>' if ph else '<p:nvPr/>'",
      "    return (f'<p:sp><p:nvSpPr><p:cNvPr id=\"9\" name=\"t\"/><p:cNvSpPr/>{phx}</p:nvSpPr>'",
      "            f'<p:txBody><a:p><a:r><a:rPr lang=\"en-GB\"/><a:t>{text}</a:t></a:r></a:p></p:txBody></p:sp>')",
      "def slide(body):",
      "    return f'<p:sld xmlns:p=\"{P}\" xmlns:a=\"{A}\" xmlns:r=\"{R}\"><p:cSld><p:spTree>{body}</p:spTree></p:cSld></p:sld>'",
      "z.writestr('ppt/slides/slide1.xml', slide(sp('The layers', 'title') + sp('Body text') + pic(2, 'rId1', 'Nine DAK components as cards', 500)))",
      "z.writestr('ppt/slides/slide2.xml', slide(sp('BIG LOOSE HEADING') + pic(3, 'rId1', '', 1000)",
      "  + pic(4, 'rId2', 'A screenshot of a post&#10;&#10;Description automatically generated', 100)))",
      "for n, rels in ((1, '<Relationship Id=\"rId1\" Target=\"../media/image1.png\"/>'),",
      "                (2, '<Relationship Id=\"rId1\" Target=\"../media/image1.png\"/><Relationship Id=\"rId2\" Target=\"../media/image2.png\"/>'",
      "                    '<Relationship Id=\"rId9\" Target=\"../notesSlides/notesSlide2.xml\"/>')):",
      "    z.writestr(f'ppt/slides/_rels/slide{n}.xml.rels', f'<Relationships xmlns=\"{REL}\">{rels}</Relationships>')",
      `z.writestr('ppt/media/image1.png', ${PNG})`,
      `z.writestr('ppt/media/image2.png', ${PNG} + b'x')`,
      "z.writestr('ppt/notesSlides/notesSlide2.xml', f'<p:notes xmlns:p=\"{P}\" xmlns:a=\"{A}\"><p:cSld><p:spTree>'",
      "  + sp('Say this aloud', 'body') + sp('2', 'sldNum') + '</p:spTree></p:cSld></p:notes>')",
      "z.close()",
    ].join("\n"),
    p,
  );
  return p;
}

function odp(dir: string): string {
  const p = join(dir, "deck.odp");
  py(
    [
      "import zipfile, sys",
      "ns = ('xmlns:office=\"urn:oasis:names:tc:opendocument:xmlns:office:1.0\" '",
      "      'xmlns:draw=\"urn:oasis:names:tc:opendocument:xmlns:drawing:1.0\" '",
      "      'xmlns:text=\"urn:oasis:names:tc:opendocument:xmlns:text:1.0\" '",
      "      'xmlns:svg=\"urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0\" '",
      "      'xmlns:presentation=\"urn:oasis:names:tc:opendocument:xmlns:presentation:1.0\" '",
      "      'xmlns:style=\"urn:oasis:names:tc:opendocument:xmlns:style:1.0\" '",
      "      'xmlns:fo=\"urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0\" '",
      "      'xmlns:xlink=\"http://www.w3.org/1999/xlink\"')",
      "z = zipfile.ZipFile(sys.argv[1], 'w')",
      "z.writestr('mimetype', 'application/vnd.oasis.opendocument.presentation')",
      "def img(href, w):",
      "    return f'<draw:frame svg:width=\"{w}cm\" svg:height=\"{w}cm\"><draw:image xlink:href=\"{href}\"/></draw:frame>'",
      "def box(t, cls=None):",
      "    c = f' presentation:class=\"{cls}\"' if cls else ''",
      "    return f'<draw:frame{c}><draw:text-box><text:p>{t}</text:p></draw:text-box></draw:frame>'",
      "z.writestr('content.xml', f'<office:document-content {ns}><office:body><office:presentation>'",
      "  '<draw:page draw:name=\"p1\">' + box('The layers', 'title') + box('Body text') + img('Pictures/a.png', 5) + '</draw:page>'",
      "  '<draw:page draw:name=\"p2\">' + box('BIG LOOSE HEADING') + img('Pictures/a.png', 10) + img('Pictures/b.png', 1)",
      "  + '<presentation:notes><draw:frame presentation:class=\"notes\"><draw:text-box><text:p>Say this aloud</text:p></draw:text-box></draw:frame></presentation:notes>'",
      "  '</draw:page></office:presentation></office:body></office:document-content>')",
      "z.writestr('styles.xml', f'<office:document-styles {ns}><office:styles><style:default-style>'",
      "  '<style:text-properties fo:language=\"en\"/></style:default-style></office:styles><office:automatic-styles>'",
      "  '<style:page-layout style:name=\"PM1\"><style:page-layout-properties fo:page-width=\"10cm\" fo:page-height=\"10cm\"/>'",
      "  '</style:page-layout></office:automatic-styles></office:document-styles>')",
      `z.writestr('Pictures/a.png', ${PNG})`,
      `z.writestr('Pictures/b.png', ${PNG} + b'x')`,
      "z.close()",
    ].join("\n"),
    p,
  );
  return p;
}

function a11y(...files: string[]): SlidesAccessibility[] {
  const r = Bun.spawnSync(["python3", SCRIPT, "--a11y-only", "--json", ...files]);
  if (r.exitCode !== 0) throw new Error(new TextDecoder().decode(r.stderr));
  return SlidesAccessibilitySchema.array().parse(JSON.parse(new TextDecoder().decode(r.stdout)));
}

describe("routing", () => {
  test("both formats route to the slides rung by their declared package type", () => {
    const d = tmp();
    for (const f of [pptx(d), odp(d)]) {
      const plan = planFor(f, undefined, d);
      expect(plan.rung).toBe("slides");
      expect(plan.steps[0]![1]).toEndWith("slides-structure.py");
    }
  });
});

describe("accessibility report", () => {
  test("PPTX: title placeholder only, alt verdicts, per-run language", () => {
    const [r] = a11y(pptx(tmp()));
    const c = r!.checks;
    // Slide 2's big loose text box is NOT a title — the inferred-title refusal.
    expect(c["slide-titles"]).toMatchObject({ pass: 1, fail: 1, failing_slides: [2] });
    expect(c["alt-text"]).toMatchObject({ pictures: 3, ok: 1, missing: 1, "auto-generated": 1 });
    expect(c.language).toMatchObject({ languages: ["en-GB"], scope: "per-run", pass: true });
    expect(c["document-title"].pass).toBe(false);
    expect(c["speaker-notes"].slides_with_notes).toEqual([2]);
    // The third state is stated, never omitted.
    for (const k of ["reading-order", "images-of-text", "contrast"] as const) expect(c[k].state).toBe("undetermined");
  });

  test("ODP export without alt text, language only on the default style", () => {
    const [r] = a11y(odp(tmp()));
    const c = r!.checks;
    expect(c["slide-titles"]).toMatchObject({ pass: 1, failing_slides: [2] });
    expect(c["alt-text"]).toMatchObject({ pictures: 3, ok: 0, missing: 3 });
    expect(c.language).toMatchObject({ scope: "default-style", pass: true });
    expect(c["speaker-notes"].slides_with_notes).toEqual([2]);
  });
});

describe("L1 entry", () => {
  test("writes pdf-structure/v1 at slide granularity, and schema-valid images", () => {
    const d = tmp();
    const r = Bun.spawnSync(["python3", SCRIPT, "-o", d, pptx(d)]);
    expect(r.exitCode).toBe(0);
    const st = PdfStructureSchema.parse(JSON.parse(readFileSync(join(d, "deck", "structure.json"), "utf-8")));
    expect(st.granularity).toBe("slide");
    expect(st.source.mimetype_source).toBe("zip-package");
    expect(st.sections.map((s) => s.title)).toEqual(["The layers", "Slide 2"]);
    const md = readFileSync(join(d, "deck", "sections", "slide-002.md"), "utf-8");
    expect(md).toContain("title_source: none");
    expect(md).toContain("## Speaker notes");
    expect(md).not.toContain("\n2\n"); // the slide-number placeholder is furniture
    const imgs = ImagesSidecarSchema.parse(JSON.parse(readFileSync(join(d, "deck", "images.json"), "utf-8")));
    // image1 is placed on both slides: ONE image, two placements.
    expect(imgs.images).toHaveLength(2);
    expect(imgs.images![0]!.placements?.map((p) => p.page)).toEqual([1, 2]);
    // Full-bleed and alone would be a page-scan in a PDF; on a slide it is content.
    expect(imgs.images!.every((i) => i.role === "figure")).toBe(true);
  });
});

describe("verdict attribution", () => {
  test("a document's own attribution wins over the file's", () => {
    const vf = {
      inspected_by: { kind: "agent", id: "a" },
      inspected_at: "2026-09-22",
      attribution: { deck: { inspected_by: { kind: "human", id: "b" }, inspected_at: "2026-09-30" } },
      verdicts: {},
    };
    expect(attributionFor(vf, "deck").at).toBe("2026-09-30");
    expect(attributionFor(vf, "other").at).toBe("2026-09-22");
  });
});
