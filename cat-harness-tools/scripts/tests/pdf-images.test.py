"""The scan/figure rule is spelled twice; these pin it. Bean `d5f1`.

`roleFor` in `schemas/content/document-image.ts` decides what a consumer believes an
image is. `role_for` in `scripts/pdf-images.py` decides what gets written down.
They are in different languages, so nothing but a test holds them together.

This is the same shape as `scripts/tests/pdf-pages-outline.test.py`, and for
the same reason: earlier the same day, an outline rule spelled in two places
drifted silently and reported 35 entries of journal furniture as 19 usable
chapters. Two spellings are affordable only while something checks them.

The threshold is READ out of both sources rather than restated here. A literal
`0.8` in this file would be a third spelling, which is the defect itself.
"""
import glob
import importlib.util
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.dirname(HERE)
ROOT = os.path.dirname(SCRIPTS)  # this layer; schemas/ moved here with the code (8lcl)
sys.path.insert(0, SCRIPTS)


def load(name: str):
    spec = importlib.util.spec_from_file_location(
        "_t_" + name.replace("-", "_").replace(".py", ""), os.path.join(SCRIPTS, name)
    )
    assert spec and spec.loader, name
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


def ts_const(name: str) -> float:
    """Read a threshold OUT of the TypeScript. Restating one here is the defect."""
    src = open(os.path.join(ROOT, "schemas", "content", "document-image.ts"), encoding="utf-8").read()
    m = re.search(name + r"\s*=\s*([0-9.]+)", src)
    assert m, f"{name} not found in document-image.ts — did it move?"
    return float(m.group(1))


def ts_threshold() -> float:
    return ts_const("PAGE_COVERAGE_THRESHOLD")


# (coverage, images_on_page, expected role). Drawn from the corpus, not invented:
# 0.998 is WHO_PUB_TPS_93.1, 0.495 is the half-page figure in 9789241548960_eng,
# 0.013 is the median in WPR-RDO-2020-003-eng, 0.008 is milnorlink's one figure.
CASES = [
    (0.998, 1, "page-scan"),
    (1.000, 1, "page-scan"),
    (0.495, 1, "figure"),
    (0.013, 3, "figure"),
    (0.008, 1, "figure"),
    # A full-bleed image is NOT a page scan when it shares its page: something
    # else is on that page, so the image is not the page.
    (0.998, 2, "figure"),
    (0.000, 1, "figure"),
]


# (coverage, images_on_page, expected role) INSIDE a capture rung. Drawn from
# the six browser prints under uploads/, measured 2026-09-21 -- not invented:
# 0.000183 is the smallest of the 104 in `Agent-Skills-Google-Antigravity-
# Docs.pdf`, 0.005804 is the single image in `Skills-in-OpenAI-API.pdf` and the
# LARGEST nav-chrome value anywhere in the corpus, 0.139632 is the smallest real
# figure (`Equipping-agents-...-Anthropic.pdf`) and 0.361098 the largest
# (`Skill-authoring-best-practices-Claude-Platform-Docs.pdf`). Names normalised
# 2026-09-30 by `check:upload-names`; the measurements are unchanged.
CAPTURE_CASES = [
    (0.000183, 26, "chrome"),
    (0.000936, 26, "chrome"),
    (0.005804, 1, "chrome"),
    (0.139632, 6, "figure"),
    (0.361098, 3, "figure"),
    # A browser print can still place a full-bleed image alone on a page, and
    # that image is the page. The rung does not change what full-bleed means.
    (0.998, 1, "page-scan"),
]


