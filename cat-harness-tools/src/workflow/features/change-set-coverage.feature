# src/workflow/change-set-coverage.ts decides when a running content-change-review
# instance covers a changed block, and explains a near miss when it does not.
# Each Scenario names the test that executes it.
Feature: Change-set cover for the corpus gate

  @test:src/workflow/change-set-coverage.test.ts::change-set_cover::a_running_change_set_that_made_the_change_covers_the_blocks_it_lists
  Scenario: A running change set that made the change covers the blocks it lists
    Given a running content-change-review instance for "CS-014" whose history passed "Call_MakeChange"
    And its scope lists "prose:ch11-objectives" and "tbl:handbook-at-a-glance"
    When cover is sought for "prose:ch11-objectives"
    Then it is covered by instance "contentchangereview--cs-014" and change set "CS-014"

  @test:src/workflow/change-set-coverage.test.ts::change-set_cover::a_block_the_change_set_does_not_list_is_not_covered
  Scenario: A block the change set does not list is not covered
    Given the running "CS-014" change set
    When cover is sought for "prose:annex-1"
    Then it is not covered
    And the near miss says the change sets "do not list prose:annex-1"

  @test:src/workflow/change-set-coverage.test.ts::change-set_cover::a_completed_change_set_authorises_nothing_new
  Scenario: A completed change set authorises nothing new
    Given the "CS-014" change set with status "completed"
    When cover is sought for "prose:ch11-objectives"
    Then it is not covered
    And the near miss says it is "already completed"

  @test:src/workflow/change-set-coverage.test.ts::change-set_cover::the_make_phase_must_be_finished
  Scenario: The make phase must be finished before a change set covers
    Given the "CS-014" change set whose token still sits on "Call_MakeChange" and whose history holds only the start
    Then it has not made the change in process
    And "prose:ch11-objectives" is not covered
    And the near miss names "Call_MakeChange"

  @test:src/workflow/change-set-coverage.test.ts::change-set_cover::a_completed_make_child_counts_as_the_make_phase
  Scenario: A completed make child counts as the make phase
    Given the "CS-014" change set with an empty history and a completed child instance under "Call_MakeChange"
    Then it has made the change in process

  @test:src/workflow/change-set-coverage.test.ts::change-set_cover::another_process_never_covers,_and_no_change_set_means_no_near_miss
  Scenario: Another process never covers, and gives no near miss
    Given the "CS-014" instance with process "Process_Editing"
    When cover is sought for "prose:ch11-objectives"
    Then it is not covered
    And there is no near miss
