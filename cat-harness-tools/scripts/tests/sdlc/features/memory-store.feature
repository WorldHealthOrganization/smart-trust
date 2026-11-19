# The memory store as run files (src/workflow/memory-file-store.ts) on disk, and the engine
# keeping work context in run files when the deployment chooses run-files (src/workflow/work-context.ts).
# Each Scenario names the test that executes it.
Feature: Run-file memory store

  @test:scripts/tests/sdlc/memory-store.test.ts::run_files:_what_is_on_disk::a_record_is_memory-record/1.0.0,_and_each_entry_one_JSON_line
  Scenario: A run-file record is memory-record/1.0.0 and each entry is one JSON line
    Given a run-file memory store in a fresh directory
    When memory "m1" is opened and one note is kept in it
    Then "m1/record.json" has $schema "memory-record/1.0.0"
    And "m1/entries.jsonl" holds exactly one line

  @test:scripts/tests/sdlc/memory-store.test.ts::run_files:_what_is_on_disk::an_id_that_would_leave_the_store's_directory_is_refused
  Scenario: An id that would leave the store's directory is refused
    Given a run-file memory store
    When memory "../escape" is opened
    Then the open is "refused"
    And keeping an entry in "../escape" yields "none"

  @test:scripts/tests/sdlc/memory-store.test.ts::run_files:_what_is_on_disk::a_torn_line_is_skipped,_never_fatal_to_the_rest_of_the_memory
  Scenario: A torn entry line is skipped without losing the rest of the memory
    Given memory "m1" holding one note "first"
    And a truncated JSON fragment appended to its entries file
    When "m1" is recalled
    Then it is a hit whose entries are just "first"

  @test:scripts/tests/sdlc/memory-store.test.ts::the_engine_keeps_work_context_in_run_files_when_the_deployment_says_so::run-files_needs_CAT_MEMORY_DIR,_and_says_so
  Scenario: Run-files work context needs CAT_MEMORY_DIR and says so
    Given a deployment that keeps work context in "run-files"
    When the work context is made with no environment variables
    Then it throws an error naming CAT_MEMORY_DIR

  @test:scripts/tests/sdlc/memory-store.test.ts::the_engine_keeps_work_context_in_run_files_when_the_deployment_says_so::taken_up_and_a_step_done_land_in_the_run's_files;_no_work-plan_status_is_touched
  Scenario: Taking up and a step done land in the run's files
    # Gap: that no work-plan status is touched is not checked directly
    Given a deployment that keeps work context in "run-files" with CAT_MEMORY_DIR set
    And an item memory "case-1" opened in that directory
    When the work context is made
    Then its tool is "run-files"
    When case-1 is taken up
    Then the summary is "work context kept on case-1 (taken-up)"
    When a step-done for node "Task_X" is recorded
    Then recalling case-1 yields entries "taken-up" and "step-done" at step "Task_X"
