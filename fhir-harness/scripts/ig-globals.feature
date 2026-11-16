Feature: The IG's global profiles table

  @test:scripts/ig-globals.test.ts::the_IG's_global_profiles_(globals-table.xhtml)::fromIgSortedDropsMalformed
  Scenario: read from an ImplementationGuide's global, sorted by type, malformed entries dropped
    Given an ImplementationGuide declaring globals for Patient and Encounter and a malformed one with no profile
    Then the globals are Encounter then Patient, without the malformed one
    And an ImplementationGuide with no globals gives none

  @test:scripts/ig-globals.test.ts::the_IG's_global_profiles_(globals-table.xhtml)::fromSushiOneOrSeveral
  Scenario: read from sushi-config's global map, one profile or several per type
    Given a sushi-config global map with one profile for Patient and two for Observation
    Then the globals are the two Observation profiles sorted, then Patient
    And a config with no globals gives none

  @test:scripts/ig-globals.test.ts::the_IG's_global_profiles_(globals-table.xhtml)::templateRowsOrNone
  Scenario: the template lays out the rows, and says so when there are none
    Given the globals table template
    Then with one global it renders the type and links the profile
    And with none it says there are no Global profiles defined

  @test:scripts/ig-globals.test.ts::the_IG's_global_profiles_(globals-table.xhtml)::includingPageGetsTable
  Scenario: a page that includes the fragment gets the table, and the stage says where its rows came from
    Given an IG declaring one global and a page including the globals table
    When it is staged
    Then the table is not reported as not rendered
    And the globals came from sushi-config.yaml with 1 row and are written to the fhir data
    And the stage description says where the 1 global profile came from
