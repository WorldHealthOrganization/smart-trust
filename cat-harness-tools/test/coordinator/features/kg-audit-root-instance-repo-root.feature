# Specifies that the checkout root declares no instance and that every
# instance its index.config.json lists is declared below it.
Feature: The checkout root declares no instance, and every indexed instance is declared below it

  @test:test/coordinator/kg-audit-root-instance-repo-root.test.ts::kg:audit_over_the_instance_declared_at_the_repository_root_(bean_`pgzn`)::the_repository_root_declares_no_instance,_so_nothing_escapes_kg:audit_by_sitting_at_the_root
  Scenario: The checkout root declares no instance
    Given the checkout root
    When its declaration is read
    Then there is none

  @test:test/coordinator/kg-audit-root-instance-repo-root.test.ts::kg:audit_over_the_instance_declared_at_the_repository_root_(bean_`pgzn`)::every_instance_the_root's_index_lists_is_declared_below_it_—_the_cases_kg:audit_does_reach
  Scenario: Every instance the index lists is declared below the root
    Given the instances listed in the root's index.config.json
    When they are compared with the names declared by the instance roots below the checkout root
    Then the index lists at least one instance
    And every listed name is declared
