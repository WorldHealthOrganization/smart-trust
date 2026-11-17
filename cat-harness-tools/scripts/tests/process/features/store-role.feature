# A store is a Role with a store block.
Feature: A store is a Role with a store block

  @test:scripts/tests/process/store-role.test.ts::the_store_block::a_store_role_parses_with_its_block_intact
  Scenario: A store role parses with its store block intact
    Given a "work-plan" role played by a system, with a store block holding a graphql API and a cli API
    When it is parsed as a RoleDef
    Then its first API style is "graphql"
    And storeRoleError reports nothing

  @test:scripts/tests/process/store-role.test.ts::the_store_block::an_API_style_no_transport_uses_is_refused
  Scenario: An unknown API style is refused
    Given the store role with an API of style "soap"
    When it is parsed as a RoleDef
    Then parsing fails

  @test:scripts/tests/process/store-role.test.ts::the_store_block::an_unknown_key_in_the_block_is_refused,_not_dropped
  Scenario: An unknown key in the store block is refused
    Given the store role with an extra "owner" key in its store block
    When it is parsed as a RoleDef
    Then parsing fails

  @test:scripts/tests/process/store-role.test.ts::the_store_block::a_role_people_or_agents_play_cannot_be_a_store
  Scenario: A role played by an agent cannot be a store
    Given the store role with actor kinds "agent" and "system"
    When it is parsed and checked with storeRoleError
    Then the error says "a store is played by system or external actors only"
