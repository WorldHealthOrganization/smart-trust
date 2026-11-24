#!/usr/bin/env python3
"""Slide decks — PPTX and ODP — into `library/<slug>/`. Bean `scfh`, issue #1614.

A deck arrived twice, as `.pptx` and as `.odp`, and `bun run cat ingest` had no
rung for either: both sniff correctly (`_tech_meta.sniff_zip_package` reads
`[Content_Types].xml` and ODF's `mimetype` member) and then fell through to the
PDF probe, which opened a zip as a PDF.

## A slide is a page, and is written as one

A slide is a DETERMINED division, exactly as a PDF page is in `pdf-pages.py`,
so this writes the same `pdf-structure/v1` shape — one section per slide,
`page_start == page_end == <slide number>` — with `granularity: "slide"`. Every
consumer that reads `library/` (`l1-blocks.ts`, `gen-library-jsonld.ts`,
`check-l1-complete.ts`) then reads a deck without learning a second shape.

## A slide's title is READ, never inferred

`title` is the text of the slide's title placeholder (`p:ph type="title"` /
`ctrTitle`, or ODF `presentation:class="title"`). A slide without one is titled
`Slide N` and `title_source` says `none`. Picking the largest or first text box
would be the inferred-TOC failure `6xaz` records, in a new format: plausible,
confidently wrong, and invisible in the output. It is also the accessibility
finding — a slide without a title placeholder is one a screen-reader user
cannot navigate to by name — so the two questions share one answer.

## `accessibility.json` — what can be measured, and what cannot

Per slide and per image, against the checks a deck author can act on
(WCAG 2.2 2.4.2 page titled, 1.1.1 non-text content, 3.1.1 language of page):
title placeholder, alt text (with auto-generated captions flagged: "Description
automatically generated" is a caption nobody wrote), decorative marking,
language tags, document title metadata, speaker notes.

Three checks are NOT measurable from the package and are reported as
`undetermined`, never as passing: reading order (z-order is not reading order,
and only a person can say whether they agree), images of text (needs OCR and a
judgement), and colour contrast (needs rendering). A clean report that silently
omitted them would read as "accessible".

`--a11y-only` writes nothing and prints the report for each file given, then a
per-check comparison when several are — which is how the two copies of one deck
are compared.

## Stdlib only

`zipfile` + `xml.etree`, as `tabular-records.py`: a rung that needed
python-pptx or odfpy would pass on a developer's machine and fail in CI.

  python3 scripts/slides-structure.py -o library uploads/DECK.pptx
  python3 scripts/slides-structure.py --a11y-only uploads/DECK.pptx uploads/DECK.odp
"""

from __future__ import annotations

import argparse
import hashlib
import json
import posixpath
import re
import sys
import xml.etree.ElementTree as ET
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _pdf_doc_id import slugify as _slugify  # noqa: E402


def _load_tech_meta():
    import importlib.util as _u
    spec = _u.spec_from_file_location("_tech_meta", str(Path(__file__).with_name("_tech_meta.py")))
    mod = _u.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_tm = _load_tech_meta()

PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
ODP = "application/vnd.oasis.opendocument.presentation"
SLIDE_MIMETYPES = (PPTX, ODP)
A11Y_SCHEMA = "folio-slides-accessibility/v1"

NS = {
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
    "a16": "http://schemas.microsoft.com/office/drawing/2017/decorative",
    "adec": "http://schemas.microsoft.com/office/drawing/2017/decorative",
    "cp": "http://schemas.openxmlformats.org/package/2006/metadata/core-properties",
    "dc": "http://purl.org/dc/elements/1.1/",
    "draw": "urn:oasis:names:tc:opendocument:xmlns:drawing:1.0",
    "text": "urn:oasis:names:tc:opendocument:xmlns:text:1.0",
    "svg": "urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0",
    "pres": "urn:oasis:names:tc:opendocument:xmlns:presentation:1.0",
    "office": "urn:oasis:names:tc:opendocument:xmlns:office:1.0",
    "fo": "urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0",
    "style": "urn:oasis:names:tc:opendocument:xmlns:style:1.0",
    "xlink": "http://www.w3.org/1999/xlink",
    "loext": "urn:org:documentfoundation:names:experimental:office:xmlns:loext:1.0",
    "meta": "urn:oasis:names:tc:opendocument:xmlns:meta:1.0",
}


