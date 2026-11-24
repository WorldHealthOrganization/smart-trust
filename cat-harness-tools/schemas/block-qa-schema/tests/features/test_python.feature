# Specifies the Pydantic half of schemas/block-qa-schema (block_qa_schema): its version,
# the report and sidecar shapes, the shipped JSON Schema files, and the evidence rule
# for an agent's violation. Each Scenario names the test that executes it.
Feature: The block-QA Pydantic models validate real block-QA sidecar shapes

  @test:schemas/block-qa-schema/tests/test_python.py::test_version
  Scenario: The Python package's version is "0.2.0"
    # Gap: lockstep with pyproject.toml, package.json and js/index.ts is not checked
    Given the block_qa_schema package
    Then its __version__ is "0.2.0"

  @test:schemas/block-qa-schema/tests/test_python.py::test_minimal_report
  Scenario: A report with only the required fields validates
    Given a minimal report labelled "def:carbon-valence" with empty criteria and only a "ts" path
    When it is validated as a BlockQaReport
    Then its label is "def:carbon-valence", its criteria are empty, and its "md" path is None

  @test:schemas/block-qa-schema/tests/test_python.py::test_no_clock_required
  Scenario: No clock is required: a report needs no updated_at and a verdict may carry only reviewed_tree
    Given a report with no "updated_at" whose one criterion entry carries "reviewed_tree" and no "reviewed_at"
    When it is validated as a BlockQaReport
    Then it validates

  @test:schemas/block-qa-schema/tests/test_python.py::test_full_report_validates
  Scenario: A maximal report validates and round-trips by alias
    Given a report with a script verdict with metrics, a scored agent rater entry, a legacy agent entry with a bare date and no reviewed_sha, and an entry with structured evidence
    When it is validated as a BlockQaReport
    Then its schema marker is "block-qa/v1"
    And the script verdict's metrics have edge_span_max 16 and an empty worst_target
    And the rater's score value is 0.3 with rubric gap_quality 0.2 and route 0.4
    And the legacy entry has no reviewed_sha and agent_date "2026-05-27"
    And the structured evidence is a list whose first item has line 112 and text containing "magnetic field"
    And dumped by alias it keeps "$schema" "block-qa/v1" and validates again with the same label

  @test:schemas/block-qa-schema/tests/test_python.py::test_invalid_result_rejected
  Scenario: A criterion entry with a result outside the enum is refused
    Given a criterion entry whose result is "maybe"
    When it is validated as a QaCriterionEntry
    Then it raises

  @test:schemas/block-qa-schema/tests/test_python.py::test_wrong_schema_marker_rejected
  Scenario: A sidecar claiming "qa-script/v1" is not a BlockQaReport
    Given a report whose "$schema" is "qa-script/v1"
    When it is validated as a BlockQaReport
    Then it raises

  @test:schemas/block-qa-schema/tests/test_python.py::test_extra_fields_allowed
  Scenario: An extra field does not fail a report's validation
    Given a report of kind "remark" with an added "my_custom_field"
    When it is validated as a BlockQaReport
    Then it validates with kind "remark"

  @test:schemas/block-qa-schema/tests/test_python.py::test_script_sidecar
  Scenario: The per-criterion checker-staleness sidecar validates
    Given a "qa-script/v1" sidecar for criterion "proof-no-bare-sorries"
    When it is validated as a QaScriptSidecar
    Then its criterion_id is "proof-no-bare-sorries" and its deps_hash "1a2b3c4d5e6f"

  @test:schemas/block-qa-schema/tests/test_python.py::test_json_schema_files_present
  Scenario: The shipped JSON Schema files are at their documented paths
    Given the package's "schema/" directory
    Then "block-qa.schema.json" has title "BlockQaReport", a "$schema" const "block-qa/v1" and a "criterionEntry" definition
    And "qa-script.schema.json" has title "QaScriptSidecar" and a "$schema" const "qa-script/v1"

  @test:schemas/block-qa-schema/tests/test_python.py::test_agent_violation_requires_evidence
  Scenario: An agent's fail or warn without evidence is refused
    Given an agent criterion entry with result "fail" or "warn" and no evidence
    When it is validated as a QaCriterionEntry
    Then it raises saying it requires non-empty "evidence"

  @test:schemas/block-qa-schema/tests/test_python.py::test_agent_violation_rejects_blank_evidence
  Scenario: An agent's violation with blank evidence is refused
    Given an agent fail entry whose evidence is "" or only spaces
    When it is validated as a QaCriterionEntry
    Then it raises

  @test:schemas/block-qa-schema/tests/test_python.py::test_agent_violation_rejects_empty_evidence_list
  Scenario: An agent's violation with an empty evidence list is refused
    Given an agent fail entry whose evidence is an empty list
    When it is validated as a QaCriterionEntry
    Then it raises

  @test:schemas/block-qa-schema/tests/test_python.py::test_agent_violation_accepts_string_evidence
  Scenario: An agent's violation with string evidence is accepted
    Given an agent fail entry whose evidence is "braid.lean:22:28: error(unknownIdentifier)"
    When it is validated as a QaCriterionEntry
    Then it validates with result "fail"

  @test:schemas/block-qa-schema/tests/test_python.py::test_agent_violation_accepts_structured_evidence
  Scenario: An agent's violation with structured evidence is accepted
    Given an agent fail entry whose evidence is a list of one line-and-text location
    When it is validated as a QaCriterionEntry
    Then it validates with its evidence kept

  @test:schemas/block-qa-schema/tests/test_python.py::test_non_violation_needs_no_evidence
  Scenario: An agent's pass or n/a needs no evidence
    Given an agent entry with result "pass" or "n/a" and no evidence
    When it is validated as a QaCriterionEntry
    Then it validates

  @test:schemas/block-qa-schema/tests/test_python.py::test_script_reviewer_is_out_of_scope
  Scenario: A script reviewer's fail needs no evidence
    Given a fail entry with no evidence whose reviewer is a script
    When it is validated as a QaCriterionEntry
    Then it validates
