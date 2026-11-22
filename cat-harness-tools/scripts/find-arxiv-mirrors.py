#!/usr/bin/env python3
"""find-arxiv-mirrors.py — deeper-search for arxiv mirrors of QOU
references that don't currently have a publicly-accessible URL.

Workflow:
  1. Scan content/schema/references.ts for entries without an
     arxiv URL.
  2. For each, query arxiv's search API
     (export.arxiv.org/api/query) with author family + year + first
     few title words.
  3. If a high-confidence match is found, suggest adding
     `URL: https://arxiv.org/abs/<id>` to the entry.
  4. Emit a markdown report at docs/coordination/<date>-arxiv-
     mirror-search.md.

Network requirement: outbound HTTPS to export.arxiv.org. Sandboxed
environments without that egress (e.g. Claude Code on the web with
whitelist-only policy) cannot run this — runs cleanly from a
normal-network machine.

Output:
  - stdout: per-ref summary
  - docs/coordination/<date>-arxiv-mirror-search.md: markdown
    report with proposed URL additions

Usage:
  python3 scripts/find-arxiv-mirrors.py             # all DOI-only refs
  python3 scripts/find-arxiv-mirrors.py --min-cites 5  # only refs cited ≥5 times
  python3 scripts/find-arxiv-mirrors.py --limit 20  # smoke-test on first 20
"""

import argparse
import re
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone


def _harness_root():
    """The cat-harness root (scripts/_harness_root.py; bean 70lx)."""
    import importlib.util as _u
    from pathlib import Path as _P
    _s = _u.spec_from_file_location("_harness_root", _P(__file__).resolve().parent / "_harness_root.py")
    _m = _u.module_from_spec(_s); _s.loader.exec_module(_m)  # type: ignore[union-attr]
    return _m.HARNESS_ROOT

REPO_ROOT = _harness_root()  # bean 70lx: the harness, now a sibling of this layer
REFS_TS = REPO_ROOT / "content" / "schema" / "references.ts"
ARXIV_API = "https://export.arxiv.org/api/query"  # HTTPS per arxiv recommendation (Gemini #820)
ARXIV_NS = {"a": "http://www.w3.org/2005/Atom",
            "arxiv": "http://arxiv.org/schemas/atom"}

UA = "qou-find-arxiv-mirrors/1.0 (+https://github.com/litlfred/qou)"


def parse_refs() -> list[dict]:
    """Parse the ref({...}) blocks in references.ts. Returns list
    of dicts with id, title, authors (list of family names), year,
    URL, DOI."""
    text = REFS_TS.read_text()
    entries: list[dict] = []
    for m in re.finditer(r"ref\(\{(.+?)\}\),", text, re.DOTALL):
        body = m.group(1)

        def field(name: str) -> str | None:
            # Accept double-quote, single-quote, or backtick string
            # delimiters (TypeScript allows all three); handle escaped
            # quote of the same kind via [^…]*? (Gemini #820 — references.ts
            # entries are double-quoted in practice but the parser
            # shouldn't assume).
            for q in ('"', "'", '`'):
                r = re.search(rf'{name}:\s*{q}((?:[^{q}\\]|\\.)*){q}', body)
                if r:
                    # Unescape \\ and \q sequences
                    return r.group(1).replace(f'\\{q}', q).replace('\\\\', '\\')
            return None

        eid = field("id")
        if not eid:
            continue

        # author family names — same quote-flexibility as field()
        families: list[str] = []
        for q in ('"', "'", '`'):
            for am in re.finditer(rf'family:\s*{q}((?:[^{q}\\]|\\.)*){q}', body):
                families.append(am.group(1).replace(f'\\{q}', q).replace('\\\\', '\\'))

        year_m = re.search(r'issued.*?\[\[(\d{4})', body, re.DOTALL)
        year = int(year_m.group(1)) if year_m else None

        entries.append({
            "id": eid,
            "title": field("title"),
            "authors": families,
            "year": year,
            "URL": field("URL"),
            "DOI": field("DOI"),
        })
    return entries