def q(prefix: str, local: str) -> str:
    return f"{{{NS[prefix]}}}{local}"


# Captions written by a vision model inside the editor, not by the author.
# Present verbatim in the deck this rung was built for (issue #1614).
_AUTO_ALT = re.compile(r"description automatically generated", re.I)
# An alt that is only a filename or a tool's default shape name says nothing.
_NAME_ALT = re.compile(r"^(image|picture|graphic|google shape)[\s;_\-\d]*[\w;]*$|\.(png|jpe?g|gif|svg)$", re.I)


@dataclass
class Picture:
    media: str  # path inside the package
    alt: str | None
    decorative: bool
    area: float | None  # placed area, in the slide's units squared


@dataclass
class Slide:
    number: int
    title: str | None
    hidden: bool
    texts: list[str] = field(default_factory=list)
    notes: str = ""
    pictures: list[Picture] = field(default_factory=list)
    loose_text_shapes: int = 0  # text outside any placeholder: reading order is z-order


@dataclass
class Deck:
    fmt: str
    slides: list[Slide]
    slide_area: float | None
    doc_title: str | None
    languages: list[str]
    language_scope: str  # "per-run" | "default-style" | "none"


# ── PPTX ────────────────────────────────────────────────────────────────────


def _rels(z: zipfile.ZipFile, part: str) -> dict[str, str]:
    """rId -> package path, for one part. Targets resolve against the part's dir."""
    d, b = posixpath.split(part)
    try:
        root = ET.fromstring(z.read(f"{d}/_rels/{b}.rels"))
    except KeyError:
        return {}
    out: dict[str, str] = {}
    for r in root:
        t = r.get("Target") or ""
        if r.get("TargetMode") == "External":
            continue
        out[r.get("Id", "")] = t.lstrip("/") if t.startswith("/") else posixpath.normpath(posixpath.join(d, t))
    return out


def _para_texts(el: ET.Element) -> list[str]:
    out = []
    for para in el.iter(q("a", "p")):
        s = "".join(t.text or "" for t in para.iter(q("a", "t"))).strip()
        if s:
            out.append(s)
    return out


def _pptx_ext(el: ET.Element) -> tuple[float, float] | None:
    ext = el.find(".//" + q("a", "ext"))
    if ext is None or ext.get("cx") is None:
        return None
    return float(ext.get("cx")), float(ext.get("cy"))


def _pptx_walk(tree: ET.Element, rels: dict[str, str], slide: Slide, scale: tuple[float, float]) -> None:
    for sh in tree:
        tag = sh.tag.split("}")[1]
        if tag == "grpSp":
            # A group's children are in CHILD coordinates: scale by ext/chExt so
            # a picture's placed area is in slide units like every other.
            xfrm = sh.find(q("p", "grpSpPr") + "/" + q("a", "xfrm"))
            sx, sy = scale
            if xfrm is not None:
                ext, chext = xfrm.find(q("a", "ext")), xfrm.find(q("a", "chExt"))
                if ext is not None and chext is not None and float(chext.get("cx", 0)) and float(chext.get("cy", 0)):
                    sx *= float(ext.get("cx")) / float(chext.get("cx"))
                    sy *= float(ext.get("cy")) / float(chext.get("cy"))
            _pptx_walk(sh, rels, slide, (sx, sy))
            continue
        c = sh.find(".//" + q("p", "cNvPr"))
        ph = sh.find(".//" + q("p", "ph"))
        if tag == "pic" or (tag == "graphicFrame" and sh.find(".//" + q("a", "blip")) is not None):
            blip = sh.find(".//" + q("a", "blip"))
            rid = blip.get(q("r", "embed")) if blip is not None else None
            if rid and rid in rels:
                ext = _pptx_ext(sh.find(q("p", "spPr")) if sh.find(q("p", "spPr")) is not None else sh)
                area = ext[0] * ext[1] * scale[0] * scale[1] if ext else None
                alt = (c.get("descr") or "").strip() or None if c is not None else None
                deco = c is not None and any(
                    e.get("val") in ("1", "true") for e in c.iter() if e.tag.endswith("}decorative")
                )
                slide.pictures.append(Picture(rels[rid], alt, deco, area))
            continue
        if tag in ("sp", "graphicFrame"):
            texts = _para_texts(sh)
            if ph is not None and ph.get("type") in ("title", "ctrTitle"):
                if texts and slide.title is None:
                    slide.title = " ".join(texts)
                continue
            if ph is not None and ph.get("type") in ("sldNum", "dt", "ftr"):
                continue  # page furniture: a slide number is not content
            if texts:
                slide.texts.extend(texts)
                if ph is None:
                    slide.loose_text_shapes += 1


