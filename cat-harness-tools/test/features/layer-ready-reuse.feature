# When a layer PR is marked ready for review, .github/scripts/layer-pr-checks/ready-reuse.py reuses an earlier
# run's verdict only on equal inputs; it runs against a stand-in GitHub API, and the layer-pr-checks.yml wiring
# is read from the workflow. Each Scenario names the test that executes it.
Feature: A ready-for-review run reuses an earlier verdict only on equal inputs

  @test:test/layer-ready-reuse.test.ts::ready-reuse.py::key:_names_the_inputs,_and_changes_when_any_of_them_does
  Scenario: The judged key names the inputs and changes when any of them does
    Given the head, base, merge commit, index pin, tools pin and graph state
    When ready-reuse.py computes the key
    Then it is "layer-judged-" followed by 40 hex characters
    And it changes when the base sha, the index pin or the tools pin changes
    And it changes when the state file is absent
    And it changes when the merge commit's tree changes

  @test:test/layer-ready-reuse.test.ts::ready-reuse.py::key:_an_unreadable_merge_commit_records_nothing,_never_a_guess
  Scenario: An unreadable merge commit records an empty key
    Given the API refuses the merge commit request
    When ready-reuse.py computes the key
    Then the key is empty

  @test:test/layer-ready-reuse.test.ts::ready-reuse.py::pins:_an_earlier_full-tier_pass_with_the_same_key_is_reused
  Scenario: An earlier full-tier pass with the same key is reused
    Given run 800, 30 hours ago, whose full-tier job succeeded and which recorded the current key
    When ready-reuse.py decides
    Then reuse is "true" by "pins" from run "800" with the current key
    And the summary says "SKIPPED -- already passed as judged in run"

  @test:test/layer-ready-reuse.test.ts::ready-reuse.py::pins:_a_different_key_is_never_reused,_however_recent
  Scenario: A different key is never reused however recent
    Given run 800, 1 hour ago, whose full-tier job succeeded but which recorded a different key
    When ready-reuse.py decides
    Then reuse is "false"

  @test:test/layer-ready-reuse.test.ts::ready-reuse.py::a_draft's_fast_tier,_or_a_failed_full_tier,_never_counts
  Scenario: A draft's fast tier or a failed full tier never counts
    Given run 800 with only a successful fast-tier job and run 801 with a failed full-tier job, both recording the current key
    When ready-reuse.py decides
    Then reuse is "false"

  @test:test/layer-ready-reuse.test.ts::ready-reuse.py::another_workflow's_run,_or_this_run_itself,_never_counts
  Scenario: Another workflow's run or this run itself never counts
    Given run 800 of another workflow and this run itself, both with a successful full tier and the current key
    When ready-reuse.py decides
    Then reuse is "false"

  @test:test/layer-ready-reuse.test.ts::ready-reuse.py::window:_a_run_with_no_record_counts_only_with_the_same_base_and_within_record-pin-max-hours
  Scenario: A run with no recorded key counts only with the same base and within the max hours
    Given run 800, 3 hours ago, with a successful full tier, the same base and no recorded key
    When ready-reuse.py decides with a 24-hour maximum
    Then reuse is "true" by "window"
    And the same run 30 hours ago is not reused
    And the same run 3 hours ago with a different base is not reused
    And the same run 3 hours ago with no pull request is not reused

  @test:test/layer-ready-reuse.test.ts::ready-reuse.py::an_API_error_is_no_reuse
  Scenario: An API error means no reuse
    Given run 800 with a successful full tier and the current key
    And the API refuses the jobs request
    When ready-reuse.py decides
    Then reuse is "false"
    And the summary says "Could not determine"

  @test:test/layer-ready-reuse.test.ts::the_workflow's_wiring::only_a_ready_for_review_PR_event_asks
  Scenario: The "Already judged?" step of prepare-head runs on a ready_for_review pull_request event
    # Gap: checks that the step's if contains both clauses; other events are not exercised
    Given the jobs of layer-pr-checks.yml
    Then there is no "ready-reuse" job
    And prepare-head's step "decide" is named "Already judged? (marked ready for review)"
    And its if condition contains "github.event.action == 'ready_for_review'"
    And it contains "github.event_name == 'pull_request'"

  @test:test/layer-ready-reuse.test.ts::the_workflow's_wiring::a_reused_answer_prepares_nothing_on_either_side
  Scenario: A reused answer prepares nothing on either side
    # Gap: checks the conditions' text; the runtime skip is not exercised
    Given prepare-head's steps "decide", "skip-prep" and "judged-key"
    Then "decide" writes "REUSED=true" to GITHUB_ENV
    And "skip-prep" hits when "env.REUSED == 'true'"
    And "judged-key" runs only when "env.REUSED != 'true'"
    And prepare-base needs "prepare-head" and its if condition contains "needs.prepare-head.outputs.reuse != 'true'" and "!cancelled()"
    And prepare-head's output "reuse" is the decide step's

  @test:test/layer-ready-reuse.test.ts::the_workflow's_wiring::ready-reuse_pins_the_run_as_prepare-head_does,_before_deciding
  Scenario: The reuse decision reads the run's pins
    Given the steps of the prepare-head job
    Then its "pins" step comes before its "decide" step
    And "decide" reads INDEX from the pins step

  @test:test/layer-ready-reuse.test.ts::the_workflow's_wiring::a_full-tier_PR_run_records_its_key;_compare_reports_the_reuse_under_the_full_verdict's_name
  Scenario: A full-tier PR run records its key and compare reports the reuse under the full verdict
    Given the "judged-key" step of prepare-head
    Then its if condition contains "github.event_name == 'pull_request'" and "env.FULL == 'true'"
    And the compare job needs "prepare-head"
    And compare's "pins-only" step has REUSED reading "needs.prepare-head.outputs.reuse == 'true'"
    And its script says "SKIPPED — already passed as judged in run"
    And prepare-head's step "Fast tier only (advisory; the full checks gate a release)" reads REUSED from the decide step and says the same
