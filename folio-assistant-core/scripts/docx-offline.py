#!/usr/bin/env python3
"""
docx-offline — the Word half of a document folio's offline round trip.

    folio (Markdown blocks)
        → document-export.ts docx   (pandoc + document-export.lua: one bookmark per block)
        → docx-offline.py finish    (line numbers, Track Changes on, deterministic zip)
        → an author edits in Word with Track Changes on
        → docx-offline.py changes   (each tracked change put back on its block)
        → --apply: the block's Markdown edited in the working tree, one commit per block

Standard library only, like docx-structure.py: the merge runs in CI and on a
maintainer's laptop, and neither should need python-docx to read a zip of XML.

finish
------
    python3 docx-offline.py finish <in.docx> --out <out.docx>
        [--line-numbers] [--track-changes] [--epoch <unix seconds>]

`--line-numbers` sets Word line numbering (`w:lnNumType`, continuous), which
is what makes the review PDF cite-able by "page 22, lines 618-624" and what
`pdf-line-map.py` reads back. `--track-changes` turns on `w:trackRevisions`
so the author cannot forget to. Every zip entry gets the same timestamp
(`--epoch`, default `SOURCE_DATE_EPOCH`), so one commit gives one file.

changes
-------
    python3 docx-offline.py changes <edited.docx> --repo <folio repo> [--document <slug>]
        [--out changes.json] [--summary summary.md] [--apply] [--commit]
        [--allow-unknown-commit]

1. **Validate.** The file must carry `folio-source-commit` and
   `folio-document` (custom properties written by document-export.ts), and
   that commit must exist in `--repo`. A file whose source cannot be found
   cannot be merged safely, so the run stops (exit 2) unless
   `--allow-unknown-commit`.
2. **Extract.** `word/document.xml` is walked in document order. Each
   paragraph belongs to the last `folio_…` bookmark started before its text.
   Runs are split into equal / inserted (`w:ins`, `w:moveTo`) / deleted
   (`w:del`, `w:moveFrom`) segments with their author and date. Word
   comments (`word/comments.xml`) are attached to the block they anchor in.
   Formatting-only changes (`w:rPrChange`, `w:pPrChange`) are ignored.
3. **Map.** Bookmark names are recomputed from the labels in the SOURCE
   COMMIT's `folio/<slug>/review-anchors.json` (`folio_` + sha1(label)[:16],
   as document-export.lua writes them), giving the block's chapter and root,
   hence `folio/<slug>/<chapter>/<root>.md`.
4. **Apply** (`--apply`). A block whose Markdown changed between the source
   commit and the working tree is a CONFLICT and is left alone. Otherwise
   each changed paragraph is matched to one line (or table cell) of the
   block's Markdown by its visible text, and the insertions and deletions
   are carried onto that line at the matching character positions, so
   links, emphasis and list markers around the edit survive. A paragraph
   that matches no line (a structured block's generated text, a heading, a
   merged or split paragraph) is reported as `manual`, with both texts,
   never guessed at. `--commit` then commits each applied block on its own.

Upload the file with every tracked change still pending: a change accepted
in Word before upload is indistinguishable from the original text.

Output (`docx-offline-changes/v1`):
    { "$schema": "docx-offline-changes/v1",
      "source": {"file", "sha256", "commit", "document"},
      "blocks": [ {"label", "kind", "file", "status", "authors", "dates",
                   "insertions", "deletions", "paragraphs": [...], "comments": [...]} ],
      "unplaced": [...], "stats": {...} }
"""
from __future__ import annotations

import argparse
import difflib
import hashlib
import io
import json
import os
import re
import subprocess
import sys
import time
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
CP = "http://schemas.openxmlformats.org/officeDocument/2006/custom-properties"
VT = "http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"
PREFIX = "folio_"
XML_DECL = b'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'


def q(tag: str) -> str:
    return f"{{{W}}}{tag}"


def bookmark_name(label: str) -> str:
    """The bookmark document-export.lua writes for `label`."""
    return PREFIX + hashlib.sha1(label.encode("utf-8")).hexdigest()[:16]


# ── finish ──────────────────────────────────────────────────────────────

