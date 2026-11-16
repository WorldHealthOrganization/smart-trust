# Specifies that feature-staging.yml carries the same branch-name sanitiser
# pipeline the staging-slug tests run.
Feature: The staging-slug sanitiser is the pipeline the workflow runs

  @test:test/coordinator/staging-slug-workflows.test.ts::the_sanitiser,_run_rather_than_described::it_is_the_SAME_pipeline_the_workflow_runs_—_or_this_whole_file_is_fiction
  Scenario: feature-staging.yml contains both sed steps of the sanitiser
    Given feature-staging.yml
    When it is read
    Then it contains "sed 's|[^a-zA-Z0-9._-]|-|g'"
    And it contains "sed 's|--*|-|g'"
