#!/usr/bin/env python3
"""Draw the GDHCN trust network in the home page figure's original style, from the ArchiMate model.

Usage:
    python3 -I archimate/pretty.py           # write input/includes/trust-network-pretty.svg
    python3 -I archimate/pretty.py --check   # fail if the committed drawing is stale

The ArchiMate view "The GDHCN trust network" (archimate/build.py) is the one
source. This script reads it from the built model and draws it the way
input/images/trust_network.png does: three framed panels with a red step
number, a pictogram per actor, a key per public key, a document per signed
document, the processes as green captions and the flows as blue arrows.
Nothing is typed here except how a kind of thing looks:

- every pictogram is placed where the view places its box;
- every pictogram is labelled with its element's name and links its page (the
  element's `page` property: its ActorDefinition or its concept);
- every arrow is a Flow of the view, labelled with its name where it has one;
  a Flow named "both ways", or two Flows each way between the same boxes, is
  drawn as one double arrow;
- a system that reads a data object (an Access of type read) gets an arrow from
  that object: the members reading the trust list are the figure's arrows from
  the key box to each country.

The archimate-pages visualiser draws the same view in ArchiMate notation; the
home page offers both, with a toggle. Standard library only.
"""

import html
import math
import re
import sys
import textwrap
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "input/includes/trust-network-pretty.svg"
VIEW = "The GDHCN trust network"
XSI = "{http://www.w3.org/2001/XMLSchema-instance}type"
BLUE, RED, GREEN, GOLD, INK = "#4F8FD8", "#E8322B", "#3BA55C", "#F2C230", "#111111"


def esc(s):
    return html.escape(str(s), quote=True)


def version():
    return re.search(r"^version:\s*(\S+)", (ROOT / "sushi-config.yaml").read_text(encoding="utf-8"), re.M).group(1)


def read_view():
    """The view's boxes (absolute bounds, element) and its Flow connections, from the built model."""
    model = ROOT / "archimate" / version() / "smart-trust.archimate"
    root = ET.fromstring(zipfile.ZipFile(model).read("model.xml"))
    els = {}
    for e in root.iter("element"):
        props = {p.get("key"): p.get("value") for p in e.findall("property")}
        doc = e.findtext("documentation") or ""
        els[e.get("id")] = {"type": e.get(XSI, "").split(":")[-1], "name": e.get("name", ""), "doc": doc,
                            "page": props.get("page", ""), "source": e.get("source"), "target": e.get("target"),
                            "access": e.get("accessType")}
    view = next(e for e in root.iter("element") if e.get(XSI) == "archimate:ArchimateDiagramModel" and e.get("name") == VIEW)
    boxes, conns, reads = {}, [], []

    def walk(node, ox, oy, parent):
        for c in node.findall("child"):
            b = c.find("bounds")
            x, y = ox + int(b.get("x")), oy + int(b.get("y"))
            boxes[c.get("id")] = {"x": x, "y": y, "w": int(b.get("width")), "h": int(b.get("height")),
                                  "el": els[c.get("archimateElement")], "parent": parent}
            for s in c.findall("sourceConnection"):
                rel = els[s.get("archimateRelationship")]
                if rel["type"] == "FlowRelationship":
                    conns.append((s.get("source"), s.get("target"), rel["name"]))
                elif rel["type"] == "AccessRelationship" and rel["access"] == "1":
                    reads.append((s.get("source"), s.get("target")))
            walk(c, x, y, c.get("id"))

    walk(view, 0, 0, None)
    # A system that reads a data object it is drawn beside receives it: the figure's arrow from the object.
    for reader, obj in reads:
        if boxes[reader]["el"]["type"] == "ApplicationComponent":
            conns.append((obj, reader, ""))
    return boxes, conns


# --- How each kind of thing looks -------------------------------------------