def read_pptx(path: Path) -> Deck:
    with zipfile.ZipFile(path) as z:
        pres = ET.fromstring(z.read("ppt/presentation.xml"))
        prels = _rels(z, "ppt/presentation.xml")
        sz = pres.find(q("p", "sldSz"))
        slide_area = float(sz.get("cx")) * float(sz.get("cy")) if sz is not None else None
        langs: set[str] = set()
        slides: list[Slide] = []
        lst = pres.find(q("p", "sldIdLst"))
        for n, sid in enumerate(lst if lst is not None else [], start=1):
            part = prels.get(sid.get(q("r", "id")) or "")
            if not part:
                continue
            root = ET.fromstring(z.read(part))
            rels = _rels(z, part)
            s = Slide(number=n, title=None, hidden=root.get("show") == "0")
            tree = root.find(q("p", "cSld") + "/" + q("p", "spTree"))
            if tree is not None:
                _pptx_walk(tree, rels, s, (1.0, 1.0))
            for e in root.iter():
                if e.get("lang") and e.tag in (q("a", "rPr"), q("a", "endParaRPr"), q("a", "defRPr")):
                    langs.add(e.get("lang"))
            notes_part = next((t for t in rels.values() if "notesSlide" in t), None)
            if notes_part:
                nroot = ET.fromstring(z.read(notes_part))
                body = []
                for sp in nroot.iter(q("p", "sp")):
                    ph = sp.find(".//" + q("p", "ph"))
                    if ph is not None and ph.get("type") == "body":
                        body.extend(_para_texts(sp))
                s.notes = "\n".join(body).strip()
            slides.append(s)
        title = None
        try:
            core = ET.fromstring(z.read("docProps/core.xml"))
            t = core.find(q("dc", "title"))
            title = (t.text or "").strip() or None if t is not None else None
            lang = core.find(q("dc", "language"))
            if lang is not None and lang.text:
                langs.add(lang.text.strip())
        except KeyError:
            pass
    return Deck("pptx", slides, slide_area, title, sorted(langs), "per-run" if langs else "none")


# ── ODP ─────────────────────────────────────────────────────────────────────

_LEN = re.compile(r"^(-?[\d.]+)(cm|mm|in|pt|pc|px)?$")
_TO_CM = {"cm": 1.0, "mm": 0.1, "in": 2.54, "pt": 2.54 / 72, "pc": 2.54 / 6, "px": 2.54 / 96, None: 1.0}


def _cm(v: str | None) -> float | None:
    m = _LEN.match((v or "").strip())
    return float(m.group(1)) * _TO_CM[m.group(2)] if m else None


def _odf_texts(el: ET.Element) -> list[str]:
    out = []
    for tag in (q("text", "p"), q("text", "h")):
        for p in el.iter(tag):
            s = "".join(p.itertext()).strip()
            if s:
                out.append(s)
    return out


def _odp_walk(parent: ET.Element, slide: Slide) -> None:
    for f in parent:
        tag = f.tag
        if tag == q("pres", "notes"):
            body = []
            for fr in f.iter(q("draw", "frame")):
                if fr.get(q("pres", "class")) == "notes":
                    body.extend(_odf_texts(fr))
            slide.notes = "\n".join(body).strip()
            continue
        if tag == q("draw", "g"):
            _odp_walk(f, slide)
            continue
        if not tag.startswith(f"{{{NS['draw']}}}"):
            continue
        cls = f.get(q("pres", "class"))
        img = f.find(q("draw", "image"))
        if img is not None and img.get(q("xlink", "href")):
            t, d = f.find(q("svg", "title")), f.find(q("svg", "desc"))
            alt = " ".join(x.text.strip() for x in (t, d) if x is not None and x.text and x.text.strip()) or None
            w, h = _cm(f.get(q("svg", "width"))), _cm(f.get(q("svg", "height")))
            deco = f.get(q("loext", "decorative")) == "true"
            slide.pictures.append(Picture(img.get(q("xlink", "href")), alt, deco, w * h if w and h else None))
            continue
        texts = _odf_texts(f)
        if cls == "title":
            if texts and slide.title is None:
                slide.title = " ".join(texts)
            continue
        if cls in ("page-number", "date-time", "footer", "header"):
            continue
        if texts:
            slide.texts.extend(texts)
            if cls is None:
                slide.loose_text_shapes += 1


