"""Every package CI installs can actually be imported — bean `68dt`.

`pip install -r requirements.txt` proves the file RESOLVES. It does not prove a
distribution provides the module the declaration says it does, and those two
names differ often enough to matter: `pillow` imports as `PIL`, `PyYAML` as
`yaml`, `pdfminer.six` as `pdfminer`. Until now that mapping existed only as
English inside a comment, where nothing could falsify it.

This is the check that would have caught the failure of 2026-09-19. Every script
here imported `fitz`; the distribution is `pymupdf`, and `fitz` still resolves
but prints a deprecation warning to STDOUT, which corrupted the JSON a caller
parsed. The import worked, so no install-time check could see it — only an
actual import in the environment CI builds.

Read alongside `scripts/check-python-deps.ts`, which is its dual: that one scans
source for imports that are not declared, this one takes the declaration and
tries it. Neither subsumes the other — a package can be declared and unusable,
or usable and undeclared.

LEAN TIER ONLY. `requirements-extended.txt` is deliberately not installed in CI
(`camelot-py` alone is ~323 MB of transitive weight), so asserting its imports
here would fail by design rather than on a defect.
"""
import importlib
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
# scripts/tests -> scripts -> INSTANCE -> REPOSITORY. Four levels, not two.
#
# `requirements.txt` lives in `cat-harness-tools/python/` (moved off the
# repository root 2026-10-06, bean `ar1s`; `requirementsPath` in
# `schemas/python-deps.ts` is the one place the location is written), and CI
# installs it from the top of the checkout. This
# comment said "-> repo root" after two levels, which was true while the
# instance and the repository were one directory; after the move (bean `wggr`)
# two levels reaches `cat-harness/` and the file is one further up.
#
# It failed LOUDLY — "requirements.txt does not exist; nothing to check" is the
# refusal this test was written with, so the wrong root could not read as a
# clean run. Worth recording because the TypeScript half of this same fix was
# found by a vacuity guard too, and because no scan in this repository reaches
# a path spelled in Python.
INSTANCE = os.path.dirname(os.path.dirname(HERE))
ROOT = os.path.dirname(INSTANCE)
REQ = os.path.join(ROOT, "cat-harness-tools", "python", "requirements.txt")


class Undeclared(Exception):
    """A package line with no `# imports:` above it."""


def parse(path: str) -> list[tuple[str, str]]:
    """(distribution, import name) pairs, from the generated `# imports:` lines.

    STRICT: a package line with no `# imports:` above it RAISES. Falling back to
    the distribution name would be a default path, and a parser with one cannot
    tell a missing line from an unremarkable one — it would quietly downgrade
    `pillow -> PIL` to `pillow -> pillow`, which fails for the right reason only
    by luck, and `lxml -> lxml` to the same thing, which fails not at all. The
    pair COUNT is unchanged either way, so the vacuity guard below cannot see it.

    This is bean `ghx3`'s lesson, arrived at there for `roles.json`: a plain
    `z.object` strips an unknown key, so a field an author wrote parses,
    type-checks and reaches no graph. Strict is affordable here for the same
    reason it is there — the file is GENERATED, so every package always has one.
    """
    pairs: list[tuple[str, str]] = []
    pending: str | None = None
    for raw in open(path, encoding="utf-8"):
        line = raw.strip()
        m = re.match(r"^#\s*imports:\s*(\S+)$", line)
        if m:
            pending = m.group(1)
            continue
        if not line or line.startswith("#"):
            continue
        if pending is None:
            raise Undeclared(
                f"{line}: no `# imports:` line above it. "
                "Regenerate with `bun run cat deps:python`; do not hand-edit."
            )
        pairs.append((line, pending))
        pending = None
    return pairs


def main() -> int:
    if not os.path.exists(REQ):
        print(f"FAIL — {REQ} does not exist; nothing to check")
        return 1

    try:
        pairs = parse(REQ)
    except Undeclared as exc:
        print(f"FAIL — {REQ} is malformed: {exc}")
        return 1

    # Vacuity guard. A parser that silently matched nothing would report a clean
    # run over an empty list, which is indistinguishable from every package
    # importing fine. Cross-checked against the raw package-line count so a
    # regression in the `# imports:` emission shows up as a mismatch, not a pass.
    packages = [
        ln.strip()
        for ln in open(REQ, encoding="utf-8")
        if ln.strip() and not ln.strip().startswith("#")
    ]
    if not packages:
        print(f"FAIL — {REQ} declares no packages; this check would be vacuous")
        return 1
    if len(pairs) != len(packages):
        print(f"FAIL — parsed {len(pairs)} pair(s) from {len(packages)} package line(s)")
        return 1
    rc = 0
    for dist, module in sorted(pairs):
        try:
            importlib.import_module(module)
        except Exception as exc:  # noqa: BLE001 — any import failure is the finding
            how = "install it" if isinstance(exc, ModuleNotFoundError) else "it is broken"
            print(f"  FAIL {dist}: `import {module}` raised {type(exc).__name__}: {exc}")
            print(f"       declared in schemas/python-deps.ts — either the import name is wrong or {how}")
            rc = 1
        else:
            shown = f"{dist} -> {module}" if dist != module else dist
            print(f"  ok   {shown}")

    print()
    if rc == 0:
        print(f"  all {len(pairs)} declared package(s) importable")
    else:
        print("  at least one declared package is not importable — see above")
    return rc


if __name__ == "__main__":
    sys.exit(main())
