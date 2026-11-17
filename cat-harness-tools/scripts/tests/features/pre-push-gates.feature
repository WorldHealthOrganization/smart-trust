# The pre-push gate hook: reading a push, the tree-keyed record, and the
# verdict on a throwaway repository whose cat runner is a stub. Each Scenario
# names the test that executes it.
Feature: The pre-push gates

  @test:scripts/tests/pre-push-gates.test.ts::parsePushCommand::a_plain_push_pushes_HEAD
  Scenario: A plain push pushes HEAD
    Then git push -u origin claude/x pushes claude/x, without --no-verify and not a dry run
    And a bare git push pushes HEAD

  @test:scripts/tests/pre-push-gates.test.ts::parsePushCommand::finds_the_push_inside_a_compound_command,_past_git's_own_options
  Scenario: A push is found inside a compound command, past git's options
    Then cd a && git -C . push origin HEAD:refs/heads/b pushes HEAD

  @test:scripts/tests/pre-push-gates.test.ts::parsePushCommand::a_delete_names_no_source
  Scenario: A delete names no source
    Then git push origin :old pushes nothing

  @test:scripts/tests/pre-push-gates.test.ts::parsePushCommand::reads_the_bypass_reason_and_--no-verify
  Scenario: The bypass reason and --no-verify are read
    Then a push prefixed with CAT_GATES_BYPASS='ci is down' and given --no-verify carries both

  @test:scripts/tests/pre-push-gates.test.ts::parsePushCommand::a_dry_run_and_a_non-push_are_told_apart
  Scenario: A dry run and a non-push are told apart
    Then git push -n is a dry run
    And a command that only echoes "git push", and git log, are not pushes

  @test:scripts/tests/pre-push-gates.test.ts::parsePushStdin_reads_git's_four_fields_per_line
  Scenario: parsePushStdin reads git's four fields per line
    Then one ref line and a blank line read as one push of local ref, local sha, remote ref and remote sha

  @test:scripts/tests/pre-push-gates.test.ts::the_record::only_a_pass_that_names_its_gate_set_is_recorded
  Scenario: Only a pass that names its gate set is recorded
    Then a passing report naming its commands is recorded with those gates
    And a failing report, one naming no commands, and one whose commands disagree with its gate count are not

  @test:scripts/tests/pre-push-gates.test.ts::the_record::covers_needs_the_same_tree_and_the_same_bun
  Scenario: A record covers the same tree under the same bun only
    Then a record covers its own tree and tools
    And not another tree, not another bun version, and no record covers nothing

  @test:scripts/tests/pre-push-gates.test.ts::newFailures:_only_a_gate_green_on_the_base,_under_the_same_bun,_is_this_push's
  Scenario: Only a gate green on the base, under the same bun, is this push's failure
    Given a base where a passed, b failed and c was skipped
    Then the new failures among a, b, c and d are a and c
    And under another bun, or with no base, there are none

  @test:scripts/tests/pre-push-gates.test.ts::judge,_on_a_throwaway_repository::a_pass_is_recorded,_never_noted_on_the_commit,_and_the_same_tree_is_not_judged_twice
  Scenario: A pass is recorded, never noted on the commit, and the same tree is not judged twice
    Given a stub runner that passes
    When HEAD is judged it is allowed, the runner ran once, and the tree's record covers it
    And no note is attached to the commit
    And after amending only the message, the push is allowed with no second run

  @test:scripts/tests/pre-push-gates.test.ts::judge,_on_a_throwaway_repository::the_time_budget:_a_read-only_gate_timed_over_it_here_is_held_out_of_the_next_run,_and_the_seed_covers_what_is_not_timed_yet
  Scenario: A gate timed over budget here is held out of the next run, and the seed covers what is not timed
    Given a passing stub that prints check:a at 75 s and check:b at 3 s
    When HEAD is first judged, the whole suite and the seed's gates are held out, check:a is not, and both durations are recorded
    And on a new tree check:a is held out and check:b is not
    And with a budget of 0 only the whole suite is held out

  @test:scripts/tests/pre-push-gates.test.ts::judge,_on_a_throwaway_repository::a_red_gate_with_no_base_outcome_to_compare_against_is_undetermined,_not_refused,_and_leaves_no_record
  Scenario: A red gate with no base outcome is undetermined and leaves no record
    Given a stub runner that fails check:a
    When HEAD is judged
    Then the verdict is undetermined, no record is written, and the failure is kept as the tree's result

  @test:scripts/tests/pre-push-gates.test.ts::judge,_on_a_throwaway_repository::a_tree_lacking_the_publish_pages:_the_environment's_red_is_not_this_push's,_so_the_push_is_not_refused
  Scenario: A red the base shares is not this push's
    Given check:pages is red on the base for lack of publish pages
    When a harmless change is judged against that base
    Then the verdict is undetermined naming check:pages

  @test:scripts/tests/pre-push-gates.test.ts::judge,_on_a_throwaway_repository::a_gate_green_on_the_base_and_red_now_is_this_push's,_and_refuses
  Scenario: A gate green on the base and red now refuses
    Given a change that breaks check:a, judged against a base where it was green
    Then the verdict is refuse naming check:a and not check:pages

  @test:scripts/tests/pre-push-gates.test.ts::judge,_on_a_throwaway_repository::a_passing_record_stands_as_the_base's_outcomes
  Scenario: A passing record stands as the base's outcomes
    Given a passing judgement whose results directory is then removed
    Then the base's result for check:a reads pass from the record

  @test:scripts/tests/pre-push-gates.test.ts::judge,_on_a_throwaway_repository::exit_2_is_undetermined,_not_a_pass
  Scenario: Exit 2 is undetermined
    Given a stub runner that exits 2
    Then the verdict is undetermined

  @test:scripts/tests/pre-push-gates.test.ts::judge,_on_a_throwaway_repository::a_dirty_tracked_file_is_not_judged_(never_refused),_and_no_gate_runs
  Scenario: A dirty tracked file is not judged and no gate runs
    Given a tracked file changed and not committed
    Then the verdict is undetermined naming the file, and the runner did not run

  @test:scripts/tests/pre-push-gates.test.ts::judge,_on_a_throwaway_repository::a_commit_that_is_not_checked_out_(a_branch-store_push)_is_allowed_unjudged,_never_refused
  Scenario: A commit that is not checked out is allowed unjudged
    Given a failing stub and a commit on no checked-out branch
    Then the verdict is allow saying it was not judged, and the runner did not run

  @test:scripts/tests/pre-push-gates.test.ts::judge,_on_a_throwaway_repository::no_cat_runner_is_undetermined
  Scenario: No cat runner is undetermined
    Given a package.json with no cat script
    Then the verdict is undetermined and no state directory is created

  @test:scripts/tests/pre-push-gates.test.ts::failedTests_reads_bun's_JUnit_report,_failures_only,_entities_decoded
  Scenario: failedTests reads bun's JUnit report, failures only, entities decoded
    Then a report with one passing and one failing test names only "a.test.ts > grp > bad & <x>"

  @test:scripts/tests/pre-push-gates.test.ts::the_affected_tests,_run_for_real_in_a_throwaway_repository::a_test_green_at_the_base_and_red_now_refuses;_one_red_at_the_base_too_does_not;_the_tree_is_put_back
  Scenario: A test green at the base and red now refuses; one red at the base does not
    Given lib.ts changed so its test fails, and an environment test red at the base too
    When HEAD is judged
    Then the verdict is refuse naming lib.test.ts > one is 1 and not the environment test, and the tree is clean afterwards

  @test:scripts/tests/pre-push-gates.test.ts::the_affected_tests,_run_for_real_in_a_throwaway_repository::a_change_whose_only_red_is_the_environment's_is_undetermined,_never_refused
  Scenario: A change whose only red is the environment's is undetermined
    Given a harmless change to lib.ts
    When HEAD is judged
    Then the verdict is undetermined, saying the red is red at the base

  @test:scripts/tests/pre-push-gates.test.ts::the_affected_tests,_run_for_real_in_a_throwaway_repository::a_change_no_test_imports_runs_no_test,_and_the_push_is_allowed_and_recorded
  Scenario: A change no test imports runs no test and is allowed
    Given a change to other.ts, which no test imports
    When HEAD is judged
    Then the verdict is allow with 0 affected test files

  @test:scripts/tests/pre-push-gates.test.ts::off_by_default:_the_gates_run_only_when_the_checkout_opts_in::gatesEnabled_reads_the_env_first,_then_git_config
  Scenario: gatesEnabled reads the environment first, then git config
    Then with nothing set the gates are off, and CAT_PREPUSH_GATES=1 turns them on
    And with cat.gates.prePush true they are on, unless CAT_PREPUSH_GATES=0

  @test:scripts/tests/pre-push-gates.test.ts::off_by_default:_the_gates_run_only_when_the_checkout_opts_in::the_git_hook,_off,_lets_the_push_go_at_once,_says_so_and_logs_it
  Scenario: The git hook, off, lets the push go, says so and logs it
    Given the gates are off and the runner would fail every gate
    When the git hook runs on a push
    Then it exits 0, says gates were not run because they are off by default, and logs an off event

  @test:scripts/tests/pre-push-gates.test.ts::off_by_default:_the_gates_run_only_when_the_checkout_opts_in::the_Claude_hook,_off,_never_blocks,_even_a_--no-verify_push
  Scenario: The Claude hook, off, never blocks, even a --no-verify push
    Given the gates are off
    When the Claude hook runs on a git push --no-verify
    Then it exits 0 and says the gates are off by default

  @test:scripts/tests/pre-push-gates.test.ts::the_affected_tests_never_inherit_BUN_OPTIONS_(a_CI_shard's_--shard_and_--reporter-outfile)
  Scenario: The affected tests never inherit BUN_OPTIONS
    When the test environment is made from one carrying BUN_OPTIONS and PATH
    Then BUN_OPTIONS is gone and PATH is kept