def read_odp(path: Path) -> Deck:
    with zipfile.ZipFile(path) as z:
        content = ET.fromstring(z.read("content.xml"))
        styles = ET.fromstring(z.read("styles.xml"))
        slide_area = None
        for pl in styles.iter(q("style", "page-layout-properties")):
            w, h = _cm(pl.get(q("fo", "page-width"))), _cm(pl.get(q("fo", "page-height")))
            if w and h:
                slide_area = w * h
                break
        run_langs = {e.get(q("fo", "language")) for e in content.iter() if e.get(q("fo", "language"))}
        default_langs = {e.get(q("fo", "language")) for e in styles.iter() if e.get(q("fo", "language"))}
        slides = []
        for n, pg in enumerate(content.iter(q("draw", "page")), start=1):
            s = Slide(number=n, title=None, hidden=False)
            _odp_walk(pg, s)
            slides.append(s)
        # ODF marks a hidden slide on its automatic style, not on the page.
        hidden_styles = {
            st.get(q("style", "name"))
            for st in content.iter(q("style", "style"))
            if any(p.get(q("pres", "visibility")) == "hidden" for p in st)
        }
        for pg, s in zip(content.iter(q("draw", "page")), slides):
            s.hidden = pg.get(q("draw", "style-name")) in hidden_styles
        title = None
        try:
            meta = ET.fromstring(z.read("meta.xml"))
            t = meta.find(".//" + q("dc", "title"))
            title = (t.text or "").strip() or None if t is not None else None
            lang = meta.find(".//" + q("dc", "language"))
            if lang is not None and lang.text:
                run_langs.add(lang.text.strip())
        except KeyError:
            pass
    langs = run_langs | default_langs
    scope = "per-run" if run_langs else ("default-style" if default_langs else "none")
    return Deck("odp", slides, slide_area, title, sorted(langs), scope)


def read_deck(path: Path) -> tuple[Deck, dict[str, Any]]:
    meta = _tm.tech_meta(str(path))
    mime = meta["mimetype_sniffed"]
    if mime == PPTX:
        return read_pptx(path), meta
    if mime == ODP:
        return read_odp(path), meta
    raise ValueError(f"{path.name}: sniffed {mime} — not a PPTX or ODP deck, nothing written")


# ── accessibility ───────────────────────────────────────────────────────────


def alt_verdict(p: Picture) -> str:
    """`ok` | `missing` | `auto-generated` | `filename` | `decorative`."""
    if p.decorative:
        return "decorative"
    if not p.alt:
        return "missing"
    if _AUTO_ALT.search(p.alt):
        return "auto-generated"
    if _NAME_ALT.search(p.alt.strip()):
        return "filename"
    return "ok"


def accessibility(deck: Deck, meta: dict[str, Any]) -> dict[str, Any]:
    pics = [(s.number, p) for s in deck.slides for p in s.pictures]
    verdicts = [alt_verdict(p) for _, p in pics]
    titled = [s.number for s in deck.slides if s.title]
    untitled = [s.number for s in deck.slides if not s.title]
    counts = {v: verdicts.count(v) for v in ("ok", "decorative", "missing", "auto-generated", "filename")}
    return {
        "$schema": A11Y_SCHEMA,
        "source": {"file": meta["file"], "sha256": meta["sha256"], "mimetype_sniffed": meta["mimetype_sniffed"]},
        "format": deck.fmt,
        "slides": len(deck.slides),
        "checks": {
            "slide-titles": {
                "criterion": "WCAG 2.2 SC 2.4.2 / 2.4.6 — each slide has a title placeholder",
                "pass": len(titled),
                "fail": len(untitled),
                "failing_slides": untitled,
            },
            "alt-text": {
                "criterion": "WCAG 2.2 SC 1.1.1 — every non-decorative image has a text alternative written by a person",
                "pictures": len(pics),
                **counts,
                "failing": [
                    {"slide": n, "media": p.media, "verdict": v, "alt": p.alt}
                    for (n, p), v in zip(pics, verdicts)
                    if v not in ("ok", "decorative")
                ],
            },
            "language": {
                "criterion": "WCAG 2.2 SC 3.1.1 — the language of the content is declared",
                "languages": deck.languages,
                "scope": deck.language_scope,
                "pass": bool(deck.languages),
            },
            "document-title": {
                "criterion": "WCAG 2.2 SC 2.4.2 — the file declares a title",
                "title": deck.doc_title,
                "pass": deck.doc_title is not None,
            },
            "speaker-notes": {
                "criterion": "informational — notes are where a presenter's spoken explanation of a visual lives",
                "slides_with_notes": [s.number for s in deck.slides if s.notes],
            },
            "hidden-slides": {"slides": [s.number for s in deck.slides if s.hidden]},
            # The third state, stated: nothing in the package answers these.
            "reading-order": {
                "state": "undetermined",
                "why": "text outside placeholders is read in z-order, which only a person can confirm matches the visual order",
                "loose_text_shapes": sum(s.loose_text_shapes for s in deck.slides),
            },
            "images-of-text": {"state": "undetermined", "why": "needs OCR and a judgement per image"},
            "contrast": {"state": "undetermined", "why": "needs the slides rendered; the package holds colours, not what they sit on"},
        },
    }


