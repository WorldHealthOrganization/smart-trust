# The derivedFrom field of a content directory declaration (schemas/kg/cat-harness.ts):
# the shape alone, with resolution left to check:derived-from. Each Scenario names the test that executes it.
Feature: derivedFrom on a directory declaration

  @test:schemas/derived-from.test.ts::derivedFrom::absent_is_valid:_'not_declared',_which_check:derived-from_reports_separately
  Scenario: A directory without derivedFrom is valid
    Given a content directory "ig-docs" with no derivedFrom
    When it is parsed with the content directory schema
    Then parsing succeeds

  @test:schemas/derived-from.test.ts::derivedFrom::a_list_of_directory_ids_is_valid
  Scenario: A list of directory ids is a valid derivedFrom
    Given a content directory with derivedFrom "artifact-index" and "ig-ast"
    When it is parsed with the content directory schema
    Then parsing succeeds
    And derivedFrom is "artifact-index", "ig-ast"

  @test:schemas/derived-from.test.ts::derivedFrom::an_empty_list_says_nothing_a_reader_can_act_on,_so_it_is_refused
  Scenario: An empty derivedFrom list is refused
    Given a content directory with an empty derivedFrom list
    When it is parsed with the content directory schema
    Then parsing fails

  @test:schemas/derived-from.test.ts::derivedFrom::an_empty_id_is_refused
  Scenario: An empty id in derivedFrom is refused
    Given a content directory with derivedFrom holding an empty string
    When it is parsed with the content directory schema
    Then parsing fails

  @test:schemas/derived-from.test.ts::derivedFrom::an_id_named_twice_is_refused
  Scenario: An id named twice in derivedFrom is refused
    Given a content directory with derivedFrom "a", "a"
    When it is parsed with the content directory schema
    Then parsing fails
    And the issues say "derivedFrom names an id twice"
