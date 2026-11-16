# Specifies that every path a platform workflow (docs-site.yml,
# feature-staging.yml, jsonld-gen-check.yml, code-quality-gates.yml) names
# under a moved directory exists.
Feature: A path a platform workflow names exists

  @test:test/coordinator/workflow-paths-resolve.test.ts::a_platform_workflow_names_paths_that_exist::%s_names_only_paths_that_exist
  Scenario: Each platform workflow names only paths that exist
    Given a table of the workflows docs-site.yml, feature-staging.yml, jsonld-gen-check.yml and code-quality-gates.yml
    When the row's workflow file under .github/workflows is read
    Then it exists
    And every path it names under a moved directory, outside comments, globs, expressions and directories, exists in the checkout
