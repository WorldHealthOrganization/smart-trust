#!/usr/bin/env python3
"""
docx-structure — a Word (.docx) document as an ordered list of typed items,
ready to become document blocks. Bean `xtpc`, issue #197.

Why a separate extractor from `pdf-structure.py`
-------------------------------------------------
A PDF gives page and line, but its structure is a guess made from font sizes
and outline entries, and its body text carries the line-number gutter. The
.docx gives the structure exactly (heading styles, list numbering, real
tables, embedded images, footnotes) but no pages or lines: Word computes
those at layout time and stores neither. So the two are complementary. This
script takes the STRUCTURE from the .docx, and `pdf-line-map.py` aligns each
item to the page and line numbers of the frozen, line-numbered review PDF.

Output (`docx-structure/v1`, JSON on stdout or --out):

    { "$schema": "docx-structure/v1",
      "source": {"file": ..., "sha256": ...},
      "items": [ {"seq": 0, "type": "heading", "level": 1, "style": "Title", "text": ..., "md": ...},
                 {"seq": 1, "type": "paragraph", "md": ..., "text": ...},
                 {"seq": 2, "type": "list", "ordered": false, "items": [{"level": 0, "md": ...}], "text": ...},
                 {"seq": 3, "type": "table", "rows": [[cell_md, ...], ...], "text": ...},
                 {"seq": 4, "type": "image", "media": "media/image3.png", "alt": ...},
                 {"seq": 5, "type": "callout", "md": ..., "text": ...},
                 {"seq": 6, "type": "caption", "target": "table"|"figure", "number": "3.1", "md": ...} ],
      "footnotes": {"5": "markdown"},
      "media": ["media/image1.png", ...],
      "rotations": {"media/image3-rot90.png": {"source": "media/image3.png", "rot": 90}},
      "warnings": [...] }

`text` is the plain text, used for alignment; `md` keeps bold, italic,
hyperlinks and footnote references (`[^5]`). The issue asks for "basic
formatting (bold, italic) preserved as much as possible, but not 1:1".

Images inside a table cell stay in the cell, as `![alt](media/imageN.png)`,
and get no image item of their own. The alt text is the row's adjacent cell
when that is a short label (an icon legend: picture | name | meaning), else
the drawing's `wp:docPr` descr or name, else "image".

Rotation: a drawing whose `a:xfrm` carries `rot` (60000ths of a degree,
clockwise) is shown rotated by Word, while the embedded file is not. Such an
image is referenced as a rotated copy, `media/imageN-rot90.png`, listed under
`rotations` and written rotated by `--media-dir` (Pillow). The original file
is left as it is. Without Pillow the original is referenced unrotated and the
rotation is recorded in `warnings`.

Text boxes: Word stores a drawing's text twice, once in `mc:Choice` and once
in `mc:Fallback`. Only the Choice is read, so a call-out box is not doubled.

Standard library only (no python-docx); Pillow, optional, only to write
rotated copies of rotated drawings.

Usage:
    python3 docx-structure.py <file.docx> [--out structure.json] [--media-dir DIR]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import zipfile
from pathlib import Path

import xml.etree.ElementTree as ET

# Standard library only: a .docx is a zip of XML, and this reads the parts it
# needs (document, styles, numbering, footnotes, relationships) directly.
W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
PKG_REL = "http://schemas.openxmlformats.org/package/2006/relationships"


def qn(tag: str) -> str:
    """`w:p` → Clark notation, as ElementTree names elements."""
    prefix, local = tag.split(":")
    return f"{{{ {'w': W, 'r': R_NS}[prefix] }}}{local}"

SCHEMA = "docx-structure/v1"
R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
WP_NS = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
MC_FALLBACK = "{http://schemas.openxmlformats.org/markup-compatibility/2006}Fallback"
CAPTION_RE = re.compile(r"^\s*(Table|Figure|Box)\s+([A-Z]?\.?\d+(?:\.\d+)*)\s*[:.\-—–]?\s*(.*)$", re.I)


def md_escape(s: str) -> str:
    # Only what would otherwise change meaning at the start of a Markdown line
    # or inside emphasis; prose is otherwise kept as written.
    return s.replace("\\", "\\\\").replace("*", "\\*").replace("_", "\\_").replace("<", "&lt;")


class Ctx:
    def __init__(self, z: zipfile.ZipFile) -> None:
        self.z = z
        self.rels = self.read_rels("word/_rels/document.xml.rels")
        self.media_used: list[str] = []
        # Rotated copy → its source and angle; written by --media-dir.
        self.rotations: dict[str, dict] = {}
        self.warnings: list[str] = []
        try:
            import PIL.Image  # noqa: F401
            self.can_rotate = True
        except ImportError:
            self.can_rotate = False
        self.styles: dict[str, str] = {}
        if "word/styles.xml" in z.namelist():
            for st in ET.fromstring(z.read("word/styles.xml")).iter(qn("w:style")):
                name = st.find(qn("w:name"))
                raw = name.get(qn("w:val")) if name is not None else st.get(qn("w:styleId"))
                # Built-in styles are stored lower-case ("heading 1", "title");
                # Word shows them capitalised, and that is the name used here.
                self.styles[st.get(qn("w:styleId"))] = raw[:1].upper() + raw[1:] if raw else "Normal"

    def read_rels(self, part: str) -> dict[str, tuple[str, bool]]:
        if part not in self.z.namelist():
            return {}
        return {
            r.get("Id"): (r.get("Target"), r.get("TargetMode") == "External")
            for r in ET.fromstring(self.z.read(part)).iter(f"{{{PKG_REL}}}Relationship")
        }

    def rel_target(self, rid: str) -> str | None:
        r = self.rels.get(rid)
        if r is None:
            return None
        target, external = r
        return target if external else target.lstrip("/").removeprefix("word/")

    def style(self, p_el) -> str:
        ps = p_el.find(qn("w:pPr") + "/" + qn("w:pStyle"))
        sid = ps.get(qn("w:val")) if ps is not None else None
        return self.styles.get(sid, "Normal") if sid else "Normal"


def wrap(text: str, bold: bool, italic: bool) -> str:
    if not text.strip():
        return text
    lead = text[: len(text) - len(text.lstrip())]
    trail = text[len(text.rstrip()):]
    core = text.strip()
    if bold and italic:
        core = f"***{core}***"
    elif bold:
        core = f"**{core}**"
    elif italic:
        core = f"*{core}*"
    return f"{lead}{core}{trail}"


def run_props(r) -> tuple[bool, bool, bool]:
    rpr = r.find(qn("w:rPr"))
    if rpr is None:
        return False, False, False

    def on(tag: str) -> bool:
        el = rpr.find(qn(tag))
        if el is None:
            return False
        v = el.get(qn("w:val"))
        return v not in ("0", "false", "none")

    va = rpr.find(qn("w:vertAlign"))
    sup = va is not None and va.get(qn("w:val")) == "superscript"
    return on("w:b"), on("w:i"), sup


def drawing_rotation(d) -> int:
    """Clockwise rotation in whole degrees Word applies to a drawing (0 if none)."""
    for x in d.iter(f"{{{A_NS}}}xfrm"):
        r = x.get("rot")
        if r:
            return round(int(r) / 60000) % 360
    return 0


def image_record(ctx: Ctx, d, tgt: str) -> dict:
    """An embedded picture: the media path to reference, after rotation."""
    pr = next(d.iter(f"{{{WP_NS}}}docPr"), None)
    rec = {
        "media": tgt,
        "descr": (pr.get("descr") or "").strip() if pr is not None else "",
        "name": (pr.get("name") or "").strip() if pr is not None else "",
    }
    rot = drawing_rotation(d)
    if rot:
        rec["rot"] = rot
        if ctx.can_rotate:
            stem, dot, ext = tgt.rpartition(".")
            rotated = f"{stem}-rot{rot}.{ext}" if dot else f"{tgt}-rot{rot}"
            ctx.rotations[rotated] = {"source": tgt, "rot": rot}
            rec["media"] = rotated
        else:
            msg = f"{tgt} is rotated {rot}° in Word but Pillow is not installed: referenced unrotated"
            if msg not in ctx.warnings:
                ctx.warnings.append(msg)
                print(f"⚠ {msg}", file=sys.stderr)
    return rec


def use_media(ctx: Ctx, m: str) -> None:
    if m not in ctx.media_used:
        ctx.media_used.append(m)


IMG_MARK = re.compile(r"\x00IMG(\d+)\x00")


def runs_md(ctx: Ctx, p_el, images: list[dict], inline: bool = False) -> tuple[str, str]:
    """Markdown and plain text of a paragraph element, in document order.

    Each picture is appended to `images`. With `inline` (a table cell) the
    picture also leaves a marker `\\x00IMG<i>\\x00` in the markdown at its
    position, which `table_item` replaces with `![alt](path)` once the row's
    labels are known."""
    md: list[str] = []
    plain: list[str] = []

    def visit(el, link: str | None = None) -> None:
        for child in el:
            tag = child.tag
            if tag == qn("w:r"):
                b, i, sup = run_props(child)
                buf: list[str] = []
                for t in child:
                    if t.tag == qn("w:t"):
                        buf.append(t.text or "")
                    elif t.tag == qn("w:tab"):
                        buf.append(" ")
                    elif t.tag in (qn("w:br"), qn("w:cr")):
                        buf.append(" ")
                    elif t.tag == qn("w:footnoteReference"):
                        fid = t.get(qn("w:id"))
                        md.append(f"[^{fid}]")
                    elif t.tag == qn("w:drawing") or t.tag.endswith("}AlternateContent") or t.tag == qn("w:pict"):
                        for blip in t.iter(f"{{{A_NS}}}blip"):
                            rid = blip.get(f"{{{R_NS}}}embed")
                            tgt = ctx.rel_target(rid) if rid else None
                            if tgt:
                                if inline:
                                    md.append(f"\x00IMG{len(images)}\x00")
                                images.append(image_record(ctx, t, tgt))
                text = "".join(buf)
                if text:
                    plain.append(text)
                    if sup and text.strip().isdigit():
                        # A typed superscript number is a citation marker in
                        # this kind of document; keep it visible but quiet.
                        md.append(f"<sup>{text.strip()}</sup>")
                    else:
                        piece = wrap(md_escape(text), b, i)
                        md.append(f"[{piece}]({link})" if link and piece.strip() else piece)
            elif tag == qn("w:hyperlink"):
                rid = child.get(f"{{{R_NS}}}id")
                url = ctx.rel_target(rid) if rid else None
                anchor = child.get(qn("w:anchor"))
                visit(child, url if url and url.startswith(("http", "mailto")) else link if not anchor else link)
            elif tag in (qn("w:ins"), qn("w:smartTag"), qn("w:sdt"), qn("w:sdtContent"), qn("w:fldSimple")):
                visit(child, link)
            # w:del (deleted text), bookmarks, proofErr: skipped on purpose.

    visit(p_el)
    out = "".join(md)
    # Merge adjacent emphasis that Word split across runs: "**a****b**" → "**ab**".
    out = re.sub(r"\*\*\*\*", "", out)
    out = re.sub(r"(?<!\*)\*\*(?!\*)", "**", out)
    return re.sub(r"[ \t]+", " ", out).strip(), re.sub(r"\s+", " ", "".join(plain)).strip()


def textbox_paragraphs(p_el):
    """Paragraphs inside a text box in this paragraph, skipping mc:Fallback copies."""
    skip = {id(x) for fb in p_el.iter(MC_FALLBACK) for x in fb.iter(qn("w:txbxContent"))}
    for tx in p_el.iter(qn("w:txbxContent")):
        if id(tx) not in skip:
            yield from tx.iter(qn("w:p"))


def num_info(p_el, styles_num: dict[str, tuple[str, int]]) -> tuple[str | None, int]:
    ppr = p_el.find(qn("w:pPr"))
    if ppr is not None:
        np = ppr.find(qn("w:numPr"))
        if np is not None:
            nid = np.find(qn("w:numId"))
            lvl = np.find(qn("w:ilvl"))
            nid_v = nid.get(qn("w:val")) if nid is not None else None
            if nid_v and nid_v != "0":
                return nid_v, int(lvl.get(qn("w:val"))) if lvl is not None else 0
    return None, 0


def numbering_formats(z: zipfile.ZipFile) -> dict[tuple[str, int], str]:
    """(numId, ilvl) → numFmt, so a list can be told ordered or bulleted."""
    out: dict[tuple[str, int], str] = {}
    if "word/numbering.xml" not in z.namelist():
        return out
    numbering = ET.fromstring(z.read("word/numbering.xml"))
    abstract: dict[str, dict[int, str]] = {}
    for an in numbering.findall(qn("w:abstractNum")):
        lv: dict[int, str] = {}
        for l in an.findall(qn("w:lvl")):
            fmt = l.find(qn("w:numFmt"))
            lv[int(l.get(qn("w:ilvl")))] = fmt.get(qn("w:val")) if fmt is not None else "bullet"
        abstract[an.get(qn("w:abstractNumId"))] = lv
    for n in numbering.findall(qn("w:num")):
        a = n.find(qn("w:abstractNumId"))
        if a is None:
            continue
        for lvl, fmt in abstract.get(a.get(qn("w:val")), {}).items():
            out[(n.get(qn("w:numId")), lvl)] = fmt
    return out


def heading_level(style: str) -> int | None:
    if style == "Title":
        return 0
    m = re.match(r"Heading (\d)", style)
    return int(m.group(1)) if m else None


def cell_md(ctx: Ctx, tc, images: list[dict]) -> tuple[str, str]:
    parts_md, parts_txt = [], []
    for p in tc.iter(qn("w:p")):
        m, t = runs_md(ctx, p, images, inline=True)
        if m:
            parts_md.append(m)
            parts_txt.append(t)
    return "<br>".join(parts_md).replace("|", "\\|"), " ".join(parts_txt)


LABEL_MAX = 60


def alt_text(label: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[\[\]|\\\x00]", "", label)).strip()


def cell_image_alt(row_txt: list[str], row_md: list[str], col: int, rec: dict) -> str:
    """The row's adjacent cell when it is a short text label, else docPr."""
    for j in (col + 1, col - 1):
        if 0 <= j < len(row_txt) and "\x00IMG" not in row_md[j]:
            lab = alt_text(row_txt[j])
            if lab and len(lab) <= LABEL_MAX:
                return lab
    return alt_text(rec.get("descr") or "") or alt_text(rec.get("name") or "") or "image"


