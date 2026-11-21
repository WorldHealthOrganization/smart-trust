# Specifies, by reading docs-site.yml and feature-staging.yml, that both copy
# the QA witnesses and results into the published site.
Feature: Both publishing workflows copy the QA witnesses and results into the site

  @test:test/coordinator/qa-results-workflows.test.ts::the_witnesses_are_committed_in_one_place_and_published_in_another::BOTH_publishing_workflows_copy_them_into_the_site
  Scenario: Both workflows copy the witnesses and the results into assets/qa
    Given docs-site.yml and feature-staging.yml
    When each is read
    Then it contains "cp -rT "
    And it contains "test/results/witnesses ./_site/assets/qa"
    And it contains "*.qa-results.json"