def main() -> int:
    rc = 0

    def check(label: str, cond: bool) -> None:
        nonlocal rc
        print(f"  {'ok  ' if cond else 'FAIL'} {label}")
        if not cond:
            rc = 1

    images = load("pdf-images.py")
    ts, py = ts_threshold(), images.PAGE_COVERAGE_THRESHOLD
    check(f"both sources declare the threshold  (ts={ts} py={py})", bool(ts and py))
    check("the two thresholds agree", ts == py)

    for coverage, on_page, expected in CASES:
        got = images.role_for(coverage, on_page)
        check(f"coverage {coverage:<6} x{on_page} -> {expected} (got {got})", got == expected)

    # The boundary is a boundary, not a vibe. Read off the threshold so this
    # keeps testing the edge if the threshold ever moves.
    check("at the threshold exactly, alone on the page, it is a scan",
          images.role_for(py, 1) == "page-scan")
    check("a hair below the threshold it is a figure",
          images.role_for(py - 1e-9, 1) == "figure")

    # Absence is never inferred. With no backend the sidecar must say so.
    from pathlib import Path
    sidecar = images.extract(Path("does-not-exist.pdf"), Path("library"), dry_run=True)
    check("an unopenable PDF yields images=None, not []", sidecar["images"] is None)
    check("...and says why", bool(sidecar.get("undetermined_reason")))

    # --- the capture rung, bean `r8br` / issue #722 -----------------------
    cap_ts, cap_py = ts_const("CAPTURE_CHROME_THRESHOLD"), images.CAPTURE_CHROME_THRESHOLD
    check(f"both sources declare the chrome bound  (ts={cap_ts} py={cap_py})", bool(cap_ts and cap_py))
    check("the two chrome bounds agree", cap_ts == cap_py)
    check("the chrome bound sits below the page bound", cap_py < py)

    # The detector needs BOTH signals. Skia alone is "a Chromium-family
    # renderer" -- Android and Flutter emit it too -- not "a browser printed a
    # web page". Each row is a real producer/creator pair from this corpus.
    DETECT = [
        ("Skia/PDF m152", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", True),
        ("pikepdf 8.15.1", "arXiv GenPDF (tex2pdf)", False),
        ("Atypon Systems, Inc.", "PDFplus", False),
        ("Pixel Translations (PIXPDF Ver.4.2.48)", "", False),
        ("", "", False),
        # Half the evidence is not the evidence. Both of these fail SAFE: the
        # images stay `figure` and keep blocking, rather than being
        # reclassified on one signal.
        ("Skia/PDF m152", "Some Other Tool", False),
        ("pikepdf 8.15.1", "Mozilla/5.0 (Macintosh)", False),
    ]
    for producer, creator, expected in DETECT:
        got = images.is_capture_print(producer, creator)
        check(f"capture? {producer[:22]!r:26} + {creator[:20]!r:24} -> {expected}", got == expected)

    for coverage, on_page, expected in CAPTURE_CASES:
        got = images.role_for(coverage, on_page, True)
        check(f"capture  {coverage:<9} x{on_page} -> {expected} (got {got})", got == expected)

    # The rung is the ONLY thing that changes these. Outside it, every capture
    # case must classify exactly as it did before `chrome` existed -- this is
    # what proves a typeset PDF is untouched.
    for coverage, on_page, _ in CAPTURE_CASES:
        outside = images.role_for(coverage, on_page, False)
        legacy = "page-scan" if (coverage >= py and on_page == 1) else "figure"
        check(f"outside the rung {coverage:<9} x{on_page} -> {legacy} (got {outside})", outside == legacy)

    check("at the chrome bound exactly it is a figure, not chrome",
          images.role_for(cap_py, 2, True) == "figure")
    check("a hair below the chrome bound it is chrome",
          images.role_for(cap_py - 1e-9, 2, True) == "chrome")

    # End to end on the corpus, when it is present.
    milnor = os.path.join(ROOT, "uploads", "milnorlink.pdf")
    if os.path.exists(milnor):
        s = images.extract(Path(milnor), Path("library"), dry_run=True)
        if s["images"] is None:
            print("       NOTE: no PDF backend here, so the end-to-end arm proved nothing.")
        else:
            roles = {}
            for i in s["images"]:
                roles[i["role"]] = roles.get(i["role"], 0) + 1
            check(f"milnorlink: 19 page-scan + 1 figure (got {roles})",
                  roles.get("page-scan") == 19 and roles.get("figure") == 1)
            # Every decided entry shows its working — the `nso8` rule the
            # schema enforces, checked here on real output rather than fixtures.
            check("every decided entry carries its basis",
                  all(("basis" in i) == (i["role"] != "undetermined") for i in s["images"]))
            check("no page scan carries a narrative slot",
                  all("narrative" not in i for i in s["images"] if i["role"] == "page-scan"))
            check("every figure does",
                  all("narrative" in i for i in s["images"] if i["role"] == "figure"))
    else:
        print("  NOTE uploads/milnorlink.pdf absent — the end-to-end arm did not run")

    # End to end on a real BROWSER PRINT. The cases above exercise `role_for`,
    # which could be perfectly right while `extract` never passes `capture` --
    # so this arm is the one that proves the rung is actually wired. Guarded
    # like the arm above: these live in the folio's uploads/, one level out.
    folio_root = os.path.dirname(ROOT)
    captures = [
        # (file, expected roles) -- DISTINCT images, not placements. Measured
        # 2026-09-21 as {"chrome": 104}; that was 104 PLACEMENTS of 44 image
        # objects, each of the browser's nav glyphs re-emitted on every page.
        # `extract` now returns one entry per `xref` (bean `j820`, issue
        # #1234), so the honest number is 44 and the 104 lives in
        # `placements[]`, which the assertion below counts.
        ("Agent-Skills-Google-Antigravity-Docs.pdf", {"chrome": 44}),
        # The one that matters most: a browser print whose images are REAL
        # figures. If the bound ever drifts up, this is what goes red -- a
        # change that made everything chrome would pass the promotion gate and
        # be worse than the bug it fixed.
        ("Equipping-agents-for-the-real-world-with-Agent-Skills-_-Anthropic.pdf", {"figure": 6}),
    ]
    ran_capture = False
    for name, expected in captures:
        path = os.path.join(folio_root, "uploads", name)
        if not os.path.exists(path):
            # A missing fixture SKIPS, and a skip here is indistinguishable
            # from a pass (bean `1xhc`). On 2026-09-30 `check:upload-names`
            # renamed both of these and this arm went quiet rather than red,
            # so the absence is announced.
            print(f"  NOTE uploads/{name} absent — that capture arm did not run")
            continue
        s2 = images.extract(Path(path), Path("library"), dry_run=True)
        if s2["images"] is None:
            continue
        ran_capture = True
        roles = {}
        for i in s2["images"]:
            roles[i["role"]] = roles.get(i["role"], 0) + 1
        check(f"{name[:34]}: {expected} (got {roles})", roles == expected)
        check("...every entry carries a CAPTURE basis, naming the producer",
              all(i.get("basis", {}).get("method") == "capture"
                  and i["basis"].get("producer") for i in s2["images"]))
        check("...no chrome entry carries a narrative slot",
              all("narrative" not in i for i in s2["images"] if i["role"] == "chrome"))
        # EVERY PLACEMENT IS STILL RECORDED. Without this, a dedup bug that
        # dropped images rather than collapsing them would read as a smaller
        # count and pass -- which is exactly how the number above moved.
        placed = sum(len(i.get("placements", [None])) for i in s2["images"])
        check(f"...{placed} placement(s) across {len(s2['images'])} distinct image(s)",
              placed >= len(s2["images"]))
        check("...every figure still does",
              all("narrative" in i for i in s2["images"] if i["role"] == "figure"))
    if not ran_capture:
        print("  NOTE no browser-print capture present — the capture end-to-end arm did not run")

    # ── A `figure` ENTRY MUST HAVE ITS FILE — bean `a8wy` follow-up, 2026-09-29
    #
    # `pdf-images.py` writes a PNG only for a `figure`; `chrome` and
    # `page-scan` entries name a file that was never meant to exist, so the
    # check is scoped to figures and NOT to every entry. Measured over the
    # committed corpus the day this was written: 289 figures, 289 files, and
    # 351 absent files all of them `chrome` (210) or `page-scan` (141).
    #
    # It exists because of a failure that looked exactly like unfinished work.
    # An image may carry BOTH an alpha channel and a separate soft mask, and
    # MuPDF refuses `Pixmap(pix, mask)` on a base that already has alpha
    # ("color pixmap must not have an alpha channel"). The writer's `except`
    # swallowed it and left `images.json` naming a PNG nobody could open, so
    # `image-descriptions` demanded a narrative for a file that was not there.
    # Three of the eight images in `2509.06388v1.pdf` were in that state.
    figure_files = 0
    for path in sorted(glob.glob(os.path.join(os.path.dirname(ROOT), "*/library/*/images.json"))):
        with open(path, encoding="utf-8") as fh:
            side = json.load(fh)
        root = os.path.dirname(path)
        for i in (side.get("images") or []):
            if i.get("role") != "figure" or not i.get("file"):
                continue
            figure_files += 1
            check(f"{os.path.basename(root)}/{i['id']}: the figure's file is on disk",
                  os.path.exists(os.path.join(root, i["file"])))
    print(f"  ...checked {figure_files} figure file(s) across the committed corpus")

    # The OPTIONAL role threshold -- bean `ay3x`, owner 2026-10-03: "an
    # optional one can be set, default none". The value below is ARBITRARY: it
    # is the midpoint of two of the CASES coverages above, chosen only so the
    # comparison has something on each side. It is not a recommendation, and
    # no number may become one (see `library-ingestion`).
    import inspect
    sig = inspect.signature(images.role_for)
    check("role_threshold defaults to None -- nothing is thresholded unless a caller asks",
          sig.parameters["role_threshold"].default is None)
    src = open(os.path.join(SCRIPTS, "pdf-images.py"), encoding="utf-8").read()
    check("the CLI flag ships no default value",
          re.search(r'"--role-threshold",[^)]*default=None', src, re.S) is not None)
    arbitrary = (0.013 + 0.008) / 2
    check("without a threshold, a small image stays a figure",
          images.role_for(0.008, 1) == "figure")
    check("with one, an image below it is filed furniture",
          images.role_for(0.008, 1, False, arbitrary) == "furniture")
    check("with one, an image at or above it keeps its geometry role",
          images.role_for(0.013, 3, False, arbitrary) == "figure")
    check("a threshold never overrides a page scan",
          images.role_for(0.998, 1, False, 1.0) == "page-scan")
    check("a threshold never overrides a capture's chrome",
          images.role_for(cap_py / 2, 2, True, cap_py) == "chrome")
    check("the TypeScript schema knows the role the cutoff writes",
          '"furniture"' in open(os.path.join(ROOT, "schemas", "content", "document-image.ts"), encoding="utf-8").read())

    # An ink colourspace and an off-size soft mask are still written as PNG
    # (10665-44118-rus: ten DeviceN(Black) photos and a logo whose mask is
    # three times its size were written as empty files).
    import tempfile
    import pymupdf
    with tempfile.TemporaryDirectory() as tmp:
        doc = pymupdf.open()
        page = doc.new_page(width=200, height=200)
        w, h = 40, 20
        gray = pymupdf.Pixmap(pymupdf.csGRAY, pymupdf.IRect(0, 0, w, h), False)
        gray.set_rect(gray.irect, (120,))
        page.insert_image(pymupdf.Rect(10, 10, 110, 60), pixmap=gray)
        other = pymupdf.Pixmap(pymupdf.csGRAY, pymupdf.IRect(0, 0, w, h), False)
        other.set_rect(other.irect, (60,))
        page.insert_image(pymupdf.Rect(10, 100, 110, 150), pixmap=other)
        xa, xb = (im[0] for im in page.get_images(full=True))
        ink = ("[/DeviceN [/Black] /DeviceCMYK << /FunctionType 2 /Domain [0 1]"
               " /C0 [0 0 0 0] /C1 [0 0 0 1] /N 1 >>]")
        doc.xref_set_key(xa, "ColorSpace", ink)
        mask = doc.get_new_xref()
        doc.update_object(mask, f"<< /Type /XObject /Subtype /Image /Width {w * 3}"
                          f" /Height {h * 3} /ColorSpace /DeviceGray /BitsPerComponent 8 >>")
        doc.update_stream(mask, bytes([255]) * (w * 3 * h * 3))
        doc.xref_set_key(xb, "SMask", f"{mask} 0 R")
        pdf = os.path.join(tmp, "ink.pdf")
        doc.save(pdf)
        out = os.path.join(tmp, "out")
        import subprocess
        subprocess.run([sys.executable, os.path.join(SCRIPTS, "pdf-images.py"), "-o", out, pdf],
                       capture_output=True, text=True)
        written = sorted(glob.glob(os.path.join(out, "*", "images", "*.png")))
        sizes = [os.path.getsize(f) for f in written]
        check(f"a DeviceN image and an off-size soft mask are written, not empty ({sizes})",
              len(sizes) == 2 and all(n > 0 for n in sizes))

    print()
    print("  all checks passed" if rc == 0 else "  FAILURES above")
    return rc


if __name__ == "__main__":
    sys.exit(main())