def table_item(ctx: Ctx, tbl, images: list[dict]) -> dict:
    """A table; pictures in its cells stay in the cells and are not added to `images`."""
    rows_md, txt = [], []
    for tr in tbl.findall(qn("w:tr")):
        row, row_txt, cell_imgs = [], [], []
        for tc in tr.findall(qn("w:tc")):
            imgs: list[dict] = []
            m, t = cell_md(ctx, tc, imgs)
            span = 1
            tcpr = tc.find(qn("w:tcPr"))
            if tcpr is not None and tcpr.find(qn("w:gridSpan")) is not None:
                span = int(tcpr.find(qn("w:gridSpan")).get(qn("w:val")))
            cell_imgs.append((len(row), imgs))
            row.append(m)
            row_txt.append(t)
            row.extend([""] * (span - 1))
            row_txt.extend([""] * (span - 1))
            if t:
                txt.append(t)
        for col, imgs in cell_imgs:
            def sub(mo: re.Match, col=col, imgs=imgs) -> str:
                rec = imgs[int(mo.group(1))]
                use_media(ctx, rec["media"])
                return f"![{cell_image_alt(row_txt, row, col, rec)}]({rec['media']})"
            row[col] = IMG_MARK.sub(sub, row[col])
        rows_md.append(row)
    width = max((len(r) for r in rows_md), default=0)
    rows_md = [r + [""] * (width - len(r)) for r in rows_md]
    return {"type": "table", "rows": rows_md, "text": " ".join(txt)}


