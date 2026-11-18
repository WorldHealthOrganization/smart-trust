# scripts/check-red-gate-is-last.ts checks that each deliberately red gate in the gates
# workflow runs alone in the last step of its job. Each Scenario names the test that executes it.
Feature: Deliberately red gates run last and alone

  @test:scripts/tests/sdlc/red-gate-is-last.test.ts::the_real_workflow::it_PARSED_—_jobs_and_steps_were_found,_so_a_clean_verdict_means_something
  Scenario: The real gates workflow parses into jobs and steps
    # Skipped: when the repository root is not applicable (a content root with no gates workflow)
    Given .github/workflows/code-quality-gates.yml in this repository
    When the red-gate check reads it
    Then more than zero jobs are counted
    And more than zero steps are counted

  @test:scripts/tests/sdlc/red-gate-is-last.test.ts::the_real_workflow::every_declared_red_gate_was_LOCATED,_not_merely_not-found
  Scenario: Every declared red gate is located in the real workflow
    # Skipped: when the repository root is not applicable (a content root with no gates workflow)
    Given .github/workflows/code-quality-gates.yml in this repository
    When the red-gate check reads it
    Then the located gate scripts equal the DELIBERATELY_RED scripts

  @test:scripts/tests/sdlc/red-gate-is-last.test.ts::the_real_workflow::each_is_the_last_step_of_its_job
  Scenario: Each declared red gate is the last step of its job in the real workflow
    # Skipped: when the repository root is not applicable (a content root with no gates workflow)
    Given .github/workflows/code-quality-gates.yml in this repository
    When the red-gate check reads it
    Then there are no findings
    And every located gate's step index is the job's step count minus one

  @test:scripts/tests/sdlc/red-gate-is-last.test.ts::falsified_by_breaking_—_a_step_registered_below_the_red_one::one_step_after_it_is_caught,_and_the_finding_names_that_step
  Scenario: One step after the red gate is a not-last finding naming that step
    Given a job whose "drift:check" step is followed by a step named "appended later"
    When the red-gate check runs over it
    Then the only finding is "not-last"
    And its message contains "appended later" and "step 1 of 2"

  @test:scripts/tests/sdlc/red-gate-is-last.test.ts::falsified_by_breaking_—_a_step_registered_below_the_red_one::several_steps_after_it_are_all_named
  Scenario: Several steps after the red gate are all named
    Given a job whose "drift:check" step is followed by steps "alpha" and "beta"
    When the red-gate check runs over it
    Then the finding message contains "alpha", "beta" and "2 step(s) follow"

  @test:scripts/tests/sdlc/red-gate-is-last.test.ts::falsified_by_breaking_—_a_step_registered_below_the_red_one::last_in_its_job_is_clean_—_the_rule_is_about_position,_not_about_the_gate
  Scenario: A red gate last in its job is clean
    Given a job whose last step runs "drift:check" after another step
    When the red-gate check runs over it
    Then there are no findings
    And the gate is located in job "gates" at index 1 of 2

  @test:scripts/tests/sdlc/red-gate-is-last.test.ts::falsified_by_breaking_—_bundled_into_a_step_with_other_gates::sharing_a_step_is_caught_EVEN_WHEN_the_step_is_last
  Scenario: Sharing a step with other gates is caught even when the step is last
    Given a single step running "drift:check", "other:check" and "third:check" under set -e
    When the red-gate check runs over it
    Then the only finding is "shares-a-step"
    And its message contains "2 other gate(s)" and "other:check"

  @test:scripts/tests/sdlc/red-gate-is-last.test.ts::falsified_by_breaking_—_bundled_into_a_step_with_other_gates::bundled_AND_not_last_reports_both,_rather_than_stopping_at_the_first
  Scenario: A red gate both bundled and not last reports both findings
    Given a step running "drift:check" with "other:check", followed by a step named "after"
    When the red-gate check runs over it
    Then the findings are "not-last" and "shares-a-step"

  @test:scripts/tests/sdlc/red-gate-is-last.test.ts::falsified_by_breaking_—_bundled_into_a_step_with_other_gates::alone_in_a_last_step_is_clean
  Scenario: A red gate alone in the last step is clean
    Given a job whose only step runs "drift:check"
    When the red-gate check runs over it
    Then there are no findings

  @test:scripts/tests/sdlc/red-gate-is-last.test.ts::a_declared_gate_that_is_not_there_at_all::absent_is_a_FINDING,_not_a_pass
  Scenario: A declared gate missing from the workflow is an absent finding
    Given a job whose only step runs "something:else"
    When the red-gate check runs over it for "drift:check"
    Then the only finding is "absent"
    And its message contains "appears in no step"

  @test:scripts/tests/sdlc/red-gate-is-last.test.ts::a_declared_gate_that_is_not_there_at_all::an_empty_workflow_yields_no_jobs,_which_`main`_treats_as_exit_2
  Scenario: An empty workflow counts no jobs and still reports the gate absent
    # Gap: that main exits 2 on zero jobs is not checked
    Given a workflow with an empty jobs map
    When the red-gate check runs over it
    Then zero jobs and zero steps are counted
    And the only finding is "absent"

  @test:scripts/tests/sdlc/red-gate-is-last.test.ts::a_declared_gate_that_is_not_there_at_all::a_null_document_does_not_throw
  Scenario: A null workflow document does not throw
    Given a null workflow document
    When the red-gate check runs over it
    Then it does not throw
    And the only finding is "absent"

  @test:scripts/tests/sdlc/red-gate-is-last.test.ts::invocations_—_what_counts_as_running_a_gate::one_per_line,_in_order
  Scenario: Gate invocations are read one per line in order
    Given a run block "bun run a:check" then "bun run b:check" on separate lines
    When its invocations are read
    Then they are "a:check" and "b:check" in that order

  @test:scripts/tests/sdlc/red-gate-is-last.test.ts::invocations_—_what_counts_as_running_a_gate::indented_lines_inside_a_block_count
  Scenario: Indented invocation lines count
    Given an indented run block with "set -e" and "bun run a:check"
    When its invocations are read
    Then they are just "a:check"

  @test:scripts/tests/sdlc/red-gate-is-last.test.ts::invocations_—_what_counts_as_running_a_gate::a_COMMENTED-OUT_invocation_does_not_count
  Scenario: A commented-out invocation does not count
    Given a run block whose two "bun run" lines are both commented out, one indented
    When its invocations are read
    Then there are none

  @test:scripts/tests/sdlc/red-gate-is-last.test.ts::invocations_—_what_counts_as_running_a_gate::a_bare_`bun_run`_with_no_target_yields_nothing_rather_than_an_empty_name
  Scenario: A bare "bun run" with no target yields no invocation
    Given a run block "bun run" with nothing after it
    When its invocations are read
    Then there are none

  @test:scripts/tests/sdlc/red-gate-is-last.test.ts::invocations_—_what_counts_as_running_a_gate::an_absent_or_non-string_run_is_empty,_not_a_throw
  Scenario: An absent run yields no invocations rather than throwing
    # Gap: only an undefined run is checked, not a non-string one
    Given an undefined run block
    When its invocations are read
    Then there are none

  @test:scripts/tests/sdlc/red-gate-is-last.test.ts::a_bare_runner_is_a_gate_too_—_`bun_test`_takes_no_target::it_is_named_by_its_own_spelling,_so_the_declaration_reads_like_the_workflow
  Scenario: A bare "bun test" is named by its own spelling
    Given the run blocks "bun test" and an indented "bun test" line
    When their invocations are read
    Then each yields "bun test"

  @test:scripts/tests/sdlc/red-gate-is-last.test.ts::a_bare_runner_is_a_gate_too_—_`bun_test`_takes_no_target::a_COMMENTED-OUT_bare_runner_does_not_count,_same_as_a_`bun_run`_line
  Scenario: A commented-out bare runner does not count
    Given a run block whose two "bun test" lines are both commented out
    When its invocations are read
    Then there are none

  @test:scripts/tests/sdlc/red-gate-is-last.test.ts::a_bare_runner_is_a_gate_too_—_`bun_test`_takes_no_target::arguments_narrow_the_run_and_are_ignored_—_position_still_applies
  Scenario: Arguments to "bun test" are ignored
    Given the run block "bun test cat-harness/content/pipeline"
    When its invocations are read
    Then they are just "bun test"

  @test:scripts/tests/sdlc/red-gate-is-last.test.ts::a_bare_runner_is_a_gate_too_—_`bun_test`_takes_no_target::`bun_testing:check`_is_a_`bun_run`-less_word,_not_a_bare_runner
  Scenario: "bun testing:check" is not read as a bare runner
    Given the run block "bun testing:check"
    When its invocations are read
    Then there are none

  @test:scripts/tests/sdlc/red-gate-is-last.test.ts::a_bare_runner_is_a_gate_too_—_`bun_test`_takes_no_target::both_spellings_in_one_step,_in_order
  Scenario: Both spellings in one step are read in order
    Given a run block "bun run a:check", "bun test", "bun run b:check" on separate lines
    When its invocations are read
    Then they are "a:check", "bun test" and "b:check" in that order

  @test:scripts/tests/sdlc/red-gate-is-last.test.ts::a_bare_runner_is_a_gate_too_—_`bun_test`_takes_no_target::falsified_by_breaking_—_a_step_appended_below_it_is_caught
  Scenario: A step appended below a bare-runner red gate is caught
    Given "bun test" declared as the red gate
    And a job whose "bun test" step is followed by a step named "appended later"
    When the red-gate check runs over it
    Then the only finding is "not-last"
    And its message contains "appended later"

  @test:scripts/tests/sdlc/red-gate-is-last.test.ts::a_bare_runner_is_a_gate_too_—_`bun_test`_takes_no_target::falsified_by_breaking_—_bundling_it_with_another_gate_is_caught
  Scenario: Bundling a bare-runner red gate with another gate is caught
    Given "bun test" declared as the red gate
    And a single step running "bun test" and "bun run other:check"
    When the red-gate check runs over it
    Then the only finding is "shares-a-step"
    And its message contains "other:check"

  @test:scripts/tests/sdlc/red-gate-is-last.test.ts::a_bare_runner_is_a_gate_too_—_`bun_test`_takes_no_target::it_is_DECLARED,_so_the_corpus_test_above_is_really_asserting_its_position
  Scenario: "bun test" is declared as a deliberately red gate
    Given the DELIBERATELY_RED list
    Then its scripts include "bun test"

  @test:scripts/tests/sdlc/red-gate-is-last.test.ts::not_applicable_in_a_content_root_(cat-harness-tools#1701)::a_root_with_no_gates_workflow_is_a_content_root:_not_applicable,_with_a_reason
  Scenario: A root with no gates workflow is a not-applicable content root
    Given an empty temp directory
    When applicability is checked for it
    Then the reason given contains "content root"

  @test:scripts/tests/sdlc/red-gate-is-last.test.ts::not_applicable_in_a_content_root_(cat-harness-tools#1701)::a_root_that_carries_it_is_a_harness_root_and_is_judged_as_before
  Scenario: A root carrying the gates workflow is judged as a harness root
    Given a temp directory holding .github/workflows/code-quality-gates.yml
    When applicability is checked for it
    Then no not-applicable reason is given
