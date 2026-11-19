# scripts/check-bean-parents.ts treats `feature` as a tier between epic and task/bug: it accepts
# work under a feature, refuses inverted hierarchies, and its summary never overstates a baselined
# defect. Each Scenario names the test that executes it.
Feature: Feature as a tier of the bean hierarchy

  @test:scripts/tests/bean-parents-feature-tier.test.ts::a_feature_may_hold_work_—_the_ruling::a_task_parented_to_a_FEATURE_is_accepted
  Scenario: A task parented to a feature is accepted
    Given a scratch store with epic "ep1", feature "ft1" under it, and task "t1" under "ft1"
    When the bean parents are checked
    Then there are no problems

  @test:scripts/tests/bean-parents-feature-tier.test.ts::a_feature_may_hold_work_—_the_ruling::a_bug_parented_to_a_feature_is_accepted_too_—_`task/bug`_is_one_tier
  Scenario: A bug parented to a feature is accepted, since task and bug are one tier
    Given a scratch store with epic "ep1", feature "ft1" under it, and bug "b1" under "ft1"
    When the bean parents are checked
    Then there are no problems

  @test:scripts/tests/bean-parents-feature-tier.test.ts::a_feature_may_hold_work_—_the_ruling::a_feature_still_needs_a_parent_of_its_own_—_it_is_a_tier,_not_a_root
  Scenario: A feature still needs a parent of its own
    Given a scratch store with one feature and no parent
    When the bean parents are checked
    Then there is one problem
    And it says there is "no `parent`"

  @test:scripts/tests/bean-parents-feature-tier.test.ts::the_direction_is_checked,_not_just_the_type_—_what_widening_opened_up::an_EPIC_parented_to_a_feature_is_refused
  Scenario: An epic parented to a feature is refused
    Given a scratch store with epic "ep1", feature "ft1" under it, and epic "ep2" under "ft1"
    When the bean parents are checked
    Then there is one problem
    And it says "an epic's parent is a `milestone`"

  @test:scripts/tests/bean-parents-feature-tier.test.ts::the_direction_is_checked,_not_just_the_type_—_what_widening_opened_up::a_feature_nested_in_a_feature_is_refused
  Scenario: A feature nested in a feature is refused
    Given a scratch store with epic "ep1", feature "ft1" under it, and feature "ft2" under "ft1"
    When the bean parents are checked
    Then there is one problem
    And it says the bean "hangs below" its parent

  @test:scripts/tests/bean-parents-feature-tier.test.ts::the_direction_is_checked,_not_just_the_type_—_what_widening_opened_up::a_MILESTONE_parented_to_an_epic_is_refused_—_the_inversion_at_the_top
  Scenario: A milestone parented to an epic is refused as an inversion at the top
    Given a scratch store with epic "ep1" and milestone "m1" under it
    When the bean parents are checked
    Then there is one problem
    And it says the bean "hangs below" its parent

  @test:scripts/tests/bean-parents-feature-tier.test.ts::the_direction_is_checked,_not_just_the_type_—_what_widening_opened_up::...and_the_direction_message_names_BOTH_types,_so_the_reader_sees_the_inversion
  Scenario: The direction message names both types so the reader sees the inversion
    Given a scratch store with feature "ft2" under feature "ft1" under epic "ep1"
    When the bean parents are checked
    Then the first problem says "hangs below"
    And it names "`feature`"

  @test:scripts/tests/bean-parents-feature-tier.test.ts::the_epic-under-epic_case_keeps_its_OWN_branch,_and_that_is_deliberate::it_still_reports_the_epic-specific_wording,_not_the_generic_direction_one
  Scenario: An epic under an epic keeps the epic-specific wording, not the generic direction one
    Given a scratch store with epic "ep2" under epic "ep1"
    When the bean parents are checked
    Then there is one problem
    And it says "an epic's parent is a `milestone`"
    And it does not say "hangs below"

  @test:scripts/tests/bean-parents-feature-tier.test.ts::a_type_the_hierarchy_does_not_mention_is_not_direction-checked::an_unranked_type_under_an_epic_is_accepted_rather_than_guessed_at
  Scenario: An unranked type under an epic is accepted rather than guessed at
    Given a scratch store with a "chore" bean under epic "ep1"
    When the bean parents are checked
    Then there are no problems

  @test:scripts/tests/bean-parents-feature-tier.test.ts::the_summary_never_asserts_a_universal_the_next_line_refutes::with_nothing_baselined_the_unqualified_claim_stands
  Scenario: With nothing baselined the summary's unqualified claim stands
    Given a report with no problems and nothing outstanding
    When it is formatted
    Then it says "every epic from a milestone"
    And it does not say "NEW"

  @test:scripts/tests/bean-parents-feature-tier.test.ts::the_summary_never_asserts_a_universal_the_next_line_refutes::with_something_baselined_the_claim_is_narrowed_to_NEW
  Scenario: With something baselined the summary's claim is narrowed to new epics
    Given a report with no problems and one outstanding baselined entry
    When it is formatted
    Then it says "every NEW epic from a milestone"
    And it says "1 baselined defect(s)"

  @test:scripts/tests/bean-parents-feature-tier.test.ts::the_summary_never_asserts_a_universal_the_next_line_refutes::...and_the_outstanding_entry_is_still_printed,_so_it_is_not_hidden_either
  Scenario: The outstanding baselined entry is still printed
    Given a report with one outstanding baselined entry
    When it is formatted
    Then it says "outstanding"

  @test:scripts/tests/bean-parents-feature-tier.test.ts::the_summary_never_asserts_a_universal_the_next_line_refutes::the_tick_and_the_counterexample_never_appear_together_unqualified
  Scenario: The tick and the counterexample never appear together unqualified
    Given a report with one outstanding entry "some epic under some epic"
    When it is formatted
    Then it does not both tick "no epic hangs from another" and list an outstanding counterexample
