#!/usr/bin/env python3
"""
smart-base-transform — run WHO's XSLT transforms from a smart-base checkout.

The first skill-packaged use of the `smart-base` capability, and the first
piece of the render arrow §12.15 of `docs/proposals/rag-document-ingestion.md`
calls for: an authored source artefact (BPMN, DMN) producing a published
representation (FSH, HTML), rather than a hand-made artefact being extracted
from.

**Loads; does not vendor.** The stylesheets stay in smart-base, because the DAK
repositories' own GitHub Actions invoke them there and a copy here would be a
second, drifting toolchain. This resolves `SMART_BASE_HOME` (default
`/opt/smart-base`) and runs what it finds.

    smart-base-transform.py --check
    smart-base-transform.py bpmn2fsh  <file.bpmn|dir> [-o OUTDIR]
    smart-base-transform.py dmn2html  <file.dmn|dir>  [-o OUTDIR]

## The multi-file envelope

`bpmn2fhirfsh.xsl` does not emit one document. It emits

    <files><file name="input/fsh/..." mime-type="text/fsh">…</file>…</files>

and each `<file>` is a separate artefact — measured on `smart-dak-immz`, 8
business processes produce **313** FSH files, one of them 157 on its own. So
the envelope has to be split, and `--out` writes each entry at the path the
transform names.

## Why the result tree is used directly

Serialising the XSLT output and re-parsing it fails: one real WHO process emits
FSH text containing an `xsl:`-prefixed attribute that is well-formed inside the
result tree and not well-formed once round-tripped through a string. lxml hands
back an already-parsed tree, so this reads that and never re-parses.

@module scripts/smart-base-transform
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

# The named transforms, and where each lives inside a smart-base checkout.
TRANSFORMS = {
    "bpmn2fsh": ("input/scripts/includes/bpmn2fhirfsh.xsl", ".bpmn"),
    "dmn2html": ("input/scripts/includes/dmn2html.xslt", ".dmn"),
}

DEFAULT_HOME = "/opt/smart-base"


def smart_base_home() -> Path:
    return Path(os.environ.get("SMART_BASE_HOME", DEFAULT_HOME))


def capability_report() -> tuple[bool, list[str]]:
    """(available, reasons). Absent reads as absent, never as 'nothing to do'."""
    reasons: list[str] = []
    home = smart_base_home()
    if not home.is_dir():
        reasons.append(f"no smart-base checkout at {home} (set SMART_BASE_HOME)")
    else:
        for name, (rel, _) in TRANSFORMS.items():
            if not (home / rel).is_file():
                reasons.append(f"{name}: missing {rel}")
    try:
        import lxml.etree  # noqa: F401
    except ImportError:
        reasons.append("python package 'lxml' not installed (pip install lxml)")
    return (not reasons), reasons


def run(transform: str, target: Path, outdir: Path | None) -> int:
    import lxml.etree as ET

    rel, suffix = TRANSFORMS[transform]
    xslt_path = smart_base_home() / rel
    try:
        xslt = ET.XSLT(ET.parse(str(xslt_path)))
    except Exception as e:  # noqa: BLE001
        print(f"error: could not compile {xslt_path}: {e}", file=sys.stderr)
        return 2

    inputs = (
        sorted(target.glob(f"*{suffix}")) if target.is_dir() else [target]
    )
    if not inputs:
        print(f"no {suffix} files under {target}", file=sys.stderr)
        return 1

    total_files = 0
    failures = 0
    # Emitted paths, and who emitted them. Measured on smart-dak-immz: 8
    # processes emit 313 files at only 200 distinct paths, because shared
    # actors and two near-duplicate copies of one process name the same
    # outputs. Overwriting silently would report 313 successes and leave 200
    # files, so collisions are counted and named.
    seen: dict[str, str] = {}
    collisions: list[tuple[str, str, str]] = []
    for src in inputs:
        try:
            result = xslt(ET.parse(str(src)))
        except Exception as e:  # noqa: BLE001
            failures += 1
            print(f"FAIL {src.name}: {str(e)[:160]}", file=sys.stderr)
            continue

        root = result.getroot()
        entries = root.findall(".//file") if root is not None else []
        if entries:
            for entry in entries:
                name = entry.get("name") or ""
                body = entry.text or ""
                total_files += 1
                prior = seen.get(name)
                if prior is not None and prior != src.name:
                    collisions.append((name, prior, src.name))
                seen[name] = src.name
                if outdir:
                    dest = outdir / name
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    dest.write_text(body, encoding="utf-8")
            print(f"{src.name}: {len(entries)} file(s)")
        else:
            # A single-document transform (dmn2html) — write it under the
            # input's stem rather than inventing a name.
            total_files += 1
            if outdir:
                outdir.mkdir(parents=True, exist_ok=True)
                ext = ".html" if transform == "dmn2html" else ".out"
                (outdir / f"{src.stem}{ext}").write_text(str(result), encoding="utf-8")
            print(f"{src.name}: 1 document")

    if collisions:
        print(
            f"\n{len(collisions)} output path(s) written more than once — "
            f"later inputs overwrote earlier ones:",
            file=sys.stderr,
        )
        for name, first, second in collisions[:10]:
            print(f"  {name}\n      first from {first}, then {second}", file=sys.stderr)
        if len(collisions) > 10:
            print(f"  … and {len(collisions) - 10} more", file=sys.stderr)

    where = f" → {outdir}" if outdir else " (dry run; pass -o to write)"
    print(
        f"\n{len(inputs)} input(s), {total_files} emitted, "
        f"{len(seen) if seen else total_files} distinct path(s), "
        f"{len(collisions)} collision(s), {failures} failure(s){where}"
    )
    return 1 if failures else 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("transform", nargs="?", choices=sorted(TRANSFORMS), help="which transform to run")
    ap.add_argument("target", nargs="?", type=Path, help="a source file or a directory of them")
    ap.add_argument("-o", "--out", type=Path, help="write outputs here; omit for a dry run")
    ap.add_argument("--check", action="store_true", help="report capability and exit")
    args = ap.parse_args()

    available, reasons = capability_report()

    if args.check:
        print(f"smart-base: {'available' if available else 'UNAVAILABLE'}")
        print(f"  SMART_BASE_HOME = {smart_base_home()}")
        for r in reasons:
            print(f"  - {r}")
        return 0 if available else 1

    if not args.transform or not args.target:
        ap.print_usage(sys.stderr)
        return 2

    if not available:
        # Degrade honestly: a missing toolchain is not a clean run.
        print("smart-base transforms unavailable:", file=sys.stderr)
        for r in reasons:
            print(f"  - {r}", file=sys.stderr)
        return 3

    return run(args.transform, args.target, args.out)


if __name__ == "__main__":
    sys.exit(main())
