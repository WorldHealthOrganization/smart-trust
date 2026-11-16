# The staging slug that .github/workflows/feature-staging.yml derives from a branch name must be
# one safe path segment; these tests run the real sed sanitiser, git, rm and the workflow YAML.
# Each Scenario names the test that executes it.
Feature: The staging slug is one safe path segment

  @test:scripts/tests/sdlc/staging-slug.test.ts::the_sanitiser,_run_rather_than_described::THE_FINDING_—_input_`..`_survives_as_output_`..`
  Scenario: The sanitiser turns ".." into ".."
    Given the workflow's sed sanitiser pipeline
    When it is run on ".."
    Then the output is ".."

  @test:scripts/tests/sdlc/staging-slug.test.ts::the_sanitiser,_run_rather_than_described::a_path_separator_can_never_survive:_`/`_is_not_in_the_permitted_class
  Scenario: The sanitiser never lets a path separator through
    Given the workflow's sed sanitiser pipeline
    Then "../.." becomes "..-.."
    And "feat/../x" becomes "feat-..-x"
    And "a/b/c" becomes "a-b-c"

  @test:scripts/tests/sdlc/staging-slug.test.ts::the_sanitiser,_run_rather_than_described::%s_->_%s
  Scenario: The sanitiser maps ordinary branch names to their slugs
    Given the workflow's sed sanitiser pipeline
    When each row's branch name is sanitised
    Then the output is the row's slug
    And the rows are "claude/my-branch" to "claude-my-branch", "feat/ABC-1" to "feat-ABC-1" and "a..b" to "a..b"

  @test:scripts/tests/sdlc/staging-slug.test.ts::GUARD_1_—_git_rejects_every_ref_name_containing_`..`::git_refuses_the_branch_name_%s
  Scenario: git refuses branch names containing ".." or starting with "."
    When "git check-ref-format --branch" is run on each row's name
    Then it exits non-zero
    And the rows are "..", "a..b", "../..", "feat/../x", "..." and ".git"

  @test:scripts/tests/sdlc/staging-slug.test.ts::GUARD_1_—_git_rejects_every_ref_name_containing_`..`::and_it_accepts_the_ordinary_names_this_repo_uses,_so_the_check_means_something
  Scenario: git accepts the ordinary branch names this repo uses
    When "git check-ref-format --branch" is run on "claude/sleepy-babbage-ls90iz" and on "main"
    Then both are accepted

  @test:scripts/tests/sdlc/staging-slug.test.ts::GUARD_2_—_`rm`_refuses_a_`.`_or_`..`_operand::`rm_-rf_STAGING/..`_deletes_NOTHING_and_exits_non-zero
  Scenario: rm refuses a ".." operand and deletes nothing
    Given a temporary directory holding "STAGING/keepme/file.txt"
    When "rm -rf STAGING/.." is run there
    Then it exits non-zero
    And "STAGING/keepme/file.txt" still holds "x"

  @test:scripts/tests/sdlc/staging-slug.test.ts::THE_RESIDUAL_—_`git_add`_does_not_refuse,_which_is_why_the_guard_is_on_the_VALUE::`git_add_-A_STAGING/..`_stages_the_tree_ABOVE_the_previews
  Scenario: git add with a ".." slug stages the tree above the previews
    Given a git repository with a committed "STAGING/x/f" and a "rootfile" changed since the commit
    When "git add -A STAGING/.." is run
    Then it exits zero
    And the only staged file is "rootfile"

  @test:scripts/tests/sdlc/staging-slug.test.ts::GUARD_3_—_the_workflow_checks_the_VALUE,_in_every_job_that_builds_a_path_from_it::ALL_THREE_jobs_that_handle_a_slug_refuse_``,_`.`_and_`..`
  Scenario: Every job that handles a slug refuses an empty, "." or ".." slug
    Given the feature-staging workflow parsed as YAML
    When the jobs with a step running a case on "$SLUG" that refuses "", "." and ".." are collected
    Then they are exactly "cleanup", "cleanup-dispatch" and "stage"

  @test:scripts/tests/sdlc/staging-slug.test.ts::GUARD_3_—_the_workflow_checks_the_VALUE,_in_every_job_that_builds_a_path_from_it::ALL_THREE_jobs_also_refuse_`_retired`_—_the_retired-record_store_is_not_a_preview_(bean_6pfo)
  Scenario: Every job that writes or deletes a preview also refuses "_retired"
    Given the feature-staging workflow parsed as YAML
    When the jobs with a step whose slug guard also refuses "_retired" are collected
    Then they include "cleanup", "cleanup-dispatch" and "stage"

  @test:scripts/tests/sdlc/staging-slug.test.ts::GUARD_3_—_the_workflow_checks_the_VALUE,_in_every_job_that_builds_a_path_from_it::every_`rm_-rf`_on_a_slug_is_in_a_job_whose_slug_was_checked
  Scenario: There are at least as many slug guards as rm -rf commands on a slug
    Given the feature-staging workflow text
    Then it holds at least one "rm -rf" on a preview directory built from a variable
    And the number of slug guards is at least the number of those "rm -rf" commands
    # Gap: only counts are compared; it is not checked that each rm -rf sits in a job whose slug was guarded.
