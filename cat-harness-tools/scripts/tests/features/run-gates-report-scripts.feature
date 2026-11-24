# run-gates.py skips every script gates.ts declares `kind: "report"`, in index
# mode as in layer mode, asking gates.ts itself (`--report-scripts`) so the two
# cannot drift (cat-harness-tools#2446, #2460). Each Scenario names the test
# that executes it.
Feature: run-gates.py honours gates.ts's report kind in every mode

  @test:scripts/tests/run-gates-report-scripts.test.ts::run-gates.py_skips_gates.ts's_`report`_scripts::in_INDEX_mode,_check:draft-beans_is_skipped_as_a_report,_never_run_as_a_gate
  Scenario: In index mode check:draft-beans is skipped as a report
    Given an instance that is its own index, mounting a tools layer whose gates.ts calls check:draft-beans a report
    When run-gates.py runs
    Then check:draft-beans is skipped with its report reason and never run
    And an ordinary check still runs and passes

  @test:scripts/tests/run-gates-report-scripts.test.ts::run-gates.py_skips_gates.ts's_`report`_scripts::a_`report`_gates.ts_takes_from_a_declaration_is_skipped_with_its_reason
  Scenario: A report taken from an instance's declaration is skipped with its reason
    Given the same index, and a report gates.ts takes from a declaration
    When run-gates.py runs
    Then that script is skipped with the declaration's reason

  @test:scripts/tests/run-gates-report-scripts.test.ts::run-gates.py_skips_gates.ts's_`report`_scripts::the_`report`_scripts_run-gates.py_wires_itself_still_run_as_gates
  Scenario: The report scripts run-gates.py wires on purpose still run
    Given the same index and a junit report for check:test-budgets
    When run-gates.py runs
    Then check:test-budgets and separation:cutover:check run and pass

  @test:scripts/tests/run-gates-report-scripts.test.ts::run-gates.py_skips_gates.ts's_`report`_scripts::in_INDEX_mode_EVERY_`report`_script_of_the_real_table_is_skipped,_but_the_two_run-gates.py_wires_(#2460)
  Scenario: In index mode every report script of the real table is skipped
    Given an index whose tools layer declares every script the real SCRIPT_EXEMPTIONS calls a report
    When run-gates.py runs
    Then none of them runs as a gate, except check:test-budgets and separation:cutover:check
    And check:draft-beans is skipped by its report reason

  @test:scripts/tests/run-gates-report-scripts.test.ts::run-gates.py_skips_gates.ts's_`report`_scripts::with_no_gates.ts_to_ask_it_says_so,_and_skips_nothing_as_a_report
  Scenario: With no gates.ts to ask, nothing is skipped as a report
    Given the same index with no gates.ts
    When run-gates.py runs
    Then it says --report-scripts is absent, and every script runs as a gate

  @test:scripts/tests/run-gates-report-scripts.test.ts::gates.ts_--report-scripts::prints_exactly_the_`report`_exemptions_of_SCRIPT_EXEMPTIONS,_check:draft-beans_among_them
  Scenario: gates.ts --report-scripts prints exactly its report exemptions
    When gates.ts runs with --report-scripts
    Then it prints the report entries of SCRIPT_EXEMPTIONS, check:draft-beans and check:wireframes among them
    And a covered-by entry is not among them
