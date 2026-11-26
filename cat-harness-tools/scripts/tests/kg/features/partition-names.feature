# scripts/partition/instance-rules.ts lists the partition's target repos; a staged target's name
# must equal the instance staging it, and an unstaged target is a plan.
# Each Scenario names the test that executes it.
Feature: A partition target's name equals the instance staging it

  @test:scripts/tests/kg/partition-names.test.ts::a_target_with_no_instance_is_a_PLAN,_and_is_allowed_to_have_one
  Scenario: A target with no instance remains, as a plan
    When the partition targets with no instance are listed
    Then they include "kg"

  @test:scripts/tests/kg/partition-names.test.ts::the_loop_is_not_vacuous_—_it_covers_the_targets_that_ARE_staged
  Scenario: At least four targets are staged
    When the partition targets with an instance are listed
    Then there are at least 4 of them

  @test:scripts/tests/kg/partition-names.test.ts::a_staged_target's_NAME_equals_the_instance_staging_it
  Scenario: Each staged target's name equals its instance
    When each partition target with an instance is read
    Then its name equals its instance
