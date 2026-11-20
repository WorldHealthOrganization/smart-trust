# Specifies skillContracts and contractFile (scripts/skill-contracts.ts) for
# a skill whose contract moved up with it to folio-assistant-sci.
Feature: A skill's local contract resolves against the instance holding the skill

  @test:test/coordinator/skill-contracts-checkout.test.ts::a_skill_names_its_own_contracts_(#1168,_B3b)::a_local_contract_resolves_against_the_instance_HOLDING_the_skill_(placement_PR1)
  Scenario: latex-authoring's input contract resolves in folio-assistant-sci, not in cat-harness
    Given the skill contracts seen from the cat-harness instance
    When latex-authoring's contract is read
    Then its input is "schemas/skills/latex-authoring/input.schema.json"
    And its instance root is folio-assistant-sci beside cat-harness
    And the contract file exists under folio-assistant-sci
    And no such file exists under cat-harness
