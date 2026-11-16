# Specifies storeLinkProblems in archimate/scripts/check-archimate.ts: the
# store, api, schema and actorDefinition properties of an ArchiMate model's
# elements (owner, 2026-11-01, Q-DS-8 A).
Feature: A store in an ArchiMate model can be reached through an api

  @test:archimate/scripts/store-links.test.ts::store_links::a_model_that_marks_no_store_passes
  Scenario: A model that marks no store has no problems
    Given a model with one application component and no properties
    When its store links are checked
    Then there are no problems

  @test:archimate/scripts/store-links.test.ts::store_links::a_store_with_an_api_on_itself_passes
  Scenario: A store with its own api property passes
    Given an application component with a "store" and an "api" property
    When its store links are checked
    Then there are no problems

  @test:archimate/scripts/store-links.test.ts::store_links::a_store_with_an_api_on_a_composed_interface_passes
  Scenario: A store whose composed interface has the api passes
    Given an application component with a "store" property
    And an application interface with an "api" property, composed into it
    When its store links are checked
    Then there are no problems

  @test:archimate/scripts/store-links.test.ts::store_links::a_store_nobody_can_reach_is_reported
  Scenario: A store with no api anywhere is reported
    Given an application component "HWR" with a "store" property and no api on it or on a composed interface
    When its store links are checked
    Then the only problem says store "HWR" has no api property, on itself or on an application interface composed into it

  @test:archimate/scripts/store-links.test.ts::store_links::a_data_object_marked_as_a_store_is_reported
  Scenario: A data object marked as a store is reported
    Given a data object with a "store" and an "api" property
    When its store links are checked
    Then the first problem says it is a DataObject marked as a store

  @test:archimate/scripts/store-links.test.ts::store_links::an_empty_link_says_nothing,_and_is_reported
  Scenario: An empty link property is reported
    Given a data object "Worker" whose "schema" property is a single space
    When its store links are checked
    Then the only problem says "Worker" has an empty schema property
