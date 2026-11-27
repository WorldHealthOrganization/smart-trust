# Specifies stagingSlug (test/health/checks.ts) against the sed pipeline that
# feature-staging.yml uses to slug a branch name.
Feature: The staging-preview slug in TypeScript agrees with the workflow's sed pipeline

  @test:test/coordinator/health-checks-workflows.test.ts::staging-preview-orphans::agrees_with_`feature-staging.yml`'s_own_sed_pipeline,_branch_for_branch
  Scenario: stagingSlug agrees with the workflow's sed pipeline for each sample branch
    Given the SLUG sed pipelines in feature-staging.yml
    When they are collected
    Then there are at least two and they are identical
    And for each of "claude/health-checks", "feat/a//b", "-lead-and-trail-", "release/v1.2.3" and "a__b--c", the pipeline run in bash exits 0 and its output equals stagingSlug of the branch
