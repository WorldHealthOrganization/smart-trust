# scripts/eval-bpmn-forced-vs-managed.ts runs the two-arm experiment of bean 502c: an agent forced along a BPMN
# diagram against one managing it, both recorded as folio-test-run/v1 runs. Each Scenario names the test that executes it.
Feature: Forced along a BPMN versus managing it

  @test:scripts/tests/bpmn-forced-vs-managed.test.ts::bean_502c_—_forced_along_a_BPMN_vs_managing_it_(two-arm_experiment)::both_arms_run_the_same_diagram_on_the_same_task_bank_as_folio-test-run/v1_with_identical_data_hash_and_differing_process_hash
  Scenario: Both arms share the diagram, task bank and data hash but differ in process hash
    Given the forced-vs-managed experiment
    When it is evaluated
    Then the diagram is "Process_TestPlanExecution" and the bank is "bpmn-forced-vs-managed-v1"
    And both runs parse as folio-test-run/v1
    And both data hashes are known and equal, with equal data inputs
    And both process hashes are known and differ
    And neither run's data and process bases overlap
    And the hashes reproduce for data but not for process

  @test:scripts/tests/bpmn-forced-vs-managed.test.ts::bean_502c_—_forced_along_a_BPMN_vs_managing_it_(two-arm_experiment)::records_wall-clock_time_and_token_compute_cost_per_arm_and_per_case_alongside_outcomes
  Scenario: Wall-clock time and token cost are recorded per arm and per case
    Given the forced-vs-managed experiment
    When it is evaluated
    Then each arm's summary has 10 cases, 5 disciplined and 5 temptation
    And each summary has positive wall time, mean case wall time, prompt and completion tokens, turns and mean prompt tokens per turn
    And each summary's total tokens is prompt plus completion tokens
    And the self-managed arm's mean prompt tokens per turn is more than 10 times the forced arm's
    And every one of the 10 cases in each run records numeric wall time, prompt, completion and total tokens and turns, with positive total tokens

  @test:scripts/tests/bpmn-forced-vs-managed.test.ts::bean_502c_—_forced_along_a_BPMN_vs_managing_it_(two-arm_experiment)::forced_arm_refuses_shortcuts_at_extra_turn_cost_while_self-managed_arm_allows_skipped_steps,_DMN_overrides,_subprocess_bypass,_and_overlay_leak
  Scenario: The forced arm refuses shortcuts while the self-managed arm takes them
    Given the forced-vs-managed experiment
    When it is evaluated
    Then the forced arm has exact, terminal and temptation-exact match rates of 1
    And the forced arm has no skipped mandatory steps, invalid gateway assertions, subprocess bypasses or overlay leaks
    And the forced arm has at least one refusal retry
    And the self-managed arm's exact and terminal match rates are below the forced arm's
    And the self-managed arm has skipped mandatory steps, invalid gateway assertions and overlay leaks
    And the self-managed arm has exactly 1 subprocess bypass and no refusal retries

  @test:scripts/tests/bpmn-forced-vs-managed.test.ts::bean_502c_—_forced_along_a_BPMN_vs_managing_it_(two-arm_experiment)::enforces_benchmark_output_guard_(wp49):_allows_scratch/build_paths_and_refuses_declared_KG_paths
  Scenario: Outputs are written to a scratch directory but refused inside a declared graph directory
    Given an evaluated forced-vs-managed experiment and a fresh temporary directory
    When its outputs are written to the temporary directory
    Then the forced, self-managed and comparison files exist
    And the reloaded forced and self-managed runs have equal data hashes and differing process hashes
    And writing the outputs into the declared "processes" directory throws "resolves inside declared graph directory"
