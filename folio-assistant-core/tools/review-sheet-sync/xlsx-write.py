#!/usr/bin/env python3
"""
xlsx-write — write a review log as an .xlsx workbook (Office Open XML), the
file a person opens in Excel, Google Sheets, Numbers or LibreOffice
(owner, 2026-11-08: "something [a] person with excel / google sheet / numbers
etc can open and edit and view"). Issue #682.

Standard library only (zipfile, xml.sax.saxutils), like intake-rows.py, which
reads the file back.

Kept per cell: the value and its type (text, number, true/false), its
hyperlink, its note, and its fill colour. Kept per sheet: its name and a
frozen header row. Nothing else: no formulas (a review log's formulas live in
its Apps Script), no conditional formats.

The output is deterministic: the same input gives the same bytes, so an
unchanged log is an unchanged file and git records nothing.

Input (stdin or argv[1]):
  {"sheets": [{"name": "Review Change Sets", "freeze": 2,
               "rows": [[{"v": "CS-001", "link": "https://…", "note": "…",
                          "fill": "9EC4E8"}, null, …], …]}]}
Output: argv[2] (the .xlsx path).
"""
import json
import sys
import zipfile
from xml.sax.saxutils import escape

FIXED = (1980, 1, 1, 0, 0, 0)
MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG = "http://schemas.openxmlformats.org/package/2006/relationships"
HL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink"


def col_name(i):
    s = ""
    i += 1
    while i:
        i, r = divmod(i - 1, 26)
        s = chr(65 + r) + s
    return s


def attr(s):
    return escape(str(s), {'"': "&quot;", "\n": "&#10;", "\r": "&#13;", "\t": "&#9;"})


def text(s):
    # Characters XML 1.0 forbids (most C0 controls) are dropped, not escaped.
    s = "".join(ch for ch in str(s) if ch in "\t\n\r" or ord(ch) >= 0x20)
    return escape(s)


def sheet_name(name, used):
    clean = "".join("_" if ch in "[]:*?/\\" else ch for ch in name)[:31] or "Sheet"
    base, n = clean, 2
    while clean.lower() in used:
        suffix = f" ({n})"
        clean = base[: 31 - len(suffix)] + suffix
        n += 1
    used.add(clean.lower())
    return clean


