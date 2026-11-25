# Specifies, by running gen-docs-pages.ts from the checkout root, that the
# published QA index counts the tree left after the orphan sweep, and that a
# second run publishes the same index.
Feature: The published QA count matches the tree after the orphan sweep, and is idempotent

  @test:test/coordinator/gen-docs-pages-orphan-qa-checkout.test.ts::gen-docs-pages_orphan_sweep_and_QA_projection_order_(bean_0kbt)::published_QA_count_matches_the_post-sweep_tree,_not_the_tree_it_started_from,_and_consecutive_runs_are_idempotent
  Scenario: An orphan witness is swept and not counted, and a second run publishes the same index
    Given an orphan witness with a fail count of 999 written under the instance's test/results/witnesses
    When gen-docs-pages.ts is run from the checkout root
    Then it exits 0
    And the orphan witness no longer exists
    And the published QA index counts as many files as the QA graph now holds
    And the qa-witness/v1 family's fail bucket is not 999
    When gen-docs-pages.ts is run again
    Then it exits 0
    And the published QA index is identical to the first
    And the tracked QA result files are restored afterwards
