# Specifies the Zod half of schemas/block-qa-schema (js/index.ts), case for case
# with the Pydantic half's tests, so the two accept and reject the same documents.
# Each Scenario names the test that executes it.
Feature: The block-QA Zod schemas accept and reject what the Pydantic ones do

  @test:schemas/block-qa-schema/tests/parity.test.ts::the_Zod_half_matches_the_Pydantic_half::VERSION_is_in_lockstep_with_pyproject.toml_and_package.json
  Scenario: The Zod package's VERSION is "0.2.0" and matches package.json
    # Gap: pyproject.toml's version is not read
    Given the block-qa-schema package
    Then VERSION is "0.2.0"
    And package.json's version equals VERSION

  @test:schemas/block-qa-schema/tests/parity.test.ts::the_Zod_half_matches_the_Pydantic_half::a_report_with_only_the_required_fields_validates
  Scenario: A report with only the required fields validates
    Given a minimal report labelled "def:carbon-valence" with empty criteria and only a "ts" path
    When it is parsed as a BlockQaReport
    Then its label is "def:carbon-valence", its criteria are empty, and it has no "md" path

  @test:schemas/block-qa-schema/tests/parity.test.ts::the_Zod_half_matches_the_Pydantic_half::no_clock_is_required:_a_verdict's_date_is_derived_from_its_reviewed_tree
  Scenario: No clock is required: a report needs no updated_at and a verdict may carry only reviewed_tree
    Given the minimal report without "updated_at"
    When it is parsed as a BlockQaReport
    Then it does not throw
    And a criterion entry with "reviewed_tree" and no "reviewed_at" parses without throwing

  @test:schemas/block-qa-schema/tests/parity.test.ts::the_Zod_half_matches_the_Pydantic_half::the_result_enum_is_closed
  Scenario: A criterion entry with a result outside the enum is refused
    Given a criterion entry whose result is "maybe"
    When it is parsed as a QaCriterionEntry
    Then it throws

  @test:schemas/block-qa-schema/tests/parity.test.ts::the_Zod_half_matches_the_Pydantic_half::a_sidecar_claiming_a_different_$schema_is_not_a_BlockQaReport
  Scenario: A sidecar claiming "qa-script/v1" is not a BlockQaReport
    Given the minimal report with "$schema" set to "qa-script/v1"
    When it is parsed as a BlockQaReport
    Then it throws

  @test:schemas/block-qa-schema/tests/parity.test.ts::the_Zod_half_matches_the_Pydantic_half::the_format_is_extensible_—_an_extra_field_does_not_fail_validation
  Scenario: An extra field does not fail a report's validation
    Given the minimal report of kind "remark" with an added "my_custom_field"
    When it is parsed as a BlockQaReport
    Then it parses with kind "remark"

  @test:schemas/block-qa-schema/tests/parity.test.ts::the_Zod_half_matches_the_Pydantic_half::both_shipped_JSON_Schema_files_parse_and_declare_their_id
  Scenario: Both shipped JSON Schema files parse and declare a $schema
    # Gap: only that "$schema" is a string is checked, not an id
    Given "block-qa.schema.json" and "qa-script.schema.json" under "schema/"
    When each is parsed as JSON
    Then each has a string "$schema"

  @test:schemas/block-qa-schema/tests/parity.test.ts::the_Zod_half_matches_the_Pydantic_half::the_per-criterion_checker-staleness_sidecar_validates
  Scenario: The per-criterion checker-staleness sidecar validates
    Given a "qa-script/v1" sidecar for criterion "proof-no-bare-sorries", field for field the Python case's
    When it is parsed as a QaScriptSidecar
    Then its criterion_id is "proof-no-bare-sorries" and its deps_hash "1a2b3c4d5e6f"

  @test:schemas/block-qa-schema/tests/parity.test.ts::the_Zod_half_matches_the_Pydantic_half::the_module_under_test_really_exported_something
  Scenario: The module under test exports its three schemas
    Given the block-qa-schema JavaScript module
    Then BlockQaReport, QaCriterionEntry and QaScriptSidecar each have a parse function
