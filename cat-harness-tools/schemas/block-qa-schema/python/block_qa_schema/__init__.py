"""block-qa-schema — Pydantic models for the folio block-QA sidecar format.

The canonical schemas are ``schemas/block-qa-schema/schema/block-qa.schema.json``
(the per-block ``<block>.qa.json`` report) and
``schemas/block-qa-schema/schema/qa-script.schema.json`` (the per-criterion
``<criterion-id>.script.json`` checker-staleness sidecar). This module ships
Pydantic v2 models that validate against the same shapes. Used by any Python
consumer that reads the QA sidecars emitted by the folio qa-sweep pipeline
(``pipeline/qa-sweep.ts``; producing types in
``schemas/sdlc/block-qa.ts``).

Example::

    from block_qa_schema import BlockQaReport

    with open("carbon-valence.qa.json") as f:
        report = BlockQaReport.model_validate_json(f.read())

    for criterion, entries in report.criteria.items():
        latest = entries[-1]
        print(criterion, "→", latest.result, latest.reviewer.kind)
"""

from __future__ import annotations

from typing import Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, model_validator

__version__ = "0.2.0"

QaReviewerKind = Literal["script", "agent", "human"]

QaResult = Literal["pass", "fail", "warn", "n/a"]

QaSeverity = Literal["critical", "major", "minor"]

DaScope = Literal["limited", "structural"]
DaRuling = Literal["surviving", "rebutted", "partial"]
DaVerdict = Literal["clean-rebutted", "no-objection-raised", "clean", "survivable-objection", "open-objection"]


class QaReviewer(BaseModel):
    """Identity + provenance of the reviewer that produced an entry.

    ``kind: "script"`` entries carry the checker's own ``script_hash`` (plus
    ``deps_hash`` for extra inputs) so a checker bug fix auto-stales every
    verdict it ever wrote. ``kind: "agent"`` entries carry the model id,
    session, and dispatching skill so heterogeneous models can audit one
    another's verdicts. ``kind: "human"`` is the final-authority tier.
    """

    model_config = ConfigDict(extra="allow")

    kind: QaReviewerKind
    id: str
    version: Optional[str] = None
    # kind: "script" provenance — staleness drivers
    script_hash: Optional[str] = None
    script_commit_sha: Optional[str] = None
    deps_hash: Optional[str] = None
    # kind: "agent" provenance — model-level audit trail
    agent_model: Optional[str] = None
    agent_session: Optional[str] = None
    agent_date: Optional[str] = None
    agent_skill: Optional[str] = None


class QaFieldHash(BaseModel):
    """12-char SHA-256 prefixes of each source file's UTF-8 bytes.

    Absent fields mean the audit did not depend on that file (or it did
    not exist at audit time).
    """

    model_config = ConfigDict(extra="allow")

    # Paper adapter companions.
    md: Optional[str] = None
    ts: Optional[str] = None
    lean: Optional[str] = None
    # WHO SMART Guidelines L2 DAK companions.
    bpmn: Optional[str] = None
    dmn: Optional[str] = None
    xlsx: Optional[str] = None
    # WHO SMART Guidelines L3 FHIR companions.
    fsh: Optional[str] = None
    cql: Optional[str] = None


class QaScore(BaseModel):
    """Rubric score for rater-style quality criteria (``proof-rater-*``).

    A quality measure to improve over time, not a pass/fail gate.
    Convention: value/max >= 0.66 maps to result "pass", 0.33-0.66 to
    "warn", < 0.33 to "fail".
    """

    model_config = ConfigDict(extra="allow")

    value: float
    max: float
    rubric: Optional[dict[str, float]] = None


class QaEvidenceItem(BaseModel):
    """One structured evidence location.

    Some agent reviewers (voice axis especially) emit evidence as a list
    of ``{line, text}`` locations rather than a single string; the live
    corpus carries both shapes.
    """

    model_config = ConfigDict(extra="allow")

    line: Optional[int] = None
    text: Optional[str] = None


