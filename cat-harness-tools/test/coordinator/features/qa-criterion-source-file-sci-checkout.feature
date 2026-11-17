# Specifies resolveCriterionSource and isCriterionSourceMiss
# (pipeline/criterion-source.ts) against the qa-checkers-*.ts files of every
# instance in the checkout.
Feature: A criterion's declared source file is the file that hosts its checker

  @test:test/coordinator/qa-criterion-source-file-sci-checkout.test.ts::getCriterionSourceFile_—_declared_source_must_host_the_checker::the_glob_finds_the_checker_files
  Scenario: The checker files are found
    Given every instance's pipeline/qa-checkers-*.ts files
    When they are read
    Then there are at least 10

  @test:test/coordinator/qa-criterion-source-file-sci-checkout.test.ts::getCriterionSourceFile_—_declared_source_must_host_the_checker::every_locatable_automated_criterion_is_hashed_against_its_own_file
  Scenario: Every locatable automated criterion is resolved to a file that hosts its checker
    Given every automated criterion
    When its source is resolved with the checkout's contributions
    Then none is a miss
    And for each criterion some checker file hosts, the resolved file is one of those hosts

  @test:test/coordinator/qa-criterion-source-file-sci-checkout.test.ts::getCriterionSourceFile_—_declared_source_must_host_the_checker::an_automated_criterion_with_NO_checker_anywhere_is_a_defect,_not_a_pass
  Scenario: Every automated criterion has a checker somewhere
    Given every automated criterion
    When the checker files are searched for its entry or its checker function
    Then every criterion is hosted by at least one file

  @test:test/coordinator/qa-criterion-source-file-sci-checkout.test.ts::a_contributed_checker_cannot_fall_through_to_the_default::and_the_resolver_answers_for_exactly_those,_from_the_contributor
  Scenario: A contributed checker resolves from its contributor
    Given every criterion declared checker_contributed
    When its source is resolved
    Then it is not a miss
    And its root is not cat-harness's
    And its label starts with the name of the contributor that supplied it
