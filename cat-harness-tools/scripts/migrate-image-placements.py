#!/usr/bin/env python3
"""Collapse an existing `images.json` onto one entry per DISTINCT image.

Bean `j820`, issue #1234. `pdf-images.py` emitted one entry per PLACEMENT, so
an image used many times became many images. It no longer does; this carries
the entries already committed onto the new shape, rather than leaving the
corpus split between two conventions.

## Nothing is re-derived and nothing is described

This does NOT re-run extraction. It reads the sidecar and the PNGs beside it,
groups by the bytes on disk, and moves what is already there. Every narrative
and every inspection basis in the output was written by somebody else; this
only decides WHERE each one now lives.

## Matching is by content hash, and the first placement keeps its id

The old sidecar records no `xref`, so the PDF's own identity is unavailable
here -- the written PNGs are what there is. That is a weaker key than the one
`pdf-images.py` now uses, and the difference is stated rather than hidden: on
arXiv:2510.21603v1 the PDF holds 51 image objects whose decoded bytes are 37
distinct, so hashing merges 14 pairs the generator keeps apart. A migrated
sidecar can therefore be slightly MORE collapsed than a re-ingested one, and
`--check` reports that rather than asserting the two agree.

The surviving entry is the FIRST placement, which keeps its existing id, so a
narrative on a first placement carries over untouched and every id already
cited elsewhere still resolves.

## A later placement's narrative becomes a `note`, never a deletion

Measured 2026-09-24 over the whole corpus: of 49 duplicate groups, 5 carry
differing text, and every one differs the same way -- the same sentence about
what the image IS, then a clause about what THIS copy serves.
`9789240010567-eng` has seven byte-identical copies of the Principles for
Digital Development logo, each naming the principle on its own page.

So the shared part stays the narrative and the differing part becomes
`placements[].note`. Where the two share no opening clause the whole text is
kept as the note: that is the `9789240081949-eng` case, five byte-identical QR
codes described as if each encoded a different category -- one image, five
incompatible claims. Keeping them visible is the point; it is a defect this
collapse EXPOSES and no reader could have found before.

Duplicate PNGs are removed, because the entry that named them is gone.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path

MIN_SHARED = 40  # below this a "common prefix" is a coincidence, not a shared clause
# A TAIL SHORTER THAN THIS IS A FRAGMENT, NOT A CLAUSE, and the whole text is
# kept instead. Measured on the five divergent groups: the seven Principles
# logos split cleanly ("principle 8, 'Build for sustainability'."), while
# `wpr-rdo-2020-003-eng` split to the word "UNDP." -- true, and useless as a
# note. Splitting is a convenience; losslessness is the requirement, so the
# fallback is the full sentence rather than a shorter guess.
MIN_TAIL = 30


def text_of(entry: dict) -> str | None:
    return (entry.get("narrative") or {}).get("text")


def split_note(shared: str | None, mine: str | None) -> str | None:
    """The part of `mine` that is not `shared`, or the whole of it."""
    if not mine or mine == shared:
        return None
    if shared:
        pre = os.path.commonprefix([shared, mine])
        cut = pre.rfind(" ")
        if cut >= MIN_SHARED:
            tail = mine[cut:].strip()
            if len(tail) >= MIN_TAIL:
                return tail
    return mine


def migrate(entry_dir: Path) -> dict:
    sidecar = entry_dir / "images.json"
    data = json.loads(sidecar.read_text())
    images = data.get("images")
    if not images:
        return {"dir": str(entry_dir), "before": 0, "after": 0, "notes": 0, "removed": 0}

    groups: dict[str, list[dict]] = {}
    order: list[str] = []
    unhashable: list[dict] = []
    for img in images:
        f = entry_dir / img["file"]
        if not f.exists():
            # No bytes, so no key. Carried through untouched rather than
            # dropped: an entry whose file is missing is a known state
            # (`pdf-images.py` records the entry when the write fails) and
            # losing it here would turn a reported gap into an absence.
            unhashable.append(img)
            continue
        h = hashlib.sha256(f.read_bytes()).hexdigest()
        if h not in groups:
            groups[h] = []
            order.append(h)
        groups[h].append(img)

    out: list[dict] = []
    notes = 0
    removed: list[Path] = []
    for h in order:
        members = groups[h]
        first = dict(members[0])
        shared = text_of(first)
        placements = []
        for m in members:
            b = m.get("basis") or {}
            if "page" not in b:
                continue
            p = {
                "page": b["page"],
                "coverage": b.get("coverage", 0),
                "imagesOnPage": b.get("imagesOnPage", 1),
            }
            if m is not members[0]:
                n = split_note(shared, text_of(m))
                if n:
                    p["note"] = n
                    notes += 1
            placements.append(p)
        if len(placements) > 1:
            first["placements"] = placements
        for m in members[1:]:
            f = entry_dir / m["file"]
            if f.exists():
                removed.append(f)
        out.append(first)
    out.extend(unhashable)

    data["images"] = out
    return {
        "dir": str(entry_dir),
        "before": len(images),
        "after": len(out),
        "notes": notes,
        "removed": removed,
        "data": data,
        "sidecar": sidecar,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("roots", nargs="*", default=["."], help="directories to walk")
    ap.add_argument("--check", action="store_true", help="report, write nothing")
    args = ap.parse_args()

    found = []
    for root in args.roots or ["."]:
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if d != "node_modules" and not d.startswith(".")]
            if "images.json" in filenames:
                found.append(Path(dirpath))

    total_before = total_after = total_notes = total_removed = 0
    changed = 0
    for d in sorted(found):
        r = migrate(d)
        if r["before"] == r["after"]:
            continue
        changed += 1
        total_before += r["before"]
        total_after += r["after"]
        total_notes += r["notes"]
        total_removed += len(r["removed"])
        print(f"  {d}: {r['before']} -> {r['after']} entries, {r['notes']} note(s)")
        if not args.check:
            r["sidecar"].write_text(json.dumps(r["data"], indent=2, ensure_ascii=False) + "\n")
            for f in r["removed"]:
                f.unlink()

    verb = "would collapse" if args.check else "collapsed"
    print(f"\n{verb} {changed} sidecar(s): {total_before} -> {total_after} entries, "
          f"{total_notes} placement note(s), {total_removed} duplicate PNG(s)")
    return 1 if (args.check and changed) else 0


if __name__ == "__main__":
    sys.exit(main())
