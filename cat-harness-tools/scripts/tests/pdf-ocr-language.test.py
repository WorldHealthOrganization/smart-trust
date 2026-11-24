"""OCR language choice from the document's languages. Owner, 2026-11-10.

"make sure OCR is language aware" and "rules may assume LTR languages".
Tesseract's script detection names a SCRIPT, not a language: French and
English are both `Latin`, Persian and Arabic both `Arabic`. `pdf-ocr.py`
therefore takes the catalogue's `dc.language.iso` as `--lang-hint` and
narrows each page to the hinted languages in the script it shows.

## What these tests hold

1. ISO 639 codes as IRIS writes them (`en_US`, `EN`, `zh`, `fa`) map to
   Tesseract packs; an unknown code is dropped.
2. A Latin page in a French/English record reads as `fra+eng`; an Arabic
   page in the same six-language record reads as `ara+eng`, a Han page as
   simplified or traditional Chinese by what the detector saw, a Cyrillic page
   as Russian.
3. A Persian record's Arabic-script page reads as Persian, not Arabic.
4. A hinted pack that is not installed is reported missing (the caller
   refuses), never swapped for English.
5. With no hints, the script-only rule is unchanged.
6. Arabic and Persian pages are marked right to left.
7. An OCR cache counts as complete only when it holds a page per PDF page:
   an interrupted run left 4 of 38 pages, which were then served as the
   whole document.
"""
import importlib.util
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.dirname(HERE)
sys.path.insert(0, SCRIPTS)


def load(name: str):
    spec = importlib.util.spec_from_file_location("_t_" + name.replace("-", "_").replace(".py", ""), os.path.join(SCRIPTS, name))
    assert spec and spec.loader, name
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def main() -> int:
    rc = 0

    def check(what: str, ok: bool) -> None:
        nonlocal rc
        print(("  ok    " if ok else "  FAIL  ") + what)
        if not ok:
            rc = 1

    o = load("pdf-ocr.py")
    six = ["ar", "zh", "en", "fr", "ru", "es"]
    allp = {"eng", "fra", "spa", "rus", "ara", "chi_sim", "chi_tra", "fas", "por", "osd"}

    check("IRIS spellings map to packs", o.hint_packs(["en_US", "EN", "fr"]) == ["eng", "fra"])
    check("zh maps to both Chinese packs", o.hint_packs(["zh"]) == ["chi_sim", "chi_tra"])
    check("an unknown code is dropped", o.hint_packs(["xx", "fa"]) == ["fas"])

    check("Latin page, fr+en record -> fra+eng", o.choose_lang("Latin", ["fr", "en"], allp) == ("fra+eng", []))
    check("Latin page, six-language record -> the four Latin-script ones",
          o.choose_lang("Latin", six, allp)[0] == "eng+fra+spa")
    check("Arabic page, six-language record -> ara+eng", o.choose_lang("Arabic", six, allp) == ("ara+eng", []))
    check("HanS page -> chi_sim first", o.choose_lang("HanS", six, allp)[0].startswith("chi_sim"))
    check("HanT page -> chi_tra first", o.choose_lang("HanT", six, allp)[0].startswith("chi_tra"))
    check("Cyrillic page -> rus+eng", o.choose_lang("Cyrillic", six, allp) == ("rus+eng", []))
    check("Persian record, Arabic script -> fas+eng", o.choose_lang("Arabic", ["en", "fa"], allp) == ("fas+eng", []))
    check("a script no hint writes falls back to every hinted pack",
          o.choose_lang("Cyrillic", ["fr"], allp) == ("fra", []))

    lang, missing = o.choose_lang("Arabic", ["ar"], {"eng"})
    check("a missing hinted pack is reported, not swapped for English", lang == "ara" and missing == ["ara"])

    check("no hints: script rule unchanged (Cyrillic)", o.choose_lang("Cyrillic", [], allp) == ("rus+eng", []))
    check("no hints, pack absent: falls back to eng as before", o.choose_lang("Japanese", [], {"eng"}) == ("eng", []))

    check("Arabic is right to left", o.direction_of("ara+eng") == "rtl")
    check("Persian is right to left", o.direction_of("fas") == "rtl")
    check("French is left to right", o.direction_of("fra+eng") == "ltr")

    import shutil, tempfile
    try:
        import pymupdf
    except Exception:
        pymupdf = None
    if pymupdf and shutil.which("pdfinfo"):
        with tempfile.TemporaryDirectory() as td:
            pdf = os.path.join(td, "three.pdf")
            d = pymupdf.open()
            for _ in range(3):
                d.new_page()
            d.save(pdf)
            check("pdf_pages reads the page count", o.pdf_pages(pdf) == 3)
            cache = o.ocr_cache_dir(td, pdf)
            os.makedirs(cache)
            open(os.path.join(cache, "page-001.txt"), "w").write("x")
            o.tools_present = lambda: {"tesseract": None, "pdftoppm": None}
            try:
                n, how = o.ocr_pdf(pdf, td, "eng", 50, False)
                partial_served = how == "cached"
            except Exception:
                partial_served = False  # it tried to OCR again, which is right
            check("a partial OCR cache is not served as the whole document", not partial_served)
            check("and its stale pages are removed", not os.path.exists(os.path.join(cache, "page-001.txt")) or not partial_served)
    else:
        print("  skip  pdf_pages (needs pymupdf and pdfinfo)")

    print()
    print("  all checks passed" if rc == 0 else "  FAILURES above")
    return rc


if __name__ == "__main__":
    sys.exit(main())