class QaCriterionEntry(BaseModel):
    """The outcome of one reviewer evaluating one criterion on one block.

    A verdict whose ``field_hash`` no longer matches the present source
    files is stale and must be re-run. ``reviewed_tree`` (the tree of HEAD) is
    what producers write; ``reviewed_sha`` is the older commit-id field, kept
    readable. Both are optional — legacy agent entries (pre-2026-06) carry
    neither.
    """

    model_config = ConfigDict(extra="allow")

    field_hash: QaFieldHash
    result: QaResult
    severity: Optional[QaSeverity] = None
    score: Optional[QaScore] = None
    evidence: Optional[Union[str, list[QaEvidenceItem]]] = None
    # Descriptive structural measures a checker emits alongside its verdict
    # (e.g. the detangler axis's tanglement_score / cone_size / pagerank /
    # graph_energy snapshot) — not a quality score.
    metrics: Optional[dict[str, Union[int, float, str]]] = None
    
    # ── da-axis extension fields ──
    scope: Optional[DaScope] = None
    ruling: Optional[DaRuling] = None
    referee_argument: Optional[str] = None
    rebuttal: Optional[str] = None
    verdict: Optional[DaVerdict] = None

    reviewer: QaReviewer
    # ISO-8601 UTC datetime; legacy agent entries may carry a bare ISO date.
    # Optional since 0.2.0 (owner rulings 2026-11-06, cards "QA dates" and
    # "Date source"): the date is DERIVED on read from ``reviewed_tree`` (the
    # commit date of the commit carrying it), so a writer may omit it.
    reviewed_at: Optional[str] = None
    reviewed_tree: Optional[str] = None
    reviewed_sha: Optional[str] = None

    @model_validator(mode="after")
    def _agent_violation_needs_evidence(self) -> "QaCriterionEntry":
        """An agent verdict asserting a violation must carry its evidence.

        Mirrors the ``allOf`` conditional in ``block-qa.schema.json``. The
        ``result`` docstring has always said so -- "fail = violated (evidence
        must cite file:line + verbatim quote)" -- but nothing enforced it, and
        1302 agent fail/warn entries accumulated with ``evidence`` empty, their
        reasoning filed under ``notes``/``referee_argument`` instead.

        Scoped to ``reviewer.kind == "agent"`` deliberately: 933 SCRIPT
        fail/warn entries carry no reason under any key, so a universal rule
        would reject them on arrival. Widening it is the end state and is
        blocked on fixing those checkers.
        """
        if self.result not in ("fail", "warn"):
            return self
        if getattr(self.reviewer, "kind", None) != "agent":
            return self
        ev = self.evidence
        empty = ev is None or (isinstance(ev, str) and not ev.strip()) or (
            isinstance(ev, list) and not ev
        )
        if empty:
            raise ValueError(
                f"result={self.result!r} from an agent reviewer requires "
                "non-empty `evidence` citing what was found"
            )
        return self
    notes: Optional[str] = None

    @model_validator(mode="after")
    def validate_da_constraints(self) -> "QaCriterionEntry":
        if self.ruling == "surviving" and self.result != "fail":
            raise ValueError("result must be 'fail' when ruling is 'surviving'")
        if self.ruling == "partial" and self.result != "warn":
            raise ValueError("result must be 'warn' when ruling is 'partial'")
        if self.ruling == "rebutted" and self.result != "pass":
            raise ValueError("result must be 'pass' when ruling is 'rebutted'")
            
        if self.verdict == "open-objection" and self.result != "fail":
            raise ValueError("result must be 'fail' when verdict is 'open-objection'")
        if self.verdict == "survivable-objection" and self.result != "warn":
            raise ValueError("result must be 'warn' when verdict is 'survivable-objection'")
        if self.verdict in ("clean", "clean-rebutted") and self.result != "pass":
            raise ValueError("result must be 'pass' when verdict is 'clean' or 'clean-rebutted'")
            
        if self.scope == "structural":
            if not self.rebuttal:
                raise ValueError("structural scope requires a non-empty rebuttal")
            if not self.referee_argument:
                raise ValueError("structural scope requires a non-empty referee_argument")
                
        return self


class QaPaths(BaseModel):
    """Paths to the block's source files, relative to repo root."""

    model_config = ConfigDict(extra="allow")

    ts: str
    md: Optional[str] = None
    lean: Optional[str] = None


class BlockQaReport(BaseModel):
    """Top-level shape of a ``<block>.qa.json`` sidecar.

    ``criteria`` maps each criterion id to an append-only array of reviewer
    entries; multiple reviewers (script + agent + human) may co-exist and
    are NOT deduplicated. The criterion's current verdict is the most
    recent entry whose ``field_hash`` matches the present source files.
    """

    model_config = ConfigDict(extra="allow", populate_by_name=True)

    schema_marker: Literal["block-qa/v1"] = Field(alias="$schema")
    label: str
    kind: str
    paths: QaPaths
    source_hashes: QaFieldHash
    criteria: dict[str, list[QaCriterionEntry]]
    updated_at: Optional[str] = None


class QaScriptSidecar(BaseModel):
    """Per-criterion ``<criterion-id>.script.json`` checker-staleness sidecar.

    Records the canonical (script_hash, script_commit_sha, deps_hash)
    triple at the most recent qa-sweep run — the single-source-of-truth
    view of "is checker X currently stale globally?".
    """

    model_config = ConfigDict(extra="allow", populate_by_name=True)

    schema_marker: Literal["qa-script/v1"] = Field(alias="$schema")
    criterion_id: str
    source_file: str
    script_hash: str
    script_commit_sha: str
    extra_inputs: Optional[list[str]] = None
    deps_hash: Optional[str] = None
    last_run_at: Optional[str] = None
    last_run_sha: str
    engine_version: Optional[str] = None


__all__ = [
    "__version__",
    "QaReviewerKind",
    "QaResult",
    "QaSeverity",
    "DaScope",
    "DaRuling",
    "DaVerdict",
    "QaReviewer",
    "QaFieldHash",
    "QaScore",
    "QaEvidenceItem",
    "QaCriterionEntry",
    "QaPaths",
    "BlockQaReport",
    "QaScriptSidecar",
]