def footnotes(ctx: Ctx) -> dict[str, str]:
    out: dict[str, str] = {}
    if "word/footnotes.xml" not in ctx.z.namelist():
        return out
    root = ET.fromstring(ctx.z.read("word/footnotes.xml"))
    # Footnote hyperlinks use the footnotes part's own relationships.
    saved, ctx.rels = ctx.rels, ctx.read_rels("word/_rels/footnotes.xml.rels")
    for fn in root.findall(qn("w:footnote")):
        if fn.get(qn("w:type")) in ("separator", "continuationSeparator"):
            continue
        texts = [runs_md(ctx, p, [])[0] for p in fn.iter(qn("w:p"))]
        out[fn.get(qn("w:id"))] = " ".join(t for t in texts if t).strip()
    ctx.rels = saved
    return out


def extract(path: Path) -> dict:
    z = zipfile.ZipFile(path)
    ctx = Ctx(z)
    fmts = numbering_formats(z)
    body = ET.fromstring(z.read("word/document.xml")).find(qn("w:body"))
    items: list[dict] = []
    open_list: dict | None = None

    def push(item: dict) -> None:
        nonlocal open_list
        if item["type"] != "list":
            open_list = None
        item["seq"] = len(items)
        items.append(item)

    def emit_images(imgs: list[dict]) -> None:
        for rec in imgs:
            use_media(ctx, rec["media"])
            item = {"type": "image", "media": rec["media"]}
            if rec.get("rot"):
                item["rot"] = rec["rot"]
            push(item)

    for el in body:
        if el.tag == qn("w:tbl"):
            imgs: list[dict] = []
            push(table_item(ctx, el, imgs))
            emit_images(imgs)
            continue
        if el.tag != qn("w:p"):
            continue
        style = ctx.style(el)
        imgs: list[dict] = []
        md, text = runs_md(ctx, el, imgs)
        # Text boxes (call-outs) inside this paragraph come out as their own item.
        box = [runs_md(ctx, bp, imgs) for bp in textbox_paragraphs(el)]
        box = [b for b in box if b[0]]
        level = heading_level(style)
        if level is not None and text:
            push({"type": "heading", "level": level, "style": style, "md": md, "text": text})
        elif text:
            cap = CAPTION_RE.match(text)
            nid, lvl = num_info(el, {})
            if cap and len(text) < 300 and style in ("Caption", "Normal") and not nid:
                push({"type": "caption", "target": cap.group(1).lower(), "number": cap.group(2), "md": md, "text": text})
            elif nid:
                fmt = fmts.get((nid, lvl), "bullet")
                entry = {"level": lvl, "md": md, "text": text}
                if open_list is not None and open_list["numId"] == nid:
                    open_list["items"].append(entry)
                    open_list["text"] += " " + text
                else:
                    push({"type": "list", "numId": nid, "ordered": fmt not in ("bullet", "none"), "items": [entry], "text": text})
                    open_list = items[-1]
            else:
                push({"type": "paragraph", "style": style, "md": md, "text": text})
        if box:
            push({"type": "callout", "md": "\n\n".join(b[0] for b in box), "text": " ".join(b[1] for b in box)})
        emit_images(imgs)

    return {
        "$schema": SCHEMA,
        "source": {"file": path.name, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()},
        "items": items,
        "footnotes": footnotes(ctx),
        "media": ctx.media_used,
        "rotations": ctx.rotations,
        "warnings": ctx.warnings,
    }


