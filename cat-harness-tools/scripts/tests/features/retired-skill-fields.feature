# A field retired from SkillDefinition (roles, schemaRefs) does not quietly
# come back: every TypeScript literal and JSON definition the checkout
# resolves is swept for it, and each retirement record dereferences. Each
# Scenario names the test that executes it.
Feature: Retired SkillDefinition fields stay retired

  @test:scripts/tests/retired-skill-fields.test.ts::retired_SkillDefinition_fields::the_sweep_found_the_skill_definitions_—_otherwise_nothing_below_holds
  Scenario: The sweep finds the composed checkout's skill definitions
    Given a composed checkout, else the test is not applicable and skips
    When the skill definition files are swept
    Then more than 15 are found

  @test:scripts/tests/retired-skill-fields.test.ts::retired_SkillDefinition_fields::the_sweep_found_cat-harness's_OWN_skill_definitions
  Scenario: The sweep finds cat-harness's own skill definitions
    When the skill definition files are swept
    Then at least one lies under cat-harness's own tree

  @test:scripts/tests/retired-skill-fields.test.ts::retired_SkillDefinition_fields::every_record_named_here_dereferences
  Scenario: Every retirement record exists
    Given a composed checkout holding the fsh-guts trashcan, else the test is not applicable and skips
    Then the roles record in the trashcan and the schemaRefs record in assistant-types.ts both exist

  @test:scripts/tests/retired-skill-fields.test.ts::retired_SkillDefinition_fields::no_SkillDefinition_declares_`%s`
  Scenario Outline: No skill definition declares a retired field
    When the swept definitions are read for the field <field>, as a JSON top-level key or a TypeScript property line
    Then none declares it

    Examples:
      | field      |
      | roles      |
      | schemaRefs |
