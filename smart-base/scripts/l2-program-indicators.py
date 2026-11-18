#!/usr/bin/env python3
"""
l2-program-indicators — draft L2 ProgramIndicator records from an L1 entry's
`indicator` nodes.

    python3 l2-program-indicators.py --entry library/<doc-id> --prefix NHWA \
        [--base-iri https://litlfred.github.io/folio/] [--out program-indicators.json]

The second, mechanical half of `indicator-extraction`. L1 holds what the
source prints (`l1-indicator-sheets.py`); L2 is the DAK's or DTH's own
operational measure, `program-indicator` in sgkg-l2 and the `ProgramIndicator`
logical model (input/fsh/models/ProgramIndicator.fsh). The two are kept
apart on purpose (sgkg-l2: "Collapsing them would silently merge a WHO
definition with a country's implementation of it"), so each record here
points at its L1 node with `derivedFrom` and is a DRAFT an L2 author adopts,
edits or drops.

- `id` is `<prefix>.<the source's own number>` ("NHWA.1-01"): the number is
  never invented, the prefix only namespaces it.
- `name`, `definition`, `numerator`, `denominator` and `disaggregation` are
  copied from the L1 node. ProgramIndicator makes the last four 1..1; where
  the source prints none (composite and self-assessed indicators), the field
  is left out and listed in `gaps`, for the author to decide. Nothing is
  filled in for them.
- A composite indicator's sub-indicators become `components` (id and name),
  and each sub-indicator is not a ProgramIndicator of its own.
- `dataSources`, `reportingFrequency`, `module` and the short name are
  carried in `extension` as printed, because ProgramIndicator has no element
  for them.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys


def block_iris(entry: str, base: str) -> dict[str, str]:
    """The source number -> the L1 node IRI, read from the generated blocks."""
    out: dict[str, str] = {}
    bdir = os.path.join(entry, "blocks")
    for fn in sorted(os.listdir(bdir)):
        if not (fn.startswith("indicator-") and fn.endswith(".jsonld")):
            continue
        with open(os.path.join(bdir, fn), encoding="utf-8") as fh:
            node = json.load(fh)
        num = (node.get("meta") or {}).get("source_number")
        if num:
            out[num] = base.rstrip("/") + "/" + node["@id"]
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--entry", required=True)
    ap.add_argument("--prefix", required=True, help="namespace for ids, e.g. NHWA")
    ap.add_argument("--base-iri", default="https://litlfred.github.io/folio/")
    ap.add_argument("--out")
    a = ap.parse_args()
    with open(os.path.join(a.entry, "candidates.json"), encoding="utf-8") as fh:
        cands = [c for c in json.load(fh)["candidates"] if c.get("kind") == "indicator"]
    iris = block_iris(a.entry, a.base_iri)
    subs: dict[str, list[dict[str, str]]] = {}
    for c in cands:
        f = c.get("fields") or {}
        if f.get("parentIndicator"):
            subs.setdefault(f["parentIndicator"], []).append(
                {"id": f"{a.prefix}.{c['number']}", "name": f.get("name") or c.get("name") or "",
                 "derivedFrom": iris.get(c["number"], "")})
    records = []
    for c in cands:
        f = c.get("fields") or {}
        if f.get("parentIndicator") or not c.get("number"):
            continue
        num = c["number"]
        rec: dict[str, object] = {
            "resourceType": "ProgramIndicator",
            "id": f"{a.prefix}.{num}",
            "name": f.get("name") or c.get("name"),
            "status": "draft",
            "derivedFrom": iris.get(num),
        }
        gaps = []
        for k in ("definition", "numerator", "denominator", "disaggregation"):
            if f.get(k):
                rec[k] = f[k]
            else:
                gaps.append(k)
        if num in subs:
            rec["components"] = subs[num]
        ext = {k: f[k] for k in ("abbreviatedName", "module", "dimension", "dataSources", "reportingFrequency",
                                 "reportingFrameworks", "glossary") if f.get(k)}
        if ext:
            rec["extension"] = ext
        if gaps:
            rec["gaps"] = gaps
        records.append(rec)
    doc = {
        "_note": "DRAFT L2 program indicators derived from L1 indicator nodes; an L2 author adopts, edits or drops each. "
                 "`gaps` lists ProgramIndicator 1..1 elements the source does not print.",
        "source": a.entry,
        "programIndicators": records,
    }
    text = json.dumps(doc, indent=2, ensure_ascii=False) + "\n"
    if a.out:
        with open(a.out, "w", encoding="utf-8") as fh:
            fh.write(text)
    else:
        sys.stdout.write(text)
    print(f"{len(records)} program indicators, {sum(1 for r in records if 'gaps' in r)} with gaps", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
