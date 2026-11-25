# scripts/verdict-reuse.sh decides whether a push to main may reuse a PR run's green verdict; it is
# run in a throwaway repository against a stub gh serving fixed API answers.
# Each Scenario names the test that executes it.
Feature: A push to main reuses a PR run's verdict only when it tested the same tree

  @test:scripts/tests/sdlc/verdict-reuse.test.ts::verdict-reuse.sh::a_squash_merge_reuses_the_run_of_the_PR_merged_as_it,_when_the_recorded_tree_is_its_tree
  Scenario: A squash merge reuses its PR's run when the recorded tree is its tree
    Given a PR run with every job succeeding and a "tested-tree-<tree>" artifact naming the squash commit's tree
    And the squash commit is the merge commit of one merged PR
    When the script judges the squash commit
    Then it exits 0 and writes "reuse=true"

  @test:scripts/tests/sdlc/verdict-reuse.test.ts::verdict-reuse.sh::a_two-parent_merge_reads_the_same_artifact_record
  Scenario: A two-parent merge reuses the run recording its tree
    Given a PR run whose "tested-tree-<tree>" artifact names the merged tree and no pull lookup answer
    When the script judges the two-parent merge commit
    Then it writes "reuse=true"

  @test:scripts/tests/sdlc/verdict-reuse.test.ts::verdict-reuse.sh::a_different_recorded_tree_is_not_reused
  Scenario: A run recording a different tree is not reused
    Given a PR run whose artifact names an all-zero tree
    When the script judges the squash commit
    Then it writes "reuse=false"

  @test:scripts/tests/sdlc/verdict-reuse.test.ts::verdict-reuse.sh::no_record_is_not_reused
  Scenario: A run with no tested-tree record is not reused
    Given a PR run whose only artifact is "qa-working-copy"
    When the script judges the squash commit
    Then it writes "reuse=false"

  @test:scripts/tests/sdlc/verdict-reuse.test.ts::verdict-reuse.sh::two_records_in_one_run_are_not_reused
  Scenario: A run with two tested-tree records is not reused
    Given a PR run with artifacts naming the squash commit's tree and an all-zero tree
    When the script judges the squash commit
    Then it writes "reuse=false"

  @test:scripts/tests/sdlc/verdict-reuse.test.ts::verdict-reuse.sh::a_one-parent_commit_no_PR_was_merged_as_—_a_direct_push_—_is_not_reused
  Scenario: A one-parent commit no PR was merged as is not reused
    Given a PR run recording the squash tree, and no PR answered for any commit
    When the script judges the direct-push commit
    Then it writes "reuse=false"
    And judging the squash commit likewise writes "reuse=false"

  @test:scripts/tests/sdlc/verdict-reuse.test.ts::verdict-reuse.sh::a_commit_two_merged_PRs_claim_is_not_reused
  Scenario: A commit claimed by two merged PRs is not reused
    Given a PR run recording the squash tree, and two merged PRs naming the squash commit as their merge commit
    When the script judges the squash commit
    Then it writes "reuse=false"

  @test:scripts/tests/sdlc/verdict-reuse.test.ts::verdict-reuse.sh::a_run_that_skipped_one_of_the_eight_jobs_is_not_reused
  Scenario: A run missing one of the eight skippable jobs is not reused
    Given a PR run recording the squash tree whose jobs lack "TypeScript — bun test, shard 1/4"
    When the script judges the squash commit
    Then it writes "reuse=false"
