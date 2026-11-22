#!/usr/bin/env python3
"""Retire a processed library PDF: remove the bytes, keep the derived graph.

Owner, 2026-10-10: *"once .pdfs are processed, take them off of github repo.
make sure KG asset points back to PDF and keeps the deriver KGs"*.

For each library entry it is given, the PDF named in `structure.json`
(`source.file`) is removed only when ALL of these hold:

  - the entry is processed: `structure.json` exists and `sections/` holds at
    least one `.md` file, so what the PDF was read for is already here;
  - the file's sha256 equals `source.sha256`, so the record about to say
    "these bytes" names the bytes actually being removed;
  - there is a place to point at: an arXiv id (always), a DOI (with
    `--allow-doi`), or only the fsh-guts copy (`--allow-history`).

In the PDF's place it writes `source.materialization.json`, a
`folio-materialization/v1` record in state `referenced`:

  - `fixity` is the sha256 of the removed file, so any later copy can be
    checked against it;
  - `provenance.upstream` is where a reader gets the paper: the arXiv PDF of
    the SAME VERSION, or the DOI. arXiv may rebuild a version's PDF from its
    source, so a re-download is the same paper but not promised to be the
    same bytes — `upstreamFixity` says so rather than implying a match;
  - `provenance.retiredCopy` is the GitHub URL of the copy kept on the
    deprecation branch `cat/cat-harness/fsh-guts`, under
    `fsh-guts/retired-pdfs/<path on main>`, pinned to that branch's commit.
    Owner, 2026-10-10: retired PDFs go to fsh-guts with a QA report, and the
    record points there rather than at a commit of main. It is written only
    when the copy's git blob equals the file's own, so it is the exact bytes
    `fixity` names.

`gen-library-jsonld.ts` reads that record into the entry's manifest. Nothing
derived is touched: `structure.json`, `sections/`, `blocks/`, `candidates.json`,
`summary.json`, `source/` and `manifest.jsonld` all stay.

Dry run by default; `--apply` writes the records and removes the files (with
`git rm` when the file is tracked). Prints one JSON report with `--json`.
"""
from __future__ import annotations

import argparse
import datetime as _dt
import hashlib
import json
import subprocess
from pathlib import Path

SCHEMA = "folio-materialization/v1"
RECORD = "source.materialization.json"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def git(cwd: Path, *args: str) -> str | None:
    r = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True)
    return r.stdout.strip() if r.returncode == 0 else None


def github_base(remote: str | None) -> str | None:
    """`https://github.com/<owner>/<repo>` from an origin URL, or None."""
    if not remote:
        return None
    r = remote.removesuffix(".git")
    for prefix in ("git@github.com:", "ssh://git@github.com/", "https://github.com/", "http://github.com/"):
        if r.startswith(prefix):
            return "https://github.com/" + r[len(prefix):]
    # A proxied remote (`http://…/git/<owner>/<repo>`) still ends in owner/repo.
    if "/git/" in r:
        return "https://github.com/" + r.split("/git/", 1)[1]
    return None


def arxiv_url(meta: dict) -> str | None:
    a = meta.get("arxiv")
    if isinstance(a, dict) and a.get("id"):
        v = f"v{a['version']}" if a.get("version") else ""
        return f"https://arxiv.org/pdf/{a['id']}{v}"
    if isinstance(a, str) and a:
        return f"https://arxiv.org/pdf/{a}"
    return None


DEFAULT_COPY_REF = "cat/cat-harness/fsh-guts"
DEFAULT_COPY_PREFIX = "fsh-guts/retired-pdfs"


def resolve_copy_ref(repo_root: Path, name: str) -> str | None:
    """The commit of the copy branch: the remote-tracking ref first, then a local one."""
    for ref in (f"refs/remotes/origin/{name}", f"refs/heads/{name}", name):
        sha = git(repo_root, "rev-parse", "--verify", "-q", f"{ref}^{{commit}}")
        if sha:
            return sha
    return None