def count_citations(eid: str) -> int:
    """Count citation sites in content/ for a given ref id."""
    import subprocess
    lean = subprocess.run(
        ["grep", "-rl", f"-- Ref: [{eid}]", "content/", "--include=*.lean"],
        capture_output=True, text=True
    )
    md = subprocess.run(
        ["grep", "-rl", rf"\\cite{{{eid}}}", "content/", "--include=*.md"],
        capture_output=True, text=True
    )
    return len([l for l in lean.stdout.splitlines() if l]) + \
           len([l for l in md.stdout.splitlines() if l])


def needs_arxiv_search(e: dict) -> bool:
    """Skip entries already on arxiv."""
    if not e["URL"] and not e["DOI"]:
        return False  # nothing to search
    if e["URL"] and "arxiv.org" in e["URL"]:
        return False  # already arxiv
    return True


def arxiv_search(query: str, max_results: int = 3, retries: int = 3) -> list[dict]:
    """Hit arxiv API with a query; return up to max_results matches.
    Retries on timeout with exponential backoff."""
    params = urllib.parse.urlencode({
        "search_query": query,
        "max_results": max_results,
        "sortBy": "relevance",
        "sortOrder": "descending",
    })
    url = f"{ARXIV_API}?{params}"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                body = resp.read().decode("utf-8")
            break
        except Exception as ex:
            last_err = ex
            wait = 2 ** attempt  # 1, 2, 4
            time.sleep(wait)
    else:
        raise last_err if last_err else Exception("unknown arxiv error")
    root = ET.fromstring(body)
    out = []
    for entry in root.findall("a:entry", ARXIV_NS):
        title_el = entry.find("a:title", ARXIV_NS)
        id_el = entry.find("a:id", ARXIV_NS)
        if title_el is None or id_el is None or not id_el.text:
            continue
        # arxiv id is the last path segment of the entry id URL
        arxiv_id = id_el.text.rsplit("/", 1)[-1]
        if arxiv_id.endswith("v1") or arxiv_id.endswith("v2") or \
           arxiv_id.endswith("v3") or arxiv_id.endswith("v4"):
            arxiv_id = arxiv_id.rsplit("v", 1)[0]
        out.append({
            "arxiv_id": arxiv_id,
            "title": " ".join(title_el.text.split()),
        })
    return out


def build_query(e: dict) -> str | None:
    """Build an arxiv search query from author + year + title."""
    if not e["title"]:
        return None
    title_words = re.findall(r"\b[a-zA-Z]{4,}\b", e["title"].lower())
    title_words = [w for w in title_words
                   if w not in {"introduction", "theory", "study", "groups",
                                "general", "geometric", "applications",
                                "algebraic", "with"}][:3]
    parts: list[str] = []
    if e["authors"]:
        parts.append(f'au:{e["authors"][0]}')
    if title_words:
        parts.append("ti:" + " AND ti:".join(title_words))
    if e["year"]:
        # arxiv has no year filter; will rank by relevance
        pass
    return " AND ".join(parts) if parts else None


