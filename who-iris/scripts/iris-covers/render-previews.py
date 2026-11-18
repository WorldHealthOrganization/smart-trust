#!/usr/bin/env python3
"""Render a masked page-1 cover for each fetched PDF, for a person to review.

The emblem mask is GUESSED here, from where page 1 says "World Health
Organization": the wordmark plus the emblem beside it. A guess is not a
ruling, so the output goes to a review folder, and a person (or an agent
that has looked at each image) moves it into the catalogue with the mask
recorded as `maskedRegions`. An unmasked rendering is never written.

usage: render-previews.py <fetched dir> <cat-harness-tools/scripts/pdf-cover.py> <out dir>
"""
import json, os, subprocess, sys, glob
import pymupdf

WIDTH = 300
WORDS = ["World Health Organization", "World Health", "Organization", "Organisation mondiale", "Organización Mundial"]

def guess_masks(pdf):
    page = pymupdf.open(pdf)[0]
    scale = WIDTH / page.rect.width
    hits = []
    for w in WORDS:
        hits += page.search_for(w)
    # The emblem sits beside or above the wordmark; take any image or drawing
    # that touches a box grown around the words.
    boxes = []
    for r in hits:
        h = r.height
        grow = pymupdf.Rect(r.x0 - 4 * h, r.y0 - 3 * h, r.x1 + h, r.y1 + h)
        box = pymupdf.Rect(r)
        for info in page.get_image_info():
            ib = pymupdf.Rect(info["bbox"])
            if ib.intersects(grow) and ib.get_area() < page.rect.get_area() * 0.05:
                box |= ib
        for d in page.get_drawings():
            db = d["rect"]
            if db.intersects(grow) and db.get_area() < page.rect.get_area() * 0.05:
                box |= db
        boxes.append(box)
    # merge overlapping boxes
    merged = []
    for b in boxes:
        for i, m in enumerate(merged):
            if m.intersects(b):
                merged[i] = m | b
                break
        else:
            merged.append(b)
    W, H = int(round(page.rect.width * scale)), int(round(page.rect.height * scale))
    out = []
    for b in merged:
        x0, y0 = max(0, int(b.x0 * scale) - 2), max(0, int(b.y0 * scale) - 2)
        x1, y1 = min(W, int(b.x1 * scale) + 3), min(H, int(b.y1 * scale) + 3)
        if x1 > x0 and y1 > y0:
            out.append((x0, y0, x1, y1))
    return out

def main():
    src, renderer, out = sys.argv[1:4]
    os.makedirs(out, exist_ok=True)
    fixed = {}
    mf = os.path.join(os.path.dirname(os.path.abspath(__file__)), "masks.json")
    if os.path.exists(mf):
        fixed = json.load(open(mf))["masks"]
    results = []
    for pdf in sorted(glob.glob(os.path.join(src, "*", "*.pdf")) + glob.glob(os.path.join(src, "*", "*.PDF"))):
        slug = os.path.basename(os.path.dirname(pdf))
        masks = [tuple(m) for m in fixed[slug]] if slug in fixed else guess_masks(pdf)
        png = os.path.join(out, f"{slug}-cover.png")
        cmd = ["python3", renderer, pdf, "-o", png, "--width", str(WIDTH), "--json"]
        for m in masks:
            cmd += ["--mask", ",".join(map(str, m))]
        r = subprocess.run(cmd, capture_output=True, text=True)
        row = {"slug": slug, "masks": masks, "maskSource": "masks.json" if slug in fixed else "guessed"}
        if r.returncode == 0:
            facts = json.loads(r.stdout)
            facts["source"] = os.path.relpath(pdf, src)
            row["facts"] = facts
        else:
            row["error"] = r.stderr.strip()
        # The copyright gate is recorded as the publication's own copyright
        # statement says it (owner ruling 2026-09-24, bean cw35), so quote it.
        doc = pymupdf.open(pdf)
        stmt = []
        for i, pg in enumerate(doc):
            for line in pg.get_text().splitlines():
                l = line.strip()
                if any(k in l for k in ("CC BY", "licence", "license", "©", "All rights reserved", "Some rights reserved")):
                    stmt.append({"page": i + 1, "line": l[:300]})
            if len(stmt) >= 8:
                break
        row["rightsLines"] = stmt
        print(slug, len(masks), "mask(s)", row.get("error", "ok"), flush=True)
        results.append(row)
    json.dump(results, open(os.path.join(out, "renders.json"), "w"), indent=1)

if __name__ == "__main__":
    main()
