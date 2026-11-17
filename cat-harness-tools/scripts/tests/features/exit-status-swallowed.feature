# The exit-status-swallowed check (exitStatusSwallowed in scripts/check-workflows.ts) finds a workflow run body that reads $?
# on a line Actions' bash -e never reaches, unless the read is guarded, errexit is off, or it opens an else branch.
# Each Scenario names the test that executes it.
Feature: Exit status swallowed in workflow run bodies

  @test:scripts/tests/exit-status-swallowed.test.ts::exit-status-swallowed::a_bare_call_then_`code=$?`_is_a_finding,_on_the_`code=$?`_line
  Scenario: A bare call followed by code=$? is a finding on the code=$? line
    Given a run step that runs a command, then "code=$?", then exits with the code
    When the workflow is checked
    Then exactly one "exit-status-swallowed" finding is reported
    And it is on line 8, the "code=$?" line

  @test:scripts/tests/exit-status-swallowed.test.ts::exit-status-swallowed::a_failing_assignment_from_a_substitution_is_the_same_defect
  Scenario: A $? read after an assignment from a command substitution is a finding
    Given a run step that assigns out from a command substitution and then reads "rc=$?"
    When the workflow is checked
    Then one finding is reported

  @test:scripts/tests/exit-status-swallowed.test.ts::exit-status-swallowed::`||_code=$?`_is_the_sanctioned_form
  Scenario: A "|| code=$?" read is not a finding
    Given a run step "bun run cat x || code=$?"
    When the workflow is checked
    Then no finding is reported

  @test:scripts/tests/exit-status-swallowed.test.ts::exit-status-swallowed::`set_+e`_earlier_in_the_same_body_makes_the_read_reachable
  Scenario: Turning errexit off earlier in the body makes the read reachable
    Given run steps that turn errexit off with "set +e", "set -u +e" or "set +o errexit" before a command and "code=$?"
    When each is checked
    Then none yields a finding

  @test:scripts/tests/exit-status-swallowed.test.ts::exit-status-swallowed::`set_+e`_in_ANOTHER_step_does_not_cover_this_one
  Scenario: "set +e" in another step does not cover this one
    Given one step with "set +e" before its read, and a second step with a bare command then "code=$?"
    When the workflow is checked
    Then exactly one finding is reported, on the last line

  @test:scripts/tests/exit-status-swallowed.test.ts::exit-status-swallowed::the_first_command_of_an_`else`_reads_the_failed_`if`_condition's_status
  Scenario: A $? read as the first command of an else branch is not a finding
    Given a run step whose if condition is an assignment from a command and whose else branch begins "rc=$?"
    When the workflow is checked
    Then no finding is reported

  @test:scripts/tests/exit-status-swallowed.test.ts::exit-status-swallowed::but_a_read_AFTER_another_command_in_the_`else`_branch_is_still_a_finding
  Scenario: A $? read after another command in the else branch is a finding
    Given a run step whose else branch runs "bun y" and then "rc=$?"
    When the workflow is checked
    Then exactly one finding is reported, on line 10

  @test:scripts/tests/exit-status-swallowed.test.ts::exit-status-swallowed::a_comment_naming_`code=$?`_is_not_a_read
  Scenario: A comment mentioning code=$? is not a read
    Given a run step with a comment naming "code=$?" and a guarded "|| code=$?" read
    When the workflow is checked
    Then no finding is reported

  @test:scripts/tests/exit-status-swallowed.test.ts::exit-status-swallowed::this_layer's_own_workflows_are_clean
  Scenario: This layer's own workflows have no swallowed exit status
    Given this layer's .github/workflows directory exists and holds at least one YAML file
    When every workflow file is checked
    Then none yields a finding
