# scripts/gate-shell.sh is the shell every run: step of the gates workflow runs under: it passes
# the step's own exit through, reports a failure in the step summary and one ::error:: annotation,
# and asks the CI cone whether a single `bun run` step may be skipped or recorded. Each Scenario names the test that executes it.
Feature: The gate step shell

  @test:scripts/tests/sdlc/gate-shell.test.ts::gate-shell.sh::is_executable,_or_the_workflow_cannot_use_it_as_a_shell
  Scenario: The gate shell is executable
    Given the file scripts/gate-shell.sh
    When it is tested with "test -x"
    Then the test passes

  @test:scripts/tests/sdlc/gate-shell.test.ts::gate-shell.sh::passes_a_step's_non-zero_exit_through_—_NOT_tee's_zero
  Scenario: A step's non-zero exit is passed through, not tee's zero
    Given a step that echoes and exits 7, and a step that exits 1
    When each runs under the gate shell
    Then the shell exits 7 and 1 respectively

  @test:scripts/tests/sdlc/gate-shell.test.ts::gate-shell.sh::a_succeeding_step_still_exits_0
  Scenario: A succeeding step exits 0
    Given a step that only echoes
    When it runs under the gate shell
    Then the shell exits 0

  @test:scripts/tests/sdlc/gate-shell.test.ts::gate-shell.sh::does_NOT_add_pipefail_—_bash_-e_is_GitHub's_default,_and_only_that
  Scenario: The shell does not add pipefail
    Given a step running "false | true" then an echo
    When it runs under the gate shell
    Then the shell exits 0

  @test:scripts/tests/sdlc/gate-shell.test.ts::gate-shell.sh::keeps_-e:_a_failing_command_aborts_the_rest_of_the_step
  Scenario: A failing command aborts the rest of the step
    Given a step running "false" then echoing "NOT-REACHED"
    When it runs under the gate shell
    Then the shell exits 1
    And the step's own output, outside "::" annotation lines, does not contain "NOT-REACHED"

  @test:scripts/tests/sdlc/gate-shell.test.ts::gate-shell.sh::writes_nothing_to_the_summary_when_the_step_passes
  Scenario: A passing step writes nothing to the step summary
    Given a step that only echoes
    When it runs under the gate shell with a step summary file
    Then the summary is empty

  @test:scripts/tests/sdlc/gate-shell.test.ts::gate-shell.sh::names_the_step_and_keeps_its_output_when_the_step_fails
  Scenario: A failing step's summary names the step and keeps both output streams
    Given a step echoing "distinctive-marker", writing "to-stderr" to stderr and exiting 3
    When it runs under the gate shell in job "gates"
    Then the shell exits 3
    And the summary contains "exit 3", the job "gates" and the command "echo distinctive-marker"
    And the summary contains both the stdout and the stderr output

  @test:scripts/tests/sdlc/gate-shell.test.ts::gate-shell.sh::strips_comments_from_the_step_it_echoes,_so_the_command_is_legible
  Scenario: Comments are stripped from the step echoed in the summary
    Given a failing step with a comment line and "bun run check:nothing"
    When it runs under the gate shell
    Then the summary contains "bun run check:nothing"
    And the summary does not contain the comment text

  @test:scripts/tests/sdlc/gate-shell.test.ts::gate-shell.sh::says_a_silent_failure_was_silent_rather_than_printing_an_empty_block
  Scenario: A silent failure is reported as printing nothing
    Given a step that runs only "false"
    When it runs under the gate shell
    Then the summary says "printed nothing before failing"

  @test:scripts/tests/sdlc/gate-shell.test.ts::gate-shell.sh::bounds_the_output,_because_GitHub_DROPS_a_step_summary_over_1_MiB
  Scenario: The summary keeps a bounded tail of a long output
    Given a step printing 5000 padded lines and exiting 1
    When it runs under the gate shell
    Then the shell exits 1
    And the summary is under 200,000 characters
    And it contains "line 5000" but not "line 1 padding"

  @test:scripts/tests/sdlc/gate-shell.test.ts::gate-shell.sh::still_runs_the_step_when_GITHUB_STEP_SUMMARY_is_unset_(local_use)
  Scenario: The step still runs without a step summary file
    Given a step echoing "local" and exiting 4
    And GITHUB_STEP_SUMMARY is unset
    When it runs under the gate shell
    Then the shell exits 4
    And stdout contains "local"

  @test:scripts/tests/sdlc/gate-shell.test.ts::gate-shell.sh::emits_exactly_ONE_::error::_line,_since_the_command_takes_a_single_line
  Scenario: A failing step emits exactly one ::error:: line
    Given a step echoing two lines and exiting 1
    When it runs under the gate shell
    Then stdout has exactly one line starting with "::error"

  @test:scripts/tests/sdlc/gate-shell.test.ts::gate-shell.sh::escapes_newlines_as_%0A_—_a_literal_one_would_end_the_command_early
  Scenario: Newlines in the annotation are escaped as %0A
    Given a step echoing "first" and "second" and exiting 1
    When it runs under the gate shell
    Then the ::error:: line contains "%0A", "first" and "second"

  @test:scripts/tests/sdlc/gate-shell.test.ts::gate-shell.sh::escapes_a_literal_%_as_%25,_in_the_OUTPUT_and_in_the_command
  Scenario: A literal percent sign in the annotation is escaped as %25
    Given a step echoing "stale: 50% of files" and exiting 1
    When it runs under the gate shell
    Then the ::error:: line contains "50%25 of files"
    And it nowhere contains an unescaped "50% of"

  @test:scripts/tests/sdlc/gate-shell.test.ts::gate-shell.sh::bounds_the_annotation_—_GitHub_truncates_a_long_one_silently
  Scenario: The annotation keeps a bounded tail of a long output
    Given a step printing 4000 lines and exiting 1
    When it runs under the gate shell
    Then the ::error:: line is under 6000 characters
    And it contains "line 4000"

  @test:scripts/tests/sdlc/gate-shell.test.ts::gate-shell.sh::a_passing_step_emits_no_annotation_at_all
  Scenario: A passing step emits no annotation
    Given a step that only echoes
    When it runs under the gate shell
    Then stdout contains no "::error"

  @test:scripts/tests/sdlc/gate-shell.test.ts::gate-shell.sh::says_so_in_the_annotation_when_the_step_printed_nothing
  Scenario: The annotation says when the failing step printed nothing
    Given a step that runs only "false"
    When it runs under the gate shell
    Then the ::error:: line contains "printed nothing"

  @test:scripts/tests/sdlc/gate-shell.test.ts::gate-shell.sh::refuses_a_missing_step_script_rather_than_passing_vacuously
  Scenario: A missing step script is refused
    Given a step script path that does not exist
    When the gate shell is run on it
    Then it exits 2

  @test:scripts/tests/sdlc/gate-shell.test.ts::gate-shell.sh_—_the_CI_cone_hook::off_(no_CI_CONE_MODE):_the_cone_CLI_is_never_asked,_and_the_step_runs_as_written
  Scenario: With no cone mode the cone CLI is never asked
    # Gap: that the step then runs as written is not checked
    Given a copy of the gate shell beside a stub ci-cone.ts that records its calls
    And CI_CONE_MODE is unset
    When the step "bun run some:check" runs under it
    Then the stub records no call

  @test:scripts/tests/sdlc/gate-shell.test.ts::gate-shell.sh_—_the_CI_cone_hook::skip_mode,_and_the_cone_says_skip:_the_step_does_NOT_run_and_exits_0
  Scenario: In skip mode a cone answer of skip skips the step and exits 0
    Given the gate shell beside a stub cone whose decide exits 0
    And CI_CONE_MODE is "skip"
    When a step with a comment and "bun run some:check" runs under it
    Then the stub is asked "decide some:check"
    And the shell exits 0

  @test:scripts/tests/sdlc/gate-shell.test.ts::gate-shell.sh_—_the_CI_cone_hook::skip_mode,_and_the_cone_says_run_(or_fails):_the_step_RUNS,_and_its_own_exit_status_is_the_verdict
  Scenario: In skip mode a cone answer of run lets the step run with its own exit status
    Given the gate shell beside a stub cone whose decide exits 1, in skip mode
    When the step "bun run some:check" runs under it
    Then the stub is asked "decide some:check"
    And the shell exits non-zero, because the missing script ran
    And a step "exit 7" is never put to the cone and exits 7

  @test:scripts/tests/sdlc/gate-shell.test.ts::gate-shell.sh_—_the_CI_cone_hook::`bun_run_cat_<script>`_(bean_ar1s_P4)_is_the_same_step,_by_the_script's_name
  Scenario: A "bun run cat" step is put to the cone by its script's name
    Given the gate shell beside a stub cone, in skip mode
    When the step "bun run cat some:check" runs under it
    Then the stub is asked "decide some:check"

  @test:scripts/tests/sdlc/gate-shell.test.ts::gate-shell.sh_—_the_CI_cone_hook::only_a_step_that_is_EXACTLY_one_`bun_run_<script>`_is_touched
  Scenario: Only a step that is exactly one bun run of a script is put to the cone
    Given the gate shell beside a stub cone, in skip mode
    When steps with two bun runs, a bun run with extra arguments, "bun --version", and "set -e" before a bun run each run under it
    Then the stub records no call for any of them

  @test:scripts/tests/sdlc/gate-shell.test.ts::gate-shell.sh_—_the_CI_cone_hook::record_mode:_a_recorder_killed_by_a_signal_(>=_128)_runs_the_step_again,_untraced
  Scenario: In record mode a recorder killed by a signal runs the step again untraced
    Given the gate shell beside a stub cone, in record mode
    When the recorder exits 5
    Then the stub is asked "run some:check" and nothing says "running the step untraced"
    When the recorder exits 134 instead
    Then stdout says "running the step untraced"
    And the shell's exit is not 134

  @test:scripts/tests/sdlc/gate-shell.test.ts::gate-shell.sh_—_the_CI_cone_hook::record_mode_runs_the_step_through_`ci-cone.ts_run`,_passing_ITS_exit_status_through
  Scenario: In record mode the step runs through the cone recorder and its exit is passed through
    Given the gate shell beside a stub cone whose run prints "recorded-run" and exits 5, in record mode
    When the step "bun run some:check" runs under it
    Then the stub is asked "run some:check"
    And stdout contains "recorded-run some:check"
    And the shell exits 5
