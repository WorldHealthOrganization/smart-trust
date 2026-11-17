# scripts/staging-cleanup-preflight.ts decides whether a staging preview may be removed,
# refusing while it is live or when any signal could not be read; the skills document the
# failure modes. Each Scenario names the test that executes it.
Feature: Staging cleanup preflight

  @test:scripts/tests/sdlc/staging-cleanup.test.ts::the_preflight's_verdicts::allows_removal_when_every_signal_was_evaluated_and_every_one_said_no
  Scenario: Removal is allowed when every signal was evaluated and every one said no
    Given no open PR claims slug "claude-merged-last-week"
    And its only branch is merged into the default branch and was last committed eleven days ago
    When the preflight runs
    Then the decision is "remove"

  @test:scripts/tests/sdlc/staging-cleanup.test.ts::the_preflight's_verdicts::REFUSES_the_`brave-hypatia`_shape_—_the_case_the_health_check_was_rewritten_for
  Scenario: A recently committed, unmerged branch is refused as live
    Given no open PR claims slug "claude-brave-hypatia-r820sf"
    And its branch is unmerged and was committed two minutes ago
    When the preflight runs
    Then the decision is "refuse-live"
    And the reasons include "unmerged-branch" and "recent-commit"

  @test:scripts/tests/sdlc/staging-cleanup.test.ts::the_preflight's_verdicts::REFUSES_on_could-not-tell_—_the_opposite_direction_to_the_sweep,_and_for_the_same_reason
  Scenario: Could-not-tell refuses removal
    When the open-PR lookup is unknown because GitHub returned 403
    Then the decision is "refuse-unknown"
    When the branch listing is unknown because git ls-remote exited 128
    Then the decision is "refuse-unknown"
    When a candidate branch's merge state could not be evaluated ("bad object")
    Then the decision is "refuse-unknown" and the reason mentions "bad object"

  @test:scripts/tests/sdlc/staging-cleanup.test.ts::the_preflight's_verdicts::refuses_a_slug_that_is_a_path_or_carries_an_impossible_character,_before_asking_anything
  Scenario: A slug that is a path or carries an impossible character is refused before asking anything
    When the slug is "", ".", "..", "_retired", "../../etc", "a/b", "a b", "a;rm -rf /" or "*"
    Then each has a slug problem and the preflight decision is "refuse-unknown"
    And "claude-health-checks" and "release.v1-0-rc1" have no slug problem

  @test:scripts/tests/sdlc/staging-cleanup.test.ts::the_preflight's_verdicts::REFUSES_removal_when_another_open_PR_is_reusing_or_claiming_the_slug_(bean_oz5w)
  Scenario: Removal is refused when another open PR is reusing or claiming the slug
    Given an open PR on "claude/shared-slug"
    And that branch is merged and last committed eleven days ago
    When the preflight runs for "claude-shared-slug"
    Then the decision is "refuse-live" with reason "open-pr"

  @test:scripts/tests/sdlc/staging-cleanup.test.ts::the_preflight's_verdicts::REFUSES_removal_when_a_candidate_branch_has_unmerged_work_claiming_the_slug
  Scenario: Removal is refused when a candidate branch has unmerged work claiming the slug
    Given no open PR and an unmerged branch "claude/reused-branch" last committed eleven days ago
    When the preflight runs
    Then the decision is "refuse-live" with reason "unmerged-branch"

  @test:scripts/tests/sdlc/staging-cleanup.test.ts::the_preflight's_verdicts::REFUSES_removal_when_a_candidate_branch_has_a_recent_commit_claiming_the_slug
  Scenario: Removal is refused when a candidate branch has a recent commit claiming the slug
    Given no open PR and a merged branch "claude/reused-branch" committed five minutes ago
    When the preflight runs
    Then the decision is "refuse-live" with reason "recent-commit"

  @test:scripts/tests/sdlc/staging-cleanup.test.ts::skills_documentation_covers_bean_oz5w_failure_modes::the_work_item_these_modes_came_from_is_recorded,_in_the_skill_or_its_provenance_log
  Scenario: The work item the failure modes came from is recorded
    Given the ci-health and staging-review skills, each with its provenance log if present
    Then ci-health mentions "folio-assistant-oz5w"
    And staging-review mentions "oz5w"

  @test:scripts/tests/sdlc/staging-cleanup.test.ts::skills_documentation_covers_bean_oz5w_failure_modes::ci-health_documents_that_cancelled_is_NOT_benign_when_previous_state_is_a_deletion
  Scenario: ci-health documents that cancelled is not benign after a deletion
    Given the ci-health skill body
    Then it contains "never when the previous state is a deletion"

  @test:scripts/tests/sdlc/staging-cleanup.test.ts::skills_documentation_covers_bean_oz5w_failure_modes::staging-review_documents_checking_gh-pages_commit_log_for_newer_staging(cleanup)_and_the_re-publish_command
  Scenario: staging-review documents checking for a newer staging(cleanup) and the re-publish command
    Given the staging-review skill body
    Then it contains "staging(cleanup)"
    And it contains "gh workflow run feature-staging.yml -f branch=<branch>"