def title_similarity(a: str, b: str) -> float:
    """Cheap title similarity: Jaccard of word sets (≥4 chars)."""
    wa = set(re.findall(r"\b[a-zA-Z]{4,}\b", a.lower()))
    wb = set(re.findall(r"\b[a-zA-Z]{4,}\b", b.lower()))
    if not wa or not wb:
        return 0.0
    return len(wa & wb) / len(wa | wb)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--min-cites", type=int, default=0,
                    help="Only search refs cited ≥ N times")
    ap.add_argument("--limit", type=int, default=None,
                    help="Stop after N searches (testing)")
    ap.add_argument("--threshold", type=float, default=0.5,
                    help="Title-similarity threshold for high-confidence match")
    args = ap.parse_args()

    entries = parse_refs()
    candidates = [e for e in entries if needs_arxiv_search(e)]
    print(f"Total refs: {len(entries)}")
    print(f"Need arxiv search: {len(candidates)}")

    # Filter by citation count
    if args.min_cites > 0:
        candidates = [e for e in candidates if count_citations(e["id"]) >= args.min_cites]
        print(f"After --min-cites {args.min_cites}: {len(candidates)}")

    if args.limit:
        candidates = candidates[:args.limit]
        print(f"Limited to first {args.limit}")

    found: list[dict] = []
    not_found: list[dict] = []

    # Resume support: skip ids that already appear in a prior report
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    report = REPO_ROOT / "docs" / "coordination" / f"{today}-arxiv-mirror-search.md"
    already_seen: set[str] = set()
    if report.exists():
        prior = report.read_text()
        already_seen = set(re.findall(r"`([\w\d_.-]+)`(?:.+arxiv\.org/abs)", prior))
        print(f"  resuming: {len(already_seen)} ids already in prior report")

    def write_report() -> None:
        report.parent.mkdir(parents=True, exist_ok=True)
        lines = [f"# arxiv mirror search — {today}", "",
                 f"Total refs scanned: {len(candidates)}",
                 f"High-confidence matches (sim ≥ {args.threshold}): {len(found)}",
                 f"No match: {len(not_found)}", ""]
        if found:
            lines.append("## Suggested arxiv URLs to add")
            lines.append("")
            lines.append("| ref id | arxiv id | similarity | arxiv title |")
            lines.append("|--------|----------|-----------:|-------------|")
            for f in sorted(found, key=lambda x: -x["similarity"]):
                lines.append(
                    f"| `{f['id']}` | [`{f['arxiv_id']}`](https://arxiv.org/abs/{f['arxiv_id']}) "
                    f"| {f['similarity']:.2f} | {f['arxiv_title'][:80]} |"
                )
            lines.append("")
            lines.append("To apply: add `URL: \"https://arxiv.org/abs/<id>\"` to each "
                         "ref's entry in `content/schema/references.ts`, then re-run "
                         "`scripts/upload-bib-papers.sh` to fetch the PDFs.")
        if not_found:
            lines.append("")
            lines.append("## No-match (or low similarity)")
            lines.append("")
            for nf in not_found[:50]:
                lines.append(f"- `{nf['id']}`")
            if len(not_found) > 50:
                lines.append(f"- … ({len(not_found) - 50} more)")
        report.write_text("\n".join(lines) + "\n")

    for i, e in enumerate(candidates, 1):
        if e["id"] in already_seen:
            print(f"  [{i}/{len(candidates)}] {e['id']}: (skipped — already in report)")
            continue
        query = build_query(e)
        if not query:
            not_found.append({"id": e["id"], "reason": "no query buildable"})
            continue
        try:
            results = arxiv_search(query)
        except Exception as ex:
            print(f"  [{i}/{len(candidates)}] {e['id']}: arxiv-error: {ex}")
            not_found.append({"id": e["id"], "reason": f"arxiv-error: {ex}"})
            time.sleep(1)
            continue

        best = None
        best_sim = 0.0
        for r in results:
            sim = title_similarity(e["title"] or "", r["title"])
            if sim > best_sim:
                best_sim, best = sim, r

        if best and best_sim >= args.threshold:
            print(f"  [{i}/{len(candidates)}] {e['id']}: ✓ arxiv:{best['arxiv_id']} (sim={best_sim:.2f})")
            found.append({
                "id": e["id"], "title": e["title"],
                "arxiv_id": best["arxiv_id"],
                "arxiv_title": best["title"],
                "similarity": best_sim,
            })
        else:
            best_str = f"best={best['arxiv_id']} sim={best_sim:.2f}" if best else "no results"
            print(f"  [{i}/{len(candidates)}] {e['id']}: ✗ ({best_str})")
            not_found.append({"id": e["id"], "best": best, "best_sim": best_sim})

        # arxiv rate-limit politeness: 1 req/3s
        time.sleep(3)

        # Save report every 10 searches so a timeout-kill doesn't lose progress
        if i % 10 == 0:
            write_report()

    # Emit final markdown report
    write_report()
    print(f"\nReport: {report.relative_to(REPO_ROOT)}")
    print(f"Found {len(found)} high-confidence arxiv matches")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
