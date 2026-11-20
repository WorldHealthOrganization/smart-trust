# folio-paper-adapter skills are modelled into roles (bean
# folio-assistant-3025). Each Scenario names the test that executes it.
Feature: The paper adapter's skills are bound to roles

  @test:scripts/tests/paper-adapter-roles.test.ts::folio-paper-adapter_role_modelling_(bean_3025)::the_three_paper_roles_are_declared,_by_the_harness_or_the_paper_layer,_with_personas
  Scenario: The three paper roles are declared with personas
    Given a checkout holding the paper layer
    Then lean-authoring-agent, proof-review-agent and compute-authoring-agent are declared, each with a description and persona over 10 characters and the agent actor kind

  @test:scripts/tests/paper-adapter-roles.test.ts::folio-paper-adapter_role_modelling_(bean_3025)::every_skill_in_folio-paper-adapter_is_accounted_for_(bound_or_consulted:_true)
  Scenario: Every skill in folio-paper-adapter is bound or consulted
    Given the folio-paper-adapter package manifest is found
    Then the manifest lists exactly the package's skill files, at least 47
    And every skill is bound to a role or extension, or is marked consulted: true
    # Gap: when the package is not in the checkout the test returns early and asserts nothing.
