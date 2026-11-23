# Specifies derivedWriters (scripts/detect-live-corpus.ts) over the checkout's
# script table.
Feature: The live-corpus probe derives its writers from the checkout

  @test:test/coordinator/detect-live-corpus-checkout.test.ts::derivedWriters_—_no_roster::it_derives_a_non-trivial_set_from_THIS_repository
  Scenario: The derived writers are many and include auto:docs
    Given the checkout root
    When the writers are derived
    Then there are more than 20
    And they include "auto:docs"
