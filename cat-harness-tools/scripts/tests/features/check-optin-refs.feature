# scripts/check-optin-refs.ts reports workflows that name a skill held only in an opt-in sub-graph
# the workflow's own group does not switch on, without rewriting them.
# Each Scenario names the test that executes it.
Feature: Skill references into opt-in groups

  @test:scripts/tests/check-optin-refs.test.ts::which_references_are_read::every_skill_ref_of_a_workflow,_prefixed_or_not
  Scenario: Every skill reference of a workflow is read, prefixed or not
    Given a BPMN workflow with namespaced skill refs "a" and "pkg/b", plus an unprefixed skill ref "c"
    When its skill references are read
    Then they are "a", "pkg/b" and "c"

  @test:scripts/tests/check-optin-refs.test.ts::which_references_are_read::a_skill_held_only_in_opt-in_groups,_from_outside_them,_is_opt-in_only
  Scenario: A skill held only in opt-in groups is opt-in only from outside them
    Given skill "only" held only in group "x.grp", and skill "both" held there and always-on
    Then "only" and "pkg/only" from always-on code are opt-in only in "x.grp"
    And "only" from within "x.grp" is not
    And "only" from group "x.other" is opt-in only in "x.grp"
    And "both" is never opt-in only
    And "only" from a group that requires "x.grp", directly or through another group, is not
    And a skill no layer holds is not reported

  @test:scripts/tests/check-optin-refs.test.ts::the_check::an_always-on_workflow_naming_an_opt-in-only_skill_is_a_finding;_the_rest_are_not
  Scenario: An always-on workflow naming an opt-in-only skill is a finding
    Given skill "only" held in opt-in "grp/", skill "shared" held always-on and in "grp/"
    And "processes/main.bpmn" names "only", "shared" and "nowhere", and "grp/processes/inner.bpmn" names "only"
    When the opt-in references are checked
    Then 2 workflows are read
    And the only finding is "processes/main.bpmn" naming "only" from the "grp" group

  @test:scripts/tests/check-optin-refs.test.ts::the_check::a_workflow_in_ANOTHER_opt-in_group_naming_it_is_a_finding:_each_group_is_switched_on_alone
  Scenario: A workflow in another opt-in group naming the skill is a finding
    Given skill "only" held in opt-in "grp/" and a workflow in opt-in "more/" naming it
    When the opt-in references are checked
    Then the only finding is "more/processes/other.bpmn" naming "only" from the "grp" group

  @test:scripts/tests/check-optin-refs.test.ts::the_check::a_workflow_in_a_group_that_REQUIRES_the_skill's_group_is_not_a_finding;_the_other_way_round_still_is
  Scenario: A group that requires the skill's group may name it, but not the reverse
    Given "more/" requires "grp/", a workflow in "more/" names grp's skill "only", and a workflow in "grp/" names more's skill "extra"
    When the opt-in references are checked
    Then the only finding is "grp/processes/back.bpmn" naming "extra" from the "more" group

  @test:scripts/tests/check-optin-refs.test.ts::the_check::nothing_opt-in-only_referenced:_no_finding
  Scenario: Naming only always-on skills is no finding
    Given an always-on workflow naming the always-on skill "shared"
    When the opt-in references are checked
    Then there are no findings
