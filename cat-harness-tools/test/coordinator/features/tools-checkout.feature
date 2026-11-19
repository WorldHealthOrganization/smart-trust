# Specifies checkTools and knownSkills (scripts/check-tools.ts) and the
# remedy lookups of schemas/tools/tool.ts over the real Tool graph.
Feature: Tools satisfy real skills, and network Tools name remedies that exist

  @test:test/coordinator/tools-checkout.test.ts::tools::every_satisfies_names_a_skill_that_exists
  Scenario: Every satisfies names a skill that exists
    Given the Tool audit of the checkout
    When its dangling satisfies are read
    Then there are none

  @test:test/coordinator/tools-checkout.test.ts::tools::skill_discovery_is_not_a_hardcoded_list
  Scenario: Skill discovery finds packages a hardcoded list would miss
    Given the known skills
    When they are searched
    Then they include smart-base-tools, lean-formalization and kg-export

  @test:test/coordinator/tools-checkout.test.ts::remedies_over_the_real_Tool_graph::every_network_Tool_states_its_remedies,_and_every_named_remedy_exists
  Scenario: Every network Tool states its remedies, and every named remedy exists
    Given every Tool
    When network Tools without remedies and dangling remedies are collected
    Then there are none of either

  @test:test/coordinator/tools-checkout.test.ts::remedies_over_the_real_Tool_graph::a_refused_packages.fhir.org_leads_to_fhir-cache-seed-npm
  Scenario: A refused packages.fhir.org leads to fhir-cache-seed-npm
    Given every Tool
    When the remedies for "packages.fhir.org" are looked up
    Then the Tools they name are exactly fhir-cache-seed-npm
