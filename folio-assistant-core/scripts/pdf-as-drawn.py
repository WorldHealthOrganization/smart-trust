#!/usr/bin/env python3
"""Transcribe a figure's vector drawing from the source PDF into
`as-drawn-figure/v1` data, so `as-drawn-svg.ts` can redraw it as an SVG that
keeps the original's layout and style.

    python3 -I folio-assistant-core/scripts/pdf-as-drawn.py \
        --entry who-iris/library/<doc-id> --pdf who-iris/uploads/<doc-id>/<doc-id>.pdf \
        --out figure-data/as-drawn \
        [--glossary glossary/<x>.glossary.json=<IRI base>]... \
        [--skip-page <n>]... [<figure number>...]

Then draw the SVGs with `as-drawn-svg.ts`. Paths are taken from the current
directory, the instance root, and recorded as given.

Read from the L1 entry: the figure region and caption of each
`vector-figures.json` render (role "figure"), and the PDF the entry was built
from. Everything inside the region is transcribed in paint order: every
filled or stroked path (its exact coordinates, colour, line width and dash),
every text run (its baseline, font size and weight, colour and printed width,
so it keeps its place in another font), and any raster image (cropped from a
600 dpi render and embedded). The caption line is left out, because the
figure block prints it. Nothing is added that the PDF does not draw.

Labels that equal a `--glossary` term's prefLabel or altLabel exactly (case
folded) get that term's IRI (the IRI base plus the term id); nothing else is
linked. `--skip-page` leaves a render alone: a figure that already has a
generated SVG, or third-party content the folio may not copy.

Needs pdfplumber.
"""
import argparse
import base64
import io
import json
import math
import re
import sys
from pathlib import Path

import pdfplumber
import pdfplumber.page
from pdfminer import converter, pdfinterp
from pdfminer.pdftypes import resolve1
from pdfminer.utils import apply_matrix_pt

NDIG = 2



# --- What pdfminer drops, kept: paint operations, clips, soft masks, alpha ---
#
# pdfminer splits a compound path (an icon outline with holes) into one object
# per subpath, ignores clipping paths (W, W*), and ignores the graphics state's
# soft mask and constant alpha (gs). Redrawn from those objects, holes fill in
# solid, clipped artwork spills out, and a masked drop shadow prints as a black
# box. These patches tag each painted object with the paint operation it came
# from, the clipping paths in force, and its soft mask and alpha, so a compound
# path is rejoined and drawn with its clips.

STATE = {"op": 0, "depth": 0, "clips": (), "smask": False, "ca": 1.0, "CA": 1.0, "stack": []}
for _a in ("op", "clip", "smask", "ca", "CA"):
    pdfplumber.page.ALL_ATTRS.add(_a)


def _flip_path(ctm, path, height):
    out = []
    for seg in path:
        k, nums = seg[0], seg[1:]
        pts = [apply_matrix_pt(ctm, (float(a), float(b))) for a, b in zip(nums[::2], nums[1::2])]
        out.append((k, *[(x, height - y) for x, y in pts]))
    return out


_orig_q, _orig_Q, _orig_gs = pdfinterp.PDFPageInterpreter.do_q, pdfinterp.PDFPageInterpreter.do_Q, pdfinterp.PDFPageInterpreter.do_gs


def _do_q(self):
    STATE["stack"].append((STATE["clips"], STATE["smask"], STATE["ca"], STATE["CA"]))
    return _orig_q(self)


def _do_Q(self):
    if STATE["stack"]:
        STATE["clips"], STATE["smask"], STATE["ca"], STATE["CA"] = STATE["stack"].pop()
    return _orig_Q(self)


def _do_gs(self, name):
    try:
        gs = resolve1(resolve1(self.resources.get("ExtGState", {})).get(getattr(name, "name", name)))
        if gs:
            sm = resolve1(gs.get("SMask"))
            if sm is not None:
                STATE["smask"] = not (getattr(sm, "name", sm) == "None")
            if "ca" in gs:
                STATE["ca"] = float(resolve1(gs["ca"]))
            if "CA" in gs:
                STATE["CA"] = float(resolve1(gs["CA"]))
    except Exception:  # noqa: BLE001 - an unreadable gs leaves the state as it was
        pass
    return _orig_gs(self, name)