def person(cx, top, h, faded=False):
    """A person pictogram, h high, its head centred on cx."""
    k = h / 100
    fill = "#BBBBBB" if faded else INK
    return (f'<g fill="{fill}"><circle cx="{cx:.1f}" cy="{top + 18 * k:.1f}" r="{17 * k:.1f}"/>'
            f'<path d="M{cx - 34 * k:.1f} {top + 100 * k:.1f} v{-30 * k:.1f} a{24 * k:.1f} {24 * k:.1f} 0 0 1 {24 * k:.1f} {-24 * k:.1f} '
            f'h{20 * k:.1f} a{24 * k:.1f} {24 * k:.1f} 0 0 1 {24 * k:.1f} {24 * k:.1f} v{30 * k:.1f} z"/></g>')


def anchor(cx, top, h):
    """The trust anchor: a standing person with a tablet and a speech bubble with a tick."""
    k = h / 120
    p = (f'<g fill="{INK}"><circle cx="{cx:.1f}" cy="{top + 14 * k:.1f}" r="{12 * k:.1f}"/>'
         f'<rect x="{cx - 17 * k:.1f}" y="{top + 30 * k:.1f}" width="{34 * k:.1f}" height="{48 * k:.1f}" rx="{8 * k:.1f}"/>'
         f'<rect x="{cx - 14 * k:.1f}" y="{top + 76 * k:.1f}" width="{11 * k:.1f}" height="{44 * k:.1f}"/>'
         f'<rect x="{cx + 3 * k:.1f}" y="{top + 76 * k:.1f}" width="{11 * k:.1f}" height="{44 * k:.1f}"/></g>'
         f'<rect x="{cx - 4 * k:.1f}" y="{top + 42 * k:.1f}" width="{22 * k:.1f}" height="{28 * k:.1f}" rx="{2 * k:.1f}" fill="#fff" stroke="{INK}" stroke-width="{2.5 * k:.1f}"/>'
         f'<g transform="translate({cx + 20 * k:.1f} {top - 6 * k:.1f})">'
         f'<path d="M0 0 h{28 * k:.1f} v{20 * k:.1f} h{-16 * k:.1f} l{-8 * k:.1f} {7 * k:.1f} v{-7 * k:.1f} h{-4 * k:.1f} z" fill="{INK}"/>'
         f'<path d="M{6 * k:.1f} {10 * k:.1f} l{5 * k:.1f} {5 * k:.1f} l{10 * k:.1f} {-10 * k:.1f}" fill="none" stroke="#fff" stroke-width="{3 * k:.1f}"/></g>')
    return p


def key(cx, cy, h, letter=""):
    """A gold key, h high, its bow centred near (cx - h, cy), with a letter on the bow."""
    k = h / 24
    x0 = cx - 26 * k
    t = (f'<text x="{x0:.1f}" y="{cy + 4 * k:.1f}" font-size="{11 * k:.1f}" font-weight="700" text-anchor="middle" fill="{INK}">{esc(letter)}</text>'
         if letter else "")
    return (f'<g fill="{GOLD}" stroke="#8A6D00" stroke-width="{1.2 * k:.1f}">'
            f'<circle cx="{x0:.1f}" cy="{cy:.1f}" r="{11 * k:.1f}"/>'
            f'<path d="M{x0 + 10 * k:.1f} {cy - 3 * k:.1f} h{36 * k:.1f} v{6 * k:.1f} h{-5 * k:.1f} v{5 * k:.1f} h{-5 * k:.1f} v{-5 * k:.1f} h{-4 * k:.1f} v{6 * k:.1f} h{-5 * k:.1f} v{-6 * k:.1f} h{-17 * k:.1f} z"/></g>'
            f'<circle cx="{x0:.1f}" cy="{cy:.1f}" r="{6 * k:.1f}" fill="#fff" stroke="#8A6D00" stroke-width="{1 * k:.1f}"/>{t}')


def document(cx, cy, h):
    """A signed document: a page with lines and a small key."""
    k = h / 50
    x, y = cx - 18 * k, cy - 25 * k
    lines = "".join(f'<line x1="{x + 7 * k:.1f}" y1="{y + (14 + 7 * i) * k:.1f}" x2="{x + 29 * k:.1f}" y2="{y + (14 + 7 * i) * k:.1f}" stroke="{INK}" stroke-width="{1.6 * k:.1f}"/>' for i in range(4))
    return (f'<path d="M{x:.1f} {y:.1f} h{26 * k:.1f} l{10 * k:.1f} {10 * k:.1f} v{40 * k:.1f} h{-36 * k:.1f} z" fill="#fff" stroke="{INK}" stroke-width="{2 * k:.1f}"/>'
            f'{lines}{key(cx + 34 * k, cy - 18 * k, 10 * k)}')


