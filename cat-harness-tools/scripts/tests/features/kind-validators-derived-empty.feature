# `scripts/check-kind-validators.ts` reports an empty working copy of a derived,
# commit-keyed store as not computed here, and recaps every failure line at the end
# of a failing run. Each Scenario names the test that executes it.
Feature: Kind validators and derived stores

  @test:scripts/tests/kind-validators-derived-empty.test.ts::check:kind-validators_and_a_derived_store_with_no_local_node::is_reported_as_not_computed_here,_not_as_an_empty_corpus
  Scenario: An empty derived store is reported as not computed here, not as an empty corpus
    Given an instance "fixture" declaring an empty qa directory "test/results/" stored on branch "qa-reports" keyed by commit
    When the families are swept
    Then the qa kind is present with 0 nodes
    And it lists the derived store not computed here as id "qa" at "fixture/test/results" on branch "qa-reports"

  @test:scripts/tests/kind-validators-derived-empty.test.ts::runWithFailureRecap::repeats_every_✗_line_at_the_end_when_the_run_fails
  Scenario: Every failure line is repeated at the end when the run fails
    Given a run that logs two "✗" lines and one "✓" line and exits 1
    When it is run with the failure recap
    Then the exit code is 1
    And the output ends with "Failures (2), repeated so the CI summary keeps them:" followed by the two "✗" lines

  @test:scripts/tests/kind-validators-derived-empty.test.ts::runWithFailureRecap::adds_nothing_on_a_pass
  Scenario: Nothing is added on a pass
    Given a run that logs a "✗ noted" line and exits 0
    When it is run with the failure recap
    Then the exit code is 0
    And the output is only that one line
