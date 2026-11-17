# Every TypeScript file in this layer is either covered by a tsconfig.json include, exempt by an exclude,
# or unnamed, and the test fails on any unnamed file. Each Scenario names the test that executes it.
Feature: Typecheck program coverage

  @test:test/typecheck-coverage.test.ts::typecheck_program_coverage_(bean_lvoa)::classifies_by_include_and_exclude,_and_an_unnamed_file_is_neither
  Scenario: Files are classified as covered, exempt or unnamed by include and exclude
    Given include "src/**/*.ts" and exclude "dist" and "**/*.e2e.ts"
    Then "src/a.ts" is covered
    And "src/a.e2e.ts" is exempt
    And "dist/src/a.ts" is exempt, the bare directory meaning everything beneath it
    And "elsewhere/a.ts" is unnamed

  @test:test/typecheck-coverage.test.ts::typecheck_program_coverage_(bean_lvoa)::leaves_no_TypeScript_file_unnamed_by_tsconfig.json
  Scenario: No TypeScript file in the layer is unnamed by tsconfig.json
    Given this layer's tsconfig.json and every TypeScript file outside node_modules, dist and .git
    When each file is classified
    Then at least one file is found and at least one is covered
    And no file is unnamed
