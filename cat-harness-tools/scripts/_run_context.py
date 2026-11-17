"""Write a `folio-run-context/v1` — WHICH SOFTWARE a run ran on — from Python.

Bean `turh` (who-iris#44): a fresh OCR of `who-pub-tps-931` read "Manval"
where the committed one reads "Manual", and nothing recorded which OCR engine
and version produced either, so the two could not be told apart or reproduced.

## Reused, not invented

The record is cat-harness's `folio-run-context/v1` (`schemas/run-context.ts`),
the owner's single answer to "what version of the Tool was used for audit
purpose" for test runs, QA reports and tool runs
(`docs/proposals/tool-releases-2026-10-07.md`, §"Scope widened"). Nothing here
adds a field: this module only builds that document from a Python process, and
computes its reference exactly as `runContextRef` does, so a TypeScript reader
and this writer agree on the digest (asserted by
`scripts/tests/run-context-python.test.ts`).

- `releases[]`: each executable that ran, as `<name>@<version>` with the
  sha256 of the BYTES that ran (`provisioned`), or `could-not-provision` with
  the reason. A version string alone is not enough: two builds of one version,
  or `fast` and `best` language models, read differently.
- `invoker`: the script, as a `system` actor with its `script_hash`.
- `inputs[]`: a `HashBasis`, hashed the way `test-run.ts#hashBasis` hashes.
- `platform` / `mounts`: the checkout that ran, and its mount lock.

Pure standard library: `pdf-ocr.py` runs where PyMuPDF may not be installed.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
from typing import Any

#: The tag a run-context document carries (`RUN_CONTEXT_SCHEMA_TAG`).
RUN_CONTEXT_SCHEMA_TAG = "folio-run-context/v1"

#: Where a run context is written, beside the output it describes.
RUN_CONTEXT_FILENAME = "run-context.json"

#: `test-run.ts`'s `UNKNOWN_HASH`: a determined value and an absent one differ.
UNKNOWN_HASH = "unknown"

_RELEASE_NAME = re.compile(r"[^a-z0-9._-]+")
_RELEASE_VERSION = re.compile(r"[\s@/]+")


def sha256_file(path: str) -> str | None:
    try:
        h = hashlib.sha256()
        with open(path, "rb") as fh:
            for chunk in iter(lambda: fh.read(1 << 20), b""):
                h.update(chunk)
        return h.hexdigest()
    except OSError:
        return None


def release_ref(name: str, version: str) -> str:
    """`<name>@<version>`, spelled so `ToolReleaseRefSchema` accepts it."""
    n = _RELEASE_NAME.sub("-", name.lower()).strip("-") or "unnamed"
    v = _RELEASE_VERSION.sub("-", version.strip()) or "unknown"
    return f"{n}@{v}"


def provisioned(name: str, version: str, path: str | None) -> dict[str, Any]:
    """A release that ran: its digest is over the file at `path`, as resolved.

    Falls to `could-not-provision` when the bytes cannot be read, because a
    release with no digest is exactly what the schema refuses to call one.
    """
    ref = release_ref(name, version)
    real = os.path.realpath(path) if path else None
    digest = sha256_file(real) if real else None
    if digest is None:
        return could_not_provision(name, version, f"no readable file for {name} ({path or 'not on PATH'})")
    return {"state": "provisioned", "release": ref, "digest": {"algorithm": "sha256", "digest": digest}}


def could_not_provision(name: str, version: str, reason: str) -> dict[str, Any]:
    return {"state": "could-not-provision", "release": release_ref(name, version), "reason": reason}


def hash_basis(root: str, paths: list[str]) -> dict[str, Any]:
    """`test-run.ts#hashBasis`, byte for byte: sorted paths, each `path\\0bytes\\0`."""
    inputs = sorted(paths)
    h = hashlib.sha256()
    for p in inputs:
        try:
            with open(os.path.join(root, p), "rb") as fh:
                data = fh.read()
        except OSError:
            return {"hash": UNKNOWN_HASH, "inputs": inputs}
        h.update(p.encode("utf-8") + b"\0" + data + b"\0")
    return {"hash": h.hexdigest()[:12], "inputs": inputs}


def _git(cwd: str, *args: str) -> str | None:
    try:
        # input-site: head #e148553a — `rev-parse --show-toplevel` / `HEAD` of the checkout the run is in: git's answer, which the cone replays
        r = subprocess.run(["git", "-C", cwd, *args], capture_output=True, text=True, timeout=20)
    except (OSError, subprocess.SubprocessError):
        return None
    return r.stdout.strip() if r.returncode == 0 and r.stdout.strip() else None


def platform_root(*candidates: str) -> tuple[str, str] | None:
    """The first candidate inside a git checkout: (toplevel, HEAD sha)."""
    for c in candidates:
        d = c if os.path.isdir(c) else os.path.dirname(os.path.abspath(c))
        top = _git(d, "rev-parse", "--show-toplevel")
        sha = _git(d, "rev-parse", "HEAD") if top else None
        if top and sha and re.fullmatch(r"[0-9a-f]{40}", sha):
            return top, sha
    return None


def mounts_of(root: str) -> dict[str, Any]:
    """`RunMountsSchema` for the checkout at `root`, from its `index.lock.json`."""
    lock = os.path.join(root, "index.lock.json")
    if not os.path.exists(lock):
        return {"state": "could-not-determine", "reason": f"no index.lock.json at {root}"}
    try:
        doc = json.load(open(lock, encoding="utf-8"))
    except (OSError, ValueError) as e:
        return {"state": "could-not-determine", "reason": f"index.lock.json will not parse: {e}"}
    inst = [
        {"instance": i["instance"], "repository": i["repository"], "sha": i["sha"]}
        for i in doc.get("instances") or []
        if isinstance(i, dict) and {"instance", "repository", "sha"} <= i.keys()
    ]
    if not inst:
        return {"state": "none"}
    return {"state": "locked", "lock": {"file": "index.lock.json", "sha256": sha256_file(lock)}, "instances": inst}


def build(*, invoker_script: str, releases: list[dict[str, Any]], inputs: list[str],
          where: list[str]) -> dict[str, Any] | None:
    """The context, or None when no checkout can be named for `platform`.

    `where` lists paths to look for the checkout in, in order — the output
    root first, so an instance repository records its own commit and its
    mount lock; the script's own checkout otherwise.
    """
    found = platform_root(*where, invoker_script)
    if found is None:
        return None
    root, sha = found
    rel_inputs = [os.path.relpath(os.path.abspath(p), root) for p in inputs]
    script_rel = os.path.relpath(os.path.abspath(invoker_script), root)
    if script_rel.startswith(".."):
        script_rel = os.path.join("scripts", os.path.basename(invoker_script))
    return {
        "$schema": RUN_CONTEXT_SCHEMA_TAG,
        "platform": {"commit": sha},
        "mounts": mounts_of(root),
        "releases": releases,
        "invoker": {"kind": "system", "id": script_rel, "script_hash": sha256_file(invoker_script) or UNKNOWN_HASH},
        "inputs": [hash_basis(root, rel_inputs)] if rel_inputs else [],
    }


def canonical(ctx: dict[str, Any]) -> str:
    """`canonicalRunContext`: key-sorted JSON, no whitespace, non-ASCII kept."""
    return json.dumps(ctx, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def ref(ctx: dict[str, Any]) -> dict[str, str]:
    """`runContextRef`: the `{ sha256 }` a record carries for this context."""
    return {"sha256": hashlib.sha256(canonical(ctx).encode("utf-8")).hexdigest()}


def write(ctx: dict[str, Any], directory: str) -> dict[str, str]:
    """Write `<directory>/run-context.json`; return its reference."""
    os.makedirs(directory, exist_ok=True)
    with open(os.path.join(directory, RUN_CONTEXT_FILENAME), "w", encoding="utf-8") as fh:
        fh.write(json.dumps(ctx, indent=2, ensure_ascii=False) + "\n")
    return ref(ctx)


def read_ref(directory: str) -> dict[str, str] | None:
    """The reference of the context written in `directory`, or None."""
    p = os.path.join(directory, RUN_CONTEXT_FILENAME)
    try:
        return ref(json.load(open(p, encoding="utf-8")))
    except (OSError, ValueError):
        return None
