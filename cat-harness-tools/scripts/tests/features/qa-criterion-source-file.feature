# A criterion's declared source_file must be the file that holds its checker,
# since script_hash is computed over it (beans b7yo, fg6z). Each Scenario
# names the test that executes it.
Feature: A criterion's source file hosts its checker

  @test:scripts/tests/qa-criterion-source-file.test.ts::getCriterionSourceFile_—_declared_source_must_host_the_checker::there_are_automated_criteria_to_check
  Scenario: There are automated criteria to check
    # Gap: the describe says the declared source must host the checker; this test checks only that more than 40 criteria are automated, and nothing here compares a criterion's source_file with its checker.
    Then the registry declares more than 40 automated criteria

  @test:scripts/tests/qa-criterion-source-file.test.ts::a_contributed_checker_cannot_fall_through_to_the_default::the_cascade_REFUSES_a_checker_contributed_criterion
  Scenario: The cascade refuses a checker_contributed criterion
    Given the registry's criteria declared checker_contributed
    Then there is at least one
    And asking each one's source file throws, naming "checker_contributed"
