# The block schemas are non-strict, so a key nothing declares is stripped
# silently; the validator reports it. Each Scenario names the test that executes it.
Feature: Unknown manifest fields

  @test:scripts/tests/validate-unknown-field.test.ts::unknown_manifest_fields::a_key_no_schema_declares_is_reported
  Scenario: An undeclared key is reported
    Given a prose block with a "proofOf" field
    When it is validated
    Then there is one "Unknown field" issue naming "proofOf"

  @test:scripts/tests/validate-unknown-field.test.ts::unknown_manifest_fields::it_is_a_warning,_not_an_error
  Scenario: An unknown field is a warning
    Given a prose block with an "is_mathematics" field
    Then its "Unknown field" issue has level "warning"

  @test:scripts/tests/validate-unknown-field.test.ts::unknown_manifest_fields::every_unknown_key_is_reported,_not_just_the_first
  Scenario: Every unknown key is reported
    Given a prose block with "probe" and "consumers" fields
    Then there are two "Unknown field" issues

  @test:scripts/tests/validate-unknown-field.test.ts::unknown_manifest_fields::a_clean_block_reports_nothing
  Scenario: A clean block has no unknown fields
    Given a prose block with only declared fields and tags
    Then there are no "Unknown field" issues

  @test:scripts/tests/validate-unknown-field.test.ts::unknown_manifest_fields::the_canonical_spelling_of_a_stripped_field_is_not_reported
  Scenario: The canonical "of" is not reported
    Given a proof block with "of"
    Then there are no "Unknown field" issues
