# Reading the package workflow-policy.json files: a package is a directory
# holding a skill.
Feature: Package workflow policy files load only when sound

  @test:scripts/tests/process/workflow-gate.test.ts::reading_the_package_policy_files::a_relaxation_with_no_reason_does_not_load
  Scenario: A relaxation with no reason does not load
    Given a package skills/pkg holding a skill and a workflow-policy.json with a relaxation that gives no reason
    When the relaxations are loaded
    Then loading throws a PolicyError mentioning "reason"

  @test:scripts/tests/process/workflow-gate.test.ts::reading_the_package_policy_files::a_policy_file_claiming_to_be_a_different_package_does_not_load
  Scenario: A policy file naming another package does not load
    Given a package skills/pkg holding a skill and a workflow-policy.json declaring package "somewhere-else"
    When the relaxations are loaded
    Then loading throws an error mentioning "declares package"

  @test:scripts/tests/process/workflow-gate.test.ts::reading_the_package_policy_files::a_package_with_no_policy_file_relaxes_nothing
  Scenario: A package with no policy file relaxes nothing
    Given a repository whose skills/quiet directory has no workflow-policy.json
    When the relaxations are loaded
    Then there are none
