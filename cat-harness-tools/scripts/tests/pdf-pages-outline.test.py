"""The outline-usability rule is spelled twice; these pin it. Bean `8shg`.

`usableOutlineEntries` in `scripts/ingest-document.ts` decides which rung a
document takes. `outline_state` in `scripts/pdf-pages.py` records what the rung
SAW. They must agree, and they are in different languages, so nothing but a
test can hold them together.

The duplicate is deliberate and narrow — the router runs before this script and
this script must be able to report what it found without depending on having
been routed — but a duplicate nobody checks is how `milnorlink.pdf` came to be
described as carrying no outline when it carries thirty-five entries.

Why this matters more than it looks: the earlier attempt at this rule lived as
a Python regex inside a JS template literal, where a regex escape is an invalid
STRING escape and JavaScript silently drops the backslash. Python received a
pattern that matched nothing and reported 35 entries of journal furniture as 19
usable chapters. Nothing failed; the answer was just wrong. A test comparing
two spellings against the same cases is the only thing that catches that class.
"""
import importlib.util
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.dirname(HERE)
ROOT = os.path.dirname(SCRIPTS)
sys.path.insert(0, SCRIPTS)


def load(name: str):
    """A hyphenated script as a module — not importable by name, loaded by path."""
    spec = importlib.util.spec_from_file_location(
        "_t_" + name.replace("-", "_").replace(".py", ""), os.path.join(SCRIPTS, name)
    )
    assert spec and spec.loader, name
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


def ts_rule() -> str:
    """The regex `usableOutlineEntries` uses, read out of the TypeScript.

    Read rather than retyped. A copy here would be a THIRD spelling, and the
    whole point is that there are already two.
    """
    src = open(os.path.join(SCRIPTS, "ingest-document.ts"), encoding="utf-8").read()
    m = re.search(r"!/\^([^/]+)\$/i\.test\(e\.title\.trim\(\)\)", src)
    assert m, "could not find the title rule in ingest-document.ts — did it move?"
    return m.group(1)


def py_rule() -> str:
    """The regex `outline_state` uses, read out of the Python, same way."""
    src = open(os.path.join(SCRIPTS, "pdf-pages.py"), encoding="utf-8").read()
    m = re.search(r're\.fullmatch\(r"([^"]+)"', src)
    assert m, "could not find the title rule in pdf-pages.py — did it move?"
    return m.group(1)


# Titles that are only a page reference, in the spellings this corpus uses, and
# titles that are not. `milnorlink.pdf` supplies the first group verbatim.
PAGE_LABELS = ["p. 177", "p.177", "p 177", "pp. 12", "P. 3", "  p. 9  "]
NOT_LABELS = [
    "Article Contents",
    "Issue Table of Contents",
    "2. Preliminaries",
    "Chapter 3, p. 177",
    "Theorem 177",
    "The One-Quarter Theorem for Mean Inivalent Functions",
]


def main() -> int:
    rc = 0

    def check(label: str, cond: bool) -> None:
        nonlocal rc
        print(f"  {'ok  ' if cond else 'FAIL'} {label}")
        if not cond:
            rc = 1

    ts, py = ts_rule(), py_rule()
    check(f"both scripts still declare a title rule  (ts={ts!r} py={py!r})", bool(ts and py))
    check("the two spellings are character-identical", ts == py)

    # Behavioural, not textual: two different regexes could still agree, and
    # two identical ones could still be applied differently.
    pages = load("pdf-pages.py")
    rx = re.compile(f"^{py}$", re.I)
    for t in PAGE_LABELS:
        check(f"{t!r} is a bare page label", bool(rx.fullmatch(t.strip())))
    for t in NOT_LABELS:
        check(f"{t!r} is NOT a bare page label", not rx.fullmatch(t.strip()))

    # The destination half of the rule, which the regex does not carry.
    check("outline_state exists and never raises on a missing file",
          pages.outline_state("does-not-exist.pdf") in
          {"none", "none-undetermined", "outline", "outline-unusable"})

    # And the whole thing, end to end, on the document the bean is about.
    milnor = os.path.join(ROOT, "uploads", "milnorlink.pdf")
    if os.path.exists(milnor):
        state = pages.outline_state(milnor)
        check(f"milnorlink.pdf reports outline-unusable (got {state!r})",
              state in {"outline-unusable", "none-undetermined"})
        if state == "none-undetermined":
            print("       NOTE: no PDF backend here, so this arm proved nothing.")
    else:
        # Never silently. An absent fixture is an untested claim, not a pass.
        print("  NOTE uploads/milnorlink.pdf absent — the end-to-end arm did not run")

    print()
    print("  all checks passed" if rc == 0 else "  FAILURES above")
    return rc


if __name__ == "__main__":
    sys.exit(main())