def build(book):
    strings, index = [], {}

    def sst(s):
        if s not in index:
            index[s] = len(strings)
            strings.append(s)
        return index[s]

    fills = ["none", "gray125"]
    fill_ix = {}

    def fill_id(rgb):
        if not rgb:
            return 0
        rgb = rgb.upper().lstrip("#")
        if rgb not in fill_ix:
            fill_ix[rgb] = len(fills)
            fills.append(rgb)
        return fill_ix[rgb]

    # One cell style per (fill, wrap) pair; style 0 is the default.
    styles, style_ix = [(0, False)], {(0, False): 0}

    def style(rgb, wrap):
        key = (fill_id(rgb), wrap)
        if key not in style_ix:
            style_ix[key] = len(styles)
            styles.append(key)
        return style_ix[key]

    files = {}
    used = set()
    sheets_meta = []
    for si, sh in enumerate(book["sheets"], start=1):
        name = sheet_name(sh["name"], used)
        rows = sh.get("rows", [])
        links, notes = [], []
        out = []
        for ri, row in enumerate(rows, start=1):
            cells = []
            for ci, cell in enumerate(row or []):
                if cell is None:
                    continue
                if not isinstance(cell, dict):
                    cell = {"v": cell}
                ref = f"{col_name(ci)}{ri}"
                v = cell.get("v")
                s = style(cell.get("fill"), isinstance(v, str) and "\n" in v)
                sa = f' s="{s}"' if s else ""
                if v is None or v == "":
                    if s:
                        cells.append(f'<c r="{ref}"{sa}/>')
                elif isinstance(v, bool):
                    cells.append(f'<c r="{ref}"{sa} t="b"><v>{int(v)}</v></c>')
                elif isinstance(v, (int, float)):
                    cells.append(f'<c r="{ref}"{sa}><v>{repr(v) if isinstance(v, float) else v}</v></c>')
                else:
                    cells.append(f'<c r="{ref}"{sa} t="s"><v>{sst(str(v))}</v></c>')
                if cell.get("link"):
                    links.append((ref, cell["link"]))
                if cell.get("note"):
                    notes.append((ref, cell["note"]))
            if cells:
                out.append(f'<row r="{ri}">{"".join(cells)}</row>')
        freeze = int(sh.get("freeze") or 0)
        view = (
            f'<sheetViews><sheetView workbookViewId="0"><pane ySplit="{freeze}" topLeftCell="A{freeze + 1}" '
            f'activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
            if freeze
            else ""
        )
        rels = []
        hl = ""
        if links:
            parts = []
            for i, (ref, url) in enumerate(links, start=1):
                rels.append(f'<Relationship Id="rIdL{i}" Type="{HL}" Target="{attr(url)}" TargetMode="External"/>')
                parts.append(f'<hyperlink ref="{ref}" r:id="rIdL{i}"/>')
            hl = f"<hyperlinks>{''.join(parts)}</hyperlinks>"
        legacy = ""
        if notes:
            rels.append(f'<Relationship Id="rIdC" Type="{R}/comments" Target="../comments{si}.xml"/>')
            rels.append(f'<Relationship Id="rIdV" Type="{R}/vmlDrawing" Target="../drawings/vmlDrawing{si}.vml"/>')
            legacy = '<legacyDrawing r:id="rIdV"/>'
            body = "".join(
                f'<comment ref="{ref}" authorId="0"><text><t xml:space="preserve">{text(n)}</t></text></comment>' for ref, n in notes
            )
            files[f"xl/comments{si}.xml"] = (
                f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
                f'<comments xmlns="{MAIN}"><authors><author>review log</author></authors><commentList>{body}</commentList></comments>'
            )
            shapes = []
            for k, (ref, _) in enumerate(notes):
                c = 0
                letters = "".join(ch for ch in ref if ch.isalpha())
                for ch in letters:
                    c = c * 26 + ord(ch) - 64
                r = int(ref[len(letters):])
                shapes.append(
                    f'<v:shape id="_x0000_s{1025 + k}" type="#_x0000_t202" style="position:absolute;visibility:hidden;width:200pt;height:80pt" '
                    f'fillcolor="#ffffe1" o:insetmode="auto"><v:fill color2="#ffffe1"/><v:shadow on="t" color="black" obscured="t"/>'
                    f'<v:path o:connecttype="none"/><v:textbox style="mso-direction-alt:auto"><div style="text-align:left"></div></v:textbox>'
                    f'<x:ClientData ObjectType="Note"><x:MoveWithCells/><x:SizeWithCells/><x:AutoFill>False</x:AutoFill>'
                    f"<x:Row>{r - 1}</x:Row><x:Column>{c - 1}</x:Column></x:ClientData></v:shape>"
                )
            files[f"xl/drawings/vmlDrawing{si}.vml"] = (
                '<xml xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" '
                'xmlns:x="urn:schemas-microsoft-com:office:excel"><o:shapelayout v:ext="edit"><o:idmap v:ext="edit" data="1"/></o:shapelayout>'
                '<v:shapetype id="_x0000_t202" coordsize="21600,21600" o:spt="202" path="m,l,21600r21600,l21600,xe">'
                '<v:stroke joinstyle="miter"/><v:path gradientshapeok="t" o:connecttype="rect"/></v:shapetype>' + "".join(shapes) + "</xml>"
            )
        files[f"xl/worksheets/sheet{si}.xml"] = (
            f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
            f'<worksheet xmlns="{MAIN}" xmlns:r="{R}">{view}<sheetData>{"".join(out)}</sheetData>{hl}{legacy}</worksheet>'
        )
        if rels:
            files[f"xl/worksheets/_rels/sheet{si}.xml.rels"] = (
                f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="{PKG}">{"".join(rels)}</Relationships>'
            )
        sheets_meta.append((si, name, bool(notes)))

    fill_xml = "".join(
        f'<fill><patternFill patternType="{f}"/></fill>' if f in ("none", "gray125")
        else f'<fill><patternFill patternType="solid"><fgColor rgb="FF{f}"/><bgColor indexed="64"/></patternFill></fill>'
        for f in fills
    )
    def xf_el(fi, wrap):
        fill = ' applyFill="1"' if fi else ""
        tail = ' applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>' if wrap else "/>"
        return f'<xf numFmtId="0" fontId="0" fillId="{fi}" borderId="0" xfId="0"{fill}{tail}'

    xf = "".join(xf_el(fi, wrap) for fi, wrap in styles)
    files["xl/styles.xml"] = (
        f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="{MAIN}">'
        '<fonts count="1"><font><sz val="10"/><name val="Arial"/></font></fonts>'
        f'<fills count="{len(fills)}">{fill_xml}</fills>'
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        f'<cellXfs count="{len(styles)}">{xf}</cellXfs>'
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'
    )
    files["xl/sharedStrings.xml"] = (
        f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<sst xmlns="{MAIN}" count="{len(strings)}" uniqueCount="{len(strings)}">'
        + "".join(f'<si><t xml:space="preserve">{text(s)}</t></si>' for s in strings)
        + "</sst>"
    )
    files["xl/workbook.xml"] = (
        f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="{MAIN}" xmlns:r="{R}"><sheets>'
        + "".join(f'<sheet name="{attr(n)}" sheetId="{i}" r:id="rId{i}"/>' for i, n, _ in sheets_meta)
        + "</sheets></workbook>"
    )
    n = len(sheets_meta)
    files["xl/_rels/workbook.xml.rels"] = (
        f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="{PKG}">'
        + "".join(f'<Relationship Id="rId{i}" Type="{R}/worksheet" Target="worksheets/sheet{i}.xml"/>' for i, _, _ in sheets_meta)
        + f'<Relationship Id="rId{n + 1}" Type="{R}/styles" Target="styles.xml"/>'
        + f'<Relationship Id="rId{n + 2}" Type="{R}/sharedStrings" Target="sharedStrings.xml"/>'
        + "</Relationships>"
    )
    files["_rels/.rels"] = (
        f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="{PKG}">'
        f'<Relationship Id="rId1" Type="{R}/officeDocument" Target="xl/workbook.xml"/></Relationships>'
    )
    ct = [
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
        '<Default Extension="xml" ContentType="application/xml"/>',
        '<Default Extension="vml" ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/>',
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
        '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>',
    ]
    for i, _, has_notes in sheets_meta:
        ct.append(f'<Override PartName="/xl/worksheets/sheet{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>')
        if has_notes:
            ct.append(f'<Override PartName="/xl/comments{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml"/>')
    files["[Content_Types].xml"] = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' + "".join(ct) + "</Types>"
    )
    return files


def write(book, path):
    files = build(book)
    order = ["[Content_Types].xml", "_rels/.rels"] + sorted(k for k in files if k not in ("[Content_Types].xml", "_rels/.rels"))
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        for name in order:
            info = zipfile.ZipInfo(name, FIXED)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            z.writestr(info, files[name].encode("utf-8"))


def main():
    if len(sys.argv) < 2:
        sys.exit("usage: xlsx-write.py [<book.json>] <out.xlsx>   (book on stdin when only <out.xlsx> is given)")
    if len(sys.argv) == 2:
        book, out = json.load(sys.stdin), sys.argv[1]
    else:
        with open(sys.argv[1], encoding="utf-8") as f:
            book = json.load(f)
        out = sys.argv[2]
    write(book, out)


if __name__ == "__main__":
    main()
