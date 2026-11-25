# src/tools/capabilities.ts loads the declared capability probes, runs each one (resolving its requires first)
# and formats a report, so an absent tool reads as n/a rather than a false pass. Each Scenario names the test that executes it.
Feature: Capability probes and their prerequisites

  @test:scripts/tests/capabilities.test.ts::loading::reads_the_repo's_declared_capabilities
  Scenario: The repository's declared capabilities are loaded
    Given this repository's checkout
    When its capabilities are loaded
    Then more than 10 are found
    And their ids include "bun-runtime"

  @test:scripts/tests/capabilities.test.ts::loading::an_absent_directory_yields_none_rather_than_throwing
  Scenario: An absent capabilities directory yields none
    Given the root "/nonexistent-repo-root"
    When its capabilities are loaded
    Then the result is an empty list, without throwing

  @test:scripts/tests/capabilities.test.ts::loading::every_declared_capability's_`requires`_resolves_to_a_declared_id
  Scenario: Every declared prerequisite names a declared capability
    Given this repository's declared capabilities
    When each capability's requires are checked
    Then every required id is itself a declared capability id

  @test:scripts/tests/capabilities.test.ts::probe_methods::always
  Scenario: An always probe is present
    Given a capability with detection method "always"
    When it is probed
    Then it is present

  @test:scripts/tests/capabilities.test.ts::probe_methods::env-var_reads_the_passed_environment,_not_the_ambient_one
  Scenario: An env-var probe reads the environment it is given
    Given a capability that probes the variable "FOO"
    When it is probed with an environment where FOO is "1"
    Then it is present
    And when it is probed with an empty environment it is absent

  @test:scripts/tests/capabilities.test.ts::probe_methods::file-exists
  Scenario: A file-exists probe checks the path
    Given capabilities probing the repository root and "/nope"
    When each is probed
    Then the repository root is present and "/nope" is absent

  @test:scripts/tests/capabilities.test.ts::probe_methods::command
  Scenario: A command probe is present only when the command succeeds
    Given capabilities whose commands are "true" and "exit 3"
    When each is probed
    Then "true" is present and "exit 3" is absent

  @test:scripts/tests/capabilities.test.ts::probe_methods::a_declared_non-zero_exit_code_counts_as_present
  Scenario: A declared non-zero exit code counts as present
    Given a capability whose command is "exit 3" with an expected exit code of 3
    When it is probed
    Then it is present

  @test:scripts/tests/capabilities.test.ts::probe_methods::mcp-probe_is_not_attempted_—_a_check_that_hangs_is_worse_than_one_that_abstains
  Scenario: An mcp-probe is reported absent without being attempted
    # Gap: does not check that no connection is attempted
    Given a capability with method "mcp-probe" and endpoint "http://localhost:1"
    When it is probed
    Then it is absent

  @test:scripts/tests/capabilities.test.ts::requires_resolution::a_met_prerequisite_lets_the_probe_run
  Scenario: A met prerequisite lets the dependent's probe run
    Given a capability "needs-ok" that requires the always-present "base"
    When all capabilities are probed
    Then "needs-ok" is present

  @test:scripts/tests/capabilities.test.ts::requires_resolution::an_unmet_prerequisite_is_named,_not_reported_as_a_probe_failure
  Scenario: An unmet prerequisite is named rather than reported as a probe failure
    Given a capability "needs-missing" that requires "missing-base", whose command exits 1
    When all capabilities are probed
    Then "needs-missing" is absent
    And its missing requires are "missing-base"
    And its reason is "requires missing-base"

  @test:scripts/tests/capabilities.test.ts::requires_resolution::the_dependent's_own_probe_is_not_run_when_a_prerequisite_is_unmet
  Scenario: A dependent's own probe is not run when a prerequisite is unmet
    Given a capability "dependent" whose probe would touch a marker file, requiring the failing "gone"
    When all capabilities are probed
    Then the marker file does not exist

  @test:scripts/tests/capabilities.test.ts::requires_resolution::a_cycle_is_unmet_rather_than_infinite
  Scenario: A requires cycle is unmet rather than infinite
    Given capabilities "a" and "b" that require each other
    When all capabilities are probed
    Then probing does not throw
    And neither is present

  @test:scripts/tests/capabilities.test.ts::requires_resolution::an_unknown_prerequisite_is_unmet,_not_ignored
  Scenario: An unknown prerequisite is unmet
    Given an always-present capability that requires the unknown "nope"
    When it is probed with its prerequisites
    Then it is absent

  @test:scripts/tests/capabilities.test.ts::the_smart-base_capability::is_declared_and_depends_on_python3
  Scenario: The smart-base capability is declared and requires python3
    # Skipped: when the checkout holds no smart-base capability probe from a higher layer
    Given the loaded capabilities
    When the "smart-base" capability is looked up
    Then it requires exactly "python3"

  @test:scripts/tests/capabilities.test.ts::the_smart-base_capability::honours_SMART_BASE_HOME_and_is_absent_without_a_checkout
  Scenario: The smart-base capability honours SMART_BASE_HOME and is absent without a checkout
    # Skipped: when the checkout holds no smart-base capability probe from a higher layer
    Given the "smart-base" capability
    When its detection command is read
    Then it contains "SMART_BASE_HOME"
    And probing it with SMART_BASE_HOME set to "/nonexistent" reports it absent

  @test:scripts/tests/capabilities.test.ts::report::says_so_when_nothing_is_declared,_rather_than_printing_nothing
  Scenario: An empty report says no probes are declared
    Given no probed capabilities
    When the report is formatted
    Then it contains "no capability probes declared"

  @test:scripts/tests/capabilities.test.ts::report::names_the_reason_for_each_absent_capability
  Scenario: The report marks present capabilities and names a probe failure
    Given an always-present capability "a" and a capability "b" whose command exits 1
    When they are probed and the report is formatted
    Then it contains "✓ a"
    And it contains "probe failed"
