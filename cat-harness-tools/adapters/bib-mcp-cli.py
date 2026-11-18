#!/usr/bin/env python3
"""bib-mcp-cli.py — local CLI wrapper around paper-search-mcp + alex-mcp.

Runs the scholar/arxiv/openalex bib-audit work as a normal Python CLI,
without needing to start an MCP server. Designed to run from a
normal-network machine when the Claude-Code-on-the-web allowlist (which
blocks arxiv.org / api.openalex.org / scholar.google.com) is the
limiting factor.

Prerequisites:
    uv pip install paper-search-mcp pyalex
  or
    pip install paper-search-mcp pyalex

Quickstart:
    scripts/bib-mcp-cli.py status                # probe network + show counts
    scripts/bib-mcp-cli.py backfill-urls         # dry-run: find arxiv URLs
    scripts/bib-mcp-cli.py backfill-urls --apply
    scripts/bib-mcp-cli.py download --to uploads/
    scripts/bib-mcp-cli.py enrich-doi            # fill metadata via OpenAlex
    scripts/bib-mcp-cli.py snapshot              # plain HTTP "as-viewed-on" pages
    scripts/bib-mcp-cli.py scholar-snapshot      # Google Scholar / Books PDF view
                                                 # via headless Chromium (Playwright)
    scripts/bib-mcp-cli.py audit                 # all of the above (dry-run)

Headless-browser snapshots (scholar-snapshot):
    For book / chapter references that have no arxiv preprint, Google
    Scholar + Google Books often expose 2–3 preview pages of the cited
    work. This subcommand drives a headless Chromium via Playwright to
    capture those pages as a PDF, providing "as-viewed-on" evidence for
    a citation that otherwise can't be verified offline.

    Prerequisites:
        pip install playwright
        playwright install chromium

    Output:
        content/bib-qa-evidence/<refid>/<utc>-gscholar.pdf
        content/bib-qa-evidence/<refid>/<utc>-gscholar.meta.json

All subcommands are idempotent: re-running skips entries already done.
Default is --dry-run; pass --apply to actually write changes.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


def _harness_root():
    """The cat-harness root (scripts/_harness_root.py; bean 70lx)."""
    import importlib.util as _u
    from pathlib import Path as _P
    _s = _u.spec_from_file_location("_harness_root", _P(__file__).resolve().parent.parent / "scripts" / "_harness_root.py")
    _m = _u.module_from_spec(_s); _s.loader.exec_module(_m)  # type: ignore[union-attr]
    return _m.HARNESS_ROOT

REPO = _harness_root()  # bean 70lx: the harness, now a sibling of this layer
REFS_TS = REPO / "content" / "schema" / "references.ts"
BIB_QA_JSON = REPO / "content" / "bib-qa.json"
UPLOADS = REPO / "uploads"
EVIDENCE_DIR = REPO / "content" / "bib-qa-evidence"
LOG_PATH = REPO / "scripts" / ".bib-mcp-cli-log.json"

ARXIV_PAT = re.compile(
    r"arxiv\.org/(?:abs/|pdf/)?([a-z\-]+/\d+|\d{4}\.\d{4,5})(v\d+)?",
    re.I,
)

# ── Network probe ───────────────────────────────────────────────────


def _probe_host(host: str, timeout: float = 5.0) -> tuple[bool, str]:
    """Returns (usable, detail) where usable=True only for 2xx/3xx.

    A 403 with x-deny-reason: host_not_allowed from the Claude-Code-on-
    the-web proxy looks like a normal HTTPError but means the host is
    NOT usable. We surface that explicitly so `status` doesn't mislead.
    """
    try:
        req = urllib.request.Request(f"https://{host}/", method="HEAD")
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return (True, f"HTTP {r.status}")
    except urllib.error.HTTPError as e:
        deny = e.headers.get("x-deny-reason") if e.headers else None
        if deny:
            return (False, f"HTTP {e.code} ({deny})")
        if e.code in (401, 403, 404):
            # Some hosts 401/403/404 on bare HEAD / but are reachable.
            # We treat these as "reachable but not useful for HEAD probe".
            return (True, f"HTTP {e.code} (host responding)")
        return (False, f"HTTP {e.code}")
    except Exception as e:
        return (False, str(e)[:80])


def probe_network() -> dict:
    """Probe the hosts we depend on. Returns {host: (ok, detail)}."""
    hosts = ["arxiv.org", "api.openalex.org", "scholar.google.com",
             "api.crossref.org", "doi.org", "www.numdam.org", "archive.org"]
    return {h: _probe_host(h) for h in hosts}


def require_arxiv() -> None:
    ok, detail = _probe_host("arxiv.org")
    if not ok:
        sys.exit(
            f"ERROR: arxiv.org unreachable ({detail}).\n"
            "This script needs outbound HTTPS to arxiv.org. If you're on a\n"
            "sandboxed Claude-Code-on-the-web session, run this from a\n"
            "normal-network machine instead. Otherwise check your firewall."
        )


def require_openalex() -> None:
    ok, detail = _probe_host("api.openalex.org")
    if not ok:
        sys.exit(
            f"ERROR: api.openalex.org unreachable ({detail}).\n"
            "OpenAlex enrichment needs HTTPS to api.openalex.org."
        )


# ── Bib data loaders ────────────────────────────────────────────────


@dataclass
class BibEntry:
    id: str
    title: str
    url: str
    doi: str
    year: str
    arxiv_id: str | None
    arxiv_ver: str | None


def load_bib_qa() -> list[dict]:
    if not BIB_QA_JSON.exists():
        sys.exit(
            "ERROR: content/bib-qa.json missing. Run\n"
            "    cd content && bun run pipeline/bib-qa.ts\n"
            "first."
        )
    return json.loads(BIB_QA_JSON.read_text())["entries"]


def entry_arxiv(e: dict) -> tuple[str | None, str | None]:
    blob = (e.get("url") or "") + " " + (e.get("doi") or "")
    m = ARXIV_PAT.search(blob)
    return (m.group(1), m.group(2) or "") if m else (None, None)


# ── Subcommand: status ──────────────────────────────────────────────


def cmd_status(args) -> None:
    print("== Network probe ==")
    for host, (ok, detail) in probe_network().items():
        print(f"  {'✓' if ok else '✗'} {host}: {detail}")
    print()
    entries = load_bib_qa()
    no_url, arxiv_no_pdf, doi_only = [], [], []
    for e in entries:
        if not e.get("url") and not e.get("doi"):
            no_url.append(e["id"])
        ax, _ = entry_arxiv(e)
        tags = {t["key"]: t for t in e.get("tags", [])}
        pdf_status = tags.get("has_local_pdf", {}).get("status")
        if ax and pdf_status in ("unchecked", "fail"):
            arxiv_no_pdf.append(e["id"])
        if e.get("doi") and not ax:
            doi_only.append(e["id"])
    print("== Bib state ==")
    print(f"  Total references:            {len(entries)}")
    print(f"  Without URL/DOI:             {len(no_url)}")
    print(f"  arXiv preprints missing PDF: {len(arxiv_no_pdf)}")
    print(f"  DOI-only (OpenAlex candidates): {len(doi_only)}")
    print()
    print(f"  Evidence snapshots in {EVIDENCE_DIR.relative_to(REPO)}: ", end="")
    if EVIDENCE_DIR.exists():
        n = sum(1 for _ in EVIDENCE_DIR.rglob("*.meta.json"))
        print(f"{n}")
    else:
        print("(dir not yet created)")


# ── Subcommand: backfill-urls ───────────────────────────────────────


def cmd_backfill_urls(args) -> None:
    require_arxiv()
    from paper_search_mcp.academic_platforms.arxiv import ArxivSearcher
    s = ArxivSearcher()

    entries = load_bib_qa()
    targets = [e for e in entries if not e.get("url") and not e.get("doi")]
    print(f"Backfill candidates: {len(targets)} (entries with no URL/DOI)")

    proposals = []
    for i, e in enumerate(targets, 1):
        title = e.get("title", "")
        if not title:
            continue
        print(f"[{i:3}/{len(targets)}] {e['id']}: searching '{title[:60]}'")
        try:
            hits = s.search(title, max_results=3)
        except Exception as ex:
            print(f"  ! search failed: {ex}")
            continue
        if not hits:
            print("  (no hits)")
            continue
        # Naive match: take top hit if title overlap > 50%
        top = hits[0]
        overlap = _title_overlap(title, top.title)
        verdict = "PROPOSE" if overlap > 0.5 else "skip"
        print(f"  -> {verdict} ({overlap:.0%} title-overlap): {top.url}")
        if verdict == "PROPOSE":
            proposals.append({
                "id": e["id"], "old_url": None, "new_url": top.url,
                "matched_title": top.title, "overlap": overlap,
            })
        time.sleep(1)  # arxiv rate-limit politeness

    _write_log("backfill-urls", proposals, args.apply)
    if args.apply and proposals:
        _apply_url_patches(proposals)
    else:
        print(f"\nDry-run: {len(proposals)} proposals (re-run with --apply to write).")


def _title_overlap(a: str, b: str) -> float:
    """Word-set overlap on lowercased title."""
    wa = set(re.findall(r"\w{3,}", a.lower()))
    wb = set(re.findall(r"\w{3,}", b.lower()))
    return len(wa & wb) / max(len(wa | wb), 1)


def _apply_url_patches(proposals: list[dict]) -> None:
    """Write proposed URLs into references.ts.

    Naive sed-style: for each ref id, find its ref() block and inject
    `url: "<new>"` before the closing brace if no url field present.
    """
    text = REFS_TS.read_text()
    for p in proposals:
        rid = p["id"]
        # Match `ref({` block whose id is rid; non-trivial regex
        pat = re.compile(
            r'(ref\(\{[^{}]*?"id":\s*"' + re.escape(rid) + r'".*?)(\}\s*\))',
            re.DOTALL,
        )
        m = pat.search(text)
        if not m:
            print(f"  ! cannot locate ref() block for {rid}")
            continue
        if '"url":' in m.group(1):
            print(f"  ! {rid} already has a url field — skip (audit by hand)")
            continue
        text = text.replace(
            m.group(0),
            m.group(1).rstrip().rstrip(",") + f',\n  url: "{p["new_url"]}"\n' + m.group(2),
        )
        print(f"  ✓ patched {rid}")
    REFS_TS.write_text(text)


# ── Subcommand: download ────────────────────────────────────────────


def cmd_download(args) -> None:
    require_arxiv()
    from paper_search_mcp.academic_platforms.arxiv import ArxivSearcher
    s = ArxivSearcher()

    entries = load_bib_qa()
    out = Path(args.to or UPLOADS).resolve()
    out.mkdir(parents=True, exist_ok=True)
    existing = {p.name for p in out.iterdir() if p.is_file()}

    targets = []
    for e in entries:
        ax, ver = entry_arxiv(e)
        if not ax:
            continue
        tags = {t["key"]: t for t in e.get("tags", [])}
        if tags.get("has_local_pdf", {}).get("status") == "pass":
            continue
        targets.append((e["id"], ax, ver))

    print(f"Download candidates: {len(targets)}")
    results = []
    for i, (rid, ax, ver) in enumerate(targets, 1):
        ax_short = ax.split("/")[-1]
        fname = f"{rid}-arxiv-{ax_short}{ver or 'v1'}.pdf"
        # Idempotency: skip if any file starts with refid- in out/
        if any(f.startswith(rid + "-") or f.startswith(rid + ".") or f.startswith(ax_short)
               for f in existing):
            print(f"[{i:3}/{len(targets)}] SKIP {rid} (already have a copy)")
            continue
        print(f"[{i:3}/{len(targets)}] FETCH {rid} -> arXiv:{ax}{ver or ''}")
        if not args.apply:
            results.append({"id": rid, "would_fetch": ax, "to": fname})
            continue
        try:
            s.download_pdf(ax, str(out) + "/")
            # download_pdf names the file as <id>.pdf; rename to refid-arxiv-<id>.pdf
            src = out / f"{ax_short}.pdf"
            if src.exists():
                src.rename(out / fname)
            results.append({"id": rid, "fetched": ax, "path": str(out / fname)})
        except Exception as ex:
            print(f"  ! {ex}")
            results.append({"id": rid, "error": str(ex)})
        time.sleep(4)  # arxiv rate-limit politeness

    _write_log("download", results, args.apply)


# ── Subcommand: enrich-doi ──────────────────────────────────────────


def cmd_enrich_doi(args) -> None:
    require_openalex()
    import pyalex
    pyalex.config.email = "litlfred@ibiblio.org"  # polite-pool

    entries = load_bib_qa()
    targets = [e for e in entries
               if e.get("doi") and entry_arxiv(e)[0] is None]
    print(f"OpenAlex enrichment candidates: {len(targets)} (DOI-only entries)")

    results = []
    for i, e in enumerate(targets, 1):
        doi = e["doi"]
        print(f"[{i:3}/{len(targets)}] {e['id']}: doi={doi}")
        try:
            w = pyalex.Works()[f"doi:{doi}"]
        except Exception as ex:
            print(f"  ! {ex}")
            results.append({"id": e["id"], "error": str(ex)})
            continue
        canonical = {
            "title": w.get("title"),
            "authors": [a["author"]["display_name"]
                        for a in w.get("authorships", [])],
            "year": w.get("publication_year"),
            "venue": (w.get("primary_location") or {}).get("source", {}).get("display_name"),
        }
        results.append({"id": e["id"], "canonical": canonical,
                        "existing": {"title": e.get("title"),
                                     "year": e.get("year")}})
        print(f"  -> title: {canonical['title']}")
        time.sleep(0.2)  # OpenAlex polite pool

    _write_log("enrich-doi", results, args.apply)


# ── Subcommand: snapshot ────────────────────────────────────────────


def cmd_snapshot(args) -> None:
    """Capture an evidence snapshot for each ref with a URL.

    Writes:
      content/bib-qa-evidence/<refid>/<utc-date>-<source>.html
      content/bib-qa-evidence/<refid>/<utc-date>-<source>.meta.json

    The meta.json records: url, as-viewed-on (UTC), HTTP status,
    content-type, sha256 of body. Humans review the .html for
    correctness; .meta.json is the durable provenance record.
    """
    entries = load_bib_qa()
    targets = [e for e in entries if e.get("url")]
    print(f"Snapshot candidates: {len(targets)} (entries with URLs)")

    import hashlib
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")
    results = []
    for i, e in enumerate(targets, 1):
        rid, url = e["id"], e["url"]
        out_dir = EVIDENCE_DIR / rid
        if out_dir.exists() and not args.refresh:
            existing = list(out_dir.glob("*.meta.json"))
            if existing:
                results.append({"id": rid, "skipped_existing": str(existing[0].name)})
                continue
        print(f"[{i:3}/{len(targets)}] {rid}: {url[:70]}")
        if not args.apply:
            results.append({"id": rid, "would_snapshot": url})
            continue
        host = re.match(r"https?://([^/]+)", url).group(1)
        ok, _ = _probe_host(host)
        if not ok:
            print(f"  ! {host} unreachable")
            results.append({"id": rid, "error": "host_unreachable"})
            continue
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "qou-bib-audit/1.0 (litlfred@ibiblio.org)"},
            )
            with urllib.request.urlopen(req, timeout=30) as r:
                body = r.read()
                ctype = r.headers.get("content-type", "")
                status = r.status
        except Exception as ex:
            print(f"  ! {ex}")
            results.append({"id": rid, "error": str(ex)})
            continue
        out_dir.mkdir(parents=True, exist_ok=True)
        ext = "html" if "html" in ctype else "pdf" if "pdf" in ctype else "bin"
        body_path = out_dir / f"{now}-{host}.{ext}"
        meta_path = out_dir / f"{now}-{host}.meta.json"
        body_path.write_bytes(body)
        meta_path.write_text(json.dumps({
            "id": rid,
            "url": url,
            "as_viewed_on": datetime.now(timezone.utc).isoformat(),
            "http_status": status,
            "content_type": ctype,
            "sha256": hashlib.sha256(body).hexdigest(),
            "size_bytes": len(body),
            "captured_by": "scripts/bib-mcp-cli.py snapshot",
        }, indent=2))
        results.append({"id": rid, "snapshot": str(body_path.relative_to(REPO))})
        time.sleep(1)

    _write_log("snapshot", results, args.apply)


# ── Subcommand: scholar-snapshot (headless Chromium) ────────────────


def cmd_scholar_snapshot(args) -> None:
    """Use Playwright (headless Chromium) to capture Google Scholar /
    Google Books preview pages for refs that aren't on arxiv.

    Strategy:
      1. Filter to refs where `type` in {book, chapter} OR no arxiv URL.
      2. Open `scholar.google.com/scholar?q=<title>`; pick the top hit.
      3. If the hit links to books.google.com, navigate to it and
         "Print to PDF" — most book previews allow 1-3 page snippets.
      4. Save the rendered PDF + metadata to
         content/bib-qa-evidence/<refid>/<utc>-gscholar.pdf.

    Notes:
      - Google bot-detects aggressively. Run with --apply slowly
        (default 10 s/req); expect captchas on heavy use.
      - Playwright is an optional dep. The script falls back to a
        helpful error if not installed.
    """
    ok, detail = _probe_host("scholar.google.com")
    if not ok:
        sys.exit(f"ERROR: scholar.google.com unreachable ({detail}).")

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        sys.exit(
            "ERROR: playwright not installed.\n"
            "    pip install playwright\n"
            "    playwright install chromium\n"
        )

    entries = load_bib_qa()
    targets = []
    for e in entries:
        ax, _ = entry_arxiv(e)
        if ax:
            continue  # arxiv refs use the snapshot subcommand instead
        if e.get("type") not in ("book", "chapter", "article-journal",
                                 "article", "paper-conference"):
            continue
        out_dir = EVIDENCE_DIR / e["id"]
        if out_dir.exists() and not args.refresh:
            if list(out_dir.glob("*-gscholar.meta.json")):
                continue
        targets.append(e)
    print(f"Scholar-snapshot candidates: {len(targets)}")

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")
    results = []

    if not args.apply:
        for e in targets[:20]:
            print(f"  would search: {e['id']} -- {e.get('title','')[:60]}")
        if len(targets) > 20:
            print(f"  ... and {len(targets) - 20} more")
        _write_log("scholar-snapshot", [{"id": e["id"]} for e in targets], False)
        return

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(
            user_agent="Mozilla/5.0 (compatible; qou-bib-audit/1.0; +mailto:litlfred@ibiblio.org)",
        )
        for i, e in enumerate(targets, 1):
            rid, title = e["id"], e.get("title", "")
            print(f"[{i:3}/{len(targets)}] {rid}: '{title[:60]}'")
            page = ctx.new_page()
            try:
                q = re.sub(r"\s+", "+", title)
                page.goto(f"https://scholar.google.com/scholar?q={q}",
                          timeout=30000, wait_until="domcontentloaded")
                page.wait_for_timeout(2000)
                if "sorry" in page.url or "captcha" in page.content().lower():
                    print("  ! Google captcha — back off and try later")
                    results.append({"id": rid, "error": "captcha"})
                    break  # don't churn on remaining; will be blocked
                out_dir = EVIDENCE_DIR / rid
                out_dir.mkdir(parents=True, exist_ok=True)
                pdf_path = out_dir / f"{now}-gscholar.pdf"
                page.pdf(path=str(pdf_path), format="A4")
                # Also capture top-hit preview link if any
                preview_links = page.eval_on_selector_all(
                    "a[href*='books.google']",
                    "els => els.map(e => e.href)"
                )
                meta = {
                    "id": rid,
                    "url": page.url,
                    "as_viewed_on": datetime.now(timezone.utc).isoformat(),
                    "search_query": title,
                    "books_google_links": preview_links[:3],
                    "captured_by": "scripts/bib-mcp-cli.py scholar-snapshot",
                    "note": "Page 1 = Scholar search results. Follow books_google_links manually for full preview pages.",
                }
                (out_dir / f"{now}-gscholar.meta.json").write_text(
                    json.dumps(meta, indent=2))
                results.append({"id": rid, "pdf": str(pdf_path.relative_to(REPO)),
                                "preview_links": len(preview_links)})
            except Exception as ex:
                print(f"  ! {ex}")
                results.append({"id": rid, "error": str(ex)})
            finally:
                page.close()
            time.sleep(args.delay)
        browser.close()

    _write_log("scholar-snapshot", results, True)


# ── Subcommand: audit (dry-run umbrella) ────────────────────────────


def cmd_audit(args) -> None:
    """Run every subcommand in dry-run mode."""
    print("\n=== status ===")
    cmd_status(args)
    args.apply = False
    for fn, name in [(cmd_backfill_urls, "backfill-urls"),
                     (cmd_enrich_doi, "enrich-doi"),
                     (cmd_snapshot, "snapshot"),
                     (cmd_scholar_snapshot, "scholar-snapshot")]:
        print(f"\n=== {name} (dry-run) ===")
        try:
            fn(args)
        except SystemExit as ex:
            print(f"  (skipped: {ex})")


# ── Logging ─────────────────────────────────────────────────────────


def _write_log(cmd: str, payload: list, applied: bool) -> None:
    log = []
    if LOG_PATH.exists():
        log = json.loads(LOG_PATH.read_text())
    log.append({
        "command": cmd,
        "at": datetime.now(timezone.utc).isoformat(),
        "applied": applied,
        "count": len(payload),
        "entries": payload,
    })
    LOG_PATH.write_text(json.dumps(log, indent=2))


# ── argparse wiring ─────────────────────────────────────────────────


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = p.add_subparsers(dest="cmd", required=True)

    sp.add_parser("status", help="probe network + summarize bib state")

    sp_bu = sp.add_parser("backfill-urls",
                          help="find arxiv URLs for entries lacking them")
    sp_bu.add_argument("--apply", action="store_true",
                       help="write proposed URLs back to references.ts")

    sp_dl = sp.add_parser("download", help="fetch missing arxiv PDFs to uploads/")
    sp_dl.add_argument("--to", help="output directory (default: uploads/)")
    sp_dl.add_argument("--apply", action="store_true")

    sp_ed = sp.add_parser("enrich-doi",
                          help="fetch canonical metadata from OpenAlex")
    sp_ed.add_argument("--apply", action="store_true")

    sp_sn = sp.add_parser("snapshot",
                          help="capture 'as-viewed-on' evidence pages")
    sp_sn.add_argument("--apply", action="store_true")
    sp_sn.add_argument("--refresh", action="store_true",
                       help="overwrite existing snapshots")

    sp_ss = sp.add_parser("scholar-snapshot",
                          help="headless-browser Google Scholar / Books PDF view")
    sp_ss.add_argument("--apply", action="store_true")
    sp_ss.add_argument("--refresh", action="store_true",
                       help="overwrite existing snapshots")
    sp_ss.add_argument("--delay", type=float, default=10.0,
                       help="seconds between requests (default 10; Google rate-limits)")

    sp_au = sp.add_parser("audit",
                          help="run every subcommand in dry-run mode")
    sp_au.add_argument("--refresh", action="store_true", default=False)
    sp_au.add_argument("--delay", type=float, default=10.0)

    args = p.parse_args()
    if not hasattr(args, "apply"):
        args.apply = False
    if not hasattr(args, "delay"):
        args.delay = 10.0
    if not hasattr(args, "refresh"):
        args.refresh = False

    {
        "status": cmd_status,
        "backfill-urls": cmd_backfill_urls,
        "download": cmd_download,
        "enrich-doi": cmd_enrich_doi,
        "snapshot": cmd_snapshot,
        "scholar-snapshot": cmd_scholar_snapshot,
        "audit": cmd_audit,
    }[args.cmd](args)


if __name__ == "__main__":
    main()
