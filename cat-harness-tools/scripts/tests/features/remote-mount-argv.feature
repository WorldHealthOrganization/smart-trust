# mount:remote checks its arguments before it does anything: --help prints
# the header, an unknown flag exits 2 having run nothing, and the fan-out
# honours --plan. Each Scenario names the test that executes it.
Feature: mount:remote checks its arguments first

  @test:scripts/tests/remote-mount-argv.test.ts::argvProblems::known_switches_and_valued_flags_pass
  Scenario: Known switches and valued flags pass
    Then no arguments, "--plan", "--instance x --check --json", and "--seed … --consent-by me --whole" have no problems

  @test:scripts/tests/remote-mount-argv.test.ts::argvProblems::an_unknown_flag_or_a_stray_argument_is_a_problem
  Scenario: An unknown flag or a stray argument is a problem
    Then "--dry-run" is "unknown flag --dry-run"
    And "oops" is "unexpected argument oops"

  @test:scripts/tests/remote-mount-argv.test.ts::argvProblems::a_valued_flag_with_no_value_is_a_problem,_and_does_not_swallow_the_next_flag
  Scenario: A valued flag with no value is a problem
    Then "--instance" alone and "--instance --check" each give only "--instance needs a value"

  @test:scripts/tests/remote-mount-argv.test.ts::argvProblems::every_flag_the_usage_text_documents_is_known
  Scenario: Every flag the usage text documents is known
    Then every flag in the usage text, except those quoted from other commands, is a mount:remote flag

  @test:scripts/tests/remote-mount-argv.test.ts::the_command_line::--help_and_-h_print_the_usage,_exit_0_and_write_nothing
  Scenario: --help and -h print the usage and write nothing
    When mount:remote runs with "--help" and with "-h"
    Then each exits 0 printing "bun run cat mount:remote --plan"
    And no index.lock.json is written

  @test:scripts/tests/remote-mount-argv.test.ts::the_command_line::an_unknown_flag_exits_2_and_runs_nothing
  Scenario: An unknown flag exits 2 and runs nothing
    When mount:remote runs with "--dry-run"
    Then it exits 2, saying "unknown flag --dry-run" and "nothing was run"
    And no index.lock.json is written

  @test:scripts/tests/remote-mount-argv.test.ts::the_fan-out_honours_--plan::a_plan_resolves_the_closure,_mounts_nothing_and_writes_no_lock
  Scenario: A plan resolves the closure and mounts nothing
    Given a layer "down" whose index config names a consented remote layer "lib" served from a bare repository
    When the fan-out runs with --plan
    Then it is "mounted" with text "plan for", and neither the lock nor "lib" is written
    When the fan-out runs without --plan
    Then it is "mounted", the lock is written and lib/schemas/a.ts exists