def label(cx, y, text, size=15, bold=True, width=18, color=INK, italic=False, anchor_="middle"):
    out = ""
    for i, line in enumerate(textwrap.wrap(text, width) or [""]):
        out += (f'<text x="{cx:.1f}" y="{y + i * size * 1.2:.1f}" font-size="{size}"'
                f'{" font-weight=\"700\"" if bold else ""}{" font-style=\"italic\"" if italic else ""} text-anchor="{anchor_}" fill="{color}">{esc(line)}</text>')
    return out


def link(el, body):
    tip = f'{el["name"]}: {el["doc"]}' if el["doc"] else el["name"]
    body = f"<title>{esc(tip)}</title>{body}"
    return f'<a href="{esc(el["page"])}" target="_top">{body}</a>' if el["page"] else f"<g>{body}</g>"


def edge_point(b, tx, ty, pad=6):
    """Where the line from b's centre towards (tx, ty) leaves b, plus a little padding."""
    cx, cy = b["x"] + b["w"] / 2, b["y"] + b["h"] / 2
    dx, dy = tx - cx, ty - cy
    if dx == 0 and dy == 0:
        return cx, cy
    sx = (b["w"] / 2 + pad) / abs(dx) if dx else math.inf
    sy = (b["h"] / 2 + pad) / abs(dy) if dy else math.inf
    s = min(sx, sy)
    return cx + dx * s, cy + dy * s


def arrow(x1, y1, x2, y2, both=False, w=9):
    """A thick blue block arrow from (x1, y1) to (x2, y2), with a head at both ends if asked."""
    ang = math.atan2(y2 - y1, x2 - x1)
    L = math.hypot(x2 - x1, y2 - y1)
    head, hw = 2.4 * w, 1.6 * w
    a = head if both else 0
    pts = [(a, -w / 2), (L - head, -w / 2), (L - head, -hw), (L, 0), (L - head, hw), (L - head, w / 2), (a, w / 2)]
    if both:
        pts += [(a, hw), (0, 0), (a, -hw)]
    c, s = math.cos(ang), math.sin(ang)
    d = " ".join(f"{x1 + px * c - py * s:.1f},{y1 + px * s + py * c:.1f}" for px, py in pts)
    return f'<polygon points="{d}" fill="{BLUE}"/>'


