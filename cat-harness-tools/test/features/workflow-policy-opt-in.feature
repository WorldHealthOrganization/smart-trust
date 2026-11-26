# validateRelaxations in src/workflow/gate.ts judges each relaxation against the processes on disk; a
# process found nowhere is undetermined only while a declared opt-in group is unmounted.
# Each Scenario names the test that executes it.
Feature: Relaxations of processes in opt-in groups

  @test:test/workflow-policy-opt-in.test.ts::relaxations_of_processes_in_opt-in_groups::group_on_disk:_judged,_and_legal
  Scenario: A relaxation of a relaxable activity in a process on disk is legal
    Given process "Process_Editing" with relaxable "Task_SmeReview" and non-relaxable "Task_Gate"
    When a relaxation of "Task_SmeReview" is validated
    Then nothing is returned as undetermined

  @test:test/workflow-policy-opt-in.test.ts::relaxations_of_processes_in_opt-in_groups::group_on_disk:_a_renamed_activity_still_fails
  Scenario: A relaxation naming an unknown activity fails
    Given process "Process_Editing" on disk and no unseen groups
    When a relaxation of "Task_Renamed" is validated
    Then a PolicyError is thrown

  @test:test/workflow-policy-opt-in.test.ts::relaxations_of_processes_in_opt-in_groups::group_on_disk:_a_non-relaxable_step_still_fails,_even_with_another_group_unseen
  Scenario: A relaxation of a non-relaxable step fails even while another group is unseen
    Given process "Process_Editing" on disk and unseen group "x.collab"
    When a relaxation of "Task_Gate" is validated
    Then a PolicyError is thrown

  @test:test/workflow-policy-opt-in.test.ts::relaxations_of_processes_in_opt-in_groups::group_not_mounted:_undetermined,_returned_rather_than_passed
  Scenario: A relaxation of a process in an unmounted group is returned as undetermined
    Given no processes on disk and unseen group "x.collab (collab)"
    When a relaxation of "Process_Editing" "Task_SmeReview" is validated
    Then that relaxation is returned

  @test:test/workflow-policy-opt-in.test.ts::relaxations_of_processes_in_opt-in_groups::every_group_mounted:_a_process_that_exists_nowhere_fails
  Scenario: With every group mounted, a relaxation of a missing process fails
    Given process "Process_Editing" on disk and no unseen groups
    When a relaxation of "Process_Gone" is validated
    Then it throws an error mentioning "not a process here"

  @test:test/workflow-policy-opt-in.test.ts::relaxations_of_processes_in_opt-in_groups::group_switched_off_but_on_disk:_legal,_and_INACTIVE_rather_than_an_error
  Scenario: A legal relaxation of a process whose group is switched off is inactive, not an error
    Given process "Process_Editing" on disk and no unseen groups
    When a relaxation of "Task_SmeReview" is validated
    Then nothing is returned as undetermined
    And with no active processes the relaxation is reported as inactive

  @test:test/workflow-policy-opt-in.test.ts::relaxations_of_processes_in_opt-in_groups::group_switched_on:_active
  Scenario: A relaxation of a process in a switched-on group is active
    Given a relaxation of "Process_Editing" "Task_SmeReview"
    When inactive relaxations are found with "Process_Editing" active
    Then none is reported

  @test:test/workflow-policy-opt-in.test.ts::relaxations_of_processes_in_opt-in_groups::undetermined_is_not_also_inactive
  Scenario: An undetermined relaxation is not also reported inactive
    Given a relaxation of "Process_Editing" "Task_SmeReview" that is undetermined
    When inactive relaxations are found with no active processes
    Then none is reported
