#!/usr/bin/env python3
"""Build this guide's ArchiMate model of the GDHCN trust network, the home page's figure.

Usage:
    python3 -I archimate/build.py            # write archimate/<version>/smart-trust.archimate
    python3 -I archimate/build.py --check    # fail if the committed model is not what the build makes

The home page's figure (input/images/trust_network.png, hand-drawn, three
panels) is transcribed here once, as data, and everything that draws it reads
the model this writes:

- the people and systems are this guide's actors (input/fsh/actors/actors.fsh,
  their ActorDefinition pages): the Trust Network Anchor, and each country as a
  Trust Network Participant; a country's Signing Certificate Authority is a
  part of it (concepts.html);
- the three panels are Groupings, "1. Onboard", "2. Distribute" and "3. Verify",
  each with the process it shows (a BusinessProcess) and the actor assigned to it;
- the public keys and the trust list they make are DataObjects, each linked to
  the concept it is (concepts.html);
- the arrows are Flow relationships, named as the figure prints them; the
  figure's double arrows between members are one Flow each, named "both ways";
- every box sits where the figure draws it (the figure's 901 x 450 pixels,
  scaled by 1.5), so the view keeps the figure's layout.

The archimate-pages visualiser draws the view in ArchiMate notation;
archimate/pretty.py draws it again in the original figure's style
(input/includes/trust-network-pretty.svg). The home page offers both.

The version is the IG's (sushi-config.yaml `version:`), as cat-harness's
archimate-models skill asks. The archive is written with fixed timestamps so
that --check can compare bytes. Standard library only.
"""

import html
import io
import re
import sys
import uuid
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NAMESPACE = "https://litlfred.github.io/smart-trust/archimate"
SOURCE = "WHO SMART Trust (litlfred/smart-trust): the GDHCN trust network, the home page's figure"
MODEL_NAME = "WHO SMART Trust"
FIXED_TIME = (2026, 1, 1, 0, 0, 0)
IG = "https://litlfred.github.io/smart-trust/"
ANCHOR = IG + "artifact/ActorDefinition-TrustNetworkAnchor.html"
PARTICIPANT = IG + "artifact/ActorDefinition-TrustNetworkParticipant.html"

VIEW = "The GDHCN trust network"
VIEW_SLUG = "the-gdhcn-trust-network"

# --- The figure, transcribed (input/images/trust_network.png) ---------------
#
# key -> (ArchiMate type, name, documentation, page). The actors are this
# guide's ActorDefinitions; the rest link the concept they are.
ELEMENTS = {
    "anchor": ("ApplicationComponent", "Trust Network Anchor",
               "Receives and distributes PKI material within a trust network: WHO, for the GDHCN (ActorDefinition TrustNetworkAnchor).",
               ANCHOR),
    "country-a": ("ApplicationComponent", "Country A",
                  "A Trust Network Participant: publishes and receives PKI material within the trust network (ActorDefinition TrustNetworkParticipant).",
                  PARTICIPANT),
    "country-b": ("ApplicationComponent", "Country B",
                  "A Trust Network Participant: publishes and receives PKI material within the trust network (ActorDefinition TrustNetworkParticipant).",
                  PARTICIPANT),
    "country-c": ("ApplicationComponent", "Country C",
                  "A Trust Network Participant: publishes and receives PKI material within the trust network (ActorDefinition TrustNetworkParticipant).",
                  PARTICIPANT),
    "ca-a": ("ApplicationComponent", "Country A's Certificate Authority",
             "Country A's Signing Certificate Authority: it issues the public key certificates of Country A's document signers.",
             IG + "concepts.html#signing-certificate-authority-sca"),
    "key-a": ("DataObject", "Public key A",
              "Country A's public key, as a certificate, submitted to the trust anchor.",
              IG + "concepts.html#public-key-infrastructure-pki"),
    "trust-list": ("DataObject", "Verified public keys A, B, C",
                   "The public keys the trust anchor has verified, distributed to every member as a trust list.",
                   IG + "concepts.html#trust-lists"),
    "document": ("DataObject", "Signed document",
                 "A verifiable digital health certificate, signed by a member's document signer.",
                 IG + "concepts.html#document-signer"),
    "onboard": ("BusinessProcess", "Certify provenance, onboard members",
                "Step 1: a participant's certificate authority submits its public key to the trust anchor, which certifies its provenance and onboards the member.",
                IG + "concepts_onboarding.html"),
    "distribute": ("BusinessProcess", "Distribute verified public keys",
                   "Step 2: the trust anchor distributes the verified public keys to the members of the trust network.",
                   IG + "concepts.html#trust-lists"),
    "verify": ("BusinessProcess", "Verify document provenance",
               "Step 3: credentialed document provenance from any member can be verified by any other member, with the keys of step 2.",
               IG + "concepts.html#trust-network"),
    "panel-1": ("Grouping", "1. Onboard", "The figure's first panel.", ""),
    "panel-2": ("Grouping", "2. Distribute", "The figure's second panel.", ""),
    "panel-3": ("Grouping", "3. Verify: the trust network", "The figure's third panel.", IG + "concepts.html#gdhcn-trust-network"),
}

