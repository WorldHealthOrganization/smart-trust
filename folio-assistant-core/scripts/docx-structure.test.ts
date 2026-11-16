/**
 * docx-structure.py → docx-to-folio.ts on a minimal .docx built here:
 * pictures inside table cells stay in the cell, and a drawing Word shows
 * rotated (`a:xfrm rot`) is referenced as a rotated copy.
 *
 * Regression for litlfred/smart-ra#6 (fixed by hand in smart-ra#7): Tables 3.1
 * and 3.2 of the DPI-H reference architecture came out with empty icon cells,
 * a stray figure block per icon after each table, and Table 3.2's arrows
 * standing upright because their 90°/270° rotation was ignored.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { convert, type LineMap, type Structure } from "./docx-to-folio.js";

const HERE = import.meta.dir;

// Builds the .docx with the standard library only: two 2×4 PNGs (portrait),
// a 3-row table (header, an unrotated icon, an icon rotated 90° clockwise),
// and a standalone picture after it, which must stay a figure.
const BUILD = String.raw`
import struct, sys, zlib, zipfile

def png(w, h, rgb):
    raw = b"".join(b"\x00" + bytes(rgb) * w for _ in range(h))
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))

NS = ('xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
      'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" '
      'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
      'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"')

def drawing(rid, name, rot=None):
    xfrm = f'<a:xfrm rot="{rot}">' if rot else '<a:xfrm>'
    return (f'<w:r><w:drawing><wp:inline><wp:docPr id="1" name="{name}"/><a:graphic><a:graphicData>'
            f'<pic:pic><pic:blipFill><a:blip r:embed="{rid}"/></pic:blipFill>'
            f'<pic:spPr>{xfrm}<a:off x="0" y="0"/><a:ext cx="1" cy="1"/></a:xfrm></pic:spPr>'
            f'</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>')

def p(inner):
    return f"<w:p>{inner}</w:p>"

def t(s, bold=False):
    return f'<w:r>{"<w:rPr><w:b/></w:rPr>" if bold else ""}<w:t>{s}</w:t></w:r>'

def tc(inner):
    return f"<w:tc>{p(inner)}</w:tc>"

body = (
    p(t("Table 1: Icons"))
    + "<w:tbl>"
    + "<w:tr>" + tc(t("Icon", True)) + tc(t("Name", True)) + "</w:tr>"
    + "<w:tr>" + tc(drawing("rId1", "Picture 1")) + tc(t("Widget", True)) + "</w:tr>"
    + "<w:tr>" + tc(drawing("rId2", "Picture 2", rot=5400000)) + tc(t("Arrow", True)) + "</w:tr>"
    + "</w:tbl>"
    + p(drawing("rId3", "Picture 3"))
)
doc = f'<?xml version="1.0" encoding="UTF-8"?><w:document {NS}><w:body>{body}</w:body></w:document>'
rels = ('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + "".join(f'<Relationship Id="rId{i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image{i}.png"/>' for i in (1, 2, 3))
        + "</Relationships>")
with zipfile.ZipFile(sys.argv[1], "w") as z:
    z.writestr("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>')
    z.writestr("word/document.xml", doc)
    z.writestr("word/_rels/document.xml.rels", rels)
    for i, rgb in ((1, (255, 0, 0)), (2, (0, 255, 0)), (3, (0, 0, 255))):
        z.writestr(f"word/media/image{i}.png", png(2, 4, rgb))
`;

/** Width and height from a PNG's IHDR. */
const pngSize = (path: string) => {
  const b = readFileSync(path);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

let dir = "";
let structure: Structure;
let hasPillow = false;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "docx-cell-images-"));
  writeFileSync(join(dir, "build.py"), BUILD);
  const run = (cmd: string[]) => {
    const r = Bun.spawnSync(cmd, { cwd: dir });
    if (r.exitCode !== 0) throw new Error(`${cmd.join(" ")}: ${r.stderr.toString()}`);
  };
  run(["python3", "build.py", "t.docx"]);
  run(["python3", join(HERE, "docx-structure.py"), "t.docx", "--out", "s.json", "--media-dir", "media"]);
  structure = JSON.parse(readFileSync(join(dir, "s.json"), "utf-8"));
  hasPillow = Bun.spawnSync(["python3", "-c", "import PIL"]).exitCode === 0;
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("docx-structure: pictures in table cells", () => {
  test("cellPictureInCell", () => {
    const table = structure.items.find((i) => i.type === "table")!;
    expect(table.rows![1][0]).toBe("![Widget](media/image1.png)");
    expect(table.rows![2][0]).toMatch(/^!\[Arrow\]\(media\/image2(-rot90)?\.png\)$/);
  });

  test("noImageItemForCellPicture", () => {
    const images = structure.items.filter((i) => i.type === "image");
    expect(images.map((i) => i.media)).toEqual(["media/image3.png"]);
  });

  test("rotatedDrawingCopy", () => {
    if (!hasPillow) {
      // Recorded and warned, not silently dropped.
      expect(structure.warnings?.join(" ")).toContain("media/image2.png is rotated 90°");
      return;
    }
    expect(structure.rotations).toEqual({ "media/image2-rot90.png": { source: "media/image2.png", rot: 90 } });
    expect(structure.media).toContain("media/image2-rot90.png");
    expect(pngSize(join(dir, "media", "image2-rot90.png"))).toEqual([4, 2]);
    // The unrotated picture is copied as is.
    expect(pngSize(join(dir, "media", "image1.png"))).toEqual([2, 4]);
  });
});

describe("docx-to-folio: the table block holds its pictures", () => {
  const map = (): LineMap => ({
    source: { file: "t.pdf", sha256: "0", pages: 1 },
    pages: { "1": { printed: null } },
    alignment: structure.items.map((i) => ({ seq: i.seq, page: 1, method: "numbered" })),
  });

  test("tableBlockHoldsPictures", () => {
    const r = convert(structure, map(), { slug: "doc", library: "lib" });
    const table = r.anchors.blocks.find((b) => b.kind === "table")!;
    const md = r.files.find((f) => f.path.endsWith(`/${table.root}.md`))!.content;
    expect(md).toContain("| ![Widget](media/image1.png) | **Widget** |");
    expect(md).toContain(hasPillow ? "![Arrow](media/image2-rot90.png)" : "![Arrow](media/image2.png)");
    const figures = r.anchors.blocks.filter((b) => b.kind === "figure");
    expect(figures).toHaveLength(1);
    expect(r.files.find((f) => f.path.endsWith(`/${figures[0].root}.md`))!.content).toContain("media/image3.png");
    // Every referenced picture is in the copy list, the rotated copy included.
    expect(r.media.sort()).toEqual(
      ["media/image1.png", hasPillow ? "media/image2-rot90.png" : "media/image2.png", "media/image3.png"].sort(),
    );
  });
});