def compare(reports: list[dict[str, Any]]) -> list[str]:
    """One line per check: which file does better, or `tie`. No aggregate grade:
    a single score would weigh a missing title against a missing alt text, and
    nothing here supports that weighting."""
    def keyed(r):
        c = r["checks"]
        return {
            "slides with a title": c["slide-titles"]["pass"],
            "images with usable alt text": c["alt-text"]["ok"] + c["alt-text"]["decorative"],
            "language declared per run": 1 if c["language"]["scope"] == "per-run" else 0,
            "language declared at all": 1 if c["language"]["pass"] else 0,
            "document title": 1 if c["document-title"]["pass"] else 0,
            "slides with speaker notes": len(c["speaker-notes"]["slides_with_notes"]),
        }
    ks = [keyed(r) for r in reports]
    lines = []
    for check in ks[0]:
        vals = [k[check] for k in ks]
        best = max(vals)
        winners = [r["source"]["file"] for r, v in zip(reports, vals) if v == best]
        verdict = "tie" if len(winners) == len(reports) else " / ".join(winners)
        lines.append(f"  {check:32s} " + "  ".join(f"{v:>4}" for v in vals) + f"   → {verdict}")
    return lines


# ── L1 entry ────────────────────────────────────────────────────────────────


def _front(d: dict[str, Any]) -> str:
    return "---\n" + "".join(f"{k}: {json.dumps(v, ensure_ascii=False) if isinstance(v, str) and (':' in v or '#' in v or v != v.strip() or not v) else v}\n" for k, v in d.items()) + "---\n"


