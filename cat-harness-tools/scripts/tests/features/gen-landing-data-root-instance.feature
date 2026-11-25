# scripts/gen-landing-data.ts builds the landing board for a checkout-root layer without
# reading sibling clones beside the checkout, and its --check honours builtAtPublish.
# Each Scenario names the test that executes it.
Feature: Landing data for a checkout-root layer

  @test:scripts/tests/gen-landing-data-root-instance.test.ts::gen-landing-data_for_a_checkout-root_landing::the_stranger's_declaration_really_is_invalid_(not_vacuous)
  Scenario: The stranger's declaration beside the checkout really is invalid
    Given a parent directory holding a sibling "aaa-stranger" with malformed JSON in its declaration, beside a git checkout "folio"
    When the stranger's declaration is read
    Then reading it throws

  @test:scripts/tests/gen-landing-data-root-instance.test.ts::gen-landing-data_for_a_checkout-root_landing::builds_the_root's_board_and_never_reads_beside_the_checkout
  Scenario: Builds the root layer's board without reading beside the checkout
    Given a git checkout "folio" whose root layer is the landing, beside an invalid "aaa-stranger" declaration
    When gen-landing-data runs in the checkout with the harness nested inside it
    Then stderr does not mention "aaa-stranger"
    And the run exits 0
    And docs/_data/stickies.json holds a card with id "folio"

  @test:scripts/tests/gen-landing-data-root-instance.test.ts::gen-landing-data_--check_when_the_board_is_built_at_publish_(owner,_2026-11-13)::a_layer_that_declares_docs/_data/stickies.json_builtAtPublish_has_nothing_committed_to_judge:_not_applicable
  Scenario: A board declared builtAtPublish makes --check not applicable
    Given the checkout-root fixture whose declaration lists docs/_data/stickies.json as builtAtPublish
    When gen-landing-data runs with --check
    Then it exits 78
    And its output mentions "builtAtPublish"

  @test:scripts/tests/gen-landing-data-root-instance.test.ts::gen-landing-data_--check_when_the_board_is_built_at_publish_(owner,_2026-11-13)::without_the_declaration,_a_missing_board_is_still_stale
  Scenario: Without the builtAtPublish declaration a missing board is stale
    Given the checkout-root fixture with no builtAtPublish declaration and no board written
    When gen-landing-data runs with --check
    Then it exits 1

  @test:scripts/tests/gen-landing-data-root-instance.test.ts::contributingRoots_for_a_checkout-root_instance::never_takes_an_instance_from_a_parent_checkout_as_a_layer
  Scenario: Contributing roots never include an instance from a parent checkout
    Given a parent git checkout holding an instance "other"
    And a nested git checkout "folio" declaring its own instance
    When the contributing roots of "folio" are computed
    Then they include the "folio" checkout
    And they include neither "other" nor the parent directory
