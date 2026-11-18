# A lane, its role, and that role's skills, as the processes viewer shows
# them: the binding verdict is laneBinding's, role skills are closed over
# inheritance, and role skills and activity skills are two lists.
Feature: A lane's detail names its role and that role's skills

  @test:scripts/tests/process/lane-detail.test.ts::the_binding_verdict_is_`laneBinding`'s,_not_this_file's::a_lane_bound_by_an_explicit_ref_resolves
  Scenario: A lane with an explicit role ref is bound
    Given a role graph with reviewer, adjudicator (inheriting reviewer) and corpus
    When the detail of a lane with roleRef "adjudicator" is computed
    Then its binding is "bound" and its role is "adjudicator"

  @test:scripts/tests/process/lane-detail.test.ts::the_binding_verdict_is_`laneBinding`'s,_not_this_file's::a_lane_with_no_`roleRef`_is_UNBOUND,_whatever_its_name
  Scenario: A lane named like a role but with no ref is unbound
    Given the role graph
    When the detail of a lane named "Reviewer" with no roleRef is computed
    Then its binding is "unbound"

  @test:scripts/tests/process/lane-detail.test.ts::the_binding_verdict_is_`laneBinding`'s,_not_this_file's::a_ref_naming_no_declared_role_is_`dangling`,_not_`unbound`
  Scenario: A ref to an undeclared role is dangling
    Given the role graph
    When the detail of a lane with roleRef "ghost" is computed
    Then its binding is "dangling"
    And it has no role skills

  @test:scripts/tests/process/lane-detail.test.ts::the_binding_verdict_is_`laneBinding`'s,_not_this_file's::`variable`_is_a_lane_whose_performer_varies_BY_DESIGN,_never_a_defect
  Scenario: A lane whose performer varies is variable
    Given the role graph
    When the detail of a lane marked performerVaries is computed
    Then its binding is "variable"

  @test:scripts/tests/process/lane-detail.test.ts::the_binding_verdict_is_`laneBinding`'s,_not_this_file's::declaring_BOTH_a_ref_and_`variable`_is_`contradictory`
  Scenario: A lane with both a ref and performerVaries is contradictory
    Given the role graph
    When the detail of a lane with roleRef "adjudicator" and performerVaries is computed
    Then its binding is "contradictory"

  @test:scripts/tests/process/lane-detail.test.ts::the_binding_verdict_is_`laneBinding`'s,_not_this_file's::a_lane_matching_nothing_and_declaring_nothing_is_`unbound`
  Scenario: A lane declaring nothing is unbound
    Given the role graph
    When the detail of a lane named "Nowhere" with no ref is computed
    Then its binding is "unbound"

  @test:scripts/tests/process/lane-detail.test.ts::the_binding_verdict_is_`laneBinding`'s,_not_this_file's::an_unreadable_role_graph_reports_`ungraphed`_—_bean_`7go7`,_resolved
  Scenario: With no role graph a lane is ungraphed
    Given no role graph
    When the detail of a lane with roleRef "adjudicator" is computed
    Then its binding is "ungraphed"
    And it has no role skills and no role

  @test:scripts/tests/process/lane-detail.test.ts::role_skills_are_CLOSED_over_inheritance::an_inherited_skill_is_included,_and_says_which_ancestor_gave_it
  Scenario: An inherited skill is included with its ancestor
    Given the role graph
    When the detail of a lane bound to "adjudicator" is computed
    Then its role skills are "adjudication" and "read-findings"
    And "read-findings" comes via "reviewer" at a depth above 0

  @test:scripts/tests/process/lane-detail.test.ts::role_skills_are_CLOSED_over_inheritance::a_role_declaring_no_skills_gives_a_DETERMINED_zero,_and_still_binds
  Scenario: A role with no skills still binds, with no role skills
    Given the role graph
    When the detail of a lane bound to "corpus" is computed
    Then its binding is "bound"
    And its role skills are empty

  @test:scripts/tests/process/lane-detail.test.ts::role_skills_and_activity_skills_are_two_lists::they_are_not_folded_together,_and_neither_contains_the_other
  Scenario: Role skills and activity skills are kept apart
    Given the role graph and activities in the "Adjudicator" lane naming "adjudication" and "untainted-verification"
    When the detail of the lane bound to "adjudicator" is computed
    Then the role skills contain "read-findings" and the activity skills do not
    And the activity skills contain "untainted-verification" and the role skills do not

  @test:scripts/tests/process/lane-detail.test.ts::role_skills_and_activity_skills_are_two_lists::activity_skills_are_scoped_to_THIS_lane
  Scenario: Activity skills come only from the lane's own activities
    Given the role graph and activities in the "Adjudicator" and "Reviewer" lanes
    When the detail of the "Reviewer" lane is computed
    Then its activity skills are exactly "content-feedback"

  @test:scripts/tests/process/lane-detail.test.ts::role_skills_and_activity_skills_are_two_lists::a_lane_with_no_activities_has_an_empty_list_rather_than_the_union
  Scenario: A lane with no activities has no activity skills
    Given the role graph and activities in other lanes only
    When the detail of the "Corpus" lane is computed
    Then its activity skills are empty

  @test:scripts/tests/process/lane-detail.test.ts::the_real_corpus::lanes_resolve,_and_a_bound_one_names_the_role_it_resolved_to
  Scenario: In the real corpus, bound lanes name their role
    Given the process rows of the checkout's diagrams
    When their lane details are collected
    Then there are more than 50 lanes and at least one is bound
    And every bound lane names a role

  @test:scripts/tests/process/lane-detail.test.ts::the_real_corpus::at_least_one_real_lane_carries_an_INHERITED_skill
  Scenario: Some real lane carries an inherited role skill
    Given the process rows of the checkout's diagrams
    When their lane details are collected
    Then some lane has a role skill at a depth above 0
