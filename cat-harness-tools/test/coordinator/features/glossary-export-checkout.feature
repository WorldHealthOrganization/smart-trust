# Specifies buildGlossary (scripts/glossary-export.ts) over the checkout: a
# role drawn only by another instance is reported where it is drawn.
Feature: A role undrawn here but drawn by another instance is told apart from one drawn nowhere

  @test:test/coordinator/glossary-export-checkout.test.ts::the_corpus_it_is_actually_run_against::an_undrawn_role_another_instance_draws_is_told_apart_from_one_drawn_nowhere_(bean_nafz)
  Scenario: deep-researcher is reported as drawn in folio-assistant-core
    Given the glossary built over the checkout
    When its report's roles drawn elsewhere are read
    Then deep-researcher is drawn in a file under "folio-assistant-core/"
    And every role drawn elsewhere is also listed as undrawn here
    And no file it is drawn in is under "cat-harness/"