def _clip(evenodd):
    def do(self):
        h = STATE.get("height", 0)
        if self.curpath:
            STATE["clips"] = STATE["clips"] + ((tuple(_flip_path(self.ctm, self.curpath, h)), evenodd),)
    return do


_orig_Do = pdfinterp.PDFPageInterpreter.do_Do


def _do_Do(self, xobjid):
    # A soft mask set outside a form XObject masks everything the form paints,
    # even when the form's own gs says SMask /None.
    prev = STATE.get("outer", False)
    STATE["outer"] = prev or STATE["smask"]
    try:
        return _orig_Do(self, xobjid)
    finally:
        STATE["outer"] = prev


pdfinterp.PDFPageInterpreter.do_Do = _do_Do
pdfinterp.PDFPageInterpreter.do_q = _do_q
pdfinterp.PDFPageInterpreter.do_Q = _do_Q
pdfinterp.PDFPageInterpreter.do_gs = _do_gs
pdfinterp.PDFPageInterpreter.do_W = _clip(False)
pdfinterp.PDFPageInterpreter.do_W_a = _clip(True)

_orig_paint = converter.PDFLayoutAnalyzer.paint_path


def _paint(self, gstate, stroke, fill, evenodd, path):
    top = STATE["depth"] == 0
    if top:
        STATE["op"] += 1
        before = len(self.cur_item._objs)
    STATE["depth"] += 1
    try:
        _orig_paint(self, gstate, stroke, fill, evenodd, path)
    finally:
        STATE["depth"] -= 1
    if top:
        for o in self.cur_item._objs[before:]:
            o.op = STATE["op"]
            o.clip = STATE["clips"]
            o.smask = STATE["smask"] or STATE.get("outer", False)
            o.ca = STATE["ca"]
            o.CA = STATE["CA"]
            o.linecap = gstate.linecap
            a, b, c, d = self.ctm[:4]
            o.lwscale = math.sqrt(abs(a * d - b * c)) or 1.0
            o.linejoin = gstate.linejoin


converter.PDFLayoutAnalyzer.paint_path = _paint

# The PDF default line width is 1 (PDF 32000-1, Table 52); pdfminer starts at
# 0, so a stroke that never sets `w` would be drawn as a hairline.
_orig_gs_init = pdfinterp.PDFGraphicState.__init__


def _gs_init(self):
    _orig_gs_init(self)
    self.linewidth = 1.0


pdfinterp.PDFGraphicState.__init__ = _gs_init

for _a in ("trender", "linecap", "linejoin", "lwscale"):
    pdfplumber.page.ALL_ATTRS.add(_a)
_orig_string = converter.PDFLayoutAnalyzer.render_string
_orig_image = converter.PDFLayoutAnalyzer.render_image


def _tag_new(self, before, **extra):
    for o in self.cur_item._objs[before:]:
        o.clip = STATE["clips"]
        o.smask = STATE["smask"] or STATE.get("outer", False)
        for k, v in extra.items():
            setattr(o, k, v)


def _render_string(self, textstate, seq, ncs, graphicstate):
    before = len(self.cur_item._objs)
    _orig_string(self, textstate, seq, ncs, graphicstate)
    _tag_new(self, before, trender=textstate.render)


def _render_image(self, name, stream):
    before = len(self.cur_item._objs)
    _orig_image(self, name, stream)
    _tag_new(self, before)


converter.PDFLayoutAnalyzer.render_string = _render_string
converter.PDFLayoutAnalyzer.render_image = _render_image


def r(v):
    return round(float(v), NDIG)


# DeviceCMYK to RGB as xpdf and poppler convert it (GfxDeviceCMYKColorSpace):
# interpolate between the RGB of the 16 corners of the CMYK cube. The naive
# (1-c)(1-k) formula renders process colours far too saturated.
CMYK_CORNERS = {
    (0, 0, 0, 0): (1, 1, 1), (0, 0, 0, 1): (0.1373, 0.1216, 0.1255),
    (0, 0, 1, 0): (1, 0.9490, 0), (0, 0, 1, 1): (0.1098, 0.1020, 0),
    (0, 1, 0, 0): (0.9255, 0, 0.5490), (0, 1, 0, 1): (0.1412, 0, 0),
    (0, 1, 1, 0): (0.9294, 0.1098, 0.1412), (0, 1, 1, 1): (0.1333, 0, 0),
    (1, 0, 0, 0): (0, 0.6784, 0.9373), (1, 0, 0, 1): (0, 0.0588, 0.1412),
    (1, 0, 1, 0): (0, 0.6510, 0.3137), (1, 0, 1, 1): (0, 0.0745, 0),
    (1, 1, 0, 0): (0.1804, 0.1922, 0.5725), (1, 1, 0, 1): (0, 0, 0.0078),
    (1, 1, 1, 0): (0.2118, 0.1176, 0.1255), (1, 1, 1, 1): (0, 0, 0),
}


