# restoringTracked (test/support/checkout.ts) runs a writer over the real tree, then puts back every tracked
# file under the given directories that it changed or deleted, leaving files it added.
# Each Scenario names the test that executes it.
Feature: Restoring tracked files after a writer runs

  @test:test/restoring-tracked.test.ts::restoringTracked::a_changed_and_a_deleted_tracked_file_are_put_back;_an_added_file_is_left;_the_result_is_returned
  Scenario: Changed and deleted tracked files are restored, an added file is left, and the result is returned
    Given a git repository with tracked files "test/results/witnesses/a.json" and "b.json"
    When restoringTracked over "test/results" runs a writer that changes a.json, deletes b.json, adds new.json and returns 7
    Then inside the run a.json reads the writer's bytes
    And restoringTracked returns 7
    And git status shows only "?? test/results/witnesses/new.json"
    And after removing new.json git status is clean

  @test:test/restoring-tracked.test.ts::restoringTracked::a_whole_tracked_directory_removed_by_the_run_comes_back
  Scenario: A tracked directory removed by the run is restored
    Given a git repository with tracked files under "test/results/witnesses"
    When restoringTracked over "test/results" runs a writer that removes the whole witnesses directory
    Then "test/results/witnesses/a.json" exists again
    And git status is clean

  @test:test/restoring-tracked.test.ts::restoringTracked::it_restores_when_the_run_throws,_and_the_error_still_reaches_the_caller
  Scenario: A throwing writer is restored after and its error is rethrown
    Given a git repository with tracked files under "test/results/witnesses"
    When restoringTracked runs a writer that overwrites a.json and throws "writer failed"
    Then the call throws "writer failed"
    And git status is clean

  @test:test/restoring-tracked.test.ts::restoringTracked::only_what_lies_under_the_directories_given_is_protected
  Scenario: A tracked file outside the given directories is not restored
    Given a git repository with a tracked "outside.txt" at its root
    When restoringTracked over "test/results" runs a writer that changes "outside.txt"
    Then git status shows " M outside.txt"
