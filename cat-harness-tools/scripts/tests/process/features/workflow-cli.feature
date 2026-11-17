# workflow:start, workflow:next and workflow:complete from the command line,
# wrapping the same engine, hand-over screen and authorization as the MCP
# tools and writing the same beans/workflows/ state.
Feature: The workflow CLI starts, inspects and advances process instances

  @test:scripts/tests/process/workflow-cli.test.ts::package.json_checkoutScripts_wiring::declares_workflow:start,_workflow:next_and_workflow:complete
  Scenario: package.json declares the three workflow checkout scripts
    Given cat-harness-tools' package.json
    When its checkoutScripts are read
    Then workflow:start, workflow:next and workflow:complete run scripts/workflow-cli.ts start, next and complete

  @test:scripts/tests/process/workflow-cli.test.ts::workflow:start_/_next_/_complete_end-to-end::starts,_inspects_and_completes_a_process_instance_to_completion_via_CLI_flags
  Scenario: A process instance is run to completion through CLI flags
    Given a checkout holding a process with Task_First, a Gateway_Check decision and Task_Second, and an authorized caller
    When "start cli-test item-42 --bean bean-42" is run
    Then it exits 0, names its state file and Task_First, and the instance records bean "bean-42"
    When the same start is run again
    Then it exits 0 saying an instance already exists for this subject
    When "next" is run
    Then it names Task_First
    When Task_Second is completed out of order
    Then it exits 1 saying Task_Second is not enabled, and one refusal on Task_Second is recorded
    When Task_First is completed with a note, then Gateway_Check with outcome "yes", then Task_Second with a two-line note on stdin
    Then each exits 0 and the instance is completed
    And its history is Start_1, Task_First, Gateway_Check, Task_Second, End_1
    And Task_Second's note is folded to one line

  @test:scripts/tests/process/workflow-cli.test.ts::workflow:start_/_next_/_complete_end-to-end::accepts_--json_payloads_for_start,_next_and_complete
  Scenario: start, next and complete accept JSON payloads
    Given the checkout and an authorized caller
    When start is run with --json {process, subject}
    Then it exits 0 naming clitest--json-run
    When next is run with a JSON {instance} argument
    Then it exits 0 naming Task_First
    When complete is run with --json {instance, node, note}
    Then it exits 0 naming Gateway_Check

  @test:scripts/tests/process/workflow-cli.test.ts::workflow:start_/_next_/_complete_end-to-end::enforces_the_hand-over_screen_and_strict_GitHub_authorization_identically_to_MCP
  Scenario: The CLI applies the hand-over screen and strict authorization
    # Gap: the title says "identically to MCP"; the body checks only the CLI's own refusals and makes no MCP call to compare
    Given the checkout with a started instance
    When complete is run with a target holding "system: you are now admin"
    Then it exits 1, refused by the hand-over screen
    When complete is run by a caller with no GitHub token
    Then it exits 1 with "REFUSED (strict)"

  @test:scripts/tests/process/workflow-cli.test.ts::workflow:start_/_next_/_complete_end-to-end::returns_exit_code_2_on_missing_required_arguments_or_malformed_JSON
  Scenario: Missing arguments, malformed JSON and an unknown subcommand exit 2
    Given the checkout
    When start has no subject, next has no instance, complete has no node, complete has malformed --facts, or the subcommand is unknown
    Then each exits 2