def cmyk_to_rgb(c, m, y, k):
    out = [0.0, 0.0, 0.0]
    for (cc, mm, yy, kk), rgb in CMYK_CORNERS.items():
        w = ((c if cc else 1 - c) * (m if mm else 1 - m) * (y if yy else 1 - y) * (k if kk else 1 - k))
        for i in range(3):
            out[i] += w * rgb[i]
    return tuple(out)


def hexcolour(c):
    """A PDF colour (gray, RGB or CMYK tuple) as #RRGGBB, or None."""
    if c is None:
        return None
    if isinstance(c, (int, float)):
        c = (c,)
    if not isinstance(c, (tuple, list)) or not all(isinstance(x, (int, float)) for x in c):
        return None
    if len(c) == 1:
        g = c[0]
        rgb = (g, g, g)
    elif len(c) == 3:
        rgb = c
    elif len(c) == 4:
        rgb = cmyk_to_rgb(*c)
    else:
        return None
    return "#" + "".join(f"{max(0, min(255, round(x * 255))):02X}" for x in rgb)


def path_d(path, dx, dy):
    out = []
    cur = start = (0.0, 0.0)
    for op in path:
        k, pts = op[0], list(op[1:])
        if k == "h":
            out.append("Z")
            cur = start
            continue
        if k == "v":  # first control point is the current point
            k, pts = "c", [cur] + pts
        elif k == "y":  # second control point is the end point
            k, pts = "c", [pts[0], pts[1], pts[1]]
        coords = " ".join(f"{r(x - dx):g} {r(y - dy):g}" for x, y in pts)
        out.append(f"{k.upper()}{coords}")
        cur = pts[-1]
        if k == "m":
            start = cur
    return "".join(out)


def weight(font):
    f = font.split("+")[-1].lower()
    for key, w in (("black", 900), ("extrabold", 800), ("bold", 700), ("semibold", 600),
                   ("medium", 500), ("light", 300)):
        if key in f:
            return w
    return 400


def italic(font):
    f = font.split("+")[-1].lower()
    return "italic" in f or f.endswith("-it") or "oblique" in f


def glossary_index(glossaries):
    idx = {}
    for g, base in glossaries:
        if not g.exists():
            continue
        data = json.loads(g.read_text(encoding="utf-8"))
        for t in data.get("terms") or []:
            iri = base + t["id"]
            labels = [t.get("prefLabel")] + list(t.get("altLabel") or [])
            for lab in labels:
                if isinstance(lab, dict):
                    lab = lab.get("en")
                if lab and iri:
                    idx.setdefault(norm(lab), iri)
    return idx


def norm(s):
    return re.sub(r"\s+", " ", s.replace("­", "")).strip().casefold()


def clip_contains(cpath, bbox, tol=0.5):
    """A clip that is an axis-aligned rectangle holding the whole shape cuts nothing."""
    pts = [pt for seg in cpath for pt in seg[1:]]
    ks = "".join(seg[0] for seg in cpath)
    if not pts or "c" in ks or ks.count("m") != 1:
        return False
    xs = sorted({round(x, 2) for x, _ in pts}); ys = sorted({round(y, 2) for _, y in pts})
    if len(xs) != 2 or len(ys) != 2:
        return False
    return xs[0] - tol <= bbox[0] and bbox[2] <= xs[1] + tol and ys[0] - tol <= bbox[1] and bbox[3] <= ys[1] + tol


def clip_excludes(cpath, bbox):
    """A clip whose bounding box misses the shape's entirely hides it."""
    pts = [pt for seg in cpath for pt in seg[1:]]
    if not pts:
        return False
    xs = [x for x, _ in pts]; ys = [y for _, y in pts]
    return bbox[2] < min(xs) or bbox[0] > max(xs) or bbox[3] < min(ys) or bbox[1] > max(ys)


