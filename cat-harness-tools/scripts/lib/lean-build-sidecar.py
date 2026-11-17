#!/usr/bin/env python3
"""Parse lake build logs into a committable JSON sidecar.

Consumes ``<log_dir>/_status.tsv`` (rows: paper, target, status,
elapsed_s, logfile) plus each paper's raw ``<paper>.log``, and writes
``<log_dir>/lean-build-status.json`` — a small, git-committable summary
of a Lean build: per-paper pass/fail, failing modules, extracted compile
errors (``file:line:col`` + message) and ``sorry`` locations.

Purpose: share a (often slow) Lean build failure with an agent by
committing one JSON file, instead of copy-pasting terminal output. Raw
``<paper>.log`` files are large and gitignored; only the JSON is meant
to be committed.

Usage: ``lean-build-sidecar.py [LOG_DIR]``  (default LOG_DIR: build-logs)
"""
from __future__ import annotations

import datetime
import json
import pathlib
import re
import sys

# error: path/to/File.lean:LINE:COL: message
ERR_LOC = re.compile(r"^error: (?P<file>\S+\.lean):(?P<line>\d+):(?P<col>\d+): (?P<msg>.*)$")
# error: <anything else>  (e.g. "no such file or directory", "build failed")
ERR_GENERIC = re.compile(r"^error: (?P<msg>.*)$")
# trailing "  file: /abs/path/File.lean" hint that follows a generic error
FILE_HINT = re.compile(r"^\s*file: (?P<path>.+\.lean)\s*$")
# warning: path:LINE:COL: declaration uses 'sorry'
SORRY = re.compile(r"^warning: (?P<file>\S+\.lean):(?P<line>\d+):(?P<col>\d+): declaration uses 'sorry'")
# ✖/✗ [n/m] Building Some.Module.Name
BUILDING_FAIL = re.compile(r"^[✖✗].*?Building\s+(?P<mod>\S+)")


def parse_log(path: pathlib.Path):
    """Return (errors, sorries, failing_modules) extracted from one log."""
    errors: list = []
    sorries: list = []
    modules: list = []
    in_req_fail = False
    if not path.exists():
        return errors, sorries, modules
    for ln in path.read_text(errors="replace").splitlines():
        m = ERR_LOC.match(ln)
        if m:
            errors.append({
                "file": m["file"], "line": int(m["line"]),
                "col": int(m["col"]), "message": m["msg"].strip(),
            })
            in_req_fail = False
            continue
        m = SORRY.match(ln)
        if m:
            sorries.append({"file": m["file"], "line": int(m["line"]), "col": int(m["col"])})
            continue
        m = BUILDING_FAIL.match(ln)
        if m:
            modules.append(m["mod"])
            in_req_fail = False
            continue
        if ln.startswith("Some required targets logged failures:"):
            in_req_fail = True
            continue
        if in_req_fail:
            stripped = ln.strip()
            if stripped.startswith("- "):
                modules.append(stripped[2:].strip())
                continue
            in_req_fail = False
        m = FILE_HINT.match(ln)
        if m and errors and "file" not in errors[-1]:
            errors[-1]["file"] = m["path"].strip()
            continue
        m = ERR_GENERIC.match(ln)
        if m:
            errors.append({"message": m["msg"].strip()})
            continue
    # de-duplicate failing modules, preserve first-seen order
    seen: set = set()
    modules = [x for x in modules if not (x in seen or seen.add(x))]
    return errors, sorries, modules


def main(argv: list) -> int:
    log_dir = pathlib.Path(argv[1]) if len(argv) > 1 else pathlib.Path("build-logs")
    status_tsv = log_dir / "_status.tsv"
    results = []
    passed = failed = 0
    if status_tsv.exists():
        for row in status_tsv.read_text().splitlines():
            if not row.strip():
                continue
            cols = (row.split("\t") + [""] * 5)[:5]
            paper, target, status, elapsed, logfile = cols
            errs, sorries, mods = parse_log(log_dir / logfile) if logfile else ([], [], [])
            if status == "ok":
                passed += 1
            else:
                failed += 1
            results.append({
                "paper": paper,
                "target": target,
                "status": status,
                "elapsed_s": int(elapsed) if elapsed.isdigit() else None,
                "log": logfile,
                "failingModules": mods,
                "errors": errs,
                "sorries": sorries,
            })

    out = {
        "generatedAt": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "tool": "scripts/lean-build-all.sh",
        "summary": {"passed": passed, "failed": failed, "total": passed + failed},
        "results": results,
    }
    sidecar = log_dir / "lean-build-status.json"
    sidecar.write_text(json.dumps(out, indent=2) + "\n")

    print(f"[sidecar] {sidecar} — {passed} ok / {failed} failed", file=sys.stderr)
    for r in results:
        if r["status"] == "ok":
            continue
        for e in r["errors"]:
            loc = f'{e["file"]}:{e.get("line", "")}' if e.get("file") else ""
            print(f"  ✗ {r['paper']}: {loc} {e['message']}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
