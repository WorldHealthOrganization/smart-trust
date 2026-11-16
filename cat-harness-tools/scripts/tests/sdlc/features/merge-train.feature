# scripts/merge-train.ts (`merge:train`) builds a merge train: it parses merge-base and
# merge-tree output, decides the train's verdict, and simulates a dry run on a real history.
# Each Scenario names the test that executes it.
Feature: Merge train parsing, verdict and dry run

  @test:scripts/tests/sdlc/merge-train.test.ts::merge-base_log_parsing::refused_paths_are_the_✗_lines,_with_or_without_a_pattern
  Scenario: Refused paths are the cross-marked lines, with or without a pattern
    Given a merge-base log with two ticked and two crossed conflicted paths
    When the refused paths are parsed from it
    Then they are "cat-harness/scripts/x.ts" and "beans/defs/y.md"

  @test:scripts/tests/sdlc/merge-train.test.ts::merge-base_log_parsing::every_conflicted_path_is_recovered_with_its_pattern_and_strategy
  Scenario: Every conflicted path is recovered with its pattern and strategy
    Given a merge-base log with four conflicted paths
    When the conflicted paths are parsed from it
    Then the lsi index is glossary take-base and beans/README.md is readme-generated-regions generated-regions
    And "cat-harness/scripts/x.ts" is refuse with no pattern
    And "beans/defs/y.md" is beans refuse

  @test:scripts/tests/sdlc/merge-train.test.ts::merge-base_log_parsing::the_abort_reason_is_the_ABORTED_line's,_else_the_last_line
  Scenario: The abort reason is the ABORTED line's, else the last line
    Given a merge-base log ending in an ABORTED line
    When the abort reason is parsed from it
    Then it is "2 conflict(s) need a person (✗ above)"
    And for a log of only "merge-base: no such base deadbeef" the reason is that line

  @test:scripts/tests/sdlc/merge-train.test.ts::merge-base_log_parsing::a_train_re-asks_every_declared_afterMerge_check,_and_only_those_with_a_writer_(bean_0r7u)
  Scenario: A train re-asks every declared afterMerge check that has a writer
    Given four checks: two with afterMerge and a writer, one with a writer only, one with neither
    When the after-merge repairs are listed
    Then they are a:check with a:write and b:check with b:all, sorted by check name

  @test:scripts/tests/sdlc/merge-train.test.ts::merge-base_log_parsing::with_no_instance_declaring_one,_a_train_re-asks_nothing_extra
  Scenario: With no check declared, a train re-asks nothing extra
    Given no declared checks
    When the after-merge repairs are listed
    Then the list is empty

  @test:scripts/tests/sdlc/merge-train.test.ts::merge-base_log_parsing::merge-tree_output:_clean,_conflicted,_and_a_failure_that_is_neither
  Scenario: merge-tree output is read as clean, conflicted, or a failure that is neither
    Given merge-tree results with exit 0 and a tree, exit 1 with a tree and repeated paths, and exit 128 with no output
    When each is parsed
    Then exit 0 is the tree with no conflicts
    And exit 1 is the tree with the conflicted paths "x" and "y", deduplicated
    And exit 128 is undefined

  @test:scripts/tests/sdlc/merge-train.test.ts::merge-base_log_parsing::conflicts_are_classified_by_the_same_patterns_merge-base_acts_on
  Scenario: Conflicts are classified by the same patterns merge-base acts on
    Given conflicts on the generated lsi index and "src/a.ts"
    When they are classified
    Then "src/a.ts" is refused
    And the lsi index is matched by the "glossary" pattern

  @test:scripts/tests/sdlc/merge-train.test.ts::verdictOf::built_only_when_nothing_needs_a_person
  Scenario: A train is built only when nothing needs a person
    Given a report with one merged member, a passed regen check and a merged main
    When its verdict is taken
    Then it is "built"
    And a refused member, a check with findings, or a refused main makes it "needs-a-person"
    And a repaired check still leaves it "built"

  @test:scripts/tests/sdlc/merge-train.test.ts::simulate_—_the_dry_run_on_a_real_history::members_merge_onto_the_SIMULATED_train;_an_authored_conflict_is_refused;_a_generated_one_is_not
  Scenario: The dry run merges members onto the simulated train without touching the repo
    Given a real repo where branch one and two both change the generated lsi index and branch three changes a.ts like one
    When members one, two, three and one again are simulated
    Then their statuses are would-merge, would-merge, would-refuse and already-contained
    And two's conflict is the lsi index, glossary take-base
    And three's refused path is "a.ts"
    And no ref and no working-tree file changed
    And main is skipped

  @test:scripts/tests/sdlc/merge-train.test.ts::simulate_—_the_dry_run_on_a_real_history::main_is_merged_last_onto_the_simulated_train
  Scenario: main is merged last onto the simulated train
    Given a real repo where branch one and main both change the generated lsi index
    When member one is simulated with main
    Then main would merge
    And main's first conflicted path is the lsi index

  @test:scripts/tests/sdlc/merge-train.test.ts::merge-tree_exit_status_—_the_negative_control_(bean_0s6w)::a_known-conflicted_pair_reads_1,_with_the_conflicted_path
  Scenario: A known-conflicted pair reads exit 1 with the conflicted path
    Given a real repo with two commits changing a.ts differently from one base
    When merge-tree writes a tree for the pair
    Then it exits 1
    And the parsed conflicted paths are "a.ts"

  @test:scripts/tests/sdlc/merge-train.test.ts::merge-tree_exit_status_—_the_negative_control_(bean_0s6w)::a_ref_it_cannot_merge_is_NOT_clean_and_NOT_a_conflict_list_—_and_its_exit_code_alone_cannot_say_so
  Scenario: A ref merge-tree cannot merge is neither clean nor a conflict list
    Given a real repo with a known commit
    When merge-tree is run against an all-zero sha
    Then the exit code is not 0
    And parsing the result gives undefined
    And milestone-status reads the pair's conflicts as undefined

  @test:scripts/tests/sdlc/merge-train.test.ts::merge-tree_exit_status_—_the_negative_control_(bean_0s6w)::milestone-status_still_reads_a_real_conflict,_and_a_clean_pair,_from_the_same_repo
  Scenario: milestone-status still reads a real conflict and a clean pair
    Given a real repo with a known-conflicted pair
    When milestone-status reads its conflicts
    Then the conflicted pair is authored "a.ts" with 0 generated
    And a commit against itself has no authored conflicts and 0 generated

  @test:scripts/tests/sdlc/merge-train.test.ts::merge-tree_exit_status_—_the_negative_control_(bean_0s6w)::the_shell_trap_itself:_$?_read_after_a_command_substitution_reports_the_SUBSTITUTION's_status
  Scenario: $? read after a command substitution reports the substitution's status
    Given a real repo with a known-conflicted pair just run through merge-tree in bash
    When "rc=$?" is echoed on its own line
    Then it prints "rc=1"
    And when echoed after a command substitution on the same line it ends in "rc=0"

  @test:scripts/tests/sdlc/merge-train.test.ts::keepTrackedIgnored_and_checkTestResultsDrops_(bean_u4up)::keepTrackedIgnored_restages_a_dropped-from-index_gitignored_file_that_exists_on_disk
  Scenario: keepTrackedIgnored restages a gitignored tracked file dropped from the index
    Given a real repo tracking a gitignored test/results file that is then removed from the index but kept on disk
    When tracked ignored files are kept against the commit that tracked it
    Then the kept list is that file
    And the working tree status is clean

  @test:scripts/tests/sdlc/merge-train.test.ts::keepTrackedIgnored_and_checkTestResultsDrops_(bean_u4up)::checkTestResultsDrops_passes_when_no_tracked_test/results_are_dropped
  Scenario: checkTestResultsDrops passes when no tracked test/results file is dropped
    Given a real repo with a tracked test/results file
    When test/results drops are checked against that commit
    Then the check passes with exit 0

  @test:scripts/tests/sdlc/merge-train.test.ts::keepTrackedIgnored_and_checkTestResultsDrops_(bean_u4up)::checkTestResultsDrops_fails_and_verdictOf_returns_needs-a-person_when_a_tracked_test/results_file_is_dropped
  Scenario: checkTestResultsDrops fails, and the train needs a person, when a tracked test/results file is dropped
    Given a real repo where a tracked test/results file is deleted in a later commit
    When test/results drops are checked against the earlier commit
    Then the check fails with exit 1, naming the file
    And a report with that check has the verdict "needs-a-person"