def _register_namespaces(xml: bytes) -> None:
    """Keep the prefixes Word expects (w:, r:, …) when ElementTree re-serialises."""
    for _, (prefix, uri) in ET.iterparse(io.BytesIO(xml), events=("start-ns",)):
        try:
            ET.register_namespace(prefix, uri)
        except ValueError:
            pass


def _set_line_numbers(document_xml: bytes) -> bytes:
    _register_namespaces(document_xml)
    root = ET.fromstring(document_xml)
    sects = list(root.iter(q("sectPr")))
    if not sects:
        body = root.find(q("body"))
        sects = [ET.SubElement(body, q("sectPr"))]
    for sect in sects:
        for old in sect.findall(q("lnNumType")):
            sect.remove(old)
        ln = ET.Element(q("lnNumType"), {q("countBy"): "1", q("restart"): "continuous", q("distance"): "283"})
        # CT_SectPr order: headerReference*, footerReference*, footnotePr, endnotePr,
        # type, pgSz, pgMar, paperSrc, pgBorders, lnNumType, …
        before = {q(t) for t in ("headerReference", "footerReference", "footnotePr", "endnotePr",
                                 "type", "pgSz", "pgMar", "paperSrc", "pgBorders")}
        idx = 0
        for i, child in enumerate(list(sect)):
            if child.tag in before:
                idx = i + 1
        sect.insert(idx, ln)
    return XML_DECL + ET.tostring(root)


def _set_track_changes(settings_xml: bytes) -> bytes:
    _register_namespaces(settings_xml)
    root = ET.fromstring(settings_xml)
    if root.find(q("trackRevisions")) is None:
        # CT_Settings: writeProtection, view, zoom, removePersonalInformation,
        # removeDateAndTime, doNotDisplayPageBoundaries, displayBackgroundShape,
        # printPostScriptOverText, printFractionalCharacterWidth, printFormsData,
        # embedTrueTypeFonts, embedSystemFonts, saveSubsetFonts, saveFormsData,
        # mirrorMargins, alignBordersAndEdges, bordersDoNotSurroundHeader,
        # bordersDoNotSurroundFooter, gutterAtTop, hideSpellingErrors,
        # hideGrammaticalErrors, activeWritingStyle, proofState, formsDesign,
        # attachedTemplate, linkStyles, stylePaneFormatFilter,
        # stylePaneSortMethod, documentType, mailMerge, revisionView, trackRevisions
        after = {q(t) for t in ("writeProtection", "view", "zoom", "removePersonalInformation",
                                "removeDateAndTime", "doNotDisplayPageBoundaries", "displayBackgroundShape",
                                "printPostScriptOverText", "printFractionalCharacterWidth", "printFormsData",
                                "embedTrueTypeFonts", "embedSystemFonts", "saveSubsetFonts", "saveFormsData",
                                "mirrorMargins", "alignBordersAndEdges", "bordersDoNotSurroundHeader",
                                "bordersDoNotSurroundFooter", "gutterAtTop", "hideSpellingErrors",
                                "hideGrammaticalErrors", "activeWritingStyle", "proofState", "formsDesign",
                                "attachedTemplate", "linkStyles", "stylePaneFormatFilter",
                                "stylePaneSortMethod", "documentType", "mailMerge", "revisionView")}
        idx = 0
        for i, child in enumerate(list(root)):
            if child.tag in after:
                idx = i + 1
        root.insert(idx, ET.Element(q("trackRevisions")))
    return XML_DECL + ET.tostring(root)


def finish(src: Path, out: Path, line_numbers: bool, track_changes: bool, epoch: int) -> dict:
    stamp = time.gmtime(max(epoch, 315532800))[:6]  # zip cannot hold dates before 1980
    with zipfile.ZipFile(src) as zin:
        entries = [(i.filename, zin.read(i.filename)) for i in zin.infolist()]
    names = [n for n, _ in entries]
    if "word/document.xml" not in names:
        raise SystemExit(f"{src}: not a .docx (no word/document.xml)")
    result = []
    for name, data in entries:
        if name == "word/document.xml" and line_numbers:
            data = _set_line_numbers(data)
        if name == "word/settings.xml" and track_changes:
            data = _set_track_changes(data)
        result.append((name, data))
    # [Content_Types].xml first, as Word writes it; the rest in a fixed order.
    result.sort(key=lambda e: (e[0] != "[Content_Types].xml", e[0]))
    tmp = out.with_suffix(out.suffix + ".tmp")
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
        for name, data in result:
            info = zipfile.ZipInfo(name, date_time=stamp)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            zout.writestr(info, data)
    os.replace(tmp, out)
    bookmarks = len(re.findall(rb'w:name="folio_[0-9a-f]{16}"', dict(result)["word/document.xml"]))
    return {"file": str(out), "sha256": hashlib.sha256(out.read_bytes()).hexdigest(),
            "bookmarks": bookmarks, "lineNumbers": line_numbers, "trackChanges": track_changes}