def inside(o, reg, pad=1.0):
    x0, t, x1, b = reg
    cx = (o["x0"] + o["x1"]) / 2
    cy = (o["top"] + o["bottom"]) / 2
    return x0 - pad <= cx <= x1 + pad and t - pad <= cy <= b + pad


def runs_from_chars(chars):
    """Group chars, in stream order, into runs on one baseline in one style.

    Works in the run's own direction, so vertical labels group like level ones:
    `along` is the position on the baseline, `perp` the baseline's offset.
    """
    runs = []
    cur = None
    for ch in chars:
        m = ch["matrix"]
        ang = math.degrees(math.atan2(m[1], m[0]))
        rad = math.radians(ang)
        along = m[4] * math.cos(rad) + m[5] * math.sin(rad)
        perp = -m[4] * math.sin(rad) + m[5] * math.cos(rad)
        size = math.hypot(m[2], m[3])  # the font size along the glyph's own vertical
        adv = (ch.get("adv") or 0.5) * size
        style = (ch["fontname"], r(size), hexcolour(ch.get("non_stroking_color")), round(ang))
        if cur is not None and cur["style"] == style and abs(cur["perp"] - perp) < 0.6:
            gap = along - cur["end"]
            if -0.5 * size < gap < 0.9 * size:
                if gap > 0.15 * size and not cur["text"].endswith(" ") and ch["text"] != " ":
                    cur["text"] += " "
                cur["text"] += ch["text"]
                cur["end"] = along + adv
                if ch["text"].strip():
                    cur["inkEnd"] = along + adv
                cur["chars"].append(ch)
                continue
        cur = {"style": style, "perp": perp, "start": along, "end": along + adv,
               "inkEnd": along + adv if ch["text"].strip() else along,
               "text": ch["text"], "origin": (m[4], m[5]), "chars": [ch]}
        runs.append(cur)
    return runs


def caption_runs(runs, caption):
    """The runs that print the caption line(s): from the run that starts the
    caption, every run in the same style within three lines below it whose
    text is part of the caption."""
    if not caption:
        return set()
    cap = norm(caption).replace(" ", "")
    first = None
    for i, run in enumerate(runs):
        t = norm(run["text"]).replace(" ", "")
        if len(t) >= 6 and cap.startswith(t):
            first = i
            break
    if first is None:
        return set()
    f = runs[first]
    size = f["style"][1]
    out = set()
    for i, run in enumerate(runs):
        t = norm(run["text"]).replace(" ", "")
        if (t and run["style"][1] == size and run["style"][3] == f["style"][3] and t in cap
                and -0.5 * size <= f["origin"][1] - run["origin"][1] <= 3.2 * size):
            out.add(i)
    return out


def clamp_region(region, page):
    """The figure region, kept on the page and below the chapter tabs: a
    region can run off the page (Fig. 7's starts at x = -356), and nothing
    off the page is printed."""
    return [max(region[0], 0.0), max(region[1], HEADER_BOTTOM), min(region[2], float(page.width)), min(region[3], float(page.height))]


HEADER_BOTTOM = 38.0  # the handbook's chapter tabs run along the top of each page, above 38 pt