# Relationships: (key, type, source, target, name as the figure prints it).
RELATIONS = [
    ("country-a>ca-a", "Composition", "country-a", "ca-a", ""),
    ("anchor>onboard", "Assignment", "anchor", "onboard", ""),
    ("anchor>distribute", "Assignment", "anchor", "distribute", ""),
    ("ca-a>key-a", "Access", "ca-a", "key-a", ""),
    ("flow-1", "Flow", "ca-a", "anchor", "Public \"key\""),
    ("distribute>trust-list", "Access", "distribute", "trust-list", ""),
    ("flow-2a", "Flow", "anchor", "country-a", "verified public keys"),
    ("flow-2b", "Flow", "anchor", "country-b", "verified public keys"),
    ("flow-2c", "Flow", "anchor", "country-c", "verified public keys"),
    ("flow-3ab", "Flow", "country-a", "country-b", "signed document, both ways"),
    ("flow-3bc", "Flow", "country-b", "country-c", "signed document, both ways"),
    ("flow-3ca", "Flow", "country-c", "country-a", "signed document, both ways"),
    ("verify>document", "Access", "verify", "document", ""),
    # The trust list: the anchor writes it, every member reads it (step 2).
    ("anchor>trust-list", "Access", "anchor", "trust-list", ""),
    ("country-a>trust-list", "Access", "country-a", "trust-list", ""),
    ("country-b>trust-list", "Access", "country-b", "trust-list", ""),
    ("country-c>trust-list", "Access", "country-c", "trust-list", ""),
]
# How each Access accesses its object (Archi's accessType): 0 write, 1 read.
ACCESS = {
    "ca-a>key-a": 0, "distribute>trust-list": 0, "anchor>trust-list": 0, "verify>document": 1,
    "country-a>trust-list": 1, "country-b>trust-list": 1, "country-c>trust-list": 1,
}
# Each panel aggregates what it shows.
PANELS = {
    "panel-1": ["ca-a", "key-a", "anchor", "onboard"],
    "panel-2": ["anchor", "trust-list", "distribute", "country-a", "country-b", "country-c"],
    "panel-3": ["country-a", "country-b", "country-c", "verify", "document"],
}

