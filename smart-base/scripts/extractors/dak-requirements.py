#!/usr/bin/env python3
"""
The `requirements` ASPECT of Stage-B ingestion: functional and
non-functional requirements, and normative requirement statements, in any
source a DAK or DTH ingests.

Owner, 2026-11-01: requirement extraction "should be a general part of L1
ingestion for DAK and DTH". An aspect, not a class: cat-harness-tools'
`scripts/extract-candidates.py` runs it on every document beside whatever
class the document is, and `cat ingest` runs it on every staged entry. It
runs where this layer is mounted, so in DAK and DTH repositories and not
elsewhere.

**No new schema.** Each item takes the existing kind that fits the source
(owner, 2026-11-01: "there are different styles of requirements schema, some
may be folio-asst-core ingesters, some in smart-base"):

| the source prints | kind | from |
|---|---|---|
| a DAK functional requirement row, `<CODE>.FXREQ.<n>` | `functional-requirement` | smart-base |
| a DAK non-functional requirement row, `<CODE>.NFXREQ.<n>` | `non-functional-requirement` | smart-base |
| a normative sentence whose subject is a SYSTEM (system, registry, database, HRIS, software, application, platform, tool) | `functional-requirement`, `number: null` | smart-base |
| any other sentence with a normative marker | `recommendation`, strength from `rfc2119-requirement-level` | core |

The second row is for guides that state what a type of system should do in
prose rather than in a DAK table. Owner, 2026-11-01, on the WHO 2015 HRHIS
guide: such requirements are a reference, "not definitional but contribute
to a definition". They are proposals attributed to their source, and the
folio that cites one decides what it means for its own system.

**Ids come from the source, or there are none.** `number` is the
requirement id exactly as printed. A normative sentence that prints no id
gets `number: null`. Nothing here makes one up: the dth-hrh FR-xx ids an
agent invented, and that no source shows, are the failure this exists to
stop.

**Verbatim.** `statement` is the source's text with whitespace collapsed,
nothing reworded, so `l1:coverage` (core) can match it by normalised
substring and report every normative sentence not captured.

The normative markers are core's `l1-coverage` closed list (its methodology
`methodologies/l1-coverage.md` §1, formerly smart-kg's `docs/COVERAGE.md`), so a sentence the coverage report counts is a
sentence this aspect proposes: `shall`, `must`, `should`, `recommend*`, `is
not a reason`, `are not a contraindication`, and `may be` with given,
administered, offered, considered, used, co-administered or implemented.
Bare `may` does not count.

**Not validated against a real DAK L1 table yet**, which is why each
candidate says `route_to: "l2-dak-authoring"`: these are proposals that a
person promotes, never content.
"""

from __future__ import annotations

import re
from typing import Any

ASPECT = "requirements"

# `ANC.FXREQ.001`, `IMMZ.NFXREQ.012`, and the bare `FXREQ.001` some tables print.
RE_REQ_ID = re.compile(r"\b(?:[A-Z][A-Z0-9]{1,15}\.)?(?P<kind>N?FXREQ)\.(?P<num>\d{1,4})\b")

MAY_VERBS = r"(?:given|administered|offered|considered|used|co-administered|implemented)"
RE_NORMATIVE = re.compile(
    r"\b(?:shall|must|should|recommend\w*|is\s+not\s+a\s+reason|are\s+not\s+a\s+contraindication|may\s+be\s+"
    + MAY_VERBS
    + r")\b",
    re.I,
)
# The subject is a system: the sentence OPENS with a noun phrase that ends in
# the system noun, and the modal follows it directly ("The registry shall …",
# "An electronic HRIS should …"). A system noun elsewhere in the sentence
# ("focal persons for the registry must be identified") is not the subject,
# and that sentence stays a normative statement.
RE_SYSTEM_SUBJECT = re.compile(
    r"^(?:[a-z]\)\s*|[•l▪n-]\s+)?(?:(?:the|a|an|each|every|all|this|any|its)\s+)?(?:[\w-]+\s+){0,4}?"
    r"(?:system|systems|registry|registries|database|databases|HRIS|HRHIS|software|application|applications|"
    r"platform|platforms|solution|solutions)\s+(?:shall|must|should)\b",
    re.I,
)
# RFC 2119 / BCP 14 level, in core's `rfc2119-requirement-level` code list.
RE_LEVEL = (
    ("must-not", re.compile(r"\b(?:must|shall)\s+not\b", re.I)),
    ("must", re.compile(r"\b(?:must|shall)\b", re.I)),
    ("should-not", re.compile(r"\bshould\s+not\b", re.I)),
    ("should", re.compile(r"\bshould\b", re.I)),
    ("may", re.compile(r"\bmay\s+be\s+" + MAY_VERBS + r"\b", re.I)),
)
# A sentence ends at . ! ? followed by space and a capital, or at a blank line.
RE_SENTENCE_END = re.compile(r"(?<=[.!?])\s+(?=[\"“(]?[A-Z0-9])|\n\s*\n")