def draw():
    boxes, conns = read_view()
    W = max(b["x"] + b["w"] for b in boxes.values()) + 12
    H = max(b["y"] + b["h"] for b in boxes.values()) + 12
    parts = []
    # Panels first, under everything else.
    for b in boxes.values():
        el = b["el"]
        if el["type"] != "Grouping":
            continue
        num, _, title = el["name"].partition(". ")
        verb, _, rest = title.partition(": ")
        body = (f'<rect x="{b["x"]}" y="{b["y"]}" width="{b["w"]}" height="{b["h"]}" fill="#fff" stroke="{INK}" stroke-width="2.5"/>'
                f'<text x="{b["x"] + 14}" y="{b["y"] + 44}" font-size="40" font-weight="800" fill="{RED}">{esc(num)}</text>')
        if rest:  # "3. Verify: the trust network": the panel's own title, as the figure prints it
            body += (f'<text x="{b["x"] + b["w"] - 16}" y="{b["y"] + 34}" font-size="22" font-weight="700" text-anchor="end" fill="{INK}">'
                     f'{esc(rest[:1].upper() + rest[1:].replace("trust network", "Trust Network"))}</text>')
        parts.append(link(el, body))
    # Arrows, merged into one double arrow where two flows run each way.
    seen = set()
    for a, b, name in conns:
        if (a, b) in seen:
            continue
        both = (b, a) in {(x, y) for x, y, _ in conns} or name.endswith("both ways")
        seen |= {(a, b), (b, a)}
        A, B = boxes[a], boxes[b]
        x1, y1 = edge_point(A, B["x"] + B["w"] / 2, B["y"] + B["h"] / 2, 14)
        x2, y2 = edge_point(B, A["x"] + A["w"] / 2, A["y"] + A["h"] / 2, 14)
        parts.append(arrow(x1, y1, x2, y2, both))
        if name and not name.startswith("signed document"):
            parts.append(label((x1 + x2) / 2, min(y1, y2) - 30, name, size=17, bold=True, italic=True, width=30))
    # Everything else.
    for bid, b in boxes.items():
        el = b["el"]
        cx, cy = b["x"] + b["w"] / 2, b["y"] + b["h"] / 2
        t = el["type"]
        if t == "Grouping":
            continue
        if t == "ApplicationComponent" and el["name"] == "Trust Network Anchor":
            body = anchor(cx - 6, b["y"], b["h"]) + label(cx, b["y"] + b["h"] + 22, "Trust Anchor", size=18)
        elif t == "ApplicationComponent":
            big = "Certificate Authority" in el["name"]
            h = b["h"] * (1.0 if big else 0.85)
            body = person(cx, b["y"] - (10 if big else 4), h)
            body += label(cx, b["y"] + h + (20 if big else 12), el["name"], size=19 if big else 14, width=13 if big else 18)
        elif t == "DataObject" and el["name"].startswith("Verified public keys"):
            body = (f'<rect x="{b["x"]}" y="{b["y"]}" width="{b["w"]}" height="{b["h"]}" fill="#fff" stroke="#2F5597" stroke-width="2"/>'
                    + "".join(key(cx + 18, b["y"] + 24 + i * 42, 16, letter) for i, letter in enumerate("ABC")))
        elif t == "DataObject" and el["name"].startswith("Public key"):
            body = key(cx + 30, cy, 20, el["name"].split()[-1])
        elif t == "DataObject":
            body = document(cx, cy, b["h"])
        elif t == "BusinessProcess":
            body = label(b["x"] + 4, b["y"] + 18, el["name"], size=16, bold=True, italic=True, color=GREEN,
                         width=max(14, int(b["w"] / 8.5)), anchor_="start")
        else:
            continue
        parts.append(link(el, body))
    title = "The GDHCN trust network: 1. Onboard, 2. Distribute, 3. Verify"
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="100%" style="max-width:{W}px" '
            f'font-family="Segoe UI, Helvetica, Arial, sans-serif" role="img" aria-labelledby="tn-title">'
            f'<title id="tn-title">{esc(title)}</title>\n'
            f'<!-- Generated by archimate/pretty.py from the ArchiMate view "{esc(VIEW)}" '
            f'(archimate/{esc(version())}/smart-trust.archimate, built by archimate/build.py); do not edit. -->\n'
            + "\n".join(parts) + "\n</svg>\n")


FIGURE = ROOT / "input/includes/trust-network-figure.html"


def figure_problem():
    """The home page's figure must name the current model's view: it links the archimate-pages SVG by version and view id."""
    root = ET.fromstring(zipfile.ZipFile(ROOT / "archimate" / version() / "smart-trust.archimate").read("model.xml"))
    vid = next(e.get("id") for e in root.iter("element") if e.get(XSI) == "archimate:ArchimateDiagramModel" and e.get("name") == VIEW)
    want = f"archimate/{version()}/view/{vid}.svg"
    text = FIGURE.read_text(encoding="utf-8")
    return None if want in text else f"{FIGURE.relative_to(ROOT)} does not link {want}: update it to the current model"


def main(argv):
    svg = draw()
    if "--check" in argv:
        problem = figure_problem()
        if problem:
            print(problem, file=sys.stderr)
            return 1
        if not OUT.exists() or OUT.read_text(encoding="utf-8") != svg:
            print(f"{OUT.relative_to(ROOT)}: stale; run python3 -I archimate/pretty.py", file=sys.stderr)
            return 1
        print(f"{OUT.relative_to(ROOT)}: current")
        return 0
    OUT.write_text(svg, encoding="utf-8")
    print(f"{OUT.relative_to(ROOT)}: written")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
