# scripts/check-standalone.ts judges a layer's tests run alone (via the probe in scripts/seed-ready.ts) against the layer's
# baseline of known failures, whole or one part at a time. Each Scenario names the test that executes it.
Feature: A layer's tests pass standing alone

  @test:scripts/tests/sdlc/check-standalone.test.ts::judge,_one_part_of_the_test_files_(--part,_S-CI6)::a_new_failure_in_the_part_is_red,_exactly_as_in_a_whole_run
  Scenario: A new failure in one part is red
    Given a baseline failing "a.test.ts > x" and "b.test.ts > y"
    And part "1/2" ran "a.test.ts" and failed "a.test.ts > x" and "a.test.ts > z"
    When the part is judged
    Then the exit is the "grew" exit
    And the report names "+ a.test.ts > z"

  @test:scripts/tests/sdlc/check-standalone.test.ts::judge,_one_part_of_the_test_files_(--part,_S-CI6)::a_listed_test_of_another_part_is_not_reported_as_passing
  Scenario: A baseline entry from another part is not reported as passing
    Given a baseline failing "a.test.ts > x" and "b.test.ts > y"
    And part "1/2" ran only "a.test.ts" and failed "a.test.ts > x"
    When the part is judged
    Then the exit is the "held" exit
    And the report does not mention "b.test.ts"

  @test:scripts/tests/sdlc/check-standalone.test.ts::judge,_one_part_of_the_test_files_(--part,_S-CI6)::a_listed_test_of_this_part_that_now_passes_is_reported
  Scenario: A baseline entry of this part that now passes is reported
    Given a baseline failing "a.test.ts > x" and "b.test.ts > y"
    And part "2/2" ran "b.test.ts" with no failures
    When the part is judged
    Then the exit is the "held" exit
    And the report names "- b.test.ts > y"

  @test:scripts/tests/sdlc/check-standalone.test.ts::judge,_one_part_of_the_test_files_(--part,_S-CI6)::an_unnamed_failure_beyond_the_whole_baseline's_allowance_is_red
  Scenario: Unnamed failures in a part beyond the whole baseline's count are red
    Given part "1/2" ran "a.test.ts" with 2 failures, one named "a.test.ts > x"
    When it is judged against a baseline of 2 failures
    Then the exit is the "grew" exit
    And against a baseline allowing 3 failures the exit is the "held" exit

  @test:scripts/tests/sdlc/check-standalone.test.ts::judge,_one_part_of_the_test_files_(--part,_S-CI6)::a_part_that_cannot_say_which_files_it_ran_is_not_held
  Scenario: A part that does not list the files it ran is undetermined
    Given part "1/2" measured with no failures and no file list
    When the part is judged
    Then the exit is the "undetermined" exit

  @test:scripts/tests/sdlc/check-standalone.test.ts::judge,_one_part_of_the_test_files_(--part,_S-CI6)::parsePart_takes_i/n_with_1_<=_i_<=_n_only
  Scenario: A part is parsed as i/n only when 1 <= i <= n
    Given the part "2/4"
    When it is parsed
    Then it is i 2 of n 4
    And "0/4", "5/4", "x", "1/0", an empty string and no value each parse to nothing

  @test:scripts/tests/sdlc/check-standalone.test.ts::judge,_one_part_of_the_test_files_(--part,_S-CI6)::parseJunitFiles_names_each_outermost_suite_once
  Scenario: Each outermost JUnit suite is named once
    Given JUnit XML with suite "a.test.ts" holding a nested "describe" suite, and suite "b &amp; c.test.ts"
    When its files are read
    Then they are "a.test.ts" and "b & c.test.ts"

  @test:scripts/tests/sdlc/check-standalone.test.ts::judge::the_same_failing_set_holds
  Scenario: The same failing set holds
    Given a baseline failing "a > b"
    When a run failing exactly "a > b" is judged
    Then the exit is the "held" exit

  @test:scripts/tests/sdlc/check-standalone.test.ts::judge::a_new_failure_is_red_and_named
  Scenario: A new failure is red and named
    Given a baseline failing "a > b"
    When a run failing "a > b" and "c > d" is judged
    Then the exit is the "grew" exit
    And the report names "+ c > d"

  @test:scripts/tests/sdlc/check-standalone.test.ts::judge::a_listed_test_that_now_passes_is_reported,_not_red_(an_unstable_entry_must_not_flip_CI)
  Scenario: A baseline entry that now passes is reported without going red
    Given a baseline failing "a > b"
    When a run with no failures is judged
    Then the exit is the "held" exit
    And the report names "- a > b" and mentions "standalone:baseline"

  @test:scripts/tests/sdlc/check-standalone.test.ts::judge::a_new_failure_is_red_even_when_another_listed_one_passed
  Scenario: A new failure is red even when a baseline entry now passes
    Given a baseline failing "a > b"
    When a run failing only "c > d" is judged
    Then the exit is the "grew" exit

  @test:scripts/tests/sdlc/check-standalone.test.ts::judge::more_unnamed_failures_is_red
  Scenario: More unnamed failures than the baseline count is red
    Given a baseline of 2 failures naming "a > b"
    When a run of 3 failures naming "a > b" is judged
    Then the exit is the "grew" exit

  @test:scripts/tests/sdlc/check-standalone.test.ts::judge::an_error_and_a_missing_baseline_are_never_held
  Scenario: A probe error or a missing baseline is undetermined
    Given a probe that ended in error
    When it is judged against an empty baseline
    Then the exit is the "undetermined" exit
    And a measured run judged with no baseline is also "undetermined"

  @test:scripts/tests/sdlc/check-standalone.test.ts::the_falsifiers,_through_the_real_probe::an_empty_layer_exits_non-zero
  Scenario: A layer with no tests is undetermined, never a measured pass
    Given a scratch repository whose layer holds only a README
    When the real probe runs the layer standalone
    Then the probe state is "error"
    And judging it against an empty baseline gives the "undetermined" exit

  @test:scripts/tests/sdlc/check-standalone.test.ts::the_falsifiers,_through_the_real_probe::a_run_that_executes_nothing_is_never_measured,_whatever_BUN_OPTIONS_says
  Scenario: An inherited shard option does not make the probe run nothing
    # Gap: asserts the run is measured with 0 failures; the number of tests actually executed is not checked
    Given a scratch repository whose layer holds one passing test
    And BUN_OPTIONS is set to "--shard=2/4"
    When the real probe runs the layer standalone
    Then the probe is measured with 0 failures

  @test:scripts/tests/sdlc/check-standalone.test.ts::the_falsifiers,_through_the_real_probe::the_parts_of_a_layer_together_run_every_test_file_once_(--part,_S-CI6)
  Scenario: The parts of a layer together run every test file exactly once
    Given a scratch repository whose layer holds test files a to e, of which only c fails
    When the real probe runs the layer in parts "1/3", "2/3" and "3/3"
    Then the files run across the parts are exactly a, b, c, d and e
    And there is exactly one failure, naming "c.test.ts > c"

  @test:scripts/tests/sdlc/check-standalone.test.ts::the_falsifiers,_through_the_real_probe::a_remote-mounted_dependency,_in_no_index,_is_still_laid_out_beside_the_layer_(#2470)
  Scenario: A git-ignored mounted dependency is laid out beside the layer
    Given a scratch repository with an ignored "dep" directory holding a file
    And a layer declaring "dep" in its needs whose test checks the file exists
    When the real probe runs the layer standalone
    Then the probe is measured with 0 failures

  @test:scripts/tests/sdlc/check-standalone.test.ts::the_falsifiers,_through_the_real_probe::a_planted_read_of_an_undeclared_sibling_is_red
  Scenario: A read of an undeclared sibling directory is red
    Given a scratch repository with a "folio-assistant-core" file the layer does not declare
    And a layer test that checks that file exists
    When the real probe runs the layer standalone
    Then the probe is measured with 1 failure
    And judging it against an empty baseline gives the "grew" exit
    And the failing test is "reads.test.ts > reads core"

  @test:scripts/tests/sdlc/check-standalone.test.ts::check-standalone:_keys_and_hints_are_the_layer's,_not_the_machine's::a_failure_keyed_by_an_absolute_path_matches_its_baseline_entry_wherever_it_ran
  Scenario: A failure keyed by an absolute path matches its baseline entry from another machine
    Given a CI failure key under "/home/runner/work/x/fa/cat-harness-tools/pipeline/p.test.ts > d > t"
    When it is made layer-relative for "cat-harness-tools"
    Then it is "pipeline/p.test.ts > d > t"
    And an already relative key "scripts/a.test.ts > t" is unchanged
    And judging the CI failure against a baseline keyed under "/home/user/fa/cat-harness-tools" gives the "held" exit

  @test:scripts/tests/sdlc/check-standalone.test.ts::check-standalone:_keys_and_hints_are_the_layer's,_not_the_machine's::the_hint_names_the_command_that_rewrites_THIS_layer's_entry
  Scenario: The baseline hint names this layer's refresh command
    Given a baseline failing "a > b" for layer "cat-harness-tools"
    When a run with no failures is judged
    Then the report contains the refresh command for "cat-harness-tools"
