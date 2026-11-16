"""Smoke tests — Pydantic models validate real block-QA sidecar shapes."""

import json
import pathlib

import pytest

from block_qa_schema import (
    BlockQaReport,
    QaCriterionEntry,
    QaScriptSidecar,
    __version__,
)


def test_version():
    # Bump in lockstep with pyproject.toml + package.json + js/index.ts VERSION
    assert __version__ == "0.2.0"


def test_minimal_report():
    """A report with only the required fields validates."""
    r = BlockQaReport.model_validate(
        {
            "$schema": "block-qa/v1",
            "label": "def:carbon-valence",
            "kind": "definition",
            "paths": {"ts": "content/x/carbon-valence.ts"},
            "source_hashes": {"ts": "a1b2c3d4e5f6"},
            "criteria": {},
            "updated_at": "2026-06-12T00:00:00Z",
        }
    )
    assert r.label == "def:carbon-valence"
    assert r.criteria == {}
    assert r.paths.md is None


def test_no_clock_required():
    """Since 0.2.0 no clock is required: a verdict's date is derived from its
    reviewed_tree (owner ruling 2026-11-06, "QA dates")."""
    BlockQaReport.model_validate(
        {
            "$schema": "block-qa/v1",
            "label": "def:carbon-valence",
            "kind": "definition",
            "paths": {"ts": "content/x/carbon-valence.ts"},
            "source_hashes": {"ts": "a1b2c3d4e5f6"},
            "criteria": {
                "x": [
                    {
                        "field_hash": {"md": "9fb618864a10"},
                        "result": "pass",
                        "reviewer": {"kind": "script", "id": "x.ts"},
                        "reviewed_tree": "a" * 40,
                    }
                ]
            },
        }
    )


