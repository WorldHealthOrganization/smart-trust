# Specifies buildReport, totals, outputs and staleness (scripts/prov-qaqc.ts)
# over the checkout's committed workflow instances.
Feature: PROV QA/QC over the real repository finds valid activities and current outputs

  @test:test/coordinator/prov-qaqc-checkout.test.ts::prov-qaqc:_the_real_repository::vacuity_guard:_the_committed_instances_yield_more_than_zero_activities,_all_valid
  Scenario: The committed instances yield valid activities
    Given the PROV QA/QC report built from the checkout
    When its totals are taken
    Then there is at least one instance
    And at least one activity
    And none is invalid

  @test:test/coordinator/prov-qaqc-checkout.test.ts::prov-qaqc:_the_real_repository::the_committed_page_and_logs_are_current_(what_check:prov-qaqc_gates)
  Scenario: The committed page and logs are current
    Given the outputs of the PROV QA/QC report
    When their staleness is checked
    Then nothing is stale and nothing is orphaned
