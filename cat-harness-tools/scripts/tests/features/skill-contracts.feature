# A skill names its own contracts. Each Scenario names the test that executes it.
Feature: Skill contract references

  @test:scripts/tests/skill-contracts.test.ts::a_skill_names_its_own_contracts_(#1168,_B3b)::a_local_ref_is_a_path_inside_the_instance;_an_external_one_is_https
  Scenario: A contract ref is a local path inside the instance or an https URL
    Then a relative schema path and an https URL have no problem
    And an http URL must be https, an absolute path must be relative, a parent path must be inside, and a .md must be JSON
    And an https URL is external and has no local file

  @test:scripts/tests/skill-contracts.test.ts::a_skill_names_its_own_contracts_(#1168,_B3b)::the_contracts_are_found_through_the_skill,_not_a_directory_name
  Scenario: Contracts are found through the skill
    When the harness's skill contracts are read
    Then content-validate's input is schemas/skills/content-validate/input.schema.json, declared in content-validate.md
    And that file exists

  @test:scripts/tests/skill-contracts.test.ts::a_skill_names_its_own_contracts_(#1168,_B3b)::every_declared_local_contract_exists
  Scenario: Every declared local contract exists
    When every skill contract's local input and output files are resolved
    Then none is missing