# ── changes: reading the edited file ───────────────────────────────────

def custom_properties(z: zipfile.ZipFile) -> dict[str, str]:
    try:
        root = ET.fromstring(z.read("docProps/custom.xml"))
    except KeyError:
        return {}
    props = {}
    for p in root.findall(f"{{{CP}}}property"):
        val = next(iter(p), None)
        props[p.get("name", "")] = (val.text or "") if val is not None else ""
    return props


def _run_text(r: ET.Element, deleted: bool) -> str:
    parts = []
    for el in r:
        if el.tag == q("t") and not deleted:
            parts.append(el.text or "")
        elif el.tag == q("delText") and deleted:
            parts.append(el.text or "")
        elif el.tag == q("tab"):
            parts.append("\t")
        elif el.tag in (q("br"), q("cr")):
            parts.append(" ")
        elif el.tag == q("noBreakHyphen"):
            parts.append("-")
    return "".join(parts)


class Para:
    """One Word paragraph: its block, its segments, and its paragraph-mark change."""

    def __init__(self, index: int, bookmark: str | None, in_table: bool):
        self.index = index
        self.bookmark = bookmark
        self.in_table = in_table
        self.segments: list[list] = []  # [op, text, author, date]
        self.mark: str | None = None     # "inserted" | "deleted": the paragraph mark itself changed
        self.comments: list[str] = []
        self.style = ""

    def add(self, op: str, text: str, author: str = "", date: str = "") -> None:
        if not text:
            return
        if self.segments and self.segments[-1][0] == op and self.segments[-1][2] == author:
            self.segments[-1][1] += text
        else:
            self.segments.append([op, text, author, date])

    @property
    def original(self) -> str:
        return "".join(s[1] for s in self.segments if s[0] in ("eq", "del"))

    @property
    def proposed(self) -> str:
        return "".join(s[1] for s in self.segments if s[0] in ("eq", "ins"))

    @property
    def changed(self) -> bool:
        return self.mark is not None or any(s[0] != "eq" for s in self.segments)


def read_paragraphs(document_xml: bytes) -> tuple[list[Para], dict[str, str]]:
    """Every paragraph in reading order, each assigned to its folio bookmark.

    Returns the paragraphs and the comment-id → bookmark map.
    """
    root = ET.fromstring(document_xml)
    body = root.find(q("body"))
    paras: list[Para] = []
    state = {"bookmark": None}
    comment_block: dict[str, str] = {}

    def walk_runs(container: ET.Element, para: Para, op: str, author: str, date: str) -> None:
        for el in container:
            tag = el.tag
            if tag == q("bookmarkStart"):
                name = el.get(q("name"), "")
                if name.startswith(PREFIX):
                    state["bookmark"] = name
                    if not para.segments:
                        para.bookmark = name
            elif tag == q("commentRangeStart") or tag == q("commentReference"):
                cid = el.get(q("id"))
                if cid is not None and state["bookmark"]:
                    comment_block.setdefault(cid, state["bookmark"])
            elif tag == q("r"):
                ref = el.find(q("commentReference"))
                if ref is not None and state["bookmark"]:
                    comment_block.setdefault(ref.get(q("id")), state["bookmark"])
                para.add(op, _run_text(el, op == "del"), author, date)
            elif tag in (q("ins"), q("moveTo")):
                walk_runs(el, para, "ins", el.get(q("author"), ""), el.get(q("date"), ""))
            elif tag in (q("del"), q("moveFrom")):
                walk_runs(el, para, "del", el.get(q("author"), ""), el.get(q("date"), ""))
            elif tag in (q("hyperlink"), q("smartTag"), q("fldSimple"), q("customXml"), q("sdt"), q("sdtContent")):
                walk_runs(el, para, op, author, date)

    def walk_blocks(container: ET.Element, in_table: bool) -> None:
        for el in container:
            if el.tag == q("p"):
                para = Para(len(paras), state["bookmark"], in_table)
                ppr = el.find(q("pPr"))
                if ppr is not None:
                    st = ppr.find(q("pStyle"))
                    para.style = st.get(q("val"), "") if st is not None else ""
                    rpr = ppr.find(q("rPr"))
                    if rpr is not None:
                        if rpr.find(q("ins")) is not None:
                            para.mark = "inserted"
                        elif rpr.find(q("del")) is not None:
                            para.mark = "deleted"
                walk_runs(el, para, "eq", "", "")
                if para.bookmark is None:
                    para.bookmark = state["bookmark"]
                paras.append(para)
            elif el.tag == q("tbl"):
                for tr in el.iter(q("tr")):
                    for tc in tr.findall(q("tc")):
                        walk_blocks(tc, True)
            elif el.tag in (q("sdt"), q("sdtContent"), q("customXml")):
                walk_blocks(el, in_table)
            elif el.tag in (q("bookmarkStart"),):
                name = el.get(q("name"), "")
                if name.startswith(PREFIX):
                    state["bookmark"] = name

    walk_blocks(body, False)
    return paras, comment_block


