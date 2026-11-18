# scripts/stage-workflow-local.ts lets an agent replay the staging workflow's own steps
# locally: expressions, step conditions, command files and marketplace actions.
# Each Scenario names the test that executes it.
Feature: Replaying the staging workflow locally

  @test:scripts/tests/sdlc/stage-workflow-local.test.ts::expressions,_as_Actions_evaluates_them::the_checkout_ref_picks_the_merge_sha_on_a_PR
  Scenario: The checkout ref picks the merge sha on a pull request
    Given a context with event "pull_request", sha "abc", empty verify_pr and branch "b"
    When the checkout ref expression is evaluated
    Then it gives "abc"

  @test:scripts/tests/sdlc/stage-workflow-local.test.ts::expressions,_as_Actions_evaluates_them::an_empty_input_equals_''_and_a_missing_one_does_too
  Scenario: An empty input and a missing input both equal ''
    Given a context with verify_pr set to ""
    When "inputs.verify_pr == ''" and "inputs.nothing == ''" are evaluated
    Then both are true

  @test:scripts/tests/sdlc/stage-workflow-local.test.ts::expressions,_as_Actions_evaluates_them::&&_and_||_return_values,_not_booleans
  Scenario: && and || return values, not booleans
    Given a context where vars.WRITER_SKIP is ""
    When "vars.WRITER_SKIP != 'off' && '1' || ''" is evaluated
    Then it gives the string "1"

  @test:scripts/tests/sdlc/stage-workflow-local.test.ts::expressions,_as_Actions_evaluates_them::string_comparison_ignores_case,_as_Actions_does
  Scenario: String comparison ignores case, as Actions does
    Given a step output "api" of "yes"
    When it is compared with "YES"
    Then the comparison is true

  @test:scripts/tests/sdlc/stage-workflow-local.test.ts::expressions,_as_Actions_evaluates_them::interpolation_substitutes_every_${{_}}
  Scenario: Interpolation substitutes every ${{ }}
    When "name (staging: ${{ inputs.branch }}) at ${{ github.sha }}" is interpolated
    Then it gives "name (staging: b) at abc"

  @test:scripts/tests/sdlc/stage-workflow-local.test.ts::expressions,_as_Actions_evaluates_them::an_unknown_function_refuses_rather_than_guessing
  Scenario: An unknown function refuses rather than guessing
    When "fromJSON('1')" is evaluated
    Then it throws "not replayed"

  @test:scripts/tests/sdlc/stage-workflow-local.test.ts::a_step's_if::no_status_function_means_success()_&&_(…)
  Scenario: An if with no status function means success() && (…)
    Given the if "github.event_name == 'pull_request'" on a pull_request event
    Then the step runs while nothing has failed
    And it does not run after a failure

  @test:scripts/tests/sdlc/stage-workflow-local.test.ts::a_step's_if::!cancelled()_runs_after_a_failure
  Scenario: !cancelled() runs after a failure
    Given an earlier step has failed
    When the if is "${{ !cancelled() }}"
    Then the step runs

  @test:scripts/tests/sdlc/stage-workflow-local.test.ts::a_step's_if::no_if_runs_only_while_nothing_has_failed
  Scenario: A step with no if runs only while nothing has failed
    When a step has no if
    Then it runs while nothing has failed
    And it does not run after a failure

  @test:scripts/tests/sdlc/stage-workflow-local.test.ts::$GITHUB_OUTPUT_and_$GITHUB_ENV::k=v_lines_and_heredoc_blocks
  Scenario: Command files read k=v lines and heredoc blocks
    When "a=1", "b=x=y" and a "c<<EOF" heredoc of "l1" and "l2" are parsed
    Then a is "1", b is "x=y" and c is "l1\nl2"

  @test:scripts/tests/sdlc/stage-workflow-local.test.ts::marketplace_actions::each_one_the_staging_workflow_uses_has_a_replay
  Scenario: Each marketplace action the staging workflow uses has a replay
    # Gap: three hard-coded actions are checked; the workflow's actual uses: lines are not read
    When checkout, cache/restore and a local action are classified
    Then "actions/checkout@abc" replays as "checkout"
    And "actions/cache/restore@abc" replays as "skip"
    And "./.github/actions/typedoc-api" replays as "local"

  @test:scripts/tests/sdlc/stage-workflow-local.test.ts::marketplace_actions::an_unknown_action_refuses
  Scenario: An unknown action refuses
    When "someone/else@v1" is classified
    Then it throws "no local replay"