def test_full_report_validates():
    """A maximal report — script verdict with metrics, scored agent rater
    entry, and a legacy agent entry without reviewed_sha — parses."""
    raw = {
        "$schema": "block-qa/v1",
        "label": "prop:jet-tower-convergence",
        "kind": "proposition",
        "paths": {
            "ts": "content/x/jet-tower-convergence.ts",
            "md": "content/x/jet-tower-convergence.md",
            "lean": "content/x/jet-tower-convergence.lean",
        },
        "source_hashes": {"ts": "a1b2c3d4e5f6", "md": "0f1e2d3c4b5a", "lean": "f6e5d4c3b2a1"},
        "criteria": {
            "detangler-block-tanglement": [
                {
                    "field_hash": {"md": "0f1e2d3c4b5a", "ts": "a1b2c3d4e5f6"},
                    "result": "pass",
                    "reviewer": {
                        "kind": "script",
                        "id": "pipeline/qa-checkers-extended.ts",
                        "script_hash": "9a8b7c6d5e4f",
                        "script_commit_sha": "610a6aa2bde5fabec35796ead6bbb0adb76f6533",
                    },
                    "reviewed_at": "2026-06-12T05:00:00+00:00",
                    "reviewed_sha": "e3c959e9fd65b56aa37db507564357629f32f1c9",
                    "metrics": {
                        "fwd_emitted": 0,
                        "tanglement_score": 0,
                        "out_degree": 1,
                        "in_degree": 0,
                        "cone_size": 1,
                        "pagerank": 0.000101,
                        "edge_span_max": 16,
                        "worst_target": "",
                    },
                }
            ],
            "proof-rater-goal-plausibility": [
                {
                    "field_hash": {"md": "0f1e2d3c4b5a", "ts": "a1b2c3d4e5f6", "lean": "f6e5d4c3b2a1"},
                    "result": "fail",
                    "severity": "minor",
                    "score": {"value": 0.3, "max": 1, "rubric": {"gap_quality": 0.2, "route": 0.4}},
                    "evidence": "core gap: the key step is an axiom",
                    "reviewer": {
                        "kind": "agent",
                        "id": "local/proof-integration-watcher",
                        "agent_model": "claude-opus-4-7",
                        "agent_skill": "local/proof-integration-watcher",
                    },
                    "reviewed_at": "2026-06-07T12:00:00+00:00",
                    "reviewed_sha": "c86793f7c0566a4a849e6e9a4c855697a437a785",
                }
            ],
            # Legacy agent entry shape observed in the live corpus:
            # bare-date reviewed_at, no reviewed_sha.
            "voice-status-leak": [
                {
                    "field_hash": {"md": "9fb618864a10"},
                    "result": "pass",
                    "reviewer": {
                        "kind": "agent",
                        "id": "voice-status-leak-audit",
                        "agent_model": "claude-opus-4-7",
                        "agent_date": "2026-05-27",
                        "agent_skill": "local/one-voice-audit",
                    },
                    "reviewed_at": "2026-05-27",
                }
            ],
            # Structured-evidence shape observed in the live corpus
            # (voice axis): evidence as a list of {line, text} locations.
            "voice-editorializing": [
                {
                    "field_hash": {"md": "9fb618864a10"},
                    "result": "warn",
                    "severity": "minor",
                    "evidence": [
                        {"line": 112, "text": "Curiously, the detector magnetic field"},
                        {"line": 130, "text": "remarkably, the excitation's"},
                    ],
                    "reviewer": {
                        "kind": "agent",
                        "id": "voice-editorializing-audit",
                        "agent_model": "claude-opus-4-7",
                        "agent_skill": "local/one-voice-audit",
                    },
                    "reviewed_at": "2026-05-27",
                }
            ],
        },
        "updated_at": "2026-06-12T05:00:00+00:00",
    }
    r = BlockQaReport.model_validate(raw)
    assert r.schema_marker == "block-qa/v1"
    tangle = r.criteria["detangler-block-tanglement"][0]
    assert tangle.metrics is not None
    assert tangle.metrics["edge_span_max"] == 16
    assert tangle.metrics["worst_target"] == ""
    rater = r.criteria["proof-rater-goal-plausibility"][0]
    assert rater.score is not None and rater.score.value == 0.3
    assert rater.score.rubric == {"gap_quality": 0.2, "route": 0.4}
    legacy = r.criteria["voice-status-leak"][0]
    assert legacy.reviewed_sha is None
    assert legacy.reviewer.agent_date == "2026-05-27"
    structured = r.criteria["voice-editorializing"][0]
    assert isinstance(structured.evidence, list)
    assert structured.evidence[0].line == 112
    assert "magnetic field" in structured.evidence[0].text
    # Round-trip is semantic (object-equal), not byte-identical; the
    # $schema alias must survive a by-alias dump.
    dumped = r.model_dump(mode="json", by_alias=True)
    assert dumped["$schema"] == "block-qa/v1"
    again = BlockQaReport.model_validate(dumped)
    assert again.label == r.label


def test_invalid_result_rejected():
    """The result enum is closed."""
    with pytest.raises(Exception):
        QaCriterionEntry.model_validate(
            {
                "field_hash": {"md": "9fb618864a10"},
                "result": "maybe",  # not in the enum
                "reviewer": {"kind": "script", "id": "x.ts"},
                "reviewed_at": "2026-06-12T00:00:00Z",
            }
        )


def test_wrong_schema_marker_rejected():
    """A sidecar claiming a different $schema is not a BlockQaReport."""
    with pytest.raises(Exception):
        BlockQaReport.model_validate(
            {
                "$schema": "qa-script/v1",
                "label": "def:x",
                "kind": "definition",
                "paths": {"ts": "x.ts"},
                "source_hashes": {},
                "criteria": {},
                "updated_at": "2026-06-12T00:00:00Z",
            }
        )


def test_extra_fields_allowed():
    """The sidecar format is extensible — extra fields don't fail validation."""
    r = BlockQaReport.model_validate(
        {
            "$schema": "block-qa/v1",
            "label": "rem:x",
            "kind": "remark",
            "paths": {"ts": "x.ts"},
            "source_hashes": {},
            "criteria": {},
            "updated_at": "2026-06-12T00:00:00Z",
            "my_custom_field": {"foo": "bar"},
        }
    )
    assert r.kind == "remark"