def plan(entry: Path, *, allow_doi: bool, allow_history: bool, repo_url: str | None, copy_commit: str | None,
         copy_ref: str, copy_prefix: str, repo_root: Path | None) -> dict:
    out: dict = {"entry": entry.name}
    try:
        s = json.loads((entry / "structure.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        return {**out, "result": "skipped", "reason": f"structure.json unreadable: {e}"}
    src = s.get("source") or {}
    name, want = src.get("file"), src.get("sha256")
    if not name or not want:
        return {**out, "result": "skipped", "reason": "structure.json names no source file and sha256"}
    if (entry / RECORD).exists() and not (entry / name).exists():
        return {**out, "result": "already-retired"}
    pdf = entry / name
    if not pdf.is_file():
        return {**out, "result": "skipped", "reason": f"{name} is not here, and no {RECORD} says why"}
    if not any((entry / "sections").glob("*.md")):
        return {**out, "result": "skipped", "reason": "not processed: sections/ holds no section text"}
    got = sha256(pdf)
    if got != want:
        return {**out, "result": "refused", "reason": f"sha256 {got[:12]}… is not the recorded {want[:12]}…; re-ingest first"}

    meta = s.get("metadata") or {}
    upstream, kind = arxiv_url(meta), "arxiv"
    if not upstream and allow_doi and meta.get("doi"):
        upstream, kind = f"https://doi.org/{meta['doi']}", "doi"
    retired_copy = None
    if repo_url and copy_commit and repo_root:
        rel = pdf.resolve().relative_to(repo_root.resolve()).as_posix()
        kept = f"{copy_prefix.strip('/')}/{rel}"
        held = git(repo_root, "rev-parse", "--verify", "-q", f"{copy_commit}:{kept}")
        if held and held == git(repo_root, "hash-object", str(pdf.resolve())):
            retired_copy = {"url": f"{repo_url}/blob/{copy_commit}/{kept}", "path": kept,
                            "ref": copy_ref, "commit": copy_commit}
    if not upstream and not (allow_history and retired_copy):
        why = "no arXiv id" + ("" if allow_doi else " (DOI not allowed)") + ("" if allow_history else "; history-only not allowed")
        return {**out, "result": "skipped", "reason": why}

    provenance: dict = {}
    if upstream:
        provenance["upstream"] = upstream
        provenance["upstreamKind"] = kind
        provenance["upstreamFixity"] = (
            "same arXiv version; arXiv may rebuild a version's PDF, so its bytes are not promised to match `fixity`"
            if kind == "arxiv" else "the publisher's copy; not checked against `fixity`")
    if retired_copy:
        provenance["retiredCopy"] = retired_copy
    record = {
        "$schema": SCHEMA,
        "state": "referenced",
        "file": name,
        "bytes": pdf.stat().st_size,
        "fixity": {"algorithm": "sha256", "digest": got, "verifiedAt": _dt.date.today().isoformat()},
        "provenance": provenance,
        "note": "The PDF was removed after processing; everything derived from it stays in this entry.",
        "written_by": "retire-library-pdf.py",
    }
    return {**out, "result": "retire", "pdf": name, "record": record, "tracked": bool(
        repo_root and git(repo_root, "ls-files", "--error-unmatch", str(pdf.resolve())) is not None)}


def apply(entry: Path, p: dict, repo_root: Path | None) -> None:
    (entry / RECORD).write_text(json.dumps(p["record"], indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    pdf = entry / p["pdf"]
    if p["tracked"] and repo_root:
        subprocess.run(["git", "rm", "-q", "--", str(pdf.resolve())], cwd=repo_root, check=True)
    else:
        pdf.unlink()


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("entries", nargs="*", type=Path, help="library entry directories")
    ap.add_argument("--library", type=Path, help="every entry directory under this library root")
    ap.add_argument("--allow-doi", action="store_true", help="retire an entry whose only public locator is a DOI")
    ap.add_argument("--allow-history", action="store_true",
                    help="retire an entry with no public locator, pointing only at its fsh-guts copy")
    ap.add_argument("--copy-ref", default=DEFAULT_COPY_REF,
                    help=f"the branch that keeps the retired copies (default: {DEFAULT_COPY_REF})")
    ap.add_argument("--copy-prefix", default=DEFAULT_COPY_PREFIX,
                    help=f"where on that branch a file's path on main is kept (default: {DEFAULT_COPY_PREFIX})")
    ap.add_argument("--repo-url", help="https://github.com/<owner>/<repo> (default: from origin)")
    ap.add_argument("--apply", action="store_true", help="write records and remove files (default: dry run)")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args(argv)

    entries = list(a.entries)
    if a.library:
        entries += sorted(d for d in a.library.iterdir() if d.is_dir() and (d / "structure.json").exists())
    if not entries:
        ap.error("give entry directories or --library")
    top = git(entries[0], "rev-parse", "--show-toplevel")
    repo_root = Path(top) if top else None
    copy_commit = resolve_copy_ref(repo_root, a.copy_ref) if repo_root else None
    repo_url = a.repo_url or (github_base(git(repo_root, "remote", "get-url", "origin")) if repo_root else None)

    report = []
    for e in entries:
        p = plan(e, allow_doi=a.allow_doi, allow_history=a.allow_history,
                 repo_url=repo_url, copy_commit=copy_commit, copy_ref=a.copy_ref,
                 copy_prefix=a.copy_prefix, repo_root=repo_root)
        if p["result"] == "retire" and a.apply:
            apply(e, p, repo_root)
            p["result"] = "retired"
        report.append({k: v for k, v in p.items() if k not in ("record", "tracked")}
                      | ({"upstream": p["record"]["provenance"].get("upstream")} if "record" in p else {}))
    counts: dict[str, int] = {}
    for r in report:
        counts[r["result"]] = counts.get(r["result"], 0) + 1
    if a.json:
        print(json.dumps({"apply": a.apply, "copy_ref": a.copy_ref, "copy_commit": copy_commit, "counts": counts, "entries": report}, indent=2))
    else:
        for r in report:
            print(f"{r['result']:15} {r['entry']}  {r.get('reason') or r.get('upstream') or ''}")
        print(("applied: " if a.apply else "dry run: ") + ", ".join(f"{k} {v}" for k, v in sorted(counts.items())))
    return 1 if counts.get("refused") else 0


if __name__ == "__main__":
    raise SystemExit(main())
