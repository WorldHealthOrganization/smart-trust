# The committed e2e QA fixtures under test/support/fixtures/qa-e2e/ keep the
# shape the generator writes; their verdicts are not asserted (bean cxcn).
# Each Scenario names the test that executes it.
Feature: The e2e QA fixtures keep the generator's shape

  @test:scripts/tests/qa-e2e-fixtures.test.ts::e2e_QA_fixtures_—_the_generator's_shape,_not_the_corpus's_verdicts::badge-index.json_is_a_valid_folio-qa-index/v1
  Scenario: badge-index.json is a valid folio-qa-index/v1
    When badge-index.json is parsed with the QA index schema
    Then there are no issues

  @test:scripts/tests/qa-e2e-fixtures.test.ts::e2e_QA_fixtures_—_the_generator's_shape,_not_the_corpus's_verdicts::badge-index.json_is_the_CURRENT_shape:_it_says_the_corpus_was_present_and_which_keys_are_unswept
  Scenario: badge-index.json is the current shape
    Then badge-index.json says the corpus is "present"
    And it lists at least one unswept key

  @test:scripts/tests/qa-e2e-fixtures.test.ts::e2e_QA_fixtures_—_the_generator's_shape,_not_the_corpus's_verdicts::block-witness.json_is_a_block_qa-witness/v1_doc
  Scenario: block-witness.json is a block qa-witness/v1 document
    Then block-witness.json has no shape defects
    And its family is "block"

  @test:scripts/tests/qa-e2e-fixtures.test.ts::e2e_QA_fixtures_—_the_generator's_shape,_not_the_corpus's_verdicts::kg-witness.json_is_a_kg_qa-witness/v1_doc
  Scenario: kg-witness.json is a kg qa-witness/v1 document
    Then kg-witness.json has no shape defects
    And its family is "kg"

  @test:scripts/tests/qa-e2e-fixtures.test.ts::e2e_QA_fixtures_—_the_generator's_shape,_not_the_corpus's_verdicts::the_checker_is_not_vacuous:_an_unknown_key_is_reported
  Scenario: The shape check reports an unknown key
    Given kg-witness.json with an extra key "stray"
    Then its defects include "unknown key stray"
