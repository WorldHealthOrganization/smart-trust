"""`--json` means the artefact and nothing else. Bean `ccqg`.

`pdf-structure.py --help` promises `--json` will *"print artefact to stdout,
write nothing"*. It did not keep that: MuPDF writes its warnings from the C
layer straight to **file descriptor 1**, so on a PDF with an unreadable
embedded font the output began

    MuPDF error: library error: FT_New_Memory_Face(RUYKIO+...): unknown file format

    {"_schema": "pdf-structure/v1", ...

and `json.load()` raised `Expecting value: line 1 column 1`.

**Why a unit test could not have caught it, and why this one runs the real
binary.** `contextlib.redirect_stdout` rebinds `sys.stdout`, a Python object
the C layer never consults, so anything mocking at the Python level shows the
bug fixed while the real invocation still fails. The only honest check is to
run the script as a subprocess and read its two streams apart.

**And it must be THIS document.** The defect is font-dependent —
`9789241548960_eng.pdf` and `milnorlink.pdf` parse cleanly, which is exactly
why it survived unnoticed. A synthetic PDF would not carry the broken font,
so a test built on one would pass against the unfixed script.

Found 2026-09-20 while verifying `6xaz`, where the comparison harness had to
carry `json.loads(t[t.index("{"):])` to read the script's own output. A
workaround in the reader is the tell.
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.dirname(HERE)
ROOT = os.path.dirname(SCRIPTS)

# The one in the corpus whose embedded font MuPDF cannot read.
TRIPS_IT = os.path.join(ROOT, "uploads", "WPR-RDO-2020-003-eng.pdf")
# Two that do not, so "stdout is clean" is not passing by having nothing to say.
QUIET = [os.path.join(ROOT, "uploads", n)
         for n in ("milnorlink.pdf", "9789241548960_eng.pdf")]


def run(pdf: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, os.path.join(SCRIPTS, "pdf-structure.py"), "--json", pdf],
        capture_output=True, text=True, timeout=900,
    )


def main() -> int:
    rc = 0

    def check(label: str, cond: bool) -> None:
        nonlocal rc
        print(f"  {'ok  ' if cond else 'FAIL'} {label}")
        if not cond:
            rc = 1

    if not os.path.exists(TRIPS_IT):
        # Never silently. An absent fixture is an untested claim, not a pass.
        print(f"  NOTE {os.path.basename(TRIPS_IT)} absent — nothing here ran")
        return 0

    print("\n1. the document that actually trips it")
    r = run(TRIPS_IT)
    check(f"the script succeeds (exit {r.returncode})", r.returncode == 0)
    check("stdout parses as JSON with NO repair — not `t[t.index('{'):]`",
          _parses(r.stdout))
    check("stdout's first character is the object, not a warning",
          r.stdout.lstrip()[:1] == "{")
    # The half that makes this a redirect rather than a suppression.
    check("and the warning is STILL VISIBLE, on stderr where it belongs",
          "MuPDF" in r.stderr and "FT_New_Memory_Face" in r.stderr)
    check("nothing about MuPDF reached stdout", "MuPDF" not in r.stdout)

    print("\n2. the documents that do not trip it are unaffected")
    for pdf in QUIET:
        if not os.path.exists(pdf):
            print(f"  NOTE {os.path.basename(pdf)} absent — that arm did not run")
            continue
        q = run(pdf)
        check(f"{os.path.basename(pdf)}: still parses", q.returncode == 0 and _parses(q.stdout))

    print("\n3. the artefact itself is untouched by the redirect")
    doc = json.loads(r.stdout)
    check("it is still a pdf-structure/v1 artefact",
          doc.get("_schema") == "pdf-structure/v1")
    check("with its content intact, not an empty shell",
          doc["diagnostics"]["chars_total"] > 500 and doc["source"]["pages"] == 33)

    print()
    print("  all checks passed" if rc == 0 else "  FAILURES above")
    return rc


def _parses(text: str) -> bool:
    try:
        json.loads(text)
        return True
    except (json.JSONDecodeError, ValueError):
        return False


if __name__ == "__main__":
    sys.exit(main())