def read_comments(z: zipfile.ZipFile) -> dict[str, dict]:
    try:
        root = ET.fromstring(z.read("word/comments.xml"))
    except KeyError:
        return {}
    out = {}
    for c in root.findall(q("comment")):
        text = " ".join("".join(t.text or "" for t in p.iter(q("t"))) for p in c.findall(q("p"))).strip()
        out[c.get(q("id"), "")] = {"author": c.get(q("author"), ""), "date": c.get(q("date"), ""), "text": text}
    return out


# ── changes: the repository side ───────────────────────────────────────

def git(repo: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(["git", "-C", str(repo), *args], capture_output=True, check=check)


def commit_exists(repo: Path, sha: str) -> bool:
    return bool(sha) and git(repo, "cat-file", "-e", f"{sha}^{{commit}}", check=False).returncode == 0


def file_at(repo: Path, sha: str, path: str) -> str | None:
    r = git(repo, "show", f"{sha}:{path}", check=False)
    return r.stdout.decode("utf-8") if r.returncode == 0 else None


def label_index(anchors: dict, document: str) -> dict[str, dict]:
    """bookmark name → {label, kind, file?} from a review-anchors.json."""
    out: dict[str, dict] = {}
    for b in anchors.get("blocks", []):
        label = b["label"]
        root = b.get("root")
        chapter = b.get("chapter")
        entry = {"label": label, "kind": b.get("kind", label.split(":", 1)[0])}
        if root and chapter:
            entry["file"] = f"folio/{document}/{chapter}/{root}.md"
            entry["manifest"] = f"folio/{document}/{chapter}/{root}.ts"
        out[bookmark_name(label)] = entry
    for key, kind in (("sections", "section"), ("chapters", "chapter")):
        items = anchors.get(key, [])
        if isinstance(items, dict):
            items = [dict(v, label=k) if isinstance(v, dict) else {"label": k} for k, v in items.items()]
        for s in items:
            label = s.get("label") if isinstance(s, dict) else s
            if label:
                out.setdefault(bookmark_name(label), {"label": label, "kind": kind})
    return out


# ── changes: carrying an edit onto the Markdown line ───────────────────

_LIST = re.compile(r"^(\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?|\s*>\s?|\s*#{1,6}\s+)")
_QUOTES = str.maketrans({"‘": "'", "’": "'", "“": '"', "”": '"', " ": " ",
                         "–": "-", "—": "-"})


def visible(md: str) -> tuple[str, list[int]]:
    """The text a reader sees in one Markdown line, and for each of its
    characters the offset in `md` it came from.

    Hidden: list/quote/heading markers, emphasis and code delimiters, link
    targets, HTML tags, and backslash escapes. A link's text stays visible.
    """
    text: list[str] = []
    pos: list[int] = []
    i = 0
    m = _LIST.match(md)
    if m:
        i = m.end()
    n = len(md)
    while i < n:
        c = md[i]
        if c == "\\" and i + 1 < n:
            text.append(md[i + 1]); pos.append(i + 1); i += 2; continue
        if c == "]" and i + 1 < n and md[i + 1] == "(":
            depth, j = 1, i + 2
            while j < n and depth:
                depth += {"(": 1, ")": -1}.get(md[j], 0); j += 1
            i = j; continue
        if c == "[" or c == "`":
            i += 1; continue
        if c in "*_~" :
            j = i
            while j < n and md[j] == c:
                j += 1
            run = j - i
            # an intraword underscore is a character (snake_case), not emphasis
            if c == "_" and i > 0 and md[i - 1].isalnum() and j < n and md[j].isalnum():
                text.extend(md[i:j]); pos.extend(range(i, j)); i = j; continue
            if c == "*" and run == 1 and (i + 1 >= n or md[i + 1] == " ") and (i == 0 or md[i - 1] == " "):
                text.append(c); pos.append(i); i += 1; continue
            i = j; continue
        if c == "<":
            m2 = re.match(r"</?[A-Za-z][^>]*>", md[i:])
            if m2:
                i += m2.end(); continue
        text.append(c); pos.append(i); i += 1
    return "".join(text), pos


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.translate(_QUOTES)).strip()


