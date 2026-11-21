# scripts/gates.ts derives the gate list from the gates workflow rather than authoring it,
# refuses an empty extraction, accounts for every check script, and holds out commands it
# cannot run as written and steps that declare themselves writers. Each Scenario names the test that executes it.
Feature: The gate runner derives its list and refuses an empty one

  @test:scripts/tests/sdlc/gates.test.ts::an_empty_extraction_is_a_broken_reader,_never_a_clean_sweep::a_workflow_with_no_bun_steps_extracts_nothing_—_the_pure_half
  Scenario: A workflow with no bun steps extracts no gates
    Given a workflow whose only step runs "echo nothing here"
    When gates are extracted from it
    Then the list is empty and nothing is thrown

  @test:scripts/tests/sdlc/gates.test.ts::an_empty_extraction_is_a_broken_reader,_never_a_clean_sweep::a_step_whose_run_block_is_absent_is_skipped,_not_crashed_on
  Scenario: A step with no run block is skipped
    Given a workflow job with a "uses: actions/checkout@v4" step and a "bun run cat lint" step
    When gates are extracted from it
    Then the single gate is job "typescript", step "(unnamed step)", command "bun run cat lint"

  @test:scripts/tests/sdlc/gates.test.ts::an_empty_extraction_is_a_broken_reader,_never_a_clean_sweep::loadGates_THROWS_on_a_workflow_it_cannot_read_gates_from
  Scenario: Loading gates throws on a workflow with no gates
    Given a root whose gates workflow file has only an "echo hi" step
    When the gates are loaded
    Then it throws NoGatesFound

  @test:scripts/tests/sdlc/gates.test.ts::an_empty_extraction_is_a_broken_reader,_never_a_clean_sweep::the_refusal_says_it_is_not_green
  Scenario: The no-gates refusal says it is not green
    When a NoGatesFound error is made for "w.yml"
    Then its message contains "not a clean sweep" and "do not treat this as green"

  @test:scripts/tests/sdlc/gates.test.ts::every_workflow_step_is_accounted_for::every_exemption_states_a_reason
  Scenario: Every step exemption states a reason
    Given the declared step exemptions
    When those with a blank reason are collected
    Then there are none

  @test:scripts/tests/sdlc/gates.test.ts::every_check_script_is_accounted_for_—_the_direction_nothing_asked::the_script_scan_finds_scripts_—_an_empty_read_is_not_full_coverage
  Scenario: The check-script scan of the repository finds scripts
    Given the repository root
    When its check script names are scanned
    Then more than 20 are found

  @test:scripts/tests/sdlc/gates.test.ts::every_check_script_is_accounted_for_—_the_direction_nothing_asked::an_empty_scan_THROWS_rather_than_reporting_full_coverage
  Scenario: A scan that finds no check scripts throws
    Given a root whose package.json has only a "build" script
    When its check script names are scanned
    Then it throws NoCheckScriptsFound

  @test:scripts/tests/sdlc/gates.test.ts::every_check_script_is_accounted_for_—_the_direction_nothing_asked::a_script_name_must_end_at_a_TOKEN_BOUNDARY,_not_merely_match
  Scenario: A command runs a script only when the name ends at a token boundary
    When commands are tested for running a script
    Then "bun run cat check:partition" runs check:partition
    And "bun run cat check:partition:edges" does not run check:partition, nor the reverse
    And "bun run cat check:l1-complete -- --check" runs check:l1-complete
    And "bun run xcheck:partition" does not run check:partition

  @test:scripts/tests/sdlc/gates.test.ts::every_check_script_is_accounted_for_—_the_direction_nothing_asked::every_script_exemption_states_a_reason
  Scenario: Every script exemption states a reason
    Given the declared script exemptions
    When those with a blank reason are collected
    Then there are none

  @test:scripts/tests/sdlc/gates.test.ts::every_check_script_is_accounted_for_—_the_direction_nothing_asked::an_exemption_matches_by_exact_name,_never_by_prefix
  Scenario: A script exemption matches by exact name
    When exemptions are looked up
    Then "check:partition:edges" has one
    And "check:partition" has none

  @test:scripts/tests/sdlc/gates.test.ts::every_check_script_is_accounted_for_—_the_direction_nothing_asked::an_unwired_script_IS_reported_—_the_check_can_fail
  Scenario: A check script no workflow step runs is reported
    Given a root with scripts "check:wired" and "check:orphan"
    And a gates workflow that runs only "check:wired"
    When the unrun scripts are listed
    Then the list is "check:orphan"

  @test:scripts/tests/sdlc/gates.test.ts::a_command_whose_shell_variable_this_reader_discarded_is_NOT_a_gate::it_is_diverted_out_of_the_RUNNABLE_set,_and_only_that_set
  Scenario: A command using a discarded shell variable is kept out of the runnable set only
    Given a workflow step that sets "base" and runs the catalogue check bare and with --base "$base"
    When all gates and the runnable gates are extracted
    Then all gates include the --base "$base" command
    And the runnable gates include the bare command but not the --base "$base" one

  @test:scripts/tests/sdlc/gates.test.ts::a_command_whose_shell_variable_this_reader_discarded_is_NOT_a_gate::the_two_sets_PARTITION_the_extraction_—_nothing_falls_out_of_both
  Scenario: The runnable and unresolved sets together are the whole extraction
    Given the same workflow
    When the runnable and unresolved gates are combined
    Then their sorted commands equal all extracted commands

  @test:scripts/tests/sdlc/gates.test.ts::a_command_whose_shell_variable_this_reader_discarded_is_NOT_a_gate::and_reported_rather_than_dropped_—_the_whole_point
  Scenario: The command using a shell variable is in the unresolved set
    # Gap: only the unresolved set is checked; how the runner reports it is not
    Given the same workflow
    When the unresolved gates are extracted
    Then they are exactly the --base "$base" command

  @test:scripts/tests/sdlc/gates.test.ts::a_command_whose_shell_variable_this_reader_discarded_is_NOT_a_gate::the_script_keeps_its_coverage,_because_CI_invokes_it_BOTH_ways
  Scenario: The catalogue script stays covered by its bare invocation
    Given the same workflow
    When the runnable gates are extracted
    Then exactly one runnable command mentions "translation:catalogue"

  @test:scripts/tests/sdlc/gates.test.ts::a_command_whose_shell_variable_this_reader_discarded_is_NOT_a_gate::the_predicate_catches_both_spellings_and_leaves_ordinary_commands_alone
  Scenario: Both variable spellings are caught and ordinary commands are not
    When commands are tested for an unexpanded variable
    Then "$base" and "${BASE}" forms are caught
    And "bun run cat gates --all" is not
    And a quoted literal "$" is not

  @test:scripts/tests/sdlc/gates.test.ts::a_step_that_declares_itself_a_writer_is_not_a_gate_in_the_pool::the_mark_is_a_USE_in_the_docblock,_never_a_mention
  Scenario: Only a writer mark used in the docblock declares a writer
    Given a docblock with the line "@covers none — writer — …"
    And a docblock that shows that mark indented as a sample and has a plain "@covers none"
    When each is tested for declaring a writer
    Then the first declares one and the second does not

  @test:scripts/tests/sdlc/gates.test.ts::a_step_that_declares_itself_a_writer_is_not_a_gate_in_the_pool::read_from_a_workflow_line,_a_declared_writer_is_held_out_of_the_gate_list_and_the_pool
  Scenario: A declared writer step is held out of the gate list and the pool but still counted as a CI run
    Given a fixture root whose gates workflow runs check:nav, report, proj:viz and tools/gen-proj.ts, where gen-proj.ts declares itself a writer
    When workflow lines are tested as writer steps
    Then "bun run cat proj:viz" and "bun run tools/gen-proj.ts" are writers, and report and check:nav are not
    And extraction still yields all four commands
    And the loaded gates are check:nav and report only
    And the writer steps are proj:viz and tools/gen-proj.ts
    And no segment built with every gate read-only holds a writer
    And the CI runs list the gates followed by the two writers