def test_script_sidecar():
    """The per-criterion checker-staleness sidecar validates."""
    s = QaScriptSidecar.model_validate(
        {
            "$schema": "qa-script/v1",
            "criterion_id": "proof-no-bare-sorries",
            "source_file": "pipeline/qa-checkers.ts",
            "script_hash": "9a8b7c6d5e4f",
            "script_commit_sha": "610a6aa2bde5fabec35796ead6bbb0adb76f6533",
            "extra_inputs": ["content/schema/references.ts"],
            "deps_hash": "1a2b3c4d5e6f",
            "last_run_at": "2026-06-12T05:00:00+00:00",
            "last_run_sha": "e3c959e9fd65b56aa37db507564357629f32f1c9",
            "engine_version": "bun-1.3.11+node-22",
        }
    )
    assert s.criterion_id == "proof-no-bare-sorries"
    assert s.deps_hash == "1a2b3c4d5e6f"


def test_json_schema_files_present():
    """The shipped JSON schema files are at the documented paths."""
    schema_dir = pathlib.Path(__file__).resolve().parent.parent / "schema"
    block = json.loads((schema_dir / "block-qa.schema.json").read_text())
    assert block["title"] == "BlockQaReport"
    assert block["properties"]["$schema"]["const"] == "block-qa/v1"
    assert "criterionEntry" in block["$defs"]
    script = json.loads((schema_dir / "qa-script.schema.json").read_text())
    assert script["title"] == "QaScriptSidecar"
    assert script["properties"]["$schema"]["const"] == "qa-script/v1"


# ── agent violations must carry evidence ──────────────────────────────────
#
# The `result` docstring has always said "fail = violated (evidence must cite
# file:line + verbatim quote)", but nothing enforced it and 1302 agent
# fail/warn entries accumulated with `evidence` empty. These pin the rule in
# the Pydantic mirror; the JSON Schema carries the same condition as an
# `allOf`.


def _agent_entry(**over):
    base = {
        "field_hash": {"md": "a1b2c3d4e5f6"},
        "result": "fail",
        "reviewer": {"kind": "agent", "id": "local/qa-agent-drain"},
        "reviewed_at": "2026-08-25T00:00:00Z",
    }
    base.update(over)
    return base


@pytest.mark.parametrize("result", ["fail", "warn"])
def test_agent_violation_requires_evidence(result):
    with pytest.raises(ValueError, match="requires non-empty `evidence`"):
        QaCriterionEntry.model_validate(_agent_entry(result=result))


@pytest.mark.parametrize("blank", ["", "   "])
def test_agent_violation_rejects_blank_evidence(blank):
    with pytest.raises(ValueError):
        QaCriterionEntry.model_validate(_agent_entry(evidence=blank))


def test_agent_violation_rejects_empty_evidence_list():
    with pytest.raises(ValueError):
        QaCriterionEntry.model_validate(_agent_entry(evidence=[]))


def test_agent_violation_accepts_string_evidence():
    e = QaCriterionEntry.model_validate(
        _agent_entry(evidence="braid.lean:22:28: error(unknownIdentifier)")
    )
    assert e.result == "fail"


def test_agent_violation_accepts_structured_evidence():
    # The shape some agent reviewers emit; blessed by the `evidence` schema.
    e = QaCriterionEntry.model_validate(
        _agent_entry(evidence=[{"line": 18, "text": "claims 'exact'"}])
    )
    assert e.evidence


@pytest.mark.parametrize("result", ["pass", "n/a"])
def test_non_violation_needs_no_evidence(result):
    # A verdict that found nothing has nothing to evidence; requiring it here
    # would hollow out the sweep from the other side.
    assert QaCriterionEntry.model_validate(_agent_entry(result=result))


def test_script_reviewer_is_out_of_scope():
    # Deliberate: 933 script fail/warn entries carry no reason under any key,
    # so a universal rule would reject them on arrival. Widening this is the
    # end state, blocked on fixing those checkers.
    assert QaCriterionEntry.model_validate(
        _agent_entry(reviewer={"kind": "script", "id": "qa-checkers-uses.ts"})
    )
