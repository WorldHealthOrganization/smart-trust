#!/usr/bin/env python3
"""volume-separation.py — propose where each article in a volume scan starts and ends.

A journal volume or a proceedings issue scanned as one PDF holds many works.
They are cut apart by hand today (qou `c61cfb205d`: four *Invent. Math.* 106
articles cut out of a GDZ volume). This arm PROPOSES the cut. It never
decides, the same rule `pdf-structure.py` applies to an inferred contents
list (cat-harness-tools#132).

## Method — majority vote over voters, read as data

Pluzhnikov et al. (arXiv:2604.00554v1) separate printed zbMATH reviews by
running several generative models over the OCR text and taking a majority
vote on where each document starts and ends. This script runs no model, so
CI stays model-free. The voters' answers are DATA:

1. `queue ENTRY --out FILE` writes the page texts of a page-granularity entry
   (`separation-queue/v1`), the prompt material each voter reads.
2. Each voter, run offline, answers with a list of spans
   `{start, end, title}` (1-based, inclusive pages). The answers are kept in
   `separation-votes/v1`: `{"voters": [{"id", "model", "spans": [...]}]}`.
3. `propose ENTRY --votes FILE` writes `<entry>/separation-proposal.json`
   (`separation-proposal/v1`):
   - a start page is agreed when MORE THAN HALF of the voters start a span
     there;
   - its end page is agreed when more than half of ALL voters give that same
     end for that start;
   - its title is agreed when more than half of the voters who start there
     give the same title (compared case- and space-insensitively), and is
     `null` otherwise, with every answer listed;
   - a start or an end without a majority, or an agreed span that runs into
     the next agreed start, is `undetermined` with every voter's answer.
     Nothing undetermined is cut.

   The proposal is `state: "proposed"`. A person confirms a span before it
   becomes an entry: through the normal rung, one entry per article, linked
   back to the volume with `container` / `container_children`. That step is
   not in this script.

## Acceptance before use

`score ENTRY --truth FILE` compares the proposal with a hand cut
(`{"spans": [{start, end}]}`), the GDZ volume being the first ground truth:
start and end precision and recall, and exact-span matches. Run it on a
volume with a known cut before trusting the arm on a new one.

Usage:
  python3 scripts/volume-separation.py queue library/<volume> --out build/separation/<volume>.queue.json
  python3 scripts/volume-separation.py propose library/<volume> --votes build/separation/<volume>.votes.json
  python3 scripts/volume-separation.py score library/<volume> --truth hand-cut.json

Exit: 0 done, 1 the input was refused, 2 usage.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _benchmark_guard import assert_not_declared_graph_path

QUEUE_SCHEMA = "separation-queue/v1"
VOTES_SCHEMA = "separation-votes/v1"
PROPOSAL_SCHEMA = "separation-proposal/v1"
PROPOSAL_FILE = "separation-proposal.json"
METHOD = "volume-separation.py majority vote (arXiv:2604.00554v1)"
PAGE_TEXT_CHARS = 1500


class Refused(Exception):
    pass


def read_json(path: str) -> dict:
    try:
        with open(path, encoding="utf-8") as fh:
            doc = json.load(fh)
    except (OSError, json.JSONDecodeError) as exc:
        raise Refused(f"{path}: {exc}") from exc
    if not isinstance(doc, dict):
        raise Refused(f"{path}: expected a JSON object")
    return doc


def strip_frontmatter(text: str) -> str:
    if text.startswith("---\n"):
        end = text.find("\n---", 4)
        if end >= 0:
            return text[end + 4 :].lstrip("\n")
    return text


def page_texts(entry: str) -> list[dict]:
    """[{page, text}] for a page-granularity entry, in page order."""
    structure = read_json(os.path.join(entry, "structure.json"))
    if structure.get("granularity") != "page":
        raise Refused(f"{entry}: granularity is {structure.get('granularity')!r}, not 'page'. A volume is separated page by page")
    pages = []
    for s in structure.get("sections", []):
        page = s.get("page_start")
        path = os.path.join(entry, "sections", f"{s['id']}.md")
        if not isinstance(page, int) or not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as fh:
            pages.append({"page": page, "text": strip_frontmatter(fh.read())[:PAGE_TEXT_CHARS]})
    if not pages:
        raise Refused(f"{entry}: no page sections to read")
    return sorted(pages, key=lambda p: p["page"])


def norm_title(t: object) -> str:
    return re.sub(r"\s+", " ", str(t or "")).strip().lower()


def read_votes(path: str, n_pages: int) -> list[dict]:
    doc = read_json(path)
    if doc.get("$schema") != VOTES_SCHEMA:
        raise Refused(f"{path}: expected $schema {VOTES_SCHEMA!r}, got {doc.get('$schema')!r}")
    voters = doc.get("voters", [])
    if len(voters) < 3:
        raise Refused(f"{path}: {len(voters)} voter(s). A majority vote needs at least three")
    seen = set()
    for i, v in enumerate(voters):
        if not v.get("id") or not v.get("model"):
            raise Refused(f"{path}: voters[{i}] must name its id and the model that answered")
        if v["id"] in seen:
            raise Refused(f"{path}: voter id {v['id']!r} appears twice")
        seen.add(v["id"])
        for j, sp in enumerate(v.get("spans", [])):
            s, e = sp.get("start"), sp.get("end")
            if not (isinstance(s, int) and isinstance(e, int) and 1 <= s <= e <= n_pages):
                raise Refused(f"{path}: voters[{i}].spans[{j}] is not 1 <= start <= end <= {n_pages}")
    return voters


def propose(voters: list[dict]) -> dict:
    """The majority-vote proposal. Pure: no disk."""
    n = len(voters)
    need = n // 2 + 1
    by_voter = [{sp["start"]: sp for sp in v.get("spans", [])} for v in voters]
    starts = Counter(s for spans in by_voter for s in spans)
    agreed, undetermined = [], []
    for start in sorted(starts):
        answers = [{"voter": v["id"], **({"end": b[start]["end"], "title": b[start].get("title")} if start in b else {"starts_here": False})}
                   for v, b in zip(voters, by_voter)]
        if starts[start] < need:
            undetermined.append({"start": start, "why": f"{starts[start]} of {n} voters start a span here; {need} needed", "answers": answers})
            continue
        ends = Counter(b[start]["end"] for b in by_voter if start in b)
        end, end_votes = ends.most_common(1)[0]
        if end_votes < need or list(ends.values()).count(end_votes) > 1:
            undetermined.append({"start": start, "why": f"no end page has {need} of {n} votes: {dict(sorted(ends.items()))}", "answers": answers})
            continue
        titles = Counter(norm_title(b[start].get("title")) for b in by_voter if start in b and norm_title(b[start].get("title")))
        best = titles.most_common(1)[0] if titles else None
        title = None
        if best and best[1] * 2 > starts[start]:
            title = next(b[start]["title"].strip() for b in by_voter if start in b and norm_title(b[start].get("title")) == best[0])
        agreed.append({
            "start": start, "end": end, "title": title,
            "votes": {"start": starts[start], "end": end_votes, "title": best[1] if title else 0, "of": n},
            **({} if title else {"titles": sorted({b[start].get("title") for b in by_voter if start in b and b[start].get("title")})}),
        })
    spans = []
    for i, sp in enumerate(agreed):
        nxt = agreed[i + 1]["start"] if i + 1 < len(agreed) else None
        if nxt is not None and sp["end"] >= nxt:
            undetermined.append({"start": sp["start"], "why": f"the agreed end {sp['end']} runs into the next agreed start {nxt}", "answers": []})
        else:
            spans.append({**sp, "state": "proposed"})
    return {
        "voters": [{"id": v["id"], "model": v["model"]} for v in voters],
        "rule": f"majority: more than half of {n} voters ({need})",
        "spans": spans,
        "undetermined": sorted(undetermined, key=lambda u: u["start"]),
    }


def score(proposal: dict, truth: dict) -> dict:
    """The proposal against a hand cut: boundary precision and recall, exact spans."""
    got = [(s["start"], s["end"]) for s in proposal.get("spans", [])]
    want = [(s["start"], s["end"]) for s in truth.get("spans", [])]
    if not want:
        raise Refused("the truth file holds no spans")

    def pr(a: set, b: set) -> dict:
        tp = len(a & b)
        return {"precision": round(tp / len(a), 3) if a else None, "recall": round(tp / len(b), 3)}

    return {
        "truth_spans": len(want), "proposed_spans": len(got),
        "starts": pr({s for s, _ in got}, {s for s, _ in want}),
        "ends": pr({e for _, e in got}, {e for _, e in want}),
        "exact_spans": len(set(got) & set(want)),
        "undetermined": len(proposal.get("undetermined", [])),
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="propose article boundaries in a volume scan by majority vote")
    sub = ap.add_subparsers(dest="cmd", required=True)
    q = sub.add_parser("queue", help="write the page texts voters read")
    q.add_argument("entry")
    q.add_argument("--out", required=True)
    p = sub.add_parser("propose", help="write <entry>/separation-proposal.json from the votes")
    p.add_argument("entry")
    p.add_argument("--votes", required=True)
    p.add_argument("--stdout", action="store_true", help="print the proposal instead of writing it")
    s = sub.add_parser("score", help="compare the proposal with a hand cut")
    s.add_argument("entry")
    s.add_argument("--truth", required=True)
    args = ap.parse_args(argv)
    entry = args.entry.rstrip("/")
    try:
        if args.cmd == "queue":
            assert_not_declared_graph_path(args.out, os.getcwd())
            pages = page_texts(entry)
            os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
            with open(args.out, "w", encoding="utf-8") as fh:
                json.dump({"$schema": QUEUE_SCHEMA, "entry": os.path.basename(entry), "pages": pages,
                           "answer_with": {"$schema": VOTES_SCHEMA, "span": {"start": "int", "end": "int", "title": "str"}}},
                          fh, indent=1, ensure_ascii=False)
            print(f"queue: {len(pages)} page(s) -> {args.out}", file=sys.stderr)
        elif args.cmd == "propose":
            n_pages = max(pg["page"] for pg in page_texts(entry))
            out = {"$schema": PROPOSAL_SCHEMA, "entry": os.path.basename(entry), "pages": n_pages,
                   "method": METHOD, "state": "proposed", **propose(read_votes(args.votes, n_pages))}
            text = json.dumps(out, indent=1, ensure_ascii=False) + "\n"
            if args.stdout:
                sys.stdout.write(text)
            else:
                with open(os.path.join(entry, PROPOSAL_FILE), "w", encoding="utf-8") as fh:
                    fh.write(text)
            print(f"proposed {len(out['spans'])} span(s), {len(out['undetermined'])} undetermined", file=sys.stderr)
        else:
            print(json.dumps(score(read_json(os.path.join(entry, PROPOSAL_FILE)), read_json(args.truth)), indent=1))
    except Refused as exc:
        print(f"volume-separation: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
