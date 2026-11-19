# scripts/check-merged.ts compares readings of the merge worktree taken before and after the gates run, so a gate that
# wrote to the tree is told apart from a gate that failed. Each Scenario names the test that executes it.
Feature: Telling a gate that wrote to the tree from a gate that failed

  @test:scripts/tests/sdlc/check-merged-mutation.test.ts::mutatedDuring_—_the_anti-vacuity_pair::an_unchanged_tree_is_NOT_a_mutation
  Scenario: An unchanged tree is not a mutation
    Given a tree reading with one modified entry "a.json"
    When the same reading is compared before and after
    Then no mutation is reported

  @test:scripts/tests/sdlc/check-merged-mutation.test.ts::mutatedDuring_—_the_anti-vacuity_pair::a_tree_that_gained_an_entry_IS_a_mutation
  Scenario: A tree that gained an entry is a mutation
    Given a clean tree reading before
    And a reading after with a modified entry "a.json"
    When the readings are compared
    Then a mutation is reported

  @test:scripts/tests/sdlc/check-merged-mutation.test.ts::mutatedDuring_—_the_anti-vacuity_pair::a_tree_that_LOST_an_entry_is_a_mutation_too_—_the_direction_#1363_nearly_missed
  Scenario: A tree that lost an entry is a mutation
    Given a reading before with a modified entry "a.json"
    And a clean tree reading after
    When the readings are compared
    Then a mutation is reported

  @test:scripts/tests/sdlc/check-merged-mutation.test.ts::an_unreadable_tree_is_not_a_sighting::unreadable_BEFORE_answers_false,_not_true
  Scenario: An unreadable tree before the gates is not a mutation
    Given the before reading failed with "no .git"
    And the after reading has a modified entry "a.json"
    When the readings are compared
    Then no mutation is reported

  @test:scripts/tests/sdlc/check-merged-mutation.test.ts::an_unreadable_tree_is_not_a_sighting::unreadable_AFTER_answers_false,_not_true
  Scenario: An unreadable tree after the gates is not a mutation
    Given a clean tree reading before
    And the after reading failed with "git binary missing"
    When the readings are compared
    Then no mutation is reported

  @test:scripts/tests/sdlc/check-merged-mutation.test.ts::an_unreadable_tree_is_not_a_sighting::both_unreadable_answers_false
  Scenario: Two unreadable trees are not a mutation
    Given both the before and after readings failed
    When the readings are compared
    Then no mutation is reported