def transcribe(fig, page, gl, caption_text):
    reg = clamp_region(fig["region"], page)
    x0, top = reg[0], reg[1]
    H = page.height
    STATE.update(outer=False, op=0, depth=0, clips=(), smask=False, ca=1.0, CA=1.0, stack=[], height=H)
    objs = list(page.iter_layout_objects(page.layout._objs))
    shapes, chars, images = [], [], []
    clips, clip_ix = [], {}
    masked = 0
    ops = {}
    order = []
    for o in objs:
        t = o["object_type"]
        if t in ("curve", "rect", "line"):
            if o.get("op") is None or not o.get("path"):
                continue
            if o["op"] not in ops:
                ops[o["op"]] = []
                order.append(("op", o["op"]))
            ops[o["op"]].append(o)
        elif t == "char" and inside(o, reg):
            chars.append(o)
        elif t == "image" and inside(o, reg):
            images.append(o)
    def clip_refs(o, bbox):
        """Indices of the clips that cut this bbox; "hidden" when one excludes it."""
        cuts = []
        for cpath, ceo in o.get("clip") or ():
            if clip_contains(cpath, bbox):
                continue
            if clip_excludes(cpath, bbox):
                return "hidden"
            key = (cpath, ceo)
            if key not in clip_ix:
                clip_ix[key] = len(clips)
                c = {"d": path_d(cpath, x0, top)}
                if ceo:
                    c["evenodd"] = True
                clips.append(c)
            cuts.append(clip_ix[key])
        return cuts

    for _, n in order:
        parts = ops[n]
        bx0 = min(o["x0"] for o in parts); bx1 = max(o["x1"] for o in parts)
        bt = min(o["top"] for o in parts); bb = max(o["bottom"] for o in parts)
        if not inside({"x0": bx0, "x1": bx1, "top": bt, "bottom": bb}, reg):
            continue
        o = parts[0]
        fill = hexcolour(o.get("non_stroking_color")) if o.get("fill") else None
        stroke = hexcolour(o.get("stroking_color")) if o.get("stroke") else None
        if not fill and not stroke:
            continue
        if o.get("smask"):
            masked += 1  # a soft-masked paint (a drop shadow): its mask is not transcribed
            continue
        s = {"d": "".join(path_d(p["path"], x0, top) for p in parts)}
        if fill:
            s["fill"] = fill
            if o.get("evenodd"):
                s["evenodd"] = True
            if (o.get("ca") or 1.0) < 1.0:
                s["fillOpacity"] = r(o["ca"])
        if stroke:
            s["stroke"] = stroke
            # Line width and dash are in user space: scale them by the CTM.
            k = o.get("lwscale") or 1.0
            s["strokeWidth"] = r((o.get("linewidth") or 0.0) * k) or 0.25
            dash = o.get("dash")
            if dash and dash[0]:
                s["dash"] = [r(x * k) for x in dash[0]]
            if o.get("linecap") in (1, 2):
                s["cap"] = "round" if o["linecap"] == 1 else "square"
            if o.get("linejoin") in (1, 2):
                s["join"] = "round" if o["linejoin"] == 1 else "bevel"
            if (o.get("CA") or 1.0) < 1.0:
                s["strokeOpacity"] = r(o["CA"])
        cuts = clip_refs(o, (bx0, bt, bx1, bb))
        if cuts == "hidden":
            continue
        if cuts:
            s["clip"] = cuts
        shapes.append(s)
    # Leave out the caption line(s) ("Fig 1. ..."), which the block prints,
    # and text the PDF does not show (render mode 3 or 7: invisible).
    runs = runs_from_chars([c for c in chars if c.get("trender") not in (3, 7)])
    drop = caption_runs(runs, caption_text)
    texts = []
    for i, run in enumerate(runs):
        if i in drop:
            continue
        txt = run["text"].replace("\u00ad", "")
        lead = len(txt) - len(txt.lstrip())
        txt = txt.strip()
        if not txt:
            continue
        font, size, colour, ang = run["style"]
        c0 = run["chars"][lead] if lead < len(run["chars"]) else run["chars"][0]
        ox, oy = c0["matrix"][4], c0["matrix"][5]
        bbox = (min(c["x0"] for c in run["chars"]), min(c["top"] for c in run["chars"]),
                max(c["x1"] for c in run["chars"]), max(c["bottom"] for c in run["chars"]))
        cuts = clip_refs(c0, bbox)
        if cuts == "hidden":
            continue
        rad = math.radians(ang)
        start = ox * math.cos(rad) + oy * math.sin(rad)
        t = {"x": r(ox - x0), "y": r(H - oy - top), "size": size, "text": txt}
        w = weight(font)
        if w != 400:
            t["weight"] = w
        if italic(font):
            t["italic"] = True
        if colour and colour != "#000000":
            t["color"] = colour
        if ang:
            t["rotate"] = -ang
        width = r(run["inkEnd"] - start)
        if width > 0:
            t["width"] = width
        if cuts:
            t["clip"] = cuts
        iri = gl.get(norm(t["text"]))
        if iri:
            t["link"] = iri
        texts.append(t)
    imgs = []
    for im in images:
        bbox = (im["x0"], im["top"], im["x1"], im["bottom"])
        cuts = clip_refs(im, bbox)
        if cuts == "hidden":
            continue
        png = page.crop(bbox).to_image(resolution=600).original
        buf = io.BytesIO()
        png.save(buf, format="PNG", optimize=True)
        imgs.append({"x": r(im["x0"] - x0), "y": r(im["top"] - top), "width": r(im["x1"] - im["x0"]),
                     "height": r(im["bottom"] - im["top"]), "png": base64.b64encode(buf.getvalue()).decode(),
                     **({"clip": cuts} if cuts else {})})
    return {"width": r(reg[2] - reg[0]), "height": r(reg[3] - reg[1])}, shapes, texts, imgs, clips, masked


