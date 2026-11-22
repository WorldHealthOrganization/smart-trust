# Bun runtime pinning for agent containers: the .bun-version pin, scripts/install-bun.sh
# and install-bun.bat, and the Bun alignment step in scripts/session-start-coord-sweep.sh.
# Each Scenario names the test that executes it.
Feature: Bun version pin and runtime alignment

  @test:scripts/tests/conduct/session-start-bun.test.ts::bun_version_pin_and_alignment_(folio-assistant-p3zo)::.bun-version_exists_and_holds_a_bare_X.Y.Z_version
  Scenario: The Bun pin file holds a bare X.Y.Z version
    Given the harness root
    Then a ".bun-version" file exists there
    And its trimmed text is a bare X.Y.Z version

  @test:scripts/tests/conduct/session-start-bun.test.ts::bun_version_pin_and_alignment_(folio-assistant-p3zo)::install-bun.sh_exists_and_is_executable
  Scenario: install-bun.sh exists and is executable
    Given the scripts directory
    Then "install-bun.sh" exists
    And it has at least one executable mode bit set

  @test:scripts/tests/conduct/session-start-bun.test.ts::bun_version_pin_and_alignment_(folio-assistant-p3zo)::install-bun.bat_exists_beside_install-bun.sh
  Scenario: install-bun.bat sits beside install-bun.sh
    Given the scripts directory
    Then "install-bun.bat" exists there

  @test:scripts/tests/conduct/session-start-bun.test.ts::bun_version_pin_and_alignment_(folio-assistant-p3zo)::install-bun.sh_syntax_is_valid_bash
  Scenario: install-bun.sh parses as valid bash
    When "bash -n" is run on "install-bun.sh"
    Then it succeeds with no output

  @test:scripts/tests/conduct/session-start-bun.test.ts::bun_version_pin_and_alignment_(folio-assistant-p3zo)::session-start-coord-sweep.sh_syntax_is_valid_bash
  Scenario: session-start-coord-sweep.sh parses as valid bash
    When "bash -n" is run on "session-start-coord-sweep.sh"
    Then it succeeds with no output

  @test:scripts/tests/conduct/session-start-bun.test.ts::bun_version_pin_and_alignment_(folio-assistant-p3zo)::install-bun.sh_reports_already_installed_when_target_version_matches_running_bun
  Scenario: install-bun.sh reports the running Bun as already installed when it matches the target
    Given the version of the Bun running the test
    When "install-bun.sh" is run with that version
    Then its output says "Bun <version> is already installed and matches target."

  @test:scripts/tests/conduct/session-start-bun.test.ts::bun_version_pin_and_alignment_(folio-assistant-p3zo)::install-bun.sh_rejects_invalid_version_format_with_exit_code_2
  Scenario: install-bun.sh rejects a version that is not bare X.Y.Z with exit code 2
    When "install-bun.sh" is run with each of "invalid", "v1.3.14", "latest" and "1.3"
    Then each run exits with status 2
    And its stderr says "not a valid bare X.Y.Z version"

  @test:scripts/tests/conduct/session-start-bun.test.ts::bun_version_pin_and_alignment_(folio-assistant-p3zo)::session-start-coord-sweep.sh_includes_Bun_alignment_section_and_check-bun-runtime_invocation
  Scenario: The session-start sweep carries the Bun alignment section and runtime check
    # Gap: only the script's source text is checked; the sweep is not run
    Given the text of "session-start-coord-sweep.sh"
    Then it contains the section "3-ter. Bun runtime vs the pin" and "bun_pin_file="
    And it names "install-bun.sh" and "check-bun-runtime.ts"
    And it contains "Bun runtime aligned (folio-assistant-p3zo)" and "Bun runtime alignment warning"