def clean(s: str, limit: int = 1200) -> str:
    return re.sub(r"\s+", " ", s).strip()[:limit]


def applies(meta: dict[str, Any], sections) -> bool:
    """Always, where this layer is mounted: the mount is the gate."""
    return True


def level(sentence: str) -> str | None:
    for code, rx in RE_LEVEL:
        if rx.search(sentence):
            return code
    return None


def _req_rows(fn: str, fm: dict[str, str], body: str) -> tuple[list[dict[str, Any]], list[tuple[int, int]]]:
    """One candidate per requirement id, its text the row (or line) that carries it."""
    out: list[dict[str, Any]] = []
    spans: list[tuple[int, int]] = []
    seen: set[str] = set()
    for m in RE_REQ_ID.finditer(body):
        rid = m.group(0)
        if rid in seen:  # a later mention is a cross-reference, not the row
            continue
        seen.add(rid)
        start = body.rfind("\n", 0, m.start()) + 1
        end = body.find("\n", m.end())
        end = len(body) if end == -1 else end
        row = body[start:end]
        # A Markdown table row: the cells, joined, without the pipes.
        text = clean(" ".join(c for c in row.strip().strip("|").split("|"))) if "|" in row else clean(row)
        spans.append((start, end))
        nf = m.group("kind") == "NFXREQ"
        out.append({
            "kind": "non-functional-requirement" if nf else "functional-requirement",
            "source_kind": "dak-nfr-row" if nf else "dak-fr-row",
            "number": rid,
            "name": None,
            "statement": text,
            "section_file": f"sections/{fn}",
            "section_title": fm.get("section_title"),
            "pages": fm.get("pages"),
            "formalization_candidate": False,
            "route_to": "l2-dak-authoring",
        })
    return out, spans


def _normative(fn: str, fm: dict[str, str], body: str, skip: list[tuple[int, int]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    pos = 0
    for piece in RE_SENTENCE_END.split(body) + [""]:
        if piece is None:
            continue
        start = body.find(piece, pos) if piece else -1
        if start != -1:
            pos = start + len(piece)
        if not piece or not RE_NORMATIVE.search(piece):
            continue
        if start != -1 and any(a <= start < b for a, b in skip):
            continue  # already proposed as a requirement row
        sentence = clean(piece)
        if len(sentence) < 20:
            continue
        system = bool(RE_SYSTEM_SUBJECT.search(sentence))
        out.append({
            "kind": "functional-requirement" if system else "recommendation",
            "source_kind": "system-requirement-statement" if system else "normative-statement",
            "number": None,
            "name": None,
            "statement": sentence,
            "strength": level(sentence),
            "strength_list": "rfc2119-requirement-level",
            "section_file": f"sections/{fn}",
            "section_title": fm.get("section_title"),
            "pages": fm.get("pages"),
            "formalization_candidate": False,
            "route_to": "l2-dak-authoring",
        })
    return out


def extract(sections, meta) -> list[dict[str, Any]]:
    cands: list[dict[str, Any]] = []
    for fn, fm, body in sections:
        rows, spans = _req_rows(fn, fm, body)
        cands += rows
        cands += _normative(fn, fm, body, spans)
    return cands
