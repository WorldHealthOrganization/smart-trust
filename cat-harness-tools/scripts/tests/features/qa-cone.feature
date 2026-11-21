# The QA working copy's dependency cone (owner card Q-CONE-2 B): main records
# each qa:refresh step's reads, and a preview reruns only the steps whose
# reads changed, putting back main's outputs for the rest. The record/skip
# Scenarios run only where strace works. Each Scenario names the test that
# executes it.
Feature: The QA dependency cone skips steps whose reads did not change

  @test:scripts/tests/qa-cone.test.ts::globMatcher::`*`_is_one_segment,_`**`_any_depth
  Scenario: A single star is one segment and a double star any depth
    Given the globs "cat-harness/test/results/detangle/**" and "cat-harness/test/results/*.qa-results.json"
    Then "detangle/a/b.json" under results matches and "x.qa-results.json" directly under results matches
    And "sub/x.qa-results.json" under results does not match, nor the bare "detangle" directory

  @test:scripts/tests/qa-cone.test.ts::coneMode::records_only_where_strace_runs;_skips_only_when_asked;_otherwise_off
  Scenario: The cone records only where strace runs and skips only when asked
    Then CAT_WRITER_RECORD with strace available is "record"
    And CAT_WRITER_RECORD and CAT_WRITER_SKIP without strace is "off"
    And CAT_WRITER_SKIP alone is "skip"
    And no variable is "off"

  @test:scripts/tests/qa-cone.test.ts::coneMode::off_runs_every_step,_unprefixed
  Scenario: Off runs every step without a prefix
    Given a cone in mode "off"
    When a step is run through it
    Then it exits 0 and the runner was given an empty prefix once

  @test:scripts/tests/qa-cone.test.ts::record_on_main,_skip_in_a_preview,_under_a_real_strace::a_recorded_step_is_skipped_in_a_fresh_tree_and_its_outputs_are_put_back
  Scenario: A recorded step is skipped in a fresh tree and its outputs put back
    Given a fixture whose step reads "in/x.txt" and writes "res/out/a.json", recorded on main under strace
    Then the record lists the read of "in/x.txt" and the output "res/out/a.json"
    When the outputs are removed and a preview runs in skip mode
    Then the step did not run and is logged "skipped"
    And "res/out/a.json" is restored reading "ONE"

  @test:scripts/tests/qa-cone.test.ts::record_on_main,_skip_in_a_preview,_under_a_real_strace::a_change_it_never_read_keeps_the_skip;_a_change_to_what_it_read,_or_to_its_script,_reruns_it
  Scenario: Only a change to what the step read, or to its script, reruns it
    Given the step recorded on main and its outputs removed
    When a file it never read changes and a preview runs
    Then the step does not run
    When "in/x.txt" changes to "two" and a preview runs
    Then the step runs once, logged as "in/x.txt changed", and its output reads "TWO"
    When the input is restored and its script is edited and a preview runs
    Then the step runs once

  @test:scripts/tests/qa-cone.test.ts::record_on_main,_skip_in_a_preview,_under_a_real_strace::no_records_from_main:_every_step_runs
  Scenario: With no records from main every step runs
    Given no record file
    When a preview runs in skip mode
    Then the step runs once, logged "no writer records from a full deploy"