def pick_caption(candidates, nums):
    """The caption title among the page's caption candidates: the one that
    reads "Fig N. <title>" for this figure, from that point on (a candidate can
    start with the badge's "Fig. N" before it). Not a cross-reference such as
    "Fig. 25 depicts ..." or the badge alone."""
    for n in nums:
        for c in candidates:
            m = list(re.finditer(r"Fig\.? ?%s\. \S" % re.escape(n), c))
            if m:
                return c[m[-1].start():]
    return None


def section_for(page, structure):
    """The deepest L1 section whose pages hold this page (the latest to start)."""
    best = None
    for sec in structure["sections"]:
        if sec["page_start"] <= page <= sec["page_end"] and sec["id"] != "sec-front-matter":
            if best is None or sec["page_start"] >= best["page_start"]:
                best = sec
    return best


def main(argv):
    ap = argparse.ArgumentParser(description="Transcribe an L1 entry's figures as as-drawn-figure/v1 data.")
    ap.add_argument("--entry", required=True, help="the L1 library entry directory (holds vector-figures.json)")
    ap.add_argument("--pdf", required=True, help="the PDF the entry was built from")
    ap.add_argument("--out", required=True, help="the directory to write fig-<N>.json into")
    ap.add_argument("--glossary", action="append", default=[], metavar="FILE=IRIBASE")
    ap.add_argument("--skip-page", action="append", type=int, default=[], metavar="N")
    ap.add_argument("figures", nargs="*", help="only these figure numbers")
    a = ap.parse_args(argv)
    entry, out = Path(a.entry), Path(a.out)
    lib_id = entry.name
    glossaries = [(Path(g.split("=", 1)[0]), g.split("=", 1)[1]) for g in a.glossary]
    want, skip = set(a.figures), set(a.skip_page)
    vf = json.loads((entry / "vector-figures.json").read_text(encoding="utf-8"))["figures"]
    labels = {p["page"]: p for p in json.loads((entry / "vector-labels.json").read_text(encoding="utf-8"))["pages"]}
    gl = glossary_index(glossaries)
    structure = json.loads((entry / "structure.json").read_text(encoding="utf-8"))
    out.mkdir(parents=True, exist_ok=True)
    pdf = pdfplumber.open(a.pdf)
    for fig in vf:
        if fig.get("role") != "figure" or fig["page"] in skip:
            continue
        nums = fig.get("shows") or fig.get("captionLabels") or []
        if want and not (set(nums) & want):
            continue
        page = pdf.pages[fig["page"] - 1]
        caption = pick_caption(labels.get(fig["page"], {}).get("captionCandidates") or [], nums)
        canvas, shapes, texts, imgs, clips, masked = transcribe(fig, page, gl, caption)
        sec = section_for(fig["page"], structure)
        data = {
            "$schema": "as-drawn-figure/v1",
            "figure": {
                "library": lib_id,
                "labels": [f"Fig. {n}" for n in nums],
                "caption": caption,
                "page": fig["page"],
                "file": f"{a.entry.rstrip('/')}/{fig['file']}",
                "render": fig["id"],
                "section": {"id": sec["id"], "title": sec["title"],
                            "file": f"{a.entry.rstrip('/')}/sections/{sec['id']}.md"},
            },
            "basis": ("transcribed from the source PDF's vector layer by folio-assistant-core scripts/pdf-as-drawn.py: "
                      "every path, text run and image inside the L1 figure region, in paint order, "
                      "with coordinates relative to the region's top-left corner, in PDF points"),
            "region": [r(v) for v in clamp_region(fig["region"], page)],
            "canvas": canvas,
            "clips": clips,
            "shapes": shapes,
            "texts": texts,
        }
        if imgs:
            data["images"] = imgs
        if masked:
            data["omitted"] = {"softMasked": masked, "why": "soft-masked paints (drop shadows) are not transcribed: their luminosity mask is not read"}
        path = out / ("fig-" + "-".join(nums) + ".json")
        path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(f"{path}: {len(shapes)} shapes, {len(texts)} text runs, {len(imgs)} images")


if __name__ == "__main__":
    main(sys.argv[1:])
