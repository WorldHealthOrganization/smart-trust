# scripts/check-workflow-script-paths.ts checks that a workflow which runs a script rebuilds when that script changes.
# These Scenarios cover a script named with a leading "./". Each Scenario names the test that executes it.
Feature: A workflow script named with a leading ./ is matched like one without it

  @test:scripts/tests/sdlc/check-workflow-script-paths.test.ts::a_script_named_with_a_leading_./::is_the_same_file_as_without_it
  Scenario: A leading ./ on an imported script is dropped from the invoked path
    Given a repository root holding "tools/scripts/a.ts"
    When the scripts are read from a run line that imports "./tools/scripts/a.ts" via bun -e
    Then the invoked scripts are exactly "tools/scripts/a.ts"

  @test:scripts/tests/sdlc/check-workflow-script-paths.test.ts::a_script_named_with_a_leading_./::is_covered_by_the_directory_pattern_that_covers_it_without_the_./
  Scenario: A ./-prefixed script is covered by the paths pattern for its directory
    Given a repository root holding "tools/scripts/a.ts"
    And a workflow whose pull_request paths list "tools/scripts/**"
    And a step that imports "./tools/scripts/a.ts" via bun -e
    When the workflow is assessed
    Then the verdict is "covered"
    And no script is reported uncovered

  @test:scripts/tests/sdlc/check-workflow-script-paths.test.ts::a_script_named_with_a_leading_./::an_uncovered_script_is_still_reported
  Scenario: A ./-prefixed script outside the paths filter is still reported uncovered
    Given a repository root holding "tools/scripts/a.ts"
    And a workflow whose pull_request paths list only "docs/**"
    And a step that runs "bun ./tools/scripts/a.ts"
    When the workflow is assessed
    Then the uncovered scripts are exactly "tools/scripts/a.ts"