def md_units(md: str) -> list[dict]:
    """The lines (and table cells) a Word paragraph can correspond to."""
    units = []
    offset = 0
    for line in md.splitlines(keepends=True):
        body = line.rstrip("\r\n")
        if body.strip() and not re.match(r"^\s*\|?\s*:?-{3,}", body):
            if body.lstrip().startswith("|"):
                # table row: each cell is its own unit
                cells = [(m.start(), m.group(0)) for m in re.finditer(r"(?:\\\||[^|])+", body)]
                for start, cell in cells:
                    if cell.strip():
                        lead = len(cell) - len(cell.lstrip())
                        units.append({"start": offset + start + lead, "text": cell.strip(), "table": True})
            else:
                units.append({"start": offset, "text": body, "table": False})
        offset += len(line)
    return units


def match_unit(para: Para, units: list[dict], used: set[int], md: str) -> int | None:
    target = norm(para.original)
    if not target:
        return None
    best, best_ratio = None, 0.0
    for i, u in enumerate(units):
        if i in used:
            continue
        v = norm(visible(u["text"])[0])
        if v == target:
            return i
        r = difflib.SequenceMatcher(None, v, target, autojunk=False).ratio() if abs(len(v) - len(target)) < 0.1 * len(target) + 5 else 0
        if r > best_ratio:
            best, best_ratio = i, r
    return best if best_ratio >= 0.97 else None


def apply_to_unit(unit_text: str, para: Para) -> str | None:
    """Carry `para`'s insertions and deletions onto the Markdown `unit_text`."""
    vis, pos = visible(unit_text)
    original = para.original
    sm = difflib.SequenceMatcher(None, original, vis, autojunk=False)
    omap: dict[int, int] = {}
    for a, b, size in sm.get_matching_blocks():
        for k in range(size):
            omap[a + k] = pos[b + k]
    if len([k for k in omap]) < 0.9 * len(original.strip()):
        return None

    def md_at(o: int) -> int:
        """Markdown offset for original-text offset `o` (insertion point before char o)."""
        if o in omap:
            return omap[o]
        k = o - 1
        while k >= 0 and k not in omap:
            k -= 1
        return omap[k] + 1 if k >= 0 else (pos[0] if pos else len(unit_text))

    edits: list[tuple[int, int, str]] = []  # (md_start, md_end, replacement)
    o = 0
    for op, text, _a, _d in para.segments:
        if op == "eq":
            o += len(text)
        elif op == "del":
            start, end = md_at(o), md_at(o + len(text) - 1) + 1
            edits.append((start, end, ""))
            o += len(text)
        elif op == "ins":
            at = md_at(o)
            edits.append((at, at, text))
    out = unit_text
    for start, end, rep in sorted(edits, key=lambda e: (e[0], e[1]), reverse=True):
        out = out[:start] + rep + out[end:]
    # A deletion that removed a word leaves a doubled space; Word does the same
    # collapse when it accepts the change.
    out = re.sub(r"(?<=\S)  +(?=\S)", " ", out)
    return out