# Where the figure draws each box, in the figure's pixels x 1.5: (box id,
# element, parent box, x, y, w, h). An element the figure draws twice (the
# anchor; the three countries) has a box per place.
S = 1.5
BOXES = [
    ("panel-1", "panel-1", None, 8, 8, 435, 205),
    ("panel-2", "panel-2", None, 458, 8, 435, 205),
    ("panel-3", "panel-3", None, 218, 230, 468, 215),
    ("ca-a", "ca-a", "panel-1", 30, 85, 100, 60),
    ("key-a", "key-a", "panel-1", 135, 60, 80, 30),
    ("anchor@1", "anchor", "panel-1", 255, 80, 60, 70),
    ("onboard", "onboard", "panel-1", 300, 28, 135, 40),
    ("distribute", "distribute", "panel-2", 468, 40, 140, 45),
    ("anchor@2", "anchor", "panel-2", 600, 95, 60, 70),
    ("trust-list", "trust-list", "panel-2", 695, 75, 80, 110),
    ("country-a@2", "country-a", "panel-2", 815, 30, 70, 40),
    ("country-b@2", "country-b", "panel-2", 815, 88, 70, 40),
    ("country-c@2", "country-c", "panel-2", 815, 146, 70, 40),
    ("verify", "verify", "panel-3", 228, 290, 130, 60),
    ("country-a@3", "country-a", "panel-3", 425, 255, 70, 45),
    ("country-b@3", "country-b", "panel-3", 565, 375, 70, 45),
    ("country-c@3", "country-c", "panel-3", 290, 375, 70, 45),
    ("document", "document", "panel-3", 425, 325, 50, 40),
]
# The lines the view draws: (relationship key, source box, target box).
LINES = [
    ("flow-1", "ca-a", "anchor@1"),
    ("ca-a>key-a", "ca-a", "key-a"),
    ("anchor>onboard", "anchor@1", "onboard"),
    ("anchor>distribute", "anchor@2", "distribute"),
    # Step 2 as the view draws it: the anchor writes the trust list and each
    # member reads it, so no line crosses a box. The Flows anchor -> member
    # stay in the model; archimate/pretty.py draws the reads as the figure's arrows.
    ("anchor>trust-list", "anchor@2", "trust-list"),
    ("country-a>trust-list", "country-a@2", "trust-list"),
    ("country-b>trust-list", "country-b@2", "trust-list"),
    ("country-c>trust-list", "country-c@2", "trust-list"),
    ("flow-3ab", "country-a@3", "country-b@3"),
    ("flow-3bc", "country-b@3", "country-c@3"),
    ("flow-3ca", "country-c@3", "country-a@3"),
    ("verify>document", "verify", "document"),
]


def esc(s):
    return html.escape(str(s), quote=True)


def version():
    return re.search(r"^version:\s*(\S+)", (ROOT / "sushi-config.yaml").read_text(encoding="utf-8"), re.M).group(1)


_NS = uuid.uuid5(uuid.NAMESPACE_URL, NAMESPACE)


def oid(*parts):
    return "id-" + uuid.uuid5(_NS, "/".join(parts)).hex


def relations():
    rels = list(RELATIONS)
    for panel, keys in PANELS.items():
        rels += [(f"{panel}>{k}", "Aggregation", panel, k, "") for k in keys]
    return rels


def element_xml(key, t, name, doc, page):
    body = f"\n      <documentation>{esc(doc)}</documentation>" if doc else ""
    props = {"page": page, "source": SOURCE}
    body += "".join(f'\n      <property key="{esc(k)}" value="{esc(v)}"/>' for k, v in props.items() if v)
    return f'\n    <element xsi:type="archimate:{t}" name="{esc(name)}" id="{oid("element", key)}">{body}\n    </element>'


def rel_xml(key, t, a, b, name):
    attrs = f' name="{esc(name)}"' if name else ""
    extra = f' accessType="{ACCESS[key]}"' if t == "Access" else ""
    return (f'\n    <element xsi:type="archimate:{t}Relationship" id="{oid("rel", key)}"{attrs}{extra}'
            f' source="{oid("element", a)}" target="{oid("element", b)}"/>')


