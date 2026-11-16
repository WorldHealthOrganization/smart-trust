# Specifies that each staged target repository in REPOS
# (scripts/partition/instance-rules.ts) names an instance whose declaration
# declares that same name.
Feature: Every staged target repository agrees with its instance's declaration

  @test:test/coordinator/partition-names-checkout.test.ts::every_staged_target_repo_agrees_with_its_instance's_declaration::%s:_`%s`_is_declared_under_that_name
  Scenario: Each staged target repository's instance declares that same name
    Given a table with one row per REPOS target that names an instance: its id and that instance
    When the instance's declaration is read
    Then it declares a name
    And that name is the instance REPOS names