def apply_block(md: str, paras: list[Para]) -> tuple[str, list[dict]]:
    units = md_units(md)
    used: set[int] = set()
    replacements: list[tuple[int, int, str]] = []
    results = []
    last_unit: int | None = None
    for para in paras:
        if not para.changed:
            i = match_unit(para, units, used, md)
            if i is not None:
                used.add(i); last_unit = i
            continue
        rec = {"index": para.index, "original": para.original, "proposed": para.proposed}
        whole_new = para.mark == "inserted" and all(s[0] == "ins" for s in para.segments)
        whole_gone = para.mark == "deleted" and all(s[0] == "del" for s in para.segments)
        if whole_new and last_unit is not None and not units[last_unit]["table"]:
            prev = units[last_unit]
            line_end = md.find("\n", prev["start"])
            line_end = len(md) if line_end < 0 else line_end
            marker = _LIST.match(prev["text"])
            text = para.proposed.strip()
            if marker and not marker.group(0).lstrip().startswith(("#", ">")):
                new = "\n" + marker.group(0) + text
            else:
                new = "\n\n" + text
            replacements.append((line_end, line_end, new))
            rec["status"] = "applied"; rec["how"] = "inserted after the preceding line"
            results.append(rec)
            continue
        if para.mark is not None and not whole_gone:
            rec["status"] = "manual"; rec["why"] = f"paragraph mark {para.mark}: a paragraph was split or merged"
            results.append(rec)
            continue
        i = match_unit(para, units, used, md)
        if i is None:
            rec["status"] = "manual"
            rec["why"] = "no line of the block's Markdown reads like this paragraph (generated text, a heading, or the source changed)"
            results.append(rec)
            continue
        used.add(i); last_unit = i
        u = units[i]
        if whole_gone and not u["table"]:
            end = md.find("\n", u["start"])
            end = len(md) if end < 0 else end + 1
            replacements.append((u["start"], end, ""))
            rec["status"] = "applied"; rec["how"] = "line removed"
            results.append(rec)
            continue
        new_text = apply_to_unit(u["text"], para)
        if new_text is None:
            rec["status"] = "manual"; rec["why"] = "could not align the edit to the Markdown text"
        else:
            replacements.append((u["start"], u["start"] + len(u["text"]), new_text))
            rec["status"] = "applied"
        results.append(rec)
    out = md
    for start, end, rep in sorted(replacements, key=lambda r: r[0], reverse=True):
        out = out[:start] + rep + out[end:]
    out = re.sub(r"\n{3,}", "\n\n", out)
    return out, results


# ── changes: the command ────────────────────────────────────────────────