def view_xml():
    did = lambda b: oid("view", VIEW, "obj", b)
    cid = lambda r, a, b: oid("view", VIEW, "conn", r, a, b)
    boxes = {b[0]: b for b in BOXES}
    src, tgt = {}, {}
    for r, a, b in LINES:
        src.setdefault(a, []).append(
            f'<sourceConnection xsi:type="archimate:Connection" id="{cid(r, a, b)}" source="{did(a)}" target="{did(b)}" archimateRelationship="{oid("rel", r)}"/>')
        tgt.setdefault(b, []).append(cid(r, a, b))

    def child(bid, depth):
        _, el, parent, x, y, w, h = boxes[bid]
        x, y, w, h = (round(v * S) for v in (x, y, w, h))
        if parent:  # Archi stores a nested box relative to its parent
            x, y = x - round(boxes[parent][3] * S), y - round(boxes[parent][4] * S)
        ind = "  " * depth
        tc = f' targetConnections="{" ".join(tgt[bid])}"' if bid in tgt else ""
        out = (f'\n{ind}<child xsi:type="archimate:DiagramObject" id="{did(bid)}"{tc} archimateElement="{oid("element", el)}">'
               f'\n{ind}  <bounds x="{x}" y="{y}" width="{w}" height="{h}"/>')
        out += "".join(f"\n{ind}  {s}" for s in src.get(bid, []))
        for kid in [b[0] for b in BOXES if b[2] == bid]:
            out += child(kid, depth + 1)
        return out + f"\n{ind}</child>"

    body = "".join(child(b[0], 4) for b in BOXES if b[2] is None)
    doc = ("The GDHCN trust network, the home page's figure (input/images/trust_network.png) with every box where the figure draws it: "
           "1. Onboard (a country's certificate authority submits its public key to the trust anchor), "
           "2. Distribute (the anchor distributes the verified public keys to every member) and "
           "3. Verify (any member verifies the provenance of a document signed by any other). "
           "Each box links its actor or concept in this guide.")
    return (f'\n      <element xsi:type="archimate:ArchimateDiagramModel" name="{esc(VIEW)}" id="{oid("view", VIEW)}">'
            f"\n        <documentation>{esc(doc)}</documentation>"
            f'\n        <property key="source" value="{esc(SOURCE)}"/>'
            f'\n        <property key="slug" value="{VIEW_SLUG}"/>{body}\n      </element>')


FOLDERS = [("Strategy", "strategy"), ("Business", "business"), ("Application", "application"),
           ("Technology &amp; Physical", "technology"), ("Motivation", "motivation"),
           ("Implementation &amp; Migration", "implementation_migration"), ("Other", "other"),
           ("Relations", "relations"), ("Views", "diagrams")]
FOLDER_OF = {"BusinessProcess": "business", "ApplicationComponent": "application", "DataObject": "application", "Grouping": "other"}


def model_xml():
    content = {f: "" for _, f in FOLDERS}
    for k, (t, name, doc, page) in ELEMENTS.items():
        content[FOLDER_OF[t]] += element_xml(k, t, name, doc, page)
    for r in relations():
        content["relations"] += rel_xml(*r)
    content["diagrams"] += view_xml()
    out = ['<?xml version="1.0" encoding="UTF-8"?>',
           f'<archimate:model xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:archimate="http://www.archimatetool.com/archimate" name="{esc(MODEL_NAME)}" id="{oid("model")}" version="5.0.0">']
    for name, f in FOLDERS:
        fid = oid("folder", f)
        out.append(f'  <folder name="{name}" id="{fid}" type="{f}">{content[f]}\n  </folder>' if content[f]
                   else f'  <folder name="{name}" id="{fid}" type="{f}"/>')
    out.append(f"  <purpose>{esc(SOURCE)}. Generated by archimate/build.py; do not edit in Archi.</purpose>")
    out.append("</archimate:model>\n")
    return "\n".join(out)


def archive():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(zipfile.ZipInfo("model.xml", FIXED_TIME), model_xml().encode("utf-8"))
    return buf.getvalue()


def main(argv):
    target = ROOT / "archimate" / version() / "smart-trust.archimate"
    data = archive()
    if "--check" in argv:
        if not target.exists() or target.read_bytes() != data:
            print(f"{target.relative_to(ROOT)}: stale; run python3 -I archimate/build.py", file=sys.stderr)
            return 1
        print(f"{target.relative_to(ROOT)}: current")
        return 0
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    print(f"{target.relative_to(ROOT)}: written")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
