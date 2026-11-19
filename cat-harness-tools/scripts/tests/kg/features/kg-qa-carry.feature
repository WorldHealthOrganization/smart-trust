# scripts/lib/kg-qa-carry.ts carries a prior kg-qa sidecar's adversarial reviews into a
# freshly computed report, so a kg-audit rewrite does not drop them.
# Each Scenario names the test that executes it.
Feature: Carrying adversarial reviews across a kg-qa rewrite

  @test:scripts/tests/kg/kg-qa-carry.test.ts::withPriorAdversarialReviews::a_rewrite_keeps_the_reviews_the_prior_sidecar_holds
  Scenario: A rewrite keeps the reviews the prior sidecar holds
    Given a prior kg-qa sidecar holding one adversarial review
    When a fresh report with no reviews is merged with that prior
    Then the result's adversarial_reviews is that one review

  @test:scripts/tests/kg/kg-qa-carry.test.ts::withPriorAdversarialReviews::a_report_that_brings_its_own_reviews_keeps_them
  Scenario: A report that brings its own reviews keeps them
    Given a prior kg-qa sidecar holding one adversarial review
    And a fresh report carrying its own review from session "t"
    When the fresh report is merged with the prior
    Then the result's adversarial_reviews are the report's own, not the prior's

  @test:scripts/tests/kg/kg-qa-carry.test.ts::withPriorAdversarialReviews::no_prior,_an_empty_prior,_or_an_unreadable_one:_the_report_is_unchanged
  Scenario: With no usable prior the report comes back unchanged
    Given a fresh report
    When it is merged with an absent sidecar, a sidecar with an empty review list, or a sidecar that is not JSON
    Then each time the very same report object is returned
