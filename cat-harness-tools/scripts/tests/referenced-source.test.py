"""The writer half of a RECORDED source — bean `scfh`, issue #1614.

`referenced-source.py` reads a PDF's embedded outline with PyMuPDF, so its test
lives here, in the job that installs `requirements.txt`. The TypeScript half
(`referenced-source.test.ts`: the schema, the manifest, and the L1 gate that
refuses a referenced entry holding text) needs no PDF and no PyMuPDF. The two
were one TypeScript file until CI's TypeScript job, which installs no Python
packages, failed on the PDF fixture (#1615).

What is asserted is the part only the writer can get wrong: the outline is the
PDF's OWN, the record says `referenced`, the text is NOT written, and a missing
identity field is refused rather than guessed.
"""
import importlib.util
import json
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.dirname(HERE)
SCRIPT = os.path.join(SCRIPTS, "referenced-source.py")

rc = 0


def check(label: str, ok: bool) -> None:
    global rc
    print(f"  {'ok  ' if ok else 'FAIL'} {label}")
    if not ok:
        rc = 1


IDENTITY = {
    "title": "Example Spec", "version": "1.0", "document_number": "formal/00-00-00",
    "date": "2026-01", "publisher": "Example Org", "url": "https://example.org/spec/",
    "withheld": "licence forbids posting copies",
}


def main() -> int:
    if importlib.util.find_spec("pymupdf") is None:
        # Not a skip that reads as a pass: this job installs requirements.txt,
        # which declares pymupdf, so its absence is a broken environment.
        print("  FAIL pymupdf is not importable — requirements.txt declares it")
        return 1
    import pymupdf

    with tempfile.TemporaryDirectory() as d:
        pdf = os.path.join(d, "spec.pdf")
        doc = pymupdf.open()
        for t in ("Scope", "Conformance"):
            doc.new_page().insert_text((72, 72), t)
        doc.set_toc([[1, "Scope", 1], [1, "Conformance", 2]])
        doc.save(pdf)
        ident = os.path.join(d, "id.json")
        with open(ident, "w", encoding="utf-8") as fh:
            json.dump(IDENTITY, fh)
        out = os.path.join(d, "lib")
        r = subprocess.run([sys.executable, SCRIPT, "-o", out, pdf, "--identity", ident],
                           capture_output=True, text=True)
        check(f"the writer exits 0 (stderr: {r.stderr.strip()[:120]!r})", r.returncode == 0)
        entry = os.path.join(out, "spec")
        rec = json.load(open(os.path.join(entry, "referenced.json"), encoding="utf-8"))
        check("the record declares folio-referenced-source/v1", rec.get("$schema") == "folio-referenced-source/v1")
        check("the outline is the PDF's own", [o["title"] for o in rec["outline"]] == ["Scope", "Conformance"])
        check("the outline says where it came from", rec["outline_source"] == "embedded")
        check("the materialization state is `referenced`", rec["materialization"]["state"] == "referenced")
        check("the withheld reason is carried", rec["withheld"]["why"] == IDENTITY["withheld"])
        check("the full sha256 identifies the bytes", len(rec["source"]["sha256"]) == 64)
        check("it is plain JSON, not JSON-LD", "@context" not in rec)
        # The whole point of the kind: none of the text is written.
        written = sorted(os.listdir(entry))
        check(f"only the record is written (got {written})", written == ["referenced.json"])

        # A missing identity field is refused, never guessed.
        with open(ident, "w", encoding="utf-8") as fh:
            json.dump({"title": "x"}, fh)
        r = subprocess.run([sys.executable, SCRIPT, "-o", os.path.join(d, "lib2"), pdf, "--identity", ident],
                           capture_output=True, text=True)
        check("an identity missing fields exits 1", r.returncode == 1)
        check("and says it will not guess", "never guess" in r.stderr)

    print()
    print("  all checks passed" if rc == 0 else "  FAILURES above")
    return rc


if __name__ == "__main__":
    sys.exit(main())
