# scripts/check-bean-parents.ts checks that every open bean hangs from a milestone, epic or feature, and that an epic's parent is a milestone; milestones and epics are roots.
# Each Scenario names the test that executes it.
Feature: Every open bean is placed under the plan

  @test:scripts/tests/check-bean-parents.test.ts::every_open_bean_belongs_to_an_epic::passes_when_each_open_bean_names_a_real_epic
  Scenario: An open task under a real epic passes
    Given a bean store with an in-progress epic "ep1" and a todo task "a1" parented to "ep1"
    When the bean parents are checked
    Then there are no problems
    And 1 open bean is counted

  @test:scripts/tests/check-bean-parents.test.ts::every_open_bean_belongs_to_an_epic::fails_on_an_open_bean_with_no_parent,_and_names_it
  Scenario: An open bean with no parent fails and is named
    Given a bean store with an epic and a todo task "a1" with no parent
    When the bean parents are checked
    Then there is 1 problem
    And it names "a1" and says "no `parent`"

  @test:scripts/tests/check-bean-parents.test.ts::every_open_bean_belongs_to_an_epic::fails_on_a_parent_that_names_no_bean
  Scenario: A parent that names no bean fails
    Given a bean store with an epic and a task parented to "ghost"
    When the bean parents are checked
    Then there is 1 problem saying "names no bean"

  @test:scripts/tests/check-bean-parents.test.ts::every_open_bean_belongs_to_an_epic::fails_on_a_parent_that_is_not_an_epic
  Scenario: A parent that is not a milestone, epic or feature fails
    Given a bean store with an epic, a task "a1" under it, and a task "a2" parented to "a1"
    When the bean parents are checked
    Then there is 1 problem
    And it names "a2" and says "not a milestone, epic or feature"

  @test:scripts/tests/check-bean-parents.test.ts::every_open_bean_belongs_to_an_epic::a_CLOSED_bean_needs_no_parent_—_history_is_not_back-filled
  Scenario: A closed bean needs no parent
    Given a bean store with an epic, a completed task and a scrapped task, neither with a parent
    When the bean parents are checked
    Then there are no problems
    And 0 open beans are counted

  @test:scripts/tests/check-bean-parents.test.ts::every_open_bean_belongs_to_an_epic::an_epic_needs_no_parent_of_its_own_—_epics_are_roots
  Scenario: An epic needs no parent of its own
    Given a bean store with two epics and no parents
    When the bean parents are checked
    Then there are no problems

  @test:scripts/tests/check-bean-parents.test.ts::every_open_bean_belongs_to_an_epic::no_bean_store_is_reported_as_such,_never_as_a_pass
  Scenario: A directory with no bean store is reported as having no store
    Given an empty directory
    When the bean parents are checked
    Then store is null
    And there are no problems

  @test:scripts/tests/check-bean-parents.test.ts::every_open_bean_belongs_to_an_epic::a_milestone_needs_no_parent_of_its_own_—_milestones_are_roots_too
  Scenario: A milestone needs no parent and is not counted as open
    Given a bean store with one in-progress milestone and no parent
    When the bean parents are checked
    Then there are no problems
    And 0 open beans are counted

  @test:scripts/tests/check-bean-parents.test.ts::every_open_bean_belongs_to_an_epic::an_epic_may_hang_from_a_milestone
  Scenario: An epic may hang from a milestone
    Given a milestone "ms1", an epic "ep1" under it and a task "t1" under the epic
    When the bean parents are checked
    Then there are no problems

  @test:scripts/tests/check-bean-parents.test.ts::every_open_bean_belongs_to_an_epic::a_task_parented_to_a_MILESTONE_is_accepted,_to_a_task_is_not
  Scenario: A task under a milestone is accepted, a task under a task is not
    Given a store with a milestone and a task parented to it
    Then checking it finds no problems
    Given a store with an epic, a task "t1" under it and a task "t2" under "t1"
    Then checking it finds 1 problem saying "not a milestone, epic or feature"

  @test:scripts/tests/check-bean-parents.test.ts::an_epic's_parent_is_a_milestone,_not_another_epic::catches_an_epic_parented_to_an_epic_—_the_rule_the_filter_made_unreachable
  Scenario: An epic parented to an epic is caught
    Given a milestone "ms1", an epic "ep1" under it and an epic "ep2" under "ep1"
    When the bean parents are checked
    Then there is 1 problem
    And it names "ep2" and says "is a `milestone`"

  @test:scripts/tests/check-bean-parents.test.ts::an_epic's_parent_is_a_milestone,_not_another_epic::an_epic_under_a_milestone_is_fine
  Scenario: An epic under a milestone is fine
    Given a milestone "ms1" and an epic "ep1" under it
    When the bean parents are checked
    Then there are no problems

  @test:scripts/tests/check-bean-parents.test.ts::an_epic's_parent_is_a_milestone,_not_another_epic::a_root_with_no_parent_is_still_excused
  Scenario: A root with no parent is still excused
    Given a milestone and an epic, neither with a parent
    When the bean parents are checked
    Then there are no problems

  @test:scripts/tests/check-bean-parents.test.ts::an_epic's_parent_is_a_milestone,_not_another_epic::the_open_count_still_excludes_roots
  Scenario: The open count excludes milestones and epics
    Given a milestone, an epic under it and a task under the epic
    When the bean parents are checked
    Then 1 open bean is counted

  @test:scripts/tests/check-bean-parents.test.ts::a_feature_may_hold_tasks,_and_still_may_not_hold_an_epic::a_task_under_a_feature_is_accepted
  Scenario: A task under a feature is accepted
    Given a milestone, an epic under it, a feature "ft1" under the epic and a task under "ft1"
    When the bean parents are checked
    Then there are no problems

  @test:scripts/tests/check-bean-parents.test.ts::a_feature_may_hold_tasks,_and_still_may_not_hold_an_epic::an_epic_under_a_feature_is_still_refused
  Scenario: An epic under a feature is refused
    Given a milestone, an epic, a feature "ft1" under the epic and an epic "ep2" under "ft1"
    When the bean parents are checked
    Then there is 1 problem
    And it names "ep2" and says "is a `milestone`"

  @test:scripts/tests/check-bean-parents.test.ts::a_feature_may_hold_tasks,_and_still_may_not_hold_an_epic::the_message_names_the_offending_parent's_type_rather_than_guessing_an_article
  Scenario: The epic-parent message names the parent's type instead of guessing an article
    Given a milestone, an epic "ep1" under it and an epic "ep2" under "ep1"
    When the bean parents are checked
    Then the problem says "has type `epic`"
    And it does not say "is a epic"
