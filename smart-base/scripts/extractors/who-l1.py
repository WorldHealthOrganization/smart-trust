#!/usr/bin/env python3
"""
The `who-l1` class of Stage-B ingestion: boxed recommendations, good
practice statements, remarks and research priorities in a WHO L1 guideline,
proposed as content candidates and routed to `l2-dak-authoring`.

This is a plugin, not a command. cat-harness-tools'
`scripts/extract-candidates.py` holds the machinery every class shares
(reading the Stage-A sections, choosing a class, counting, writing
`candidates.json`) and loads every mounted layer's `scripts/extractors/*.py`
by its `CLASS`. It moved here from that file (bean saqd, row 6) because
what a WHO guideline offers is this layer's knowledge.

**Unvalidated.** The extractor is structurally complete but has not been
run against a real WHO L1 guideline — there is none in the corpus — so it
declares `VALIDATED = False`, `candidates.json` reports `"validated": false`,
and it should be treated as untested until one has been run. See
`who-l1.test.py` beside this file for what its test does and does not show.
"""

from __future__ import annotations

import re
from typing import Any

CLASS = "who-l1"
# Asked after a class that claims on a hard identifier (an arXiv id).
PRIORITY = 50
VALIDATED = False   # no L1 PDF in the corpus; who.int egress is blocked

RE_WHO_REC = re.compile(
    r"^\s*RECOMMENDATION\s*(?P<num>\d+[a-z]?(?:\.\d+)*)?\s*[.:—-]?\s*(?P<body>.*)$",
    re.M | re.I,
)
RE_WHO_GPS = re.compile(r"^\s*Good\s+practice\s+statement\s*[.:—-]?\s*(?P<body>.*)$", re.M | re.I)
RE_WHO_REMARK = re.compile(r"^\s*Remarks?\s*[.:—-]\s*(?P<body>.*)$", re.M | re.I)
RE_WHO_RESEARCH = re.compile(r"^\s*Research\s+(?:priority|priorities|gap)\w*\s*[.:—-]?\s*(?P<body>.*)$", re.M | re.I)
# A GRADE marker, not merely a word that appears in GRADE tables. The
# certainty levels must be *bound* to a certainty/evidence/quality noun:
# an earlier form alternated on bare `\bhigh|moderate|low`, so the phrase
# "high malaria burden" three paragraphs away flagged a recommendation as
# GRADE-adjacent. Caught by the extractor's own negative test.
RE_GRADE = re.compile(
    r"(?:⊕"
    r"|\bGRADE\b"
    r"|\b(?:certainty|quality)\s+of\s+(?:the\s+)?evidence\b"
    r"|\b(?:very\s+low|low|moderate|high)\s+(?:certainty|quality)\b"
    r"|\b(?:certainty|quality)\s*[:=]\s*(?:very\s+low|low|moderate|high)\b"
    r")",
    re.I,
)
RE_STRENGTH = re.compile(r"\b(strong|conditional|context[- ]specific)\b\s+recommendation", re.I)
# What makes a document look like a guideline during auto-detection.
RE_DETECT = re.compile(r"\bWHO\b|World Health Organization|guideline|recommendation", re.I)


def clean(s: str, limit: int = 600) -> str:
    s = re.sub(r"\s+", " ", s).strip()
    return s[:limit]


def detect(meta: dict[str, Any], sections) -> bool:
    blob = " ".join((fm.get("section_title") or "") for _, fm, _ in sections[:40])
    blob += " " + (meta.get("title") or "")
    return bool(RE_DETECT.search(blob))


def extract(sections, meta) -> list[dict[str, Any]]:
    cands: list[dict[str, Any]] = []
    rules = (
        # Core's `recommendation` kind for both (skill `normative-statements`:
        # "Do not use `definition`" — a math kind whose `lean` is required, and
        # nothing proves a recommendation). They were `definition` and
        # `proposition` until 2026-11-01.
        (RE_WHO_REC, "recommendation", "recommendation", "rec:who"),
        (RE_WHO_GPS, "recommendation", "good-practice-statement", "rec:who"),
        (RE_WHO_REMARK, "remark", "remark", "rem:who"),
        (RE_WHO_RESEARCH, "conjecture", "research-priority", "conj:who"),
    )
    for fn, fm, body in sections:
        for rx, kind, source_kind, prefix in rules:
            for m in rx.finditer(body):
                stmt = clean(m.group("body"), 900)
                if len(stmt) < 20:
                    continue
                window = body[m.start(): m.start() + 1800]
                strength = RE_STRENGTH.search(window)
                cands.append({
                    "kind": kind,
                    "source_kind": source_kind,
                    "number": (m.groupdict().get("num") if "num" in m.groupdict() else None),
                    "name": None,
                    "statement": stmt,
                    "section_file": f"sections/{fn}",
                    "section_title": fm.get("section_title"),
                    "pages": fm.get("pages"),
                    "label_prefix": prefix,
                    "grade_nearby": bool(RE_GRADE.search(window)),
                    "strength": strength.group(1).lower() if strength else None,
                    "strength_list": "grade-recommendation-strength" if strength else None,
                    "formalization_candidate": False,
                    "route_to": "l2-dak-authoring",
                })
    return cands