def write_rotated(raw: bytes, rot: int, dest: Path) -> None:
    """Write `raw` rotated `rot` degrees clockwise, as Word displays it."""
    import io

    from PIL import Image

    img = Image.open(io.BytesIO(raw))
    fmt = img.format or "PNG"
    exact = {90: Image.Transpose.ROTATE_270, 180: Image.Transpose.ROTATE_180, 270: Image.Transpose.ROTATE_90}
    out = img.transpose(exact[rot]) if rot in exact else img.rotate(-rot, expand=True)
    out.save(dest, format=fmt)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("docx", type=Path)
    ap.add_argument("--out", type=Path)
    ap.add_argument("--media-dir", type=Path, help="copy the referenced images here")
    a = ap.parse_args()
    data = extract(a.docx)
    if a.media_dir:
        a.media_dir.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(a.docx) as z:
            for m in data["media"]:
                rot = data["rotations"].get(m)
                dest = a.media_dir / Path(m).name
                if rot is None:
                    dest.write_bytes(z.read(f"word/{m}"))
                else:
                    write_rotated(z.read(f"word/{rot['source']}"), rot["rot"], dest)
    js = json.dumps(data, ensure_ascii=False, indent=1)
    if a.out:
        a.out.write_text(js + "\n", encoding="utf-8")
        counts: dict[str, int] = {}
        for it in data["items"]:
            counts[it["type"]] = counts.get(it["type"], 0) + 1
        print(f"✓ {a.docx.name}: {len(data['items'])} items {counts}, {len(data['footnotes'])} footnotes", file=sys.stderr)
    else:
        print(js)
    return 0


if __name__ == "__main__":
    sys.exit(main())
