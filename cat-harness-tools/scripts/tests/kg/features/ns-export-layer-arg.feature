# scripts/ns-export.ts checks its --layer argument and words its refusal from the one list of
# declared term layers, so the verdict and the message cannot drift apart (issue #807).
# Each Scenario names the test that executes it.
Feature: The --layer argument and its error message agree on the declared layers

  @test:scripts/tests/kg/ns-export-layer-arg.test.ts::--layer_accepts_exactly_the_declared_layers::every_declared_layer_is_accepted
  Scenario: Every declared layer is accepted
    Given the declared term layers, of which there is at least one
    When each is checked as a --layer value
    Then none of them gets an error

  @test:scripts/tests/kg/ns-export-layer-arg.test.ts::--layer_accepts_exactly_the_declared_layers::a_value_that_is_not_a_layer_is_refused
  Scenario: A value that is not a layer is refused
    When "cat-bootstrap", "Bootstrap", "bootstrap " (trailing space), "" and "folio" are each checked as a --layer value
    Then each gets an error

  @test:scripts/tests/kg/ns-export-layer-arg.test.ts::--layer_accepts_exactly_the_declared_layers::the_rejected_value_is_quoted_back
  Scenario: The refused value is quoted back in the error
    When "cat-bootstrap" is checked as a --layer value
    Then the error contains "cat-bootstrap"

  @test:scripts/tests/kg/ns-export-layer-arg.test.ts::the_message_cannot_disagree_with_the_predicate::it_names_every_accepted_layer
  Scenario: The error names every accepted layer
    When "not-a-layer" is checked as a --layer value
    Then the error contains every declared term layer

  @test:scripts/tests/kg/ns-export-layer-arg.test.ts::the_message_cannot_disagree_with_the_predicate::it_offers_nothing_the_predicate_would_refuse
  Scenario: Every layer the error offers is accepted
    Given the error for "not-a-layer"
    When the names between "must be " and " (got " are read back out of it
    Then there are as many names as declared term layers
    And each name is accepted as a --layer value