def write_entry(path: Path, outdir: Path) -> Path:
    deck, meta = read_deck(path)
    slug = _slugify(path.stem)
    out = outdir / slug
    (out / "sections").mkdir(parents=True, exist_ok=True)
    (out / "images").mkdir(exist_ok=True)
    report = accessibility(deck, meta)

    # Images: one file per distinct BYTES, every use a placement — the same
    # picture on two slides is one image placed twice, as `pdf-images.py` has it.
    images: dict[str, dict[str, Any]] = {}
    with zipfile.ZipFile(path) as z:
        for s in deck.slides:
            on_slide = len(s.pictures)
            for k, p in enumerate(s.pictures, start=1):
                try:
                    data = z.read(p.media)
                except KeyError:
                    continue
                h = hashlib.sha256(data).hexdigest()
                cov = round(p.area / deck.slide_area, 4) if p.area and deck.slide_area else 0.0
                placement = {"page": s.number, "coverage": cov, "imagesOnPage": on_slide}
                if h in images:
                    images[h]["placements"].append(placement)
                    continue
                ext = posixpath.splitext(p.media)[1].lower() or ".bin"
                iid = f"img-p{s.number:03d}-{k}"
                (out / "images" / f"{iid}{ext}").write_bytes(data)
                basis = {"method": "geometry", **placement}
                # Never `page-scan`. In a PDF a full-bleed image alone on a page
                # is the page, whose text the text layer already holds. On a
                # slide it is the CONTENT — measured on the #1614 deck, whose
                # slide 12 is one full-bleed picture and nothing else — and
                # calling it a scan would drop its description slot.
                role = "figure"
                entry: dict[str, Any] = {"id": iid, "file": f"images/{iid}{ext}", "role": role, "basis": basis,
                                         "placements": [placement]}
                if role == "figure":
                    entry["narrative"] = {"text": None, "state": "not-authored"}
                images[h] = entry
    for e in images.values():
        if len(e["placements"]) == 1:
            del e["placements"]
    (out / "images.json").write_text(json.dumps(
        {"$schema": "folio-document-images/v1", "doc_id": slug, "images": list(images.values())},
        indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    sections = []
    for s in deck.slides:
        sid = f"slide-{s.number:03d}"
        title = s.title or f"Slide {s.number}"
        body = list(s.texts)
        if s.notes:
            body += ["", "## Speaker notes", "", s.notes]
        if s.pictures:
            body += ["", "## Images", ""]
            body += [f"- `{posixpath.basename(p.media)}` — alt: {json.dumps(p.alt) if p.alt else '(none)'}"
                     f" [{alt_verdict(p)}]" for p in s.pictures]
        text = "\n".join(body).strip() + "\n"
        fm = {"doc_id": slug, "doc_title": deck.doc_title or slug, "section_id": sid, "section_title": title,
              "title_source": "placeholder" if s.title else "none", "pages": f"{s.number}-{s.number}",
              "slide": s.number, "hidden": str(s.hidden).lower(), "source_file": meta["file"],
              "source_sha256": meta["sha256"][:16], "text_source": "embedded", "granularity": "slide"}
        (out / "sections" / f"{sid}.md").write_text(_front(fm) + text, encoding="utf-8")
        sections.append({"id": sid, "number": str(s.number), "title": title, "level": 1,
                         "page_start": s.number, "page_end": s.number,
                         "n_chars": len(text), "n_words": len(text.split())})

    untitled = report["checks"]["slide-titles"]["failing_slides"]
    structure = {
        "_schema": "pdf-structure/v1",
        "doc_id": slug,
        "source": {**meta, "text_source": "embedded"},
        "metadata": {"title": deck.doc_title, "docinfo": {"format": deck.fmt, "languages": deck.languages}},
        "toc_source": "none",
        "granularity": "slide",
        "sections": sections,
        "structure_note": (
            f"One section per slide ({len(sections)}), in presentation order. A section's title is its slide's "
            f"title PLACEHOLDER; {len(untitled)} slide(s) have none and are titled 'Slide N' rather than given a "
            "title inferred from their largest text box. Diagram content inside images is not extracted here — "
            "see images.json and accessibility.json."
        ),
    }
    (out / "structure.json").write_text(json.dumps(structure, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (out / "accessibility.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("files", nargs="+", type=Path)
    ap.add_argument("-o", "--outdir", type=Path, default=Path("."))
    ap.add_argument("--a11y-only", action="store_true", help="print the accessibility report; write nothing")
    ap.add_argument("--json", action="store_true", help="with --a11y-only, print the reports as JSON")
    a = ap.parse_args()
    if a.a11y_only:
        reports = []
        for f in a.files:
            try:
                deck, meta = read_deck(f)
            except (ValueError, OSError, zipfile.BadZipFile, ET.ParseError, KeyError) as e:
                print(f"SKIP {f.name}: {e}", file=sys.stderr)
                return 1
            reports.append(accessibility(deck, meta))
        if a.json:
            print(json.dumps(reports, indent=2, ensure_ascii=False))
            return 0
        for r in reports:
            c = r["checks"]
            print(f"{r['source']['file']}  [{r['format']}]  {r['slides']} slides")
            print(f"  titled slides           {c['slide-titles']['pass']}/{r['slides']}")
            at = c["alt-text"]
            print(f"  images: ok {at['ok']}, decorative {at['decorative']}, missing {at['missing']}, "
                  f"auto-generated {at['auto-generated']}, filename {at['filename']}  (of {at['pictures']})")
            print(f"  language                {c['language']['languages'] or 'none'} ({c['language']['scope']})")
            print(f"  document title          {c['document-title']['title']!r}")
            print("  reading order, images of text, contrast: undetermined — not measurable from the package")
        if len(reports) > 1:
            print("\nper check (higher is better):")
            print("\n".join(compare(reports)))
        return 0
    for f in a.files:
        try:
            out = write_entry(f, a.outdir)
        except (ValueError, OSError, zipfile.BadZipFile, ET.ParseError, KeyError) as e:
            print(f"SKIP {f.name}: {e}", file=sys.stderr)
            return 1
        print(f"ok  {out.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
