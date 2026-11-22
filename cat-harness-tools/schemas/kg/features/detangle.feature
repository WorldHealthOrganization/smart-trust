# Specifies schemas/kg/detangle.ts: failingClauses and DEFAULT_THRESHOLDS,
# in particular the upper (maxSize) and lower (minSize) size bounds.
Feature: A detangle group's size raises a finding, and its cohesion shapes the wording

  @test:schemas/kg/detangle.test.ts::the_baseline_group_is_clean,_so_every_other_test_varies_one_axis::no_clause_fires
  Scenario: The baseline group trips no clause
    Given a group of size 20, cohesion 0.8, role "provider" and no outbound edges
    When its failing clauses are computed
    Then there are none

  @test:schemas/kg/detangle.test.ts::maxSize_—_size_RAISES_the_finding,_cohesion_only_shapes_it::a_large_INCOHERENT_group_is_reported_as_several_subgraphs_filed_as_one
  Scenario: A large incoherent group is reported as several subgraphs
    Given the baseline group with size 166 and cohesion 0.22
    When its failing clauses are computed
    Then a "too large" clause fires
    And it mentions "several", "internalClusters" and "BEFORE assuming"

  @test:schemas/kg/detangle.test.ts::maxSize_—_size_RAISES_the_finding,_cohesion_only_shapes_it::a_large_COHESIVE_group_is_STILL_reported_—_and_as_an_adjudication
  Scenario: A large cohesive group is still reported, as an adjudication
    Given the baseline group with size 234 and cohesion 0.82
    When its failing clauses are computed
    Then a "too large" clause fires
    And it mentions "adjudication" and "PARTICIPATION"
    And it does not say "several subgraphs filed as one"

  @test:schemas/kg/detangle.test.ts::maxSize_—_size_RAISES_the_finding,_cohesion_only_shapes_it::the_two_branches_say_DIFFERENT_things,_so_cohesion_is_actually_read
  Scenario: The incoherent and cohesive wordings differ
    Given two groups of size 100, one of cohesion 0.1 and one of cohesion 0.9
    When the "too large" clause of each is read
    Then the two are not the same

  @test:schemas/kg/detangle.test.ts::maxSize_—_size_RAISES_the_finding,_cohesion_only_shapes_it::at_or_below_the_bound,_nothing_fires_—_the_boundary_is_not_off_by_one
  Scenario: The upper bound is exact
    Given groups of cohesion 0.1 sized exactly maxSize and maxSize + 1
    When their failing clauses are computed
    Then the group of size maxSize is not "too large"
    And the group of size maxSize + 1 is

  @test:schemas/kg/detangle.test.ts::maxSize_—_size_RAISES_the_finding,_cohesion_only_shapes_it::size_is_load-bearing:_a_small_group_is_never_`too_large`,_whatever_its_cohesion
  Scenario: A small group is never too large, whatever its cohesion
    Given groups of size 20 with cohesion 0.05, 0.5 and 0.95
    When their failing clauses are computed
    Then none is "too large"
    And a group of size 500 and cohesion 0.5 is

  @test:schemas/kg/detangle.test.ts::minSize_—_the_lower_bound_the_upper_one_was_missing_beside::below_it,_a_group_is_a_file_move_rather_than_a_subgraph
  Scenario: A very small group is a file move
    Given the baseline group with size 2
    When its failing clauses are computed
    Then a "file move" clause fires

  @test:schemas/kg/detangle.test.ts::minSize_—_the_lower_bound_the_upper_one_was_missing_beside::the_two_size_clauses_are_mutually_exclusive,_so_no_group_is_both
  Scenario: No group is both a file move and too large
    Given groups of cohesion 0.1 with sizes 1, 4, 5, 20, 70, 71 and 500
    When their failing clauses are computed
    Then none has both a "file move" and a "too large" clause
