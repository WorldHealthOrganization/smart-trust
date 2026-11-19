# Specifies the stale-$? detector staleExitStatusReads defined in this test
# file, and its sweep over every tracked shell script and workflow in the
# checkout.
Feature: No tracked shell reads $? where it no longer holds the command's status

  @test:test/coordinator/shell-exit-status.test.ts::the_detector::finds_both_shapes
  Scenario: The detector finds both stale shapes
    Given an "if ! f; then" whose branch first reads $?, and an echo reading $? after a command substitution
    When each is scanned
    Then the first is reported as "$? inside `if ! cmd; then`"
    And the second as "$? after a command substitution"

  @test:test/coordinator/shell-exit-status.test.ts::the_detector::passes_the_right_forms
  Scenario: The detector passes the right forms
    Given "f || rc=$?", "f" then "rc=$?" before a substitution, and a stale form inside a comment
    When each is scanned
    Then nothing is reported

  @test:test/coordinator/shell-exit-status.test.ts::no_tracked_shell_script_or_workflow_reads_a_stale_$?
  Scenario: No tracked shell script or workflow reads a stale $?
    Given every tracked .sh, .bash and .github/workflows/*.yml or *.yaml file in the checkout
    When each is scanned
    Then nothing is reported