def changes(args: argparse.Namespace) -> int:
    docx = Path(args.docx)
    repo = Path(args.repo).resolve()
    data = docx.read_bytes()
    try:
        z = zipfile.ZipFile(docx)
        document_xml = z.read("word/document.xml")
    except (zipfile.BadZipFile, KeyError):
        print(f"{docx}: not a .docx (no word/document.xml)", file=sys.stderr)
        return 2
    props = custom_properties(z)
    commit = props.get("folio-source-commit", "")
    document = args.document or props.get("folio-document", "")
    if not document:
        print(f"{docx}: no folio-document property and no --document", file=sys.stderr)
        return 2
    known = commit_exists(repo, commit)
    if not known and not args.allow_unknown_commit:
        print(f"{docx}: source commit {commit or '(none)'} is not in {repo}. A file whose source cannot be "
              f"found cannot be merged safely (fetch it, or pass --allow-unknown-commit to read changes only).",
              file=sys.stderr)
        return 2

    anchors_path = f"folio/{document}/review-anchors.json"
    anchors_text = file_at(repo, commit, anchors_path) if known else None
    if anchors_text is None:
        p = repo / anchors_path
        anchors_text = p.read_text("utf-8") if p.exists() else "{}"
    index = label_index(json.loads(anchors_text), document)

    paras, comment_block = read_paragraphs(document_xml)
    comments = read_comments(z)

    by_block: dict[str, list[Para]] = {}
    for p in paras:
        by_block.setdefault(p.bookmark or "", []).append(p)

    blocks_out, unplaced = [], []
    for name, ps in by_block.items():
        block_comments = [dict(comments[c], id=c) for c, b in comment_block.items() if b == name and c in comments]
        if not any(p.changed for p in ps) and not block_comments:
            continue
        entry = index.get(name)
        if entry is None:
            unplaced.append({"bookmark": name or None,
                             "paragraphs": [{"index": p.index, "original": p.original, "proposed": p.proposed}
                                            for p in ps if p.changed],
                             "comments": block_comments})
            continue
        changed = [p for p in ps if p.changed]
        segs = [s for p in changed for s in p.segments if s[0] != "eq"]
        rec = {
            "label": entry["label"], "kind": entry["kind"], "bookmark": name,
            "file": entry.get("file"), "manifest": entry.get("manifest"),
            "authors": sorted({s[2] for s in segs if s[2]}),
            "dates": sorted({s[3] for s in segs if s[3]}),
            "insertions": sum(1 for s in segs if s[0] == "ins"),
            "deletions": sum(1 for s in segs if s[0] == "del"),
            "comments": block_comments,
            "status": "comments-only" if not changed else "pending",
            "paragraphs": [{"index": p.index, "original": p.original, "proposed": p.proposed,
                            "segments": [{"op": s[0], "text": s[1], "author": s[2], "date": s[3]} for s in p.segments if s[0] != "eq"]}
                           for p in changed],
        }
        if changed and args.apply:
            apply_one(repo, commit if known else None, rec, ps, args)
        blocks_out.append(rec)

    report = {
        "$schema": "docx-offline-changes/v1",
        "source": {"file": docx.name, "sha256": hashlib.sha256(data).hexdigest(),
                   "commit": commit or None, "commitKnown": known, "document": document,
                   "exportedAt": props.get("folio-export-date")},
        "blocks": blocks_out,
        "unplaced": unplaced,
        "stats": {
            "paragraphs": len(paras),
            "changedParagraphs": sum(1 for p in paras if p.changed),
            "blocks": len(blocks_out),
            "byStatus": {s: sum(1 for b in blocks_out if b["status"] == s)
                         for s in sorted({b["status"] for b in blocks_out})},
            "unplaced": len(unplaced),
        },
    }
    if args.commit:
        commit_blocks(repo, report)
    text = json.dumps(report, indent=2, ensure_ascii=False) + "\n"
    if args.out:
        Path(args.out).write_text(text, "utf-8")
    else:
        sys.stdout.write(text)
    if args.summary:
        Path(args.summary).write_text(summary_markdown(report, args.site_url), "utf-8")
    print(f"{report['stats']['changedParagraphs']} changed paragraph(s) in {len(blocks_out)} block(s); "
          f"{json.dumps(report['stats']['byStatus'])}; {len(unplaced)} unplaced", file=sys.stderr)
    return 0


def apply_one(repo: Path, commit: str | None, rec: dict, paras: list[Para], args: argparse.Namespace) -> None:
    path = rec.get("file")
    if not path or not (repo / path).exists():
        rec["status"] = "manual"; rec["why"] = "the block has no Markdown file to edit"
        return
    current = (repo / path).read_text("utf-8")
    if commit is not None:
        then = file_at(repo, commit, path)
        if then is not None and then != current:
            rec["status"] = "conflict"
            rec["why"] = f"{path} changed between {commit[:7]} and the working tree; decide by hand"
            return
    new, results = apply_block(current, paras)
    statuses = {r["status"] for r in results}
    for r, out in zip(rec["paragraphs"], results):
        r.update({k: v for k, v in out.items() if k in ("status", "why", "how")})
    if new != current:
        (repo / path).write_text(new, "utf-8")
    rec["status"] = "applied" if statuses == {"applied"} else ("partial" if "applied" in statuses else "manual")


