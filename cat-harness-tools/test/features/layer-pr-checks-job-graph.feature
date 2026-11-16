# The job graph of .github/workflows/layer-pr-checks.yml after the owner's 2026-11-13 card "A. Collapse into one job".
# The lock check, the tier, the ready-for-review reuse and the fast-tier verdict are steps of prepare-head.
# Each Scenario names the test that executes it.
Feature: The light checks of a layer PR run in one job

  @test:test/layer-pr-checks-job-graph.test.ts::the_job_graph::five_jobs_before_(tier,_ready-reuse,_lock-coherence,_prepare-head,_compare_on_the_fast_tier),_one_now
  Scenario: prepare-head needs nothing and every heavy job starts after it
    Given the jobs of layer-pr-checks.yml
    Then they are "compare", "layers-ref", "lock-coherence", "prepare-base", "prepare-head", "record-writers" and "run"
    And there is no "tier" job and no "ready-reuse" job
    And "prepare-head" needs nothing
    And "prepare-base" and "lock-coherence" need "prepare-head"
    And "run" needs "prepare-head" and "prepare-base"
    And "compare" needs "prepare-head", "prepare-base" and "run"

  @test:test/layer-pr-checks-job-graph.test.ts::the_job_graph::on_a_fast-tier_PR_whose_lock_step_passed,_every_job_after_prepare-head_is_skipped
  Scenario: A fast-tier PR whose lock step passed runs one job
    # Gap: checks the conditions' text; GitHub's skip is not exercised
    Given the jobs of layer-pr-checks.yml
    Then "prepare-base" runs only on a push or when prepare-head's output "full" is "true"
    And "run" runs only when "prepare-base" succeeded
    And "compare" is skipped when prepare-head's output "full" is "false"
    And "lock-coherence" is skipped when prepare-head's output "lock-coherence" is "success"

  @test:test/layer-pr-checks-job-graph.test.ts::the_job_graph::prepare-head's_outputs_carry_what_the_folded_jobs_handed_on
  Scenario: prepare-head hands on the outputs the folded jobs gave
    Given the outputs of prepare-head
    Then "full" is the tier step's, "reuse" and "run-url" are the decide step's, and "lock-coherence" is the lock step's outcome

  @test:test/layer-pr-checks-job-graph.test.ts::the_job_graph::the_folded_verdicts_are_steps_in_order:_tier,_lock,_then_the_pins,_the_reuse_decision,_and_the_fast_tier_last
  Scenario: The folded verdicts run in order within prepare-head
    Given the steps of prepare-head
    Then "Which tier (the PR's live labels)" is the first step
    And "Lock pins agree with each other and are at main" comes after it and before the shard matrix
    And the pins step comes before "Already judged? (marked ready for review)"
    And "Fast tier only (advisory; the full checks gate a release)" is the last step

  @test:test/layer-pr-checks-job-graph.test.ts::the_job_graph::each_folded_verdict_keeps_its_name_as_a_heading_in_the_job_summary
  Scenario: Each folded verdict writes its own name to the job summary
    Given the four folded steps of prepare-head
    Then each step's script writes "### <its name>" to the job summary

  @test:test/layer-pr-checks-job-graph.test.ts::the_job_graph::the_lock_step_never_stops_prepare-head,_and_fails_the_lock-coherence_job
  Scenario: The required lock check keeps its name as a job that runs only to report a failure
    Given the lock step of prepare-head and the "lock-coherence" job
    Then the lock step continues on error only in prepare-head
    And the "lock-coherence" job is named "Lock pins agree with each other and are at main"
    And after its first step it runs the same three lock steps as prepare-head

  @test:test/layer-pr-checks-job-graph.test.ts::the_folded_steps'_scripts::lock-coherence:_a_failure_in_prepare-head_fails_the_job;_an_unjudged_lock_is_judged_here
  Scenario: The lock-coherence job fails on prepare-head's failure and judges an unjudged lock itself
    Given the first step of the "lock-coherence" job
    When it runs with prepare-head's lock outcome "failure"
    Then it exits 1 with an error that names the step
    When it runs with the outcome empty, "cancelled" or "skipped"
    Then it exits 0 and says the lock is judged here

  @test:test/layer-pr-checks-job-graph.test.ts::the_folded_steps'_scripts::fast_tier:_the_typecheck_decides,_as_compare's_draft_verdict_did
  Scenario: On the fast tier the typecheck decides
    Given prepare-head's step "Fast tier only (advisory; the full checks gate a release)"
    When it runs with a successful typecheck
    Then it exits 0 and the job summary has its heading and "fast tier: prepare-head success, typecheck success"
    And with a failed typecheck it exits 1
    And with a failed preparation it says the PR side could not be prepared

  @test:test/layer-pr-checks-job-graph.test.ts::the_folded_steps'_scripts::fast_tier:_a_reused_or_pins-only_PR_passes_with_nothing_run
  Scenario: On the fast tier a reused or pins-only PR passes with nothing run
    Given prepare-head's fast-tier step
    When it runs for a PR already judged in another run
    Then it exits 0 and says "SKIPPED — already passed as judged in run" with that run
    When it runs for a PR that changes only the caller's own pins
    Then it exits 0 and says so

  @test:test/layer-pr-checks-job-graph.test.ts::the_folded_steps'_scripts::fast_tier:_the_quick_lane_needs_its_tests_and_the_typecheck
  Scenario: On the fast tier the quick lane needs its tests and the typecheck
    Given prepare-head's fast-tier step in the quick lane
    Then it passes when the quick-lane tests and the typecheck pass
    And it fails when the tests fail or the typecheck fails
