# .github/scripts/layer-pr-checks/pr-gone.py, driven through python3 against a stand-in GitHub API, and its
# wiring in layer-pr-checks.yml (cat-harness-tools#2391): a PR run that starts as the PR merges or closes finds
# refs/pull/N/merge gone, and judges nothing instead of failing red. Each Scenario names the test that executes it.
Feature: A PR run that starts as the PR merges judges nothing, and says so

  @test:test/layer-pr-gone.test.ts::pr-gone.py::an_open_PR_is_not_gone,_and_the_run_goes_on
  Scenario: An open PR is not gone
    Given the API says PR 1 is open
    When pr-gone.py runs with the token
    Then it writes gone=false and state=open, and sets no GONE

  @test:test/layer-pr-gone.test.ts::pr-gone.py::a_merged_PR_is_gone:_GONE_is_set_and_a_notice_says_there_is_nothing_to_judge
  Scenario: A merged PR is gone
    Given the API says PR 2 is merged
    When pr-gone.py runs
    Then it writes gone=true and state=merged, and GONE=true to GITHUB_ENV
    And a notice and the step summary say there is nothing to judge

  @test:test/layer-pr-gone.test.ts::pr-gone.py::a_closed,_unmerged_PR_is_gone_too
  Scenario: A closed, unmerged PR is gone too
    Given the API says PR 3 is closed and not merged
    Then pr-gone.py writes gone=true and state=closed

  @test:test/layer-pr-gone.test.ts::pr-gone.py::a_PR_that_cannot_be_read_is_taken_as_open,_never_as_gone
  Scenario: A PR that cannot be read is taken as open
    Given the API answers 500, 404, or nothing at all
    Then pr-gone.py writes gone=false and state=unknown, and exits 0

  @test:test/layer-pr-gone.test.ts::pr-gone.py::--late:_gone_exits_0;_open_or_unread_keeps_the_failed_checkout_a_failure
  Scenario: After a failed checkout, only a gone PR is excused
    Given a checkout of the merge ref failed
    When pr-gone.py runs with --late
    Then a merged PR exits 0
    And an open PR, or one that cannot be read, exits 1 with an error

  @test:test/layer-pr-gone.test.ts::the_workflow's_wiring::prepare-head_asks_before_its_checkout,_and_again_only_when_a_checkout_of_the_PR_side_failed
  Scenario: prepare-head asks before its checkout, and again after a failed one
    Given the steps of prepare-head
    Then "pr-open" comes after the judging scripts and before the root's checkout, on a pull request, never red
    And "pr-open-late" comes after the caller's checkout and before "skip-prep", runs only when a checkout failed
    And "pr-open-late" fails the job on the full tier

  @test:test/layer-pr-gone.test.ts::the_workflow's_wiring::gone_skips_the_checkouts_and_every_prepared_step_after_them
  Scenario: Gone skips the checkouts and every prepared step
    Given GONE is set
    Then the checkouts, "lock-only" and "quick" are skipped
    And "skip-prep" hits, and every step after it has a condition
    And prepare-head's output "gone" reads both probes

  @test:test/layer-pr-gone.test.ts::the_workflow's_wiring::the_later_jobs_judge_nothing_for_a_gone_PR
  Scenario: The later jobs judge nothing for a gone PR
    Given prepare-head's output "gone" is true
    Then prepare-base, layers-ref and lock-coherence are skipped
    And compare's "pins-only" step reports nothing to judge and sets only=true

  @test:test/layer-pr-gone.test.ts::the_workflow's_wiring::the_fast_tier's_advisory_verdict_is_green,_and_says_why,_for_a_gone_PR
  Scenario: The fast tier's advisory verdict is green for a gone PR
    Given a gone PR whose checkout failed on the fast tier
    When the "Fast tier only" step runs
    Then the verdict is green and the summary says the PR was merged as the run started