def commit_blocks(repo: Path, report: dict) -> None:
    """One commit per applied block, so the review can take or drop each."""
    for b in report["blocks"]:
        if b["status"] not in ("applied", "partial") or not b.get("file"):
            continue
        if git(repo, "diff", "--quiet", "--", b["file"], check=False).returncode == 0:
            continue
        who = ", ".join(b["authors"]) or "unknown author"
        when = (b["dates"][-1] if b["dates"] else "")[:10]
        msg = (f"offline edit: {b['label']} ({who}{', ' + when if when else ''})\n\n"
               f"From {report['source']['file']} (sha256 {report['source']['sha256'][:12]}), exported from "
               f"{(report['source']['commit'] or 'an unknown commit')[:12]}. "
               f"{b['insertions']} insertion(s), {b['deletions']} deletion(s)"
               f"{'; some paragraphs need a hand edit, see the change report' if b['status'] == 'partial' else ''}.\n")
        git(repo, "add", "--", b["file"])
        git(repo, "commit", "-q", "-m", msg, "--", b["file"])
        b["committed"] = git(repo, "rev-parse", "HEAD").stdout.decode().strip()


def summary_markdown(report: dict, site_url: str | None) -> str:
    s = report["source"]
    lines = [f"## Offline edits from `{s['file']}`", "",
             f"Exported from `{(s['commit'] or 'unknown')[:12]}` · document `{s['document']}` · "
             f"file sha256 `{s['sha256'][:12]}`", "",
             "| block | status | changes | by |", "|---|---|---|---|"]
    for b in report["blocks"]:
        link = f"[`{b['label']}`]({site_url.rstrip('/')}/#{b['label']})" if site_url else f"`{b['label']}`"
        notes = f" · {len(b['comments'])} comment(s)" if b["comments"] else ""
        by = ", ".join(b["authors"]) or "—"
        lines.append(f"| {link} | {b['status']} | +{b['insertions']} −{b['deletions']}{notes} | {by} |")
    for b in report["blocks"]:
        lines += ["", f"### `{b['label']}` — {b['status']}", ""]
        if b.get("why"):
            lines += [f"> {b['why']}", ""]
        if b.get("file"):
            lines += [f"Source: `{b['file']}`", ""]
        for p in b["paragraphs"]:
            diff = difflib.unified_diff([p["original"]], [p["proposed"]], lineterm="", n=0)
            body = "\n".join(l for l in diff if not l.startswith(("---", "+++", "@@")))
            tag = f" ({p['status']}{': ' + p['why'] if p.get('why') else ''})" if p.get("status") else ""
            lines += [f"Paragraph {p['index']}{tag}:", "", "```diff", body, "```", ""]
        for c in b["comments"]:
            lines += [f"> 💬 **{c['author']}** ({c['date'][:10]}): {c['text']}", ""]
    if report["unplaced"]:
        lines += ["", "### Not placed on any block", "",
                  "These changes sit outside every folio bookmark (e.g. on the title page) or under a "
                  "bookmark the source commit's review anchors do not know.", ""]
        for u in report["unplaced"]:
            for p in u["paragraphs"]:
                lines += [f"- ~~{p['original']}~~ → {p['proposed']}"]
    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    f = sub.add_parser("finish", help="line numbers, Track Changes, deterministic zip")
    f.add_argument("docx")
    f.add_argument("--out", required=True)
    f.add_argument("--line-numbers", action="store_true")
    f.add_argument("--track-changes", action="store_true")
    f.add_argument("--epoch", type=int, default=int(os.environ.get("SOURCE_DATE_EPOCH", "315532800")))
    c = sub.add_parser("changes", help="tracked changes → per-block change records")
    c.add_argument("docx")
    c.add_argument("--repo", default=".")
    c.add_argument("--document")
    c.add_argument("--out")
    c.add_argument("--summary", help="write a Markdown summary (a PR body) here")
    c.add_argument("--site-url", help="the published document page, for block links in the summary")
    c.add_argument("--apply", action="store_true", help="edit the blocks' Markdown in the working tree")
    c.add_argument("--commit", action="store_true", help="with --apply: one commit per applied block")
    c.add_argument("--allow-unknown-commit", action="store_true")
    args = ap.parse_args(argv)
    if args.cmd == "finish":
        print(json.dumps(finish(Path(args.docx), Path(args.out), args.line_numbers, args.track_changes, args.epoch)))
        return 0
    if args.commit and not args.apply:
        ap.error("--commit needs --apply")
    return changes(args)


if __name__ == "__main__":
    sys.exit(main())
