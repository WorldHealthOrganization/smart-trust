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
    And "lock-coherence" is skipped when prepare-head's output "full" is "false"

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

  @test:test/layer-pr-checks-job-graph.test.ts::the_folded_steps'_scripts::fast_tier:_the_typecheck_decides,_as_compare's_draft_verdict_did,_and_a_red_is_advisory_(exit_0,_verdict=red)
  Scenario: On the fast tier the typecheck decides, and a red is advisory
    Given prepare-head's step "Fast tier only (advisory; the full checks gate a release)"
    When it runs with a successful typecheck
    Then it exits 0 with verdict "green", and the job summary has its heading and "fast tier: prepare-head success, typecheck success"
    When it runs with a failed typecheck
    Then it exits 0 with verdict "red", a "Fast tier RED (advisory)" warning and "Verdict: RED (advisory)" in the summary
    And with a failed preparation the warning says the PR side could not be prepared

  @test:test/layer-pr-checks-job-graph.test.ts::the_folded_steps'_scripts::fast_tier:_a_step_red_under_continue-on-error_is_named_from_the_steps'_outcomes
  Scenario: A step red under the fast tier's continue-on-error is named
    Given prepare-head's fast-tier step and the steps' outcomes
    When a preparing step's outcome is "failure"
    Then the verdict is "red" and names that step
    And a never-a-gate step's failure is not counted

  @test:test/layer-pr-checks-job-graph.test.ts::the_folded_steps'_scripts::fast_tier:_a_red_lock_step_is_reported_here,_since_lock-coherence_skips_on_the_fast_tier
  Scenario: A red lock step is reported by the fast tier's verdict
    Given prepare-head's fast-tier step
    When the lock step's outcome is "failure"
    Then the verdict is "red" and says the lock pins do not agree

  @test:test/layer-pr-checks-job-graph.test.ts::the_folded_steps'_scripts::fast_tier:_a_reused_or_pins-only_PR_passes_with_nothing_run
  Scenario: On the fast tier a reused or pins-only PR passes with nothing run
    Given prepare-head's fast-tier step
    When it runs for a PR already judged in another run
    Then its verdict is "green" and it says "SKIPPED — already passed as judged in run" with that run
    When it runs for a PR that changes only the caller's own pins
    Then its verdict is "green" and it says so

  @test:test/layer-pr-checks-job-graph.test.ts::the_folded_steps'_scripts::fast_tier:_the_quick_lane_needs_its_tests_and_the_typecheck
  Scenario: On the fast tier the quick lane needs its tests and the typecheck
    Given prepare-head's fast-tier step in the quick lane
    Then its verdict is "green" when the quick-lane tests and the typecheck pass
    And it is "red" (advisory, exit 0) when the tests fail or the typecheck fails

  @test:test/layer-pr-checks-job-graph.test.ts::the_advisory_fast_tier::every_prepare-head_step_after_the_tier_is_continue-on-error_on_the_fast_tier_only
  Scenario: Every step of prepare-head after the tier continues on error on the fast tier only
    Given the steps of prepare-head
    Then each step after "Which tier" continues on error when "steps.tier.outputs.full == 'false'", or already did
    And neither the tier step nor the verdict step continues on error

  @test:test/layer-pr-checks-job-graph.test.ts::the_advisory_fast_tier::a_fast-tier_step_that_can_go_red_has_an_id,_so_the_verdict_can_name_it
  Scenario: Every step the fast tier lets go red has an id
    Given the steps of prepare-head that continue on error on the fast tier
    Then each has an id, the verdict reads "toJSON(steps)", and prepare-head outputs "fast-verdict"

  @test:test/layer-pr-checks-job-graph.test.ts::the_advisory_fast_tier::the_expression_is_false_outside_prepare-head's_fast_tier:_the_full_tier_and_every_other_job_fail_hard
  Scenario: The full tier and every other job fail hard
    # Gap: GitHub's evaluation of the expression is not exercised; its inputs are
    Given the jobs of layer-pr-checks.yml
    Then no job but prepare-head has a "tier" step
    And no step of "compare" continues on error on the fast tier

  @test:test/layer-pr-checks-job-graph.test.ts::the_advisory_fast_tier::layers-ref_waits_for_the_tier_and_is_a_warning_on_the_fast_tier_only
  Scenario: layers-ref is advisory on the fast tier only
    Given the "layers-ref" job
    Then it needs "prepare-head" and runs unless cancelled
    And its step reads ADVISORY from prepare-head's "full" output, warns when it is true and errors otherwise
