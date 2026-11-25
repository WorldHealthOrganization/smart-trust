# The content validator: validating nothing is a failure, and a real corpus
# reaches Phase 2 without throwing. Each Scenario names the test that executes it.
Feature: Validator roots

  @test:scripts/tests/validate-roots.test.ts::validateObjects::an_empty_directory_is_INVALID,_not_valid
  Scenario: An empty directory is invalid
    When an empty directory is validated
    Then it is not valid, there is an error, and the first issue says "refusing to report success"

  @test:scripts/tests/validate-roots.test.ts::validateObjects::a_non-empty_flat_corpus_reaches_Phase_2_without_throwing
  Scenario: A flat corpus with one block reaches Phase 2
    Given a directory with one minimal remark block
    When it is validated
    Then it returns a boolean verdict without throwing
    And no issue says "refusing to report success"
