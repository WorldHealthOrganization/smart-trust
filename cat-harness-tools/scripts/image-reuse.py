#!/usr/bin/env python3
"""Point a library entry's images at assets the repository already holds. Bean `scfh`.

The #1614 deck carried two full-slide pictures, 7 MB between them, that are the
same pictures as the harness's landing-page theme art: re-encoded as WebP and
resized, so not one byte matches, and a byte-identical search reports "no
duplicates" over what a person sees at once. The owner's instruction was
"consolidate … reuse assets if possible".

## How a match is decided, and why it is reported rather than assumed

A 256-bit difference hash (16×16 gradient signs over a grey thumbnail, alpha
flattened onto white) of every image in the entry and every raster under the
asset directories given. Distance is the number of differing bits.

Measured on the #1614 deck against the 378 raster images in the repository, the
two true matches were at **6 and 7**, and the nearest false one at **36** — a
blank spacer against near-white page scans. The default threshold, 12, sits in
that gap. A threshold is a claim about a corpus, so the distance is RECORDED on
each reuse (`same_as.distance`), and a reader can re-judge it.

## What `--apply` does

For each match: `file` becomes the asset's path RELATIVE TO THE ENTRY (which is
how `gen-library-jsonld.ts` already resolves `file`), `same_as` records the
asset, the method and the distance, and the entry's own copy is removed. The
description, role and basis are untouched: the image is the same picture, and
what it depicts was judged by looking at it.

Without `--apply` it writes nothing and prints what it would do. It is not an
ingest arm: dropping a copy is a decision, and a re-ingest rebuilds
`images.json` from the source, so run it again after one.

  python3 scripts/image-reuse.py ENTRY_DIR --assets docs/assets/img
  python3 scripts/image-reuse.py ENTRY_DIR --assets docs/assets/img --apply
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from PIL import Image

RASTER = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
BITS = 256
DEFAULT_MAX = 12


def dhash(path: Path, n: int = 16) -> int:
    im = Image.open(path).convert("RGBA")
    bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
    bg.alpha_composite(im)
    g = bg.convert("L").resize((n + 1, n), Image.LANCZOS)
    px = g.load()
    h = 0
    for r in range(n):
        for c in range(n):
            h = (h << 1) | (px[c, r] > px[c + 1, r])
    return h


def distance(a: int, b: int) -> int:
    return bin(a ^ b).count("1")


def assets_under(dirs: list[Path]) -> list[Path]:
    out = []
    for d in dirs:
        for root, _, files in os.walk(d):
            out.extend(Path(root) / f for f in files if Path(f).suffix.lower() in RASTER)
    return sorted(out)


def plan(entry: Path, dirs: list[Path], max_distance: int) -> list[dict]:
    sidecar = json.loads((entry / "images.json").read_text(encoding="utf-8"))
    candidates = []
    for a in assets_under(dirs):
        try:
            candidates.append((a, dhash(a)))
        except OSError:
            continue
    out = []
    for img in sidecar.get("images") or []:
        if "same_as" in img:
            continue
        local = entry / img["file"]
        if not local.exists():
            continue
        h = dhash(local)
        best = min(((distance(h, ch), a) for a, ch in candidates), default=None, key=lambda t: t[0])
        if best is not None and best[0] <= max_distance:
            out.append({"id": img["id"], "local": local, "asset": best[1], "distance": best[0]})
    return out


def apply(entry: Path, matches: list[dict], repo_root: Path) -> None:
    path = entry / "images.json"
    sidecar = json.loads(path.read_text(encoding="utf-8"))
    by_id = {m["id"]: m for m in matches}
    for img in sidecar.get("images") or []:
        m = by_id.get(img["id"])
        if not m:
            continue
        img["file"] = os.path.relpath(m["asset"].resolve(), entry.resolve())
        img["same_as"] = {
            "path": m["asset"].resolve().relative_to(repo_root.resolve()).as_posix(),
            "method": "dhash-256",
            "distance": m["distance"],
            "bits": BITS,
        }
        m["local"].unlink()
    path.write_text(json.dumps(sidecar, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("entry", type=Path)
    ap.add_argument("--assets", type=Path, action="append", required=True)
    ap.add_argument("--max-distance", type=int, default=DEFAULT_MAX)
    ap.add_argument("--repo-root", type=Path, default=Path(__import__("_harness_root").HARNESS_ROOT).parent)  # bean 70lx: the checkout holding the harness
    ap.add_argument("--apply", action="store_true")
    a = ap.parse_args()
    matches = plan(a.entry, a.assets, a.max_distance)
    for m in matches:
        print(f"{m['id']:14s} d={m['distance']:>3}/{BITS}  {m['local'].name}  →  {m['asset']}")
    if not matches:
        print(f"no image within {a.max_distance}/{BITS} bits of an asset")
    if a.apply and matches:
        apply(a.entry, matches, a.repo_root)
        print(f"applied: {len(matches)} image(s) now point at the existing asset; local copies removed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
